const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const messaging = require('./messaging');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with an insecure fallback secret.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Comma-separated list of allowed frontend origins, e.g. "https://gurmadwaste.com,https://gurmad.vercel.app"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header, e.g. curl/mobile) and any configured origin
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // allow images to be loaded cross-origin
}));
app.use(cors(corsOptions));
app.use(express.json());

// Rate Limiting for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 15 minutes)
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auto-migrate System Tables
const runMigrations = async () => {
  try {
    // Leave System
    await db.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inventory System
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50) DEFAULT 'Pcs',
        price_per_unit DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'In Stock',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Complaints System
    await db.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        title VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Resolved
        priority VARCHAR(20) DEFAULT 'Medium',
        assigned_to INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications System
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // HASH EXISTING PLAIN TEXT PASSWORDS (Migration)
    const usersRes = await db.query('SELECT id, username, password FROM users');
    for (const u of usersRes.rows) {
       // If password doesn't start with $2a$ or $2b$ (bcrypt signatures), it's plain text
       if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          const hashed = await bcrypt.hash(u.password, salt);
          await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, u.id]);
          console.log(`Migrated password for user: ${u.username}`);
       }
    }

    // Collector Assignments
    await db.query(`
      CREATE TABLE IF NOT EXISTS collector_assignments (
        id SERIAL PRIMARY KEY,
        zone_group VARCHAR(50), 
        collector_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        collector_code VARCHAR(50), 
        zone_id_str VARCHAR(100), 
        truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Cashier Assignments (which zone/group a cashier collects money for)
    await db.query(`
      CREATE TABLE IF NOT EXISTS cashier_assignments (
        id SERIAL PRIMARY KEY,
        zone_group VARCHAR(50),
        cashier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        zone_id_str VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add missing columns to tasks table
    await db.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS zone_id INTEGER;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS truck_id INTEGER;
    `);

    // Track which cashier actually processed each invoice (separate from which collector's customer it was)
    await db.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cashier_id INTEGER REFERENCES users(id);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(100);
    `);

    // Gudoomiye (zone chairman) support: a user with role='gudoomiye' is scoped to one zone
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
    `);

    // Collector who registered a customer + when (traceability)
    await db.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // True 1-to-1 cashier <-> collector pairing (in addition to the existing zone-level cashier_assignments)
    await db.query(`
      ALTER TABLE cashier_assignments ADD COLUMN IF NOT EXISTS collector_id INTEGER REFERENCES employees(id) ON DELETE CASCADE;
    `);

    // Cashout now records which zone/gudoomiye finalized it
    await db.query(`
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
    `);

    // Track exactly when a customer was serviced (independent of payment)
    await db.query(`
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP;
    `);

    // Track exactly where the collector was standing when they marked a customer serviced
    await db.query(`
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS collected_lat DECIMAL(10, 8);
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS collected_lng DECIMAL(11, 8);
    `);

    console.log('Database migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  }
};

runMigrations();

// Setup multer storage for images
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const fileFilter = (req, file, cb) => {
  // Only accept image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Kaliya faylasha sawirada (images) ayaa la ogol yahay!'), false);
  }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Expose uploads directory to frontend.
// KNOWN RESIDUAL RISK: this stays unauthenticated because ~15 frontend components load
// these files via plain <img src="/api/uploads/...">, which cannot send an Authorization
// header. Filenames are unguessable (timestamp+random), but anyone with a filename can
// still fetch it with no login. The one concretely-proven leak (full DB backups) was
// removed by no longer writing backups into this folder at all (see /api/admin/backup).
// Fully closing this for ID documents/guarantor photos/attendance selfies needs a proper
// signed-URL or authenticated-image-proxy redesign — tracked as follow-up work, not done here.
app.use('/api/uploads', express.static(uploadDir));
app.use('/uploads', express.static(uploadDir));

// --- Middleware & Utilities ---
const logAudit = async (req, action, entityType, entityId, oldValues = null, newValues = null) => {
  try {
    const userId = req.headers['x-user-id'] || null;
    const ipAddress = req.ip || req.connection.remoteAddress;

    await db.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress
      ]
    );
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) return res.status(401).json({ error: 'Access denied: No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Access denied: Invalid or expired token' });
    req.user = user; // Set user object on request
    next();
  });
};

const checkRole = (roles) => [
  authenticateToken,
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }
    next();
  }
];

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'Connected to Gurmad Backend', time: new Date() });
});

// --- Authentication ---
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password, token } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (user.is_active === false) {
        return res.status(403).json({ error: 'Kowntigaan waa la xannibay. Fadlan la xidhiidh Maamulka.' });
      }

      if (user.two_factor_enabled) {
        if (!token) {
          return res.json({ require2FA: true, userId: user.id });
        }

        const verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token,
          window: 6
        });

        if (!verified) {
          return res.status(401).json({ error: 'Invalid authenticator code' });
        }
      }

      const jwtToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role, zone: user.zone },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const { password: userPassword, two_factor_secret, ...safeUser } = user;
      res.json({ ...safeUser, token: jwtToken });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login/verify-2fa', loginLimiter, async (req, res) => {
  const { userId, token } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 6
    });

    if (verified) {
      const jwtToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role, zone: user.zone },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password, two_factor_secret, ...safeUser } = user;
      res.json({ ...safeUser, token: jwtToken });
    } else {
      res.status(401).json({ error: 'Invalid authentication code' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/update_profile', authenticateToken, upload.single('profile_image'), async (req, res) => {
  const { id, username, password, full_name } = req.body;
  
  // Ensure user can only update their own profile
  if (parseInt(id) !== req.user.id && req.user.role !== 'admin') {
     return res.status(403).json({ error: 'Unauthorized to update this profile' });
  }

  const profile_image = req.file ? req.file.filename : null;

  try {
    let query = 'UPDATE users SET username = $1, full_name = $2';
    let values = [username, full_name || ''];
    let idx = 3;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      query += `, password = $${idx}`;
      values.push(hashedPassword);
      idx++;
    }

    if (profile_image) {
      query += `, profile_image = $${idx}`;
      values.push(profile_image);
      idx++;
    }

    query += ` WHERE id = $${idx} RETURNING id, username, role, profile_image, full_name`;
    values.push(id);

    const result = await db.query(query, values);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- User Management ---
app.get('/api/users', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, full_name, role, profile_image, two_factor_enabled, created_at, is_active FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', checkRole(['admin']), async (req, res) => {
  const { username, password, full_name, role, zone } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const result = await db.query(
      'INSERT INTO users (username, password, full_name, role, zone) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role, zone, created_at, is_active',
      [username, hashedPassword, full_name, role, zone || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/reset-password', checkRole(['admin']), async (req, res) => {
  const { newPassword } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/full-reset', checkRole(['admin']), async (req, res) => {
  const { newPassword } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await db.query('UPDATE users SET password = $1, two_factor_enabled = false, two_factor_secret = null WHERE id = $2', [hashedPassword, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', checkRole(['admin']), async (req, res) => {
  const { full_name, role, zone } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role), zone = $3 WHERE id = $4 RETURNING id, username, full_name, role, zone',
      [full_name || null, role || null, zone || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/toggle-status', checkRole(['admin']), async (req, res) => {
  try {
    const user = await db.query('SELECT is_active FROM users WHERE id = $1', [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const newStatus = !user.rows[0].is_active;
    const result = await db.query('UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active', [newStatus, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic Upload for Landing Page & Assets
app.post('/api/upload', checkRole(['admin', 'cashier', 'collector']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  });
});

// --- Customers ---
app.get('/api/customers', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const isGudoomiye = req.user.role.toLowerCase() === 'gudoomiye';
    const result = await db.query(`
      SELECT c.*, e.name as collector_name
      FROM customers c
      LEFT JOIN employees e ON c.collector_id = e.id
      ${isGudoomiye ? 'WHERE c.zone = $1' : ''}
      ORDER BY c.route_order ASC NULLS LAST, c.created_at DESC
    `, isGudoomiye ? [req.user.zone] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/customers', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const b = req.body;
    const safeNull = (v) => (v === '' || v === undefined ? null : v);
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10) || null);
    const safeNum = (v) => (v === '' || v === undefined || v === null ? null : parseFloat(v) || null);

    // A collector cannot pick a different zone than their own - it is auto-attached and traced.
    let zoneValue = safeNull(b.zone);
    if (req.user.role.toLowerCase() === 'collector') {
      const userRow = await db.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const fullName = userRow.rows[0]?.full_name;
      const assignment = await db.query(
        `SELECT ca.zone_group FROM collector_assignments ca JOIN employees e ON ca.collector_id = e.id WHERE e.name ILIKE $1 LIMIT 1`,
        [fullName]
      );
      zoneValue = assignment.rows[0]?.zone_group || zoneValue;
    }

    const result = await db.query(
      `INSERT INTO customers
        (name, phone, house_no, street, area, lat, lng, whatsapp, neighborhood, zone, category, fee,
         collector_id, route_order, collection_frequency, collection_mode, payment_status, registered_by, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
       RETURNING *`,
      [
        safeNull(b.name), safeNull(b.phone), safeNull(b.house_no), safeNull(b.street), safeNull(b.area),
        safeNum(b.lat), safeNum(b.lng),
        safeNull(b.whatsapp), safeNull(b.neighborhood), zoneValue,
        b.category || 'Guri', safeNum(b.fee) || 10,
        safeInt(b.collector_id),
        safeInt(b.route_order),
        b.collection_frequency || 'Weekly',
        b.collection_mode || 'Monthly',
        b.payment_status || 'Unpaid',
        req.user.id
      ]
    );
    await logAudit(req, 'CREATE', 'customers', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/customers] ERROR:', err.message, '| DETAIL:', err.detail || '');
    res.status(500).json({ error: err.message, detail: err.detail });
  }
});


// One-time bulk import of already-existing customers (spreadsheet/CSV upload), each tagged Household or Business
app.post('/api/customers/bulk-import', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ error: 'customers must be a non-empty array' });
  }
  const isGudoomiye = req.user.role.toLowerCase() === 'gudoomiye';

  let created = 0;
  const errors = [];
  for (let i = 0; i < customers.length; i++) {
    const b = customers[i];
    try {
      if (!b.name || !b.phone) {
        errors.push({ row: i + 1, error: 'name and phone are required' });
        continue;
      }
      const category = (b.category || '').toLowerCase().startsWith('bus') || (b.category || '').toLowerCase() === 'meherad'
        ? 'Meherad' : 'Guri';
      const zone = isGudoomiye ? req.user.zone : (b.zone || null);

      await db.query(
        `INSERT INTO customers
          (name, phone, house_no, street, area, zone, category, fee, payment_status, registered_by, registered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Unpaid', $9, NOW())`,
        [b.name, b.phone, b.house_no || null, b.street || null, b.area || null, zone, category, parseFloat(b.fee) || 10, req.user.id]
      );
      created++;
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  }

  res.json({ success: true, created, failed: errors.length, errors });
});

app.put('/api/customers/:id', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  try {
    const b = req.body;
    // Sanitize: convert empty strings to null, parse numbers properly
    const safeNull = (v) => (v === '' || v === undefined ? null : v);
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10) || null);
    const safeNum = (v) => (v === '' || v === undefined || v === null ? null : parseFloat(v) || null);

    const oldRow = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    const oldValues = oldRow.rows[0];

    const result = await db.query(
      `UPDATE customers SET 
        name = $1, phone = $2, house_no = $3, street = $4, area = $5, status = $6, lat = $7, lng = $8, 
        whatsapp = $9, neighborhood = $10, zone = $11, category = $12, fee = $13, 
        collector_id = $14, route_order = $15, collection_frequency = $16, payment_status = $17,
        collection_mode = $18
       WHERE id = $19 RETURNING *`,
      [
        safeNull(b.name), safeNull(b.phone), safeNull(b.house_no), safeNull(b.street), safeNull(b.area),
        b.status || b.payment_status || 'Unpaid',
        safeNum(b.lat), safeNum(b.lng),
        safeNull(b.whatsapp), safeNull(b.neighborhood), safeNull(b.zone),
        b.category || 'Guri', safeNum(b.fee) || 10,
        safeInt(b.collector_id),
        safeInt(b.route_order),
        b.collection_frequency || 'Weekly',
        b.payment_status || b.status || 'Unpaid',
        b.collection_mode || 'Monthly',
        req.params.id
      ]
    );
    await logAudit(req, 'UPDATE', 'customers', req.params.id, oldValues, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/customers/:id] ERROR:', err.message, '| DETAIL:', err.detail || '');
    res.status(500).json({ error: err.message, detail: err.detail });
  }
});


app.delete('/api/customers/:id', checkRole(['admin']), async (req, res) => {
  try {
    const oldRow = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING *', [req.params.id]);
    await logAudit(req, 'DELETE', 'customers', req.params.id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Invoices ---
app.get('/api/invoices/stats', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        SUM(amount) as total_usd,
        SUM(slsh_amount) as total_slsh,
        SUM(debt_amount) as total_debt,
        SUM(discount_amount) as total_discount
      FROM invoices
      WHERE created_at::date = CURRENT_DATE
    `);
    const trucksRes = await db.query(`SELECT COUNT(*) as active_trucks FROM trucks WHERE status = 'Active'`);
    res.json({
      total_usd: 0,
      total_slsh: 0,
      total_debt: 0,
      total_discount: 0,
      ...stats.rows[0],
      active_trucks: parseInt(trucksRes.rows[0].active_trucks || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.*, 
        c.name as customer_name, 
        c.phone as customer_phone,
        COALESCE(i.invoice_house_no, c.house_no) as customer_house,
        c.street as customer_street,
        c.area as customer_area,
        COALESCE(i.invoice_zone, c.zone) as zone 
      FROM invoices i 
      INNER JOIN customers c ON i.customer_id = c.id 
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  const { customer_id, phone, splitPayments, currency, collector_name, truck_name, zone, house_no, discount_amount = 0 } = req.body;
  const { cash = 0, zaad = 0, edahab = 0, debt = 0, slsh = 0 } = splitPayments || {};

  const amountFields = { cash, zaad, edahab, debt, slsh, discount_amount };
  for (const [key, val] of Object.entries(amountFields)) {
    const n = parseFloat(val);
    if (val !== undefined && val !== null && (isNaN(n) || n < 0)) {
      return res.status(400).json({ error: `Invalid amount for ${key}: must be a non-negative number` });
    }
  }

  try {
    // Fetch exchange rate for total calculation
    const rateResult = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'exchange_rate'");
    const exchangeRate = parseFloat(rateResult.rows[0]?.setting_value?.replace(/,/g, '')) || 11000;

    const grossAmount = parseFloat(cash) +
      parseFloat(zaad) +
      parseFloat(edahab) +
      parseFloat(debt) +
      (parseFloat(slsh) / exchangeRate);

    if (parseFloat(discount_amount) > grossAmount) {
      return res.status(400).json({ error: 'Discount amount cannot exceed the total invoice amount' });
    }

    const totalAmount = grossAmount - parseFloat(discount_amount);

    let customerId = customer_id;
    let customerNameFromReq = req.body.customer_name || 'New Walk-in Customer';

    if (!customerId) {
      // Find customer by phone if no ID provided
      let customer = await db.query('SELECT id, name FROM customers WHERE phone = $1', [phone]);
      
      if (customer.rows.length === 0) {
        const newCust = await db.query(
          'INSERT INTO customers (name, phone, area, whatsapp, neighborhood, zone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name',
          [customerNameFromReq, phone, '-', null, null, zone || null]
        );
        customerId = newCust.rows[0].id;
      } else {
        customerId = customer.rows[0].id;
      }
    }

    const invoiceStatus = (parseFloat(debt) > 0) ? 'Unpaid' : 'Paid';
    const mainMethod = parseFloat(zaad) > 0 ? 'ZAAD' : (parseFloat(edahab) > 0 ? 'eDahab' : (parseFloat(cash) > 0 ? 'Cash' : (parseFloat(slsh) > 0 ? 'SLSH' : 'Debt')));

    const cashierRes = await db.query('SELECT full_name, username FROM users WHERE id = $1', [req.user.id]);
    const cashierDisplayName = cashierRes.rows[0]?.full_name || cashierRes.rows[0]?.username || req.user.username;

    const result = await db.query(
      `INSERT INTO invoices
        (customer_id, amount, currency, status, payment_method, collector_name, cash_amount, zaad_amount, edahab_amount, debt_amount, is_split, truck_name, invoice_zone, invoice_house_no, slsh_amount, discount_amount, cashier_id, cashier_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        customerId,
        totalAmount,
        currency || 'USD',
        invoiceStatus,
        mainMethod,
        collector_name || null,
        cash, zaad, edahab, debt,
        true,
        truck_name || null,
        zone || null,
        house_no || null,
        slsh,
        discount_amount,
        req.user.id,
        cashierDisplayName
      ]
    );

    // If there is any debt amount, log it to the `debts` table
    if (parseFloat(debt) > 0) {
      await db.query(
        'INSERT INTO debts (customer_id, debtor_name, phone, amount, currency, description, status, collector_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [customerId, customerNameFromReq, phone, debt, currency || 'USD', `Split Payment Debt`, 'Unpaid', collector_name || null]
      );
    }

    // Sync customer status with the invoice
    await db.query(
      'UPDATE customers SET payment_status = $1, status = $1 WHERE id = $2',
      [invoiceStatus, customerId]
    );

    // Broadcast events
    io.emit('invoice_created', result.rows[0]);
    io.emit('customer_status_updated', {
      customerId: parseInt(customerId),
      status: invoiceStatus
    });

    await logAudit(req, 'CREATE', 'invoices', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Collector Assignments ---
app.get('/api/collector-assignments', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  try {
    const zoneFilter = req.user.role.toLowerCase() === 'gudoomiye' ? 'WHERE ca.zone_group = $1' : '';
    const params = req.user.role.toLowerCase() === 'gudoomiye' ? [req.user.zone] : [];
    const result = await db.query(`
      SELECT
        ca.id,
        ca.zone_group,
        ca.collector_id,
        e.name as collector_name,
        ca.collector_code,
        ca.zone_id_str,
        ca.truck_id,
        t.plate_number as assigned_truck,
        (SELECT COUNT(*) FROM customers c WHERE c.collector_id = ca.collector_id) as total_customers,
        (SELECT COUNT(*) FROM customers c WHERE c.collector_id = ca.collector_id AND c.status = 'Paid') as total_paid
      FROM collector_assignments ca
      LEFT JOIN employees e ON ca.collector_id = e.id
      LEFT JOIN trucks t ON ca.truck_id = t.id
      ${zoneFilter}
      ORDER BY ca.zone_group ASC, ca.id ASC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collector-assignments', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { zone_group, collector_id, collector_code, zone_id_str, truck_id } = req.body;
  if (req.user.role.toLowerCase() === 'gudoomiye' && zone_group !== req.user.zone) {
    return res.status(403).json({ error: 'A Gudoomiye can only dispatch collectors within their own zone' });
  }
  try {
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10));

    const result = await db.query(
      `INSERT INTO collector_assignments
        (zone_group, collector_id, collector_code, zone_id_str, truck_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [zone_group, safeInt(collector_id), collector_code, zone_id_str, safeInt(truck_id)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/collector-assignments/:id', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { id } = req.params;
  const { zone_group, collector_id, collector_code, zone_id_str, truck_id } = req.body;
  if (req.user.role.toLowerCase() === 'gudoomiye' && zone_group !== req.user.zone) {
    return res.status(403).json({ error: 'A Gudoomiye can only dispatch collectors within their own zone' });
  }
  try {
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10));

    const result = await db.query(
      `UPDATE collector_assignments SET 
        zone_group = $1, collector_id = $2, collector_code = $3, zone_id_str = $4, truck_id = $5
       WHERE id = $6 RETURNING *`,
      [zone_group, safeInt(collector_id), collector_code, zone_id_str, safeInt(truck_id), id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/collector-assignments/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM collector_assignments WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cashier Assignments (which zone/group a cashier collects money for) ---
app.get('/api/cashier-assignments', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  try {
    const isGudoomiye = req.user.role.toLowerCase() === 'gudoomiye';
    const result = await db.query(`
      SELECT
        ca.id,
        ca.zone_group,
        ca.cashier_id,
        u.full_name as cashier_name,
        ca.collector_id,
        e.name as collector_name,
        ca.zone_id_str,
        (SELECT COUNT(*) FROM customers c WHERE c.collector_id = ca.collector_id) as total_customers,
        (SELECT COUNT(*) FROM customers c WHERE c.collector_id = ca.collector_id AND c.status = 'Paid') as total_paid
      FROM cashier_assignments ca
      LEFT JOIN users u ON ca.cashier_id = u.id
      LEFT JOIN employees e ON ca.collector_id = e.id
      ${isGudoomiye ? 'WHERE ca.zone_group = $1' : ''}
      ORDER BY ca.zone_group ASC, ca.id ASC
    `, isGudoomiye ? [req.user.zone] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cashier-assignments', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { zone_group, cashier_id, collector_id, zone_id_str } = req.body;
  if (req.user.role.toLowerCase() === 'gudoomiye' && zone_group !== req.user.zone) {
    return res.status(403).json({ error: 'A Gudoomiye can only pair cashiers within their own zone' });
  }
  try {
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10));

    const result = await db.query(
      `INSERT INTO cashier_assignments
        (zone_group, cashier_id, collector_id, zone_id_str)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [zone_group, safeInt(cashier_id), safeInt(collector_id), zone_id_str]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cashier-assignments/:id', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { id } = req.params;
  const { zone_group, cashier_id, collector_id, zone_id_str } = req.body;
  if (req.user.role.toLowerCase() === 'gudoomiye' && zone_group !== req.user.zone) {
    return res.status(403).json({ error: 'A Gudoomiye can only pair cashiers within their own zone' });
  }
  try {
    const safeInt = (v) => (v === '' || v === undefined || v === null ? null : parseInt(v, 10));

    const result = await db.query(
      `UPDATE cashier_assignments SET
        zone_group = $1, cashier_id = $2, collector_id = $3, zone_id_str = $4
       WHERE id = $5 RETURNING *`,
      [zone_group, safeInt(cashier_id), safeInt(collector_id), zone_id_str, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cashier-assignments/:id', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM cashier_assignments WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The customers a cashier's paired collector(s) serve - so the cashier knows who to go collect money from
// Given a list of collector names, find their in-progress/today's task(s) and the customer list on those tasks
const getTodayRouteForCollectors = async (collectorNames) => {
  if (!collectorNames || collectorNames.length === 0) return { tasks: [], customers: [] };

  const tasksRes = await db.query(
    `SELECT id, collector_name, route_name, status
     FROM tasks
     WHERE LOWER(collector_name) = ANY($1::text[]) AND DATE(scheduled_at) = CURRENT_DATE
     ORDER BY id DESC`,
    [collectorNames.map(n => n.toLowerCase())]
  );
  if (tasksRes.rows.length === 0) return { tasks: [], customers: [] };

  const taskIds = tasksRes.rows.map(t => t.id);
  const taskCollectorMap = Object.fromEntries(tasksRes.rows.map(t => [t.id, t.collector_name]));

  const customersRes = await db.query(
    `SELECT c.*, tc.collected, tc.collected_at, tc.collected_lat, tc.collected_lng, tc.task_id
     FROM task_customers tc
     JOIN customers c ON tc.customer_id = c.id
     WHERE tc.task_id = ANY($1::int[])
     ORDER BY c.route_order ASC NULLS LAST, c.name ASC`,
    [taskIds]
  );

  const customers = customersRes.rows.map(c => ({ ...c, collector_name: taskCollectorMap[c.task_id] }));
  return { tasks: tasksRes.rows, customers };
};

// A collector's own list of customers on today's route, so they can go collect the garbage one by one
app.get('/api/collector/my-today-route', checkRole(['admin', 'collector']), async (req, res) => {
  try {
    const userRes = await db.query('SELECT full_name, username FROM users WHERE id = $1', [req.user.id]);
    const myName = userRes.rows[0]?.full_name || userRes.rows[0]?.username;
    const result = await getTodayRouteForCollectors([myName]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The customers the cashier's paired collector is working on today, so the cashier knows who to go collect money from
app.get('/api/cashier/my-collector-customers', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const pairings = await db.query(
      `SELECT ca.collector_id, e.name as collector_name
       FROM cashier_assignments ca
       LEFT JOIN employees e ON ca.collector_id = e.id
       WHERE ca.cashier_id = $1 AND ca.collector_id IS NOT NULL`,
      [req.user.id]
    );

    if (pairings.rows.length === 0) {
      return res.json({ collectors: [], tasks: [], customers: [] });
    }

    const collectorNames = pairings.rows.map(p => p.collector_name).filter(Boolean);
    const result = await getTodayRouteForCollectors(collectorNames);
    res.json({ collectors: pairings.rows, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Expenses ---
app.get('/api/expenses', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM expenses ORDER BY expense_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', checkRole(['admin', 'cashier']), upload.single('invoice_image'), async (req, res) => {
  const { category, description, amount, reference_no } = req.body;
  const invoice_image = req.file ? req.file.filename : null;

  try {
    const result = await db.query(
      'INSERT INTO expenses (category, description, amount, reference_no, invoice_image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [category, description, amount || 0, reference_no || null, invoice_image]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tasks ---
app.get('/api/tasks', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, lh.lat, lh.lng 
      FROM tasks t
      LEFT JOIN LATERAL (
        SELECT lat, lng 
        FROM truck_location_history 
        WHERE task_id = t.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) lh ON true
      ORDER BY t.status ASC, t.scheduled_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', checkRole(['admin', 'collector']), async (req, res) => {
  const { driver_name, collector_name, vehicle_plate, route_name, customer_ids, zone_id, truck_id } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO tasks (driver_name, collector_name, vehicle_plate, route_name, status, zone_id, truck_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [driver_name, collector_name || null, vehicle_plate || null, route_name, 'Pending', zone_id || null, truck_id || null]
    );
    const task = result.rows[0];

    if (customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0) {
      for (const cid of customer_ids) {
        await db.query(
          `INSERT INTO task_customers (task_id, customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [task.id, cid]
        );
      }
    } else {
      // Fallback: automatically assign all customers in the zone
      await db.query(
        `INSERT INTO task_customers (task_id, customer_id)
         SELECT $1, id FROM customers
         WHERE zone = $2 OR area = $2
         ON CONFLICT DO NOTHING`,
        [task.id, route_name]
      );
    }

    // Notify Driver and/or Collector
    const assignees = [driver_name, collector_name].filter(Boolean);
    for (const name of assignees) {
      const getC = await db.query('SELECT id FROM users WHERE full_name ILIKE $1 OR username ILIKE $1 LIMIT 1', [`%${name}%`]);
      if (getC.rows.length > 0) {
        await db.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)', [getC.rows[0].id, 'New Task Assigned', `You received a task: ${route_name}`]);
      }
    }

    await logAudit(req, 'CREATE', 'tasks', task.id, null, task);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id/customers', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT c.*, tc.collected 
       FROM customers c
       INNER JOIN task_customers tc ON c.id = tc.customer_id
       WHERE tc.task_id = $1
       ORDER BY c.name ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:taskId/customers/:customerId', checkRole(['admin', 'collector']), async (req, res) => {
  const { taskId, customerId } = req.params;
  const { collected } = req.body;
  try {
    await db.query(
      `UPDATE task_customers SET collected = $1, collected_at = $2 WHERE task_id = $3 AND customer_id = $4`,
      [collected, collected ? new Date() : null, taskId, customerId]
    );

    if (collected) {
      await db.query(`UPDATE customers SET status = 'Paid' WHERE id = $1`, [customerId]);
    }

    // Emit real-time customer status update
    io.emit('customer_status_updated', {
      customerId: parseInt(customerId),
      status: collected ? 'Paid' : 'Unpaid'
    });

    res.json({ success: true, collected });

    if (collected) {
      const cInf = await db.query('SELECT name FROM customers WHERE id = $1', [customerId]);
      const custName = cInf.rows[0]?.name || 'a customer';

      const targetUsers = await db.query("SELECT id FROM users WHERE role IN ('admin', 'cashier')");
      for (const u of targetUsers.rows) {
        await db.query(
          'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
          [u.id, 'Collection Logged', `Collection submitted for ${custName}.`]
        );
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a customer as serviced (waste picked up) WITHOUT touching payment/status.
// Used by collectors who don't handle money - the cashier bills these later.
app.post('/api/tasks/:taskId/customers/:customerId/service', checkRole(['admin', 'collector']), async (req, res) => {
  const { taskId, customerId } = req.params;
  const { lat, lng } = req.body || {};
  try {
    const result = await db.query(
      `UPDATE task_customers SET collected = true, collected_at = NOW(), collected_lat = $3, collected_lng = $4 WHERE task_id = $1 AND customer_id = $2 RETURNING *`,
      [taskId, customerId, lat || null, lng || null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task/customer link not found' });
    }

    io.emit('customer_status_updated', { customerId: parseInt(customerId), serviced: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Work log: which customers were serviced by which collector, on which date.
// Filters are all optional so it can power both the cashier follow-up report
// and the "already serviced this cycle" check used when splitting a zone across days.
app.get('/api/reports/service-log', checkRole(['admin']), async (req, res) => {
  const { collector, zone, from, to } = req.query;
  try {
    const conditions = ['tc.collected = true'];
    const params = [];

    if (collector) {
      params.push(`%${collector}%`);
      conditions.push(`(t.collector_name ILIKE $${params.length} OR t.driver_name ILIKE $${params.length})`);
    }
    if (zone) {
      params.push(zone);
      conditions.push(`t.route_name = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`tc.collected_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`tc.collected_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const result = await db.query(
      `SELECT c.id AS customer_id, c.name, c.phone, c.house_no, c.area, c.zone,
              c.status AS payment_status, tc.collected_at,
              t.id AS task_id, t.collector_name, t.driver_name, t.route_name
       FROM task_customers tc
       JOIN tasks t ON t.id = tc.task_id
       JOIN customers c ON c.id = tc.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY tc.collected_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id/status', checkRole(['admin', 'collector']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const oldRow = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const completedAt = status === 'Completed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    const result = await db.query(
      `UPDATE tasks SET status = $1, completed_at = ${completedAt} WHERE id = $2 RETURNING *`,
      [status, id]
    );
    await logAudit(req, 'UPDATE', 'tasks', id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);

    if (status === 'In Progress') {
      await db.query(
        'INSERT INTO notifications (user_id, title, message) VALUES (1, $1, $2)',
        ['Task Started', `Task for ${result.rows[0].route_name} has started.`]
      );
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id/history', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT lat, lng, created_at FROM truck_location_history WHERE task_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/ping', checkRole(['admin', 'collector']), async (req, res) => {
  const { lat, lng } = req.body;
  try {
    // A collector can only report GPS for a task actually assigned to them
    if (req.user.role.toLowerCase() === 'collector') {
      const taskRes = await db.query('SELECT collector_name FROM tasks WHERE id = $1', [req.params.id]);
      if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      const userRes = await db.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const myName = (userRes.rows[0]?.full_name || '').toLowerCase();
      if ((taskRes.rows[0].collector_name || '').toLowerCase() !== myName) {
        return res.status(403).json({ error: 'You are not the collector assigned to this task' });
      }
    }

    const result = await db.query(
      'INSERT INTO truck_location_history (task_id, lat, lng) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, lat, lng]
    );

    // Emit real-time truck location update
    io.emit('truck_location_updated', {
      taskId: parseInt(req.params.id),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      timestamp: new Date().toISOString()
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const oldRow = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    // Delete task customers first due to FK
    await db.query('DELETE FROM task_customers WHERE task_id = $1', [id]);
    await db.query('DELETE FROM truck_location_history WHERE task_id = $1', [id]);
    const result = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'DELETE', 'tasks', id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Trucks ---
app.get('/api/trucks', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, 
             e1.name as driver_name, e1.phone as driver_phone,
             e2.name as collector_name, e2.phone as collector_phone
      FROM trucks t
      LEFT JOIN employees e1 ON t.driver_id = e1.id
      LEFT JOIN employees e2 ON t.collector_id = e2.id
      ORDER BY t.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trucks', checkRole(['admin']), async (req, res) => {
  const { plate_number, model, driver_id, collector_id } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO trucks (plate_number, model, driver_id, collector_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [plate_number, model, driver_id || null, collector_id || null]
    );
    await logAudit(req, 'CREATE', 'trucks', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trucks/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { plate_number, model, status, driver_id, collector_id } = req.body;
    const oldRow = await db.query('SELECT * FROM trucks WHERE id = $1', [req.params.id]);
    const result = await db.query(
      'UPDATE trucks SET plate_number = $1, model = $2, status = $3, driver_id = $4, collector_id = $5 WHERE id = $6 RETURNING *',
      [plate_number, model, status || 'Active', driver_id || null, collector_id || null, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'trucks', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/trucks/:id', checkRole(['admin']), async (req, res) => {
  try {
    const oldRow = await db.query('SELECT * FROM trucks WHERE id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM trucks WHERE id = $1 RETURNING *', [req.params.id]);
    await logAudit(req, 'DELETE', 'trucks', req.params.id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Zones ---
app.get('/api/zones', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT z.*, 
             t.plate_number as truck_plate, t.model as truck_model,
             e1.name as driver_name, e1.phone as driver_phone,
             e2.name as collector_name, e2.phone as collector_phone
      FROM zones z
      LEFT JOIN trucks t ON z.truck_id = t.id
      LEFT JOIN employees e1 ON t.driver_id = e1.id
      LEFT JOIN employees e2 ON t.collector_id = e2.id
      ORDER BY z.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zones', checkRole(['admin']), async (req, res) => {
  const { name, truck_id, collection_days, collection_time, coordinates, area, neighborhood, zone_code, sub_zone } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO zones (name, truck_id, collection_days, collection_time, coordinates, area, neighborhood, zone_code, sub_zone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, truck_id || null, collection_days ? JSON.stringify(collection_days) : null, collection_time, coordinates ? JSON.stringify(coordinates) : null, area || null, neighborhood || null, zone_code || null, sub_zone || null]
    );
    await logAudit(req, 'CREATE', 'zones', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/zones/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { name, truck_id, collection_days, collection_time, coordinates, area, neighborhood, zone_code, sub_zone } = req.body;
    const oldRow = await db.query('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    const result = await db.query(
      'UPDATE zones SET name = $1, truck_id = $2, collection_days = $3, collection_time = $4, coordinates = COALESCE($5, coordinates), area = $6, neighborhood = $7, zone_code = $8, sub_zone = $9 WHERE id = $10 RETURNING *',
      [name, truck_id || null, collection_days ? JSON.stringify(collection_days) : null, collection_time, coordinates ? JSON.stringify(coordinates) : null, area || null, neighborhood || null, zone_code, sub_zone, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'zones', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.put('/api/zones/:id/coordinates', checkRole(['admin']), async (req, res) => {
  try {
    const { coordinates } = req.body;
    const result = await db.query(
      'UPDATE zones SET coordinates = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(coordinates), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/zones/:id', checkRole(['admin']), async (req, res) => {
  try {
    const oldRow = await db.query('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM zones WHERE id = $1 RETURNING *', [req.params.id]);
    await logAudit(req, 'DELETE', 'zones', req.params.id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Employees (HRM) ---
app.get('/api/employees', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM employees ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', checkRole(['admin']), async (req, res) => {
  const { name, role, phone, salary, status } = req.body;
  try {
    const oldRow = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    const result = await db.query(
      'UPDATE employees SET name = $1, role = $2, phone = $3, salary = $4, status = $5 WHERE id = $6 RETURNING *',
      [name, role, phone, salary, status || 'Active', req.params.id]
    );
    await logAudit(req, 'UPDATE', 'employees', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', checkRole(['admin']), async (req, res) => {
  try {
    const oldRow = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM employees WHERE id = $1 RETURNING *', [req.params.id]);
    await logAudit(req, 'DELETE', 'employees', req.params.id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', checkRole(['admin']), upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'id_document', maxCount: 1 }
]), async (req, res) => {
  const { name, role, phone, salary, guarantor_name, guarantor_phone } = req.body;
  const photo = req.files?.photo?.[0]?.filename || null;
  const id_document = req.files?.id_document?.[0]?.filename || null;
  try {
    const result = await db.query(
      'INSERT INTO employees (name, role, phone, salary, photo, id_document, guarantor_name, guarantor_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, role, phone, salary, photo, id_document, guarantor_name || null, guarantor_phone || null]
    );
    await logAudit(req, 'CREATE', 'employees', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Leave Management ---
app.get('/api/leave-requests', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT lr.*, e.name as employee_name, e.role as employee_role
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      ORDER BY lr.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests', checkRole(['admin', 'cashier']), async (req, res) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employee_id, leave_type, start_date, end_date, reason]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leave-requests/:id/status', checkRole(['admin']), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE leave_requests SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Attendance ---
app.get('/api/attendance', checkRole(['admin', 'collector']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, e.name as employee_name, e.role as employee_role, e.photo as employee_photo
      FROM attendance a
      INNER JOIN employees e ON a.employee_id = e.id
      ORDER BY a.date DESC, a.clock_in DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/today', checkRole(['admin', 'collector']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, e.name as employee_name, e.role as employee_role, e.photo as employee_photo
      FROM attendance a
      INNER JOIN employees e ON a.employee_id = e.id
      WHERE a.date = CURRENT_DATE
      ORDER BY a.clock_in DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/clock-in', checkRole(['admin', 'collector']), upload.single('clock_in_photo'), async (req, res) => {
  const { employee_id } = req.body;
  const clock_in_photo = req.file ? req.file.filename : null;
  try {
    // Check if already clocked in today
    const existing = await db.query(
      'SELECT id FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE AND clock_out IS NULL',
      [employee_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Employee already clocked in today' });
    }
    const result = await db.query(
      'INSERT INTO attendance (employee_id, clock_in_photo) VALUES ($1, $2) RETURNING *',
      [employee_id, clock_in_photo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/clock-out', checkRole(['admin', 'collector']), upload.single('clock_out_photo'), async (req, res) => {
  const { employee_id } = req.body;
  const clock_out_photo = req.file ? req.file.filename : null;
  try {
    const result = await db.query(
      'UPDATE attendance SET clock_out = CURRENT_TIMESTAMP, clock_out_photo = $2 WHERE employee_id = $1 AND date = CURRENT_DATE AND clock_out IS NULL RETURNING *',
      [employee_id, clock_out_photo]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found for today' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Payroll ---
app.get('/api/payroll', checkRole(['admin', 'cashier']), async (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    let query = `
      SELECT p.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
    `;
    let params = [];
    if (month) {
      query += ' WHERE p.month = $1';
      params.push(month);
    }
    query += ' ORDER BY e.name ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payroll/generate', checkRole(['admin', 'cashier']), async (req, res) => {
  const { month } = req.body; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'Month is required' });

  try {
    // 1. Get all employees
    const employees = await db.query("SELECT id, name, salary FROM employees WHERE status = 'Active'");

    const results = [];
    for (const emp of employees.rows) {
      // 2. Count attendance for this month
      const attendance = await db.query(
        "SELECT COUNT(*) FROM attendance WHERE employee_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2",
        [emp.id, month]
      );
      const daysPresent = parseInt(attendance.rows[0].count);

      // 3. Insert or update payroll
      // Net salary is now simply the base salary
      const baseSalary = emp.salary || 0;
      const netSalary = baseSalary;

      const payrollResult = await db.query(`
        INSERT INTO payroll (employee_id, month, base_salary, total_days_present, net_salary)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id, month) 
        DO UPDATE SET 
          base_salary = EXCLUDED.base_salary,
          total_days_present = EXCLUDED.total_days_present,
          net_salary = EXCLUDED.net_salary
        RETURNING *
      `, [emp.id, month, baseSalary, daysPresent, netSalary]);

      results.push(payrollResult.rows[0]);
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payroll/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  const { id } = req.params;
  const { bonuses, deductions, status, notes, payment_method } = req.body;
  try {
    // Get existing payroll to recalculate net_salary
    const existing = await db.query('SELECT base_salary, total_days_present FROM payroll WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Payroll record not found' });

    const base = parseFloat(existing.rows[0].base_salary);
    const b = parseFloat(bonuses || 0);
    const d = parseFloat(deductions || 0);

    const calculatedNet = base + b - d;

    const paymentDate = status === 'Paid' ? 'CURRENT_TIMESTAMP' : 'NULL';

    const result = await db.query(`
      UPDATE payroll SET 
        bonuses = $1, 
        deductions = $2, 
        net_salary = $3, 
        status = $4, 
        notes = $5,
        payment_method = $6,
        payment_date = ${paymentDate}
      WHERE id = $7 RETURNING *
    `, [b, d, calculatedNet, status, notes, payment_method || null, id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stats for Dashboard & Reports ---
app.get('/api/stats', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const isGudoomiye = req.user.role.toLowerCase() === 'gudoomiye';
    const zone = req.user.zone;

    const revenueRes = isGudoomiye
      ? await db.query("SELECT SUM(i.amount) FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.status = 'Paid' AND c.zone = $1", [zone])
      : await db.query("SELECT SUM(amount) FROM invoices WHERE status = 'Paid'");
    const customersRes = isGudoomiye
      ? await db.query("SELECT COUNT(*) FROM customers WHERE zone = $1", [zone])
      : await db.query("SELECT COUNT(*) FROM customers");
    const tasksRes = await db.query("SELECT COUNT(*) FROM tasks WHERE status = 'Completed'");
    const expensesRes = await db.query("SELECT SUM(amount) FROM expenses");

    res.json({
      revenue: parseFloat(revenueRes.rows[0].sum || 0),
      customerCount: parseInt(customersRes.rows[0].count || 0),
      tasksCompleted: parseInt(tasksRes.rows[0].count || 0),
      totalExpenses: parseFloat(expensesRes.rows[0].sum || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/history', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const history = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];

      const revRes = await db.query(
        "SELECT SUM(amount) FROM invoices WHERE status = 'Paid' AND DATE(created_at) = $1",
        [dateString]
      );
      const expRes = await db.query(
        "SELECT SUM(amount) FROM expenses WHERE DATE(expense_date) = $1",
        [dateString]
      );

      history.push({
        name: dayName,
        revenue: parseFloat(revRes.rows[0].sum || 0),
        expenses: parseFloat(expRes.rows[0].sum || 0)
      });
    }

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/dashboard/extended', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Daily Cashflow
    const revTodayRes = await db.query("SELECT SUM(amount) FROM invoices WHERE status = 'Paid' AND DATE(created_at) = CURRENT_DATE");
    const expTodayRes = await db.query("SELECT SUM(amount) FROM expenses WHERE DATE(expense_date) = CURRENT_DATE");

    // Outstanding Debts
    const totalDebtRes = await db.query("SELECT SUM(amount) FROM debts WHERE status = 'Unpaid'");
    const topDebtorsRes = await db.query("SELECT debtor_name, amount, phone FROM debts WHERE status = 'Unpaid' ORDER BY amount DESC LIMIT 5");

    // Pending Complaints
    const pendingComplaintsRes = await db.query("SELECT COUNT(*) FROM complaints WHERE status != 'Resolved'");

    // Employee Attendance (Mocked clocked in for now since table doesn't exist)
    const totalEmployeesRes = await db.query("SELECT COUNT(*) FROM employees WHERE status = 'Active'");
    const clockedInTodayRes = { rows: [{ count: totalEmployeesRes.rows[0].count }] }; // Assuming all active are present for now

    // Recent Activities (Union of recent invoices, customers, tasks, complaints)
    const recentActivitiesQuery = `
      (SELECT 'invoice' as type, 'Payment of $' || amount as description, created_at FROM invoices ORDER BY created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'customer' as type, 'New customer: ' || name as description, created_at FROM customers ORDER BY created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'complaint' as type, 'Complaint: ' || title as description, created_at FROM complaints ORDER BY created_at DESC LIMIT 5)
      ORDER BY created_at DESC LIMIT 5
    `;
    const recentActivitiesRes = await db.query(recentActivitiesQuery);

    res.json({
      dailyCashflow: {
        revenue: parseFloat(revTodayRes.rows[0].sum || 0),
        expenses: parseFloat(expTodayRes.rows[0].sum || 0)
      },
      outstandingDebts: {
        total: parseFloat(totalDebtRes.rows[0].sum || 0),
        topDebtors: topDebtorsRes.rows
      },
      pendingComplaints: parseInt(pendingComplaintsRes.rows[0].count || 0),
      employeeAttendance: {
        total: parseInt(totalEmployeesRes.rows[0].count || 0),
        clockedIn: parseInt(clockedInTodayRes.rows[0].count || 0)
      },
      recentActivities: recentActivitiesRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/collectors', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT COALESCE(collector_name, 'Unassigned / Direct') as collector, SUM(amount) as total_collected, COUNT(id) as transaction_count
      FROM invoices 
      WHERE status = 'Paid' 
      GROUP BY collector_name 
      ORDER BY total_collected DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/collectors/today', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const moneyRes = await db.query(`
      SELECT COALESCE(collector_name, 'Unassigned') as collector, 
             SUM(amount) as total_collected, 
             COUNT(id) as transactions
      FROM invoices
      WHERE status = 'Paid' AND DATE(created_at) = CURRENT_DATE
      GROUP BY collector_name
    `);

    const tasksRes = await db.query(`
      SELECT COALESCE(t.collector_name, 'Unassigned') as collector,
             COUNT(tc.customer_id) as houses_collected
      FROM tasks t
      JOIN task_customers tc ON t.id = tc.task_id
      WHERE tc.collected = TRUE AND DATE(t.scheduled_at) = CURRENT_DATE
      GROUP BY t.collector_name
    `);

    const collectorsMap = {};
    moneyRes.rows.forEach(r => {
       collectorsMap[r.collector] = {
          collector: r.collector,
          total_collected: parseFloat(r.total_collected || 0),
          transactions: parseInt(r.transactions || 0),
          houses_collected: 0
       };
    });
    
    tasksRes.rows.forEach(r => {
       if (!collectorsMap[r.collector]) {
          collectorsMap[r.collector] = {
             collector: r.collector,
             total_collected: 0,
             transactions: 0,
             houses_collected: parseInt(r.houses_collected || 0)
          };
       } else {
          collectorsMap[r.collector].houses_collected = parseInt(r.houses_collected || 0);
       }
    });

    res.json(Object.values(collectorsMap).sort((a, b) => b.total_collected - a.total_collected));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detail lists for one collector on one day: who was serviced vs who actually paid
app.get('/api/reports/collector-daily', checkRole(['admin']), async (req, res) => {
  const { collector_name, date } = req.query;
  if (!collector_name || !date) {
    return res.status(400).json({ error: 'collector_name and date are required' });
  }
  try {
    const servicedRes = await db.query(`
      SELECT c.id, c.name, c.phone, c.house_no, c.street, c.area, tc.collected_at
      FROM task_customers tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN customers c ON tc.customer_id = c.id
      WHERE t.collector_name = $1
        AND tc.collected = TRUE
        AND DATE(COALESCE(tc.collected_at, t.scheduled_at)) = $2
      ORDER BY tc.collected_at ASC NULLS LAST
    `, [collector_name, date]);

    const collectedRes = await db.query(`
      SELECT i.id, i.customer_id, c.name, c.phone, i.amount, i.currency, i.payment_method, i.created_at
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.collector_name = $1
        AND i.status = 'Paid'
        AND DATE(i.created_at) = $2
      ORDER BY i.created_at ASC
    `, [collector_name, date]);

    res.json({ serviced: servicedRes.rows, collected: collectedRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Archive & Documents ---
app.get('/api/archives', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM archives ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/archives', checkRole(['admin']), upload.single('file'), async (req, res) => {
  const { title, category, uploaded_by, doc_ref, description } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const result = await db.query(
      'INSERT INTO archives (title, category, file_name, file_type, file_size, uploaded_by, doc_ref, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, category || 'Others', req.file.filename, req.file.mimetype, req.file.size, uploaded_by || 'Admin', doc_ref || null, description || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/archives/:id', checkRole(['admin']), async (req, res) => {
  try {
    // Optional: Delete physical file too
    const find = await db.query('SELECT file_name FROM archives WHERE id = $1', [req.params.id]);
    if (find.rows.length > 0) {
      const filePath = path.join(__dirname, 'uploads', find.rows[0].file_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const result = await db.query('DELETE FROM archives WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Inventory ---
app.get('/api/inventory', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM inventory ORDER BY item_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', checkRole(['admin']), async (req, res) => {
  const { item_name, quantity, unit, price_per_unit, status } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO inventory (item_name, quantity, unit, price_per_unit, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [item_name, quantity || 0, unit || 'Pcs', price_per_unit || 0, status || 'In Stock']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id', checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { item_name, quantity, unit, price_per_unit, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE inventory SET item_name = $1, quantity = $2, unit = $3, price_per_unit = $4, status = $5 
       WHERE id = $6 RETURNING *`,
      [item_name, quantity, unit, price_per_unit, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inventory/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Debts (Daymaha) ---
app.get('/api/debts', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.id::text as id, d.customer_id, 
             COALESCE(d.debtor_name, c.name) as debtor_name,
             COALESCE(d.phone, c.phone) as phone,
             COALESCE(d.zone, c.zone) as zone,
             COALESCE(d.house_no, c.house_no) as house_no,
             c.street,
             c.neighborhood,
             c.name as customer_name,
             d.amount, d.currency, d.description, d.status, d.created_at,
             'manual' as type
      FROM debts d 
      LEFT JOIN customers c ON d.customer_id = c.id 
      UNION ALL
      SELECT ('INV-' || i.id) as id, i.customer_id,
             c.name as debtor_name,
             c.phone as phone,
             c.area as zone,
             c.house_no as house_no,
             c.street,
             '' as neighborhood,
             c.name as customer_name,
             i.amount, i.currency, 'Unpaid Service Invoice' as description, i.status, i.created_at,
             'invoice' as type
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'Unpaid'
      ORDER BY created_at DESC
    `);
    const rows = req.user.role.toLowerCase() === 'gudoomiye'
      ? result.rows.filter(r => r.zone === req.user.zone)
      : result.rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debts', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  const { customer_id, debtor_name, phone, amount, currency, description, collector_name, zone, house_no } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO debts (customer_id, debtor_name, phone, amount, currency, description, status, collector_name, zone, house_no) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [customer_id || null, debtor_name, phone, amount, currency || 'USD', description, 'Unpaid', collector_name || null, zone || null, house_no || null]
    );

    const debt = result.rows[0];

    // Also fetch the customer name right away if it exists
    if (customer_id) {
      const custResult = await db.query('SELECT name FROM customers WHERE id = $1', [customer_id]);
      debt.customer_name = custResult.rows[0]?.name;
    }

    res.json(debt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debts/:id', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM debts WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/debts/:id/status', checkRole(['admin', 'cashier']), async (req, res) => {
  const { id } = req.params;
  const { status, payment_method } = req.body;
  try {
    if (id.toString().startsWith('INV-')) {
      const invId = id.toString().replace('INV-', '');
      const result = await db.query(
        `UPDATE invoices SET status = $1, payment_method = COALESCE($2, payment_method) WHERE id = $3 RETURNING *`,
        [status, payment_method || null, invId]
      );
      res.json({ ...result.rows[0], id: `INV-${result.rows[0].id}` });
    } else {
      const result = await db.query(
        `UPDATE debts SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id]
      );
      res.json(result.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cashouts (Taariikhda Xisaab-celinta) ---
// Step 8 of the workflow: the Gudoomiye finalizes/settles the cashout for their own zone.
// Admin can do it for any zone; Cashier can still record it during the transition period.
app.get('/api/cashouts', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  try {
    const isGudoomiye = req.user.role.toLowerCase() === 'gudoomiye';
    const result = await db.query(
      isGudoomiye ? 'SELECT * FROM cashouts WHERE zone = $1 ORDER BY created_at DESC' : 'SELECT * FROM cashouts ORDER BY created_at DESC',
      isGudoomiye ? [req.user.zone] : []
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cashouts', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  const { collector_name, expected_amount, actual_amount, zaad_amount, edahab_amount, cash_amount, slsh_amount, shortage, reason, processed_by, zone } = req.body;

  let resolvedZone = zone || null;
  if (req.user.role.toLowerCase() === 'gudoomiye') {
    // A Gudoomiye can only settle cashouts for collectors dispatched in their own zone.
    resolvedZone = req.user.zone;
    const assignmentCheck = await db.query(
      `SELECT ca.id FROM collector_assignments ca JOIN employees e ON ca.collector_id = e.id
       WHERE e.name = $1 AND ca.zone_group = $2`,
      [collector_name, req.user.zone]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This collector is not dispatched in your zone' });
    }
  }

  try {
    const result = await db.query(
      'INSERT INTO cashouts (collector_name, expected_amount, actual_amount, zaad_amount, edahab_amount, cash_amount, slsh_amount, shortage, reason, processed_by, zone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [
        collector_name,
        expected_amount,
        actual_amount,
        zaad_amount || 0,
        edahab_amount || 0,
        cash_amount || 0,
        slsh_amount || 0,
        shortage || 0,
        reason || null,
        processed_by || null,
        resolvedZone
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const updateSettingsHandler = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      const stringValue = value !== null && value !== undefined ? value.toString() : '';
      await db.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
        [key, stringValue]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/settings', checkRole(['admin', 'cashier']), updateSettingsHandler);
app.put('/api/settings', checkRole(['admin', 'cashier']), updateSettingsHandler);

// --- Tracking & Location Endpoints ---
app.post('/api/tasks/:id/ping', checkRole(['admin', 'collector']), async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  try {
    await db.query(
      'INSERT INTO truck_location_history (task_id, lat, lng) VALUES ($1, $2, $3)',
      [id, lat, lng]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id/history', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT lat, lng, created_at FROM truck_location_history WHERE task_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id/location', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  try {
    await db.query(
      'UPDATE customers SET lat = $1, lng = $2 WHERE id = $3',
      [lat, lng, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2FA Endpoints ---
app.post('/api/auth/2fa/setup', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  if (parseInt(userId, 10) !== req.user.id && req.user.role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Access denied: you can only set up your own 2FA' });
  }
  try {
    const secret = speakeasy.generateSecret({ name: `GURMAD` });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Save secret temporarily (pending verification)
    await db.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret.base32, userId]);

    res.json({ secret: secret.base32, qrCode: qrCodeDataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/2fa/verify', authenticateToken, async (req, res) => {
  let { userId, token } = req.body;
  if (parseInt(userId, 10) !== req.user.id && req.user.role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Access denied: you can only verify your own 2FA' });
  }
  token = token.toString().replace(/\s/g, '');
  try {
    const result = await db.query('SELECT two_factor_secret FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      console.log("User not found for 2FA verify");
      return res.status(404).json({ error: 'User not found' });
    }
    const secret = result.rows[0].two_factor_secret;
    console.log(`Stored Secret: ${secret}`);

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 6 // Temporary wider window for debugging
    });
    console.log(`Verification Result: ${verified}`);

    if (verified) {
      await db.query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [userId]);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid verification code' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/2fa/disable', authenticateToken, async (req, res) => {
  const { userId } = req.body;
  if (parseInt(userId, 10) !== req.user.id && req.user.role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Access denied: you can only disable your own 2FA' });
  }
  try {
    await db.query('UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fleet Maintenance & Fuel ---
app.get('/api/fleet/fuel', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.*, t.plate_number, u.full_name as recorded_by_name 
      FROM truck_fuel_logs f
      JOIN trucks t ON f.truck_id = t.id
      LEFT JOIN users u ON f.recorded_by = u.id
      ORDER BY f.date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fleet/fuel', checkRole(['admin']), async (req, res) => {
  const { truck_id, liters, cost, odometer_reading, recorded_by } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO truck_fuel_logs (truck_id, liters, cost, odometer_reading, recorded_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [truck_id, liters, cost, odometer_reading, recorded_by]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fleet/maintenance', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, t.plate_number, u.full_name as recorded_by_name 
      FROM truck_maintenance_logs m
      JOIN trucks t ON m.truck_id = t.id
      LEFT JOIN users u ON m.recorded_by = u.id
      ORDER BY m.date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fleet/maintenance', checkRole(['admin']), async (req, res) => {
  const { truck_id, description, cost, next_service_date, recorded_by } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO truck_maintenance_logs (truck_id, description, cost, next_service_date, recorded_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [truck_id, description, cost, next_service_date, recorded_by]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Inventory Management ---
app.get('/api/inventory', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM inventory ORDER BY item_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', checkRole(['admin']), async (req, res) => {
  const { item_name, quantity, unit, price_per_unit, status } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO inventory (item_name, quantity, unit, price_per_unit, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [item_name, quantity, unit, price_per_unit, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id', checkRole(['admin']), async (req, res) => {
  const { item_name, quantity, unit, price_per_unit, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE inventory SET item_name = $1, quantity = $2, unit = $3, price_per_unit = $4, status = $5 WHERE id = $6 RETURNING *',
      [item_name, quantity, unit, price_per_unit, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inventory/:id', checkRole(['admin']), async (req, res) => {
  try {
    await db.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Complaints Management ---
app.get('/api/complaints', checkRole(['admin', 'cashier', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, cust.name as customer_name, cust.phone as customer_phone, u.full_name as assigned_to_name
      FROM complaints c
      LEFT JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/complaints', checkRole(['admin', 'cashier']), async (req, res) => {
  const { customer_id, title, description, priority, assigned_to } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO complaints (customer_id, title, description, priority, assigned_to) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [customer_id, title, description, priority || 'Medium', assigned_to || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/complaints/:id/status', checkRole(['admin', 'cashier']), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE complaints SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Notifications ---
app.get('/api/users/:userId/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:userId/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.params.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Audit Logs ---
app.get('/api/admin/audit-logs', checkRole(['admin']), async (req, res) => {
  try {
    const { action, startDate, endDate, search } = req.query;

    let queryStr = `
      SELECT a.*, u.username, u.full_name 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    let queryParams = [];
    let paramCount = 1;

    if (action && action !== 'ALL') {
      queryStr += ` AND a.action = $${paramCount}`;
      queryParams.push(action);
      paramCount++;
    }

    if (startDate) {
      queryStr += ` AND a.created_at >= $${paramCount}`;
      queryParams.push(`${startDate} 00:00:00`);
      paramCount++;
    }

    if (endDate) {
      queryStr += ` AND a.created_at <= $${paramCount}`;
      queryParams.push(`${endDate} 23:59:59`);
      paramCount++;
    }

    if (search) {
      queryStr += ` AND (u.full_name ILIKE $${paramCount} OR a.entity_type ILIKE $${paramCount} OR a.action ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    queryStr += ` ORDER BY a.created_at DESC LIMIT 500`;

    const result = await db.query(queryStr, queryParams);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Backup System ---
app.get('/api/admin/backup', checkRole(['admin']), async (req, res) => {
  try {
    const tables = ['users', 'employees', 'trucks', 'zones', 'customers', 'invoices', 'expenses', 'tasks', 'inventory', 'debts', 'payroll', 'attendance', 'audit_logs', 'truck_fuel_logs', 'truck_maintenance_logs'];
    const backupData = {};

    for (const table of tables) {
      const result = await db.query(`SELECT * FROM ${table}`);
      backupData[table] = result.rows;
    }

    // Stream the backup directly in the (already admin-authenticated) response instead of
    // writing it to the public uploads/ folder, so it's never reachable without a login.
    const backupFileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${backupFileName}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

// --- User Management (Admin Only) ---
app.get('/api/users', checkRole(['admin', 'cashier', 'collector', 'gudoomiye']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, full_name, role, two_factor_enabled, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', checkRole(['admin']), async (req, res) => {
  const { username, password, full_name, role } = req.body;
  try {
    // Basic validation
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const result = await db.query(
      'INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role, created_at',
      [username, password, full_name || '', role || 'collector']
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.message.includes('unique constraint')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/reset-2fa', checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/full-reset', checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  try {
    await db.query(
      'UPDATE users SET password = $1, two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $2',
      [newPassword, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// COMMUNICATIONS & MESSAGING API
// ----------------------------------------------------

app.post('/api/messages/send', checkRole(['admin']), async (req, res) => {
  const { phone, message, type = 'sms' } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }

  const formattedPhone = phone.startsWith('+') ? phone : '+252' + phone;

  try {
    let result;
    if (type === 'whatsapp') {
      result = await messaging.sendWhatsApp(formattedPhone, message);
    } else {
      result = await messaging.sendSMS(formattedPhone, message);
    }

    // Log this message to the DB for history
    // For now we just return success
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/broadcast', checkRole(['admin']), async (req, res) => {
  const { targetType, targetValue, message, type = 'sms' } = req.body;
  // targetType can be 'zone', 'all', 'unpaid', 'task_id'

  try {
    let customersToMessage = [];

    if (targetType === 'all') {
      const result = await db.query('SELECT name, phone FROM customers WHERE phone IS NOT NULL');
      customersToMessage = result.rows;
    } else if (targetType === 'task_id') {
      const result = await db.query(`
        SELECT c.name, c.phone 
        FROM task_customers tc
        JOIN customers c ON tc.customer_id = c.id
        WHERE tc.task_id = $1 AND c.phone IS NOT NULL
      `, [targetValue]);
      customersToMessage = result.rows;
    } else if (targetType === 'unpaid') {
      const result = await db.query('SELECT name, phone FROM customers WHERE payment_status = \'Unpaid\' AND phone IS NOT NULL');
      customersToMessage = result.rows;
    }

    if (customersToMessage.length === 0) {
      return res.status(404).json({ error: 'No customers found for the specified target' });
    }

    // Process in background
    (async () => {
      for (const cust of customersToMessage) {
        const formattedPhone = cust.phone.startsWith('+') ? cust.phone : '+252' + cust.phone;
        const personalizedMsg = message.replace('{name}', cust.name);
        try {
          if (type === 'whatsapp') await messaging.sendWhatsApp(formattedPhone, personalizedMsg);
          else await messaging.sendSMS(formattedPhone, personalizedMsg);
          // Add a small delay to prevent rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.error(`Failed to broadcast to ${cust.phone}:`, e.message);
        }
      }
    })();

    res.json({ success: true, count: customersToMessage.length, message: 'Broadcast started in background' });
  } catch (err) {
    console.error('Broadcast Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AI ROUTE OPTIMIZATION API
// ----------------------------------------------------

app.get('/api/optimize-route', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { task_id } = req.query;
  if (!task_id) return res.status(400).json({ error: 'task_id is required' });

  try {
    // 1. Get the current truck location or center of the zone
    // For simplicity, we just use the customers' locations for the TSP calculation
    const customersQuery = await db.query(`
      SELECT c.id, c.name, c.lat, c.lng
      FROM task_customers tc
      JOIN customers c ON tc.customer_id = c.id
      WHERE tc.task_id = $1 AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      LIMIT 25 -- OSRM public API limit is often 100 or less, we keep it safe
    `, [task_id]);

    const customers = customersQuery.rows.filter(c => parseFloat(c.lat) !== 0 && !isNaN(parseFloat(c.lat)));

    if (customers.length < 2) {
      return res.status(400).json({ error: 'Not enough valid coordinates to optimize route' });
    }

    // Mapbox/OSRM expects: lng,lat;lng,lat
    const coordinatesString = customers.map(c => `${c.lng},${c.lat}`).join(';');

    const osrmUrl = `http://router.project-osrm.org/trip/v1/driving/${coordinatesString}?roundtrip=true&source=first&geometries=geojson`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error('OSRM API failed: ' + osrmData.code);
    }

    // Reorder customers based on OSRM waypoints
    const tripOrder = customers.map((c, i) => {
      return {
        ...c,
        order: osrmData.waypoints[i].waypoint_index
      };
    }).sort((a, b) => a.order - b.order);

    res.json({
      success: true,
      geometry: osrmData.trips[0].geometry,
      distance: osrmData.trips[0].distance,
      duration: osrmData.trips[0].duration,
      optimized_order: tripOrder
    });

  } catch (err) {
    console.error('Route Optimization Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DATABASE INITIALIZATION
// ----------------------------------------------------
app.post('/api/zaad/pay', checkRole(['admin', 'cashier']), async (req, res) => {
  const { phone, amount, invoiceId } = req.body;
  const currency = amount > 1000 ? 'SLSH' : 'USD';
  const waafiEndpoint = 'https://api.waafi.com/asm';

  const zaadPayload = {
    schemaVersion: "1.0",
    requestId: Date.now().toString(),
    timestamp: new Date().toISOString(),
    channelName: "WEB",
    serviceName: "API_PURCHASE",
    serviceParams: {
      merchantUid: process.env.ZAAD_MERCHANT_UID,
      apiUserId: process.env.ZAAD_API_USER_ID,
      apiKey: process.env.ZAAD_API_KEY,
      paymentMethod: "mwallet_account",
      payerInfo: { accountNo: phone },
      transactionInfo: {
        referenceId: invoiceId || Date.now().toString(),
        invoiceId: invoiceId || Date.now().toString(),
        amount: amount,
        currency: currency,
        description: "Gurmad Waste Management"
      }
    }
  };

  try {
    // Attempt the real WAAFI API call using built-in fetch
    console.log("Sending payment request to ZAAD Waafi API for:", phone);
    const response = await fetch(waafiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zaadPayload)
    });

    const data = await response.json();
    console.log("ZAAD Response:", data);

    // WAAFI usually returns responseCode '2001' on success or '2000'
    const successCodes = ['2001', '2000', '0'];
    const isSuccess = data.responseCode && successCodes.includes(data.responseCode);
    const isApproved = data.responseMsg === 'RCS_SUCCESS' || isSuccess;

    if (!isApproved) {
      console.error('ZAAD payment not approved by WAAFI:', data);
      return res.status(402).json({ error: 'Payment was not approved by WAAFI', waafi_raw: data });
    }
    const paymentStatus = 'Paid';

    // Insert Invoice into Database
    const customer = await db.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    let customerId;

    if (customer.rows.length === 0) {
      // Auto-create customer if unknown
      const newCust = await db.query(
        'INSERT INTO customers (name, phone, area) VALUES ($1, $2, $3) RETURNING id',
        ['Waafi Customer', phone, '-']
      );
      customerId = newCust.rows[0].id;
    } else {
      customerId = customer.rows[0].id;
    }

    const insertResult = await db.query(
      'INSERT INTO invoices (customer_id, amount, currency, status, payment_method, collector_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [customerId, amount, currency, paymentStatus, 'ZAAD (Waafi)', req.body.collector_name || null]
    );

    res.json({ success: true, waafi_raw: data, invoice: insertResult.rows[0] });

  } catch (err) {
    console.error("Waafi Fetch Error:", err);
    res.status(502).json({ error: 'Could not reach WAAFI to confirm payment; no invoice was created.' });
  }
});

// --- Unified Global Search ---
app.get('/api/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  const query = `%${q}%`;
  try {
    const [customers, employees, invoices, tasks] = await Promise.all([
      db.query("SELECT id, name, phone, 'customer' as type FROM customers WHERE name ILIKE $1 OR phone ILIKE $1 OR house_no ILIKE $1 LIMIT 5", [query]),
      db.query("SELECT id, name, role as subtitle, 'employee' as type FROM employees WHERE name ILIKE $1 OR role ILIKE $1 OR phone ILIKE $1 LIMIT 5", [query]),
      db.query("SELECT i.id, c.name, i.amount, 'invoice' as type FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name ILIKE $1 OR i.id::text ILIKE $1 LIMIT 5", [query]),
      db.query("SELECT id, route_name as name, driver_name as subtitle, 'task' as type FROM tasks WHERE route_name ILIKE $1 OR driver_name ILIKE $1 LIMIT 5", [query])
    ]);

    const archives = await db.query('SELECT id, title as name, category as subtitle, doc_ref FROM archives WHERE title ILIKE $1 OR category ILIKE $1 OR doc_ref ILIKE $1', [`%${q}%`]);

    const results = [
      ...customers.rows.map(r => ({ ...r, tab: 'customers' })),
      ...employees.rows.map(r => ({ ...r, tab: 'hrm' })),
      ...invoices.rows.map(r => ({ ...r, name: `Invoice #${r.id} (${r.name})`, subtitle: `$${r.amount}`, tab: 'billing' })),
      ...tasks.rows.map(r => ({ ...r, tab: 'tasks' })),
      ...archives.rows.map(r => ({ ...r, tab: 'archive' }))
    ];

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Notifications ---
app.get('/api/users/:id/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CHAT MESSAGES ---
app.get('/api/messages', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { userId } = req.query; // current user id to filter private messages
  try {
    const result = await db.query(`
      SELECT m.*, u.full_name as sender_name, u.profile_image as sender_image, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.receiver_id IS NULL 
         OR m.receiver_id = $1 
         OR m.sender_id = $1
      ORDER BY m.created_at ASC
      LIMIT 100
    `, [userId || 0]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { sender_id, receiver_id, content } = req.body; // receiver_id can be null for 'all'
  try {
    const result = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
      [sender_id, receiver_id || null, content]
    );

    // Broadcast to notifications for the receiver (if private) or others (if public)
    const sender = await db.query('SELECT full_name FROM users WHERE id = $1', [sender_id]);
    const senderName = sender.rows[0]?.full_name || 'Someone';

    if (receiver_id) {
      await db.query(
        'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
        [receiver_id, 'New Private Message', `${senderName}: ${content.substring(0, 30)}...`]
      );
    } else {
      const others = await db.query('SELECT id FROM users WHERE id != $1', [sender_id]);
      for (let user of others.rows) {
        await db.query(
          'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
          [user.id, 'New Team Message', `${senderName}: ${content.substring(0, 30)}...`]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const twilio = require('twilio');

app.post('/api/whatsapp/notify', checkRole(['admin']), async (req, res) => {
  const { taskId, message, customerIds } = req.body;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  try {
    const client = twilio(accountSid, authToken);

    // Fetch actual customer details
    const customers = await db.query('SELECT name, phone, whatsapp FROM customers WHERE id = ANY($1)', [customerIds || []]);

    const results = [];
    for (const customer of customers.rows) {
      let rawPhone = customer.whatsapp || customer.phone;
      if (!rawPhone) continue;

      // Format for Somalia (+252)
      let formattedPhone = rawPhone.replace(/\D/g, '');
      if (formattedPhone.startsWith('063')) formattedPhone = '252' + formattedPhone.substring(1);
      else if (formattedPhone.startsWith('63')) formattedPhone = '252' + formattedPhone;
      else if (!formattedPhone.startsWith('252')) formattedPhone = '252' + formattedPhone;

      try {
        const twilioRes = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:+${formattedPhone}`,
          body: message
        });
        results.push({ name: customer.name, status: 'Sent', sid: twilioRes.sid });
      } catch (err) {
        console.error(`Twilio Error for ${customer.name}:`, err.message);
        results.push({ name: customer.name, status: 'Failed', error: err.message });
      }
    }

    // Log the event in notifications
    await db.query(
      'INSERT INTO notifications (user_id, title, message) VALUES (1, $1, $2)',
      ['WhatsApp Dispatch', `Sent ${results.filter(r => r.status === 'Sent').length} WhatsApp reminders for task #${taskId}.`]
    );

    res.json({ success: true, results });
  } catch (err) {
    console.error('WhatsApp Controller Error:', err);
    res.status(500).json({ error: 'WhatsApp service error: ' + err.message });
  }
});

// Waafi ZAAD API Integration
app.post('/api/payments/zaad', checkRole(['admin', 'cashier']), async (req, res) => {
  const { amount, phone, reference, currency } = req.body;
  try {
    const merchantUid = process.env.ZAAD_MERCHANT_UID;
    const apiUserId = process.env.ZAAD_API_USER_ID;
    const apiKey = process.env.ZAAD_API_KEY;

    if (!merchantUid || !apiUserId || !apiKey) {
      return res.status(400).json({ error: 'ZAAD API credentials not configured on the server.' });
    }

    // Format phone: must start with 252 for Waafi
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('063')) formattedPhone = '252' + formattedPhone.substring(1);
    else if (formattedPhone.startsWith('63')) formattedPhone = '252' + formattedPhone;
    else if (!formattedPhone.startsWith('252')) formattedPhone = '252' + formattedPhone;

    const reqCurrency = currency === 'SLSH' ? 'SLSH' : 'USD';

    const payload = {
      schemaVersion: "1.0",
      requestId: "REQ-" + Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName: "API_PURCHASE",
      serviceParams: {
        merchantUid,
        apiUserId,
        apiKey,
        paymentMethod: "MWALLET_ACCOUNT",
        payerInfo: {
          accountNo: formattedPhone
        },
        transactionInfo: {
          referenceId: reference ? String(reference) : "REF-" + Date.now(),
          invoiceId: reference ? String(reference) : "INV-" + Date.now(),
          amount: parseFloat(amount).toString(),
          currency: reqCurrency,
          description: "Payment for Gurmad Services"
        }
      }
    };

    const response = await fetch('https://api.waafipay.net/asm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (responseData.responseCode === "2001") {
      res.json({ success: true, data: responseData });
    } else {
      res.status(400).json({ error: responseData.responseMsg || 'Payment failed' });
    }
  } catch (err) {
    console.error('ZAAD API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Messaging Endpoints ---

app.post('/api/messages/send', checkRole(['admin']), async (req, res) => {
  const { to, message, method } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    let result;
    if (method === 'whatsapp') {
      result = await messaging.sendWhatsApp(to, message);
    } else {
      result = await messaging.sendSMS(to, message);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/notify', checkRole(['admin']), async (req, res) => {
  const { taskId, message, customerIds } = req.body;
  try {
    let query = 'SELECT phone FROM customers WHERE id = ANY($1)';
    let params = [customerIds];

    if (!customerIds || customerIds.length === 0) {
      query = 'SELECT c.phone FROM task_customers tc JOIN customers c ON tc.customer_id = c.id WHERE tc.task_id = $1';
      params = [taskId];
    }

    const result = await db.query(query, params);
    const phones = result.rows.map(r => r.phone).filter(Boolean);

    let sentCount = 0;
    for (const phone of phones) {
      try {
        await messaging.sendWhatsApp(phone, message);
        sentCount++;
      } catch (e) {
        console.error('Failed to notify phone:', phone, e.message);
      }
    }
    res.json({ success: true, sentCount, total: phones.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/broadcast', checkRole(['admin']), async (req, res) => {
  const { targetType, message, type } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    let query = 'SELECT phone, name FROM customers WHERE phone IS NOT NULL AND phone != \'\'';
    if (targetType === 'unpaid') {
      query += " AND status = 'Unpaid'";
    }

    const result = await db.query(query);
    const customers = result.rows;

    let sentCount = 0;
    for (const c of customers) {
      try {
        const personalizedMsg = message.replace(/{name}/g, c.name);
        if (type === 'whatsapp') {
          await messaging.sendWhatsApp(c.phone, personalizedMsg);
        } else {
          await messaging.sendSMS(c.phone, personalizedMsg);
        }
        sentCount++;
      } catch (e) {
        console.error('Failed to notify phone:', c.phone, e.message);
      }
    }
    res.json({ success: true, sentCount, total: customers.length, message: `Successfully sent ${sentCount} messages` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route Optimization Endpoint ---
app.get('/api/optimize-route', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { task_id } = req.query;
  if (!task_id) return res.status(400).json({ error: 'Missing task_id' });

  try {
    const result = await db.query(`
      SELECT c.id, c.lat, c.lng 
      FROM task_customers tc 
      JOIN customers c ON tc.customer_id = c.id 
      WHERE tc.task_id = $1 AND tc.collected = false 
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL 
        AND c.lat != 0 AND c.lng != 0
    `, [task_id]);

    const customers = result.rows;
    if (customers.length === 0) {
      return res.json({ success: true, geometry: { type: 'LineString', coordinates: [] } });
    }

    const points = customers.map(c => ({
      id: c.id,
      lat: parseFloat(c.lat),
      lng: parseFloat(c.lng)
    }));

    let unvisited = [...points];
    let current = unvisited.shift();
    let sortedPoints = [current];

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const point = unvisited[i];
        const d2 = Math.pow(current.lat - point.lat, 2) + Math.pow(current.lng - point.lng, 2);
        if (d2 < minDistance) {
          minDistance = d2;
          nearestIdx = i;
        }
      }

      current = unvisited[nearestIdx];
      sortedPoints.push(current);
      unvisited.splice(nearestIdx, 1);
    }

    const coordinates = sortedPoints.map(p => [p.lng, p.lat]);

    res.json({
      success: true,
      geometry: {
        type: 'LineString',
        coordinates
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Gurmad Backend running on port ${PORT}`);
});

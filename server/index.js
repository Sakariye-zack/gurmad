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
const cron = require('node-cron');

// Formats a raw Somali phone number for WhatsApp/Twilio ("+252...").
const formatSomaliPhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('063')) digits = '252' + digits.substring(1);
  else if (digits.startsWith('63')) digits = '252' + digits;
  else if (!digits.startsWith('252')) digits = '252' + digits;
  return '+' + digits;
};

// Fire-and-forget WhatsApp send: never let a messaging failure block the request that
// triggered it (task dispatch / invoice creation), just log it.
const sendWhatsAppSafe = async (rawPhone, body) => {
  const to = formatSomaliPhone(rawPhone);
  if (!to) return;
  try {
    await messaging.sendWhatsApp(to, body);
  } catch (err) {
    console.error(`[WhatsApp] Failed to send to ${to}:`, err.message);
  }
};
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

    // Employee Advances (Phase 3): salary advance requests, tracked separately from payroll so
    // an admin can see outstanding balances before running payroll — deduction is manual/reviewed,
    // never auto-applied, matching the same conservative choice already made for payroll.needs_review.
    await db.query(`
      CREATE TABLE IF NOT EXISTS employee_advances (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        reason TEXT,
        repayment_period VARCHAR(50),
        status VARCHAR(20) DEFAULT 'Pending',
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Employee Expense Claims (Phase 3): reimbursement requests for money an employee already
    // spent out of pocket — distinct from the `expenses` table, which is company-initiated spend.
    await db.query(`
      CREATE TABLE IF NOT EXISTS expense_claims (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        description TEXT,
        receipt_image VARCHAR(255),
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

    // Suppliers & Assets (Phase 4): first slice of Procurement/Inventory — plain admin-managed
    // records for now, matching how the existing /api/inventory routes are gated (checkRole
    // admin-only), since no Procurement/Storekeeper login role exists yet in this system.
    await db.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(100),
        category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        serial_number VARCHAR(100),
        value NUMERIC DEFAULT 0,
        location VARCHAR(150),
        assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        condition VARCHAR(50) DEFAULT 'Good',
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Phase 5: truck documents (insurance/registration expiry) — fuel and maintenance logging
    // already existed before this phase; this closes the "truck documents" gap from the proposal.
    await db.query(`
      ALTER TABLE trucks ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
      ALTER TABLE trucks ADD COLUMN IF NOT EXISTS registration_expiry DATE;
      ALTER TABLE trucks ADD COLUMN IF NOT EXISTS road_tax_expiry DATE;
    `);

    // Phase 8: Customer Portal — a customer only gets portal login credentials once an admin
    // explicitly enables access (sets a password); nothing here changes existing customer rows.
    await db.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS password VARCHAR(255);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo VARCHAR(255);
    `);

    // Customer Portal notifications — separate from the staff `notifications` table (which is
    // user_id-based); this one is customer_id-based and feeds the portal's bell icon. Populated
    // automatically when a payment is recorded against a customer or their complaint's status
    // changes (see POST /api/invoices and PUT /api/complaints/:id/status).
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_notifications (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Two-way complaint replies: staff can now write a reply the customer sees in the Portal,
    // instead of the customer only seeing a bare status change.
    await db.query(`
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS admin_reply TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;
    `);

    // Photo evidence — a missed-collection or property-damage complaint is far more actionable
    // with a photo attached, from either staff (ComplaintsView) or the customer themselves
    // (Customer Portal).
    await db.query(`
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo VARCHAR(255);
    `);

    // Cashout signature workflow: the proposal docs specify Cashier -> submit cashout ->
    // Chairman/Gudoomiye reviews reconciliation -> approve/reject -> closed. Gurmad's own
    // process adds a physical step in between: the cashout slip is printed, signed on paper by
    // both the cashier and the Gudoomiye, then the signed paper is scanned/photographed and
    // re-uploaded as proof before the Gudoomiye can approve it in the system.
    await db.query(`
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending Approval';
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS signed_document VARCHAR(255);
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);
    // Existing cashouts predate the workflow — treat them as already-settled history rather than
    // suddenly blocking on a signed document they were never asked for.
    await db.query(`UPDATE cashouts SET status = 'Approved' WHERE status = 'Pending Approval' AND created_at < NOW() - INTERVAL '1 minute'`);

    // Expenses: an approval workflow (a cashier's logged expense starts Pending until an admin
    // approves it, an admin's own entry is auto-approved) plus who logged it, so a wrong entry
    // can be corrected/removed instead of being a permanent, unreviewed line in the ledger.
    await db.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Approved';
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_image VARCHAR(255);
    `);

    // Budget Management — real per-category monthly limits (Fuel/Salaries/Maintenance/Other),
    // replacing the single hardcoded $5,000 figure the Expense Tracker used to show. One row
    // per category; "used" is always computed live from the expenses table, never stored.
    await db.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL UNIQUE,
        monthly_limit NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Document & Financial Documents module: consolidates the proposal's ~20 page-types
    // (Invoices, Receipts, Contracts, Licenses, etc.) into one generic, categorized document
    // record — category is the fixed high-level bucket (Customer/Employee/Supplier/Fleet/
    // Company), document_type is the specific kind within it (free text, so new types don't
    // need a schema change). "Signed" is a recorded attestation (signer name + date), not a
    // cryptographic e-signature — esign_provider/envelope_id are reserved for wiring in a real
    // provider (DocuSign/HelloSign) later, once API credentials exist.
    await db.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(30) NOT NULL,
        document_type VARCHAR(100),
        related_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        related_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        related_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        related_truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
        file_path VARCHAR(255),
        status VARCHAR(30) NOT NULL DEFAULT 'Draft',
        version INTEGER NOT NULL DEFAULT 1,
        parent_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        signed_by VARCHAR(150),
        signed_at TIMESTAMP,
        esign_provider VARCHAR(30),
        esign_envelope_id VARCHAR(150),
        esign_status VARCHAR(30),
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Phase 6: geofence exit/enter events, one row per boundary crossing (not per ping) —
    // logged against the task so it can be traced to the truck/collector/zone at that moment.
    await db.query(`
      CREATE TABLE IF NOT EXISTS geofence_events (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        zone_id INTEGER REFERENCES zones(id),
        event_type VARCHAR(10) NOT NULL,
        lat DECIMAL(10, 8),
        lng DECIMAL(11, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Phase 4 completion: the full procurement chain (Purchase Request -> Purchase Order ->
    // Goods Receipt), plus a Stock Movement ledger so every inventory quantity change (whether
    // from a received PO or a manual adjustment) is traceable to who/when/why.
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        requested_by INTEGER REFERENCES users(id),
        department VARCHAR(100),
        item_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        estimated_price NUMERIC DEFAULT 0,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        item_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price NUMERIC DEFAULT 0,
        total_amount NUMERIC DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Ordered',
        created_by INTEGER REFERENCES users(id),
        received_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL,
        quantity INTEGER NOT NULL,
        reference VARCHAR(255),
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        created_by INTEGER REFERENCES users(id),
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

    // A cashout reconciles what a CASHIER physically brought in — collector_name stays for the
    // zone-security check and historical grouping, but the person being reconciled is the cashier.
    await db.query(`
      ALTER TABLE cashouts ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(100);
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

    // Missed Collection workflow — until now a customer not marked collected just stayed
    // "Pending" with no record of why. This captures the reason/photo/GPS a collector logs at
    // the moment they can't service a stop, so Operations can see and reassign it.
    await db.query(`
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed BOOLEAN DEFAULT FALSE;
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_reason VARCHAR(255);
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_note TEXT;
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_photo VARCHAR(255);
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_at TIMESTAMP;
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_lat DECIMAL(10, 8);
      ALTER TABLE task_customers ADD COLUMN IF NOT EXISTS missed_lng DECIMAL(11, 8);
    `);

    // Flag payroll records where attendance didn't cover the full month, instead of silently paying full base salary
    await db.query(`
      ALTER TABLE payroll ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
    `);

    // --- Dynamic Roles & Permissions (Phase 1 of the RBAC upgrade) ---
    // `users.role` (string) is kept as-is so every existing checkRole([...]) call keeps working
    // unchanged; `role_id` is purely additive, feeding the new Roles & Permissions admin UI and
    // any newly-added role (e.g. zone_accountant) without touching existing route behavior.
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(100) NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(30) NOT NULL,
        label VARCHAR(150) NOT NULL,
        UNIQUE(module, action)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
    `);

    // Seed the 5 system roles (idempotent — safe to run every start)
    const systemRoles = [
      ['admin', 'Super Admin'],
      ['cashier', 'Cashier'],
      ['collector', 'Collector'],
      ['gudoomiye', 'Gudoomiye (Chairman)'],
      ['zone_accountant', 'Zone Accountant'],
    ];
    for (const [key, label] of systemRoles) {
      await db.query(
        `INSERT INTO roles (key, label, is_system) VALUES ($1, $2, TRUE)
         ON CONFLICT (key) DO NOTHING`,
        [key, label]
      );
    }

    // Seed the permission catalog (module + action -> label)
    const modules = ['customers', 'billing', 'cashout', 'payroll', 'expenses', 'debts', 'tasks', 'map', 'reports', 'employees', 'users', 'settings'];
    const actions = ['view', 'create', 'edit', 'delete', 'approve'];
    for (const mod of modules) {
      for (const act of actions) {
        await db.query(
          `INSERT INTO permissions (module, action, label) VALUES ($1, $2, $3)
           ON CONFLICT (module, action) DO NOTHING`,
          [mod, act, `${act.charAt(0).toUpperCase() + act.slice(1)} ${mod}`]
        );
      }
    }

    // Seed role_permissions to mirror each existing role's CURRENT effective access, so nothing
    // changes behaviorally on cutover — this table only backs the new Roles UI and zone_accountant.
    const roleGrants = {
      admin: modules.flatMap(m => actions.map(a => [m, a])), // full access everywhere
      cashier: [
        ['customers', 'view'], ['customers', 'create'], ['customers', 'edit'],
        ['billing', 'view'], ['billing', 'create'],
        ['cashout', 'view'], ['cashout', 'create'],
        ['payroll', 'view'],
        ['expenses', 'view'], ['expenses', 'create'],
        ['debts', 'view'], ['debts', 'create'],
        ['tasks', 'view'],
        ['employees', 'view'], ['employees', 'create'],
        ['map', 'view'],
      ],
      collector: [
        ['customers', 'view'], ['customers', 'create'], ['customers', 'edit'],
        ['tasks', 'view'], ['tasks', 'create'],
        ['employees', 'view'],
        ['map', 'view'],
      ],
      gudoomiye: [
        ['customers', 'view'], ['customers', 'create'],
        ['billing', 'view'], ['billing', 'create'],
        ['cashout', 'view'], ['cashout', 'create'], ['cashout', 'approve'],
        ['debts', 'view'],
        ['tasks', 'view'],
        ['employees', 'view'],
        ['map', 'view'],
        ['reports', 'view'],
      ],
      zone_accountant: [
        ['customers', 'view'],
        ['billing', 'view'],
        ['cashout', 'view'],
        ['debts', 'view'],
        ['reports', 'view'],
      ],
    };
    for (const [roleKey, grants] of Object.entries(roleGrants)) {
      const roleRow = await db.query('SELECT id FROM roles WHERE key = $1', [roleKey]);
      const roleId = roleRow.rows[0]?.id;
      if (!roleId) continue;
      for (const [mod, act] of grants) {
        const permRow = await db.query('SELECT id FROM permissions WHERE module = $1 AND action = $2', [mod, act]);
        const permId = permRow.rows[0]?.id;
        if (!permId) continue;
        await db.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleId, permId]
        );
      }
    }

    // Backfill role_id on existing user accounts from their current role string
    await db.query(`
      UPDATE users SET role_id = roles.id
      FROM roles
      WHERE users.role = roles.key AND users.role_id IS NULL;
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

// Automated backups write here, deliberately outside the public uploads/ folder (which express
// serves statically) so a backup file is never reachable except through the authenticated route.
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}
const BACKUP_TABLES = ['users', 'employees', 'trucks', 'zones', 'customers', 'invoices', 'expenses', 'tasks', 'inventory', 'debts', 'payroll', 'attendance', 'audit_logs', 'truck_fuel_logs', 'truck_maintenance_logs'];
const runScheduledBackup = async () => {
  const backupData = {};
  for (const table of BACKUP_TABLES) {
    const result = await db.query(`SELECT * FROM ${table}`);
    backupData[table] = result.rows;
  }
  const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(backupDir, fileName), JSON.stringify(backupData));
  // Keep the most recent 8 (~2 months of weekly backups) so the disk doesn't grow unbounded.
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_')).sort();
  while (files.length > 8) fs.unlinkSync(path.join(backupDir, files.shift()));
  console.log(`[Backup] Saved ${fileName}`);
  return fileName;
};

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

// Documents module needs PDFs/Word docs too, not just images — separate multer instance so the
// image-only restriction above (used for photos/receipts elsewhere) is untouched.
const documentFileFilter = (req, file, cb) => {
  const allowed = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowed.some(a => file.mimetype.startsWith(a))) {
    cb(null, true);
  } else {
    cb(new Error('Kaliya PDF, Word, ama sawirro ayaa la ogol yahay!'), false);
  }
};
const uploadDocument = multer({ storage: storage, fileFilter: documentFileFilter, limits: { fileSize: 15 * 1024 * 1024 } });

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

// --- Phase 8: Customer Portal auth ---
// Deliberately a separate token/middleware from staff auth (authenticateToken/checkRole above):
// a customer token carries `type: 'customer'` and only a customerId, never a role, so it can
// never be mistaken for (or reused as) a staff token even if someone tried passing one to a
// staff-only route — every customer-portal route checks `type === 'customer'` explicitly.
const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied: No token provided' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded.type !== 'customer') return res.status(403).json({ error: 'Access denied: Invalid or expired token' });
    req.customerId = decoded.customerId;
    next();
  });
};

// --- Phase 2: dynamic permission-based access control ---
// Replaces hardcoded checkRole([...]) arrays with a lookup against the role_permissions table
// built in Phase 1, so a custom role created via the Roles & Permissions UI actually gets
// enforced on real routes, not just displayed. The JWT itself is left unchanged (still just
// id/username/role/zone) so existing tokens keep working — role_id is looked up per request
// from `users`, and a short in-memory cache avoids hitting the DB on every single call.
const rolePermsCache = new Map(); // role_id -> { set: Set<"module.action">, expires: number }
const ROLE_PERMS_TTL_MS = 30000;

const getRolePermissions = async (roleId) => {
  const cached = rolePermsCache.get(roleId);
  if (cached && cached.expires > Date.now()) return cached.set;
  const rows = await db.query(
    `SELECT p.module, p.action FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  const set = new Set(rows.rows.map(r => `${r.module}.${r.action}`));
  rolePermsCache.set(roleId, { set, expires: Date.now() + ROLE_PERMS_TTL_MS });
  return set;
};

const requirePermission = (module, action) => [
  authenticateToken,
  async (req, res, next) => {
    try {
      if (!req.user) return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
      // Super Admin always passes, without a DB round-trip, matching its "full access everywhere" seed.
      if (req.user.role.toLowerCase() === 'admin') return next();

      const userRow = await db.query('SELECT role_id FROM users WHERE id = $1', [req.user.id]);
      const roleId = userRow.rows[0]?.role_id;
      if (!roleId) return res.status(403).json({ error: 'Access denied: no role assigned' });

      const perms = await getRolePermissions(roleId);
      if (!perms.has(`${module}.${action}`)) {
        return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
];

// Centralizes the "is this user restricted to one zone" check that used to be copy-pasted as
// `isGudoomiye ? 'WHERE zone = $1' : ''` in every route — a Gudoomiye/Zone Accountant is scoped
// to req.user.zone, a Cashier is scoped to their paired collector(s)/zone_group (see
// getCashierScope), and everyone else (Admin, Collector on their own records) sees company-wide.
const getZoneScope = (req) => {
  const role = req.user.role.toLowerCase();
  if (role === 'gudoomiye' || role === 'zone_accountant') {
    return { restricted: true, zone: req.user.zone };
  }
  return { restricted: false, zone: null };
};

// --- Phase 6: Geofencing ---
// Standard ray-casting point-in-polygon test. `point` is [lat, lng]; `polygon` is the array of
// [lat, lng] vertices drawn on the Operations Map (leaflet-draw writes zones.coordinates in this
// same [lat, lng] shape — see MapView.jsx's <Polygon positions={z.coordinates}>).
const isPointInPolygon = (point, polygon) => {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
    if (intersects) inside = !inside;
  }
  return inside;
};

// In-memory "was this task's last known ping inside its zone" state, so an alert fires once on
// the inside->outside transition rather than every 15s while a truck sits outside the boundary.
const geofenceState = new Map(); // task_id -> boolean (true = currently outside)

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

// ============================================================
// PHASE 8: CUSTOMER PORTAL
// A customer only exists here once portal_enabled is set (see POST
// /api/customers/:id/enable-portal, admin-only, further below). Every route in this section
// scopes strictly to req.customerId from the verified token — a customer can never pass an id
// to see someone else's data.
// ============================================================

app.post('/api/customer-portal/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM customers WHERE phone = $1 AND portal_enabled = TRUE', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }
    const customer = result.rows[0];
    const validPassword = await bcrypt.compare(password, customer.password || '');
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }
    const jwtToken = jwt.sign({ customerId: customer.id, type: 'customer' }, JWT_SECRET, { expiresIn: '24h' });
    const { password: pw, ...safeCustomer } = customer;
    res.json({ ...safeCustomer, token: jwtToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zones store collection_days as a comma-separated list of 3-letter day codes (Sun..Sat) — see
// the day-picker in FleetView's zone form. Finds the soonest matching weekday from today
// (today counts if it's a collection day), returns null if the zone has no schedule set.
const DAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function computeNextPickup(collectionDaysStr, collectionTime) {
  if (!collectionDaysStr) return null;
  const days = collectionDaysStr.split(',').map(d => d.trim()).filter(Boolean);
  const dayIndexes = days.map(d => DAY_CODES.findIndex(c => c.toLowerCase() === d.toLowerCase().slice(0, 3))).filter(i => i >= 0);
  if (dayIndexes.length === 0) return null;
  const today = new Date();
  const todayIdx = today.getDay();
  let bestOffset = 7;
  for (const idx of dayIndexes) {
    const offset = (idx - todayIdx + 7) % 7;
    if (offset < bestOffset) bestOffset = offset;
  }
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + bestOffset);
  return { date: nextDate.toISOString().slice(0, 10), day: DAY_CODES[nextDate.getDay()], time: collectionTime || null, isToday: bestOffset === 0 };
}

app.get('/api/customer-portal/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, e.name as collector_name, e.phone as collector_phone FROM customers c LEFT JOIN employees e ON c.collector_id = e.id WHERE c.id = $1`,
      [req.customerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const { password, ...safeCustomer } = result.rows[0];

    let nextPickup = null;
    if (safeCustomer.zone) {
      const zoneRes = await db.query('SELECT collection_days, collection_time FROM zones WHERE name = $1 LIMIT 1', [safeCustomer.zone]);
      if (zoneRes.rows.length > 0) {
        nextPickup = computeNextPickup(zoneRes.rows[0].collection_days, zoneRes.rows[0].collection_time);
      }
    }

    res.json({ ...safeCustomer, next_pickup: nextPickup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer self-service password change — different from the admin-driven enable/reset-portal
// routes: this one requires knowing the *current* password, matching a normal "change password"
// flow rather than an admin override.
app.put('/api/customer-portal/change-password', authenticateCustomer, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const custRes = await db.query('SELECT password FROM customers WHERE id = $1', [req.customerId]);
    if (custRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const valid = await bcrypt.compare(currentPassword || '', custRes.rows[0].password || '');
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE customers SET password = $1 WHERE id = $2', [hashed, req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer self-service photo upload — reuses the image-only `upload` middleware (not
// uploadDocument, since this is strictly a profile photo, not a document).
app.post('/api/customer-portal/photo', authenticateCustomer, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  try {
    const result = await db.query(
      'UPDATE customers SET photo = $1 WHERE id = $2 RETURNING id, photo',
      [req.file.filename, req.customerId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-portal/payments', authenticateCustomer, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, amount, currency, status, payment_method, cash_amount, zaad_amount, edahab_amount,
        debt_amount, slsh_amount, discount_amount, created_at
       FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-portal/collections', authenticateCustomer, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tc.collected, tc.collected_at, t.route_name, t.driver_name, t.collector_name, t.status
       FROM task_customers tc
       JOIN tasks t ON tc.task_id = t.id
       WHERE tc.customer_id = $1
       ORDER BY t.scheduled_at DESC
       LIMIT 100`,
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-portal/complaints', authenticateCustomer, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, title, description, status, priority, photo, admin_reply, replied_at, created_at FROM complaints WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer-portal/complaints', authenticateCustomer, upload.single('photo'), async (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A title is required' });
  try {
    const result = await db.query(
      'INSERT INTO complaints (customer_id, title, description, status, photo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.customerId, title.trim(), description || null, 'Pending', req.file ? req.file.filename : null]
    );
    // So staff see it show up the same way any other new complaint does.
    await db.query('INSERT INTO notifications (user_id, title, message) VALUES (1, $1, $2)',
      ['New Complaint', `A customer submitted a complaint: ${title.trim()}`]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-portal/notifications', authenticateCustomer, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customer_notifications WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customer-portal/notifications/:id/read', authenticateCustomer, async (req, res) => {
  try {
    await db.query(
      'UPDATE customer_notifications SET is_read = TRUE WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.customerId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customer-portal/notifications/read-all', authenticateCustomer, async (req, res) => {
  try {
    await db.query('UPDATE customer_notifications SET is_read = TRUE WHERE customer_id = $1', [req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only: grant/revoke a customer's portal login. Setting a password is required to enable;
// disabling just flips the flag off (their old password is kept in case it's re-enabled later,
// but portal_enabled = FALSE blocks login regardless). This route always overwrites the password
// and sets portal_enabled = TRUE, so the frontend also calls it — unchanged — as the "Reset
// Password" action on an already-enabled customer; no separate reset endpoint is needed.
app.post('/api/customers/:id/enable-portal', checkRole(['admin']), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'UPDATE customers SET password = $1, portal_enabled = TRUE WHERE id = $2 RETURNING id, name, phone, portal_enabled',
      [hashed, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:id/disable-portal', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE customers SET portal_enabled = FALSE WHERE id = $1 RETURNING id, name, phone, portal_enabled',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
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
    // role_id is looked up from the roles table by key so req.user.role (JWT) keeps working
    // unchanged for every existing checkRole([...]) call — role_id is additive, not a replacement.
    const roleRow = await db.query('SELECT id FROM roles WHERE key = $1', [role]);
    const result = await db.query(
      'INSERT INTO users (username, password, full_name, role, role_id, zone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, role, role_id, zone, created_at, is_active',
      [username, hashedPassword, full_name, role, roleRow.rows[0]?.id || null, zone || null]
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
    let roleId = null;
    if (role) {
      const roleRow = await db.query('SELECT id FROM roles WHERE key = $1', [role]);
      roleId = roleRow.rows[0]?.id || null;
    }
    const result = await db.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role),
        role_id = COALESCE($3, role_id), zone = $4 WHERE id = $5
       RETURNING id, username, full_name, role, role_id, zone`,
      [full_name || null, role || null, roleId, zone || null, req.params.id]
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

// --- Dynamic Roles & Permissions (Phase 1 RBAC foundation) ---
// Lets a Super Admin create new roles and adjust any role's permissions without a developer,
// per the master proposal. This is additive: existing routes still enforce access via their own
// hardcoded checkRole([...]) arrays — role_permissions here backs the new admin UI and the
// zone_accountant role only (see the checkRole arrays each route already carries).
app.get('/api/roles', checkRole(['admin']), async (req, res) => {
  try {
    const roles = await db.query('SELECT id, key, label, is_system FROM roles ORDER BY is_system DESC, label ASC');
    const grants = await db.query(`
      SELECT rp.role_id, p.module, p.action
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `);
    const permsByRole = {};
    grants.rows.forEach(g => {
      if (!permsByRole[g.role_id]) permsByRole[g.role_id] = [];
      permsByRole[g.role_id].push(`${g.module}.${g.action}`);
    });
    res.json(roles.rows.map(r => ({ ...r, permissions: permsByRole[r.id] || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/permissions', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, module, action, label FROM permissions ORDER BY module ASC, action ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roles', checkRole(['admin']), async (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Role name is required' });
  try {
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) return res.status(400).json({ error: 'Role name must contain at least one letter or number' });
    const result = await db.query(
      `INSERT INTO roles (key, label, is_system) VALUES ($1, $2, FALSE) RETURNING id, key, label, is_system`,
      [key, label.trim()]
    );
    res.json({ ...result.rows[0], permissions: [] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A role with that name already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/roles/:id/permissions', checkRole(['admin']), async (req, res) => {
  const { permissions } = req.body; // array of "module.action" strings
  if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions must be an array' });
  try {
    // Resolve "module.action" strings to permission ids, skipping anything unrecognized
    const permIds = [];
    for (const key of permissions) {
      const [mod, act] = String(key).split('.');
      const row = await db.query('SELECT id FROM permissions WHERE module = $1 AND action = $2', [mod, act]);
      if (row.rows[0]) permIds.push(row.rows[0].id);
    }
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
    for (const permId of permIds) {
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, permId]);
    }
    res.json({ success: true, permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/roles/:id', checkRole(['admin']), async (req, res) => {
  try {
    const role = await db.query('SELECT is_system FROM roles WHERE id = $1', [req.params.id]);
    if (role.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
    if (role.rows[0].is_system) return res.status(403).json({ error: 'System roles cannot be deleted' });
    const inUse = await db.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [req.params.id]);
    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Cannot delete a role that is still assigned to users' });
    }
    await db.query('DELETE FROM roles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
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

// A cashier's real-world job is tied to whichever zone(s)/collector(s) they were assigned to
// (Cashier Assignments) — they should only ever see the customers in those zones or served by
// their paired collector, not the whole company's customer list.
const getCashierScope = async (cashierId) => {
  const rows = await db.query(
    'SELECT DISTINCT zone_group, collector_id FROM cashier_assignments WHERE cashier_id = $1',
    [cashierId]
  );
  const zoneGroups = [...new Set(rows.rows.map(r => r.zone_group).filter(Boolean))];
  const collectorIds = [...new Set(rows.rows.map(r => r.collector_id).filter(Boolean))];
  return { zoneGroups, collectorIds };
};

// --- Customers ---
// Phase 2: migrated onto the dynamic permission engine — any role (including a custom one
// created via Roles & Permissions) with "customers.view" granted can call this, instead of a
// hardcoded role-name list. Zone scoping still comes from getZoneScope (Gudoomiye/Zone
// Accountant restricted to their own zone; Cashier scoped separately via getCashierScope below).
app.get('/api/customers', requirePermission('customers', 'view'), async (req, res) => {
  try {
    const { restricted: isGudoomiye } = getZoneScope(req);
    const isCashier = req.user.role.toLowerCase() === 'cashier';

    if (isCashier) {
      const { zoneGroups, collectorIds } = await getCashierScope(req.user.id);
      if (zoneGroups.length === 0 && collectorIds.length === 0) {
        // No assignment yet — nothing to show until an admin/gudoomiye assigns this cashier
        // a zone/collector (Cashier Assignments), rather than leaking every customer.
        return res.json([]);
      }
      const result = await db.query(`
        SELECT c.*, e.name as collector_name
        FROM customers c
        LEFT JOIN employees e ON c.collector_id = e.id
        WHERE c.zone = ANY($1::text[]) OR c.collector_id = ANY($2::int[])
        ORDER BY c.route_order ASC NULLS LAST, c.created_at DESC
      `, [zoneGroups, collectorIds]);
      return res.json(result.rows);
    }

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


app.post('/api/customers', requirePermission('customers', 'create'), async (req, res) => {
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
    if (result.rows[0].lat && result.rows[0].lng) {
      io.emit('customer_location_updated', { customer: result.rows[0] });
    }
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
    if (result.rows[0].lat && result.rows[0].lng) {
      io.emit('customer_location_updated', { customer: result.rows[0] });
    }
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

app.get('/api/invoices', requirePermission('billing', 'view'), async (req, res) => {
  try {
    const { restricted: isGudoomiye } = getZoneScope(req);
    const isCashier = req.user.role.toLowerCase() === 'cashier';

    if (isCashier) {
      const { zoneGroups, collectorIds } = await getCashierScope(req.user.id);
      if (zoneGroups.length === 0 && collectorIds.length === 0) {
        return res.json([]);
      }
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
        WHERE c.zone = ANY($1::text[]) OR c.collector_id = ANY($2::int[])
        ORDER BY i.created_at DESC
      `, [zoneGroups, collectorIds]);
      return res.json(result.rows);
    }

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
      ${isGudoomiye ? 'WHERE c.zone = $1' : ''}
      ORDER BY i.created_at DESC
    `, isGudoomiye ? [req.user.zone] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices', requirePermission('billing', 'create'), async (req, res) => {
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

    // WhatsApp the customer automatically: a receipt when they paid in full, or a debt
    // reminder with the exact balance owed when part/all of it was left as debt. Gated on the
    // 'whatsappNotify' toggle in Settings > Notifications — that setting existed in the UI
    // already but was never actually checked anywhere, so it did nothing before this.
    (async () => {
      try {
        const notifySetting = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'whatsappNotify'");
        if (notifySetting.rows[0]?.setting_value === 'false') return;
        const custRow = await db.query('SELECT name, phone, whatsapp FROM customers WHERE id = $1', [customerId]);
        const cust = custRow.rows[0];
        if (!cust) return;
        const debtAmt = parseFloat(debt) || 0;
        const body = debtAmt > 0
          ? `Salaan ${cust.name},\n\nWaad ku mahadsantahay lacagtii aad bixisay. Waxaad wali nagu leedahay dayn dhan $${debtAmt.toFixed(2)} (${currency || 'USD'}). Fadlan naga soo xaqiiji marka aad diyaar u tahay inaad bixiso.\n\nGurmad Waste Management`
          : `Salaan ${cust.name},\n\nWaan ku mahadsanahay lacagtii $${totalAmount.toFixed(2)} (${currency || 'USD'}) ee aad maanta bixisay. Kharashkaaga waa la xaqiijiyay.\n\nGurmad Waste Management`;
        await sendWhatsAppSafe(cust.whatsapp || cust.phone, body);
      } catch (err) {
        console.error('[WhatsApp] Invoice receipt/debt reminder failed:', err.message);
      }
    })();

    // Bell-icon notification inside the Customer Portal itself (separate from the WhatsApp
    // message above — this is what powers the in-app unread badge).
    (async () => {
      try {
        const debtAmt = parseFloat(debt) || 0;
        const notifTitle = debtAmt > 0 ? 'Lacag qayb ah ayaa laga qaatay' : 'Lacagtaada waa la aqbalay';
        const notifMsg = debtAmt > 0
          ? `Waxaad wali nagu leedahay dayn dhan $${debtAmt.toFixed(2)}. Fadlan naga soo xaqiiji marka aad diyaar u tahay.`
          : `Waan ku mahadsanahay lacagtii $${totalAmount.toFixed(2)} ee aad maanta bixisay.`;
        await db.query('INSERT INTO customer_notifications (customer_id, title, message) VALUES ($1, $2, $3)',
          [customerId, notifTitle, notifMsg]);
      } catch (err) {
        console.error('[Portal Notification] Invoice notification failed:', err.message);
      }
    })();

    await logAudit(req, 'CREATE', 'invoices', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Void a mis-recorded invoice — admin only, and deliberately not a DELETE: the row (and its
// audit trail) stays, just flipped to a status revenue reports already exclude (they filter
// status = 'Paid'), so a voided invoice quietly stops counting without erasing the record of
// what happened. Also reverts the customer's payment_status/status back to Unpaid so billing
// doesn't show them as paid for money that was voided.
app.put('/api/invoices/:id/void', checkRole(['admin']), async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = existing.rows[0];
    if (inv.status === 'Voided') return res.status(400).json({ error: 'Already voided' });

    const result = await db.query(
      "UPDATE invoices SET status = 'Voided' WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (inv.customer_id) {
      await db.query("UPDATE customers SET payment_status = 'Unpaid', status = 'Unpaid' WHERE id = $1", [inv.customer_id]);
    }
    await logAudit(req, 'VOID', 'invoices', inv.id, inv, result.rows[0]);
    io.emit('invoice_voided', result.rows[0]);
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
app.get('/api/cashier-assignments', checkRole(['admin', 'gudoomiye', 'cashier', 'zone_accountant']), async (req, res) => {
  try {
    const isGudoomiye = ['gudoomiye', 'zone_accountant'].includes(req.user.role.toLowerCase());
    const isCashier = req.user.role.toLowerCase() === 'cashier';
    const whereClause = isGudoomiye ? 'WHERE ca.zone_group = $1' : (isCashier ? 'WHERE ca.cashier_id = $1' : '');
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
      ${whereClause}
      ORDER BY ca.zone_group ASC, ca.id ASC
    `, isGudoomiye ? [req.user.zone] : (isCashier ? [req.user.id] : []));
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
    `SELECT c.*, tc.collected, tc.collected_at, tc.collected_lat, tc.collected_lng, tc.task_id,
       tc.missed, tc.missed_reason, tc.missed_note, tc.missed_photo, tc.missed_at
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
  // Admin entries are auto-approved (they're the approver); a cashier's entry starts Pending
  // until an admin reviews it — closes the "anyone can log an unreviewed expense" gap.
  const status = req.user.role.toLowerCase() === 'admin' ? 'Approved' : 'Pending';

  try {
    const result = await db.query(
      'INSERT INTO expenses (category, description, amount, reference_no, invoice_image, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [category, description, amount || 0, reference_no || null, invoice_image, status, req.user.id]
    );
    await logAudit(req, 'CREATE', 'expenses', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id', checkRole(['admin']), upload.single('invoice_image'), async (req, res) => {
  const { category, description, amount, reference_no } = req.body;
  try {
    const existing = await db.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    const invoice_image = req.file ? req.file.filename : existing.rows[0].invoice_image;
    const result = await db.query(
      'UPDATE expenses SET category = $1, description = $2, amount = $3, reference_no = $4, invoice_image = $5 WHERE id = $6 RETURNING *',
      [category, description, amount || 0, reference_no || null, invoice_image, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'expenses', result.rows[0].id, existing.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id/status', checkRole(['admin']), async (req, res) => {
  const { status } = req.body;
  try {
    const existing = await db.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    const result = await db.query('UPDATE expenses SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    await logAudit(req, 'STATUS_CHANGE', 'expenses', result.rows[0].id, existing.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', checkRole(['admin']), async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    await logAudit(req, 'DELETE', 'expenses', req.params.id, existing.rows[0], null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budget status — one row per category with this month's usage computed live against the
// expenses table (only Approved expenses count, so a Pending cashier entry doesn't falsely
// eat into the budget before it's reviewed).
app.get('/api/budgets/status', checkRole(['admin', 'cashier']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.id, b.category, b.monthly_limit,
        COALESCE(e.used, 0) AS used
      FROM budgets b
      LEFT JOIN (
        SELECT category, SUM(amount) AS used
        FROM expenses
        WHERE status = 'Approved' AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)
        GROUP BY category
      ) e ON e.category = b.category
      ORDER BY b.category
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/budgets', checkRole(['admin']), async (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category) return res.status(400).json({ error: 'Category is required' });
  try {
    const result = await db.query(
      `INSERT INTO budgets (category, monthly_limit) VALUES ($1, $2)
       ON CONFLICT (category) DO UPDATE SET monthly_limit = $2, updated_at = NOW() RETURNING *`,
      [category, monthly_limit || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tasks ---
app.get('/api/tasks', requirePermission('tasks', 'view'), async (req, res) => {
  try {
    // A gudoomiye should only see the tasks dispatched in their own zone — route_name carries
    // the zone group label (e.g. "Group1"), same as everywhere else this is scoped.
    const { restricted: isGudoomiye } = getZoneScope(req);
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
      ${isGudoomiye ? 'WHERE t.route_name = $1' : ''}
      ORDER BY t.status ASC, t.scheduled_at DESC
    `, isGudoomiye ? [req.user.zone] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', requirePermission('tasks', 'create'), async (req, res) => {
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

    // Automatically remind every customer on this task's route, by WhatsApp, that the
    // collector/truck is coming for them today — this is the actual dispatch moment, so it's
    // the right point to notify, not left as a manual step someone has to remember to do.
    (async () => {
      try {
        const assignedCustomers = await db.query(
          `SELECT c.name, c.phone, c.whatsapp FROM task_customers tc
           JOIN customers c ON tc.customer_id = c.id
           WHERE tc.task_id = $1 AND (c.phone IS NOT NULL OR c.whatsapp IS NOT NULL)`,
          [task.id]
        );
        for (const cust of assignedCustomers.rows) {
          const body = `Salaan ${cust.name},\n\nGurmad Waste Management ayaa maanta idiin iman doona si ay qashinka uga soo qaadaan gurigaaga. Fadlan diyaar u ahaw.\n\nMahadsanid.`;
          await sendWhatsAppSafe(cust.whatsapp || cust.phone, body);
          await new Promise(resolve => setTimeout(resolve, 200)); // avoid Twilio rate limits
        }
      } catch (err) {
        console.error('[WhatsApp] Task dispatch reminder batch failed:', err.message);
      }
    })();

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

// Missed Collection — a collector logs why a stop couldn't be serviced (reason + optional photo
// + GPS), instead of the stop just silently staying "Pending" with no explanation. Operations
// sees these on the Missed Collections list and reassigns/reschedules manually.
app.post('/api/tasks/:taskId/customers/:customerId/missed', checkRole(['admin', 'collector']), upload.single('photo'), async (req, res) => {
  const { taskId, customerId } = req.params;
  const { reason, note, lat, lng } = req.body || {};
  if (!reason) return res.status(400).json({ error: 'A reason is required' });
  try {
    const result = await db.query(
      `UPDATE task_customers SET missed = true, missed_reason = $3, missed_note = $4, missed_photo = $5,
        missed_at = NOW(), missed_lat = $6, missed_lng = $7
       WHERE task_id = $1 AND customer_id = $2 RETURNING *`,
      [taskId, customerId, reason, note || null, req.file ? req.file.filename : null, lat || null, lng || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task/customer link not found' });

    const custRes = await db.query('SELECT name FROM customers WHERE id = $1', [customerId]);
    const custName = custRes.rows[0]?.name || 'a customer';
    const targetUsers = await db.query("SELECT id FROM users WHERE role IN ('admin')");
    for (const u of targetUsers.rows) {
      await db.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
        [u.id, 'Missed Collection', `${custName} was missed: ${reason}`]);
    }

    io.emit('customer_status_updated', { customerId: parseInt(customerId), missed: true });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Operations-facing list of everything currently marked missed and not yet re-collected —
// the reassignment/reschedule queue.
app.get('/api/missed-collections', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  try {
    const { restricted: isGudoomiye } = getZoneScope(req);
    const result = await db.query(`
      SELECT tc.task_id, tc.customer_id, tc.missed_reason, tc.missed_note, tc.missed_photo, tc.missed_at,
        tc.missed_lat, tc.missed_lng, c.name, c.phone, c.zone, c.house_no, t.route_name, t.collector_name
      FROM task_customers tc
      JOIN customers c ON tc.customer_id = c.id
      JOIN tasks t ON tc.task_id = t.id
      WHERE tc.missed = true AND tc.collected = false
      ${isGudoomiye ? 'AND c.zone = $1' : ''}
      ORDER BY tc.missed_at DESC
    `, isGudoomiye ? [req.user.zone] : []);
    res.json(result.rows);
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

    // Geofence check: is this ping inside the zone this task's route is dispatched to? Only
    // fires an alert on the inside->outside transition (not on every 15s ping while still
    // outside), and only for zones that actually have a drawn boundary — a zone with no polygon
    // has nothing to check against.
    try {
      const taskId = parseInt(req.params.id);
      const taskRow = await db.query('SELECT route_name FROM tasks WHERE id = $1', [taskId]);
      const routeName = taskRow.rows[0]?.route_name;
      if (routeName) {
        const zoneRow = await db.query('SELECT id, coordinates FROM zones WHERE name = $1', [routeName]);
        const zone = zoneRow.rows[0];
        if (zone && zone.coordinates && zone.coordinates.length >= 3) {
          const inside = isPointInPolygon([parseFloat(lat), parseFloat(lng)], zone.coordinates);
          const wasOutside = geofenceState.get(taskId) === true;
          if (!inside && !wasOutside) {
            geofenceState.set(taskId, true);
            await db.query(
              `INSERT INTO geofence_events (task_id, zone_id, event_type, lat, lng) VALUES ($1, $2, 'exit', $3, $4)`,
              [taskId, zone.id, lat, lng]
            );
            await db.query(
              `INSERT INTO notifications (user_id, title, message) VALUES (1, 'Geofence Alert', $1)`,
              [`Task #${taskId} left its assigned zone (${routeName})`]
            );
            io.emit('geofence_alert', { taskId, zoneId: zone.id, zoneName: routeName, lat: parseFloat(lat), lng: parseFloat(lng) });
          } else if (inside && wasOutside) {
            geofenceState.set(taskId, false);
            await db.query(
              `INSERT INTO geofence_events (task_id, zone_id, event_type, lat, lng) VALUES ($1, $2, 'enter', $3, $4)`,
              [taskId, zone.id, lat, lng]
            );
          }
        }
      }
    } catch (geoErr) {
      console.error('[Geofence] check failed:', geoErr.message);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Geofence Events (Phase 6) — read-only history of zone-boundary crossings ---
app.get('/api/geofence-events', checkRole(['admin', 'gudoomiye', 'zone_accountant']), async (req, res) => {
  try {
    const { restricted, zone } = getZoneScope(req);
    const result = await db.query(`
      SELECT ge.*, t.route_name, t.collector_name, t.driver_name, t.vehicle_plate, z.name as zone_name
      FROM geofence_events ge
      JOIN tasks t ON ge.task_id = t.id
      LEFT JOIN zones z ON ge.zone_id = z.id
      ${restricted ? 'WHERE t.route_name = $1' : ''}
      ORDER BY ge.created_at DESC
      LIMIT 200
    `, restricted ? [zone] : []);
    res.json(result.rows);
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
  const { plate_number, model, driver_id, collector_id, insurance_expiry, registration_expiry, road_tax_expiry } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO trucks (plate_number, model, driver_id, collector_id, insurance_expiry, registration_expiry, road_tax_expiry) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [plate_number, model, driver_id || null, collector_id || null, insurance_expiry || null, registration_expiry || null, road_tax_expiry || null]
    );
    await logAudit(req, 'CREATE', 'trucks', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trucks/:id', checkRole(['admin']), async (req, res) => {
  try {
    const { plate_number, model, status, driver_id, collector_id, insurance_expiry, registration_expiry, road_tax_expiry } = req.body;
    const oldRow = await db.query('SELECT * FROM trucks WHERE id = $1', [req.params.id]);
    const result = await db.query(
      `UPDATE trucks SET plate_number = $1, model = $2, status = $3, driver_id = $4, collector_id = $5,
        insurance_expiry = $6, registration_expiry = $7, road_tax_expiry = $8 WHERE id = $9 RETURNING *`,
      [plate_number, model, status || 'Active', driver_id || null, collector_id || null,
       insurance_expiry || null, registration_expiry || null, road_tax_expiry || null, req.params.id]
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
app.get('/api/leave-requests', requirePermission('employees', 'view'), async (req, res) => {
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

app.post('/api/leave-requests', requirePermission('employees', 'create'), async (req, res) => {
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

app.put('/api/leave-requests/:id/status', requirePermission('employees', 'approve'), async (req, res) => {
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

// --- Employee Advances (Phase 3) ---
app.get('/api/employee-advances', requirePermission('employees', 'view'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, e.name as employee_name, e.role as employee_role
      FROM employee_advances a
      JOIN employees e ON a.employee_id = e.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employee-advances', requirePermission('employees', 'create'), async (req, res) => {
  const { employee_id, amount, reason, repayment_period } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO employee_advances (employee_id, amount, reason, repayment_period) VALUES ($1, $2, $3, $4) RETURNING *',
      [employee_id, amount, reason, repayment_period]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employee-advances/:id/status', requirePermission('employees', 'approve'), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE employee_advances SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Employee Expense Claims (Phase 3) — reimbursement requests, distinct from company `expenses` ---
app.get('/api/expense-claims', requirePermission('employees', 'view'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, e.name as employee_name, e.role as employee_role
      FROM expense_claims c
      JOIN employees e ON c.employee_id = e.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expense-claims', requirePermission('employees', 'create'), upload.single('receipt_image'), async (req, res) => {
  const { employee_id, category, amount, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO expense_claims (employee_id, category, amount, description, receipt_image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employee_id, category, amount, description, req.file ? req.file.filename : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expense-claims/:id/status', requirePermission('employees', 'approve'), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE expense_claims SET status = $1 WHERE id = $2 RETURNING *',
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

// Admin manual correction — a collector who forgot to clock in/out, or a wrong photo/time,
// otherwise has no fix short of editing the database directly. Either field is optional so a
// partial correction (e.g. only clock_out was missed) doesn't require re-sending both.
app.put('/api/attendance/:id', checkRole(['admin']), async (req, res) => {
  const { clock_in, clock_out } = req.body;
  try {
    const existing = await db.query('SELECT * FROM attendance WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Attendance record not found' });
    const result = await db.query(
      'UPDATE attendance SET clock_in = COALESCE($1, clock_in), clock_out = COALESCE($2, clock_out) WHERE id = $3 RETURNING *',
      [clock_in || null, clock_out || null, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'attendance', result.rows[0].id, existing.rows[0], result.rows[0]);
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
      // Attendance is not auto-deducted from pay (that risks wrongly shortchanging someone -
      // e.g. approved leave isn't tracked as attendance yet). Instead, flag it for manual review.
      const baseSalary = emp.salary || 0;
      const netSalary = baseSalary;
      const [year, monthNum] = month.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const needsReview = daysPresent < daysInMonth;
      const suggestedNote = needsReview
        ? `Attended ${daysPresent}/${daysInMonth} days this month — review before paying`
        : null;

      const payrollResult = await db.query(`
        INSERT INTO payroll (employee_id, month, base_salary, total_days_present, net_salary, needs_review, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (employee_id, month)
        DO UPDATE SET
          base_salary = EXCLUDED.base_salary,
          total_days_present = EXCLUDED.total_days_present,
          net_salary = EXCLUDED.net_salary,
          needs_review = EXCLUDED.needs_review,
          notes = COALESCE(payroll.notes, EXCLUDED.notes)
        RETURNING *
      `, [emp.id, month, baseSalary, daysPresent, netSalary, needsReview, suggestedNote]);

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
app.get('/api/stats', checkRole(['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant']), async (req, res) => {
  try {
    const isGudoomiye = ['gudoomiye', 'zone_accountant'].includes(req.user.role.toLowerCase());
    const zone = req.user.zone;

    const revenueRes = isGudoomiye
      ? await db.query("SELECT SUM(i.amount) FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.status = 'Paid' AND c.zone = $1", [zone])
      : await db.query("SELECT SUM(amount) FROM invoices WHERE status = 'Paid'");
    const customersRes = isGudoomiye
      ? await db.query("SELECT COUNT(*) FROM customers WHERE zone = $1", [zone])
      : await db.query("SELECT COUNT(*) FROM customers");
    // A collector's "Tasks Completed" must mean their own completed tasks, and a gudoomiye's
    // must mean their own zone's — not the whole system's, otherwise every dashboard shows the
    // same misleading company-wide number. tasks.route_name carries the zone group label
    // (e.g. "Group1"), the same value stored on req.user.zone.
    const isCollector = req.user.role.toLowerCase() === 'collector';
    let tasksRes;
    if (isCollector) {
      const meRow = await db.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
      const myName = meRow.rows[0]?.full_name || req.user.username || '';
      tasksRes = await db.query(
        "SELECT COUNT(*) FROM tasks WHERE status = 'Completed' AND LOWER(TRIM(collector_name)) = LOWER(TRIM($1))",
        [myName]
      );
    } else if (isGudoomiye) {
      tasksRes = await db.query(
        "SELECT COUNT(*) FROM tasks WHERE status = 'Completed' AND route_name = $1",
        [zone]
      );
    } else {
      tasksRes = await db.query("SELECT COUNT(*) FROM tasks WHERE status = 'Completed'");
    }

    // Expenses (fuel, salaries, etc.) have no per-zone attribution in the schema — showing the
    // whole company's expense total on a zone manager's dashboard would be misleading, so a
    // gudoomiye instead gets a stat that actually reflects their own zone: unpaid customers.
    let totalExpenses = 0;
    let zonePendingCustomers = 0;
    if (isGudoomiye) {
      const pendingRes = await db.query(
        "SELECT COUNT(*) FROM customers WHERE zone = $1 AND payment_status = 'Unpaid'",
        [zone]
      );
      zonePendingCustomers = parseInt(pendingRes.rows[0].count || 0);
    } else {
      const expensesRes = await db.query("SELECT SUM(amount) FROM expenses");
      totalExpenses = parseFloat(expensesRes.rows[0].sum || 0);
    }

    res.json({
      revenue: parseFloat(revenueRes.rows[0].sum || 0),
      customerCount: parseInt(customersRes.rows[0].count || 0),
      tasksCompleted: parseInt(tasksRes.rows[0].count || 0),
      totalExpenses,
      zonePendingCustomers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/history', checkRole(['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant']), async (req, res) => {
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
app.get('/api/dashboard/extended', checkRole(['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant']), async (req, res) => {
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

// Dashboard "Zone Performance": per-zone customer count, how many were served (collected) today,
// and how much revenue that zone brought in today — plus the full per-customer breakdown so the
// dashboard can drill into a zone without a second round-trip. Gudoomiye/Zone Accountant only
// ever see their own zone (same restriction pattern as getZoneScope everywhere else).
app.get('/api/dashboard/zone-performance', checkRole(['admin', 'gudoomiye', 'zone_accountant']), async (req, res) => {
  try {
    const { restricted, zone: scopedZone } = getZoneScope(req);

    const aggRes = await db.query(`
      SELECT
        z.id, z.name,
        COALESCE(cc.customer_count, 0)::int AS customer_count,
        COALESCE(st.served_today, 0)::int AS served_today,
        COALESCE(rt.revenue_today, 0)::numeric AS revenue_today
      FROM zones z
      LEFT JOIN (
        SELECT zone, COUNT(*) AS customer_count FROM customers GROUP BY zone
      ) cc ON cc.zone = z.name
      LEFT JOIN (
        SELECT c.zone, COUNT(DISTINCT tc.customer_id) AS served_today
        FROM task_customers tc
        JOIN customers c ON c.id = tc.customer_id
        WHERE tc.collected = true AND tc.collected_at::date = CURRENT_DATE
        GROUP BY c.zone
      ) st ON st.zone = z.name
      LEFT JOIN (
        SELECT c.zone, SUM(i.amount) AS revenue_today
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.created_at::date = CURRENT_DATE
        GROUP BY c.zone
      ) rt ON rt.zone = z.name
      ${restricted ? 'WHERE z.name = $1' : ''}
      ORDER BY z.name
    `, restricted ? [scopedZone] : []);

    const custRes = await db.query(`
      SELECT c.id, c.name, c.phone, c.house_no, c.zone, c.status, e.name AS collector_name,
        EXISTS (
          SELECT 1 FROM task_customers tc
          WHERE tc.customer_id = c.id AND tc.collected = true AND tc.collected_at::date = CURRENT_DATE
        ) AS collected_today
      FROM customers c
      LEFT JOIN employees e ON c.collector_id = e.id
      ${restricted ? 'WHERE c.zone = $1' : ''}
      ORDER BY c.name
    `, restricted ? [scopedZone] : []);

    const customersByZone = {};
    for (const c of custRes.rows) {
      (customersByZone[c.zone] = customersByZone[c.zone] || []).push(c);
    }

    const zones = aggRes.rows.map(z => ({
      ...z,
      customers: customersByZone[z.name] || []
    }));

    res.json(zones);
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

// Issues stock OUT to a department/employee — the counterpart to a PO's "Received" stock IN.
// This is the last gap from the master proposal's Inventory pages (Stock In/Stock Out/Stock
// Movement): every quantity decrease is now logged the same way every increase already is.
app.post('/api/inventory/:id/stock-out', checkRole(['admin']), async (req, res) => {
  const { quantity, department, employee_id, reason } = req.body;
  const qty = parseInt(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive number' });
  try {
    const itemRes = await db.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (qty > item.quantity) return res.status(400).json({ error: `Only ${item.quantity} ${item.unit} in stock` });

    const newQty = item.quantity - qty;
    const updated = await db.query(
      'UPDATE inventory SET quantity = $1, status = $2 WHERE id = $3 RETURNING *',
      [newQty, newQty <= 0 ? 'Out of Stock' : newQty < 10 ? 'Low Stock' : 'In Stock', req.params.id]
    );

    const refParts = [department, reason].filter(Boolean);
    const reference = refParts.length ? refParts.join(' — ') : 'Manual stock-out';
    await db.query(
      `INSERT INTO stock_movements (inventory_id, type, quantity, reference, created_by) VALUES ($1, 'out', $2, $3, $4)`,
      [req.params.id, qty, reference, req.user.id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Suppliers (Phase 4) ---
app.get('/api/suppliers', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', checkRole(['admin']), async (req, res) => {
  const { name, contact, category, status } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO suppliers (name, contact, category, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, contact || null, category || null, status || 'Active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/suppliers/:id', checkRole(['admin']), async (req, res) => {
  const { name, contact, category, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE suppliers SET name = $1, contact = $2, category = $3, status = $4 WHERE id = $5 RETURNING *',
      [name, contact, category, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/suppliers/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Assets (Phase 4) ---
app.get('/api/assets', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, e.name as assigned_employee_name
      FROM assets a
      LEFT JOIN employees e ON a.assigned_employee_id = e.id
      ORDER BY a.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assets', checkRole(['admin']), async (req, res) => {
  const { name, category, serial_number, value, location, assigned_employee_id, condition, status } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO assets (name, category, serial_number, value, location, assigned_employee_id, condition, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category || null, serial_number || null, value || 0, location || null, assigned_employee_id || null, condition || 'Good', status || 'Active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/assets/:id', checkRole(['admin']), async (req, res) => {
  const { name, category, serial_number, value, location, assigned_employee_id, condition, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE assets SET name = $1, category = $2, serial_number = $3, value = $4, location = $5,
        assigned_employee_id = $6, condition = $7, status = $8 WHERE id = $9 RETURNING *`,
      [name, category, serial_number, value, location, assigned_employee_id || null, condition, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/assets/:id', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM assets WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Purchase Requests (Phase 4 completion) ---
app.get('/api/purchase-requests', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pr.*, u.full_name as requested_by_name, a.full_name as approved_by_name
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN users a ON pr.approved_by = a.id
      ORDER BY pr.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase-requests', checkRole(['admin']), async (req, res) => {
  const { department, item_name, quantity, estimated_price, reason } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO purchase_requests (requested_by, department, item_name, quantity, estimated_price, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, department || null, item_name, quantity || 1, estimated_price || 0, reason || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-requests/:id/status', checkRole(['admin']), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE purchase_requests SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *',
      [status, req.user.id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Purchase Orders (Phase 4 completion) ---
app.get('/api/purchase-orders', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase-orders', checkRole(['admin']), async (req, res) => {
  const { purchase_request_id, supplier_id, item_name, quantity, unit_price } = req.body;
  try {
    const qty = parseInt(quantity) || 1;
    const price = parseFloat(unit_price) || 0;
    const result = await db.query(
      `INSERT INTO purchase_orders (purchase_request_id, supplier_id, item_name, quantity, unit_price, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [purchase_request_id || null, supplier_id || null, item_name, qty, price, qty * price, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marking a PO "Received" is the one action that actually moves inventory — it upserts the
// matching inventory item (matched by item_name, case-insensitive) by the ordered quantity and
// writes a stock_movements row so the increase is traceable back to this exact PO.
app.put('/api/purchase-orders/:id/receive', checkRole(['admin']), async (req, res) => {
  try {
    const poRes = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    const po = poRes.rows[0];
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'Received') return res.status(400).json({ error: 'This purchase order was already received' });

    let invRes = await db.query('SELECT * FROM inventory WHERE LOWER(item_name) = LOWER($1)', [po.item_name]);
    let inventoryItem;
    if (invRes.rows.length > 0) {
      inventoryItem = invRes.rows[0];
      const newQty = parseInt(inventoryItem.quantity || 0) + po.quantity;
      const updated = await db.query(
        `UPDATE inventory SET quantity = $1, status = $2 WHERE id = $3 RETURNING *`,
        [newQty, newQty < 10 ? 'Low Stock' : 'In Stock', inventoryItem.id]
      );
      inventoryItem = updated.rows[0];
    } else {
      const created = await db.query(
        `INSERT INTO inventory (item_name, quantity, unit, price_per_unit, status) VALUES ($1, $2, 'Pcs', $3, $4) RETURNING *`,
        [po.item_name, po.quantity, po.unit_price, po.quantity < 10 ? 'Low Stock' : 'In Stock']
      );
      inventoryItem = created.rows[0];
    }

    await db.query(
      `INSERT INTO stock_movements (inventory_id, type, quantity, reference, purchase_order_id, created_by)
       VALUES ($1, 'in', $2, $3, $4, $5)`,
      [inventoryItem.id, po.quantity, `Received from PO #${po.id}`, po.id, req.user.id]
    );

    const result = await db.query(
      `UPDATE purchase_orders SET status = 'Received', received_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ purchaseOrder: result.rows[0], inventoryItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-orders/:id/cancel', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE purchase_orders SET status = 'Cancelled' WHERE id = $1 AND status != 'Received' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Cannot cancel a received purchase order' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stock Movements (Phase 4 completion) — read-only ledger ---
app.get('/api/stock-movements', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sm.*, i.item_name, u.full_name as created_by_name
      FROM stock_movements sm
      JOIN inventory i ON sm.inventory_id = i.id
      LEFT JOIN users u ON sm.created_by = u.id
      ORDER BY sm.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DOCUMENTS & FINANCIAL DOCUMENTS MODULE
// Consolidates the proposal's Invoices/Receipts/Contracts/Licenses/etc. pages into one
// categorized, versioned document record with a Draft -> Review -> Approve -> Sign -> Archive
// workflow. "Sign" here records an attestation (signer name + date + optional evidence file),
// not a cryptographic e-signature — see esign_provider/esign_envelope_id, reserved for wiring in
// DocuSign/HelloSign once real API credentials exist.
// ============================================================

const VALID_DOC_STATUSES = ['Draft', 'Pending Review', 'Approved', 'Pending Signature', 'Signed', 'Archived'];

app.get('/api/documents', checkRole(['admin']), async (req, res) => {
  const { category, status, search, related_customer_id, related_employee_id, related_supplier_id, related_truck_id } = req.query;
  try {
    const clauses = [];
    const params = [];
    if (category) { params.push(category); clauses.push(`d.category = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`d.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); clauses.push(`(d.title ILIKE $${params.length} OR d.document_type ILIKE $${params.length})`); }
    if (related_customer_id) { params.push(related_customer_id); clauses.push(`d.related_customer_id = $${params.length}`); }
    if (related_employee_id) { params.push(related_employee_id); clauses.push(`d.related_employee_id = $${params.length}`); }
    if (related_supplier_id) { params.push(related_supplier_id); clauses.push(`d.related_supplier_id = $${params.length}`); }
    if (related_truck_id) { params.push(related_truck_id); clauses.push(`d.related_truck_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT d.*,
        c.name as customer_name, e.name as employee_name, s.name as supplier_name, t.plate_number as truck_plate,
        cu.full_name as created_by_name, au.full_name as approved_by_name
      FROM documents d
      LEFT JOIN customers c ON d.related_customer_id = c.id
      LEFT JOIN employees e ON d.related_employee_id = e.id
      LEFT JOIN suppliers s ON d.related_supplier_id = s.id
      LEFT JOIN trucks t ON d.related_truck_id = t.id
      LEFT JOIN users cu ON d.created_by = cu.id
      LEFT JOIN users au ON d.approved_by = au.id
      ${where}
      ORDER BY d.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/expiring', checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, category, document_type, expiry_date
      FROM documents
      WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND status != 'Archived'
      ORDER BY expiry_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/versions', checkRole(['admin']), async (req, res) => {
  try {
    // Walk up to the root of the version chain, then return every version under it.
    let rootId = req.params.id;
    let current = await db.query('SELECT parent_document_id FROM documents WHERE id = $1', [rootId]);
    while (current.rows[0]?.parent_document_id) {
      rootId = current.rows[0].parent_document_id;
      current = await db.query('SELECT parent_document_id FROM documents WHERE id = $1', [rootId]);
    }
    const result = await db.query(
      `WITH RECURSIVE chain AS (
         SELECT * FROM documents WHERE id = $1
         UNION ALL
         SELECT d.* FROM documents d JOIN chain c ON d.parent_document_id = c.id
       )
       SELECT id, title, version, status, created_at FROM chain ORDER BY version ASC`,
      [rootId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', checkRole(['admin']), uploadDocument.single('file'), async (req, res) => {
  const { title, category, document_type, related_customer_id, related_employee_id, related_supplier_id, related_truck_id, expiry_date } = req.body;
  if (!title || !category) return res.status(400).json({ error: 'Title and category are required' });
  try {
    const result = await db.query(
      `INSERT INTO documents
        (title, category, document_type, related_customer_id, related_employee_id, related_supplier_id, related_truck_id,
         file_path, expiry_date, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft') RETURNING *`,
      [
        title, category, document_type || null,
        related_customer_id || null, related_employee_id || null, related_supplier_id || null, related_truck_id || null,
        req.file ? req.file.filename : null, expiry_date || null, req.user.id
      ]
    );
    await logAudit(req, 'CREATE', 'documents', result.rows[0].id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id', checkRole(['admin']), uploadDocument.single('file'), async (req, res) => {
  const { title, document_type, expiry_date } = req.body;
  try {
    const oldRow = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const filePath = req.file ? req.file.filename : oldRow.rows[0].file_path;
    const result = await db.query(
      `UPDATE documents SET title = COALESCE($1, title), document_type = $2, expiry_date = $3, file_path = $4 WHERE id = $5 RETURNING *`,
      [title || null, document_type || null, expiry_date || null, filePath, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'documents', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workflow transition — validated against VALID_DOC_STATUSES but the actual "who can move it
// where" business rule is deliberately loose (admin can move it any direction) since this
// module has one role (admin) using it today; per-step approval-role separation is a natural
// extension once other roles start using Documents.
app.put('/api/documents/:id/status', checkRole(['admin']), async (req, res) => {
  const { status } = req.body;
  if (!VALID_DOC_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const oldRow = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const isApproving = status === 'Approved' && oldRow.rows[0].status !== 'Approved';
    const result = await db.query(
      `UPDATE documents SET status = $1, approved_by = CASE WHEN $2 THEN $3 ELSE approved_by END,
        approved_at = CASE WHEN $2 THEN NOW() ELSE approved_at END
       WHERE id = $4 RETURNING *`,
      [status, isApproving, req.user.id, req.params.id]
    );
    await logAudit(req, 'STATUS_CHANGE', 'documents', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Records that a document was signed — NOT a cryptographic e-signature (see module note above).
app.post('/api/documents/:id/sign', checkRole(['admin']), async (req, res) => {
  const { signed_by } = req.body;
  if (!signed_by || !signed_by.trim()) return res.status(400).json({ error: 'Signer name is required' });
  try {
    const oldRow = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const result = await db.query(
      `UPDATE documents SET status = 'Signed', signed_by = $1, signed_at = NOW() WHERE id = $2 RETURNING *`,
      [signed_by.trim(), req.params.id]
    );
    await logAudit(req, 'SIGN', 'documents', req.params.id, oldRow.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creates a new version linked to the previous one — the old row is left untouched (so its
// history stays intact), the new row starts back at 'Draft'.
app.post('/api/documents/:id/new-version', checkRole(['admin']), uploadDocument.single('file'), async (req, res) => {
  try {
    const prevRes = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    const prev = prevRes.rows[0];
    if (!prev) return res.status(404).json({ error: 'Document not found' });
    const result = await db.query(
      `INSERT INTO documents
        (title, category, document_type, related_customer_id, related_employee_id, related_supplier_id, related_truck_id,
         file_path, expiry_date, created_by, status, version, parent_document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft', $11, $12) RETURNING *`,
      [
        prev.title, prev.category, prev.document_type,
        prev.related_customer_id, prev.related_employee_id, prev.related_supplier_id, prev.related_truck_id,
        req.file ? req.file.filename : prev.file_path, prev.expiry_date, req.user.id,
        prev.version + 1, prev.id
      ]
    );
    await logAudit(req, 'NEW_VERSION', 'documents', result.rows[0].id, prev, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', checkRole(['admin']), async (req, res) => {
  try {
    const oldRow = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    await logAudit(req, 'DELETE', 'documents', req.params.id, oldRow.rows[0], null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Debts (Daymaha) ---
app.get('/api/debts', checkRole(['admin', 'cashier', 'gudoomiye', 'zone_accountant']), async (req, res) => {
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
    const rows = ['gudoomiye', 'zone_accountant'].includes(req.user.role.toLowerCase())
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
app.get('/api/cashouts', requirePermission('cashout', 'view'), async (req, res) => {
  try {
    const { restricted: isGudoomiye } = getZoneScope(req);
    const result = await db.query(
      isGudoomiye ? 'SELECT * FROM cashouts WHERE zone = $1 ORDER BY created_at DESC' : 'SELECT * FROM cashouts ORDER BY created_at DESC',
      isGudoomiye ? [req.user.zone] : []
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cashouts', requirePermission('cashout', 'create'), async (req, res) => {
  const { collector_name, cashier_name, expected_amount, actual_amount, zaad_amount, edahab_amount, cash_amount, slsh_amount, shortage, reason, processed_by, zone } = req.body;

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
      'INSERT INTO cashouts (collector_name, cashier_name, expected_amount, actual_amount, zaad_amount, edahab_amount, cash_amount, slsh_amount, shortage, reason, processed_by, zone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [
        collector_name,
        cashier_name || null,
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

// A cashout is a money-reconciliation record — mis-entered numbers need a correction path, not
// just a permanent mistake. Edit and void (hard-delete here, since a cashout has no downstream
// "Paid" status like invoices to quietly flip) are admin-only regardless of who created it.
app.put('/api/cashouts/:id', checkRole(['admin']), async (req, res) => {
  const { expected_amount, actual_amount, zaad_amount, edahab_amount, cash_amount, slsh_amount, shortage, reason } = req.body;
  try {
    const existing = await db.query('SELECT * FROM cashouts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Cashout not found' });
    if (existing.rows[0].status === 'Approved') {
      return res.status(400).json({ error: 'Cannot edit an approved cashout — it is a finalized financial record' });
    }
    const result = await db.query(
      `UPDATE cashouts SET expected_amount = $1, actual_amount = $2, zaad_amount = $3, edahab_amount = $4,
        cash_amount = $5, slsh_amount = $6, shortage = $7, reason = $8 WHERE id = $9 RETURNING *`,
      [expected_amount, actual_amount, zaad_amount || 0, edahab_amount || 0, cash_amount || 0, slsh_amount || 0, shortage || 0, reason || null, req.params.id]
    );
    await logAudit(req, 'UPDATE', 'cashouts', result.rows[0].id, existing.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cashouts/:id', checkRole(['admin']), async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM cashouts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Cashout not found' });
    // A Gudoomiye-approved cashout is a finalized financial record — deletable while still
    // Pending/Rejected (correcting a mistake before it's closed), but not once approved.
    if (existing.rows[0].status === 'Approved') {
      return res.status(400).json({ error: 'Cannot delete an approved cashout — it is a finalized financial record' });
    }
    await db.query('DELETE FROM cashouts WHERE id = $1', [req.params.id]);
    await logAudit(req, 'DELETE', 'cashouts', req.params.id, existing.rows[0], null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Physical signature step: after the cashout slip is printed and signed on paper by both the
// cashier and the Gudoomiye, the scanned/photographed copy is uploaded here as proof — required
// before the Gudoomiye can approve the cashout (see the check in the approve route below).
app.put('/api/cashouts/:id/upload-signed', requirePermission('cashout', 'create'), uploadDocument.single('signed_document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const existing = await db.query('SELECT * FROM cashouts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Cashout not found' });
    const result = await db.query(
      'UPDATE cashouts SET signed_document = $1 WHERE id = $2 RETURNING *',
      [req.file.filename, req.params.id]
    );
    await logAudit(req, 'UPLOAD_SIGNED', 'cashouts', result.rows[0].id, existing.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gudoomiye (or admin) approval — the actual "Chairman Cashout Approval" step from the proposal.
// Blocked until the signed paper has been uploaded, so the digital approval always has a
// physical signature behind it, not just a database click.
app.put('/api/cashouts/:id/approve', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM cashouts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Cashout not found' });
    const cashout = existing.rows[0];
    if (req.user.role.toLowerCase() === 'gudoomiye' && cashout.zone !== req.user.zone) {
      return res.status(403).json({ error: 'This cashout is outside your zone' });
    }
    if (!cashout.signed_document) {
      return res.status(400).json({ error: 'Upload the signed cashout slip before approving' });
    }
    const result = await db.query(
      "UPDATE cashouts SET status = 'Approved', approved_by = $1, approved_at = NOW(), rejection_reason = NULL WHERE id = $2 RETURNING *",
      [req.user.id, req.params.id]
    );
    await logAudit(req, 'APPROVE', 'cashouts', result.rows[0].id, cashout, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cashouts/:id/reject', checkRole(['admin', 'gudoomiye']), async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'A reason is required to reject a cashout' });
  try {
    const existing = await db.query('SELECT * FROM cashouts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Cashout not found' });
    const cashout = existing.rows[0];
    if (req.user.role.toLowerCase() === 'gudoomiye' && cashout.zone !== req.user.zone) {
      return res.status(403).json({ error: 'This cashout is outside your zone' });
    }
    const result = await db.query(
      "UPDATE cashouts SET status = 'Rejected', approved_by = $1, approved_at = NOW(), rejection_reason = $2 WHERE id = $3 RETURNING *",
      [req.user.id, reason.trim(), req.params.id]
    );
    await logAudit(req, 'REJECT', 'cashouts', result.rows[0].id, cashout, result.rows[0]);
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
app.put('/api/customers/:id/location', checkRole(['admin', 'cashier', 'collector']), async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  try {
    const result = await db.query(
      'UPDATE customers SET lat = $1, lng = $2 WHERE id = $3 RETURNING *',
      [lat, lng, id]
    );
    if (result.rows[0] && result.rows[0].lat && result.rows[0].lng) {
      io.emit('customer_location_updated', { customer: result.rows[0] });
    }
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

app.post('/api/complaints', checkRole(['admin', 'cashier']), upload.single('photo'), async (req, res) => {
  const { customer_id, title, description, priority, assigned_to } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO complaints (customer_id, title, description, priority, assigned_to, photo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [customer_id, title, description, priority || 'Medium', assigned_to || null, req.file ? req.file.filename : null]
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
    const complaint = result.rows[0];
    if (complaint?.customer_id) {
      db.query('INSERT INTO customer_notifications (customer_id, title, message) VALUES ($1, $2, $3)',
        [complaint.customer_id, 'Cabashadaada waa la cusboonaysiiyay',
         `Xaaladda "${complaint.title}": ${status}`]
      ).catch(err => console.error('[Portal Notification] Complaint notification failed:', err.message));
    }
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Two-way reply: staff writes a message the customer sees under their complaint in the Portal
// (separate from status, since a status badge alone doesn't tell the customer *what* happened).
app.put('/api/complaints/:id/reply', checkRole(['admin', 'cashier']), async (req, res) => {
  const { reply } = req.body;
  if (!reply || !reply.trim()) return res.status(400).json({ error: 'Reply cannot be empty' });
  try {
    const result = await db.query(
      'UPDATE complaints SET admin_reply = $1, replied_at = NOW() WHERE id = $2 RETURNING *',
      [reply.trim(), req.params.id]
    );
    const complaint = result.rows[0];
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.customer_id) {
      db.query('INSERT INTO customer_notifications (customer_id, title, message) VALUES ($1, $2, $3)',
        [complaint.customer_id, 'Cabashadaada waa laga jawaabay', reply.trim()]
      ).catch(err => console.error('[Portal Notification] Complaint reply notification failed:', err.message));
    }
    res.json(complaint);
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
app.post('/api/users/:id/reset-2fa', checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1', [id]);
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

    // NOTE: OSRM_BASE_URL defaults to OSRM's free public demo server, which has no uptime
    // guarantee and can rate-limit or block traffic without notice - it is explicitly meant
    // for testing, not production use. Set OSRM_BASE_URL in the environment to point this at
    // a paid or self-hosted OSRM instance once one is available.
    const osrmBase = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const osrmUrl = `${osrmBase}/trip/v1/driving/${coordinatesString}?roundtrip=true&source=first&geometries=geojson`;

    let osrmData;
    try {
      const osrmResponse = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
      osrmData = await osrmResponse.json();
    } catch (fetchErr) {
      const timedOut = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError';
      return res.status(503).json({
        error: timedOut
          ? 'Route optimization service timed out. It runs on a public demo server with no uptime guarantee - try again shortly.'
          : 'Route optimization service is unreachable right now.'
      });
    }

    if (osrmData.code !== 'Ok') {
      return res.status(502).json({ error: 'Route optimization service could not compute a route: ' + osrmData.code });
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

// Proxies the live truck-animation routing calls (getRoute/snapToRoad) through the backend so
// they share the same OSRM_BASE_URL/timeout handling as /api/optimize-route above, instead of the
// browser calling the public OSRM demo server directly. That direct browser call was the cause of
// trucks appearing to drive in straight lines across blocks/houses on the Operations Map: the
// public demo server frequently rate-limits or fails from a browser origin, silently falling back
// to a straight line between two points with no road-following at all.
app.get('/api/route', authenticateToken, async (req, res) => {
  const { start, end } = req.query; // "lat,lng"
  if (!start || !end) return res.status(400).json({ error: 'start and end are required' });
  try {
    const [sLat, sLng] = start.split(',').map(Number);
    const [eLat, eLng] = end.split(',').map(Number);
    if ([sLat, sLng, eLat, eLng].some(isNaN)) return res.status(400).json({ error: 'invalid coordinates' });

    const osrmBase = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const osrmUrl = `${osrmBase}/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`;
    const r = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return res.json({ success: true, coordinates: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]) });
    }
    res.json({ success: false });
  } catch (err) {
    res.json({ success: false });
  }
});

app.get('/api/snap-to-road', authenticateToken, async (req, res) => {
  const { lat, lng } = req.query;
  const latNum = parseFloat(lat), lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ error: 'invalid coordinates' });
  try {
    const osrmBase = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const osrmUrl = `${osrmBase}/nearest/v1/driving/${lngNum},${latNum}?number=1`;
    const r = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
      const snapped = data.waypoints[0].location;
      return res.json({ success: true, lat: snapped[1], lng: snapped[0] });
    }
    res.json({ success: false });
  } catch (err) {
    res.json({ success: false });
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

// --- Route Optimization Endpoint ---

// Proactive daily digest — a single WhatsApp message to whichever number is set as
// `alert_phone` in Settings, covering the things an admin would otherwise only notice by
// opening the app: zones with zero collections today, low/out-of-stock inventory, debts that
// have aged past 60 days, and unresolved complaints. Runs once a day (see cron.schedule below)
// and is also reachable on demand via POST /api/admin/send-digest-now for testing.
// `overridePhone` lets the "Send Test Digest Now" button use whatever number is currently
// typed into the Settings field, even if the admin hasn't hit Save yet — otherwise the test
// button would confusingly fail with "No alert_phone configured" right after typing one in.
const buildAndSendDailyDigest = async (overridePhone) => {
  let alertPhone = overridePhone;
  if (!alertPhone) {
    const settingsRes = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'alert_phone'");
    alertPhone = settingsRes.rows[0]?.setting_value;
  }
  if (!alertPhone) return { sent: false, reason: 'No alert_phone configured in Settings' };

  const zoneRes = await db.query(`
    SELECT z.name,
      COALESCE(cc.customer_count, 0)::int AS customer_count,
      COALESCE(rt.revenue_today, 0)::numeric AS revenue_today
    FROM zones z
    LEFT JOIN (SELECT zone, COUNT(*) AS customer_count FROM customers GROUP BY zone) cc ON cc.zone = z.name
    LEFT JOIN (
      SELECT c.zone, SUM(i.amount) AS revenue_today FROM invoices i
      JOIN customers c ON c.id = i.customer_id WHERE i.created_at::date = CURRENT_DATE GROUP BY c.zone
    ) rt ON rt.zone = z.name
  `);
  const quietZones = zoneRes.rows.filter(z => z.customer_count > 0 && parseFloat(z.revenue_today) === 0);

  const stockRes = await db.query("SELECT item_name, quantity, status FROM inventory WHERE status IN ('Low Stock', 'Out of Stock') ORDER BY quantity ASC");

  const oldDebtsRes = await db.query(`
    SELECT debtor_name, amount, currency FROM debts
    WHERE status = 'Unpaid' AND created_at <= NOW() - INTERVAL '60 days'
    ORDER BY created_at ASC
  `);

  const complaintsRes = await db.query("SELECT COUNT(*) FROM complaints WHERE status != 'Resolved'");
  const pendingComplaints = parseInt(complaintsRes.rows[0]?.count || 0);

  const lines = [`*Gurmad — Daily Digest* (${new Date().toLocaleDateString()})`, ''];

  lines.push(quietZones.length > 0
    ? `⚠️ *${quietZones.length} zone(s) with $0 collected today:* ${quietZones.map(z => z.name).join(', ')}`
    : `✅ Every active zone has collected something today.`);

  lines.push(stockRes.rows.length > 0
    ? `📦 *${stockRes.rows.length} inventory item(s) low/out of stock:* ${stockRes.rows.map(s => `${s.item_name} (${s.quantity})`).join(', ')}`
    : `📦 Inventory levels are healthy.`);

  lines.push(oldDebtsRes.rows.length > 0
    ? `💰 *${oldDebtsRes.rows.length} debt(s) unpaid for 60+ days*, totaling $${oldDebtsRes.rows.filter(d => d.currency === 'USD').reduce((s, d) => s + parseFloat(d.amount), 0).toFixed(2)}`
    : `💰 No debts older than 60 days.`);

  lines.push(pendingComplaints > 0
    ? `📣 *${pendingComplaints} customer complaint(s)* still unresolved.`
    : `📣 No pending complaints.`);

  const message = lines.join('\n');
  await sendWhatsAppSafe(alertPhone, message);
  return { sent: true, message };
};

app.post('/api/admin/send-digest-now', checkRole(['admin']), async (req, res) => {
  try {
    const result = await buildAndSendDailyDigest(req.body?.phone);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fires once a day at 18:00 server time — end of a typical collection day, so the "$0 collected
// today" check is meaningful rather than firing at 8am before anyone's been out yet.
cron.schedule('0 18 * * *', () => {
  buildAndSendDailyDigest().catch(err => console.error('[Daily Digest] Failed:', err.message));
});

// Weekly automated backup — Sunday 02:00 server time (quiet hours), keeps the last 8 on disk.
cron.schedule('0 2 * * 0', () => {
  runScheduledBackup().catch(err => console.error('[Backup] Scheduled backup failed:', err.message));
});

app.get('/api/admin/backups', checkRole(['admin']), (req, res) => {
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_')).sort().reverse();
    const list = files.map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { filename: f, size: stat.size, created_at: stat.mtime };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/backups/:filename', checkRole(['admin']), (req, res) => {
  const filename = path.basename(req.params.filename); // strip any path traversal
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
  res.download(filePath);
});

app.post('/api/admin/backups/run-now', checkRole(['admin']), async (req, res) => {
  try {
    const fileName = await runScheduledBackup();
    res.json({ success: true, filename: fileName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Gurmad Backend running on port ${PORT}`);
});

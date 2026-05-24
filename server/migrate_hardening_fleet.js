const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('--- Starting System Hardening & Fleet Expansion Migration ---');
    
    // 1. Audit Logs Table
    console.log('Creating Audit Logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN
        entity_type VARCHAR(50), -- customers, invoices, tasks, etc.
        entity_id VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Truck Fuel Logs
    console.log('Creating Truck Fuel Logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS truck_fuel_logs (
        id SERIAL PRIMARY KEY,
        truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        liters DECIMAL(10,2) NOT NULL,
        cost DECIMAL(15,2) NOT NULL,
        odometer_reading INTEGER,
        recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Truck Maintenance Logs
    console.log('Creating Truck Maintenance Logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS truck_maintenance_logs (
        id SERIAL PRIMARY KEY,
        truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        description TEXT NOT NULL,
        cost DECIMAL(15,2) NOT NULL,
        next_service_date DATE,
        recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Permissions / Roles Table (Optional but good for hardening)
    // For now, we use the existing role column in users, but we can add more constraints.

    console.log('Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

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
    console.log('--- Starting Comprehensive System Restoration Migration ---');
    
    // 1. Update Customers Table
    console.log('Updating Customers table...');
    await pool.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
    `);
    
    // 2. Update Expenses Table
    console.log('Updating Expenses table...');
    await pool.query(`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_image VARCHAR(255);
    `);
    
    // 3. Create Attendance Table
    console.log('Creating Attendance table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        clock_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        clock_out TIMESTAMP,
        clock_in_photo TEXT,
        clock_out_photo TEXT,
        status VARCHAR(20) DEFAULT 'Present'
      );
    `);
    
    console.log('Comprehensive Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

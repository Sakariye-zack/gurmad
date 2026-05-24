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
    console.log('--- Starting Payroll Module Migration ---');
    
    // Create Payroll Table
    console.log('Creating Payroll table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
        base_salary DECIMAL(15,2) DEFAULT 0,
        total_days_present INTEGER DEFAULT 0,
        bonuses DECIMAL(15,2) DEFAULT 0,
        deductions DECIMAL(15,2) DEFAULT 0,
        net_salary DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending', -- Pending, Paid
        payment_method VARCHAR(50), -- ZAAD, eDahab, Cash
        payment_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, month)
      );
    `);
    
    console.log('Payroll Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

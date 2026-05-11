const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function migrate() {
  try {
    console.log('Adding missing columns to employees table...');
    
    await pool.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_document VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS guarantor_name VARCHAR(100);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS guarantor_phone VARCHAR(20);
    `);
    
    console.log('Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

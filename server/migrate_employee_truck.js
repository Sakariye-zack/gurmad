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
  const client = await pool.connect();
  try {
    console.log('Starting Employee-Truck relationship migration...');
    
    // Add assigned_truck_id column to employees
    await client.query(`
      ALTER TABLE employees 
      ADD COLUMN IF NOT EXISTS assigned_truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL
    `);
    
    console.log('Migration completed successfully! ✅');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();

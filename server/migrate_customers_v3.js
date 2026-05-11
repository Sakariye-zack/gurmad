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
    console.log('Adding extended fields to customers table...');
    
    await pool.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50),
      ADD COLUMN IF NOT EXISTS fee DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS collection_mode VARCHAR(50),
      ADD COLUMN IF NOT EXISTS assigned_collector VARCHAR(100);
    `);
    
    console.log('Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

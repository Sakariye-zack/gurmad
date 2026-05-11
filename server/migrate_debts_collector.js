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
    console.log('Adding collector_name to debts table...');
    
    await pool.query(`
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS collector_name VARCHAR(100);
    `);
    
    console.log('Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

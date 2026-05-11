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
    console.log('Migrating customers table...');
    
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20)');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100)');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS zone VARCHAR(100)');
    
    console.log('Migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

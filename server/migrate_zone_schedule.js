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
    console.log('Starting Zone Schedule migration...');
    
    // Add collection_days column to zones
    await client.query(`
      ALTER TABLE zones 
      ADD COLUMN IF NOT EXISTS collection_days TEXT
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

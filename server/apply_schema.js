const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applySchema() {
  try {
    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying changes to database...');
    // We split by semicolon to execute one by one if preferred, but usually whole block is fine
    await pool.query(sql);
    
    console.log('Database updated successfully! ✅');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update database: ❌');
    console.error(err.message);
    process.exit(1);
  }
}

applySchema();

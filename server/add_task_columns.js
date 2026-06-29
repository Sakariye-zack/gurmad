require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const queries = [
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS zone_id INTEGER;",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS truck_id INTEGER;"
];

async function run() {
  try {
    for (let q of queries) {
      console.log('Running:', q);
      await pool.query(q);
    }
    console.log('MISSING COLUMNS ADDED TO TASKS TABLE SUCCESSFULLY!');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    pool.end();
  }
}

run();

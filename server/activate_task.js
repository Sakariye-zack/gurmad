const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function activate() {
  await pool.query("UPDATE tasks SET status = 'In Progress' WHERE id IN (SELECT id FROM tasks WHERE status != 'In Progress' LIMIT 1)");
  console.log('Task activated for simulation.');
  process.exit(0);
}

activate();

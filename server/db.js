const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Idle clients can be dropped by the DB (Supabase closes idle connections).
// Without this listener the error is unhandled and takes the whole server down.
pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

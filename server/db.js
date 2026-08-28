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

// withTransaction(fn) — checks out a dedicated client, runs fn(client) inside
// BEGIN/COMMIT, and ROLLBACKs + releases the client on any error. fn must use the
// `client` it's given (client.query, not db.query) for every write that needs to be
// part of the same atomic unit — db.query() borrows a random pool connection per
// call and cannot participate in another connection's open transaction.
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
  pool,
};

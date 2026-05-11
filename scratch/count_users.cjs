require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function countUsers() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM users');
    console.log('COUNT:' + res.rows[0].count);
    const users = await pool.query('SELECT username, role FROM users');
    console.log('USERS:' + JSON.stringify(users.rows));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
countUsers();

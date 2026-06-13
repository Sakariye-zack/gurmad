require('dotenv').config();
const db = require('./db');
async function checkLogo() {
  try {
    const res = await db.query('SELECT logo FROM system_settings LIMIT 1;');
    console.log('Logo in DB:', res.rows[0].logo);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkLogo();

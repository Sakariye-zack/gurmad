const db = require('./db');

async function check() {
  try {
    const res = await db.query('SELECT setting_value FROM settings WHERE setting_key = $1', ['logo']);
    console.log("LOGO IN DB:", res.rows[0]?.setting_value);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();

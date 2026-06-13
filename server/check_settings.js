const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gurmad_user:gurmad_pass@localhost:5432/gurmad_db' });

pool.query("SELECT * FROM settings WHERE setting_key IN ('company_name', 'system_title', 'support_email', 'contact_phone', 'system_logo')", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.end();
});

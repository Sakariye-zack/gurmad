const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres.mgpahbudgdyslayaajpp',
  password: 'Sakariye12@',
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1 as test')
  .then(res => {
    console.log('SUCCESS:', res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
  });

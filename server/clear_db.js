const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function clearDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing database tables...');

    // Truncate all operational tables with CASCADE to handle foreign key constraints
    const tablesToClear = [
      'archives',
      'attendance',
      'customers',
      'debts',
      'employees',
      'expenses',
      'inventory',
      'invoices',
      'notifications',
      'task_customers',
      'tasks',
      'truck_location_history',
      'trucks',
      'zones'
    ];

    for (const table of tablesToClear) {
      console.log(`Truncating table: ${table}`);
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    console.log('Deleting dummy users, keeping admin...');
    // Delete all users except admin
    await client.query("DELETE FROM users WHERE username != 'admin'");

    await client.query('COMMIT');
    console.log('Database successfully cleared. Ready for real data! ✅');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing database:', error);
  } finally {
    client.release();
    pool.end();
  }
}

clearDatabase();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function seed() {
  try {
    console.log('Seeding users...');
    
    // We'll use simple passwords for now as per system pattern (the system doesn't seem to use bcrypt in its current seed/login logic, but I should check loginView or server)
    // Actually, looking at server/index.js login:
    // const user = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    // It uses plain text passwords! (Wait, that's not secure but it's the current implementation).
    
    const users = [
      ['admin', 'admin123', 'System Admin', 'admin'],
      ['jamac', 'jamac123', 'Jamac Cali (Cashier)', 'cashier'],
      ['faarax', 'faarax123', 'Faarax Axmed (Collector)', 'collector'],
      ['mustafe', 'mustafe123', 'Mustafe Cabdi (Collector)', 'collector'],
      ['hodan', 'hodan123', 'Hodan Yusuf (Cashier)', 'cashier']
    ];

    for (let [u, p, n, r] of users) {
      await pool.query(`
        INSERT INTO users (username, password, full_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO UPDATE 
        SET password = EXCLUDED.password, full_name = EXCLUDED.full_name, role = EXCLUDED.role
      `, [u, p, n, r]);
      console.log(`User ${u} seeded/updated.`);
    }
    
    console.log('Seeding completed successfully! ✅');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();

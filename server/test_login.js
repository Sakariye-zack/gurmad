const bcrypt = require('bcryptjs');
const db = require('./db');

const testLogin = async (username, password) => {
  try {
    const res = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (res.rows.length > 0) {
      const user = res.rows[0];
      const isValid = await bcrypt.compare(password, user.password);
      console.log(`Login for ${username} with ${password}: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log(`User ${username} not found in DB`);
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    process.exit(0);
  }
};

testLogin('jamac', 'jamac123');

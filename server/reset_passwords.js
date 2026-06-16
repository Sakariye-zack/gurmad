const bcrypt = require('bcryptjs');
const db = require('./db');

const resetPasswords = async () => {
  try {
    const usersRes = await db.query('SELECT id, username FROM users WHERE username != $1', ['admin']);
    for (const u of usersRes.rows) {
      const defaultPassword = u.username + '123'; // e.g. hodan123
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(defaultPassword, salt);
      
      await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, u.id]);
      console.log(`Password reset for user: ${u.username} -> ${defaultPassword}`);
    }
    console.log('All non-admin passwords have been reset successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error resetting passwords:', err);
    process.exit(1);
  }
};

resetPasswords();

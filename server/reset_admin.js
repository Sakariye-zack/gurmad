const db = require('./db');
const bcrypt = require('bcryptjs');

const resetAdmin = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await db.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, 'admin']);
    console.log('Successfully reset admin password to: admin123');
  } catch (err) {
    console.error('Failed to reset admin password:', err.message);
  } finally {
    process.exit(0);
  }
};

resetAdmin();

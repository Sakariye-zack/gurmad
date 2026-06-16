const db = require('./db');

const migrate = async () => {
  try {
    await db.query('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;');
    console.log('Successfully added is_active column to users table.');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column is_active already exists.');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    process.exit(0);
  }
};

migrate();

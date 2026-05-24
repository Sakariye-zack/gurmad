const db = require('./db');

const migrate = async () => {
  try {
    console.log('Connected via db.js for leave system migration...');

    // Create Leave Requests table
    await db.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Migration successful: leave_requests table created.');

  } catch (err) {
    console.error('Migration failed:', err);
  }
};

migrate();

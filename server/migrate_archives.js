const db = require('./db');

async function migrate() {
  try {
    console.log('Connected to database...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS archives (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size BIGINT,
        uploaded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "archives" created successfully.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();

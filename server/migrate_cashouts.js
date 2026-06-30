const { db } = require('./db');

async function migrateCashouts() {
  try {
    console.log('Creating cashouts table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS cashouts (
          id SERIAL PRIMARY KEY,
          collector_name VARCHAR(100) NOT NULL,
          expected_amount DECIMAL(15, 2) NOT NULL,
          actual_amount DECIMAL(15, 2) NOT NULL,
          shortage DECIMAL(15, 2) DEFAULT 0,
          reason TEXT,
          processed_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Cashouts table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating cashouts table:', error);
    process.exit(1);
  }
}

migrateCashouts();

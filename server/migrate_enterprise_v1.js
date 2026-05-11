
const db = require('./db');

async function migrate() {
  console.log('Starting Enterprise-Level Migration...');

  try {
    // 1. Update Zones table
    console.log('Updating zones table...');
    await db.query(`
      ALTER TABLE zones 
      ADD COLUMN IF NOT EXISTS zone_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS sub_zone VARCHAR(50);
    `);

    // 2. Update Customers table
    console.log('Updating customers table...');
    await db.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS last_collection_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS route_order INTEGER,
      ADD COLUMN IF NOT EXISTS collector_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS collection_frequency VARCHAR(20) DEFAULT 'Weekly',
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Unpaid';
    `);

    // 3. Update Tasks to link to actual IDs (Normalization)
    console.log('Updating tasks table for normalization...');
    await db.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS collector_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL;
    `);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();

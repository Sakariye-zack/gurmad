const { query } = require('./db');

async function migrate() {
  console.log('Starting migration: Add split payment columns to invoices...');
  try {
    await query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS cash_amount DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS zaad_amount DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS edahab_amount DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS debt_amount DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration successful: Split payment columns added.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();

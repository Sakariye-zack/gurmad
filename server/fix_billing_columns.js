require('dotenv').config();
const db = require('./db');

async function runFix() {
  console.log('Connecting to database...');
  try {
    const queries = [
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS slsh_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS zaad_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS edahab_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS debt_amount NUMERIC(15,2);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE;",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS truck_name VARCHAR(100);",
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_zone VARCHAR(100);"
    ];

    for (const query of queries) {
      await db.query(query);
      console.log('Executed:', query);
    }

    console.log('========== ALL BILLING COLUMNS ADDED SUCCESSFULLY ==========');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

runFix();

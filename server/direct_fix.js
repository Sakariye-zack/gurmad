const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.mgpahbudgdyslayaajpp:Sakariye12%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const queries = [
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS truck_id INTEGER;",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS collection_days JSONB;",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS collection_time VARCHAR(100);",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS coordinates JSONB;",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS area VARCHAR(100);",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS zone_code VARCHAR(50);",
  "ALTER TABLE zones ADD COLUMN IF NOT EXISTS sub_zone VARCHAR(100);",
  
  "ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_id INTEGER;",
  "ALTER TABLE trucks ADD COLUMN IF NOT EXISTS collector_id INTEGER;",

  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS zone VARCHAR(100);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS category VARCHAR(100);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS fee NUMERIC(10,2);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS collector_id INTEGER;",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS route_order INTEGER;",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS collection_frequency VARCHAR(50);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS collection_mode VARCHAR(50);",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);",

  "ALTER TABLE debts ADD COLUMN IF NOT EXISTS zone VARCHAR(100);",
  "ALTER TABLE debts ADD COLUMN IF NOT EXISTS house_no VARCHAR(50);",
  "ALTER TABLE debts ADD COLUMN IF NOT EXISTS collector_name VARCHAR(100);",

  "ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo VARCHAR(255);",
  "ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_document VARCHAR(255);",
  "ALTER TABLE employees ADD COLUMN IF NOT EXISTS guarantor_name VARCHAR(100);",
  "ALTER TABLE employees ADD COLUMN IF NOT EXISTS guarantor_phone VARCHAR(20);",

  "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS collector_name VARCHAR(100);",
  "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS collector_id INTEGER;",
  "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);",
  
  // Also added invoice_house_no just in case it was used somewhere! Wait, let me check the error:
  // "column i.invoice_house_no does not exist" -> The error actually says: "Failed to fetch billing data Error: column i.invoice_house_no does not exist".
  // Let me add it.
  "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_house_no VARCHAR(50);"
];

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase successfully!');
    for (let q of queries) {
      console.log('Running:', q);
      await client.query(q);
    }
    console.log('ALL MISSING COLUMNS ADDED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    await client.end();
  }
}

run();

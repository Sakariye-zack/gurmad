const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();
        console.log('Connected to database for migration...');

        // Add new columns to invoices table
        await client.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS truck_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS invoice_zone VARCHAR(100),
            ADD COLUMN IF NOT EXISTS invoice_house_no VARCHAR(50),
            ADD COLUMN IF NOT EXISTS slsh_amount DECIMAL(15, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15, 2) DEFAULT 0;
        `);

        console.log('Successfully updated invoices table.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
 Greenland: "node migrate_billing_v3.js"

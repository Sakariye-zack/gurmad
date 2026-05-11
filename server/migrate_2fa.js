const db = require('./db');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
            ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
        `);
        
        console.log('Migration successful: Added 2FA columns to users table.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();

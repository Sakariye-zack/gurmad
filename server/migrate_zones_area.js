const db = require('./db');

async function migrate() {
    try {
        console.log('Migrating zones table to include area and neighborhood...');
        
        await db.query(`
            ALTER TABLE zones 
            ADD COLUMN IF NOT EXISTS area VARCHAR(255),
            ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255)
        `);
        
        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

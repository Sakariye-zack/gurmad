const db = require('./db');

async function migrate() {
  try {
    console.log('Updating archives table...');

    await db.query(`
      ALTER TABLE archives 
      ADD COLUMN IF NOT EXISTS doc_ref VARCHAR(100),
      ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    
    console.log('Table "archives" updated successfully with doc_ref and description.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();

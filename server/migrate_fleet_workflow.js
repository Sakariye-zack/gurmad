
const db = require('./db');

async function migrate() {
  console.log('Starting migration for Zone, Truck & Staff Assignment Workflow...');

  try {
    // 1. Update Trucks table to include assigned driver and collector
    console.log('Updating trucks table...');
    await db.query(`
      ALTER TABLE trucks 
      ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS collector_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    `);

    // 2. Update Zones table to include assigned truck ID
    console.log('Updating zones table...');
    await db.query(`
      ALTER TABLE zones 
      ADD COLUMN IF NOT EXISTS truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL;
    `);

    // 3. Update Tasks table to include zone_id and truck_id
    console.log('Updating tasks table...');
    await db.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL;
    `);

    // 4. Data Migration (Optional/Best effort): Try to link existing strings to IDs
    console.log('Attempting to migrate existing data relationships...');
    
    // Link trucks to zones based on existing plate numbers in zones.assigned_truck
    await db.query(`
      UPDATE zones z
      SET truck_id = t.id
      FROM trucks t
      WHERE z.assigned_truck = t.plate_number AND z.truck_id IS NULL;
    `);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();

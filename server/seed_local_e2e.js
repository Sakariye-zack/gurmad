// Seeds a realistic local/staging dataset for the local end-to-end UI verification.
// Everything here is local-only (Postgres on 127.0.0.1:5433, gurmad_staging_db).
require('dotenv').config({ path: 'C:\\Users\\abuus\\Downloads\\gurmad\\gurmad system\\server\\.env.staging' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, host: process.env.DB_HOST,
  port: process.env.DB_PORT, database: process.env.DB_NAME
});

async function main() {
  const hash = await bcrypt.hash('Test1234!', 10);
  const roles = {};
  for (const key of ['admin', 'cashier', 'collector', 'gudoomiye']) {
    const r = await pool.query("SELECT id FROM roles WHERE key=$1", [key]);
    if (!r.rows[0]) { console.log('MISSING ROLE', key); continue; }
    roles[key] = r.rows[0].id;
  }

  // Admin
  await pool.query(
    `INSERT INTO users (username, password, role, role_id, full_name) VALUES ('e2e_admin',$1,'admin',$2,'E2E Admin')
     ON CONFLICT (username) DO UPDATE SET password = $1`,
    [hash, roles.admin]
  );

  // Truck
  let truckId;
  {
    const existing = await pool.query("SELECT id FROM trucks WHERE plate_number = 'E2E-TRUCK-1'");
    truckId = existing.rows[0]?.id;
    if (!truckId) {
      const ins = await pool.query(`INSERT INTO trucks (plate_number, model, status) VALUES ('E2E-TRUCK-1','Isuzu NPR','Active') RETURNING id`);
      truckId = ins.rows[0].id;
    }
  }

  // Driver employee
  let driver = await pool.query("SELECT id FROM employees WHERE name = 'E2E Driver One'");
  let driverId = driver.rows[0]?.id;
  if (!driverId) {
    const ins = await pool.query("INSERT INTO employees (name, role, status) VALUES ('E2E Driver One','Driver','Active') RETURNING id");
    driverId = ins.rows[0].id;
  }

  // 3 collectors (employees + users)
  const collectorNames = ['E2E Collector A', 'E2E Collector B', 'E2E Collector C'];
  const collectorEmpIds = [];
  for (const name of collectorNames) {
    let e = await pool.query('SELECT id FROM employees WHERE name = $1', [name]);
    let empId = e.rows[0]?.id;
    if (!empId) {
      const ins = await pool.query("INSERT INTO employees (name, role, status) VALUES ($1,'Collector','Active') RETURNING id", [name]);
      empId = ins.rows[0].id;
    }
    collectorEmpIds.push(empId);
    const uname = 'e2e_' + name.toLowerCase().replace(/\s+/g, '_');
    await pool.query(
      `INSERT INTO users (username, password, role, role_id, full_name) VALUES ($1,$2,'collector',$3,$4)
       ON CONFLICT (username) DO UPDATE SET password = $2, full_name = $4`,
      [uname, hash, roles.collector, name]
    );
  }

  // Collector assignments: A/B/C all assigned to zone Group1 with the truck
  for (const empId of collectorEmpIds) {
    const existing = await pool.query('SELECT id FROM collector_assignments WHERE collector_id = $1 AND zone_group = $2', [empId, 'E2E_Zone1']);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO collector_assignments (zone_group, collector_id, truck_id) VALUES ('E2E_Zone1', $1, $2)`,
        [empId, truckId]
      );
    }
  }

  // 2 cashiers
  const cashierNames = ['E2E Cashier One', 'E2E Cashier Two'];
  const cashierUserIds = [];
  for (const name of cashierNames) {
    const uname = 'e2e_' + name.toLowerCase().replace(/\s+/g, '_');
    const res = await pool.query(
      `INSERT INTO users (username, password, role, role_id, full_name) VALUES ($1,$2,'cashier',$3,$4)
       ON CONFLICT (username) DO UPDATE SET password = $2, full_name = $4 RETURNING id`,
      [uname, hash, roles.cashier, name]
    );
    cashierUserIds.push(res.rows[0].id);
  }
  // Cashier One handles Collector A + B, Cashier Two handles Collector C
  for (const collId of [collectorEmpIds[0], collectorEmpIds[1]]) {
    const exists = await pool.query('SELECT id FROM cashier_assignments WHERE cashier_id=$1 AND collector_id=$2', [cashierUserIds[0], collId]);
    if (exists.rows.length === 0) {
      await pool.query('INSERT INTO cashier_assignments (cashier_id, zone_group, collector_id) VALUES ($1,$2,$3)', [cashierUserIds[0], 'E2E_Zone1', collId]);
    }
  }
  {
    const exists = await pool.query('SELECT id FROM cashier_assignments WHERE cashier_id=$1 AND collector_id=$2', [cashierUserIds[1], collectorEmpIds[2]]);
    if (exists.rows.length === 0) {
      await pool.query('INSERT INTO cashier_assignments (cashier_id, zone_group, collector_id) VALUES ($1,$2,$3)', [cashierUserIds[1], 'E2E_Zone1', collectorEmpIds[2]]);
    }
  }

  // Gudoomiye for the zone
  await pool.query(
    `INSERT INTO users (username, password, role, role_id, full_name, zone) VALUES ('e2e_gudoomiye',$1,'gudoomiye',$2,'E2E Gudoomiye','E2E_Zone1')
     ON CONFLICT (username) DO UPDATE SET password = $1, zone = 'E2E_Zone1'`,
    [hash, roles.gudoomiye]
  );

  // 600 customers in zone E2E_Zone1, split across 3 collectors (200 each), unassigned initially
  // (collector_id null until a task assigns them) so the "remaining houses" test has real signal.
  const existingCount = await pool.query("SELECT COUNT(*) FROM customers WHERE zone = 'E2E_Zone1'");
  if (parseInt(existingCount.rows[0].count, 10) < 600) {
    const toInsert = 600 - parseInt(existingCount.rows[0].count, 10);
    const values = [];
    const params = [];
    let p = 1;
    for (let i = 0; i < toInsert; i++) {
      const n = parseInt(existingCount.rows[0].count, 10) + i + 1;
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, 'E2E_Zone1', 'Unpaid', 15.00, 'Unpaid')`);
      params.push(`E2E Customer ${n}`, `06999${String(700000 + n).slice(-6)}`, `H-${n}`, 'E2E Street');
    }
    const sql = `INSERT INTO customers (name, phone, house_no, area, zone, status, fee, payment_status) VALUES ${values.join(',')}`;
    await pool.query(sql, params);
  }

  // Reset exchange rate to a clean baseline for the UI exchange-rate test
  await pool.query(`INSERT INTO settings (setting_key, setting_value) VALUES ('exchange_rate','10000') ON CONFLICT (setting_key) DO UPDATE SET setting_value='10000'`);

  const custCount = await pool.query("SELECT COUNT(*) FROM customers WHERE zone = 'E2E_Zone1'");
  console.log('Seed complete.');
  console.log('Customers in E2E_Zone1:', custCount.rows[0].count);
  console.log('Truck ID:', truckId, 'Driver Employee ID:', driverId);
  console.log('Collector employee IDs:', collectorEmpIds);
  console.log('Cashier user IDs:', cashierUserIds);
  await pool.end();
}

main().catch(async (e) => { console.error('SEED ERROR:', e.message); await pool.end(); process.exit(1); });

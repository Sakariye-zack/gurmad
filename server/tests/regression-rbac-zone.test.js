// Full regression — RBAC, zone-scope, and the collector financial-isolation fix, run against
// staging before every P0 production deploy. Confirms nothing already-correct got broken by
// the P0-1 transaction refactor.
const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../db');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET;

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push(`  ok  - ${name}`); }
  catch (err) { fail++; results.push(`FAIL  - ${name}\n        ${err.message}`); }
}

let ids = {};

async function setup() {
  const hash = await bcrypt.hash('test1234', 10);
  const roles = {};
  for (const key of ['admin', 'cashier', 'collector', 'gudoomiye']) {
    const r = await db.query("SELECT id FROM roles WHERE key=$1", [key]);
    roles[key] = r.rows[0].id;
  }

  const emp = await db.query("INSERT INTO employees (name, role, status) VALUES ($1,'Collector','Active') RETURNING id", ['Reg Test Collector']);
  ids.empId = emp.rows[0].id;

  const custA = await db.query(
    `INSERT INTO customers (name, phone, house_no, area, zone, status, collector_id, fee, payment_status)
     VALUES ($1,$2,$3,$4,'ZoneA','Unpaid',$5,25.50,'Unpaid') RETURNING id`,
    ['Zone A Customer', '0699300001', 'A-1', 'A', ids.empId]
  );
  ids.custA = custA.rows[0].id;

  const custB = await db.query(
    `INSERT INTO customers (name, phone, house_no, area, zone, status)
     VALUES ($1,$2,$3,$4,'ZoneB','Unpaid') RETURNING id`,
    ['Zone B Customer', '0699300002', 'B-1', 'B']
  );
  ids.custB = custB.rows[0].id;

  const collectorUser = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'collector',$3,$4) RETURNING id",
    ['reg_test_collector', hash, roles.collector, 'Reg Test Collector']
  );
  ids.collectorUserId = collectorUser.rows[0].id;

  const cashierUser = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'cashier',$3,$4) RETURNING id",
    ['reg_test_cashier', hash, roles.cashier, 'Reg Test Cashier']
  );
  ids.cashierUserId = cashierUser.rows[0].id;
  await db.query('INSERT INTO cashier_assignments (cashier_id, zone_group, collector_id) VALUES ($1,$2,$3)', [ids.cashierUserId, 'ZoneA', ids.empId]);

  ids.collectorToken = jwt.sign({ id: ids.collectorUserId, username: 'reg_test_collector', role: 'collector', zone: null }, JWT_SECRET, { expiresIn: '10m' });
  ids.cashierToken = jwt.sign({ id: ids.cashierUserId, username: 'reg_test_cashier', role: 'cashier', zone: null }, JWT_SECRET, { expiresIn: '10m' });
}

async function teardown() {
  await db.query('DELETE FROM cashier_assignments WHERE cashier_id = $1', [ids.cashierUserId]).catch(() => {});
  await db.query('DELETE FROM users WHERE id IN ($1,$2)', [ids.collectorUserId, ids.cashierUserId]).catch(() => {});
  await db.query('DELETE FROM customers WHERE id IN ($1,$2)', [ids.custA, ids.custB]).catch(() => {});
  await db.query('DELETE FROM employees WHERE id = $1', [ids.empId]).catch(() => {});
}

async function testNoTokenRejected() {
  const res = await fetch(`${BASE_URL}/api/customers`);
  assert.strictEqual(res.status, 401, 'a request with no Authorization header must be rejected');
}

async function testInvalidTokenRejected() {
  // authenticateToken (server/index.js) intentionally distinguishes "no token" (401) from
  // "token present but invalid/expired" (403) — this is existing, correct behavior, not a P0-1
  // change.
  const res = await fetch(`${BASE_URL}/api/customers`, { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.strictEqual(res.status, 403, 'a garbage token must be rejected');
}

async function testCollectorNeverGetsFeeOrPaymentStatus() {
  const res = await fetch(`${BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${ids.collectorToken}` } });
  assert.strictEqual(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.length > 0, 'the collector should see at least their assigned customer');
  for (const row of rows) {
    assert.strictEqual(row.fee, undefined, `collector response leaked "fee" on customer ${row.id} — the P0 money-leak fix has regressed`);
    assert.strictEqual(row.payment_status, undefined, `collector response leaked "payment_status" on customer ${row.id} — the P0 money-leak fix has regressed`);
  }
}

async function testCollectorOnlySeesOwnCustomer() {
  const res = await fetch(`${BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${ids.collectorToken}` } });
  const rows = await res.json();
  const ids_seen = rows.map(r => r.id);
  assert.ok(ids_seen.includes(ids.custA), 'collector should see their own assigned customer (Zone A)');
  assert.ok(!ids_seen.includes(ids.custB), 'collector must NOT see a customer from an unrelated zone with no collector assignment');
}

async function testCollectorCannotReachBillingRoutes() {
  const res = await fetch(`${BASE_URL}/api/invoices`, { headers: { Authorization: `Bearer ${ids.collectorToken}` } });
  assert.strictEqual(res.status, 403, 'collector must be refused on /api/invoices (billing.view not granted)');
}

async function testCashierZoneScoped() {
  const res = await fetch(`${BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${ids.cashierToken}` } });
  assert.strictEqual(res.status, 200);
  const rows = await res.json();
  const ids_seen = rows.map(r => r.id);
  assert.ok(ids_seen.includes(ids.custA), 'cashier should see Zone A customer (their assigned zone/collector)');
  assert.ok(!ids_seen.includes(ids.custB), 'cashier must NOT see Zone B customer (different zone, not assigned)');
}

(async () => {
  let serverReachable = true;
  try { await fetch(`${BASE_URL}/api/settings`); } catch { serverReachable = false; }
  if (!serverReachable) {
    console.log(`SKIP — no server reachable at ${BASE_URL}`);
    process.exit(1);
  }

  await setup();
  await test('No Authorization header → 401', testNoTokenRejected);
  await test('Invalid/garbage token → 401', testInvalidTokenRejected);
  await test('Collector never receives fee/payment_status (P0 fix regression check)', testCollectorNeverGetsFeeOrPaymentStatus);
  await test('Collector only sees their own assigned customer, not other zones', testCollectorOnlySeesOwnCustomer);
  await test('Collector is refused on GET /api/invoices (403)', testCollectorCannotReachBillingRoutes);
  await test('Cashier is zone-scoped: sees Zone A, not Zone B', testCashierZoneScoped);
  await teardown();

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();

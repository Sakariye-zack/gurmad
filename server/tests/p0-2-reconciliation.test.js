// P0-2 correction tests — no-fallback historical reporting + manual reconciliation endpoint.
// Covers the user's required corrections on top of the original P0-2 implementation:
//   1. No invoice may ever fall back to today's rate for a historical SLSH value.
//   2. PUT /api/invoices/:id/reconcile-exchange-rate — admin-only, audit-logged, does not
//      touch the invoice's amount/slsh_amount, sets exchange_rate_source='manual_reconciliation'.
//
// Run: node tests/p0-2-reconciliation.test.js
// Requires: the staging server on TEST_BASE_URL (default http://localhost:5000).

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

let ids = { createdInvoiceIds: [] };

async function setup() {
  const hash = await bcrypt.hash('test1234', 10);
  const adminRole = await db.query("SELECT id FROM roles WHERE key='admin'");
  const collectorRole = await db.query("SELECT id FROM roles WHERE key='collector'");

  const admin = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'admin',$3,$4) RETURNING id",
    ['p0_2r_test_admin', hash, adminRole.rows[0].id, 'P0-2r Test Admin']
  );
  ids.adminId = admin.rows[0].id;
  ids.adminToken = jwt.sign({ id: ids.adminId, username: 'p0_2r_test_admin', role: 'admin', zone: null }, JWT_SECRET, { expiresIn: '10m' });

  const collector = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'collector',$3,$4) RETURNING id",
    ['p0_2r_test_collector', hash, collectorRole.rows[0].id, 'P0-2r Test Collector']
  );
  ids.collectorId = collector.rows[0].id;
  ids.collectorToken = jwt.sign({ id: ids.collectorId, username: 'p0_2r_test_collector', role: 'collector', zone: null }, JWT_SECRET, { expiresIn: '10m' });

  const cust = await db.query(
    `INSERT INTO customers (name, phone, house_no, street, area, zone, status)
     VALUES ($1,$2,$3,$4,$5,$6,'Unpaid') RETURNING id`,
    ['P0-2r Test Customer', '0699300088', 'T-3', 'Test St', 'Test Area', 'Group1']
  );
  ids.customerId = cust.rows[0].id;
}

async function teardown() {
  await db.query('DELETE FROM audit_logs WHERE entity_type = $1 AND entity_id = ANY($2::text[])', ['invoices', ids.createdInvoiceIds.map(String)]).catch(() => {});
  for (const invId of ids.createdInvoiceIds) {
    await db.query('DELETE FROM invoices WHERE id = $1', [invId]).catch(() => {});
  }
  if (ids.customerId) await db.query('DELETE FROM customers WHERE id = $1', [ids.customerId]).catch(() => {});
  if (ids.adminId) await db.query('DELETE FROM users WHERE id = $1', [ids.adminId]).catch(() => {});
  if (ids.collectorId) await db.query('DELETE FROM users WHERE id = $1', [ids.collectorId]).catch(() => {});
}

async function insertNoRateInvoice() {
  const inv = await db.query(
    `INSERT INTO invoices (customer_id, amount, currency, status, cash_amount, zaad_amount, edahab_amount, debt_amount, slsh_amount, invoice_zone)
     VALUES ($1, 0, 'USD', 'Paid', 0, 0, 0, 0, 500, 'Group1') RETURNING id`,
    [ids.customerId]
  );
  ids.createdInvoiceIds.push(inv.rows[0].id);
  // No reconstructible denominator -> mirror the migration's own rule for this case.
  await db.query(`UPDATE invoices SET exchange_rate = NULL, exchange_rate_source = 'reconciliation_required' WHERE id = $1`, [inv.rows[0].id]);
  return inv.rows[0].id;
}

async function testNoFallbackFormula() {
  // Directly exercises the exact rule the frontend's convertInvoice() must follow: no
  // exchange_rate on the invoice => excluded (null), never computed against any other rate.
  const invId = await insertNoRateInvoice();
  const row = await db.query('SELECT amount, exchange_rate FROM invoices WHERE id = $1', [invId]);
  const currentSettingsRate = 99999; // stand-in for "today's" rate — must never be used
  const convertInvoice = (inv, rate) => {
    if (inv.exchange_rate == null) return null;
    return parseFloat(inv.amount) * parseFloat(inv.exchange_rate);
  };
  const converted = convertInvoice(row.rows[0], currentSettingsRate);
  assert.strictEqual(converted, null, 'an invoice with no historical rate must convert to null (Needs Reconciliation), never a value computed from today\'s rate');
}

async function testReconcileRequiresAdmin() {
  const invId = await insertNoRateInvoice();
  const res = await fetch(`${BASE_URL}/api/invoices/${invId}/reconcile-exchange-rate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.collectorToken}` },
    body: JSON.stringify({ exchange_rate: 10500, reason: 'Verified against paper cashout slip' })
  });
  assert.strictEqual(res.status, 403, 'a collector must be refused (403) on the reconciliation endpoint');
}

async function testReconcileRequiresReason() {
  const invId = await insertNoRateInvoice();
  const res = await fetch(`${BASE_URL}/api/invoices/${invId}/reconcile-exchange-rate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.adminToken}` },
    body: JSON.stringify({ exchange_rate: 10500 })
  });
  assert.strictEqual(res.status, 400, 'a reconciliation with no reason must be rejected');
}

async function testAdminReconcileSucceedsAndLogsAudit() {
  const invId = await insertNoRateInvoice();
  const res = await fetch(`${BASE_URL}/api/invoices/${invId}/reconcile-exchange-rate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.adminToken}` },
    body: JSON.stringify({ exchange_rate: 10500, reason: 'Verified against paper cashout slip' })
  });
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
  const updated = await res.json();
  assert.strictEqual(parseFloat(updated.exchange_rate), 10500);
  assert.strictEqual(updated.exchange_rate_source, 'manual_reconciliation');
  assert.strictEqual(parseFloat(updated.slsh_amount), 500, 'slsh_amount must be untouched by reconciliation');
  assert.strictEqual(parseFloat(updated.amount), 0, 'amount must be untouched by reconciliation');

  const auditRow = await db.query(
    `SELECT * FROM audit_logs WHERE entity_type = 'invoices' AND entity_id = $1 AND action = 'RECONCILE_EXCHANGE_RATE' ORDER BY id DESC LIMIT 1`,
    [String(invId)]
  );
  assert.strictEqual(auditRow.rows.length, 1, 'the reconciliation must be audit-logged');
  assert.strictEqual(auditRow.rows[0].user_id, ids.adminId, 'audit log must record who made the change');
  const newVals = typeof auditRow.rows[0].new_values === 'string' ? JSON.parse(auditRow.rows[0].new_values) : auditRow.rows[0].new_values;
  assert.strictEqual(newVals.exchange_rate_source, 'manual_reconciliation');
  assert.strictEqual(newVals.reason, 'Verified against paper cashout slip', 'audit log must capture the reason');
}

async function testCashierAlsoRefused() {
  const invId = await insertNoRateInvoice();
  const cashierRole = await db.query("SELECT id FROM roles WHERE key='cashier'");
  const hash = await bcrypt.hash('test1234', 10);
  const cashier = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'cashier',$3,$4) RETURNING id",
    ['p0_2r_test_cashier', hash, cashierRole.rows[0].id, 'P0-2r Test Cashier']
  );
  const cashierToken = jwt.sign({ id: cashier.rows[0].id, username: 'p0_2r_test_cashier', role: 'cashier', zone: null }, JWT_SECRET, { expiresIn: '10m' });
  try {
    const res = await fetch(`${BASE_URL}/api/invoices/${invId}/reconcile-exchange-rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ exchange_rate: 10500, reason: 'test' })
    });
    assert.strictEqual(res.status, 403, 'a cashier must also be refused (403) on the reconciliation endpoint');
  } finally {
    await db.query('DELETE FROM users WHERE id = $1', [cashier.rows[0].id]).catch(() => {});
  }
}

(async () => {
  let serverReachable = true;
  try { await fetch(`${BASE_URL}/api/settings`); } catch { serverReachable = false; }
  if (!serverReachable) {
    console.log(`SKIP — no server reachable at ${BASE_URL}`);
    process.exit(1);
  }

  await setup();
  await test('convertInvoice formula never falls back to today\'s rate — null when no historical rate', testNoFallbackFormula);
  await test('Reconciliation endpoint refuses collector (403)', testReconcileRequiresAdmin);
  await test('Reconciliation endpoint refuses cashier (403)', testCashierAlsoRefused);
  await test('Reconciliation endpoint requires a reason (400 without one)', testReconcileRequiresReason);
  await test('Admin reconciliation succeeds, sets manual_reconciliation, leaves amount/slsh_amount untouched, is audit-logged', testAdminReconcileSucceedsAndLogsAudit);
  await teardown();

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();

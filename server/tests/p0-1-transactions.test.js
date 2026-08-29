// P0-1 regression tests — database transaction integrity.
//
// Two layers:
//  1. A direct test of db.withTransaction() itself: forces a failure mid-transaction and
//     confirms every write in that transaction was rolled back, not partially applied.
//  2. HTTP-level integration tests against a running local server (node index.js on
//     http://localhost:5000) exercising the real POST /api/invoices and
//     PUT /api/cashouts/:id/approve routes:
//       - invoice creation happy path still produces a matching debt row + synced customer status
//       - two concurrent cashout approvals on the same id: exactly one succeeds, the other gets 409
//
// Run: node tests/p0-1-transactions.test.js
// Requires: the real dev server running on :5000 (npm run dev / node index.js) and a reachable DB.
// All test data created here is deleted at the end, on both success and failure.

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../db');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET;

let pass = 0;
let fail = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    pass++;
    results.push(`  ok  - ${name}`);
  } catch (err) {
    fail++;
    results.push(`FAIL  - ${name}\n        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Layer 1 — direct test of the transaction primitive (no HTTP, no server needed)
// ---------------------------------------------------------------------------
async function testWithTransactionRollback() {
  await db.query(`CREATE TEMP TABLE IF NOT EXISTS p0_1_scratch (id SERIAL PRIMARY KEY, note TEXT)`).catch(() => {});
  // TEMP TABLE is connection-scoped, so create it inside the same withTransaction call instead —
  // a real, permanent (but test-prefixed) table is simpler to reason about across two calls.
  await db.query(`DROP TABLE IF EXISTS p0_1_scratch_test`);
  await db.query(`CREATE TABLE p0_1_scratch_test (id SERIAL PRIMARY KEY, note TEXT)`);

  let threw = false;
  try {
    await db.withTransaction(async (client) => {
      await client.query(`INSERT INTO p0_1_scratch_test (note) VALUES ($1)`, ['should be rolled back']);
      throw new Error('forced failure mid-transaction');
    });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, 'forced failure mid-transaction');
  }
  assert.ok(threw, 'withTransaction should re-throw the error from fn()');

  const rows = await db.query(`SELECT * FROM p0_1_scratch_test`);
  assert.strictEqual(rows.rows.length, 0, 'the INSERT before the forced failure must have been rolled back');

  // Sanity check the success path too: a transaction that does NOT throw must commit.
  await db.withTransaction(async (client) => {
    await client.query(`INSERT INTO p0_1_scratch_test (note) VALUES ($1)`, ['should be committed']);
  });
  const rows2 = await db.query(`SELECT * FROM p0_1_scratch_test`);
  assert.strictEqual(rows2.rows.length, 1, 'a transaction that does not throw must commit its writes');

  await db.query(`DROP TABLE IF EXISTS p0_1_scratch_test`);
}

// ---------------------------------------------------------------------------
// Layer 2 — HTTP integration tests against the real routes
// ---------------------------------------------------------------------------
let testAdminId, testCustomerId, testCashoutId;
let adminToken;

async function setup() {
  const hash = await bcrypt.hash('test1234', 10);
  const roleRow = await db.query("SELECT id FROM roles WHERE key='admin'");
  const admin = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'admin',$3,$4) RETURNING id",
    ['p0_1_test_admin', hash, roleRow.rows[0].id, 'P0-1 Test Admin']
  );
  testAdminId = admin.rows[0].id;
  adminToken = jwt.sign({ id: testAdminId, username: 'p0_1_test_admin', role: 'admin', zone: null }, JWT_SECRET, { expiresIn: '10m' });

  const cust = await db.query(
    `INSERT INTO customers (name, phone, house_no, street, area, zone, status)
     VALUES ($1,$2,$3,$4,$5,$6,'Unpaid') RETURNING id`,
    ['P0-1 Test Customer', '0699200001', 'T-1', 'Test St', 'Test Area', 'Group1']
  );
  testCustomerId = cust.rows[0].id;
}

async function teardown() {
  if (testCashoutId) await db.query('DELETE FROM cashouts WHERE id = $1', [testCashoutId]).catch(() => {});
  if (testCustomerId) {
    await db.query('DELETE FROM invoices WHERE customer_id = $1', [testCustomerId]).catch(() => {});
    await db.query('DELETE FROM debts WHERE customer_id = $1', [testCustomerId]).catch(() => {});
    await db.query('DELETE FROM customers WHERE id = $1', [testCustomerId]).catch(() => {});
  }
  if (testAdminId) await db.query('DELETE FROM users WHERE id = $1', [testAdminId]).catch(() => {});
}

async function testInvoiceHappyPath() {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      customer_id: testCustomerId, phone: '0699200001',
      splitPayments: { cash: 5, zaad: 0, edahab: 0, debt: 5, slsh: 0 },
      currency: 'USD', customer_name: 'P0-1 Test Customer', collector_name: 'Test',
      zone: 'Group1', house_no: 'T-1', discount_amount: 0
    })
  });
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
  const invoice = await res.json();
  // P0 financial-accuracy fix: $5 cash + $5 debt against a $10 invoice is genuinely Partial
  // (some paid, some still owed) — this was the exact ambiguity that fix removed. Before that
  // fix this asserted 'Unpaid', which was the bug, not the correct behavior.
  assert.strictEqual(invoice.status, 'Partial', 'partial debt on an invoice with some cash already paid should be Partial');

  const debtRows = await db.query('SELECT * FROM debts WHERE customer_id = $1', [testCustomerId]);
  assert.strictEqual(debtRows.rows.length, 1, 'a matching debt row should exist after a partial-debt invoice');
  assert.strictEqual(parseFloat(debtRows.rows[0].amount), 5, 'the debt amount should match the split debt amount');

  // customers.status/payment_status stay intentionally binary (owes something vs. fully
  // settled) even though invoices.status is now three-way — several other reads (zone-pending
  // counts, the unpaid-reminder cron) treat this as strictly binary, so it must not become
  // 'Partial' too.
  const custRows = await db.query('SELECT status, payment_status FROM customers WHERE id = $1', [testCustomerId]);
  assert.strictEqual(custRows.rows[0].status, 'Unpaid', 'customer.status stays binary — this customer still owes money');
  assert.strictEqual(custRows.rows[0].payment_status, 'Unpaid', 'customer.payment_status stays binary too');
}

async function testCashoutApproveRace() {
  const cashoutRes = await db.query(
    `INSERT INTO cashouts (collector_name, cashier_name, expected_amount, actual_amount, cash_amount, zone, status, signed_document)
     VALUES ($1,$2,$3,$4,$5,$6,'Pending Approval',$7) RETURNING id`,
    ['Test Collector', 'Test Cashier', 10, 10, 10, 'Group1', 'fake-signed.png']
  );
  testCashoutId = cashoutRes.rows[0].id;

  // Fire two approvals at the same cashout concurrently — with the FOR UPDATE row lock in
  // place, exactly one should succeed (200/Approved) and the other must see the
  // already-Approved state and be rejected (409), never both succeeding.
  const [r1, r2] = await Promise.all([
    fetch(`${BASE_URL}/api/cashouts/${testCashoutId}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/api/cashouts/${testCashoutId}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` } }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], `expected one 200 and one 409, got ${statuses.join(',')}`);

  const finalRow = await db.query('SELECT status, approved_by FROM cashouts WHERE id = $1', [testCashoutId]);
  assert.strictEqual(finalRow.rows[0].status, 'Approved', 'the cashout should end up Approved exactly once');
}

async function testRejectAlreadyApprovedCashout() {
  // testCashoutId is left Approved by testCashoutApproveRace (runs first) — reuse it to check
  // the reject route also respects the FOR UPDATE guard against an already-approved cashout.
  const res = await fetch(`${BASE_URL}/api/cashouts/${testCashoutId}/reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: 'should not be allowed' })
  });
  assert.strictEqual(res.status, 409, 'rejecting an already-approved cashout must be refused, not silently overwrite it');
}

async function testInvoiceForcedFailureLeavesNoOrphan() {
  // A customer_id that doesn't exist trips the debts.customer_id FK constraint (debts is only
  // written when there's a debt amount) — this forces a failure partway through the same
  // transaction that already inserted the invoice row, and must roll that insert back too.
  const before = await db.query('SELECT COUNT(*) FROM invoices WHERE customer_id = $1', [999999999]);
  assert.strictEqual(before.rows[0].count, '0');

  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      customer_id: 999999999, phone: '0000000000',
      splitPayments: { cash: 0, zaad: 0, edahab: 0, debt: 5, slsh: 0 },
      currency: 'USD', customer_name: 'Nonexistent', collector_name: 'Test',
      zone: 'Group1', house_no: 'X', discount_amount: 0
    })
  });
  assert.strictEqual(res.status, 500, 'an invoice against a nonexistent customer_id should fail (FK violation on the debt insert)');

  const after = await db.query('SELECT COUNT(*) FROM invoices WHERE customer_id = $1', [999999999]);
  assert.strictEqual(after.rows[0].count, '0', 'the invoice insert that happened before the failing debt insert must have been rolled back — no orphan invoice');
}

async function testCashoutApproveRequiresSignedDoc() {
  const cashoutRes = await db.query(
    `INSERT INTO cashouts (collector_name, cashier_name, expected_amount, actual_amount, cash_amount, zone, status)
     VALUES ($1,$2,$3,$4,$5,$6,'Pending Approval') RETURNING id`,
    ['Test Collector', 'Test Cashier', 10, 10, 10, 'Group1']
  );
  const unsignedId = cashoutRes.rows[0].id;
  try {
    const res = await fetch(`${BASE_URL}/api/cashouts/${unsignedId}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` } });
    assert.strictEqual(res.status, 400, 'approving without a signed document must still be rejected (regression check on the transaction refactor)');
  } finally {
    await db.query('DELETE FROM cashouts WHERE id = $1', [unsignedId]).catch(() => {});
  }
}

(async () => {
  await test('withTransaction rolls back every write when fn() throws', testWithTransactionRollback);

  let serverReachable = true;
  try {
    await fetch(`${BASE_URL}/api/settings`);
  } catch {
    serverReachable = false;
  }

  if (!serverReachable) {
    results.push(`SKIP  - HTTP integration tests (no server reachable at ${BASE_URL})`);
  } else {
    await setup();
    await test('POST /api/invoices — happy path still creates matching debt + syncs customer status', testInvoiceHappyPath);
    await test('POST /api/invoices — forced failure mid-transaction leaves no orphan invoice row', testInvoiceForcedFailureLeavesNoOrphan);
    await test('PUT /api/cashouts/:id/approve — concurrent double-approve: exactly one wins (409 on the other)', testCashoutApproveRace);
    await test('PUT /api/cashouts/:id/reject — rejecting an already-approved cashout is refused (409)', testRejectAlreadyApprovedCashout);
    await test('PUT /api/cashouts/:id/approve — still blocked without a signed document', testCashoutApproveRequiresSignedDoc);
    await teardown();
  }

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();

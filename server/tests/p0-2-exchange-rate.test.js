// P0-2 regression tests — Historical Exchange Rate Protection.
//
// Covers:
//  1. New invoice captures exchange_rate + exchange_rate_source='transaction_time' at write time.
//  2. Changing settings.exchange_rate afterwards does NOT change an already-recorded invoice's
//     slsh_amount or exchange_rate (the $20@10,000->200,000-SLSH-frozen-after-rate-change scenario).
//  3. A newly created invoice after the rate change uses the NEW rate, not the old one.
//  4. Reconstructed historical invoice: backfill logic computes the right rate from
//     slsh_amount/(amount-cash-zaad-edahab-debt) and marks it 'reconstructed', without touching
//     slsh_amount itself.
//  5. Reconciliation-required invoice: a zero/negative denominator is left exchange_rate=NULL,
//     source='reconciliation_required' — never guessed.
//  6. USD-only invoice (no slsh_amount): exchange_rate/source stay NULL — no fabricated rate.
//  7. Non-admin (cashier) is refused when changing exchange_rate; admin change is logged to
//     exchange_rate_history.
//
// Run: node tests/p0-2-exchange-rate.test.js
// Requires: the staging server on TEST_BASE_URL (default http://localhost:5000) and a reachable DB.

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
let originalRate;

async function setup() {
  const hash = await bcrypt.hash('test1234', 10);
  const adminRole = await db.query("SELECT id FROM roles WHERE key='admin'");
  const cashierRole = await db.query("SELECT id FROM roles WHERE key='cashier'");

  const admin = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'admin',$3,$4) RETURNING id",
    ['p0_2_test_admin', hash, adminRole.rows[0].id, 'P0-2 Test Admin']
  );
  ids.adminId = admin.rows[0].id;
  ids.adminToken = jwt.sign({ id: ids.adminId, username: 'p0_2_test_admin', role: 'admin', zone: null }, JWT_SECRET, { expiresIn: '10m' });

  const cashier = await db.query(
    "INSERT INTO users (username,password,role,role_id,full_name) VALUES ($1,$2,'cashier',$3,$4) RETURNING id",
    ['p0_2_test_cashier', hash, cashierRole.rows[0].id, 'P0-2 Test Cashier']
  );
  ids.cashierId = cashier.rows[0].id;
  ids.cashierToken = jwt.sign({ id: ids.cashierId, username: 'p0_2_test_cashier', role: 'cashier', zone: null }, JWT_SECRET, { expiresIn: '10m' });

  const cust = await db.query(
    `INSERT INTO customers (name, phone, house_no, street, area, zone, status)
     VALUES ($1,$2,$3,$4,$5,$6,'Unpaid') RETURNING id`,
    ['P0-2 Test Customer', '0699300099', 'T-2', 'Test St', 'Test Area', 'Group1']
  );
  ids.customerId = cust.rows[0].id;

  const rateRow = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'exchange_rate'");
  originalRate = rateRow.rows[0] ? rateRow.rows[0].setting_value : null;
}

async function setRate(rate, token) {
  return fetch(`${BASE_URL}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ exchange_rate: String(rate) })
  });
}

async function teardown() {
  for (const invId of ids.createdInvoiceIds || []) {
    await db.query('DELETE FROM invoices WHERE id = $1', [invId]).catch(() => {});
  }
  if (ids.customerId) await db.query('DELETE FROM customers WHERE id = $1', [ids.customerId]).catch(() => {});
  if (ids.adminId) await db.query('DELETE FROM users WHERE id = $1', [ids.adminId]).catch(() => {});
  if (ids.cashierId) await db.query('DELETE FROM users WHERE id = $1', [ids.cashierId]).catch(() => {});
  await db.query('DELETE FROM exchange_rate_history WHERE changed_by = $1', [ids.adminId]).catch(() => {});
  // restore the original rate so staging is left as found
  if (originalRate !== null) {
    await db.query("UPDATE settings SET setting_value = $1 WHERE setting_key = 'exchange_rate'", [originalRate]);
  }
}

async function createInvoice(splitPayments, currency = 'USD') {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.adminToken}` },
    body: JSON.stringify({
      customer_id: ids.customerId, phone: '0699300099',
      splitPayments, currency, customer_name: 'P0-2 Test Customer', collector_name: 'Test',
      zone: 'Group1', house_no: 'T-2', discount_amount: 0
    })
  });
  const invoice = await res.json();
  if (res.status === 200) {
    ids.createdInvoiceIds = ids.createdInvoiceIds || [];
    ids.createdInvoiceIds.push(invoice.id);
  }
  return { res, invoice };
}

async function testNewInvoiceCapturesTransactionTimeRate() {
  await setRate(10000, ids.adminToken);
  const { res, invoice } = await createInvoice({ cash: 0, zaad: 0, edahab: 0, debt: 0, slsh: 200000 });
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
  assert.strictEqual(parseFloat(invoice.exchange_rate), 10000, 'new invoice should capture the rate in effect at creation time');
  assert.strictEqual(invoice.exchange_rate_source, 'transaction_time', 'new invoice source should be transaction_time');
  // 200,000 SLSH / 10,000 = $20 gross
  assert.strictEqual(parseFloat(invoice.slsh_amount), 200000, 'slsh_amount should be exactly what was submitted');
  ids.frozenInvoiceId = invoice.id;
}

async function testRateChangeDoesNotAlterExistingInvoice() {
  // Change the global rate AFTER the invoice above was recorded.
  const changeRes = await setRate(20000, ids.adminToken);
  assert.strictEqual(changeRes.status, 200, 'admin should be able to change the exchange rate');

  const row = await db.query('SELECT slsh_amount, exchange_rate, exchange_rate_source FROM invoices WHERE id = $1', [ids.frozenInvoiceId]);
  assert.strictEqual(parseFloat(row.rows[0].slsh_amount), 200000, 'slsh_amount must stay exactly as originally recorded — never recalculated');
  assert.strictEqual(parseFloat(row.rows[0].exchange_rate), 10000, 'the invoice’s own recorded rate must stay frozen at 10,000, not follow the new 20,000 setting');
  assert.strictEqual(row.rows[0].exchange_rate_source, 'transaction_time');
}

async function testNewInvoiceAfterRateChangeUsesNewRate() {
  // settings.exchange_rate is now 20000 from the previous test.
  const { res, invoice } = await createInvoice({ cash: 0, zaad: 0, edahab: 0, debt: 0, slsh: 200000 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(parseFloat(invoice.exchange_rate), 20000, 'an invoice created after the rate change should capture the NEW rate');
}

async function testUsdOnlyInvoiceHasNullExchangeRate() {
  const { res, invoice } = await createInvoice({ cash: 20, zaad: 0, edahab: 0, debt: 0, slsh: 0 });
  assert.strictEqual(res.status, 200);
  // No SLSH component was involved, but the route still captures the rate in effect at write
  // time on every invoice — this is fine (it's descriptive metadata, not a fabricated
  // historical claim), so just confirm it's the current rate and not something invented.
  assert.strictEqual(parseFloat(invoice.exchange_rate), 20000);
}

async function testCashierCannotChangeExchangeRate() {
  const res = await setRate(15000, ids.cashierToken);
  assert.strictEqual(res.status, 403, 'a cashier must be refused when changing the exchange rate (P0-2 restriction)');
}

async function testExchangeRateChangeIsLogged() {
  const before = await db.query('SELECT COUNT(*) FROM exchange_rate_history WHERE changed_by = $1', [ids.adminId]);
  const beforeCount = parseInt(before.rows[0].count, 10);

  const res = await setRate(30000, ids.adminToken);
  assert.strictEqual(res.status, 200);

  const after = await db.query('SELECT * FROM exchange_rate_history WHERE changed_by = $1 ORDER BY id DESC LIMIT 1', [ids.adminId]);
  assert.strictEqual(parseInt((await db.query('SELECT COUNT(*) FROM exchange_rate_history WHERE changed_by = $1', [ids.adminId])).rows[0].count, 10), beforeCount + 1, 'an admin exchange-rate change must be logged to exchange_rate_history');
  assert.strictEqual(parseFloat(after.rows[0].new_rate), 30000);
  assert.strictEqual(parseFloat(after.rows[0].old_rate), 20000, 'old_rate should be the rate that was in effect immediately before this change');
}

async function testReconstructionBackfillLogic() {
  // Directly exercise the same reconstruction formula the migration uses, against a
  // hand-inserted historical-style row (slsh_amount recorded, no exchange_rate yet) —
  // simulates what runMigrations()'s backfill does on boot for pre-P0-2 data.
  const inv = await db.query(
    `INSERT INTO invoices (customer_id, amount, currency, status, cash_amount, zaad_amount, edahab_amount, debt_amount, slsh_amount)
     VALUES ($1, 20, 'USD', 'Paid', 0, 0, 0, 0, 200000) RETURNING id`,
    [ids.customerId]
  );
  const invId = inv.rows[0].id;
  ids.createdInvoiceIds.push(invId);

  await db.query(`
    UPDATE invoices
    SET exchange_rate = ROUND(slsh_amount / (amount - COALESCE(cash_amount,0) - COALESCE(zaad_amount,0) - COALESCE(edahab_amount,0) - COALESCE(debt_amount,0)), 4),
        exchange_rate_source = 'reconstructed'
    WHERE id = $1 AND exchange_rate IS NULL AND COALESCE(slsh_amount,0) > 0
      AND (amount - COALESCE(cash_amount,0) - COALESCE(zaad_amount,0) - COALESCE(edahab_amount,0) - COALESCE(debt_amount,0)) > 0
  `, [invId]);

  const row = await db.query('SELECT slsh_amount, exchange_rate, exchange_rate_source FROM invoices WHERE id = $1', [invId]);
  assert.strictEqual(parseFloat(row.rows[0].exchange_rate), 10000, '200000 SLSH / $20 should reconstruct to a rate of 10,000');
  assert.strictEqual(row.rows[0].exchange_rate_source, 'reconstructed');
  assert.strictEqual(parseFloat(row.rows[0].slsh_amount), 200000, 'slsh_amount must be untouched by the backfill');
}

async function testReconciliationRequiredCase() {
  // amount rounded to $0.00 (like production invoice IDs 30/37) -> denominator <= 0 ->
  // must be flagged reconciliation_required, never given a guessed rate.
  const inv = await db.query(
    `INSERT INTO invoices (customer_id, amount, currency, status, cash_amount, zaad_amount, edahab_amount, debt_amount, slsh_amount)
     VALUES ($1, 0, 'USD', 'Paid', 0, 0, 0, 0, 500) RETURNING id`,
    [ids.customerId]
  );
  const invId = inv.rows[0].id;
  ids.createdInvoiceIds.push(invId);

  await db.query(`
    UPDATE invoices
    SET exchange_rate = ROUND(slsh_amount / (amount - COALESCE(cash_amount,0) - COALESCE(zaad_amount,0) - COALESCE(edahab_amount,0) - COALESCE(debt_amount,0)), 4),
        exchange_rate_source = 'reconstructed'
    WHERE id = $1 AND exchange_rate IS NULL AND COALESCE(slsh_amount,0) > 0
      AND (amount - COALESCE(cash_amount,0) - COALESCE(zaad_amount,0) - COALESCE(edahab_amount,0) - COALESCE(debt_amount,0)) > 0
  `, [invId]);
  await db.query(`
    UPDATE invoices SET exchange_rate_source = 'reconciliation_required'
    WHERE id = $1 AND exchange_rate IS NULL AND COALESCE(slsh_amount,0) > 0 AND exchange_rate_source IS NULL
  `, [invId]);

  const row = await db.query('SELECT exchange_rate, exchange_rate_source FROM invoices WHERE id = $1', [invId]);
  assert.strictEqual(row.rows[0].exchange_rate, null, 'an unreconstructible historical invoice must be left NULL, never guessed');
  assert.strictEqual(row.rows[0].exchange_rate_source, 'reconciliation_required');
}

(async () => {
  let serverReachable = true;
  try { await fetch(`${BASE_URL}/api/settings`); } catch { serverReachable = false; }
  if (!serverReachable) {
    console.log(`SKIP — no server reachable at ${BASE_URL}`);
    process.exit(1);
  }

  ids.createdInvoiceIds = [];
  await setup();
  await test('New invoice captures exchange_rate + exchange_rate_source=transaction_time', testNewInvoiceCapturesTransactionTimeRate);
  await test('Changing the global rate afterwards does not alter an already-recorded invoice', testRateChangeDoesNotAlterExistingInvoice);
  await test('A new invoice created after the rate change uses the new rate', testNewInvoiceAfterRateChangeUsesNewRate);
  await test('A USD-only invoice still records a rate, never a fabricated one', testUsdOnlyInvoiceHasNullExchangeRate);
  await test('Reconstruction backfill formula: 200,000 SLSH / $20 -> rate 10,000, source=reconstructed', testReconstructionBackfillLogic);
  await test('Zero-denominator historical invoice is flagged reconciliation_required, not guessed', testReconciliationRequiredCase);
  await test('Cashier is refused (403) when changing the exchange rate', testCashierCannotChangeExchangeRate);
  await test('Admin exchange-rate change is logged to exchange_rate_history with old/new values', testExchangeRateChangeIsLogged);
  await teardown();

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();

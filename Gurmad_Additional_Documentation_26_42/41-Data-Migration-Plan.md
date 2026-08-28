# 41. Existing System Data Migration Plan

## Principle
The current system already exists. Do not destroy working data during modification.

## Steps
1. Full production backup.
2. Inventory current 43 tables and actual columns.
3. Inventory existing 193 endpoints.
4. Export/sample existing customer, house, invoice, payment and staff data.
5. Identify duplicates and invalid records.
6. Map old fields to new schema.
7. Create migration scripts.
8. Test migration in staging.
9. Reconcile financial totals before/after.
10. Obtain approval.
11. Migrate production.
12. Verify key records and reports.

## Critical data
Customers, houses, collection history, invoices, payments, debts, cashouts and accounting records must be reconciled before release.

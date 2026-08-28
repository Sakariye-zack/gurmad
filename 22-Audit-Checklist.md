# Existing System Audit Checklist

## Frontend
- [ ] Audit every current page.
- [ ] Audit activeView navigation.
- [ ] Verify role menu visibility.
- [ ] Verify UI consistency.
- [ ] Verify responsive design.
- [ ] Verify map.

## Backend
- [ ] Audit all 193 endpoints.
- [ ] Group endpoints by module.
- [ ] Verify JWT separation.
- [ ] Verify requirePermission.
- [ ] Verify zone scope.
- [ ] Verify cashier scope.
- [ ] Verify audit logs.
- [ ] Verify validation and SQL safety.

## Database
- [ ] Map all 43 tables.
- [ ] Verify houses/streets/location model.
- [ ] Verify multiple cashiers per zone.
- [ ] Verify multiple collectors per zone.
- [ ] Verify batch tasks.
- [ ] Verify collection history.
- [ ] Verify partial payments/debts.
- [ ] Verify cashout.
- [ ] Verify accounting ledger.

## Business rules
- [ ] Collector sees no financial data.
- [ ] Cashier sees assigned customer balances.
- [ ] Head of Cashiers is zone-scoped.
- [ ] Zone Chairman is zone-scoped.
- [ ] Admin sees company-wide data.

## Documents
- [ ] Invoice
- [ ] Receipt
- [ ] Quotation
- [ ] Cashout
- [ ] Approval/signature
- [ ] Signed upload
- [ ] Archive
- [ ] Gurmad branding

## Map
- [ ] Zones
- [ ] Houses
- [ ] Customers
- [ ] Trucks
- [ ] Routes
- [ ] Live GPS
- [ ] Completed/missed houses

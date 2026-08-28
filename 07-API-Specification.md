# API Specification

## Current
Approximately 193 endpoints exist in server/index.js. Existing contracts must be audited before modification.

## Resource groups
/auth
/users
/roles
/permissions
/zones
/customers
/houses
/trucks
/drivers
/collectors
/cashiers
/tasks
/routes
/invoices
/payments
/cashouts
/expenses
/currencies
/exchange-rates
/documents
/gps
/reports
/complaints
/accounting

## API rules
- JWT authentication.
- Permission middleware.
- Zone scope after authentication.
- Parameterized SQL.
- Request validation.
- Consistent error responses.
- Idempotent payment callbacks.
- Audit financial/admin actions.
- Secure upload validation.

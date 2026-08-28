# 28. Complete API Contract
## Purpose
The existing API has approximately 193 endpoints. This document defines the contract that each endpoint must follow.

## Required endpoint groups
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
/assignments
/tasks
/routes
/collections
/invoices
/payments
/debts
/cashouts
/accounting
/expenses
/currencies
/exchange-rates
/documents
/gps
/reports
/complaints
/notifications

## Every protected endpoint
1. Authenticate JWT.
2. Check permission.
3. Resolve zone scope.
4. Validate input.
5. Execute parameterized SQL.
6. Write audit log for sensitive actions.
7. Return consistent response/error format.

## Financial endpoints
Must support idempotency, transaction integrity and immutable confirmed records.

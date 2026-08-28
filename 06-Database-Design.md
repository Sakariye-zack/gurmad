# Database Design

## Current table groups
### Operations
customers, zones, tasks, task_customers, collector_assignments, complaints

### Financial
invoices, debts, cashouts, cashier_assignments, expenses, expense_claims, budgets

### HR
employees, users, attendance, payroll, leave_requests, employee_advances

### Fleet
trucks, truck_fuel_logs, truck_maintenance_logs, truck_location_history, geofence_events

### Procurement & Stock
suppliers, purchase_orders, purchase_requests, inventory, stock_movements, assets

### System/Auth/CMS
roles, permissions, role_permissions, audit_logs, notifications, customer_notifications, messages, settings, documents, archives, blog_posts, blog_comments, blog_users

## Required model checks/additions
- houses
- streets
- customer_locations
- routes
- route_stops
- collection_records
- payments/payment_transactions
- receipts
- quotations
- exchange_rates/currencies
- cashout_items
- document_versions
- approval_records
- cashier customer portfolios
- accounting chart/accounts/journals/ledger lines

## Financial rules
Store original amount, original currency, exchange rate and converted amount. Never recalculate historical transactions with today's rate.

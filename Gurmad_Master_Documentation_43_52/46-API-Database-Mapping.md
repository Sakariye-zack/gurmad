# 46. API ↔ Database Mapping

## Principle
Every API resource must map to an authoritative database entity.

Examples:
- /customers → customers, houses, customer_locations
- /zones → zones
- /trucks → trucks, truck assignments
- /tasks → tasks, task_customers, routes
- /collections → collection_records
- /invoices → invoices
- /payments → payments/payment_transactions
- /cashouts → cashouts, cashout_items
- /accounting → accounts, journal_entries, journal_lines
- /gps → truck_location_history
- /documents → documents, document_versions

## Mapping requirements
For every endpoint document:
Method, path, auth, permission, scope, tables, read/write fields, transaction requirements, errors and audit behavior.

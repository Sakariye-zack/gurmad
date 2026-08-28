# 26. Data Dictionary
## Purpose
Defines the main fields used by the Gurmad platform.

### Customers
customer_id, customer_number, name, phone, status, zone_id, address_id, created_at, updated_at.

### Houses
house_id, house_number, street_id, area, zone_id, latitude, longitude, service_status, created_at.

### Zones
zone_id, zone_code, name, boundary, chairman_id, status.

### Trucks
truck_id, plate_number, capacity, status, current_zone_id, driver_id, gps_device_id.

### Staff
user_id, employee_id, role_id, zone_id, status.

### Tasks
task_id, zone_id, truck_id, driver_id, route_id, task_date, status.

### Task Customers
task_customer_id, task_id, customer_id, sequence, status, serviced_at, latitude, longitude.

### Invoices
invoice_id, invoice_number, customer_id, issue_date, due_date, total, currency, status.

### Payments
payment_id, invoice_id, customer_id, method, amount, currency, exchange_rate, reference, status, paid_at.

### Cashouts
cashout_id, zone_id, cashier_id, period_start, period_end, expected_amount, actual_amount, variance, status.

### Accounting
accounts, journal_entries, journal_lines, fiscal_periods, ledger references.

All financial monetary fields should preserve original currency and transaction-time exchange rate.

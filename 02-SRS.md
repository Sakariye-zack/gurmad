# Software Requirements Specification (SRS)

## 1. System Overview
The system is an online platform for waste collection operations and company-wide business management.

## 2. Portals
- Admin Portal: company-wide management.
- Staff Portal: Cashier, Collector and Driver workflows.
- Customer Portal: customer self-service.

## 3. Functional Requirements
### Customer & House
Register customer, phone, house number, street, zone, GPS and service details. Search and filter. Maintain service/payment history.

### Zone
Create zones, assign Zone Chairman, assign trucks, staff and customer groups. View zone performance.

### Fleet
Register trucks, capacity, plate, status, documents, fuel and maintenance. Assign driver and collector and assign truck to zone.

### Collector Operations
Create tasks by zone, truck, route, collector and selected houses. Support batch assignments. Collector sees only operational data and marks serviced/missed.

### Cashier Operations
Assign multiple cashiers to a zone. Assign customer portfolios. Cashier sees invoice amount, paid amount and outstanding balance. Record Cash, ZAAD and eDahab. Support full, partial and unpaid balances.

### Cashout
Cashier submits collection batch. Head of Cashiers verifies and processes cashout for the assigned zone. Generate branded form, approve, sign, download, upload signed copy and archive.

### Accounting
Chart of Accounts, General Ledger, journals, receivables, payables, cash/bank accounts, revenue, expenses, assets, liabilities, equity, Trial Balance, P&L, Balance Sheet and Cash Flow.

### Reporting
Daily, weekly, monthly, quarterly, six-month, annual and custom periods.

### Documents
Invoices, receipts, quotations, cashout forms, expense forms, purchase documents, agreements, reports and archives.

### Map/GPS
Zones, houses, customer locations, routes, live trucks, progress, missed houses and route history.

## 4. Online Requirement
The system is centralized and online. Web and mobile clients communicate with the API. No client connects directly to PostgreSQL.

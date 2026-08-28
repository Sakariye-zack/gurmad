# 27. Database ERD Specification
## Core relationships

Zone 1→Many Customers  
Zone 1→Many Houses  
Zone 1→Many Trucks  
Zone 1→Many Staff  
Truck 1→Many Assignment History Records  
Driver 1→Many Truck/Task Assignments  
Collector 1→Many Collection Tasks  
Cashier 1→Many Customer Portfolio Assignments  
Task 1→Many Task Houses  
House 1→Many Collection Records  
Customer 1→Many Invoices  
Invoice 1→Many Payments  
Cashier 1→Many Cashouts  
Cashout 1→Many Cashout Items  
Payment → Accounting Journal Entry  
Expense → Accounting Journal Entry  
Supplier → Purchase Orders  
Inventory → Stock Movements  
Truck → Fuel Logs / Maintenance Logs / GPS History

## Design rule
Do not store multiple unrelated IDs in comma-separated columns. Use proper assignment/junction tables for many-to-many relationships.

# GURMAD WASTE MANAGEMENT
# Complete Business Rules & System Rules
**Version:** 2.0  
**Status:** Final Working Specification  
**System:** Online Waste Management & Business Management Platform  
**Region:** Togdheer

---

## 1. Purpose

This document defines the business rules that must control the Gurmad Waste Management system. These rules are the source of truth for database design, API behavior, permissions, UI workflows, mobile apps, accounting and reports.

---

# 2. General System Rules

**BR-001 — Online System**  
The system is online and uses a central database.

**BR-002 — Single Source of Truth**  
Customer, house, task, payment, invoice, cashout and accounting data must have one authoritative record.

**BR-003 — API Access**  
Web and mobile clients must access business data through the backend API and never directly through PostgreSQL.

**BR-004 — Audit Trail**  
Important create, update, approve, reject, payment, cashout, financial and permission actions must be logged.

**BR-005 — No Silent Deletion**  
Historical financial and operational records must not be silently deleted. Use inactive, cancelled, reversed or archived states.

**BR-006 — Company Identity**  
Official generated documents must use the approved Gurmad Waste Management logo, company name and approved brand colors.

---

# 3. Company & Zone Rules

**BR-007 — Zone Ownership**  
Every customer/house used for collection must belong to a zone.

**BR-008 — Multiple Trucks**  
A zone can have multiple trucks. There is no fixed one-truck limit.

**BR-009 — Multiple Drivers**  
A zone can have multiple drivers.

**BR-010 — Multiple Collectors**  
A zone can have 7 or more collectors or any number required by operations.

**BR-011 — Multiple Cashiers**  
A zone can have 7 or more cashiers or any number required by operations.

**BR-012 — Multiple Operational Resources**  
A zone may contain many trucks, drivers, collectors and cashiers simultaneously. The system must use one-to-many/many-to-many assignment structures where operationally required.

**BR-013 — Daily Workforce Assignment**  
Being registered in a zone does not automatically mean a staff member works every day. Staff can be Active, Off, Leave, Suspended or assigned to another approved task/shift.

**BR-014 — Zone Chairman**  
A Zone Chairman manages the assigned zone only.

**BR-015 — Zone Head Cashier Scope**  
A Head of Cashiers manages cashiers and cashout activity within the assigned zone only.

**BR-016 — Admin Visibility**  
Admin has company-wide visibility across all zones and modules.

---

# 4. Staff Pool & Assignment Rules

**BR-017 — Staff Pool**  
Each zone maintains a pool of available drivers, collectors and cashiers.

**BR-018 — Assignment vs Registration**  
Zone membership and daily task assignment are separate records.

**BR-019 — Truck Team**  
A truck can be assigned an operational driver and one or more collectors according to the company's working model.

**BR-020 — Multiple Teams**  
A zone may operate several truck teams at the same time.

**BR-021 — Temporary Assignment**  
Staff can receive temporary daily/shift assignments without changing their permanent employment/zone record.

**BR-022 — Assignment History**  
Every truck, driver, collector and cashier assignment must retain start date, end date, status and responsible user.

---

# 5. Customer & House Rules

**BR-023 — Unique Customer ID**  
Each customer must have a unique system ID.

**BR-024 — House Identification**  
Each registered house must have a unique house/reference number.

**BR-025 — Address**  
House records should include house number, street, area, zone and GPS where available.

**BR-026 — Customer History**  
Customer and house service/payment history must remain available according to retention policy.

**BR-027 — Customer Status**  
Customers may be Active, Inactive, Suspended or Archived.

**BR-028 — Zone Assignment**  
A customer can only be collected through an operational zone assignment.

---

# 6. Collector Rules

**BR-029 — Collector Responsibility**  
Collector's main responsibility is waste collection.

**BR-030 — No Financial Visibility**  
Collector must not see invoice amounts, payment amounts, debts, balances, cash, ZAAD, eDahab, cashout or accounting information.

**BR-031 — Collection Task**  
Collector receives assigned houses/customers, route, truck and schedule.

**BR-032 — Collection Status**  
Collector can mark a house as Serviced, Missed, Skipped or Rescheduled.

**BR-033 — Multiple Collectors**  
A zone can send 7 or more collectors to work at the same time.

**BR-034 — Collector Performance**  
Performance is measured using assigned, serviced, missed, skipped and completed houses/tasks, not money collected.

---

# 7. Batch Collection Rules

**BR-035 — Batch Assignment**  
A zone does not have to serve all customers in one day.

**BR-036 — Truck Capacity**  
Daily assignments should respect the operational capacity of the assigned truck.

**BR-037 — Example**  
If a zone has 600 customers and a truck can serve 300 houses, the system can create:
- Batch 1: 300
- Batch 2: 300

**BR-038 — Smaller Batches**  
If capacity is lower, the 600 can be split into smaller batches.

**BR-039 — Multiple Trucks**  
If multiple trucks are available, multiple batches/routes can operate simultaneously.

**BR-040 — Remaining Houses**  
Unassigned/unserviced houses remain available for future scheduling.

**BR-041 — Collection History Check**  
Before assigning a house, the system must show its previous service history.

**BR-042 — Previous Day Visibility**  
The system must distinguish houses serviced on previous days from houses not yet serviced.

**BR-043 — Duplicate Service Warning**  
If a house was recently serviced, the system should warn the dispatcher before assigning it again unless repeat service is intentionally scheduled.

**BR-044 — Recurring Service**  
If Gurmad uses recurring collection schedules, the system must determine whether a house is Due, Serviced, Overdue or Not Yet Serviced for the current cycle.

---

# 8. Task Rules

**BR-045 — Task Contents**  
A collection task may contain zone, truck, driver, collector(s), route, houses, date and schedule.

**BR-046 — Task Status**  
Pending → In Progress → Completed.

Additional statuses may include Partially Completed, Cancelled and Rescheduled.

**BR-047 — House Status**  
Not Serviced, Serviced, Missed, Skipped, Rescheduled.

**BR-048 — Partial Task**  
A task can be Partially Completed when only some assigned houses are serviced.

**BR-049 — Completion Evidence**  
Where required, the system can store GPS/time/operator information for service completion.

---

# 9. Route Rules

**BR-050 — Zone Route**  
Routes must belong to a zone or operational assignment.

**BR-051 — Route Stops**  
Each route contains ordered houses/stops.

**BR-052 — Route Capacity**  
Route planning should consider truck capacity and schedule.

**BR-053 — Route History**  
Completed route history must be retained.

**BR-054 — Live Progress**  
Admin should see assigned, completed and remaining houses.

---

# 10. Cashier Rules

**BR-055 — Cashier Responsibility**  
Cashier is responsible for collecting customer payments.

**BR-056 — Multiple Cashiers**  
A zone may have 7 or more cashiers.

**BR-057 — Customer Portfolio**  
Cashier can be assigned a portfolio of customers for payment collection.

**BR-058 — Assigned Scope**  
Cashier should only see customers/payment records within the permitted zone and assigned portfolio.

**BR-059 — Balance Visibility**  
Cashier can see invoice amount, paid amount, outstanding balance and payment history for permitted customers.

**BR-060 — Customer Debt List**  
Cashier must have a list of customers who owe money within the permitted portfolio.

**BR-061 — Collection Does Not Mean Full Payment**  
A cashier can record full, partial or no payment.

---

# 11. Payment Rules

**BR-062 — Supported Methods**  
Cash, ZAAD and eDahab.

**BR-063 — Supported Currency**  
SLSH and USD.

**BR-064 — Payment Reference**  
Digital transactions should store provider transaction/reference ID when available.

**BR-065 — Duplicate Protection**  
The system must prevent duplicate payment posting.

**BR-066 — Payment Status**  
Pending, Confirmed, Failed, Expired, Reversed.

**BR-067 — Payment-to-Invoice Link**  
Every confirmed customer payment must be linked to an invoice/customer record.

---

# 12. Partial Payment & Debt Rules

**BR-068 — Partial Payment**  
If invoice is $20 and customer pays $10:
Paid = $10, Balance = $10, Status = Partial.

**BR-069 — Full Payment**  
When total confirmed payments equal invoice amount, status becomes Paid.

**BR-070 — Unpaid**  
If no confirmed payment exists, status is Unpaid.

**BR-071 — Overdue**  
If the due date passes with an outstanding balance, status may become Overdue.

**BR-072 — Outstanding Formula**  
Outstanding = Invoice Total − Confirmed Payments − Approved Credits/Adjustments.

**BR-073 — Debt History**  
Historical debt and payments must remain traceable.

---

# 13. USSD / Mobile Money Rules

**BR-074 — Payment Request**  
Cashier can initiate an approved mobile-money payment request.

**BR-075 — Customer Authorization**  
Customer authorizes the transaction through the provider's secure process.

**BR-076 — PIN Rule**  
Gurmad must never store or request the customer's mobile-money PIN in its own database.

**BR-077 — Callback**  
Provider callbacks must be validated and processed idempotently.

---

# 14. Cash Rules

**BR-078 — Cash Collection**  
Cashier collects cash from customers.

**BR-079 — Cash Recording**  
Cash payment must be recorded against the relevant customer/invoice.

**BR-080 — Cash Verification**  
Cash is verified during cashout.

**BR-081 — Cash Variance**  
Any difference between expected and actual cash must be recorded with reason and audit trail.

---

# 15. Cashout Rules

**BR-082 — Cashier Submission**  
Cashier prepares and submits a collection batch/cashout.

**BR-083 — Head of Cashiers**  
Head of Cashiers manages cashout for the assigned zone.

**BR-084 — Zone Scope**  
Head of Cashiers cannot manage another zone unless explicitly authorized by Admin.

**BR-085 — Cashout Review**  
Review cash, ZAAD, eDahab, currencies, customer count and totals.

**BR-086 — Approval**  
Cashout must follow an approval workflow.

**BR-087 — Signature**  
Cashout form must contain signature/approval fields.

**BR-088 — PDF**  
Cashout form must be downloadable as PDF.

**BR-089 — Signed Upload**  
Signed cashout form can be uploaded back to the system.

**BR-090 — Archive**  
The approved signed document must be retained in the document archive.

**BR-091 — Cashout States**  
Draft, Submitted, Under Review, Approved, Rejected, Signed, Uploaded, Archived.

---

# 16. Accounting Rules

**BR-092 — Accounting Integration**  
Approved financial transactions must feed accounting records through controlled posting.

**BR-093 — Chart of Accounts**  
System must support a Chart of Accounts.

**BR-094 — General Ledger**  
System must support General Ledger transactions.

**BR-095 — Accounts Receivable**  
Customer invoices and outstanding balances feed Accounts Receivable.

**BR-096 — Accounts Payable**  
Approved supplier/company obligations feed Accounts Payable.

**BR-097 — Trial Balance**  
System must produce Trial Balance.

**BR-098 — Profit & Loss**  
Revenue − Expenses = Profit/Loss.

**BR-099 — Balance Sheet**  
System must produce assets, liabilities and equity reporting.

**BR-100 — Cash Flow**  
System must produce operating cash movement and closing balance reporting.

**BR-101 — Periods**  
Reports must support Daily, Weekly, Monthly, Quarterly, Six Months, Annual and Custom periods.

---

# 17. Currency Rules

**BR-102 — SLSH**  
Somaliland Shilling is supported.

**BR-103 — USD**  
US Dollar is supported.

**BR-104 — Exchange Rate**  
Authorized finance users can define exchange rates.

**BR-105 — Historical Rate**  
Historical transactions retain the rate used at transaction time.

**BR-106 — No Historical Recalculation**  
Changing today's rate must not change historical transaction amounts.

---

# 18. Expense Rules

**BR-107 — Expense Categories**  
Fuel, maintenance, salaries, rent, utilities, procurement, equipment and other approved categories.

**BR-108 — Expense Record**  
Expense must contain amount, currency, category, date, description, creator and status.

**BR-109 — Supporting Document**  
Where required, receipt/supporting document must be attachable.

**BR-110 — Approval**  
Expenses can require approval according to company policy.

---

# 19. Financial Reporting Rules

**BR-111 — Daily Report**  
System must show daily income, expenses, collections and cash movement.

**BR-112 — Weekly Report**  
System must aggregate seven-day activity.

**BR-113 — Monthly Report**  
System must provide monthly financial and operational summaries.

**BR-114 — Six-Month Report**  
System must support six-month financial reporting.

**BR-115 — Annual Report**  
System must support year-end reporting.

**BR-116 — Custom Period**  
Authorized users can select custom date ranges.

**BR-117 — Company-wide Admin Report**  
Admin can view all zones and company totals.

**BR-118 — Zone Report**  
Zone roles see only permitted zone data.

---

# 20. Map & GPS Rules

**BR-119 — Registered Houses**  
Map can display registered houses.

**BR-120 — Customer Locations**  
Map can display customer GPS locations.

**BR-121 — Zones**  
Map can display zone boundaries.

**BR-122 — Trucks**  
Map can display active trucks.

**BR-123 — Live Truck Tracking**  
Admin can monitor where a working truck is when GPS is available.

**BR-124 — Truck Detail**  
Truck detail can show truck, plate, zone, driver, collector, route, progress and last GPS update.

**BR-125 — Route History**  
Authorized users can review historical routes.

**BR-126 — Zone Map Scope**  
Zone roles see their permitted zone only.

---

# 21. Document Rules

**BR-127 — Company Branding**  
Every official generated document must include Gurmad logo, company name and approved contact/brand information.

**BR-128 — Invoice**  
Invoices must have unique invoice numbers.

**BR-129 — Receipt**  
Confirmed payments can generate receipts.

**BR-130 — Quotation**  
Quotations must have unique quotation numbers and status.

**BR-131 — Cashout Form**  
Cashout forms must contain financial totals, signatures and approval information.

**BR-132 — Document Lifecycle**  
Create → Preview → Generate → Download/Print → Sign → Upload → Approve → Archive.

**BR-133 — Document Versioning**  
Signed copies and revised versions must retain history.

---

# 22. Complaint Rules

**BR-134 — Customer Complaint**  
Customer can submit a complaint.

**BR-135 — Complaint Status**  
Open, Under Review, Assigned, In Progress, Resolved, Closed.

**BR-136 — Zone Assignment**  
Complaint should be routed to the responsible zone/team.

---

# 23. Notification Rules

**BR-137 — Invoice Notification**  
Customer can receive invoice notification.

**BR-138 — Payment Notification**  
Confirmed payment can trigger receipt/notification.

**BR-139 — Debt Reminder**  
System can send debt reminders.

**BR-140 — Task Notification**  
Collectors/drivers can receive task notifications.

**BR-141 — Cashout Notification**  
Cashout submission/approval/rejection can notify relevant staff.

---

# 24. Role Security Rules

**BR-142 — Admin**  
Full company visibility and configuration.

**BR-143 — Management**  
Company-wide monitoring and reporting according to permission.

**BR-144 — Zone Chairman**  
Assigned zone only.

**BR-145 — Zone Accountant**  
Assigned zone financial visibility according to permission.

**BR-146 — Head of Cashiers**  
Assigned zone cashiers and cashout only.

**BR-147 — Cashier**  
Assigned zone/customer payment portfolio only.

**BR-148 — Collector**  
Assigned operational tasks only; no financial data.

**BR-149 — Driver**  
Assigned truck/routes only.

**BR-150 — Customer**  
Own data only.

---

# 25. Security Rules

**BR-151 — Authentication**  
Protected operations require authentication.

**BR-152 — Authorization**  
Authentication alone is not sufficient; permission checks are required.

**BR-153 — Zone Scope**  
Zone-scoped roles must be filtered at API/database query level, not only hidden in the UI.

**BR-154 — Passwords**  
Passwords must never be stored as plain text.

**BR-155 — Mobile Money PIN**  
Mobile-money PIN must never be stored by Gurmad.

**BR-156 — Audit**  
Sensitive actions must be logged.

**BR-157 — Rate Limiting**  
Public/auth/payment endpoints must have appropriate rate limiting.

---

# 26. Data Integrity Rules

**BR-158 — Confirmed Payment**  
Confirmed payment cannot be silently edited.

**BR-159 — Reversal**  
Corrections use reversal/adjustment records.

**BR-160 — Approved Cashout**  
Approved cashout cannot be silently changed.

**BR-161 — Financial History**  
Financial history must remain traceable.

**BR-162 — Transaction Idempotency**  
Payment callbacks and other retryable financial operations must be idempotent.

---

# 27. Admin Monitoring Rules

**BR-163 — Full Company Dashboard**  
Admin dashboard must show company-wide operations and finances.

**BR-164 — Live Operations**  
Admin can monitor active trucks, routes and collection progress.

**BR-165 — Financial Movement**  
Admin can monitor money movement daily, weekly, monthly, six-month and annually.

**BR-166 — Staff Activity**  
Admin can monitor staff assignments and performance.

**BR-167 — Exceptions**  
Admin dashboard should highlight overdue debts, missed collections, GPS offline trucks, cashout variances, failed payments and unresolved complaints.

---

# 28. UI Rules

**BR-168 — Brand Preservation**  
Existing Gurmad logo and brand colors must be preserved.

**BR-169 — Modernization**  
UI may be redesigned to improve usability and visual quality without changing approved business rules.

**BR-170 — Collector UI**  
Collector interface must prioritize task, route and houses.

**BR-171 — Cashier UI**  
Cashier interface must prioritize customer search, balances and fast payment collection.

**BR-172 — Admin UI**  
Admin interface must prioritize company-wide monitoring.

**BR-173 — Responsive**  
Staff and customer interfaces must work well on mobile.

---

# 29. Navigation Rules

**BR-174 — Current Navigation**  
The current React activeView state-based navigation remains the implementation approach for this phase.

**BR-175 — Page Registry**  
Pages should be organized through a central page/view registry to avoid large conditional blocks.

**BR-176 — Portal Separation**  
Admin, Staff and Customer views must enforce their own allowed navigation.

---

# 30. Online Update Rules

**BR-177 — Source Control**  
All code changes use Git.

**BR-178 — Environments**  
Development → Staging → Production.

**BR-179 — Database Migration**  
Schema changes must be versioned.

**BR-180 — Testing Before Release**  
Critical financial/security changes must be tested before production.

**BR-181 — Documentation Update**  
Major changes must update the relevant documentation and change log.

---

# 31. Final Master Workflow

## Operations
Zone → Customers/Houses → Trucks → Drivers + Collectors → Batch Task → Route → Waste Collection → Collection History.

## Money
Serviced Customers → Assigned Cashier → Invoice → Cash/ZAAD/eDahab → Payment Record → Customer Balance.

## Cashout
Cashier → Head of Cashiers → Verification → Approval → Signed Form → Upload → Accountant → Financial Reports.

## Management
Admin → Company Dashboard → Operations + Fleet + Customers + Finance + HR + Procurement + Documents + Reports + GPS.

---

# 32. Non-Negotiable Rules

1. Collector does not collect money.
2. Collector does not see financial information.
3. Cashier collects customer payments.
4. One zone can have 7+ cashiers.
5. One zone can have 7+ collectors.
6. One zone can have multiple trucks.
7. One zone can have multiple drivers.
8. Staff pool and daily assignment are separate.
9. Truck capacity controls batch planning unless authorized override is used.
10. Previous collection history must be visible.
11. System must distinguish serviced and unserviced houses.
12. Cashier must see unpaid and partial balances for permitted customers.
13. Head of Cashiers controls cashout for assigned zone.
14. Zone Chairman is zone-scoped.
15. Admin has company-wide visibility.
16. SLSH and USD are supported.
17. Cash, ZAAD and eDahab are supported.
18. Mobile-money PIN is never stored by Gurmad.
19. Confirmed financial records cannot be silently edited.
20. Official documents use Gurmad branding.
21. Cashout forms support approval, signature, download, upload and archive.
22. Admin can monitor live truck location when GPS is available.
23. Reports must cover daily, weekly, monthly, six-month, annual and custom periods.
24. Accounting must support P&L, Balance Sheet, Cash Flow, Trial Balance, AR and AP.
25. UI may be redesigned, but Gurmad logo/colors and business rules remain.

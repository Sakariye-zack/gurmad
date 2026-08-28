# Non-Functional Requirements

## Security
HTTPS, JWT, RBAC, zone scoping, bcrypt hashing, 2FA for privileged users, rate limiting, Helmet, audit logs and secure file handling.

## Performance
Indexed SQL, pagination, filtering, efficient queries, cached summaries where appropriate and controlled GPS frequency.

## Reliability
Automated backups, monitoring, health checks and tested restore procedures.

## Scalability
Support growth in customers, houses, zones, staff, trucks, transactions and GPS events.

## Usability
Responsive Admin Portal and mobile-first Staff/Customer portals.

## Data Integrity
Confirmed payments and approved cashouts cannot be silently changed. Corrections use controlled reversal/adjustment workflows.

## Offline
Collector operational tasks may support offline caching/synchronization. Final financial transactions should require confirmation and idempotency.

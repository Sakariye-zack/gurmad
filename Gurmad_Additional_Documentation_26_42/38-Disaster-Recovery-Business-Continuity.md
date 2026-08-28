# 38. Disaster Recovery & Business Continuity

## Backup
Automated database backups plus encrypted off-site backup where possible.

## Recovery objectives
Management should define RPO and RTO according to business needs.

## Recovery scenarios
- Server failure
- Database corruption
- Accidental deletion
- Security incident
- Payment integration outage
- Internet outage

## Recovery process
Detect → isolate → restore/repair → validate data → resume service → document incident.

## Testing
Restore tests must be performed periodically. A backup is not considered reliable until restoration has been tested.

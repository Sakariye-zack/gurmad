# Security, Backup & Deployment

## Current security
JWT, bcryptjs, Helmet, rate limiting and Speakeasy 2FA.

## Requirements
- HTTPS.
- Secure token handling.
- RBAC and zone scoping.
- Parameterized SQL.
- Upload validation.
- Audit logs.
- Secure secrets.
- No storage of mobile-money PINs.

## Backup
Automated PostgreSQL backups, encrypted storage, restore testing and recovery procedures.

## Production
DigitalOcean, Nginx, PM2 and Supabase PostgreSQL.

## Deployment
Git → dependency install → frontend build → migration if required → PM2 restart → health check.

## Monitoring
CPU/RAM/disk, API errors, DB health, payment failures, GPS failures and backup status.

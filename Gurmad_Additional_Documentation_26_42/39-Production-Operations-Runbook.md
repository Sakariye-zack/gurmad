# 39. Production Operations Runbook

## Current infrastructure
DigitalOcean Droplet, Nginx, PM2, React build, Node/Express API and Supabase PostgreSQL.

## Deployment
Git pull → install dependencies → database migration if required → build frontend → restart PM2 → health check.

## Monitoring
CPU, RAM, disk, API errors, PM2 status, Nginx errors, database availability, payment failures and GPS failures.

## Rollback
Keep previous known-good build/commit and database migration rollback plan.

## Incident handling
Identify → assess impact → protect data → fix/rollback → verify → document.

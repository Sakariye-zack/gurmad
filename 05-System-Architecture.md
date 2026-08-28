# System Architecture

## Current architecture
Monolithic Node.js/Express backend with one React build, three runtime portals and central PostgreSQL.

## Frontend
React 19.2 + Vite 8. Navigation remains activeView state-based.

## Backend
Node.js 20 + Express 5. Raw SQL via pg. No ORM.

## Database
PostgreSQL 18 hosted on Supabase.

## Realtime
Socket.IO for operational and system events.

## Integrations
- Waafi/ZAAD API
- eDahab where an approved API integration is available
- Twilio SMS/WhatsApp
- Google Maps geocoding
- Leaflet/react-leaflet
- PWA services

## Production
DigitalOcean Droplet → Nginx → PM2 → Express/static React → Supabase PostgreSQL.

## Rule
Clients never connect directly to the database.

## Maintenance direction
Do not migrate to microservices now. First modularize server code internally if server/index.js becomes too large.

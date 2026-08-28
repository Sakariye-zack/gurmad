# Gurmad Waste Management — Complete Documentation v3
**Status:** Final working specification  
**System:** Online Smart Waste Management & Business Management Platform  
**Company:** Gurmad Waste Management  
**Region:** Togdheer

## Source of truth
This package consolidates the business rules, current technology stack, existing architecture, required features, UI/UX direction, accounting, documents, maps, mobile portals, security, testing and implementation roadmap.

## Current technology stack
React 19.2 + Vite 8; Node.js 20 + Express 5; PostgreSQL 18 on Supabase; raw SQL with pg; JWT; bcryptjs; Multer; Helmet; express-rate-limit; Socket.IO; node-cron; Speakeasy; QRCode; Twilio; Waafi/ZAAD; Google Maps API; Leaflet/react-leaflet; Recharts; jsPDF; Framer Motion.

## Current architecture
One React codebase, three runtime portals, one Express server and one PostgreSQL database. Navigation remains state-based through activeView. React Router is not required in this phase.

## Core business workflow
Zone → Customers/Houses → Truck → Driver + Collector → Collector Task → Waste Collection → Cashier → Payment → Head of Cashiers → Cashout → Accountant → Reports.

## Critical business rules
- Collector collects waste only and has no financial visibility.
- Cashier collects customer payments.
- A zone can have 7 or more cashiers.
- Cashier sees assigned customers, invoices, paid, partial, unpaid and outstanding balances.
- Head of Cashiers manages cashout for the assigned zone.
- Zone Chairman manages only the assigned zone.
- Admin has company-wide visibility.
- Customers/houses can be serviced in batches based on truck capacity.
- Collection history must show which houses were serviced on previous days and which remain unserviced.
- All official documents use Gurmad branding and support PDF download, print, signature and signed-copy upload.
- Accounting must support daily, weekly, monthly, quarterly, six-monthly, yearly and custom reporting.

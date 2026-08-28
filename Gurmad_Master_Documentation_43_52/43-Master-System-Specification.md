# 43. Master System Specification

## Purpose
This is the top-level specification connecting the complete Gurmad documentation set.

## System
Gurmad Waste Management is an online Waste Collection, Customer, Payment, Accounting, Fleet and Business Management Platform.

## Architecture
React 19.2 + Vite 8 frontend; Node.js 20 + Express 5 backend; PostgreSQL 18/Supabase; raw SQL with pg; Socket.IO; JWT; PWA/mobile-first staff and customer portals.

## Core chain
Zones → Customers/Houses → Trucks → Drivers/Collectors → Tasks/Routes → Waste Collection → Cashiers → Payments/Debts → Head of Cashiers → Cashout → Accounting → Reports.

## Source of truth
Business Rules define behavior; SRS defines requirements; Database documents define data; API documents define interfaces; UI documents define screens; QA defines acceptance.

## Current implementation principle
Keep the current React activeView state-based navigation. Improve structure and UI without unnecessary framework migration.

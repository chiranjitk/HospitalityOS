---
Task ID: 1
Agent: Main Setup Agent
Task: Fresh setup of StaySuite-HospitalityOS from scratch

Work Log:
- Cloned StaySuite-HospitalityOS repo from GitHub to /home/z/my-project
- Installed dependencies with bun install (1060 packages)
- Installed PM2 globally (v7.0.1)
- Initialized PostgreSQL 17 data directory and started on port 5432
- Created postgres superuser (password: postgres) and staysuite user (password: Staysuite2025)
- Created staysuite database with staysuite owner
- Created CITEXT extension before Prisma tables
- Ran prisma db push (471 tables created with proper RADIUS extended columns)
- Loaded complete-database.sql (4 helper tables, 6 views, 55 functions)
- Verified FreeRADIUS compiled installation at freeradius-install/ with -D flag for dictionary
- Verified SQL module enabled with correct PostgreSQL connection settings
- Created PM2 ecosystem config with FreeRADIUS and Next.js apps
- Started PostgreSQL manually via pg_ctl, FreeRADIUS and Next.js via PM2
- Ran seed.ts successfully — all data seeded (tenants, properties, guests, bookings, WiFi plans, RADIUS users)
- Verified all services: PostgreSQL (port 5432), FreeRADIUS (port 1812), Next.js (port 3000, HTTP 200)

Stage Summary:
- ✅ PostgreSQL 17.4: Running on port 5432 (477 tables, 6 views, 8 functions)
- ✅ FreeRADIUS 3.2.7: Running via PM2 (ports 1812/1813)
- ✅ Next.js 16: Running via PM2 on port 3000 (HTTP 200 verified)
- ✅ All seed data loaded (admin users, properties, WiFi plans, RADIUS groups)
- Seed data: 2 tenants, 2 properties, 6 guests, 6 bookings, 99 rooms, 8 WiFi users, 6 WiFi plans, 7 RADIUS users
- Demo credentials: admin@royalstay.in / admin123

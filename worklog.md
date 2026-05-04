---
Task ID: 1
Agent: Main Setup Agent
Task: Fresh setup of StaySuite-HospitalityOS on sandbox

Work Log:
- Cloned repository from GitHub to /home/z/my-project
- Installed bun dependencies (1212 packages)
- Installed PM2 globally (v7.0.1)
- Initialized PostgreSQL data directory at pgsql-data (symlinked from pgsql-runtime/data)
- Started PostgreSQL on port 5432 (postgres/postgres)
- Created staysuite database
- Enabled citext extension before Prisma push
- Ran prisma db push to create 274+ Prisma-managed tables
- Loaded complete-database.sql (6 views, 8 functions, 4 helper tables)
- Added RADIUS extended columns (id, wifiUserId, isActive, createdAt, updatedAt) to radcheck, radreply, radusergroup
- Verified FreeRADIUS already compiled at freeradius-install/
- Created symlink for FreeRADIUS dictionary (/home/z/freeradius-install/share -> project dir)
- Fixed PM2 ecosystem.config.cjs DATABASE_URL to use postgres/postgres
- Started FreeRADIUS and Next.js via PM2
- Ran seed.ts — all demo data seeded successfully
- Verified all services: PostgreSQL (running), FreeRADIUS (online), Next.js (200 OK)
- Verified admin users exist in database

Stage Summary:
- PostgreSQL 17 running on port 5432 (277 tables)
- FreeRADIUS v3.2.7 running via PM2 (config OK)
- Next.js dev server running via PM2 on port 3000 (HTTP 200)
- PM2 managing staysuite-freeradius and staysuite-nextjs
- Admin login: admin@royalstay.in / admin123
- Platform admin: platform@staysuite.com / admin123
- All 6 WiFi plans, 8 WiFi users, RADIUS credentials seeded
- Complete hospitality demo data seeded (rooms, bookings, guests, etc.)

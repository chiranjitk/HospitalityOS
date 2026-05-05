---
Task ID: 1
Agent: Main Setup Agent
Task: Fresh setup of StaySuite-HospitalityOS from scratch

Work Log:
- Cloned repo from GitHub (chiranjitk/StaySuite-HospitalityOS) into /home/z/my-project
- Ran `bun install` — installed 1212 packages
- Installed PM2 globally via npm
- Initialized PostgreSQL 17 at pgsql-runtime/data (symlink to pgsql-data)
- Started PostgreSQL on port 5432 (manual via pg_ctl, not PM2)
- Created `staysuite` database and `z` role
- Enabled CITEXT extension
- Ran `prisma db push` — created all ~274 Prisma-managed tables
- Loaded `pgsql-production/complete-database.sql` — added 4 helper tables, 6 reporting views, 8 DB functions
- Verified FreeRADIUS v3.2.7 already compiled at freeradius-install/
- Fixed FreeRADIUS dictionary path issue with `-D` flag
- Verified FreeRADIUS config test passes ("Configuration appears to be OK")
- Confirmed PM2 ecosystem.config.cjs already configured correctly
- Ran database seed (`bun prisma/seed.ts`) — seeded all demo data including admin users
- Started all services: PostgreSQL (manual), FreeRADIUS + Next.js (PM2)
- Verified all services: PostgreSQL (277 tables, 6 views, 8 functions), FreeRADIUS (online), Next.js (HTTP 200)

Stage Summary:
- All services running: PostgreSQL (5432), FreeRADIUS (1812/1813), Next.js (3000)
- PM2 managing: staysuite-freeradius, staysuite-nextjs
- Admin login: admin@royalstay.in / admin123
- Platform admin: platform@staysuite.com / admin123
- Database fully seeded with comprehensive demo data (44 WiFi categories, properties, rooms, guests, bookings, etc.)

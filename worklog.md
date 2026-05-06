---
Task ID: 1
Agent: Main Setup Agent
Task: Setup StaySuite-HospitalityOS from scratch on fresh sandbox

Work Log:
- Cloned repo from GitHub (git clone with token auth)
- Ran `bun install` (1212 packages) and `npm install -g pm2` (v7.0.1)
- Initialized PostgreSQL 17 data directory at pgsql-data/ (was missing symlink target)
- Created postgres superuser with password 'postgres'
- Created staysuite database
- Enabled CITEXT extension
- Set trust auth in pg_hba.conf for localhost
- Ran `npx prisma db push --accept-data-loss` (created 277 tables including extended RADIUS columns)
- Loaded pgsql-production/complete-database.sql (4 helper tables, 6 views, 8 functions)
- FreeRADIUS v3.2.7 already compiled at freeradius-install/
- Fixed FreeRADIUS config test with -D flag for dictionary directory
- Verified FreeRADIUS SQL module config (PostgreSQL connection, accounting queries, etc.)
- PM2 ecosystem.config.cjs already existed with correct config
- Started all 4 PM2 services: freeradius, nextjs, captive-redirect, realtime
- Ran seed.ts successfully (all demo data including admin users)
- Verified: PostgreSQL ✓, FreeRADIUS ✓ (online 0 restarts), Next.js ✓ (HTTP 200), PM2 ✓ (all online)

Stage Summary:
- All services running: PostgreSQL (port 5432), FreeRADIUS (ports 1812/1813), Next.js (port 3000), Captive Redirect (port 8888), Realtime (port 3003)
- 277 database tables, 6 views, 8 functions
- Admin login: admin@royalstay.in / admin123
- Platform admin: platform@staysuite.com / admin123
- nftables warning expected (sandbox kernel limitation, session engine runs in fallback mode)

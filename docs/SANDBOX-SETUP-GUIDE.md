# StaySuite-HospitalityOS — Fresh Sandbox Setup Guide (FIXED)

> **Version:** 2.0 — Fixed edition with all known sandbox issues resolved.
> **Last tested:** May 2026 on fresh sandbox environment.
> **Commit base:** `05e66b57` (main branch)

---

## Table of Contents

1. [Clone Repo](#step-1-clone-repo)
2. [Install Dependencies](#step-2-install-dependencies)
3. [Create .env File](#step-3-create-env-file)
4. [Setup PostgreSQL](#step-4-setup-postgresql)
5. [Load Database Schema](#step-5-load-database-schema)
6. [FreeRADIUS (Already Compiled)](#step-6-freeradius-already-compiled)
7. [Start Services via PM2](#step-7-start-services-via-pm2)
8. [Verify Everything](#step-8-verify-everything)
9. [Project Architecture Reference](#project-architecture)
10. [Troubleshooting](#troubleshooting)

---

## Step 1: Clone Repo

```bash
cd /home/z/

# ⚠️ CANNOT use `rm -rf my-project` + `git clone` because:
#   - `upload/` is a bind mount (Device or resource busy)
#   - `.next/dev/` may be locked
# Use the init+fetch workaround instead:

cd /home/z/my-project
git init
git remote add origin https://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@github.com/chiranjitk/StaySuite-HospitalityOS.git
git fetch origin
git checkout -f main
```

**Verify:**
```bash
ls -la /home/z/my-project/package.json  # Should exist
ls -la /home/z/my-project/freeradius-install/sbin/radiusd  # Should exist (pre-compiled)
ls -la /home/z/my-project/pgsql-runtime/bin/pg_ctl  # Should exist (pre-compiled)
```

---

## Step 2: Install Dependencies

```bash
cd /home/z/my-project
bun install
npm install -g pm2
```

**Expected:** ~1221 packages installed in ~20s. PM2 installed globally.

---

## Step 3: Create .env File

> ⚠️ **MOVED UP from Step 5.** This MUST exist before any Prisma or database commands.

```bash
cat > /home/z/my-project/.env << 'EOF'
# =============================================================================
# StaySuite HospitalityOS - Development / Sandbox Environment
# =============================================================================

# Runtime
NODE_ENV=development
PORT=3000
SANDBOX_MODE=true

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Database (PostgreSQL) — MUST match staysuite user credentials
DATABASE_URL=postgresql://staysuite:Staysuite2025@localhost:5432/staysuite

# Authentication & Security (dev only — NOT for production)
NEXTAUTH_SECRET=dev-secret-do-not-use-in-production-replace-with-64-chars
CRON_SECRET=dev-cron-secret-replace-with-48-chars
ENCRYPTION_KEY=dev-encryption-key-replace-with-base64-64-chars
SERVICE_AUTH_SECRET=dev-service-secret-replace-with-48-chars

# FreeRADIUS
RADIUS_SERVER=localhost
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_SECRET=testing123

# Demo
NEXT_PUBLIC_DEMO_MODE=true
EOF
```

---

## Step 4: Setup PostgreSQL

### 4a. Initialize Data Directory (first time only)

```bash
export LD_LIBRARY_PATH="/home/z/my-project/pgsql-runtime/lib:$LD_LIBRARY_PATH"

# If data/ does NOT exist, initialize it:
if [ ! -d /home/z/my-project/pgsql-runtime/data ]; then
  /home/z/my-project/pgsql-runtime/bin/initdb \
    -D /home/z/my-project/pgsql-runtime/data \
    --auth=trust --username=postgres
fi
```

### 4b. Start PostgreSQL

```bash
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
export LD_LIBRARY_PATH="/home/z/my-project/pgsql-runtime/lib:$LD_LIBRARY_PATH"

# ⚠️ CRITICAL: Create socket directory FIRST (pg_ctl fails without it)
mkdir -p /tmp/.s.PGSQL.5432

# Check if already running
pg_isready -h localhost -p 5432 > /dev/null 2>&1 && echo "Already running" || {
  pg_ctl -D /home/z/my-project/pgsql-runtime/data \
    -l /home/z/my-project/pgsql-runtime/pgsql.log \
    start -o "-p 5432 -k /tmp/.s.PGSQL.5432"
}
```

**Or use the bundled script (handles socket dir automatically):**
```bash
bash /home/z/my-project/pgsql-runtime/start-pgsql.sh start
```

### 4c. Create Database and User

```bash
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"

psql -h localhost -p 5432 -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE USER staysuite WITH PASSWORD 'Staysuite2025' SUPERUSER;"
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE staysuite OWNER staysuite;"
```

---

## Step 5: Load Database Schema

> ⚠️ **CRITICAL ORDERING:** `complete-database.sql` depends on Prisma-managed tables
> (WiFiSession, WiFiUser, Guest, Booking, Property, WiFiPlan, DeviceProfile, etc.).
> On a fresh database, these tables DON'T exist yet. You MUST run Prisma first.
>
> **After initial setup, NEVER run `prisma db push` again** — it will drop the custom
> extended columns on RADIUS tables (id, wifiUserId, isActive, createdAt, updatedAt).

### 5a. Enable citext Extension (before Prisma)

```bash
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
psql -h localhost -p 5432 -U postgres -d staysuite -c "CREATE EXTENSION IF NOT EXISTS citext;"
```

> **Why:** Prisma models use `citext` type (e.g., Guest.email). Without this extension,
> `prisma db push` fails with `type "citext" does not exist`.

### 5b. Run Prisma Schema Push (FRESH INSTALL ONLY)

```bash
cd /home/z/my-project
DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite" \
  bunx prisma db push --accept-data-loss
```

**Expected:** Creates ~274 Prisma-managed tables + all indexes. Takes ~2s.

### 5c. Run complete-database.sql

```bash
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
psql -h localhost -p 5432 -U postgres -d staysuite \
  -f /home/z/my-project/pgsql-production/complete-database.sql
```

**What this creates:**
| Object | Count | Details |
|--------|-------|---------|
| Helper tables | 4 | nas, nasreload, data_usage_by_period, fup_switch_log |
| Views | 6 | v_session_history, v_active_sessions, v_auth_logs, v_user_usage, v_wifi_users, v_fup_switch_logs |
| Functions | 8 | fn_check_ip_pool, fn_get_user_pool_info, fn_get_pool_attr, fn_check_fup, fn_check_login_limit, fn_get_effective_bandwidth, fn_get_mikrotik_rate_limit, fn_is_fup_throttled |
| DeviceProfile table | 1 | WiFi user device tracking |
| ALTER TABLE columns | 3+ | radpostauth.clientipaddress, FairAccessPolicy.throttleDownKbps/Up |

### 5d. (Optional) Seed Demo Data

```bash
cd /home/z/my-project
DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite" \
  npx tsx prisma/seed.ts
```

> **Or use the automated setup script:**
> ```bash
> bash /home/z/my-project/pgsql-production/setup.sh
> ```
> This script handles Steps 5a–5d automatically.

### 5e. Verify Schema

```bash
psql -h localhost -p 5432 -U postgres -d staysuite -c \
  "SELECT count(*) as tables FROM information_schema.tables WHERE table_schema='public';"
psql -h localhost -p 5432 -U postgres -d staysuite -c \
  "SELECT count(*) as views FROM pg_views WHERE schemaname='public';"
```

**Expected:** ~411 tables, 6 views.

---

## Step 6: FreeRADIUS (Already Compiled)

FreeRADIUS v3.2.7 is **already compiled** in the repo at `freeradius-install/`.
No need to download or compile from source.

### 6a. Verify Binary

```bash
ls -la /home/z/my-project/freeradius-install/sbin/radiusd  # Should exist
ls -la /home/z/my-project/freeradius-install/etc/raddb/mods-enabled/sql  # Symlink to SQL config
```

### 6b. Create Required Directories

```bash
mkdir -p /home/z/my-project/freeradius-install/var/run/radiusd
mkdir -p /home/z/my-project/freeradius-install/var/log/radius/radacct
```

### 6c. Verify SQL Module Config

```bash
cat /home/z/my-project/freeradius-install/etc/raddb/mods-enabled/sql | head -15
```

**Should show:**
```
server = "localhost"
port = 5432
login = "staysuite"
password = "Staysuite2025"
radius_db = "staysuite"
```

### 6d. Test Configuration

> ⚠️ **CRITICAL:** The `-D` flag is REQUIRED. The radiusd binary was compiled with a
> different prefix (`/home/z/freeradius-install/`) but actually lives at
> `/home/z/my-project/freeradius-install/`. Without `-D`, it looks for dictionaries
> in the wrong path and fails with:
> `Couldn't open dictionary "/home/z/freeradius-install/share/freeradius/dictionary"`

```bash
export LD_LIBRARY_PATH="/home/z/my-project/freeradius-install/lib:$LD_LIBRARY_PATH"

/home/z/my-project/freeradius-install/sbin/radiusd \
  -X -C \
  -d /home/z/my-project/freeradius-install/etc/raddb \
  -D /home/z/my-project/freeradius-install/share/freeradius \
  2>&1 | tail -5
```

**Expected output:** `Configuration appears to be OK`

> **ALL radiusd commands MUST include the `-D` flag:**
> | Flag | Purpose |
> |------|---------|
> | `-d <path>` | Config directory (`etc/raddb/`) |
> | `-D <path>` | Dictionary directory (`share/freeradius/`) |
> | `-f` | Foreground mode (for PM2) |
> | `-X` | Debug mode |
> | `-C` | Check config only |

---

## Step 7: Start Services via PM2

### 7a. Stop Any Existing Processes

```bash
pm2 kill 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "radiusd" 2>/dev/null
sleep 2
```

### 7b. Verify PostgreSQL is Running

```bash
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
pg_isready -h localhost -p 5432 || {
  echo "ERROR: PostgreSQL not running! Start it first (Step 4b)."
  exit 1
}
```

### 7c. Start FreeRADIUS + Next.js via PM2

The `ecosystem.config.cjs` already has the correct `-D` flag and LD_LIBRARY_PATH:

```bash
cd /home/z/my-project
pm2 start ecosystem.config.cjs
pm2 save
```

> **What PM2 starts:**
> | Service | Script | Port | Notes |
> |---------|--------|------|-------|
> | staysuite-freeradius | `radiusd -f -d ... -D ...` | 1812/1813 | Foreground, auto-restart |
> | staysuite-nextjs | `bun run dev` | 3000 | Dev server, auto-restart |
>
> **PostgreSQL is NOT managed by PM2** — it starts via `pg_ctl` (Step 4b).

### 7d. Check Status

```bash
pm2 status
```

**Expected:** Both services showing `online`, restart count = 0.

---

## Step 8: Verify Everything

Run all checks:

```bash
echo "=== 1. PostgreSQL ==="
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
psql -h localhost -p 5432 -U postgres -d staysuite -c "SELECT 1;" 2>&1
echo ""

echo "=== 2. Database Objects ==="
psql -h localhost -p 5432 -U postgres -d staysuite \
  -c "SELECT 'tables: ' || count(*) FROM information_schema.tables WHERE table_schema='public' UNION ALL SELECT 'views: ' || count(*) FROM pg_views WHERE schemaname='public';" 2>&1
echo ""

echo "=== 3. FreeRADIUS ==="
pm2 logs staysuite-freeradius --lines 5 --nostream 2>&1
grep "Ready to process requests" /home/z/my-project/freeradius-install/var/log/radius/radius.log 2>&1
echo ""

echo "=== 4. Next.js ==="
sleep 5  # Wait for compilation
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
echo ""

echo "=== 5. PM2 ==="
pm2 status
```

**All checks should pass:**
| Check | Expected |
|-------|----------|
| PostgreSQL `SELECT 1` | Returns `1` |
| Tables | ~411 |
| Views | 6 |
| FreeRADIUS | `Ready to process requests` |
| Next.js HTTP | `200` |
| PM2 status | Both `online`, 0 restarts |

---

## Project Architecture

### Tech Stack
- **Next.js 16** with App Router (TypeScript)
- **Tailwind CSS 4** + shadcn/ui (New York style) + Lucide icons
- **PostgreSQL 17** (bundled at `pgsql-runtime/`)
- **FreeRADIUS v3.2.7** (compiled at `freeradius-install/`)
- **PM2** for process management
- **Zustand** (client state) + **TanStack Query** (server state)

### Port Mapping
| Port | Service | Management |
|------|---------|------------|
| 3000 | Next.js dev server | PM2 |
| 1812 | FreeRADIUS auth | PM2 |
| 1813 | FreeRADIUS acct | PM2 |
| 5432 | PostgreSQL | Manual (pg_ctl) |

### Service Management
```bash
# PostgreSQL (manual)
bash /home/z/my-project/pgsql-runtime/start-pgsql.sh start|stop|restart|status

# FreeRADIUS + Next.js (PM2)
pm2 status
pm2 logs staysuite-freeradius --lines 20
pm2 logs staysuite-nextjs --lines 20
pm2 restart staysuite-freeradius
pm2 restart staysuite-nextjs
pm2 stop all
```

### Key Directories
```
my-project/
├── src/app/api/              # Next.js API routes
├── src/components/           # React components (shadcn/ui in ui/)
├── src/lib/                  # Utilities, services, DB client
├── prisma/schema.prisma      # Prisma schema (SOURCE for ~274 tables)
├── pgsql-production/
│   ├── complete-database.sql # SOURCE OF TRUTH for views/functions/helpers
│   ├── setup.sh              # Automated fresh setup script
│   └── deploy.sh             # Production deploy script
├── pgsql-runtime/
│   ├── bin/                  # PostgreSQL 17 binaries
│   ├── data/                 # Data directory (created by initdb)
│   └── start-pgsql.sh        # PG start/stop script
├── freeradius-install/
│   ├── sbin/radiusd          # FreeRADIUS binary
│   ├── etc/raddb/            # Config files
│   │   ├── mods-enabled/sql  # PostgreSQL connection config
│   │   └── sites-enabled/    # Virtual server configs
│   └── share/freeradius/     # Dictionary files
├── ecosystem.config.cjs      # PM2 sandbox/dev config
├── ecosystem.config.js       # PM2 production config
└── .env                      # Environment variables
```

### Database Schema Layering
```
Layer 1: Prisma (prisma db push)     → ~274 base tables
Layer 2: complete-database.sql       → +4 helper tables, +6 views, +8 functions
Layer 3: prisma/seed.ts              → Demo data (users, rooms, plans, etc.)
```

### RADIUS Table Extended Columns
> **After initial setup, NEVER run `prisma db push`** — it will drop these columns.

| Table | Extended Column | Type | Purpose |
|-------|----------------|------|---------|
| radcheck | id | uuid (PK) | Unique record ID |
| radcheck | wifiUserId | uuid | FK → WiFiUser |
| radcheck | isActive | boolean | Soft delete flag |
| radcheck | createdAt | timestamptz | Audit trail |
| radcheck | updatedAt | timestamptz | Audit trail |
| radreply | id | uuid (PK) | Unique record ID |
| radreply | wifiUserId | uuid | FK → WiFiUser |
| radreply | isActive | boolean | Soft delete flag |
| radreply | createdAt | timestamptz | Audit trail |
| radreply | updatedAt | timestamptz | Audit trail |
| radusergroup | id | uuid (PK) | Unique record ID |
| radusergroup | wifiUserId | uuid | FK → WiFiUser |
| radusergroup | isActive | boolean | Soft delete flag |
| radusergroup | createdAt | timestamptz | Audit trail |
| radusergroup | updatedAt | timestamptz | Audit trail |

---

## Troubleshooting

### Problem: `rm -rf my-project` fails
```
rm: cannot remove 'my-project/upload': Device or resource busy
```
**Fix:** Don't use `rm -rf`. Use the git init workaround (Step 1).

### Problem: PostgreSQL fails to start
```
FATAL: could not create lock file "/tmp/.s.PGSQL.5432/.s.PGSQL.lock": No such file or directory
```
**Fix:** `mkdir -p /tmp/.s.PGSQL.5432` before starting.

### Problem: `prisma db push` fails with citext error
```
ERROR: type "citext" does not exist
```
**Fix:** Run `CREATE EXTENSION IF NOT EXISTS citext;` in psql BEFORE prisma push.

### Problem: `complete-database.sql` fails with "relation does not exist"
```
ERROR: relation "WiFiSession" does not exist
ERROR: relation "WiFiUser" does not exist
```
**Fix:** Run `prisma db push` FIRST to create base tables, then run complete-database.sql.

### Problem: FreeRADIUS dictionary not found
```
Couldn't open dictionary "/home/z/freeradius-install/share/freeradius/dictionary": No such file or directory
```
**Fix:** Add `-D /home/z/my-project/freeradius-install/share/freeradius` to all radiusd commands.

### Problem: Prisma can't find DATABASE_URL
```
Error: the URL must start with the protocol "postgresql://"
```
**Fix:** Create `.env` file (Step 3) BEFORE running any Prisma commands. Or prefix:
```bash
DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite" bunx prisma db push
```

### Problem: PM2 shows stopped/restarting for FreeRADIUS
**Fix:** Check LD_LIBRARY_PATH in ecosystem.config.cjs. Must include:
```
/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius
```

### Problem: FreeRADIUS can't connect to PostgreSQL
```
rlm_sql_postgresql: Failed to connect to database
```
**Fix:** Verify credentials in `freeradius-install/etc/raddb/mods-enabled/sql`:
```
server = "localhost"
port = 5432
login = "staysuite"
password = "Staysuite2025"
radius_db = "staysuite"
```

---

## Quick Reference: One-Liner Full Setup

```bash
# From a FRESH sandbox (all in one go):
cd /home/z/my-project && \
git init && git remote add origin https://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@github.com/chiranjitk/StaySuite-HospitalityOS.git && \
git fetch origin && git checkout -f main && \
bun install && npm install -g pm2 && \
cat > .env << 'ENVEOF'
NODE_ENV=development
PORT=3000
SANDBOX_MODE=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://staysuite:Staysuite2025@localhost:5432/staysuite
NEXTAUTH_SECRET=dev-secret-do-not-use-in-production-replace-with-64-chars
CRON_SECRET=dev-cron-secret-replace-with-48-chars
ENCRYPTION_KEY=dev-encryption-key-replace-with-base64-64-chars
SERVICE_AUTH_SECRET=dev-service-secret-replace-with-48-chars
NEXT_PUBLIC_DEMO_MODE=true
ENVEOF
export PATH="/home/z/my-project/pgsql-runtime/bin:$PATH" && \
export LD_LIBRARY_PATH="/home/z/my-project/pgsql-runtime/lib:$LD_LIBRARY_PATH" && \
[ ! -d pgsql-runtime/data ] && pg_ctl initdb -D pgsql-runtime/data --auth=trust --username=postgres && \
mkdir -p /tmp/.s.PGSQL.5432 && \
pg_ctl -D pgsql-runtime/data -l pgsql-runtime/pgsql.log start -o "-p 5432 -k /tmp/.s.PGSQL.5432" && \
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE USER staysuite WITH PASSWORD 'Staysuite2025' SUPERUSER;" && \
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE staysuite OWNER staysuite;" && \
psql -h localhost -p 5432 -U postgres -d staysuite -c "CREATE EXTENSION IF NOT EXISTS citext;" && \
DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite" bunx prisma db push --accept-data-loss && \
psql -h localhost -p 5432 -U postgres -d staysuite -f pgsql-production/complete-database.sql && \
mkdir -p freeradius-install/var/run/radiusd freeradius-install/var/log/radius/radacct && \
pm2 start ecosystem.config.cjs && pm2 save && \
echo "DONE — check: pm2 status"
```

---

## Changes from Original Guide

| # | Issue | Original | Fixed |
|---|-------|----------|-------|
| 1 | `rm -rf` fails on mounts | `rm -rf my-project && git clone` | `git init + fetch + checkout` workaround |
| 2 | Socket dir missing | `pg_ctl start` directly | `mkdir -p /tmp/.s.PGSQL.5432` first |
| 3 | Schema ordering paradox | "NEVER run db:push" unconditionally | Fresh install: `prisma push` → `complete-database.sql` → never again |
| 4 | `.env` needed too late | Created at Step 5 | Moved to Step 3 (before Prisma) |
| 5 | FreeRADIUS `-D` flag missing | `radiusd -d ...` only | All commands now include `-d ... -D ...` |
| 6 | citext missing before Prisma | Not mentioned | Explicit `CREATE EXTENSION citext` step before push |
| 7 | No verification steps | None | Full Step 8 with all checks |
| 8 | No troubleshooting | None | Complete troubleshooting section |

---

**Login credentials (after seed):**
- Admin: `admin@royalstay.in` / `admin123`
- Front Desk: `frontdesk@royalstay.in` / `staff123`
- Platform: `platform@staysuite.com` / `admin123`

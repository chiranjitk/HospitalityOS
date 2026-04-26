# StaySuite HospitalityOS — Production Deployment Guide

## For Rocky Linux 10 / RHEL 9+

### Prerequisites

- Rocky Linux 10 (or RHEL 9+) with root/sudo access
- Internet connectivity for package installation
- Git account with access to the StaySuite repository

---

## Step 1: System Preparation

```bash
# Update system
sudo dnf update -y

# Install essential tools
sudo dnf install -y git curl wget vim htop

# Install bun (JavaScript runtime)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Node.js 22+ (via bun or fnm)
# bun includes its own Node.js runtime

# Install PM2 globally
sudo npm install -g pm2

# Install build tools (for native modules)
sudo dnf install -y gcc make gcc-c++ postgresql-devel
```

---

## Step 2: Install PostgreSQL 17

```bash
# Add PostgreSQL 17 repository
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Install PostgreSQL 17 server and contrib
sudo dnf install -y postgresql17-server postgresql17-contrib

# Initialize database cluster
sudo /usr/pgsql-17/bin/postgresql-17-setup initdb

# Start and enable PostgreSQL
sudo systemctl enable --now postgresql-17

# Configure authentication (optional: password auth instead of trust)
# Edit /var/lib/pgsql/17/data/pg_hba.conf
# For development: keep trust auth for local connections
# For production: use md5 or scram-sha-256

# Configure PostgreSQL (optional tuning)
# Edit /var/lib/pgsql/17/data/postgresql.conf
# Recommended for hospitality workload:
#   max_connections = 200
#   shared_buffers = 512MB
#   effective_cache_size = 2GB
#   work_mem = 16MB

sudo systemctl restart postgresql-17
```

---

## Step 3: Create Database and User

```bash
# Create database user
sudo -u postgres createuser -s staysuite

# Set password (for production)
sudo -u postgres psql -c "ALTER USER staysuite WITH PASSWORD 'YourSecureDBPassword';"

# Create database
sudo -u postgres createdb -O staysuite staysuite

# Enable citext extension (for case-insensitive email)
sudo -u postgres psql -d staysuite -c "CREATE EXTENSION IF NOT EXISTS citext;"

# Verify connection
psql -h localhost -U staysuite -d staysuite -c "SELECT version();"
```

---

## Step 4: Clone and Configure Application

```bash
# Clone the repository
cd /opt
sudo git clone https://github.com/YOUR-ORG/staysuite-hospitality-os.git
sudo chown -R $USER:$USER staysuite-hospitality-os
cd staysuite-hospitality-os

# Install dependencies
bun install

# Source production environment config
source production-env.conf

# Set production environment variables
# Edit .env file:
cat > .env << 'EOF'
DATABASE_URL=postgresql://staysuite:YourSecureDBPassword@localhost:5432/staysuite
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production
EOF
```

---

## Step 5: Deploy Database Schema

```bash
# Source environment to get paths
source production-env.conf

# Step 5a: Push Prisma schema (creates all application tables)
DATABASE_URL="postgresql://staysuite:YourSecureDBPassword@localhost:5432/staysuite" \
  npx prisma db push

# Step 5b: Import FreeRADIUS schema
run_psql_file pgsql-production/01-freeradius-schema.sql

# Step 5c: Create views
run_psql_file pgsql-production/02-staysuite-views.sql

# Step 5d: Seed RADIUS data (groups, users, NAS)
run_psql_file pgsql-production/03-radius-seed.sql

# Step 5e: IP Pool functions
run_psql_file pgsql-production/04-ip-pool-functions.sql

# Step 5f: FUP tables and functions
run_psql_file pgsql-production/05-fup-tables-and-functions.sql

# Step 5g: Advanced checks
run_psql_file pgsql-production/06-advanced-checks.sql

# Verify all views exist
run_psql -c "SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname;"

# Verify all functions exist
run_psql -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'fn_%' ORDER BY routine_name;"

# Expected: 6 views, 8 functions
```

---

## Step 6: Install and Configure FreeRADIUS

```bash
# Install FreeRADIUS with PostgreSQL support
sudo dnf install -y freeradius freeradius-utils freeradius-postgresql

# Backup original config
sudo cp -r /etc/raddb /etc/raddb.backup

# Apply StaySuite patches (see freeradius-config-patches/README.md)
# --- Patch 1: SQL Module ---
sudo vi /etc/raddb/mods-available/sql
# Set: dialect = "postgresql"
# Set: driver = "rlm_sql_postgresql"
# Set: radius_db = "dbname=staysuite host=localhost port=5432 user=staysuite password=YourSecureDBPassword"
# Set: read_clients = yes
# Remove: logfile = /tmp/sql_debug.log (if present)

# --- Patch 2: queries.conf ---
sudo vi /etc/raddb/mods-config/sql/main/postgresql/queries.conf
# Replace the post-auth { ... } section at the bottom with the StaySuite version
# (see freeradius-config-patches/queries-postauth.patch)

# --- Patch 3: sites-available/default ---
sudo vi /etc/raddb/sites-available/default
# Add StaySuite blocks in post-auth section (before the "sql" line)
# (see freeradius-config-patches/sites-default-postauth.patch)

# --- Patch 4: Enable SQL module ---
sudo ln -sf /etc/raddb/mods-available/sql /etc/raddb/mods-enabled/sql

# --- Patch 5: Disable sqlippool (not compiled with PostgreSQL driver) ---
sudo rm -f /etc/raddb/mods-enabled/sqlippool

# --- Patch 6: Add NAS clients to database ---
# NAS clients are read from the 'nas' table (read_clients = yes)
# Seed data includes 4 NAS clients. Add your production NAS/APs:
# run_psql -c "INSERT INTO nas (nasname, shortname, type, secret, server, description)
#   VALUES ('10.0.0.1', 'mikrotik-floor1', 'other', 'YourNASecret!', NULL, 'MikroTik AP Floor 1');"

# Test configuration
sudo radiusd -XC

# Start and enable FreeRADIUS
sudo systemctl enable --now radiusd

# Verify
sudo systemctl status radiusd
```

---

## Step 7: Seed Application Data

```bash
# Seed login users (admin, frontdesk, platform)
# IMPORTANT: Only seed login accounts. Do NOT seed WiFi/RADIUS data
# (those are handled by 03-radius-seed.sql)
DATABASE_URL="postgresql://staysuite:YourSecureDBPassword@localhost:5432/staysuite" \
  npx prisma db seed

# Or run seed directly:
bun run seed.ts

# Default login accounts:
#   admin@royalstay.in / admin123      (Admin)
#   frontdesk@royalstay.in / staff123  (Front Desk)
#   platform@staysuite.com / admin123  (Platform Admin)
#
# CHANGE THESE PASSWORDS FOR PRODUCTION!
```

---

## Step 8: Build and Start Application

```bash
# Build Next.js for production
bun run build

# Start with PM2
pm2 delete all 2>/dev/null || true
chmod +x start-nextjs.sh
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Verify
pm2 status
curl -s http://localhost:3000 | head -5
```

---

## Step 9: Configure Firewall

```bash
# Open required ports
sudo firewall-cmd --permanent --add-port=3000/tcp   # Next.js
sudo firewall-cmd --permanent --add-port=1812/udp    # RADIUS Auth
sudo firewall-cmd --permanent --add-port=1813/udp    # RADIUS Acct
sudo firewall-cmd --permanent --add-service=http      # Web (if using reverse proxy)
sudo firewall-cmd --reload
```

---

## Step 10: Verify Everything Works

```bash
# 1. Check PostgreSQL
run_psql -c "SELECT count(*) FROM nas;"
run_psql -c "SELECT count(*) FROM radcheck;"
run_psql -c "SELECT viewname FROM pg_views WHERE schemaname='public';"

# 2. Test RADIUS authentication
radtest "guest.test.user" "Welcome@123" localhost 1812 testing123
# Expected: Access-Accept with bandwidth attributes

# 3. Check Next.js is running
curl -s http://localhost:3000/api/health

# 4. Login to web GUI
# Open http://YOUR_SERVER_IP:3000
# Login with admin@royalstay.in / admin123
```

---

## Production Deployment File Summary

### SQL Files (pgsql-production/)
| File | Description | Order |
|------|-------------|-------|
| `01-freeradius-schema.sql` | FreeRADIUS official PostgreSQL tables | 1 |
| `02-staysuite-views.sql` | 6 StaySuite views for GUI | 2 |
| `03-radius-seed.sql` | RADIUS groups, users, NAS, policies | 3 |
| `04-ip-pool-functions.sql` | IP pool functions (3 functions) | 4 |
| `05-fup-tables-and-functions.sql` | FUP table + views + functions (5 functions) | 5 |
| `06-advanced-checks.sql` | Advanced validation checks | 6 |
| `07-production-test.sql` | Production test data (OPTIONAL) | 7 |

### Config Files
| File | Description |
|------|-------------|
| `production-env.conf` | Auto-detect OS/PG/FR paths, set env vars |
| `freeradius-config-patches/` | FR config modifications for production |
| `ecosystem.config.js` | PM2 process configuration |
| `start-nextjs.sh` | Next.js startup wrapper (Rocky 10 IPv6 fix) |

### Expected Database State After Deployment
- **226+** Prisma application tables
- **10** FreeRADIUS native tables (radacct, radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, radpostauth, nas, nasreload, data_usage_by_period)
- **1** Custom table: fup_switch_log
- **6** Views: v_wifi_users, v_session_history, v_active_sessions, v_user_usage, v_auth_logs, v_fup_switch_logs
- **8** Functions: fn_check_ip_pool, fn_get_user_pool_info, fn_get_pool_attr, fn_check_fup, fn_check_login_limit, fn_get_effective_bandwidth, fn_get_mikrotik_rate_limit, fn_is_fup_throttled

---

## Troubleshooting

### FreeRADIUS won't start
```bash
# Check config syntax
sudo radiusd -XC

# Check logs
sudo journalctl -u radiusd -f

# Common issue: sqlippool not compiled
sudo rm -f /etc/raddb/mods-enabled/sqlippool
sudo systemctl restart radiusd
```

### Can't connect to PostgreSQL
```bash
# Check PG is running
sudo systemctl status postgresql-17

# Check pg_hba.conf allows connection
sudo -u postgres psql -c "SHOW hba_file;"
# Ensure it has: host all all 127.0.0.1/32 md5 (or trust for dev)

# Check connection
psql -h localhost -U staysuite -d staysuite
```

### Next.js PORT issues on Rocky 10
```bash
# Rocky 10 has HOSTNAME env var set to machine hostname which resolves to IPv6
# This causes EINVAL. The start-nextjs.sh wrapper fixes this by setting HOSTNAME=0.0.0.0

# Check if issue exists
echo $HOSTNAME
# If it shows a hostname (not 0.0.0.0), use the wrapper
```

### GUI tabs showing no data
```bash
# Check views exist
run_psql -c "SELECT viewname FROM pg_views WHERE schemaname='public';"

# Check views return data
run_psql -c "SELECT count(*) FROM v_active_sessions;"
run_psql -c "SELECT count(*) FROM v_auth_logs;"

# Check functions exist
run_psql -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'fn_%';"
```

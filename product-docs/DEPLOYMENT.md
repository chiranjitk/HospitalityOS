# StaySuite Production Deployment Guide (Debian 13)

**Last Updated**: May 2026 | **Version**: v2.1

### Platform Scale (v2.1)

| Metric | Count |
|--------|-------|
| API Routes | 617 |
| Database Models | 294 |
| React Components | 532 |
| Mini-Services | 11 |
| Cron Jobs | 11 |

---

## Prerequisites

| Requirement | Minimum Version |
|---|---|
| Bun | Latest (1.x) |
| PostgreSQL | 17 |
| Debian | 13 (Trixie) |

### Install prerequisites on Debian 13

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# PostgreSQL 17
sudo apt install -y postgresql-17 postgresql-17-contrib
sudo systemctl enable --now postgresql

# Caddy (reverse proxy with auto TLS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git
cd StaySuite-HospitalityOS

# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit with production values

# Install dependencies
bun install

# Generate Prisma client
npx prisma generate

# Set up database
npx prisma db push          # Fresh install — syncs schema to PostgreSQL 17
# OR
npx prisma migrate deploy  # Run pending migrations (production recommended)

# Optional: seed the database
bun run db:seed

# Build for production
NODE_OPTIONS='--max-old-space-size=8192' bun run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

---

## Running in Production

### PM2 Process Management (Recommended)

The platform runs **11 mini-services** plus the main Next.js app managed by PM2 via `ecosystem.config.cjs`:

| Service | Port | Description |
|---------|------|-------------|
| staysuite-nextjs | 3000 | Main Next.js application |
| staysuite-freeradius | 1812/1813 | FreeRADIUS v3.2.7 RADIUS server |
| staysuite-captive-redirect | 8888 | Captive portal redirect service |
| staysuite-realtime | 3003 | WebSocket real-time service |
| staysuite-email-service | — | Email notification service |
| staysuite-sms-service | — | SMS gateway service |
| staysuite-payment-service | — | Payment processing service |
| staysuite-ota-service | — | OTA channel manager service |
| staysuite-revenue-service | — | Revenue management service |
| staysuite-audit-service | — | Audit logging service |
| staysuite-housekeeping-queue | — | Housekeeping task queue service |
| staysuite-scheduler | — | Cron job scheduler service |

> **Note on PostgreSQL**: PostgreSQL is **NOT** managed by PM2. It is managed manually via `pg_ctl` or the system `systemctl` service. Do not add PostgreSQL to the PM2 ecosystem config. Use `sudo systemctl start postgresql` / `sudo systemctl stop postgresql` or `pg_ctl -D /var/lib/postgresql/17/main start|stop|restart` to manage PostgreSQL directly.

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs
```

### Manual Start

```bash
# Main Next.js app (standalone mode)
PORT=3000 NODE_ENV=production NODE_OPTIONS='--max-old-space-size=1536' bun .next/standalone/server.js
```

### Mini-Services

```bash
# Realtime WebSocket service (port 3003)
cd mini-services/realtime-service && bun index.ts &

# Captive portal redirect (port 8888)
cd mini-services/captive-redirect && bun --hot index.ts &

# Email notification service
cd mini-services/email-service && bun index.ts &

# SMS gateway service
cd mini-services/sms-service && bun index.ts &

# Payment processing service
cd mini-services/payment-service && bun index.ts &

# OTA channel manager service
cd mini-services/ota-service && bun index.ts &

# Revenue management service
cd mini-services/revenue-service && bun index.ts &

# Audit logging service
cd mini-services/audit-service && bun index.ts &

# Housekeeping task queue service
cd mini-services/housekeeping-queue && bun index.ts &

# Cron job scheduler service
cd mini-services/scheduler && bun index.ts &
```

---

## Cron Jobs (Automated Tasks)

StaySuite runs **11 automated cron jobs** for scheduled operations. These are managed through the `staysuite-scheduler` mini-service:

| # | Cron Job | Schedule | Description |
|---|----------|----------|-------------|
| 1 | Night Audit | Daily at 00:00 | Closes business day, posts charges, generates night audit report |
| 2 | Booking Expiry | Every 15 min | Releases unconfirmed bookings past hold window |
| 3 | Room Status Sync | Every 5 min | Syncs room status from housekeeping and PMS |
| 4 | Scheduled Charges | Daily at 06:00 | Posts recurring/scheduled charges to folios |
| 5 | Commission Settlement | Daily at 02:00 | Calculates and settles agent/channel commissions |
| 6 | Revenue Snapshot | Hourly | Captures revenue metrics for analytics dashboards |
| 7 | Guest Notification | Every 30 min | Sends automated guest notifications (check-in reminders, etc.) |
| 8 | Cache Invalidation | Every 10 min | Clears stale cache entries across services |
| 9 | Database Backup | Daily at 03:00 | Creates PostgreSQL backup with retention policy |
| 10 | OTA Rate Sync | Every 20 min | Pushes updated rates and availability to OTA channels |
| 11 | Audit Log Cleanup | Weekly (Sun 04:00) | Archives audit logs older than 90 days |

### Cron Configuration

Cron jobs are configured in the `.env` file and managed by the scheduler service. To disable a specific cron job, set its corresponding env var to `disabled`:

```env
# Example: Disable OTA rate sync
CRON_OTA_RATE_SYNC=disabled

# Example: Override night audit time
CRON_NIGHT_AUDIT="0 1 * * *"  # Run at 1:00 AM instead of midnight
```

> **Important**: The Night Audit cron job is the most critical scheduled task. Ensure it runs successfully every day before any new check-ins are processed. Check logs at `pm2 logs staysuite-scheduler | grep night-audit` for verification.

---

## Systemd Service Files

### staysuite.service (Main Next.js App)

```ini
[Unit]
Description=StaySuite Next.js Application
After=network.target postgresql.service

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite
EnvironmentFile=/opt/staysuite/.env
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NODE_OPTIONS=--max-old-space-size-1536

[Install]
WantedBy=multi-user.target
```

### staysuite-freeradius.service

```ini
[Unit]
Description=StaySuite FreeRADIUS Server v3.2.7
After=network.target

[Service]
Type=simple
User=staysuite
Group=staysuite
WorkingDirectory=/opt/staysuite
Environment=LD_LIBRARY_PATH=/opt/staysuite/freeradius-install/lib:/opt/staysuite/pgsql-runtime/lib
ExecStart=/opt/staysuite/freeradius-install/sbin/radiusd -d /opt/staysuite/freeradius-install/etc/raddb -D /opt/staysuite/freeradius-install/share/freeradius -f
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Enable and start all services

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now staysuite
sudo systemctl enable --now staysuite-freeradius
sudo systemctl status staysuite staysuite-freeradius
```

---

## Database Setup

### PostgreSQL 17 Configuration

```bash
sudo -u postgres psql
CREATE DATABASE staysuite;
CREATE USER staysuite WITH PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE staysuite TO staysuite;
\q
```

### Enable PostgreSQL Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
```

### Update .env

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/staysuite"
```

### PostgreSQL Management

> **Note**: PostgreSQL is managed manually via `pg_ctl`, **NOT** via PM2. Do not add it to `ecosystem.config.cjs`.

```bash
# Start PostgreSQL
sudo pg_ctl -D /var/lib/postgresql/17/main start

# Stop PostgreSQL
sudo pg_ctl -D /var/lib/postgresql/17/main stop

# Restart PostgreSQL
sudo pg_ctl -D /var/lib/postgresql/17/main restart

# Check status
sudo pg_ctl -D /var/lib/postgresql/17/main status

# OR use systemctl (preferred on Debian)
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

---

## FreeRADIUS Setup

FreeRADIUS v3.2.7 is compiled from source with native PostgreSQL SQL module.

The compiled installation is at:
- **Binaries**: `/home/z/my-project/freeradius-install/sbin/`
- **Config**: `/home/z/my-project/freeradius-install/etc/raddb/`
- **Libraries**: `/home/z/my-project/freeradius-install/lib/`

Set LD_LIBRARY_PATH:
```env
LD_LIBRARY_PATH=/home/z/my-project/freeradius-install/lib:/home/z/my-project/pgsql-runtime/lib
```

### FreeRADIUS `-D` Flag (Dictionary Path)

The `-D` flag in the FreeRADIUS startup command specifies the **shared dictionary directory**, which contains the standard RADIUS attribute dictionaries. This is critical for proper packet decoding and encoding.

```
radiusd -d /path/to/etc/raddb -D /path/to/share/freeradius -f
```

| Flag | Purpose | Example Path |
|------|---------|-------------|
| `-d` | Configuration directory (raddb) | `/opt/staysuite/freeradius-install/etc/raddb` |
| `-D` | **Shared dictionary directory** | `/opt/staysuite/freeradius-install/share/freeradius` |
| `-f` | Run in foreground (for systemd) | — |

The dictionary directory (`-D`) contains:
- `dictionary` — Main dictionary file that includes all sub-dictionaries
- `dictionary.rfc*` — Standard RFC attribute definitions (RFC 2865, 2866, 2869, etc.)
- `dictionary.freeradius` — FreeRADIUS internal attributes
- Custom vendor dictionaries (e.g., `dictionary.wispr`, `dictionary.chillispot`)

**Without the `-D` flag**, FreeRADIUS may fail to decode vendor-specific attributes (VSAs) from WiFi access points, causing authentication failures. Always ensure `-D` points to the `share/freeradius` directory of your installation.

---

## Seed Data

### Seed Scripts

StaySuite includes multiple seed scripts for different purposes:

| File | Lines | Description |
|------|-------|-------------|
| `prisma/seed.ts` | 3,425 | **Primary seed** — Creates demo tenants, properties, users, room types, WiFi plans, bookings, and group bookings |
| `prisma/wifi-seed.ts` | — | WiFi-specific seed — Creates WiFi zones, plans, and RADIUS configurations |
| `prisma/seed-final.ts` | — | Final/override seed — Adds missing data and corrects relationships |

```bash
# Primary seed (run first)
bun run db:seed

# WiFi-specific seed (run after primary)
bun run prisma/wifi-seed.ts

# Final seed (run last to patch data)
bun run prisma/seed-final.ts
```

### Complete Database Dump

A full SQL dump is available for direct import:

**File**: `complete-database.sql`

| Metric | Count |
|--------|-------|
| Tables | 278 |
| Views | 6 |
| Functions | 53 |

```bash
# Import the complete database dump
psql -U postgres -d staysuite -f complete-database.sql
```

> **Note**: Using `complete-database.sql` is faster than running all seed scripts for fresh installations. However, seed scripts are preferred in development as they show the data creation logic.

**Demo Credentials:**

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | admin@royalstay.in | admin123 |
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |

---

## Caddy Reverse Proxy

```
staysuite.example.com {
    reverse_proxy localhost:3000

    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    log {
        output file /var/log/caddy/staysuite.log
    }
}
```

```bash
sudo systemctl reload caddy
```

---

## Firewall Configuration

```bash
sudo apt install -y ufw
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (Caddy)
sudo ufw allow 443/tcp    # HTTPS (Caddy)
sudo ufw allow 1812/tcp   # RADIUS Auth
sudo ufw allow 1813/tcp   # RADIUS Acct
sudo ufw enable
```

---

## Useful Commands

```bash
# PM2 process management
pm2 status
pm2 restart all
pm2 logs staysuite-nextjs --lines 100

# View logs
sudo journalctl -u staysuite -f

# Restart after code update
cd /opt/staysuite && git pull && bun install && bun run build
pm2 restart staysuite

# Database migrations after schema change
npx prisma migrate deploy
pm2 restart staysuite

# Check database
psql -U postgres -d staysuite -c "SELECT count(*) FROM \"User\";"

# PostgreSQL management (NOT via PM2)
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Check cron job / scheduler logs
pm2 logs staysuite-scheduler --lines 200
pm2 logs staysuite-scheduler | grep night-audit

# Check all mini-service statuses
pm2 jlist | bun -e 'const procs=JSON.parse(await Bun.stdin.text()); procs.forEach(p=>console.log(p.name, p.pm2_env.status, p.pm2_env.pm_uptime))'
```

---

## Support

- **Email**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

# StaySuite Production Deployment Guide (Debian 13)

**Last Updated**: May 2026

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

The platform runs 4 services managed by PM2 via `ecosystem.config.cjs`:

| Service | Port | Description |
|---------|------|-------------|
| staysuite-freeradius | 1812/1813 | FreeRADIUS v3.2.7 server |
| staysuite-nextjs | 3000 | Main Next.js application |
| staysuite-captive-redirect | 8888 | Captive portal redirect service |
| staysuite-realtime | 3003 | WebSocket real-time service |

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
```

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

---

## Seed Data

```bash
bun run db:seed
```

Creates demo tenants, properties, users, room types, WiFi plans, bookings, and group bookings.

**Demo Credentials:**

| Role | Email | Password |
|------|-------|----------|
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |
| Platform Admin | platform@staysuite.com | admin123 |

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
```

---

## Support

- **Email**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

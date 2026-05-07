# StaySuite Deployment Guide
## Installation and Configuration Manual

**Version**: 2.0  
**Last Updated**: May 2026

---

## Table of Contents

1. [Deployment Options](#1-deployment-options)
2. [Development Setup](#2-development-setup)
3. [Production Deployment](#3-production-deployment)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Setup](#5-database-setup)
6. [FreeRADIUS Setup](#6-freeradius-setup)
7. [SSL/TLS Configuration](#7-ssltls-configuration)
8. [Monitoring Setup](#8-monitoring-setup)
9. [Backup Configuration](#9-backup-configuration)
10. [Scaling Guidelines](#10-scaling-guidelines)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Deployment Options

| Option | Description |
|--------|-------------|
| **Cloud SaaS** | Managed by Cryptsk, 99.9% SLA |
| **On-Premise** | Self-hosted with PM2 process management |
| **Hybrid** | Cloud management with local processing |

---

## 2. Development Setup

### 2.1 Prerequisites

| Requirement | Version |
|-------------|---------|
| Bun | Latest (1.x) |
| PostgreSQL | 17 |
| Node.js | 20+ (for Next.js tooling) |

### 2.2 Installation

```bash
# Clone the repository
git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git
cd StaySuite-HospitalityOS

# Install dependencies
bun install

# Copy and configure environment variables
cp .env.example .env
nano .env

# Generate Prisma client
npx prisma generate

# Sync database schema
npx prisma db push

# Optional: seed the database with demo data
bun run db:seed
```

### 2.3 Running in Development

```bash
bun run dev
```

The app runs on port 3000. Turbopack is disabled (`NEXT_DISABLE_TURBOPACK=1`).

---

## 3. Production Deployment

### 3.1 System Requirements

**Minimum:**

| Component | Specification |
|-----------|---------------|
| CPU | 4 cores |
| RAM | 16 GB |
| Storage | 100 GB SSD |
| Network | 100 Mbps |

**Recommended:**

| Component | Specification |
|-----------|---------------|
| CPU | 8+ cores |
| RAM | 32+ GB |
| Storage | 500+ GB SSD |
| Network | 1 Gbps |

### 3.2 Software Requirements

| Software | Version |
|----------|---------|
| PostgreSQL | 17 |
| Bun | Latest |
| FreeRADIUS | v3.2.7 (compiled from source) |
| PM2 | Latest |
| Caddy / Nginx | Latest (reverse proxy) |

### 3.3 Production Build

```bash
# Build for production (standalone output)
NODE_OPTIONS='--max-old-space-size=8192' bun run build

# Copy static assets for standalone mode
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

### 3.4 PM2 Process Management

The platform runs 4 services managed by PM2 (via `ecosystem.config.cjs`):

| Service | Script | Port | Description |
|---------|--------|------|-------------|
| staysuite-freeradius | radiusd (FreeRADIUS v3.2.7) | 1812/1813 | RADIUS authentication |
| staysuite-nextjs | bun run dev | 3000 | Main application |
| staysuite-captive-redirect | bun --hot index.ts | 8888 | Captive portal redirect |
| staysuite-realtime | bun index.ts | 3003 | WebSocket real-time |

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs
```

### 3.5 Systemd Alternative

See `DEPLOYMENT.md` for systemd service file templates.

---

## 4. Environment Configuration

### 4.1 Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/staysuite` |
| `NEXTAUTH_SECRET` | Random secret for sessions | `staysecret-dev-key-2024` |
| `NEXTAUTH_URL` | Public URL of application | `http://localhost:3000` |
| `CRON_SECRET` | Secret for cron job authentication | `staysuite-cron-secret-2025` |

### 4.2 Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Application port |
| `LD_LIBRARY_PATH` | - | FreeRADIUS/PostgreSQL library path |
| `STAYSUITE_SCRIPTS_DIR` | - | Firewall scripts directory |

### 4.3 FreeRADIUS Library Path

```
LD_LIBRARY_PATH=/home/z/my-project/freeradius-install/lib:/home/z/my-project/pgsql-runtime/lib
```

---

## 5. Database Setup

### 5.1 PostgreSQL 17 Configuration

```ini
# postgresql.conf
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB
max_connections = 200
log_min_duration_statement = 500
```

### 5.2 Schema Management

```bash
# Sync schema to database (development)
npx prisma db push

# Run migrations (production recommended)
npx prisma migrate deploy

# Create new migration
npx prisma migrate dev --name description

# Check migration status
npx prisma migrate status
```

### 5.3 Database Schema

- **294 Prisma models** defined in `prisma/schema.prisma`
- All tenant-scoped models include `tenantId` field
- All models have `createdAt` and `updatedAt` (auto-managed)
- Soft delete: `deletedAt` field on critical models

### 5.4 Seed Data

```bash
bun run db:seed
```

Demo data includes:
- 2 tenants (Royal Stay Hotels, Ocean View Resorts)
- 3 users per tenant with role-based access
- 2 properties (Royal Stay Kolkata 120 rooms, Royal Stay Darjeeling 50 rooms)
- 6 room types, sample bookings, group bookings
- 6 WiFi plans

---

## 6. FreeRADIUS Setup

### 6.1 Compilation from Source

FreeRADIUS v3.2.7 is compiled from source with PostgreSQL SQL module:

```bash
# FreeRADIUS installed to:
/home/z/my-project/freeradius-install/

# Configuration directory:
/home/z/my-project/freeradius-install/etc/raddb

# Libraries:
/home/z/my-project/freeradius-install/lib
```

### 6.2 PostgreSQL SQL Module

FreeRADIUS uses a native PostgreSQL SQL module for:
- User authentication (check-in creates RADIUS user)
- Accounting (session tracking in radacct table)
- Bandwidth policy application (via RADIUS attributes)
- CoA (Change of Authorization) for dynamic policy changes

### 6.3 WiFi Seed Plans

6 plans seeded via `wifi-seed.ts`:
- Free (2 Mbps, 500 MB/day) — Complimentary
- Basic (5 Mbps, 1 GB/day) — Complimentary
- Standard (10 Mbps, 3 GB/day) — ₹99/day
- Premium (25 Mbps, 10 GB/day) — ₹199/day
- Business (50 Mbps, Unlimited) — ₹399/day
- Enterprise (100 Mbps, Unlimited) — ₹699/day

---

## 7. SSL/TLS Configuration

### 7.1 Caddy (Recommended)

```
staysuite.example.com {
    reverse_proxy localhost:3000
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
}
```

### 7.2 Nginx Alternative

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 8. Monitoring Setup

### 8.1 Health Check Endpoint

```http
GET /api/health
```

### 8.2 System Health Dashboard

Navigate to **Admin → System Health** for:
- API Response Time
- Database Connections
- FreeRADIUS Status
- Realtime Service Status
- Memory/CPU Usage

### 8.3 PM2 Monitoring

```bash
pm2 status
pm2 monit
pm2 logs staysuite-nextjs --lines 100
```

---

## 9. Backup Configuration

### 9.1 Automated Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump staysuite > /backups/staysuite_$DATE.sql
gzip /backups/staysuite_$DATE.sql
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### 9.2 Point-in-Time Recovery

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

---

## 10. Scaling Guidelines

### 10.1 Horizontal Scaling

```
                    ┌──────────┐
                    │Load      │
                    │Balancer  │
                    └──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │ Next.js │     │ Next.js │     │ Next.js │
   │   1     │     │   2     │     │   3     │
   └────┬────┘     └────┬────┘     └────┬────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │PostgreSQL│          │FreeRADIUS│
         │   v17    │          │  v3.2.7  │
         └──────────┘          └─────────┘
```

---

## 11. Troubleshooting

### 11.1 FreeRADIUS Issues

```bash
# Check FreeRADIUS status
pm2 logs staysuite-freeradius

# Test RADIUS authentication
radtest testuser testpass localhost 1812 testing123

# Check NAS health
# Navigate to WiFi → Gateway Diagnostics in the UI
```

### 11.2 Database Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U postgres -d staysuite -h localhost

# Reset database
npx prisma db push --force-reset
bun run db:seed
```

### 11.3 Memory Issues

```bash
# Increase Node.js memory
NODE_OPTIONS='--max-old-space-size=8192' bun run dev

# PM2 auto-restart at memory limit
# Already configured: max_memory_restart: '2G'
```

---

## Support

- **Email**: support@cryptsk.com
- **Emergency**: +91 XXX XXX XXXX

---

*© 2026 Cryptsk Pvt Ltd*

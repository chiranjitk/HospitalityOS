# RRD Production Setup Guide

## Overview

The System Health dashboard uses **RRDtool** (Round-Robin Database) to store and visualize time-series metrics. RRD files are fixed-size binary databases that automatically archive historical data at decreasing resolution — perfect for long-term monitoring with predictable storage.

### What gets monitored

| Metric | RRD File | Data Sources |
|--------|----------|-------------|
| CPU Usage | `cpu.rrd` | usage (%) |
| CPU Per-Core | `cpu-percore.rrd` | cpu0, cpu1, … cpuN (%) |
| Memory | `memory.rrd` | used (bytes), percent (%) |
| Disk Usage | `disk.rrd` | used (bytes), percent (%) |
| Load Average | `load.rrd` | load1, load5, load15 |
| Swap | `swap.rrd` | used (bytes), percent (%) |
| Disk I/O | `disk-io.rrd` | reads, writes, read_bytes, write_bytes |
| CPU Temperature | `thermal.rrd` | cpu_temp (°C) |
| Network Errors | `network-errors.rrd` | rx_err, tx_err, rx_drop, tx_drop, rx_pkt, tx_pkt |
| TCP Connections | `tcp-connections.rrd` | established, time_wait, close_wait, syn_recv |
| Active Sessions | `active-sessions.rrd` | count |
| Auth Statistics | `auth-stats.rrd` | accept, reject |
| Per-Interface Traffic | `{iface}.rrd` | rx, tx (bytes) — auto-detected |

### Data retention

| Resolution | Detail | Retention |
|-----------|--------|-----------|
| 1 minute | Raw data | 24 hours |
| 5 minutes | Aggregated | 7 days |
| 1 hour | Aggregated | 30 days |
| 1 day | Aggregated | 1 year |

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | >= 18 | `node --version` |
| rrdtool | >= 1.7 | `rrdtool --version` |

### Install rrdtool

```bash
# Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y rrdtool

# RHEL / CentOS / Fedora
sudo yum install -y rrdtool

# Alpine Linux
sudo apk add rrdtool

# macOS (Homebrew)
brew install rrdtool
```

> **Note:** The project includes a bundled `rrdtool` binary at `rrdtool/bin/rrdtool`. If the system package manager's version isn't available, the bundled binary will be used automatically.

---

## Quick Start

### 1. Full Automated Setup (Recommended)

```bash
cd /path/to/StaySuite-HospitalityOS

# Interactive mode (prompts for confirmation)
bash scripts/setup-rrd.sh

# Non-interactive mode (for CI/CD or Docker)
bash scripts/setup-rrd.sh --non-interactive
```

This script handles everything:

1. **Checks** if `rrdtool` is installed (offers to install if missing)
2. **Creates** required directories (`data/rrd/system/`, `logs/`)
3. **Bootstraps** all 14+ RRD files with correct schemas
4. **Installs** a cron job that runs the collector every minute

### 2. Manual Setup

If you prefer to set up each step manually:

#### Step 1: Create directories

```bash
mkdir -p data/rrd/system logs
```

#### Step 2: Initialize RRD files

```bash
npx tsx scripts/init-rrd.ts
```

#### Step 3: Verify files were created

```bash
npx tsx scripts/init-rrd.ts --check
```

Expected output:

```
  ✓ cpu.rrd              CPU Usage (%)           (1 DS)
  ✓ cpu-percore.rrd      CPU Per-Core Usage (%)  (4 DS)
  ✓ memory.rrd           Memory Usage            (2 DS)
  ✓ disk.rrd             Disk Usage              (2 DS)
  ✓ load.rrd             Load Average            (3 DS)
  ✓ swap.rrd             Swap Usage              (2 DS)
  ✓ disk-io.rrd          Disk I/O                (4 DS)
  ✓ thermal.rrd          CPU Temperature (°C)    (1 DS)
  ✓ network-errors.rrd   Network Errors & Drops  (6 DS)
  ✓ tcp-connections.rrd  TCP Connections         (4 DS)
  ✓ active-sessions.rrd  Active RADIUS Sessions  (1 DS)
  ✓ auth-stats.rrd       RADIUS Auth Statistics  (2 DS)
  ✓ eth0.rrd             Network Interface: eth0 (2 DS)

  ✓ All RRD files exist
```

#### Step 4: Set up the cron job

```bash
# Add to crontab (runs every minute)
(crontab -l 2>/dev/null; echo "* * * * * cd $(pwd) && bash scripts/rrd-cron-runner.sh") | crontab -

# Verify cron is installed
crontab -l | grep rrd
```

---

## Scripts Reference

### `scripts/setup-rrd.sh`

Full production setup script.

```bash
bash scripts/setup-rrd.sh              # Interactive setup
bash scripts/setup-rrd.sh --non-interactive  # No prompts
bash scripts/setup-rrd.sh --uninstall      # Remove cron + data
```

### `scripts/init-rrd.ts`

RRD file bootstrap script. Creates all required `.rrd` files with the correct data source schemas.

```bash
npx tsx scripts/init-rrd.ts              # Create missing RRD files
npx tsx scripts/init-rrd.ts --check       # Verify files exist (no creation)
npx tsx scripts/init-rrd.ts --force       # Delete and recreate ALL files (data loss!)
```

### `scripts/rrd-cron-runner.sh`

Cron entry point. Called every minute by cron to collect system metrics and update RRD files.

```bash
# Run manually (for testing)
bash scripts/rrd-cron-runner.sh

# Check collector logs
tail -f logs/rrd-cron.log
```

---

## Environment Variables

All RRD paths are configurable via environment variables. Set these in your `.env` file or system environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `RRD_BIN_PATH` | `./rrdtool/bin/rrdtool` | Path to rrdtool binary |
| `RRD_LIB_PATH` | `./rrdtool/lib` | Path to rrdtool shared libraries (LD_LIBRARY_PATH) |
| `RRD_DATA_PATH` | `./data/rrd` | Base directory for all RRD files |

### Example `.env` configuration

```bash
# Custom rrdtool location (e.g., system-installed)
RRD_BIN_PATH=/usr/bin/rrdtool

# Custom data storage (e.g., SSD mount)
RRD_DATA_PATH=/mnt/ssd/rrd
```

---

## Docker Deployment

### Dockerfile snippet

```dockerfile
FROM node:20-alpine

# Install rrdtool
RUN apk add --no-cache rrdtool

WORKDIR /app
COPY . .

# Bootstrap RRD files at build time
RUN npx tsx scripts/init-rrd.ts

# Start app + cron
CMD ["sh", "-c", "npx tsx scripts/init-rrd.ts && node server.js & crond -f"]
```

### docker-compose.yml snippet

```yaml
services:
  app:
    build: .
    environment:
      - RRD_BIN_PATH=/usr/bin/rrdtool
      - RRD_DATA_PATH=/app/data/rrd
    volumes:
      - rrd-data:/app/data/rrd
    # Cron runs inside container
    command: sh -c "npx tsx scripts/init-rrd.ts && node server.js & crond -f"

volumes:
  rrd-data:
```

---

## Troubleshooting

### rrdtool not found

```
Error: rrdtool binary not found at: ./rrdtool/bin/rrdtool
```

**Fix:** Install rrdtool or set `RRD_BIN_PATH`:

```bash
# Option 1: Install system rrdtool
sudo apt-get install rrdtool

# Option 2: Point to custom location
export RRD_BIN_PATH=/usr/local/bin/rrdtool
```

### RRD files not collecting data

```bash
# Check if cron job is running
crontab -l | grep rrd

# Check cron log for errors
tail -50 logs/rrd-cron.log

# Run collector manually to see errors
bash scripts/rrd-cron-runner.sh

# Verify RRD files exist
npx tsx scripts/init-rrd.ts --check
```

### Graphs show "No Data"

- RRD files need at least **2 data points** (2 minutes of collection) before graphs appear
- Check that the cron job has been running for at least 2 minutes
- Verify the collector is writing data:

```bash
rrdtool info data/rrd/system/cpu.rrd | head -5
rrdtool fetch data/rrd/system/cpu.rrd AVERAGE -s -5min
```

### Recreate RRD files (data loss warning!)

```bash
# This deletes all historical data and starts fresh
npx tsx scripts/init-rrd.ts --force
```

### Uninstall / Clean up

```bash
# Remove cron job and optionally delete RRD data
bash scripts/setup-rrd.sh --uninstall

# Or manually:
crontab -l | grep -v "rrd-cron-runner.sh" | crontab -
rm -rf data/rrd/system/*.rrd
```

---

## Architecture

```
scripts/
├── setup-rrd.sh          # Production setup (install + cron)
├── init-rrd.ts           # RRD file bootstrap
└── rrd-cron-runner.sh    # Cron entry point

data/rrd/system/          # RRD data files (created by init-rrd.ts)
├── cpu.rrd
├── cpu-percore.rrd
├── memory.rrd
├── disk.rrd
├── load.rrd
├── swap.rrd
├── disk-io.rrd
├── thermal.rrd
├── network-errors.rrd
├── tcp-connections.rrd
├── active-sessions.rrd
├── auth-stats.rrd
└── {iface}.rrd           # Dynamic per-interface RRDs

src/lib/rrd/
├── index.ts              # Base RRD library (create/update/fetch)
└── system-rrd.ts         # System metrics RRD (14 graph types)

logs/
└── rrd-cron.log          # Collector cron output
```

### Data flow

```
cron (every 60s)
  → rrd-cron-runner.sh
    → collector-cron.ts
      → Reads: /proc/stat, /proc/meminfo, /proc/diskstats, SQLite (radacct)
      → Writes: data/rrd/system/*.rrd (via rrdtool update)

Frontend (on demand)
  → API: /api/wifi/reports/health?action=rrd-graph
    → system-rrd.ts: fetchSystemGraph()
      → Reads: data/rrd/system/*.rrd (via rrdtool xport --json)
      → Returns: JSON time-series data to Chart.js
```

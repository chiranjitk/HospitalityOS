# RRD Production Setup Guide — StaySuite HospitalityOS

## Overview

The System Health dashboard (WiFi Management > Reports > System Health) uses **RRDtool** (Round-Robin Database) to store and graph time-series metrics. A cron job runs every minute to collect system metrics and write them into RRD files. The frontend reads these files on-demand via the API to render Chart.js graphs.

---

## What Gets Monitored

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

### Data Retention

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
| Bun | >= 1.0 | `bun --version` |
| rrdtool | >= 1.7 | `rrdtool --version` |

> **Note:** The project includes a bundled `rrdtool` binary at `rrdtool/bin/rrdtool`. No system install needed if the bundled binary is present.

---

## Fresh Server Setup

### Step 1: Clone / Pull the Project

```bash
cd /opt/staysuite   # or your deploy directory
git pull origin main
```

### Step 2: Initialize RRD Files

Creates all 14+ `.rrd` files in `data/rrd/system/`:

```bash
cd /opt/staysuite
bun run scripts/init-rrd.ts
```

Expected output:

```
╔══════════════════════════════════════════════════════════════╗
║           RRD Initialization — Production Bootstrap          ║
╚══════════════════════════════════════════════════════════════╝

  ✓ rrdtool binary found
  ✓ cpu.rrd              CPU Usage (%)           (1 DS)
  ✓ cpu-percore.rrd      CPU Per-Core Usage (%)  (4 DS)
  ✓ memory.rrd           Memory Usage            (2 DS)
  ✓ disk.rrd             Disk Usage              (2 DS)
  ... (all files)
  ✓ All RRD files ready!
```

### Step 3: Set Up Cron Job

Installs a cron job that runs the collector **every minute**:

```bash
cd /opt/staysuite
bash scripts/setup-rrd-cron.sh
```

Expected output:

```
✓ Cron job installed successfully!
  Collector runs:  Every minute
  Log cleanup:     Every Sunday at 3:00 AM
  Log file:        /opt/staysuite/logs/rrd-cron.log
```

### Step 4: Test Manually

```bash
cd /opt/staysuite
bash scripts/rrd-cron-runner.sh
cat logs/rrd-cron.log
```

Expected log output:

```
[RRD] Project root: /opt/staysuite
[RRD] rrdtool binary: /opt/staysuite/rrdtool/bin/rrdtool
[RRD] RRD data path: /opt/staysuite/data/rrd
[RRD-Cron 2026-04-30T21:24:05.054Z] Starting cron collection (users=true, interfaces=true, system=true)
[RRD-Cron 2026-04-30T21:24:05.054Z] System: cpu=44.0%, mem=24.2%, disk=2.6%, cores=4
[RRD-Cron 2026-04-30T21:24:05.054Z] Done in 639ms
```

### Step 5: Restart Next.js

PM2 needs to load the new `RRD_*` environment variables from `ecosystem.config.js`:

```bash
pm2 restart staysuite-nextjs
```

Verify startup logs show correct paths:

```bash
pm2 logs staysuite-nextjs --lines 20 --nostream
```

You should see:

```
[RRD] Project root: /opt/staysuite
[RRD] rrdtool binary: /opt/staysuite/rrdtool/bin/rrdtool
[RRD] RRD data path: /opt/staysuite/data/rrd
[RRD] LD_LIBRARY_PATH: /opt/staysuite/rrdtool/lib
```

### Step 6: Verify Everything

After 2-3 minutes, confirm data is flowing:

```bash
# Check cron is installed
crontab -l | grep STAYSUITE

# Check latest collector log
tail -10 /opt/staysuite/logs/rrd-cron.log

# Verify RRD files have data (should show non-zero values)
/opt/staysuite/rrdtool/bin/rrdtool fetch /opt/staysuite/data/rrd/system/cpu.rrd AVERAGE -s -5min

# Check PM2 logs for errors (should be NO "ENOENT" errors)
pm2 logs staysuite-nextjs --lines 20 --nostream | grep -i rrd
```

---

## Alternative: One-Script Setup

If you prefer to do everything in one command:

```bash
cd /opt/staysuite
bash scripts/setup-rrd.sh              # Interactive (prompts for confirmation)
bash scripts/setup-rrd.sh --non-interactive  # No prompts (for automation)
```

This runs Steps 2+3+4 above automatically.

---

## Scripts Reference

| Script | Purpose | Command |
|--------|---------|---------|
| `setup-rrd.sh` | **Full bootstrap** — checks rrdtool, creates RRD files, installs cron | `bash scripts/setup-rrd.sh` |
| `setup-rrd-cron.sh` | **Cron only** — install/remove the minute-by-minute cron job | `bash scripts/setup-rrd-cron.sh` |
| `init-rrd.ts` | **RRD file bootstrap** — create/verify/recreate RRD files | `bun run scripts/init-rrd.ts` |
| `rrd-cron-runner.sh` | **Cron entry point** — called every minute by cron | `bash scripts/rrd-cron-runner.sh` |

### `init-rrd.ts` flags

```bash
bun run scripts/init-rrd.ts              # Create missing RRD files
bun run scripts/init-rrd.ts --check       # Verify files exist (no creation)
bun run scripts/init-rrd.ts --force       # Delete and recreate ALL files (data loss!)
```

### `setup-rrd-cron.sh` flags

```bash
bash scripts/setup-rrd-cron.sh           # Install cron
bash scripts/setup-rrd-cron.sh --remove   # Remove cron
```

### `setup-rrd.sh` flags

```bash
bash scripts/setup-rrd.sh                # Interactive setup
bash scripts/setup-rrd.sh --non-interactive  # No prompts
bash scripts/setup-rrd.sh --uninstall     # Remove cron + optionally delete RRD data
```

---

## Environment Variables

All RRD paths are configurable via environment variables. Set in `.env`, `ecosystem.config.js`, or `start-nextjs.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `RRD_BIN_PATH` | `{project_root}/rrdtool/bin/rrdtool` | Path to rrdtool binary |
| `RRD_LIB_PATH` | `{project_root}/rrdtool/lib` | Path to rrdtool shared libraries |
| `RRD_DATA_PATH` | `{project_root}/data/rrd` | Base directory for all RRD files |
| `PROJECT_ROOT` | _(auto-detected)_ | Override project root detection |

These are already set in:
- `start-nextjs.sh` — exports all 3 vars + `LD_LIBRARY_PATH` before launching
- `ecosystem.config.js` — sets them in PM2 env for `staysuite-nextjs`
- `scripts/rrd-cron-runner.sh` — resolves them dynamically from script location

---

## Troubleshooting

### `spawn ... ENOENT` (rrdtool not found)

**Symptom:** PM2 logs show `rrdtool error: spawn /ROOT/src/lib/rrd/rrdtool/bin/rrdtool ENOENT`

**Cause:** `findProjectRoot()` couldn't resolve the project directory, fell back to a compiled source path.

**Fix:**
1. Ensure `ecosystem.config.js` has `RRD_BIN_PATH`, `RRD_LIB_PATH`, `RRD_DATA_PATH` in the Next.js env block
2. Ensure `start-nextjs.sh` exports those vars
3. Restart: `pm2 restart staysuite-nextjs`

### `bun: not found` in cron logs

**Symptom:** `rrd-cron-runner.sh: line 19: exec: bun: not found`

**Cause:** Cron runs with minimal PATH (`/usr/bin:/bin`) that doesn't include `~/.bun/bin/`.

**Fix:** The script auto-detects bun from multiple paths. If it still fails, create a symlink:

```bash
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
```

### Graphs show "No Data"

- RRD files need at least **2 data points** (2 minutes of collection) before graphs appear
- Wait 2-3 minutes after setting up cron, then refresh the page
- Verify collector is writing data:

```bash
/opt/staysuite/rrdtool/bin/rrdtool fetch /opt/staysuite/data/rrd/system/cpu.rrd AVERAGE -s -5min
```

### Cron not running

```bash
# Check if cron is installed
crontab -l | grep STAYSUITE

# Check if cron service is active
systemctl status crond    # RHEL/CentOS
systemctl status cron     # Debian/Ubuntu

# Run manually to see errors
bash scripts/rrd-cron-runner.sh
cat logs/rrd-cron.log
```

### Recreate RRD files (data loss warning!)

```bash
bun run scripts/init-rrd.ts --force
```

### Full uninstall

```bash
# Option 1: Interactive (prompts before deleting data)
bash scripts/setup-rrd.sh --uninstall

# Option 2: Manual
crontab -l | grep -v "rrd-cron-runner\|STAYSUITE-RRD" | crontab -
rm -rf data/rrd/system/*.rrd
```

---

## File Locations

```
/opt/staysuite/
├── rrdtool/
│   ├── bin/rrdtool          # Bundled rrdtool binary
│   └── lib/                 # Shared libraries (.so)
│
├── data/rrd/
│   ├── system/              # System health RRD files
│   │   ├── cpu.rrd
│   │   ├── cpu-percore.rrd
│   │   ├── memory.rrd
│   │   ├── disk.rrd
│   │   ├── load.rrd
│   │   ├── swap.rrd
│   │   ├── disk-io.rrd
│   │   ├── thermal.rrd
│   │   ├── network-errors.rrd
│   │   ├── tcp-connections.rrd
│   │   ├── active-sessions.rrd
│   │   ├── auth-stats.rrd
│   │   ├── ens160.rrd       # Per-interface (auto-detected)
│   │   └── ens192.rrd
│   ├── users/               # Per-user bandwidth RRDs
│   ├── interfaces/          # Per-interface bandwidth RRDs
│   └── state/               # Counter state for delta computation
│
├── scripts/
│   ├── setup-rrd.sh         # Full production setup
│   ├── setup-rrd-cron.sh    # Cron install/remove
│   ├── init-rrd.ts          # RRD file bootstrap
│   └── rrd-cron-runner.sh   # Cron entry point
│
├── src/lib/rrd/
│   ├── index.ts             # Base RRD library (create/update/fetch)
│   ├── system-rrd.ts        # System metrics RRD (14 graph types)
│   ├── collector-cron.ts    # Cron-compatible data collector
│   └── collector-standalone.ts  # PM2 daemon collector
│
├── start-nextjs.sh          # Exports RRD env vars before launch
├── ecosystem.config.js      # PM2 config with RRD env vars
└── logs/
    └── rrd-cron.log         # Collector output log
```

---

## Data Flow

```
┌─────────────────────────────────────────────────┐
│                  Data Collection                 │
│                                                  │
│  cron (every 60s)                                │
│    → rrd-cron-runner.sh                          │
│      → collector-cron.ts                         │
│        → Reads: /proc/stat, /proc/meminfo,       │
│                 /proc/diskstats, PostgreSQL       │
│        → Writes: data/rrd/system/*.rrd           │
│                 (via rrdtool update)              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  Data Query                      │
│                                                  │
│  Frontend (on demand)                            │
│    → API: /api/wifi/health?action=rrd-graph      │
│      → system-rrd.ts: fetchSystemGraph()         │
│        → Reads: data/rrd/system/*.rrd            │
│                 (via rrdtool xport --json)        │
│        → Returns: JSON time-series → Chart.js    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Real-Time Path (in-process)         │
│                                                  │
│  system-metrics.ts (2s interval)                 │
│    → Reads /proc filesystem + DB                 │
│    → Circular buffer (120 pts = 4 min)           │
│    → Writes to RRD every 60s                     │
│    → API: /api/wifi/health?action=metrics        │
└─────────────────────────────────────────────────┘
```

---

## Quick Reference Card

```bash
# --- Fresh setup (3 commands) ---
cd /opt/staysuite
bun run scripts/init-rrd.ts
bash scripts/setup-rrd-cron.sh

# --- Verify ---
crontab -l | grep STAYSUITE
tail -10 logs/rrd-cron.log
pm2 logs staysuite-nextjs --lines 10 --nostream | grep RRD

# --- Test manually ---
bash scripts/rrd-cron-runner.sh

# --- Check RRD data ---
/opt/staysuite/rrdtool/bin/rrdtool fetch data/rrd/system/cpu.rrd AVERAGE -s -5min

# --- Remove everything ---
bash scripts/setup-rrd.sh --uninstall
```

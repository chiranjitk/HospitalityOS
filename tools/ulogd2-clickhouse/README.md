# ulogd2 Offline Build — StaySuite-HospitalityOS

> **Purpose**: Captures TLS SNI from guest HTTPS traffic via nftables NFLOG rules,
> writes JSON logs, and feeds them into the sni-parser → ClickHouse IPDR pipeline.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option A: Full Offline Build from Source](#option-a-full-offline-build-from-source-recommended)
3. [Option B: Pre-compiled Binary Deployment](#option-b-pre-compiled-binary-deployment)
4. [Option C: Online Build (internet required)](#option-c-online-build-internet-required)
5. [Post-Installation](#post-installation)
6. [Service Management](#service-management)
7. [Pipeline Architecture](#pipeline-architecture)
8. [NFLOG Rules in nftables](#nflog-rules-in-nftables)
9. [Verification & Troubleshooting](#verification--troubleshooting)
10. [What Gets Built](#what-gets-built)
11. [Directory Structure](#directory-structure)

---

## Prerequisites

### Rocky Linux 10 — Build Tools Only

```bash
dnf install -y gcc make autoconf automake libtool flex bison gcc-c++ zlib-devel
```

> **Note**: All ulogd2 dependencies (libnfnetlink, libmnl, libnetfilter_log,
> libnetfilter_conntrack, json-c, libpcap, etc.) are included in `src/`.
> You do **NOT** need to install any `-devel` packages from the netfilter family.
> Only the compiler toolchain is required.

### Verify Build Tools

```bash
gcc --version    # GCC 11+ recommended
make --version
autoconf --version
automake --version
libtool --version
```

---

## Option A: Full Offline Build from Source (Recommended)

This is the primary method. All source tarballs are in `src/` — **no internet needed**.

### Step 1: Copy to Rocky 10 Server

From your development machine:

```bash
# Copy the entire ulogd2-clickhouse folder
scp -r tools/ulogd2-clickhouse/ root@<rocky10-ip>:/tmp/ulogd2-clickhouse/
```

### Step 2: Run the Build

```bash
ssh root@<rocky10-ip>

cd /tmp/ulogd2-clickhouse
chmod +x build-offline.sh
bash build-offline.sh
```

The build script will:
1. Build 7 dependency libraries in correct order (libnfnetlink → libmnl → libnetfilter_log → libnetfilter_conntrack → libnetfilter_acct → json-c → libpcap)
2. Build ulogd2 with NFLOG + JSONLOG + PCAP plugins
3. Install everything to `/usr/local/ulogd2/`
4. Copy the StaySuite config to `/usr/local/ulogd2/etc/ulogd.conf`
5. Create log directories at `/var/log/ulogd/json/`
6. Generate deployment packages in `dist/`

**Build time**: ~3-5 minutes on a modern server.

### Step 3: Verify Installation

```bash
# Check binary
/usr/local/ulogd2/sbin/ulogd2 -V

# Check installed plugins (must see NFLOG and JSONLOG)
ls -la /usr/local/ulogd2/lib/ulogd/

# Expected plugins:
#   ulogd_inppkt_NFLOG.so    ← captures nftables NFLOG packets
#   ulogd_inpct_NFCT.so     ← conntrack events (future use)
#   ulogd_filter_IFINDEX.so  ← interface index filter
#   ulogd_filter_HWHDR.so   ← hardware header filter
#   ulogd_output_JSONLOG.so ← JSON output (critical for sni-parser)
#   ulogd_output_PCAP.so    ← PCAP output (optional)

# Check config
cat /usr/local/ulogd2/etc/ulogd.conf | head -20

# Check log directory
ls -la /var/log/ulogd/json/
```

---

## Option B: Pre-compiled Binary Deployment

If you already built on one server and want to deploy to another:

```bash
# Copy the compiled tarball to target server
scp dist/ulogd2-offline-compiled.tar.gz root@<target-ip>:/tmp/

# On target server
cd /tmp
tar xzf ulogd2-offline-compiled.tar.gz
cd ulogd2

# Run deploy script (copies to /usr/local/ulogd2, installs init scripts)
bash deploy.sh

# Update library cache
ldconfig
```

> **Important**: The compiled binary is linked against the exact library versions
> built in `src/`. If you have a different OS/architecture, use Option A instead.

---

## Option C: Online Build (internet required)

Installs all dependencies from Rocky Linux repos + compiles ulogd2:

```bash
cd /tmp/ulogd2-clickhouse
bash build.sh
```

This uses `dnf install -y libnetfilter_acct-devel libnetfilter_conntrack-devel
libnetfilter_log-devel libnfnetlink-devel json-c-devel libpcap-devel` to get
system packages, then compiles only ulogd2.

---

## Post-Installation

### Install as SysV Service (Rocky Linux 10)

```bash
cp /usr/local/ulogd2/ulogd2.init /etc/rc.d/init.d/ulogd2
chmod +x /etc/rc.d/init.d/ulogd2

# Register and enable
chkconfig --add ulogd2
chkconfig ulogd2 on

# Start
/etc/rc.d/init.d/ulogd2 start

# Check status
/etc/rc.d/init.d/ulogd2 status
```

### Install as systemd Service (alternative)

```bash
cp /usr/local/ulogd2/ulogd2.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ulogd2
systemctl status ulogd2
```

### Load NFLOG Rules

The NFLOG rules are automatically loaded when you run your firewall script:

```bash
bash /usr/local/scripts/defaultchains_cryptsk.sh
```

If ulogd2 is installed at `/usr/local/ulogd2/sbin/ulogd2`, the script will:
- Detect ulogd2 binary
- Add NFLOG rules to nftables (group 20, 21, 22)
- Auto-start the ulogd2 daemon

You can also start ulogd2 manually:

```bash
/usr/local/ulogd2/sbin/ulogd2 -c /usr/local/ulogd2/etc/ulogd.conf
```

---

## Service Management

```bash
# SysV (Rocky Linux)
/etc/rc.d/init.d/ulogd2 start      # Start daemon
/etc/rc.d/init.d/ulogd2 stop       # Stop daemon
/etc/rc.d/init.d/ulogd2 restart    # Restart daemon
/etc/rc.d/init.d/ulogd2 status     # Check status + recent logs

# systemd (alternative)
systemctl start ulogd2
systemctl stop ulogd2
systemctl restart ulogd2
systemctl status ulogd2
```

### Log Files

| File | Contents |
|------|----------|
| `/var/log/ulogd/ulogd2.log` | ulogd2 daemon log (errors, startup) |
| `/var/log/ulogd/json/sni-queries.log` | JSON-lines output (SNI capture data) |

### Log Rotation

Create `/etc/logrotate.d/ulogd2`:

```
/var/log/ulogd/ulogd2.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    copytruncate
}

/var/log/ulogd/json/sni-queries.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
    postrotate
        /etc/rc.d/init.d/ulogd2 restart >/dev/null 2>&1 || true
    endscript
}
```

---

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Rocky 10 Gateway                             │
│                                                                  │
│  Guest Device ──→ nftables (NFLOG group 20)                     │
│       │                 │                                       │
│       │           ulogd2 daemon                                 │
│       │           /usr/local/ulogd2/sbin/ulogd2                 │
│       │                 │                                       │
│       │           JSON output                                   │
│       │           /var/log/ulogd/json/sni-queries.log           │
│       │                 │                                       │
│       │           sni-parser (port 3022)                        │
│       │           mini-services/sni-parser/index.ts             │
│       │           ┌─────────────────────────────┐               │
│       │           │ Parses raw.pkt hex         │               │
│       │           │ Extracts TLS SNI domain    │               │
│       │           │ Extracts TLS version       │               │
│       │           └──────────────┬──────────────┘               │
│       │                          │                               │
│       │           ClickHouse ipdr.sni_log                       │
│       │           (13-month TRAI IPDR retention)                │
│       │                          │                               │
│       └────── conntrack-bridge ──┤                              │
│               ClickHouse         │                              │
│               ipdr.nat_log       │                              │
│                                  │                               │
│                    Web Surfing Report                           │
│                    src/app/api/wifi/reports/web-surfing/        │
│                    (joins sni_log + nat_log)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## NFLOG Rules in nftables

The NFLOG rules are added in `scripts/staysuite_core/defaultchains_cryptsk.sh`
in the **mangle prerouting** chain, placed after `usersset accept` and before `jump open`.
They are **non-terminating** — packets continue through the chain after logging.

| NFLOG Group | Match | Purpose | snaplen |
|-------------|-------|---------|---------|
| 20 | TCP port 443, `ct state new` | TLS SNI from ClientHello | 1500 bytes |
| 21 | TCP port 80, `ct state new` | HTTP Host header (future) | 1500 bytes |
| 22 | UDP/TCP port 53 | DNS queries (supplementary) | 512 bytes |

The ulogd2 config (`ulogd.conf`) listens on **group 20** and writes JSON output.
Groups 21 and 22 are available for future expansion (add `[stack2]`, `[stack3]` blocks).

---

## Verification & Troubleshooting

### Step 1: Check ulogd2 is Running

```bash
/etc/rc.d/init.d/ulogd2 status
# OR
ps aux | grep ulogd
```

**If not running:**

```bash
# Check daemon log
cat /var/log/ulogd/ulogd2.log

# Try starting manually (see full output)
/usr/local/ulogd2/sbin/ulogd2 -c /usr/local/ulogd2/etc/ulogd.conf -v
```

### Step 2: Check NFLOG Rules Are Loaded

```bash
nft list ruleset | grep -i nflog
```

Expected output:
```
log group 20 snaplen 1500 prefix "NFLOG_SNI: "
log group 21 snaplen 1500 prefix "NFLOG_HTTP: "
log group 22 snaplen 512 prefix "NFLOG_DNS: "
```

**If no NFLOG rules:**

```bash
# Reload the firewall script
bash /usr/local/scripts/defaultchains_cryptsk.sh
```

### Step 3: Check JSON Output

```bash
# Check if JSON file exists and has recent data
ls -la /var/log/ulogd/json/sni-queries.log
tail -3 /var/log/ulogd/json/sni-queries.log
```

Expected JSON format:
```json
{"oob.time.sec":1234567890,"raw.pkt":"4500003c...","ip.saddr":"10.0.1.101","ip.daddr":"142.250.80.14","tcp.dport":443}
```

**If file is empty or doesn't exist:**
- Verify NFLOG rules are loaded (Step 2)
- Check ulogd2 config: `cat /usr/local/ulogd2/etc/ulogd.conf`
- Check NFLOG group matches: config `group=20` must match nftables `log group 20`

### Step 4: Check sni-parser is Processing

```bash
# Check health
curl -s http://localhost:3022/api/health

# Check recent events
curl -s http://localhost:3022/api/live?limit=5
```

### Step 5: Check ClickHouse

```bash
# Query ClickHouse for SNI data
curl -s "http://localhost:8123/?query=SELECT count(), max(timestamp) FROM ipdr.sni_log"

# Recent domains
curl -s "http://localhost:8123/?query=SELECT sni_domain, count() as c FROM ipdr.sni_log GROUP BY sni_domain ORDER BY c DESC LIMIT 20"
```

### Common Issues

| Problem | Solution |
|---------|----------|
| `ulogd2: error while loading shared libraries` | Run `ldconfig` or add `/usr/local/ulogd2/lib` to `/etc/ld.so.conf.d/ulogd2.conf` |
| `NFLOG: cannot open` | Ensure `nfnetlink_log` kernel module: `modprobe nfnetlink_log` |
| `permission denied` on NFLOG socket | Run ulogd2 as root |
| JSON file not growing | Check NFLOG rules exist; generate HTTPS traffic: `curl -v https://google.com` |
| sni-parser shows 0 events | Verify `SNI_LOG_FILE` points to `/var/log/ulogd/json/sni-queries.log` |
| ClickHouse table missing | sni-parser auto-creates `ipdr.sni_log` on startup |

### Kernel Module Check

```bash
# Required kernel modules
lsmod | grep nfnetlink
lsmod | grep nf_log

# Load if missing
modprobe nfnetlink_log
modprobe nf_log_ipv4
modprobe nf_log_ipv6

# Persist across reboot
echo "nfnetlink_log" >> /etc/modules-load.d/ulogd2.conf
echo "nf_log_ipv4" >> /etc/modules-load.d/ulogd2.conf
```

---

## What Gets Built

| Component | Version | Source | Purpose |
|-----------|---------|--------|---------|
| libnfnetlink | 1.0.2 | netfilter.org | Base netfilter library |
| libmnl | 1.0.5 | netfilter.org | Minimalistic netlink |
| libnetfilter_log | 1.0.2 | netfilter.org | NFLOG input plugin |
| libnetfilter_conntrack | 1.0.9 | netfilter.org | Conntrack input plugin |
| libnetfilter_acct | 1.0.3 | netfilter.org | Accounting plugin |
| json-c | 0.17 | s3.amazonaws.com | JSON output plugin |
| libpcap | 1.10.5 | github.com/tcpdump | PCAP output plugin |
| **ulogd2** | **2.0.8** | **netfilter.org** | **The daemon** |

---

## Directory Structure

```
tools/ulogd2-clickhouse/
├── README.md                          # This file
├── build-offline.sh                   # Full offline build (all deps + ulogd2)
├── build.sh                           # Online build (uses system packages)
├── download-deps.sh                   # Download all source tarballs
├── ulogd.conf                         # ulogd2 daemon config (NFLOG → JSON)
├── ulogd2.init                        # SysV init script (Rocky Linux)
├── ulogd2.service                     # systemd unit file
├── src/                               # Source tarballs (3.2MB, committed to Git)
│   ├── ulogd-2.0.8.tar.bz2
│   ├── libnfnetlink-1.0.2.tar.bz2
│   ├── libmnl-1.0.5.tar.bz2
│   ├── libnetfilter_log-1.0.2.tar.bz2
│   ├── libnetfilter_conntrack-1.0.9.tar.bz2
│   ├── libnetfilter_acct-1.0.3.tar.bz2
│   ├── json-c-0.17.tar.gz
│   └── libpcap-1.10.5.tar.gz
└── dist/                              # Build output
    ├── .gitkeep
    └── ulogd2-offline-sources.tar.gz  # Bundled tarball for deployment
```

### Install Paths

```
/usr/local/ulogd2/
├── sbin/
│   └── ulogd                          # Main daemon binary
├── lib/
│   ├── ulogd/                         # Plugins
│   │   ├── ulogd_inppkt_NFLOG.so
│   │   ├── ulogd_inpct_NFCT.so
│   │   ├── ulogd_filter_IFINDEX.so
│   │   ├── ulogd_filter_HWHDR.so
│   │   └── ulogd_output_JSONLOG.so
│   ├── libnfnetlink.so
│   ├── libmnl.so
│   ├── libnetfilter_log.so
│   ├── libnetfilter_conntrack.so
│   ├── libjson-c.so
│   └── libpcap.so
├── etc/
│   └── ulogd.conf                     # StaySuite NFLOG config
└── ulogd2.init                        # Init script (also copied here)
```

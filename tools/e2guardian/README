# StaySuite × e2guardian — Content Filtering Integration

## Overview

[e2guardian](https://www.e2guardian.org/) is an open-source web content filter and proxy server. It sits between guests and the internet, inspecting HTTP/HTTPS traffic and blocking access to sites based on configurable blacklists, category lists, and content scanning rules.

In StaySuite-HospitalityOS, e2guardian provides **per-plan content filtering** for hotel/resort WiFi:

| WiFi Plan | Filter Group | What's Blocked |
|-----------|-------------|----------------|
| Free / Basic | Group 1 (kids) | Adult, social media, streaming, gambling, violence, drugs, proxy, VPN, ads |
| Standard / Business | Group 2 (basic) | Adult, gambling, malware, phishing, violence, ads |
| Premium / VIP / Enterprise | Group 3 (premium) | Malware, phishing only |

**Architecture:**

```
Guest Device
    │
    ▼ (TCP 80/443 redirected by nftables)
┌──────────────────┐
│  StaySuite WiFi  │  ← Captive portal, RADIUS auth
│  (coova-chilli)  │
└────────┬─────────┘
         │
         ▼ (dnat to e2guardian ports)
┌──────────────────┐
│   e2guardian     │  ← Content filtering per filter group
│  :8080 (HTTP)    │
│  :8443 (HTTPS)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Upstream / WAN  │
│  (or Squid)      │
└──────────────────┘
```

---

## Installation (Rocky / RHEL 10)

### 1. Install from EPEL or Compile from Source

**Option A: EPEL (if available for your version)**

```bash
sudo dnf install epel-release
sudo dnf install e2guardian
```

**Option B: Compile from source (recommended for latest features)**

```bash
# Install build dependencies
sudo dnf install -y gcc gcc-c++ make cmake autoconf automake \
    libtool pkgconfig openssl-devel pcre-devel zlib-devel \
    libxml2-devel libiconv-devel bzip2-devel

# Clone and build (this repo includes the source in tools/e2guardian/)
cd /home/z/my-project/tools/e2guardian

mkdir -p build && cd build
cmake .. \
    -DCMAKE_INSTALL_PREFIX=/usr \
    -DCONFDIR=/etc/e2guardian \
    -DLOGDIR=/var/log/e2guardian \
    -DPIDDIR=/run/e2guardian \
    -DUSER=e2guardian \
    -DGROUP=e2guardian

make -j$(nproc)
sudo make install
```

### 2. Create System User

```bash
sudo useradd -r -s /sbin/nologin -d /var/lib/e2guardian e2guardian
sudo mkdir -p /etc/e2guardian/private/generatedcerts
sudo mkdir -p /etc/e2guardian/lists/banned
sudo mkdir -p /etc/e2guardian/lists/{group1,group2,group3}
sudo chown -R e2guardian:e2guardian /etc/e2guardian/private
sudo chown -R e2guardian:e2guardian /var/log/e2guardian
```

### 3. Install PostgreSQL Client

```bash
sudo dnf install -y postgresql jq
```

---

## Configuration

### 1. Copy the Example Configuration

```bash
# Copy main config
sudo cp tools/e2guardian/e2guardian.conf.example /etc/e2guardian/e2guardian.conf

# Create filter group configs
sudo cp /etc/e2guardian/e2guardian.conf.example /etc/e2guardian/e2guardianf1.conf
sudo cp /etc/e2guardian/e2guardian.conf.example /etc/e2guardian/e2guardianf2.conf
sudo cp /etc/e2guardian/e2guardian.conf.example /etc/e2guardian/e2guardianf3.conf

# Create list directories
sudo mkdir -p /etc/e2guardian/lists/{group1,group2,group3,common,banned,authplugins}

# Create empty list files (e2guardian requires them to exist)
for dir in group1 group2 group3; do
    for file in bannedsitelist bannedurllist exceptionsitelist exceptionurllist \
                 localbannedsitelist localbannedurllist localexceptionsitelist \
                 greysitelist greyurllist bannedextensionlist bannedmimetypelist \
                 weightedphraselist bannedphraselist exceptionphraselist \
                 bannedregexpurllist nocheckcertsitelist greysslsitelist \
                 bannedsslsitelist; do
        sudo touch "/etc/e2guardian/lists/${dir}/${file}"
    done
done

sudo touch /etc/e2guardian/lists/authplugins/ipgroups
sudo touch /etc/e2guardian/lists/authplugins/filtergroupslist
```

### 2. Generate CA Certificate for MITM (Optional — SNI-only mode doesn't need this)

```bash
cd /etc/e2guardian/private

# Generate CA key and certificate (valid 10 years)
sudo openssl genrsa -out ca.key 4096
sudo openssl req -new -x509 -days 3650 \
    -key ca.key -out ca.pem \
    -subj "/CN=StaySuite Hotel WiFi Filter CA/O=StaySuite/C=IN"

# Generate server cert key
sudo openssl genrsa -out cert.key 2048

sudo chown e2guardian:e2guardian ca.key ca.pem cert.key
sudo chmod 600 ca.key cert.key
```

### 3. Configure nftables for Transparent Interception

Create `/etc/nftables.d/e2guardian.nft`:

```nftables
#!/usr/sbin/nft -f

# StaySuite e2guardian transparent proxy rules
# Redirects guest HTTP (80) and HTTPS (443) to e2guardian

define E2G_HTTP_PORT = 8080
define E2G_HTTPS_PORT = 8443
define GUEST_NET = 10.10.0.0/16

table inet staysuite_e2guardian {
    # NAT: Redirect guest traffic to e2guardian
    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;

        # HTTP → e2guardian HTTP port
        iifname != "lo" ip daddr != 10.0.0.0/8 tcp dport 80 \
            ip saddr $GUEST_NET \
            dnat to :$E2G_HTTP_PORT

        # HTTPS → e2guardian HTTPS port (SNI-based filtering)
        iifname != "lo" ip daddr != 10.0.0.0/8 tcp dport 443 \
            ip saddr $GUEST_NET \
            dnat to :$E2G_HTTPS_PORT
    }

    # Filter: Allow e2guardian outbound, block direct guest access
    chain forward {
        type filter hook forward priority filter; policy accept;

        # Allow e2guardian to connect upstream
        ip saddr 127.0.0.1 tcp dport { 80, 443 } accept

        # Block guests from bypassing the proxy
        # (Only matters if e2guardian itself is not doing the forwarding)
    }

    # OUTPUT: Prevent e2guardian from redirecting its own traffic
    chain output {
        type nat hook output priority -100; policy accept;

        # Don't redirect e2guardian's own connections
        skuid e2guardian tcp dport { 80, 443 } accept
    }
}
```

Apply the rules:

```bash
sudo nft -f /etc/nftables.d/e2guardian.nft

# Verify
sudo nft list table inet staysuite_e2guardian
```

### 4. Enable IP Forwarding

```bash
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/99-staysuite.conf
sudo sysctl --system
```

---

## How the Config Generator Works

The `generate-config.sh` script reads the **ContentFilter** table from PostgreSQL and produces e2guardian-compatible blocklist files.

### ContentFilter Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenantId` | UUID | Tenant (hotel chain) |
| `propertyId` | UUID | Property (specific hotel) |
| `name` | String | Display name |
| `category` | String | Category key (adult, social_media, etc.) |
| `domains` | String | JSON array of domains: `["facebook.com","instagram.com"]` |
| `enabled` | Boolean | Whether the filter is active |
| `scheduleId` | UUID? | Optional time-based schedule |

### Category → File Mapping

| StaySuite Category | e2guardian File |
|-------------------|-----------------|
| `adult` | `staysuite_adult` |
| `malware` | `staysuite_malware` |
| `phishing` | `staysuite_phishing` |
| `social_media` | `staysuite_social_media` |
| `streaming` | `staysuite_streaming` |
| `gambling` | `staysuite_gambling` |
| `drugs` | `staysuite_drugs` |
| `violence` | `staysuite_violence` |
| `proxy` | `staysuite_proxy` |
| `vpn` | `staysuite_vpn` |
| `ads` | `staysuite_ads` |
| `custom` | `staysuite_custom` |

### Running the Generator

```bash
# Generate only banned site lists
./tools/e2guardian/generate-config.sh

# Generate everything (lists + IP groups + group configs) and reload
./tools/e2guardian/generate-config.sh --ip-groups --group-configs --reload

# Preview without writing files
./tools/e2guardian/generate-config.sh --ip-groups --group-configs --dry-run

# Custom output directory
./tools/e2guardian/generate-config.sh /tmp/test-output
```

---

## Filter Group Configuration

Each WiFi plan maps to an e2guardian **filter group** with different filtering levels:

### Group 1 — Kids (Most Restrictive)

**For:** Free plans, children's devices

Blocks: adult, social_media, streaming, gambling, violence, drugs, proxy, vpn, ads

In `e2guardianf1.conf`:
```conf
groupname = 'kids'
naughtynesslimit = 50
weightedphrasemode = 2

# Local banned sites include all restrictive categories
sitelist = 'name=localbanned,messageno=560,path=__LISTDIR__/../banned/staysuite_master'
```

### Group 2 — Basic (Moderate)

**For:** Standard/business plans

Blocks: adult, gambling, malware, phishing, violence, ads

In `e2guardianf2.conf`:
```conf
groupname = 'basic'
naughtynesslimit = 100
weightedphrasemode = 2

# Only block security and adult categories
sitelist = 'name=localbanned,messageno=560,path=__LISTDIR__/localbannedsitelist'
# (localbannedsitelist includes only adult, gambling, malware, phishing, violence, ads)
```

### Group 3 — Premium (Minimal)

**For:** Premium/VIP/Enterprise plans

Blocks: malware, phishing only

In `e2guardianf3.conf`:
```conf
groupname = 'premium'
naughtynesslimit = 160
weightedphrasemode = 2

# Minimal filtering — just security threats
sitelist = 'name=localbanned,messageno=560,path=__LISTDIR__/localbannedsitelist'
# (localbannedsitelist includes only malware, phishing)
```

### IP Group Mapping

Guest IPs are mapped to filter groups based on their WiFi plan via the `ipgroups` file:

```
# ipgroups — maps guest subnet to filter group
# Generated by generate-config.sh --ip-groups

# Plan: Free WiFi (type=free)
10.10.1.0/24 = filter1

# Plan: Business WiFi (type=standard)
10.10.2.0/24 = filter2

# Plan: Premium WiFi (type=premium)
10.10.3.0/24 = filter3
```

---

## Downloading Free Blocklists (UT1 Toulouse)

The [Université Toulouse 1 Capitole](https://dsi.ut-capitole.fr/blacklists/) maintains freely downloadable blocklists used by e2guardian. These complement the StaySuite-managed custom lists.

### Download and Install

```bash
#!/bin/bash
# download-blocklists.sh
# Downloads free blocklists from UT1 Toulouse for e2guardian

LIST_URL="https://dsi.ut-capitole.fr/blacklists/download/blacklists.tar.gz"
DEST="/etc/e2guardian/lists/external"
TEMP=$(mktemp -d)

echo "Downloading blocklists from UT1 Toulouse..."
curl -fSL "$LIST_URL" -o "$TEMP/blacklists.tar.gz"

echo "Extracting..."
mkdir -p "$DEST"
tar -xzf "$TEMP/blacklists.tar.gz" -C "$DEST"

echo "Converting to e2guardian format..."
# Each tarball directory contains 'domains' and 'urls' files
# e2guardian expects one domain per line in bannedsitelist
for category_dir in "$DEST"/*/; do
    category=$(basename "$category_dir")
    if [[ -f "$category_dir/domains" ]]; then
        # Already in correct format: one domain per line
        echo "  Category: $category ($(wc -l < "$category_dir/domains") domains)"
    fi
done

# Clean up
rm -rf "$TEMP"

echo "Blocklists installed to: $DEST"
echo "To use: add .Include<$DEST/category/domains> to your e2guardianfN.conf"
```

### Available Categories

| Category | Description |
|----------|-------------|
| `adult` | Adult/pornographic content |
| `agressif` | Aggressive/violent content |
| `arjel` | French online gambling |
| `chat` | Chat/instant messaging |
| `crypto_mining` | Cryptocurrency mining |
| `dating` | Online dating |
| `drogue` | Drugs |
| `gambling` | Gambling |
| `games` | Online gaming |
| `hacking` | Hacking/cracking tools |
| `malware` | Malware distribution |
| `phishing` | Phishing sites |
| `publicite` | Advertising |
| `redirector` | URL redirectors/shorteners |
| `social_networks` | Social networks |
| `tricheur` | Cheating/game hacks |
| `violence` | Violence |

---

## Systemd Service and Timer

### Service Unit

Create `/etc/systemd/system/e2guardian.service`:

```ini
[Unit]
Description=e2guardian Web Content Filter
Documentation=https://www.e2guardian.org/
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=forking
PIDFile=/run/e2guardian/e2guardian.pid
ExecStartPre=/usr/bin/mkdir -p /run/e2guardian
ExecStart=/usr/sbin/e2guardian
ExecReload=/usr/sbin/e2guardian -r
ExecStop=/usr/sbin/e2guardian -q
Restart=on-failure
RestartSec=5
User=e2guardian
Group=e2guardian

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/etc/e2guardian/private/generatedcerts /var/log/e2guardian /run/e2guardian
ReadOnlyPaths=/etc/e2guardian

# Resource limits for 5000+ concurrent users
LimitNOFILE=65536
LimitNPROC=4096
TasksMax=8192

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=e2guardian

[Install]
WantedBy=multi-user.target
```

### Config Generator Timer (auto-refresh lists from DB)

Create `/etc/systemd/system/staysuite-e2guardian-generate.service`:

```ini
[Unit]
Description=Generate e2guardian blocklists from StaySuite database
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=oneshot
ExecStart=/home/z/my-project/tools/e2guardian/generate-config.sh \
    --ip-groups --group-configs --reload
WorkingDirectory=/home/z/my-project/tools/e2guardian
User=root
StandardOutput=journal
StandardError=journal

# Environment
Environment=DATABASE_URL=postgresql://staysuite:staysuite@localhost:5432/staysuite
Environment=E2G_CONF_DIR=/etc/e2guardian
```

Create `/etc/systemd/system/staysuite-e2guardian-generate.timer`:

```ini
[Unit]
Description=Periodically regenerate e2guardian blocklists from database

[Timer]
# Run every 15 minutes
OnCalendar=*:0/15
# Also run at boot after network is up
OnBootSec=30
# Randomize start by up to 60s to avoid thundering herd
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
```

### Enable Everything

```bash
# Enable and start e2guardian
sudo systemctl daemon-reload
sudo systemctl enable --now e2guardian

# Enable the config generator timer (regenerates lists every 15 min)
sudo systemctl enable --now staysuite-e2guardian-generate.timer

# Check status
sudo systemctl status e2guardian
sudo systemctl list-timers staysuite-e2guardian-generate.timer
```

---

## Production Deployment Guide

### Step 1: Initial Setup

```bash
# 1. Install e2guardian (see Installation section)
# 2. Copy configuration files
sudo cp e2guardian.conf.example /etc/e2guardian/e2guardian.conf
# ... (create f1, f2, f3 configs as described above)

# 3. Set up nftables
sudo nft -f /etc/nftables.d/e2guardian.nft

# 4. Enable IP forwarding
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/99-staysuite.conf
sudo sysctl --system
```

### Step 2: Generate Initial Blocklists

```bash
# Run the generator with all options
export DATABASE_URL="postgresql://staysuite:staysuite@localhost:5432/staysuite"
./tools/e2guardian/generate-config.sh \
    --ip-groups --group-configs --reload
```

### Step 3: Start Services

```bash
sudo systemctl enable --now e2guardian
sudo systemctl enable --now staysuite-e2guardian-generate.timer
```

### Step 4: Verify

```bash
# Check e2guardian is running and listening
sudo ss -tlnp | grep e2guardian
# Expected: 8080 (HTTP) and 8443 (HTTPS)

# Test HTTP filtering from a guest IP
curl -x http://GUEST_IP:8080 http://test-blocked-site.com
# Expected: block page or connection denied

# Check logs
sudo journalctl -u e2guardian -f

# Test the internal health check URL
curl http://internal.test.e2guardian.org/
# Expected: "OK"
```

### Step 5: Tuning for 5000+ Users

Edit `/etc/e2guardian/e2guardian.conf`:

```conf
# Increase worker threads
httpworkers = 5000

# Increase max content scan size
maxcontentfiltersize = 4096
maxcontentramcachescansize = 4096
maxcontentfilecachescansize = 50000

# Increase timeouts for high load
proxytimeout = 15
connecttimeout = 15

# Increase socket buffers
socketreceivebuffer = 131072
socketsendbuffer = 131072
```

System-level tuning:

```bash
# /etc/sysctl.d/99-staysuite-perf.conf
net.core.somaxconn = 8192
net.core.netdev_max_backlog = 8192
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_slow_start_after_idle = 0
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
```

---

## SNI-Based HTTPS Filtering (ssl_mitm = off)

By default, StaySuite uses **SNI-based filtering** for HTTPS — no MITM, no certificate installation needed on guest devices.

**How it works:**

1. Guest connects to `https://blocked-site.com:443`
2. nftables redirects the connection to e2guardian port 8443
3. e2guardian reads the **TLS ClientHello** SNI (Server Name Indication) extension
4. The SNI hostname is checked against banned site lists
5. If blocked: connection is terminated with a TCP RST or block page
6. If allowed: connection is passed through to the original destination

**Advantages:**
- No MITM — guests don't need to install CA certificates
- No privacy concerns — encrypted traffic is never decrypted
- Lower CPU usage — no encryption/decryption overhead
- Works with ECH-resistant filtering (logs ECH flag)

**Limitations:**
- Cannot inspect URL paths (only domain names via SNI)
- Cannot do content/phrase filtering on HTTPS pages
- ECH (Encrypted Client Hello) may hide SNI in the future
- IP-based blocking is the fallback for ECH sites

### Enable Full MITM (if needed)

To enable deep HTTPS inspection (decrypt and filter content), set in each `e2guardianfN.conf`:

```conf
sslmitm = on
mitmcheckcert = on
automitm = on
```

And in `e2guardian.conf`:

```conf
enablessl = on
```

Then install the CA certificate on all guest devices (via captive portal download page).

---

## Troubleshooting

### e2guardian won't start

```bash
# Check config syntax
sudo e2guardian -s

# Check for missing list files
sudo e2guardian -v

# Check logs
sudo journalctl -u e2guardian -n 50 --no-pager

# Common issue: missing list directories
ls -la /etc/e2guardian/lists/group{1,2,3}/
```

### Filter not blocking sites

1. **Check IP group mapping:**
   ```bash
   cat /etc/e2guardian/lists/authplugins/ipgroups
   # Verify the guest IP range maps to the correct filter group
   ```

2. **Check the banned site list:**
   ```bash
   # Find which group file includes the domain
   rg "blocked-site.com" /etc/e2guardian/lists/
   ```

3. **Check if the site is in an exception list:**
   ```bash
   rg "blocked-site.com" /etc/e2guardian/lists/group*/exception*list
   ```

4. **Check access logs:**
   ```bash
   sudo tail -f /var/log/e2guardian/access.log
   # Look for the domain — should show "DENIED" if blocked
   ```

5. **Reload after config changes:**
   ```bash
   sudo e2guardian -r
   # or
   sudo systemctl reload e2guardian
   ```

### nftables not redirecting traffic

```bash
# List active nftables rules
sudo nft list ruleset

# Verify GUEST_NET matches your actual guest subnet
# Check that prerouting chain has the dnat rules

# Test manually
sudo nft add rule inet staysuite_e2guardian prerouting \
    ip saddr 10.10.1.100 tcp dport 80 dnat to :8080
```

### Database connection issues

```bash
# Test connection
psql "postgresql://staysuite:staysuite@localhost:5432/staysuite" -c "SELECT 1"

# Check ContentFilter data
psql "postgresql://staysuite:staysuite@localhost:5432/staysuite" -c \
    "SELECT category, enabled, jsonb_array_length(domains::jsonb) as domain_count \
     FROM \"ContentFilter\" WHERE enabled = true"

# Run generator in dry-run mode
./tools/e2guardian/generate-config.sh --dry-run --ip-groups --group-configs
```

### Performance issues under load

```bash
# Check current worker thread usage
sudo e2guardian -s | grep -i worker

# Check open file descriptors
ls /proc/$(pgrep e2guardian)/fd | wc -l

# Check dstats (dynamic statistics)
tail -f /var/log/e2guardian/dstats.log

# Increase system limits
sudo prlimit --pid=$(pgrep e2guardian) --nofile=65536:65536
```

### HTTPS sites not being filtered

1. Confirm `enablessl = on` and `transparenthttpsport = 8443` in `e2guardian.conf`
2. Verify nftables is redirecting port 443 to 8443
3. Check if the site uses ECH (Encrypted Client Hello):
   ```bash
   sudo journalctl -u e2guardian | grep "ECH"
   # 'E' in flags indicates ECH was detected
   ```
4. If using MITM mode, verify CA cert is installed on client

---

## File Reference

| File | Purpose |
|------|---------|
| `generate-config.sh` | Generates e2guardian lists from PostgreSQL |
| `e2guardian.conf.example` | Complete example main configuration |
| `README.md` | This file |

### Generated Files

| Path | Description |
|------|-------------|
| `/etc/e2guardian/lists/banned/staysuite_<category>` | Per-category domain blocklist |
| `/etc/e2guardian/lists/banned/staysuite_master` | Master include file |
| `/etc/e2guardian/lists/authplugins/ipgroups` | IP → filter group mapping |
| `/etc/e2guardian/lists/group<N>/localbannedsitelist` | Per-group banned site includes |

---

## License

e2guardian is released under the **GPL v2** license.
StaySuite-HospitalityOS configuration files are proprietary.

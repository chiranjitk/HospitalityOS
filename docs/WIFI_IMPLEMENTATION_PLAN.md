# StaySuite WiFi Gateway — Full E2E Implementation Plan

> **Version:** 1.0  
> **Scope:** 28 new WiFi features (from WIFI_FEATURE_SUGGESTIONS.md) + existing infrastructure fixes  
> **Target OS:** Rocky Linux 10 (production) / Debian 13 (development)  
> **Database:** PostgreSQL 17  
> **Stack:** Next.js 16, FreeRADIUS 3.2.7, Bun, PM2/systemd  

---

## TABLE OF CONTENTS

1. [Physical Network Architecture](#1-physical-network-architecture)
2. [OS-Level Requirements](#2-os-level-requirements)
3. [Service Architecture (What Runs Where)](#3-service-architecture)
4. [Guest Connection Flow (E2E)](#4-guest-connection-flow)
5. [New Mini-Services Required](#5-new-mini-services)
6. [New Prisma Models Required](#6-new-prisma-models)
7. [Per-Feature Implementation Plan](#7-per-feature-implementation-plan)
8. [Deployment Plan](#8-deployment-plan)
9. [Testing Strategy](#9-testing-strategy)
10. [Security Hardening](#10-security-hardening)
11. [Monitoring & Observability](#11-monitoring--observability)

---

## 1. PHYSICAL NETWORK ARCHITECTURE

### 1.1 Reference Topology (100-Room Resort)

```
                    ┌──────────────────────────────────────────────────┐
                    │              INTERNET / ISP                       │
                    │          Primary: 1 Gbps / Backup: 500 Mbps      │
                    └────────────────────┬─────────────────────────────┘
                                         │
                    ┌────────────────────┴─────────────────────────────┐
                    │           STAYSUITE GATEWAY SERVER                │
                    │         (Rocky Linux 10 / Debian 13)              │
                    │                                                  │
                    │  ┌───────────────────────────────────────────┐   │
                    │  │  NIC 1: WAN (ens192) — ISP Primary        │   │
                    │  │  NIC 2: WAN (ens224) — ISP Backup         │   │
                    │  │  NIC 3: LAN (ens256) — Management          │   │
                    │  │  NIC 4: GUEST (ens192.10) — Guest WiFi     │   │
                    │  │  NIC 5: STAFF (ens192.20) — Staff WiFi     │   │
                    │  │  NIC 6: IOT (ens192.30) — Smart Devices    │   │
                    │  │  NIC 7: VLAN trunk (ens192.100) — AP VLANs │   │
                    │  └───────────────────────────────────────────┘   │
                    │                                                  │
                    │  Running Services:                                │
                    │  ├─ FreeRADIUS 3.2.7      (UDP 1812/1813/3799) │
                    │  ├─ StaySuite Next.js      (TCP 3000)           │
                    │  ├─ freeradius-service     (TCP 3010)           │
                    │  ├─ kea-service            (TCP 3011)           │
                    │  ├─ dns-service            (TCP 3012)           │
                    │  ├─ nftables-service       (TCP 3013)           │
                    │  ├─ dhcp-service           (TCP 3014)           │
                    │  ├─ portal-service         (TCP 3015)           │
                    │  ├─ radius-server          (TCP 3016)           │
                    │  ├─ availability-service   (TCP 3002)           │
                    │  ├─ realtime-service       (TCP 3003)           │
                    │  ├─ PostgreSQL 17          (TCP 5432)           │
                    │  ├─ KEA DHCP4              (TCP 8000 ctrl-agent)│
                    │  ├─ dnsmasq                (TCP 53 DNS)         │
                    │  ├─ RRDtool collector      (cron every 60s)     │
                    │  └─ PM2 / systemd                             │
                    └──────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼─────────────────────────────┐
                    │                    │                              │
              ┌─────┴─────┐      ┌─────┴─────┐                  ┌─────┴─────┐
              │ MANAGED   │      │ MANAGED   │                  │ UNMANAGED  │
              │ SWITCH    │      │ SWITCH    │                  │ SWITCH     │
              │ (PoE+)    │      │ (PoE+)    │                  │ (Staff)    │
              ├───────────┤      ├───────────┤                  ├────────────┤
              │ AP-1 F1   │      │ AP-5 Pool │                  │ Staff PC   │
              │ AP-2 F2   │      │ AP-6 Gym  │                  │ Printer    │
              │ AP-3 F3   │      │ AP-7 Lobby│                  │ POS        │
              │ AP-4 F4   │      │ AP-8 conf │                  │ CCTV       │
              └───────────┘      └───────────┘                  └────────────┘
                    │                    │
                Guest              Guest
                Devices            Devices
```

### 1.2 VLAN Design

| VLAN | Name | Subnet | Purpose | Tag/Untag |
|------|------|--------|---------|-----------|
| 1 | management | 10.10.0.0/24 | Server management, SSH, monitoring | Untag (NIC 3) |
| 10 | guest-wifi | 10.10.10.0/22 (1022 hosts) | Guest WiFi (captive portal) | Tag (NIC 7 trunk) |
| 20 | staff-wifi | 10.10.20.0/24 | Staff WiFi (WPA2-Enterprise) | Tag (NIC 7 trunk) |
| 30 | iot | 10.10.30.0/24 | IoT/smart devices | Tag (NIC 7 trunk) |
| 40 | pms | 10.10.40.0/24 | PMS, POS, CCTV, HVAC | Tag (NIC 7 trunk) |
| 50 | conference | 10.10.50.0/24 | Conference/event WiFi | Tag (NIC 7 trunk) |
| 100 | portal | 10.10.100.0/24 | Captive portal network (pre-auth) | Tag (NIC 7 trunk) |
| 200 | quarantine | 10.10.200.0/24 | Device posture quarantine | Tag (NIC 7 trunk) |

### 1.3 Traffic Flow Rules

```
Guest Device (VLAN 10)
  │
  ├─ DNS request (port 53)
  │   └─→ dnsmasq (10.10.0.1)
  │       ├─ Captive portal domains (hotel.com, etc.) → 10.10.0.1 ( StaySuite server)
  │       ├─ Whitelisted domains (apple.com, google.com) → upstream DNS (8.8.8.8)
  │       └─ All other domains → 10.10.0.1 (captive portal redirect)
  │
  ├─ HTTP/HTTPS (port 80/443) — BEFORE auth
  │   └─→ nftables REDIRECT → 10.10.100.1:3080 (captive portal service)
  │
  ├─ HTTP/HTTPS (port 80/443) — AFTER auth
  │   └─→ nftables ACCEPT → Internet (via MASQUERADE on WAN)
  │
  ├─ RADIUS (UDP 1812) — from AP
  │   └─→ FreeRADIUS (10.10.0.1:1812) → PostgreSQL auth
  │
  └─ DHCP (UDP 67/68) — from AP
      └─→ KEA DHCP4 (10.10.0.1:67) → assign VLAN 10 IP
```

---

## 2. OS-LEVEL REQUIREMENTS

### 2.1 Rocky Linux 10 (Production) — Full Package List

```bash
#!/bin/bash
# ============================================================
# StaySuite Gateway — OS Package Installation
# Target: Rocky Linux 10 (minimal install)
# ============================================================

# === Base System ===
sudo dnf update -y
sudo dnf install -y epel-release
sudo dnf config-manager --set-enabled crb  # CRB repo for additional packages

# === Core Dependencies ===
sudo dnf install -y \
  postgresql17-server postgresql17-devel \  # PostgreSQL 17
  bun \                                      # JavaScript runtime (from npm/bun.sh)
  pm2 \                                      # Process manager
  git \                                      # Version control
  curl wget jq \                             # HTTP tools
  htop iotop nethogs \                       # Monitoring
  tmux screen \                              # Terminal multiplexer
  rsync \                                    # File sync
  unzip tar gzip \                           # Archive tools
  openssl-devel talloc-devel \               # Build deps for FreeRADIUS
  gcc make autoconf libtool \                # Build tools
  gcc-c++ \                                  # C++ compiler (for FreeRADIUS)

# === Network Management ===
sudo dnf install -y \
  NetworkManager \                           # Network manager (nmcli)
  nftables \                                 # Firewall (nft)
  dnsmasq \                                  # DNS forwarder + DHCP fallback
  bridge-utils \                             # Network bridge utils
  ethtool \                                  # NIC configuration
  iproute iputils \                          # IP routing tools
  whois bind-utils \                         # DNS tools (dig, nslookup)
  tcpdump wireshark \                        # Packet capture (debug)
  traceroute mtr \                           # Network diagnostics
  lsof ss \                                  # Socket/process tools

# === KEA DHCP Server ===
sudo dnf install -y kea

# === RRDtool (Bandwidth Graphing) ===
sudo dnf install -y rrdtool rrdtool-devel

# === FreeRADIUS 3.2.x (compile from source) ===
# See: scripts/compile-freeradius-rocky10.sh
# Requires: openssl-devel, talloc-devel, gcc, make

# === Python (for scripts) ===
sudo dnf install -y python3 python3-pip

# === Security ===
sudo dnf install -y \
  fail2ban \                                 # Brute-force protection
  certbot \                                  # Let's Encrypt SSL
  mod_ssl \                                  # Apache SSL (for captive portal)

# === File System ===
sudo dnf install -y \
  nfs-utils \                                # Network storage (for backups)
  acl \                                      # Access control lists
  logrotate \                                # Log rotation

# === Optional: Hardware Monitoring ===
sudo dnf install -y \
  lm_sensors \                               # Temperature/fan monitoring
  smartmontools \                            # Disk health monitoring
```

### 2.2 Debian 13 (Development) — Full Package List

```bash
#!/bin/bash
# ============================================================
# StaySuite Gateway — OS Package Installation
# Target: Debian 13 (trixie) — development environment
# ============================================================

sudo apt update && sudo apt upgrade -y

sudo apt install -y \
  postgresql-17 postgresql-client-17 \
  bun pm2 \
  git curl wget jq \
  htop iotop \
  tmux \
  rsync unzip tar gzip \
  build-essential autoconf libtool \
  libssl-dev libtalloc-dev \
  network-manager \
  nftables dnsmasq \
  bridge-utils ethtool iproute2 iputils-ping \
  dnsutils whois \
  tcpdump tshark \
  traceroute mtr \
  lsof iproute2 \
  kea-dhcp4-server \
  rrdtool \
  fail2ban \
  python3 python3-pip \
  logrotate \
  acl \
  lm-sensors smartmontools
```

### 2.3 Kernel Parameters (`/etc/sysctl.d/99-staysuite.conf`)

```bash
# ============================================================
# StaySuite Gateway — Kernel Tuning
# ============================================================

# === Network Performance ===
net.core.rmem_max = 16777216          # 16 MB receive buffer
net.core.wmem_max = 16777216          # 16 MB send buffer
net.core.rmem_default = 1048576       # 1 MB default receive
net.core.wmem_default = 1048576       # 1 MB default send
net.core.netdev_max_backlog = 5000    # Max queued packets per interface
net.core.somaxconn = 65535             # Max pending TCP connections

# === IP Forwarding (required for NAT/gateway) ===
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1

# === ARP ===
net.ipv4.neigh.default.gc_thresh1 = 1024
net.ipv4.neigh.default.gc_thresh2 = 2048
net.ipv4.neigh.default.gc_thresh3 = 4096

# === Connection Tracking ===
net.netfilter.nf_conntrack_max = 262144  # Max tracked connections (for NAT)
net.netfilter.nf_conntrack_tcp_timeout_established = 7200  # 2 hour TCP timeout

# === BBR Congestion Control (better throughput) ===
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# === SYN Flood Protection ===
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_synack_retries = 2

# === FreeRADIUS UDP Buffer ===
net.ipv4.udp_mem = 8192 1048576 16777216

# === Security ===
net.ipv4.conf.all.rp_filter = 1       # Reverse path filtering
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1

# === Disable IPv6 if not needed (optional) ===
# net.ipv6.conf.all.disable_ipv6 = 1
# net.ipv6.conf.default.disable_ipv6 = 1
```

### 2.4 System Limits (`/etc/security/limits.d/staysuite.conf`)

```bash
# StaySuite Gateway — File Descriptor Limits
staysuite soft nofile 65535
staysuite hard nofile 65535
staysuite soft nproc 4096
staysuite hard nproc 4096
```

### 2.5 Firewall Base Rules (`/etc/nftables.conf` base)

```bash
#!/usr/sbin/nft -f

# Base nftables rules for StaySuite Gateway
# This sets up the framework; StaySuite nftables-service manages dynamic rules

flush ruleset

table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;

    # Allow established/related
    ct state established,related accept

    # Allow loopback
    iif lo accept

    # Allow ICMP
    ip protocol icmp accept
    ip6 nexthdr icmpv6 accept

    # Allow SSH (management)
    tcp dport 22 accept

    # Allow StaySuite services
    tcp dport { 3000, 3002, 3003, 3010, 3011, 3012, 3013, 3014, 3015, 3016 } accept

    # Allow FreeRADIUS
    udp dport { 1812, 1813, 3799 } accept

    # Allow DNS
    udp dport 53 accept
    tcp dport 53 accept

    # Allow DHCP
    udp dport { 67, 68 } accept

    # Allow HTTP/HTTPS (captive portal, management)
    tcp dport { 80, 443, 3080, 8443 } accept

    # Allow KEA control-agent
    tcp dport 8000 accept

    # Allow PostgreSQL (management network only)
    iifname "ens256" tcp dport 5432 accept

    # Log dropped packets
    log prefix "NFT DROP: " counter drop
  }

  chain forward {
    type filter hook forward priority 0; policy drop;

    # Allow established/related
    ct state established,related accept

    # Allow guest network to internet (with NAT)
    iifname "ens192.10" oifname "ens192" accept

    # Allow staff network to internet
    iifname "ens192.20" oifname "ens192" accept

    # Allow IoT network to internet (restricted)
    iifname "ens192.30" oifname "ens192" accept

    # Block all inter-VLAN (enforced per-zone by StaySuite)
    log prefix "NFT FORWARD DROP: " counter drop
  }

  chain output {
    type filter hook output priority 0; policy accept;
  }
}

# NAT for internet access
table ip nat {
  chain postrouting {
    type nat hook postrouting priority 100;
    masquerade
  }

  chain prerouting {
    type nat hook prerouting priority dstnat;
    # Captive portal redirect (managed by nftables-service)
    # iifname "ens192.10" tcp dport 80 redirect to :3080
  }
}
```

---

## 3. SERVICE ARCHITECTURE

### 3.1 Complete Service Map

| # | Service | Port | Protocol | Technology | Purpose | Status |
|---|---------|------|----------|------------|---------|--------|
| 1 | **Next.js App** | 3000 | TCP | Bun + Next.js 16 | Admin panel, APIs, guest pages | ✅ Running |
| 2 | **PostgreSQL 17** | 5432 | TCP | PostgreSQL | All data persistence | ✅ Running |
| 3 | **FreeRADIUS** | 1812 | UDP | FreeRADIUS 3.2.7 | RADIUS authentication | ✅ Running |
| 4 | **FreeRADIUS Acct** | 1813 | UDP | FreeRADIUS 3.2.7 | RADIUS accounting | ✅ Running |
| 5 | **FreeRADIUS CoA** | 3799 | UDP | FreeRADIUS 3.2.7 | Change of Authorization | ❌ Disabled |
| 6 | **freeradius-service** | 3010 | TCP | Bun + Hono | RADIUS management API, radclient proxy | ✅ Running |
| 7 | **kea-service** | 3011 | TCP | Bun + Hono | KEA DHCP4 management API | ✅ Running |
| 8 | **dns-service** | 3012 | TCP | Bun + Hono | dnsmasq DNS management API | ✅ Running |
| 9 | **nftables-service** | 3013 | TCP | Bun + Hono | Firewall rule management | ✅ Running |
| 10 | **dhcp-service** | 3014 | TCP | Bun + Hono | dnsmasq DHCP fallback | ✅ Running |
| 11 | **portal-service** | 3015 | TCP | Bun + Hono | Captive portal HTTP server | ⚠️ NEW |
| 12 | **radius-server** | 3016 | TCP | Bun + Hono | External RADIUS proxy | ⚠️ NEW |
| 13 | **realtime-service** | 3003 | TCP | Bun + Socket.IO | WebSocket for live data | ✅ Running |
| 14 | **availability-service** | 3002 | TCP | Bun + Socket.IO | Room availability | ✅ Running |
| 15 | **KEA DHCP4** | 67/68 | UDP | KEA 4.x | DHCP server | ✅ Running |
| 16 | **KEA ctrl-agent** | 8000 | TCP | KEA 4.x | DHCP management API | ✅ Running |
| 17 | **dnsmasq** | 53 | UDP/TCP | dnsmasq | DNS forwarder + captive portal DNS | ✅ Running |
| 18 | **RRDtool Collector** | — | cron | RRDtool + Node.js | Bandwidth data collection | ✅ Running |

### 3.2 Service Dependency Graph

```
                    ┌─────────────────────────────────────────┐
                    │           PostgreSQL 17 (:5432)         │
                    └─────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────────────────┐
        │                     │                                   │
  ┌─────┴──────┐      ┌──────┴──────┐                   ┌──────┴──────┐
  │ FreeRADIUS  │      │  Next.js   │                   │  Mini-Svcs  │
  │ (:1812/13)  │      │  (:3000)   │                   │  (3010-16)  │
  └──────┬──────┘      └──────┬──────┘                   └──────┬──────┘
         │                    │                                 │
         │              ┌─────┴─────┐                    ┌──────┴──────┐
         │              │  Browser  │                    │  OS Services │
         │              │  (Admin)  │                    │              │
         │              └───────────┘                    │ dnsmasq (:53)│
         │                                               │ KEA (:67/68) │
         │                                               │ nftables     │
         │                                               └──────┬──────┘
         │                                                      │
  ┌──────┴──────────────────────────────────────────────────────┘
  │                    PHYSICAL NETWORK
  │
  ├── APs (MikroTik/Cisco/Aruba/UniFi) ← RADIUS auth
  ├── Guest Devices ← DHCP + DNS + Captive Portal
  ├── Staff Devices ← DHCP + DNS + WPA2-Enterprise
  └── IoT Devices ← DHCP + VLAN isolation
```

### 3.3 Process Manager (Production)

All services managed by **systemd** (not PM2) in production:

```bash
# Service management
systemctl start staysuite              # Next.js + all mini-services
systemctl start staysuite-freeradius   # FreeRADIUS management
systemctl start staysuite-nftables     # Firewall management
systemctl start postgresql-17          # Database
systemctl start radiusd                # FreeRADIUS binary (via systemd)
systemctl start kea-dhcp4              # DHCP server
systemctl start dnsmasq                # DNS forwarder
systemctl start rrd-collector          # Bandwidth collector (custom cron timer)

# Service dependency order
# 1. PostgreSQL 17
# 2. NetworkManager (nmcli)
# 3. nftables (base rules)
# 4. dnsmasq (DNS)
# 5. KEA DHCP4
# 6. FreeRADIUS
# 7. Mini-services (3010-3016)
# 8. Next.js (3000)
# 9. RRD collector
# 10. Portal service (3015)
```

---

## 4. GUEST CONNECTION FLOW (E2E)

### 4.1 Step-by-Step: Guest Connects to WiFi

```
TIMELINE    ACTION                                                    SERVICE
─────────   ─────────────────────────────────────────────────────────  ─────────────────
T+0.0s      Guest device connects to "Hotel-Guest" SSID               —
T+0.1s      AP associates device, assigns to VLAN 10                   AP
T+0.2s      Guest device sends DHCP Discover (broadcast)               —
T+0.3s      AP relays DHCP to KEA DHCP4 on gateway                     AP → Gateway
T+0.4s      KEA assigns IP 10.10.10.142/24, lease 3600s               KEA (:67)
T+0.5s      Guest has IP, no internet yet (nftables blocks)             —
T+0.6s      Guest opens browser, requests any HTTP URL                  —
T+0.7s      nftables redirects HTTP to captive portal (port 3080)       nftables
T+0.8s      Guest sees captive portal page (StaySuite branded)          portal-service (:3015)
T+1.0s      Guest enters room number + last name                       —
T+1.5s      Portal validates against PMS bookings API                   Next.js (:3000)
T+2.0s      Valid guest → portal calls RADIUS auth endpoint             Next.js → FreeRADIUS
T+2.5s      FreeRADIUS authenticates against radcheck (PostgreSQL)      FreeRADIUS (:1812)
T+3.0s      Auth SUCCESS → FreeRADIUS returns Access-Accept with:       FreeRADIUS
            ├─ Framed-IP-Address = 10.10.10.142
            ├─ Session-Timeout = 86400
            ├─ WISPr-Bandwidth-Max-Down = 10240000 (10 Mbps)
            ├─ WISPr-Bandwidth-Max-Up = 5120000 (5 Mbps)
            ├─ Tunnel-Type = 13 (VLAN)
            ├─ Tunnel-Private-Group-Id = 10
            └─ Filter-Id = "guest-basic"
T+3.5s      Portal signals AP to authorize session (CoA)                freeradius-service (:3010)
T+4.0s      AP applies RADIUS attributes (bandwidth, session timeout)   AP
T+4.5s      nftables removes captive portal redirect for this IP        nftables-service (:3013)
T+5.0s      Guest device gets internet access                          —
T+5.5s      Portal shows "Connected! Welcome, Mr. Sharma" page          portal-service
T+5.7s      Portal logs session to WiFiSession table                    Next.js → PostgreSQL
T+5.8s      Portal sends welcome notification (email/SMS)                notification-service
T+10.0s     Portal shows post-auth landing page:                        portal-service
            ├─ Hotel services (restaurant, spa, activities)
            ├─ WiFi upgrade offer (Premium 50Mbps — ₹299)
            ├─ Local info (weather, map, transport)
            └─ Satisfaction survey (after 30 min)
T+30m       Interim-Update: AP sends bandwidth usage to FreeRADIUS     AP → FreeRADIUS (:1813)
T+30m       Accounting sync: radacct → WiFiSession                     accounting-sync-service
T+60m       Satisfaction survey popup (if enabled)                      portal-service
T+24h       Session-Timeout: Guest must re-authenticate                 FreeRADIUS
T+checkout  PMS triggers deprovisioning → RADIUS CoA disconnect       freeradius-service
T+checkout  nftables re-blocks IP, removes session firewall rules      nftables-service
```

### 4.2 Step-by-Step: Guest Upgrades WiFi (F1 — Bandwidth Upsell)

```
TIMELINE    ACTION                                                    SERVICE
─────────   ─────────────────────────────────────────────────────────  ─────────────────
T+0s        Guest clicks "Upgrade to Premium 50Mbps — ₹299"           portal-service (:3015)
T+1s        Portal shows payment options (room charge, card, UPI)     —
T+3s        Guest selects "Charge to Room"                            —
T+4s        Portal calls POST /api/wifi/upgrade                       Next.js (:3000)
T+5s        API validates guest has active booking                     Next.js → PostgreSQL
T+6s        API creates folio line item (₹299, WiFi Upgrade)          Next.js → PostgreSQL
T+7s        API updates WiFiUser plan to Premium                       Next.js → PostgreSQL
T+8s        API calls freeradius-service CoA endpoint                 Next.js → freeradius-service (:3010)
T+9s        freeradius-service sends CoA-Request to AP:               freeradius-service → AP
            ├─ Mikrotik-Rate-Limit = 50000000/50000000 (50 Mbps)
            ├─ Session-Timeout = 86400 (extend)
            └─ Acct-Interim-Interval = 300 (more frequent updates)
T+10s       AP acknowledges CoA-Request                                AP → freeradius-service
T+11s       Guest bandwidth immediately increases                     —
T+12s       Portal shows "Upgraded! Enjoy Premium WiFi"                portal-service (:3015)
```

### 4.3 Step-by-Step: Multi-Device Auto-Registration (F9)

```
TIMELINE    ACTION                                                    SERVICE
─────────   ─────────────────────────────────────────────────────────  ─────────────────
T+0s        Guest's phone authenticates successfully (first device)    — (normal flow)
T+0.5s      After auth, portal/device-register API called              portal → Next.js
T+1s        API stores: guestId, phone_mac, deviceType="iOS"          Next.js → PostgreSQL
T+1.5s      API generates device token (SHA256 of guestId+mac+secret)  Next.js
T+5min      Guest opens laptop, connects to "Hotel-Guest" SSID         —
T+6s        Captive portal detects new device                          portal-service
T+7s        Portal sends device MAC + previous auth info to API        portal → Next.js
T+8s        API matches MAC to known device list for this guest        Next.js → PostgreSQL
T+9s        Device recognized → skip auth, auto-authorize              Next.js
T+10s       Portal calls RADIUS auth with stored credentials           Next.js → FreeRADIUS
T+11s       FreeRADIUS Access-Accept                                    FreeRADIUS
T+12s       Portal shows: "Welcome back, Mr. Sharma. Laptop connected." portal-service
            (No login form — zero friction)
T+15s       Laptop MAC added to WiFiDevice registry                    Next.js → PostgreSQL
```

### 4.4 Step-by-Step: Pre-Arrival WiFi Delivery (F7)

```
TIMELINE    ACTION                                                    SERVICE
─────────   ─────────────────────────────────────────────────────────  ─────────────────
T-24h       Booking status changes to "confirmed"                     PMS (cron event)
T-24h       Cron job: POST /api/wifi/pre-arrival-scan                  cron → Next.js
T-24h       API finds all check-ins in next 24 hours                  Next.js → PostgreSQL
T-24h       For each booking:
              1. Generate WiFi credentials (if not exists)             wifi-user-service
              2. Create radcheck/radreply entries                      wifi-user-service
              3. Send email with WiFi details                          email-service
              4. Send SMS with WiFi details                            sms-service
T-24h       Email template:
              Subject: "Your WiFi Access — {hotelName}"
              Body: "Dear {guestName}, your WiFi credentials for
                     {checkIn} → {checkOut}:
                     Network: {ssid}
                     Username: {username}
                     Password: {password}
                     Connect at /connect?code={voucherCode}"
T-12h       Reminder SMS (if enabled):
              "Your stay at {hotelName} starts tomorrow!
               WiFi: {ssid}, User: {username}, Pass: {password}"
T+0h        Guest arrives, connects to WiFi — credentials already work
```

---

## 5. NEW MINI-SERVICES REQUIRED

### 5.1 `portal-service` (Port 3015) — NEW

**Purpose:** Standalone HTTP server that serves the captive portal page and handles the auth flow.

**Why a separate service?** The captive portal must respond even if Next.js is down or restarting. It needs to be lightweight and always available.

```
mini-services/portal-service/
├── index.ts               # Hono HTTP server
├── templates/
│   ├── login.html          # Captive portal login page
│   ├── success.html        # Post-auth success page
│   ├── upsell.html         # Bandwidth upgrade page
│   └── consent.html        # GDPR consent page
├── middleware/
│   ├── auth.ts             # Authentication flow
│   ├── device-register.ts  # Multi-device registration
│   └── identity.ts         # Identity verification
└── package.json
```

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Captive portal login page |
| GET | `/status` | Check if user is authenticated (by IP/MAC) |
| POST | `/auth` | Authenticate user (room number, voucher, PMS, OTP) |
| POST | `/logout` | Disconnect user |
| GET | `/upsell` | Bandwidth upgrade page |
| POST | `/upgrade` | Process upgrade purchase |
| GET | `/consent` | GDPR consent page |
| POST | `/consent` | Submit consent |
| GET | `/api/health` | Health check |
| GET | `/api/wifi-info` | SSID, terms, etc. for portal page |

**Integration Points:**
- Calls Next.js API for PMS validation (`/api/wifi/sessions`)
- Calls freeradius-service for CoA (`/coa/disconnect`, `/coa/bandwidth`)
- Calls nftables-service to add/remove captive portal redirect rules

### 5.2 `radius-server` (Port 3016) — ALREADY EXISTS (enhance)

**Purpose:** External RADIUS proxy for multi-brand/franchise support.

**Current:** 968 lines, basic Hono server.  
**Enhancement:** Add realm-based proxy routing for franchise hotels.

**New Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/proxy/realms` | List RADIUS proxy realms |
| POST | `/api/proxy/realms` | Add proxy realm |
| PUT | `/api/proxy/realms/[id]` | Update realm |
| DELETE | `/api/proxy/realms/[id]` | Remove realm |
| GET | `/api/proxy/health` | Check proxy server health |

---

## 6. NEW PRISMA MODELS REQUIRED

### 6.1 Revenue Models (F1-F6)

```prisma
// WiFi bandwidth upgrade mid-session
model WiFiUpgrade {
  id            String   @id @default(uuid())
  propertyId    String
  tenantId      String
  sessionId     String
  username      String
  guestId       String?
  bookingId     String?
  fromPlanId    String   // original plan
  toPlanId      String   // upgraded plan
  chargeAmount  Float
  currency      String   @default("INR")
  folioId       String?  // linked folio charge
  status        String   @default("active") // active, refunded, expired
  createdAt     DateTime @default(now())
  expiresAt     DateTime
}

// Portal ad campaign
model PortalAdCampaign {
  id              String   @id @default(uuid())
  propertyId      String
  tenantId        String
  name            String
  advertiser      String
  creativeUrl     String   // S3 URL
  creativeType    String   @default("image") // image, video, html
  position        String   @default("banner") // banner, interstitial, footer
  impressions     Int      @default(0)
  clicks          Int      @default(0)
  revenue         Float    @default(0)
  status          String   @default("active")
  startDate       DateTime
  endDate         DateTime
  createdAt       DateTime @default(now())
}

// Partner-sponsored WiFi
model WiFiPartner {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  partnerType     String   @default("loyalty") // loyalty, airline, credit_card, corporate
  authMethod      String   @default("promo_code") // promo_code, auto_detect
  costPerAuth     Float
  commissionPct   Float    @default(10)
  promoPrefix     String   // e.g., "EMIRATES-"
  status          String   @default("active")
  createdAt       DateTime @default(now())
}

// Event WiFi package sale
model EventWiFiPackage {
  id              String   @id @default(uuid())
  propertyId      String
  tenantId        String
  eventId         String?
  eventName       String
  attendeeCount   Int
  planId          String
  planName        String
  durationDays    Int
  quotedPrice     Float
  actualUsage     Float?
  startDate       DateTime
  endDate         DateTime
  status          String   @default("active")
  createdAt       DateTime @default(now())
}
```

### 6.2 Guest Experience Models (F7-F12)

```prisma
// Multi-device registration
model WiFiDevice {
  id            String   @id @default(uuid())
  propertyId    String
  guestId       String
  macAddress    String
  deviceName    String?
  deviceType    String?  // iOS, Android, Windows, macOS, Linux, Other
  deviceToken   String?  // for auto-auth
  ipAddress     String?
  firstSeen     DateTime @default(now())
  lastSeen      DateTime @default(now())
  autoAuth      Boolean  @default(true)
  approved      Boolean  @default(true)
}

// GDPR/Privacy consent log
model WiFiConsentLog {
  id              String   @id @default(uuid())
  propertyId      String
  username        String
  guestId         String?
  consentTextHash String
  ipAddress       String
  macAddress      String?
  marketingOptIn  Boolean  @default(false)
  dataRetentionDays Int    @default(90)
  createdAt       DateTime @default(now())
}

// Identity verification log (for regulatory compliance)
model WiFiIdentityLog {
  id                  String   @id @default(uuid())
  propertyId          String
  username            String
  guestId             String?
  verificationMethod  String   // room_number, otp_sms, otp_email, government_id, selfie
  verifiedIdentity    String?  // room number / phone / email / ID number
  ipAddress           String
  macAddress          String?
  verifiedAt          DateTime @default(now())
}

// WiFi satisfaction survey
model WiFiSatisfactionSurvey {
  id            String   @id @default(uuid())
  propertyId    String
  guestId       String?
  username      String?
  rating        Int      // 1-5 stars
  comment       String?
  deviceType    String?
  ipAddress     String?
  apName        String?  // which AP they were connected to
  location      String?  // room number / lobby / pool
  responseTimeMs Int?   // how long they've been connected
  createdAt     DateTime @default(now())
}

// Post-auth portal content block
model PortalContentBlock {
  id          String   @id @default(uuid())
  portalId    String
  title       String
  content     String   // HTML
  position    String   @default("main") // banner, main, sidebar, footer
  contentType String   @default("custom") // restaurant, spa, activity, map, weather, custom
  sourceUrl   String?  // link to experience-catalog item
  sortOrder   Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

### 6.3 Security Models (F13-F17)

```prisma
// Device posture / quarantine policy
model WiFiQuarantinePolicy {
  id              String   @id @default(uuid())
  propertyId      String
  name            String
  checkTypes      String[] // os_version, antivirus, firewall, updates
  action          String   @default("allow") // allow, quarantine, deny
  quarantineVlan  Int?     // VLAN ID for quarantined devices
  notifyMessage   String?  // message shown to guest
  enabled         Boolean  @default(false)
  createdAt       DateTime @default(now())
}

// WiFi alert
model WiFiAlert {
  id              String   @id @default(uuid())
  propertyId      String
  type            String   // ap_down, latency_high, capacity_warning, auth_failure, radius_error
  severity        String   @default("warning") // info, warning, critical
  source          String   // nas_name, service_name
  message         String
  metadata        Json?    // additional context
  acknowledged    Boolean  @default(false)
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())
}

// WiFi SLA configuration
model WiFiSLAConfig {
  id                String   @id @default(uuid())
  propertyId        String   @unique
  uptimeTarget      Float    @default(99.9) // percentage
  speedTargetMbps   Float    @default(50)
  latencyTargetMs   Int      @default(50)
  measurementIntervalMins Int @default(5)
  enabled           Boolean  @default(true)
}

// WiFi SLA metric (periodic measurement)
model WiFiSLAMetric {
  id              String   @id @default(uuid())
  propertyId      String
  periodStart     DateTime
  periodEnd       DateTime
  uptimePct       Float?
  avgSpeedMbps    Float?
  avgLatencyMs    Float?
  totalSessions   Int      @default(0)
  totalBandwidthMb Float    @default(0)
  breachMinutes   Int      @default(0)
}

// Per-room VLAN isolation config
model WiFiRoomVlan {
  id              String   @id @default(uuid())
  propertyId      String
  roomId          String?
  roomNumber      String
  vlanId          Int
  subnet          String
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
}
```

### 6.4 Intelligence Models (F18-F23)

```prisma
// WiFi heatmap data point
model WiFiHeatmapData {
  id              String   @id @default(uuid())
  propertyId      String
  apMac           String
  apName          String?
  floorId         String?
  x               Float    // position on floor plan (0-100)
  y               Float
  signalStrength  Int      // dBm (-30 to -90)
  clientCount     Int      @default(0)
  bandwidthUtil   Float    @default(0) // percentage
  measuredAt      DateTime @default(now())
}

// Bandwidth forecast
model WiFiBandwidthForecast {
  id              String   @id @default(uuid())
  propertyId      String
  forecastDate    DateTime
  predictedPeakMbps  Float
  predictedAvgMbps   Float
  predictedUsers    Int
  occupancyPct       Float
  confidence        Float
  dataSource        String   // historical, ml, manual
  createdAt       DateTime @default(now())
}

// AP capacity report
model WiFiAPCapacity {
  id              String   @id @default(uuid())
  propertyId      String
  apMac           String
  apName          String
  maxClients      Int      @default(60)
  currentClients  Int      @default(0)
  channelUtilPct Float    @default(0)
  bandwidthUtilPct Float   @default(0)
  authFailures24h Int      @default(0)
  recommendation  String?
  measuredAt      DateTime @default(now())
}
```

### 6.5 Integration Models (F24-F28)

```prisma
// RADIUS proxy realm
model RadiusProxyRealm {
  id              String   @id @default(uuid())
  tenantId        String
  realm           String   @unique // e.g., "hotel.chicago.example.com"
  homeServerId    String   // which RADIUS server to proxy to
  priority        Int      @default(0)
  status          String   @default("active")
  createdAt       DateTime @default(now())
}

// RADIUS proxy server
model RadiusProxyServer {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  ipAddress       String
  port            Int      @default(1812)
  sharedSecret    String
  status          String   @default("active")
  healthCheckUrl  String?
  lastHealthCheck DateTime?
  isOnline        Boolean  @default(false)
}

// External portal provider (Purple WiFi, Cloud4Wi, etc.)
model PortalExternalProvider {
  id              String   @id @default(uuid())
  propertyId      String
  provider        String   @unique // purple, cloud4wi, socio, custom
  name            String
  apiKey          String
  config          Json?    // provider-specific config
  radiusServerIp  String?  // their RADIUS server IP
  radiusSecret    String?  // shared secret for their RADIUS
  status          String   @default("active")
  createdAt       DateTime @default(now())
}

// Pre-arrival WiFi delivery log
model WiFiPreArrivalLog {
  id              String   @id @default(uuid())
  propertyId      String
  guestId         String
  bookingId       String
  deliveryMethod  String   // email, sms, both
  deliveredAt     DateTime @default(now())
  status          String   @default("sent") // sent, failed, bounced
  errorMessage    String?
}
```

**Total New Models: ~25**

---

## 7. PER-FEATURE IMPLEMENTATION PLAN

### PHASE 1: Quick Wins (3-5 days each)

#### F13: GDPR Consent Screen
```
Files to modify:
  - src/components/wifi/portal-page.tsx (add consent config section)
  - src/app/api/wifi/portal/instances/[id]/route.ts (consent fields)
  - src/app/connect/page.tsx (show consent before auth)

New files:
  - src/app/api/wifi/consent/route.ts (log consent)

Prisma: WiFiConsentLog model

Steps:
  1. Add WiFiConsentLog to schema.prisma + db push
  2. Add consentConfig JSON to CaptivePortal model
  3. Add consent section to portal config UI
  4. Modify /connect page to show consent checkbox
  5. Add POST /api/wifi/consent to log consent
  6. Test: verify consent log is created on each auth
```

#### F7: Pre-Arrival WiFi Credential Delivery
```
Files to modify:
  - src/lib/wifi/services/provisioning-service.ts (add pre-arrival scan)
  - src/lib/services/email-service.ts (WiFi credential template)
  - src/lib/services/sms-service.ts (WiFi credential template)

New files:
  - src/app/api/wifi/pre-arrival/route.ts
  - src/app/api/cron/wifi-pre-arrival/route.ts (cron trigger)

Prisma: WiFiPreArrivalLog model

Steps:
  1. Add WiFiPreArrivalLog model
  2. Create email template for WiFi credentials
  3. Create SMS template for WiFi credentials
  4. Create /api/wifi/pre-arrival endpoint (scan + send)
  5. Create cron job (runs every 6 hours)
  6. Add settings to WiFiAAAConfig (enable, timing, channels)
  7. Test: create booking 24h out, verify email/SMS sent
```

#### F9: Multi-Device Auto-Registration
```
Files to modify:
  - src/components/wifi/portal-page.tsx (device management section)
  - src/app/api/wifi/sessions/route.ts (auto-auth logic)

New files:
  - src/app/api/wifi/devices/route.ts (CRUD)
  - src/lib/wifi/services/device-service.ts (device matching logic)

Prisma: WiFiDevice model

Steps:
  1. Add WiFiDevice model
  2. Create device-service.ts (register, match, auto-auth)
  3. Add POST /api/wifi/devices/register (after first auth)
  4. Add GET /api/wifi/devices/check (MAC lookup)
  5. Modify portal auth flow: check MAC → if known device, skip form
  6. Add device management UI (list, approve, revoke)
  7. Test: auth phone → open laptop → verify auto-connect
```

#### F14: Identity Verification Logging
```
Files to modify:
  - src/components/wifi/portal-page.tsx (identity verification config)
  - src/app/api/wifi/sessions/route.ts (log identity after auth)
  - src/app/connect/page.tsx (show verification step if required)

New files:
  - src/app/api/wifi/identity/route.ts (verification API)

Prisma: WiFiIdentityLog model

Steps:
  1. Add WiFiIdentityLog model
  2. Add identityVerification config to CaptivePortal
  3. Implement OTP email/SMS verification flow
  4. Log every successful auth with verification method
  5. Add compliance report (export identity logs for regulators)
  6. Test: enable room_number verification, verify log created
```

#### F21: WiFi Health Alerts
```
Files to modify:
  - src/components/wifi/reports-page.tsx (add alerts tab)

New files:
  - src/app/api/wifi/alerts/route.ts (CRUD + acknowledge)
  - src/app/api/cron/wifi-health-check/route.ts
  - src/lib/wifi/services/alert-service.ts (threshold evaluation)

Prisma: WiFiAlert model

Steps:
  1. Add WiFiAlert model
  2. Create alert-service.ts (evaluate thresholds)
  3. Create health check cron (runs every 5 min)
  4. Check: NAS health, RADIUS latency, AP client density, bandwidth capacity
  5. Create alerts API (list, acknowledge, resolve)
  6. Add alerts tab to reports page
  7. Add in-app notification integration
  8. Test: simulate AP down → verify alert created
```

### PHASE 2: Revenue Features (1-2 weeks each)

#### F1: Bandwidth Upsell
```
New files:
  - src/components/wifi/portal-upsell.tsx (upsell UI in portal)
  - src/app/api/wifi/upgrade/route.ts (process upgrade)
  - mini-services/portal-service/ (standalone portal server)

Prisma: WiFiUpgrade model

Steps:
  1. Build portal-service mini-service (Hono, port 3015)
  2. Create WiFiUpgrade model
  3. Build upsell API: validate → charge folio → update plan → CoA
  4. Build upsell portal page (show current speed, upgrade options)
  5. Integrate with freeradius-service CoA endpoint
  6. Integrate with billing/folio for room charge
  7. Deploy portal-service via systemd
  8. Configure nftables to redirect unauthenticated traffic to portal-service
  9. Test: auth on free tier → click upgrade → verify speed increases
```

#### F2: Ad-Supported WiFi
```
New files:
  - src/components/wifi/portal-ads.tsx (ad management UI)
  - src/app/api/wifi/portal/ads/route.ts (ad serving + tracking)
  - src/components/wifi/wifi-revenue-dashboard.tsx

Prisma: PortalAdCampaign model

Steps:
  1. Add PortalAdCampaign model
  2. Create ad serving API (returns active ad based on rotation)
  3. Create click/impression tracking endpoints
  4. Add ad slots to portal-service templates
  5. Build ad management UI (create campaign, upload creative, view stats)
  6. Build revenue dashboard (impressions, CTR, revenue per campaign)
  7. Test: create campaign → verify ad shows in portal → track click
```

### PHASE 3: Security & Intelligence (1-2 weeks each)

#### F16: Per-Room Network Isolation
```
Files to modify:
  - src/lib/wifi/services/provisioning-service.ts (auto-assign VLAN)
  - src/app/api/wifi/network/vlans/route.ts (bulk room VLAN creation)

New files:
  - src/app/api/wifi/room-vlans/route.ts
  - src/components/wifi/room-vlan-management.tsx

Prisma: WiFiRoomVlan model

Steps:
  1. Add WiFiRoomVlan model
  2. Create bulk VLAN provisioning (1 VLAN per room)
  3. Modify provisioning-service: on check-in, assign room VLAN via RADIUS Tunnel attributes
  4. Configure KEA DHCP: one subnet per VLAN
  5. Configure nftables: inter-VLAN deny rules
  6. Build room-VLAN management UI (list, assign, bulk create)
  7. Test: check-in room 101 → verify device on VLAN for room 101 only
```

#### F18: WiFi Heatmap
```
New files:
  - src/components/wifi/wifi-heatmap.tsx
  - src/app/api/wifi/reports/heatmap/route.ts

Prisma: WiFiHeatmapData model

Steps:
  1. Add WiFiHeatmapData model
  2. Create data collection (via vendor adapter API polling)
  3. Create heatmap API (aggregated data by floor/AP)
  4. Build heatmap component (SVG floor plan overlay)
  5. Integrate with existing floor-plan-editor for background images
  6. Add color coding (green/yellow/red for signal strength)
  7. Test: verify heatmap renders with sample data
```

---

## 8. DEPLOYMENT PLAN

### 8.1 Production Server Setup (Rocky Linux 10)

```bash
#!/bin/bash
# ============================================================
# StaySuite Gateway — Production Deployment
# ============================================================

# 1. OS Setup
sudo dnf update -y
sudo hostnamectl set-hostname staysuite-gateway
sudo timedatectl set-timezone Asia/Kolkata

# 2. Install packages (see Section 2.1)
./scripts/install-os-packages.sh

# 3. PostgreSQL 17
sudo postgresql-17-setup --initdb
sudo systemctl enable --now postgresql-17
sudo -u postgres createuser -s z
sudo -u postgres createdb -O z staysuite
sudo -u postgres psql -c "ALTER USER z WITH PASSWORD '<secure-password>';"

# 4. StaySuite Application
cd /opt
git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git
cd StaySuite-HospitalityOS
bun install
bun run db:push

# 5. Build Next.js
bun run build  # or use standalone output

# 6. FreeRADIUS (compile from source)
./scripts/compile-freeradius.sh

# 7. Kernel tuning
sudo cp scripts/sysctl/staysuite.conf /etc/sysctl.d/99-staysuite.conf
sudo sysctl --system

# 8. Systemd services
for svc in deploy/deploy/rocky10/systemd/*.service; do
  sudo cp $svc /etc/systemd/system/
done
sudo systemctl daemon-reload
sudo systemctl enable --now staysuite

# 9. dnsmasq
sudo cp configs/dnsmasq.conf /etc/dnsmasq.conf
sudo systemctl enable --now dnsmasq

# 10. KEA DHCP4
sudo cp configs/kea-kea-dhcp4.conf /etc/kea/kea-dhcp4.conf
sudo systemctl enable --now kea-dhcp4-server

# 11. nftables
sudo cp configs/nftables.conf /etc/nftables.conf
sudo systemctl enable --now nftables

# 12. Firewall base rules
sudo nft -f /etc/nftables.conf

# 13. Verify
curl -s http://localhost:3000/api/health
curl -s http://localhost:3010/api/health
systemctl status staysuite
```

### 8.2 Service Startup Order

```bash
# Order matters! Services depend on each other.
# Managed by systemd unit After= and Requires= directives.

1. postgresql-17          # Database must be first
2. NetworkManager          # Network interfaces must be up
3. nftables                # Base firewall rules
4. dnsmasq                 # DNS must resolve before DHCP
5. kea-dhcp4-server        # DHCP needs DNS for lease options
6. radiusd                 # FreeRADIUS needs PostgreSQL
7. staysuite-freeradius    # Management service (needs FreeRADIUS)
8. staysuite-nftables      # Dynamic firewall (needs nftables)
9. kea-service             # DHCP management (needs KEA)
10. dns-service            # DNS management (needs dnsmasq)
11. dhcp-service           # DHCP fallback (needs dnsmasq)
12. staysuite-realtime     # WebSocket service
13. staysuite-availability # Availability service
14. staysuite              # Main app (needs everything above)
15. portal-service         # Captive portal (needs Next.js API)
16. rrd-collector          # Bandwidth collector (cron)
```

---

## 9. TESTING STRATEGY

### 9.1 E2E Test Plan

| Test | What | How | Pass Criteria |
|------|------|-----|---------------|
| WiFi Auth (Room Number) | Guest authenticates with room + name | Connect to test SSID, enter room 101 + Sharma | Access-Accept, internet works |
| WiFi Auth (Voucher) | Guest uses QR code voucher | Scan QR → auto-fill code → connect | Voucher marked used, session created |
| WiFi Auth (PMS Credentials) | Returning guest | Enter PMS username + password | Auth success, previous preferences loaded |
| Bandwidth Upsell | Upgrade from free to premium | Click upgrade, select room charge | CoA sent, speed increased, folio charged |
| Multi-Device | Phone auth → laptop auto-connect | Auth phone, then connect laptop | No login form on laptop |
| Pre-Arrival | Booking 24h out → email sent | Create booking, run cron | Email received with WiFi credentials |
| GDPR Consent | Consent required before access | Connect, see consent screen | Cannot proceed without accepting |
| Session Timeout | Session expires after timeout | Set 5-min timeout, wait | Re-prompted for auth |
| CoA Disconnect | Admin disconnects guest session | Admin clicks disconnect in sessions page | Guest loses internet immediately |
| Content Filter | Blocked domain returns block page | Visit blocked-site.com | Redirected to block page |
| Identity Log | Every auth logged with identity | Auth with room number | WiFiIdentityLog created |
| Health Alert | AP down triggers alert | Stop AP health check | WiFiAlert created with type=ap_down |

---

## 10. SECURITY HARDENING

### 10.1 FreeRADIUS

```
[ ] Change shared secrets from testing123 to cryptographically random
[ ] Enable require_message_authenticator = yes (BlastRADIUS protection)
[ ] Set user = radius, group = radius (don't run as root)
[ ] Hash passwords in radpostauth (SHA-256 instead of plaintext)
[ ] Enable CoA receive (symlink sites-available/coa)
[ ] Add sslmode=require to PostgreSQL connection
[ ] Set max_pps on accounting socket
[ ] Disable proxy_requests (not used)
```

### 10.2 OS Level

```
[ ] Enable fail2ban for SSH, RADIUS, web services
[ ] Configure logrotate for all StaySuite logs
[ ] Set up automatic security updates
[ ] Configure firewall to only allow needed ports
[ ] Enable automatic reboot for kernel updates (monthly)
[ ] Set up certificate renewal for captive portal (Let's Encrypt)
[ ] Configure auditd for file integrity monitoring
```

### 10.3 Application

```
[ ] Remove all console.error from production API routes (265 instances)
[ ] Fix all empty catch blocks (3 instances)
[ ] Add rate limiting to captive portal auth endpoint
[ ] Add CSRF protection to portal forms
[ ] Validate all user inputs (sanitize IP, MAC, VLAN, SSID)
[ ] Enable Content-Security-Policy headers on portal
[ ] Add HSTS headers
```

---

## 11. MONITORING & OBSERVABILITY

### 11.1 Built-in Monitoring

| What | How | Frequency |
|------|-----|-----------|
| FreeRADIUS health | `radiusd -X` + /api/wifi/health | Real-time |
| NAS/AP health | `NasHealthLog` model + cron | Every 60s |
| RADIUS auth latency | `RadiusAuthLog` timestamp diff | Per-auth |
| Bandwidth usage | RRDtool + radacct polling | Every 60s |
| System resources | `SystemNetworkHealth` model | Every 5 min |
| Service health | systemd status + /api/health | Every 30s |
| DHCP lease utilization | KEA lease count vs pool size | Every 5 min |
| DNS resolution time | dnsmasq query timing | Every 5 min |
| nftables rule count | nft list ruleset \| wc -l | On change |
| SLA compliance | WiFiSLAMetric calculation | Every 5 min |

### 11.2 Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| AP Down | NAS health check fails 3x | Critical | Email + in-app |
| RADIUS Error Rate | > 10% auth failures in 5 min | Critical | Email + in-app |
| Bandwidth Saturation | > 90% capacity for 5 min | Warning | In-app |
| DHCP Pool Exhaustion | > 95% leases used | Warning | In-app |
| FreeRADIUS Down | Service not responding | Critical | Auto-restart + email |
| Session Anomaly | > 200% normal session count | Warning | In-app |
| DNS Resolution Failure | > 3 upstream DNS failures | Warning | In-app |
| SLA Breach | Uptime < target for 15 min | Warning | In-app + email |

---

## IMPLEMENTATION TIMELINE

```
WEEK 1-2:  Quick Wins
  ├─ F13: GDPR Consent Screen (3 days)
  ├─ F7: Pre-Arrival WiFi Delivery (4 days)
  └─ F14: Identity Verification Logging (3 days)

WEEK 3-4:  Device & Alert Management
  ├─ F9: Multi-Device Auto-Registration (5 days)
  ├─ F21: WiFi Health Alerts (4 days)
  └─ Infrastructure fixes (CoA, EAP, shared secrets) (5 days)

WEEK 5-6:  Revenue Features
  ├─ F1: Bandwidth Upsell + Portal Service (7 days)
  ├─ F4: Time-Based Plans (3 days)
  └─ F6: WiFi Revenue Dashboard (3 days)

WEEK 7-8:  Security & Compliance
  ├─ F16: Per-Room VLAN Isolation (7 days)
  ├─ F17: Zero Trust Network (3 days)
  └─ F15: Device Quarantine (5 days)

WEEK 9-10: Guest Experience
  ├─ F8: Personalized Captive Portal (5 days)
  ├─ F10: Digital Directory (3 days)
  └─ F12: Satisfaction Survey (3 days)

WEEK 11-12: Intelligence & Integration
  ├─ F18: WiFi Heatmap (5 days)
  ├─ F23: SLA Monitoring (3 days)
  ├─ F24: Full PMS Pipeline (5 days)
  └─ F22: AP Capacity Planning (3 days)

WEEK 13-14: Advanced Features
  ├─ F2: Ad-Supported WiFi (7 days)
  ├─ F11: Multi-Property Roaming (5 days)
  └─ F26: RADIUS Proxy (5 days)

WEEK 15-16: Polish & Testing
  ├─ F5: Event WiFi Packages (3 days)
  ├─ F27: External Portal Aggregation (5 days)
  ├─ Full E2E testing (5 days)
  └─ Documentation + Deployment guide (2 days)
```

**Total: ~16 weeks for all 28 features + infrastructure fixes**

---

*This is the full E2E implementation plan. No development has been done. Ready for development to begin on any phase.*

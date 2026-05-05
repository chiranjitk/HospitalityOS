# ulogd2 Offline Build — StaySuite-HospitalityOS

## Quick Start (Rocky Linux 10)

### Option A: Build from Source (Recommended)

```bash
# 1. Install minimal build tools
dnf install -y gcc make autoconf automake libtool flex bison gcc-c++ zlib-devel

# 2. Copy the ulogd2-clickhouse folder to your Rocky 10 server
scp -r tools/ulogd2-clickhouse/ root@rocky10:/tmp/ulogd2-clickhouse/

# 3. Build everything (all deps + ulogd2 from local sources — no internet needed)
cd /tmp/ulogd2-clickhouse
bash build-offline.sh

# 4. Verify
/usr/local/ulogd2/sbin/ulogd2 -V

# 5. Start
/usr/local/ulogd2/sbin/ulogd2 -c /usr/local/ulogd2/etc/ulogd.conf

# 6. Install as service
cp ulogd2.init /etc/rc.d/init.d/ulogd2
chmod +x /etc/rc.d/init.d/ulogd2
chkconfig --add ulogd2
chkconfig ulogd2 on
/etc/rc.d/init.d/ulogd2 start
```

### Option B: Use Pre-compiled Binary

```bash
# If you have dist/ulogd2-offline-compiled.tar.gz:
cd /tmp
tar xzf ulogd2-offline-compiled.tar.gz
cd ulogd2
bash deploy.sh
```

## What Gets Built

| Component | Source | Purpose |
|-----------|--------|---------|
| libnfnetlink 1.0.2 | netfilter.org | Base netfilter library |
| libmnl 1.0.5 | netfilter.org | Minimalistic netlink |
| libnetfilter_log 1.0.2 | netfilter.org | NFLOG input plugin |
| libnetfilter_conntrack 1.0.9 | netfilter.org | Conntrack input plugin |
| libnetfilter_acct 1.0.3 | netfilter.org | Accounting plugin |
| json-c 0.17 | s3.amazonaws.com | JSON output plugin |
| libpcap 1.10.5 | github.com/tcpdump | PCAP output plugin |
| ulogd2 2.0.8 | netfilter.org | **The daemon itself** |

## Directory Structure

```
tools/ulogd2-clickhouse/
├── build-offline.sh          # Full offline build (all deps + ulogd2)
├── build.sh                  # Online build (downloads deps from internet)
├── download-deps.sh          # Download all source tarballs
├── ulogd.conf                # ulogd2 config (NFLOG → JSON)
├── ulogd2.init               # SysV init script (Rocky Linux)
├── ulogd2.service            # systemd unit file
├── src/                      # Downloaded source tarballs (committed)
│   ├── ulogd-2.0.8.tar.bz2
│   ├── libnfnetlink-1.0.2.tar.bz2
│   ├── libmnl-1.0.5.tar.bz2
│   ├── libnetfilter_log-1.0.2.tar.bz2
│   ├── libnetfilter_conntrack-1.0.9.tar.bz2
│   ├── libnetfilter_acct-1.0.3.tar.bz2
│   ├── json-c-0.17.tar.gz
│   └── libpcap-1.10.5.tar.gz
└── dist/                     # Build output
    └── ulogd2-offline-sources.tar.gz  # Full source + build scripts
```

## Pipeline Architecture

```
nftables NFLOG (group 20)
  → ulogd2 (/usr/local/ulogd2/sbin/ulogd2)
    → JSON output (/var/log/ulogd/json/sni-queries.log)
      → sni-parser (port 3022)
        → ClickHouse ipdr.sni_log
```

## Verification

```bash
# Check ulogd2 is running
/etc/rc.d/init.d/ulogd2 status

# Check NFLOG rules are loaded
nft list ruleset | grep NFLOG

# Check JSON output
tail -5 /var/log/ulogd/json/sni-queries.log

# Check sni-parser health
curl -s http://localhost:3022/api/health | python3 -m json.tool
```

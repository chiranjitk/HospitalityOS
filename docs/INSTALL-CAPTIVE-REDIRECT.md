# StaySuite Captive Portal Redirect Server v3.0 — Installation Guide

## What It Does

The **captive-redirect** service is a high-performance HTTP redirect server that intercepts guest WiFi traffic and redirects unauthenticated devices to the StaySuite portal login page. It handles 5,000+ concurrent sessions with sub-millisecond response latency.

### Architecture

```
┌─────────────┐      ┌──────────────────────────────────────────────────────┐
│   Guest     │      │              StaySuite Server                       │
│   Device    │      │                                                      │
│             │      │  ┌──────────┐    ┌──────────────┐    ┌────────────┐  │
│  ┌───────┐  │ HTTP │  │ nftables │───▶│  captive-    │───▶│  Portal    │  │
│  │ OS    │──┼──────┼─▶│  REDIRECT│    │  redirect    │302 │  :3000     │  │
│  │ Detect │  │ :80  │  │  :80→8888│    │  :8888 HTTP  │    │  /connect  │  │
│  └───────┘  │      │  │  :443→   │    │  :8443 HTTPS │    └────────────┘  │
│             │ HTTPS│  │    :8443  │    │  (TLS SNI)   │                   │
│  ┌───────┐  │ :443 │  │          │    │              │    ┌────────────┐  │
│  │ App   │──┼──────┼─▶│ mark     │    │  ┌────────┐  │    │  StaySuite │  │
│  │ (TLS) │  │      │  │ 10000=   │    │  │Metrics │  │───▶│  Main App  │  │
│  └───────┘  │      │  │ guest    │    │  │API     │  │    │  (Next.js) │  │
│             │      │  │ 20000=   │    │  └────────┘  │    └────────────┘  │
│             │      │  │ HTTPS    │    │              │                   │
└─────────────┘      │  └──────────┘    └──────────────┘                   │
                     │                                                      │
                     │  ┌──────────────────────────────────────────────┐    │
                     │  │  Authenticated guests: NO mark → NO redirect │    │
                     │  │  Unauthenticated guests: mark 10000/20000     │    │
                     │  │  → nftables REDIRECT → captive-redirect → 302 │    │
                     │  └──────────────────────────────────────────────┘    │
                     └──────────────────────────────────────────────────────┘
```

### How It Works

1. **Guest connects to WiFi** — OS performs captive portal detection (e.g. iOS checks `captive.apple.com`)
2. **nftables intercepts** — Unauthenticated guest traffic is marked with `10000` (HTTP) or `20000` (HTTPS) by the mangle table
3. **REDIRECT to captive-redirect** — `nat prerouting` redirects marked packets from `:80` → `:8888` and `:443` → `:8443`
4. **302 redirect response** — captive-redirect sends HTTP 302 to `http://server-ip:3000/connect`
5. **OS shows portal** — Guest's OS displays the captive portal login page
6. **After authentication** — Guest is removed from the unauthenticated mark set → traffic flows normally

### Supported Devices (16 types)

| Platform | Detection Method | Status |
|----------|-----------------|--------|
| Apple iOS/macOS | CNA (Captive Network Assistant) | Fully supported |
| Android | connectivitycheck.gstatic.com | Fully supported |
| Windows 10/11 | NCSI (msftconnecttest.com) | Fully supported |
| Chrome OS | captiveportal.google.com | Fully supported |
| Firefox | detectportal.firefox.com | Fully supported |
| Linux/Ubuntu | NetworkManager check | Fully supported |
| Samsung Smart TV | HTTP redirect | Fully supported |
| LG WebOS TV | HTTP redirect | Fully supported |
| PlayStation 4/5 | HTTP connectivity check | Fully supported |
| Xbox | HTTP connectivity check | Fully supported |
| Nintendo Switch | HTTP connectivity check | Fully supported |
| Amazon Fire TV | HTTP redirect | Fully supported |
| Roku | HTTP redirect | Fully supported |
| IoT devices | Basic HTTP redirect | Fully supported |

---

## Quick Start (3 commands)

```bash
# 1. Download and run the installer
curl -fsSL https://raw.githubusercontent.com/staysuite/my-project/main/docs/install-captive-redirect.sh | sudo bash

# 2. Or with custom options
sudo bash install-captive-redirect.sh --portal-ip 192.168.1.100 --portal-port 3000

# 3. Verify it's running
curl http://127.0.0.1:8888/api/health | jq .
```

### Non-interactive (for automation/CI)

```bash
sudo bash install-captive-redirect.sh \
  --portal-ip 192.168.1.100 \
  --portal-port 3000 \
  --non-interactive
```

---

## Configuration Reference

### Environment Variables

Set in `/opt/staysuite/captive-redirect/.env` or via PM2/systemd:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8888` | HTTP listen port |
| `HTTPS_PORT` | `8443` | HTTPS/TLS SNI listen port |
| `PORTAL_PORT` | `3000` | Portal page port (target of redirect) |
| `PORTAL_SCHEME` | `http` | `http` or `https` for portal URL |
| `REDIRECT_PATH` | `/connect` | Portal redirect path |
| `CLIENT_TIMEOUT_MS` | `5000` | Client socket timeout in ms |
| `REDIRECT_COOLDOWN_MS` | `3000` | Per-IP cooldown between redirects |
| `RATE_LIMIT_MAX` | `30` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `10000` | Rate limit window in ms |

### Installer CLI Options

```
--portal-ip <IP>         Portal server IP (default: auto-detect)
--portal-port <PORT>     Portal listen port (default: 3000)
--portal-scheme <SCHEME> Portal scheme http/https (default: http)
--http-port <PORT>       HTTP redirect port (default: 8888)
--https-port <PORT>      HTTPS/TLS redirect port (default: 8443)
--install-dir <DIR>      Installation directory (default: /opt/staysuite/captive-redirect)
--skip-nftables          Skip nftables setup
--skip-pm2              Skip PM2 setup (use systemd only)
--non-interactive        Use defaults without prompting
```

---

## nftables Setup

### How the Rules Work

The captive portal redirect relies on **nftables packet marks** set by the main firewall chain. Only unauthenticated guest traffic gets marked and redirected.

```
MANGLE TABLE (prerouting):
  ┌──────────────────────────────────────────┐
  │  Unauthenticated guest: mark set 10000   │  ← Set by auth system
  │  Authenticated guest:    mark = 0        │  ← Normal traffic
  └──────────────────────────────────────────┘
                    │
                    ▼
NAT TABLE (prerouting):
  ┌──────────────────────────────────────────┐
  │  position 0: mark 10000 dport 80         │
  │    → redirect to :8888                   │
  │  position 1: mark 20000 dport 443        │
  │    → redirect to :8443                   │
  │  ... rest of normal NAT rules            │
  └──────────────────────────────────────────┘
```

### Key Rules

```bash
# HTTP: redirect port 80 → captive-redirect port 8888
nft 'insert rule inet nat prerouting position 0 mark 10000 tcp dport 80 redirect to :8888'

# HTTPS: redirect port 443 → captive-redirect port 8443
nft 'insert rule inet nat prerouting position 0 mark 20000 tcp dport 443 redirect to :8443'
```

### Reapplying Rules

The installer creates a standalone script at:
```bash
/opt/staysuite/captive-redirect/nftables-captive-redirect.sh
```

Run it anytime to reapply the redirect rules:
```bash
sudo bash /opt/staysuite/captive-redirect/nftables-captive-redirect.sh
```

### Mark Values Reference

| Mark | Meaning | Redirect |
|------|---------|----------|
| `10000` | Unauthenticated guest HTTP traffic | `:80` → `:8888` |
| `20000` | Unauthenticated guest HTTPS traffic | `:443` → `:8443` |
| `0` | Authenticated/normal traffic | No redirect |

> **Note:** The mark values are set by the main `defaultchains_cryptsk.sh` firewall script in the mangle `accountingup` chain. The captive-redirect installer only adds the NAT redirect rules that react to these marks.

---

## Process Management

### PM2 (default)

```bash
# View status
pm2 status staysuite-captive-redirect

# View logs
pm2 logs staysuite-captive-redirect

# Restart
pm2 restart staysuite-captive-redirect

# Stop
pm2 stop staysuite-captive-redirect

# Monitor
pm2 monit
```

### systemd (alternative)

```bash
# Switch from PM2 to systemd
pm2 delete staysuite-captive-redirect
systemctl start staysuite-captive-redirect
systemctl enable staysuite-captive-redirect

# View logs
journalctl -u staysuite-captive-redirect -f

# Restart
systemctl restart staysuite-captive-redirect

# Check status
systemctl status staysuite-captive-redirect
```

---

## API Reference

All endpoints are available on `http://127.0.0.1:8888`.

### Health Check

```bash
GET /api/health
GET /health
```

Response:
```json
{
  "service": "captive-redirect",
  "version": "3.0.0",
  "status": "running",
  "httpPort": 8888,
  "httpsPort": 8443,
  "uptime": 3600.5,
  "activeConnections": 42,
  "peakConnections": 150,
  "totalRedirects": 15234,
  "memoryUsage": { "rss": 52428800, "heapUsed": 20971520, "heapTotal": 41943040 }
}
```

### Metrics

```bash
GET /api/metrics
GET /api/stats
```

Response includes:
- `totalRedirects` — Total redirects served
- `perOsRedirects` — Redirects per operating system
- `recentHourlyRedirects` — Last 24 hours of redirect counts
- `redirectsPerSecond` — Average redirect rate
- `totalRateLimited` — Count of rate-limited requests
- `totalCooldownSkips` — Count of cooldown-suppressed redirects
- `memoryUsage` — RSS, heap used, heap total

### Whitelist Management

```bash
# List whitelisted IPs
GET /api/whitelist

# Add IP to whitelist (bypasses redirect)
POST /api/whitelist/192.168.1.50

# Remove IP from whitelist
DELETE /api/whitelist/192.168.1.50
```

---

## Troubleshooting

### Service won't start

```bash
# Check if port is already in use
ss -tlnp | grep -E '8888|8443'

# Check Bun installation
bun --version

# Run manually to see errors
cd /opt/staysuite/captive-redirect && bun index.ts
```

### Port already in use

```bash
# Find what's using port 8888
sudo lsof -i :8888
# or
sudo ss -tlnp | grep 8888

# Kill the process
sudo kill <PID>
```

### nftables rules not working

```bash
# Verify the rules exist
sudo nft list chain inet nat prerouting

# Check if marks are being set (look in mangle prerouting)
sudo nft list chain inet mangle prerouting

# Reapply rules
sudo bash /opt/staysuite/captive-redirect/nftables-captive-redirect.sh

# Verify mark on a test packet
sudo nft --handle list chain inet mangle prerouting
```

### Guest devices not seeing portal

1. **Check nftables marks** — Verify unauthenticated guests are getting marked with `10000`/`20000`
2. **Check captive-redirect is listening** — `curl http://127.0.0.1:8888/api/health`
3. **Check firewall** — Ensure ports `8888` and `8443` are open locally
4. **Test manually** — From a guest device, visit `http://neverssl.com` — should redirect
5. **Check device-specific detection** — Some devices have delayed captive detection; try opening any HTTP site

### iOS shows certificate error instead of portal

This is expected for HTTPS captive detection. iOS will show a certificate error page which contains a link to the portal. For a smoother experience, ensure the HTTP redirect path (:80 → :8888) is working correctly.

### Rate limiting is too aggressive

```bash
# Increase rate limits in .env
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=10000

# Then restart
pm2 restart staysuite-captive-redirect
```

### Too many redirects (OS keeps showing portal)

```bash
# Increase cooldown period
REDIRECT_COOLDOWN_MS=10000

# Then restart
pm2 restart staysuite-captive-redirect
```

### View logs

```bash
# PM2 logs
pm2 logs staysuite-captive-redirect --lines 100

# systemd logs
journalctl -u staysuite-captive-redirect -f --no-pager

# Direct log files
tail -f /var/log/staysuite/captive-redirect-out.log
tail -f /var/log/staysuite/captive-redirect-error.log
```

---

## File Structure

```
/opt/staysuite/
├── captive-redirect/
│   ├── index.ts                    # Main server (TypeScript)
│   ├── package.json                # Bun project config
│   ├── .env                        # Environment variables
│   ├── ecosystem.config.cjs        # PM2 process config
│   └── nftables-captive-redirect.sh # Standalone nftables script
├── shared/
│   └── logger.ts                   # Shared structured logger
└── /var/log/staysuite/
    ├── captive-redirect-out.log    # stdout log
    └── captive-redirect-error.log  # stderr log
```

---

## Security Notes

- **Zero external dependencies** — No npm packages, reducing supply-chain attack surface
- **Rate limiting** — Prevents abuse from misconfigured or malicious clients (30 req/10s per IP)
- **Connection timeout** — 5-second client timeout prevents connection exhaustion
- **No authentication on API** — API endpoints are intended for localhost access only; restrict with firewall rules if needed
- **HTTPS SNI detection** — TLS connections are immediately closed (no certificate is served), which triggers OS captive portal detection

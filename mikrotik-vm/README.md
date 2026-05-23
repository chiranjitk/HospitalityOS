# MikroTik RouterOS v7.17 — QEMU Virtual Machine

## Overview
Real MikroTik RouterOS v7.17 (Cloud Hosted Router) running in QEMU on the sandbox.

## Configuration
| Setting | Value |
|---------|-------|
| RouterOS Version | 7.17 (stable) |
| Board | CHR QEMU Standard PC (i440FX) |
| Architecture | x86_64 |
| CPU | 2 cores @ 2.8GHz (TCG emulation) |
| RAM | 512MB |
| Disk | 1GB (expanded from 128MB CHR image) |
| Identity | StaySuite-Hotel |

## Port Mappings (Host → Guest)
| Host Port | Guest Port | Service |
|-----------|------------|---------|
| 3020 | 80 | WebFig / REST API (HTTP) |
| 3021 | 443 | WebFig (HTTPS) |
| 8728 | 8728 | RouterOS API |
| 8729 | 8729 | RouterOS API-SSL |
| 2222 | 22 | SSH |

## Default Login
- **Username**: admin
- **Password**: admin

## Network Configuration
| Interface | IP | Purpose |
|-----------|----|---------| 
| ether1 | 10.0.2.15/24 (DHCP) | WAN (Internet via QEMU NAT) |
| ether2 | — | LAN (port of bridge1) |
| bridge1 | 192.168.88.1/24 | Hotel LAN Bridge |

## Configured Services
- **DHCP Server**: hotel-dhcp on bridge1, pool 192.168.88.10-254
- **Hotspot Server**: hotel-hotspot on bridge1
- **Hotspot Users**: room101, room202, staff
- **Hotspot Profiles**: free-guest (1M/2M), premium (5M/10M)
- **RADIUS**: 10.0.2.2:1812/1813, secret=StaySuiteRADIUS2025
- **DNS**: 8.8.8.8, 8.8.4.4, 1.1.1.1 (remote requests enabled)
- **NAT**: srcnat masquerade on ether1
- **Firewall**: Basic input/forward rules

## REST API Examples
```bash
# System info
curl -u admin:admin http://localhost:3020/rest/system/resource

# Interfaces
curl -u admin:admin http://localhost:3020/rest/interface

# Hotspot users
curl -u admin:admin http://localhost:3020/rest/ip/hotspot/user

# DHCP leases
curl -u admin:admin http://localhost:3020/rest/ip/dhcp-server/lease
```

## Files
- `mikrotik-disk.img` — VM disk (1GB raw image)
- `chr-7.17.img` — Original CHR disk image (128MB)
- `chr-7.17.img.zip` — Downloaded MikroTik CHR archive
- `start-mikrotik.sh` — QEMU startup script
- `serial.log` — Serial console output
- `mikrotik.pid` — QEMU process PID

## Startup
```bash
bash /home/z/my-project/mikrotik-vm/start-mikrotik.sh
```

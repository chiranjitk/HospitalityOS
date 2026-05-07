# StaySuite Administrator Guide
## System Administration Manual

**Version**: 2.0  
**Last Updated**: May 2026

---

## Table of Contents

1. [Tenant Management](#1-tenant-management)
2. [User & Role Management](#2-user--role-management)
3. [Security Configuration](#3-security-configuration)
4. [Integration Setup](#4-integration-setup)
5. [WiFi Gateway Configuration](#5-wifi-gateway-configuration)
6. [Channel Manager Setup](#6-channel-manager-setup)
7. [Payment Gateway Setup](#7-payment-gateway-setup)
8. [Backup & Recovery](#8-backup--recovery)
9. [System Monitoring](#9-system-monitoring)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tenant Management

### 1.1 Creating a New Tenant

1. Navigate to **Admin → Tenant Management**
2. Click **Add Tenant**
3. Configure tenant details:

| Field | Description |
|-------|-------------|
| Tenant Name | Organization name (e.g., "Royal Stay Hotels") |
| Subdomain | `tenant.staysuite.io` |
| Plan | Subscription tier |
| Admin Email | Primary admin contact (e.g., admin@royalstay.in) |
| City | Tenant city |
| Timezone | Operating timezone |
| Max Properties | Property limit |
| Max Users | User limit |
| Max Rooms | Room inventory limit |

4. Click **Create Tenant**

### 1.2 Tenant Lifecycle

```
Trial → Active → Suspended → Cancelled → Archived
```

| State | Description |
|-------|-------------|
| **Trial** | Free trial period (14 days) |
| **Active** | Paid subscription active |
| **Suspended** | Payment failed or manual suspend |
| **Cancelled** | Subscription terminated |
| **Archived** | Data archived, tenant inactive |

### 1.3 Tenant Configuration

1. Open tenant from list
2. Configure:

**General Settings:**
- Timezone, Currency, Language
- Logo, Branding colors

**Resource Limits:**
- Storage quota, API rate limits
- User limits, Property limits

**Feature Flags:**
- Enable/disable addon modules per tenant

### 1.4 Demo Tenants

The system includes pre-configured demo tenants:

| Tenant | Email | Password | Properties |
|--------|-------|----------|------------|
| Royal Stay Hotels | admin@royalstay.in | admin123 | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | admin@oceanview.com | admin123 | - |
| Platform Admin | platform@staysuite.com | admin123 | (All tenants) |

### 1.5 Usage Tracking

1. Navigate to **Admin → Usage Tracking**
2. View metrics per tenant:
   - API calls, Storage used
   - Active users, Booking count
   - WiFi sessions

---

## 2. User & Role Management

### 2.1 Role Configuration

9 Default roles:

| Role | Access Level |
|------|--------------|
| **Admin** | Full system access (`*`) |
| **Manager** | Operations + Reports |
| **Front Desk** | Bookings, Check-in/out, Billing |
| **Housekeeping** | Tasks, Room status, Maintenance |
| **Night Auditor** | Dashboard, Billing, Reports, Check-in/out |
| **Revenue Manager** | Reports, Revenue, Pricing, Channels |
| **Marketing** | Dashboard, Guests, CRM, Marketing |
| **Accountant** | Dashboard, Billing, Reports |
| **Maintenance** | Dashboard, Rooms, Tasks, Assets, IoT |

### 2.2 Creating Custom Roles

1. Navigate to **Admin → Role Permissions**
2. Click **Add Role**
3. Set permissions per module (module.action format):

```
┌─────────────────┬───────┬───────┬───────┬───────┐
│ Module          │ View  │ Create│ Edit  │ Delete│
├─────────────────┼───────┼───────┼───────┼───────┤
│ Bookings        │  ✓    │  ✓    │  ✓    │  ✗    │
│ Guests          │  ✓    │  ✓    │  ✓    │  ✗    │
│ Billing         │  ✓    │  ✓    │  ✓    │  ✗    │
│ Reports         │  ✓    │  ✗    │  ✗    │  ✗    │
│ Settings        │  ✗    │  ✗    │  ✗    │  ✗    │
└─────────────────┴───────┴───────┴───────┴───────┘
```

4. Save role

### 2.3 User Provisioning

1. Navigate to **Admin → User Management**
2. Click **Add User**
3. Configure: Email, Name, Role, Properties, 2FA requirement
4. Send invitation

### 2.4 SSO Configuration

**SAML 2.0 Setup:**

1. Navigate to **Security Center → SSO Configuration**
2. Click **Add SAML Connection**
3. Configure: Identity Provider URL, SSO URL, Certificate, Attribute mapping
4. Test connection
5. Enable for users

**OIDC Setup:**

1. Click **Add OIDC Connection**
2. Configure: Discovery URL, Client ID, Client Secret, Scope
3. Test and enable

**LDAP Setup:**

1. Click **Add LDAP Connection**
2. Configure: Server URL, Bind DN, Base DN, Filter, Attribute mapping
3. Test connection

---

## 3. Security Configuration

### 3.1 Password Policy

1. Navigate to **Settings → Security**
2. Configure password requirements:

| Setting | Value |
|---------|-------|
| Minimum Length | 8 characters |
| Require Uppercase | Yes |
| Require Lowercase | Yes |
| Require Numbers | Yes |
| Require Special Chars | Yes |
| Password Expiry | Configurable per tenant (default: 90 days) |
| Password History | Remember last N passwords |

### 3.2 Two-Factor Authentication

1. Navigate to **Security Center → Two-Factor Auth**
2. Configure:
   - Require 2FA for all users or admins only
   - Allowed methods (TOTP, SMS, Email)
3. Users set up 2FA via Profile → Security

### 3.3 Session Management

1. Navigate to **Security Center → Device Sessions**
2. Configure:
   - Session timeout (default: 30 min idle)
   - Concurrent sessions limit
   - Force logout on password change

### 3.4 Account Lockout

- 5 failed login attempts → 30 minute lockout
- Configurable via Security Settings

### 3.5 Audit Logs

1. Navigate to **Security Center → Audit Logs**
2. View all system activity:
   - User actions, Data changes
   - Login attempts, API calls
3. Filter by: User, Module, Action type, Date range
4. Export logs

---

## 4. Integration Setup

### 4.1 API Access

1. Navigate to **Settings → System Integrations → API**
2. Generate API keys: Key name, Expiration date, Scopes
3. Copy and store securely (shown only once)

### 4.2 Webhooks

1. Navigate to **Webhooks** module
2. Add webhook endpoint: URL, Secret, Events
3. Monitor delivery in **Delivery Logs**
4. Retry failed deliveries from **Retry Queue**

### 4.3 Third-Party API Connections

1. Navigate to **Integrations → Third-Party APIs**
2. Configure external services: API endpoint, Authentication, Rate limits

---

## 5. WiFi Gateway Configuration

### 5.1 FreeRADIUS Architecture

StaySuite includes FreeRADIUS v3.2.7 compiled from source with native PostgreSQL SQL module:

```
┌─────────────┐     RADIUS      ┌──────────────────┐
│   Gateway   │ ◄─────────────► │  FreeRADIUS       │
│ (MikroTik)  │                 │  v3.2.7           │
└─────────────┘                 │  (PostgreSQL SQL) │
       │                        └──────────────────┘
       │ Captive Portal                     │
       ▼                                     │
┌─────────────┐                       ┌─────────────┐
│   Guest     │ ◄───────────────────── │  PostgreSQL│
│   Device    │  Captive Redirect (8888)│     v17     │
└─────────────┘                       └─────────────┘
```

### 5.2 Adding a WiFi Gateway

1. Navigate to **WiFi → RADIUS & Gateway**
2. Add RADIUS client:
   - Gateway IP (NAS IP)
   - Shared Secret
   - Auth Port (1812), Acct Port (1813)
   - Vendor type
3. Configure NAS settings
4. Test connection
5. Save configuration

### 5.3 Captive Portal

The captive portal redirect service runs on port 8888:
- Redirects guests to StaySuite portal on port 3000
- Configurable whitelist for portal-exempt URLs
- Template-based portal pages

### 5.4 Bandwidth Plans

6 pre-configured WiFi plans:

| Plan | Download | Upload | Data Cap |
|------|----------|--------|----------|
| Free | 2 Mbps | 1 Mbps | 500 MB/day |
| Basic | 5 Mbps | 2 Mbps | 1 GB/day |
| Standard | 10 Mbps | 5 Mbps | 3 GB/day |
| Premium | 25 Mbps | 10 Mbps | 10 GB/day |
| Business | 50 Mbps | 25 Mbps | Unlimited |
| Enterprise | 100 Mbps | 50 Mbps | Unlimited |

### 5.5 Advanced Network Features

- **DHCP Server**: Subnet management, reservations, hostname filters
- **DNS Server**: DNS records, redirect rules, zones
- **Firewall**: Zone-based firewall, bandwidth pools, rate limiting
- **Content Filter**: Web category blocking with scheduling
- **VLAN Management**: Per-room and per-floor VLAN configuration
- **Multi-WAN**: Failover and load balancing configuration

---

## 6. Channel Manager Setup

### 6.1 Connecting Booking.com

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection → Booking.com**
3. Enter credentials: Hotel ID, API Key, API Secret
4. Test connection
5. Enable connection

### 6.2 Channel Mapping

1. Navigate to **Channel Manager → Mapping**
2. Map room types: Internal room type ↔ OTA room type
3. Map rate plans: Internal rate plan ↔ OTA rate plan
4. Verify mappings
5. Enable sync

### 6.3 Sync Configuration

| Setting | Value |
|---------|-------|
| Sync Mode | Real-time / Scheduled |
| Sync Interval | 5 minutes (if scheduled) |
| Retry Attempts | 5 |
| Retry Delay | Exponential backoff |
| Conflict Resolution | Prefer OTA / Prefer PMS |

---

## 7. Payment Gateway Setup

### 7.1 Stripe Integration

1. Navigate to **Integrations → Payment Gateways → Stripe**
2. Configure: Publishable Key, Secret Key, Webhook Secret
3. Set webhook URL in Stripe dashboard
4. Test payment
5. Enable

### 7.2 Razorpay Integration (India)

1. Click **Add Gateway → Razorpay**
2. Configure: Key ID, Key Secret, Webhook Secret
3. Enable payment methods: Cards, UPI, NetBanking, Wallets
4. Test and enable

### 7.3 Multi-Gateway Routing

1. Navigate to **Integrations → Payment Gateways → Routing**
2. Configure: Primary gateway, Fallback gateway, Routing by currency/amount
3. Enable routing

---

## 8. Backup & Recovery

### 8.1 Automated Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Transaction Logs (WAL) | Continuous | 24 hours |

### 8.2 Manual Backup

```bash
pg_dump staysuite > /backups/staysuite_$(date +%Y%m%d).sql
gzip /backups/staysuite_$(date +%Y%m%d).sql
```

### 8.3 Data Export (GDPR)

1. Navigate to **Settings → GDPR → Export Data**
2. Select tenant and data scope
3. Generate and download archive

### 8.4 Recovery

```bash
psql -U postgres -d staysuite < /backups/staysuite_YYYYMMDD.sql
```

---

## 9. System Monitoring

### 9.1 Health Dashboard

1. Navigate to **Admin → System Health**
2. View metrics:
   - API Response Time
   - Database Connections
   - FreeRADIUS Status
   - Realtime Service Status
   - Memory Usage
   - CPU Usage

### 9.2 PM2 Process Management

The platform runs 4 services:

| Service | Port | Description |
|---------|------|-------------|
| staysuite-nextjs | 3000 | Main application |
| staysuite-freeradius | 1812/1813 | RADIUS authentication |
| staysuite-captive-redirect | 8888 | Captive portal redirect |
| staysuite-realtime | 3003 | WebSocket real-time |

```bash
pm2 status              # Check all services
pm2 logs staysuite-nextjs  # View logs
pm2 restart all         # Restart all
```

### 9.3 Health Check Endpoint

```http
GET /api/health
```

---

## 10. Troubleshooting

### 10.1 Common Issues

**OTA Sync Failures:**

| Issue | Solution |
|-------|----------|
| Authentication error | Verify API credentials |
| Mapping missing | Check room/rate mappings |
| Rate limit exceeded | Wait and retry |
| Invalid data | Check required fields |

**Payment Failures:**

| Issue | Solution |
|-------|----------|
| Gateway timeout | Check gateway status |
| Invalid card | Verify card details |
| 3DS failure | Check 3DS configuration |

**WiFi Issues:**

| Issue | Solution |
|-------|----------|
| User can't connect | Check RADIUS config, NAS health |
| Bandwidth not applied | Verify plan mapping |
| Session not tracked | Check accounting interval |
| Portal not loading | Check captive redirect service (port 8888) |

### 10.2 Diagnostic Tools

1. **Gateway Diagnostics**: WiFi → Gateway Diagnostics → Speed test
2. **Webhook Test**: Send test webhook from Webhooks module
3. **RADIUS Test**: Check NAS health and reload logs
4. **Connection Test**: Test gateway connections

### 10.3 Support Escalation

| Priority | Response | Contact |
|----------|----------|---------|
| P1 - Critical | 15 min | support@cryptsk.com |
| P2 - High | 1 hour | support@cryptsk.com |
| P3 - Medium | 4 hours | support@cryptsk.com |
| P4 - Low | 24 hours | support@cryptsk.com |

---

*© 2026 Cryptsk Pvt Ltd*

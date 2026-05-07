# StaySuite Administrator Guide
## System Administration Manual

**Version**: 2.1  
**Last Updated**: June 2026

---

## Table of Contents

1. [System Overview & Statistics](#1-system-overview--statistics)
2. [Tenant Management](#2-tenant-management)
3. [User & Role Management](#3-user--role-management)
4. [Security Configuration](#4-security-configuration)
5. [Integration Setup](#5-integration-setup)
6. [WiFi Gateway Configuration](#6-wifi-gateway-configuration)
7. [Channel Manager Setup](#7-channel-manager-setup)
8. [Payment Gateway Setup](#8-payment-gateway-setup)
9. [Cron Job Management](#9-cron-job-management)
10. [Night Audit Configuration](#10-night-audit-configuration)
11. [Posting Rules Configuration](#11-posting-rules-configuration)
12. [Scheduled Charges Setup](#12-scheduled-charges-setup)
13. [Revenue Accounts Setup](#13-revenue-accounts-setup)
14. [Commission Rules Setup](#14-commission-rules-setup)
15. [Mini-Services Management](#15-mini-services-management)
16. [Backup & Recovery](#16-backup--recovery)
17. [System Monitoring](#17-system-monitoring)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. System Overview & Statistics

### 1.1 Platform Scale

StaySuite v2.1 is a comprehensive hotel Property Management System built on a microservices architecture:

| Metric | Count |
|--------|-------|
| **API Routes** | 617 |
| **Database Models** | 294 |
| **Frontend Components** | 532 |
| **Mini-Services** | 11 |

### 1.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    StaySuite Platform (v2.1)             │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Next.js  │ FreeRADIUS│ Captive  │ Realtime │  7 Additional│
│ App      │ Server   │ Redirect │ WS Server│  Mini-Services│
│ :3000    │ :1812/13 │ :8888    │ :3003    │  :3005-3011  │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                    PostgreSQL v17                        │
│              (started manually via pg_ctl)               │
└─────────────────────────────────────────────────────────┘
```

> **Note**: PostgreSQL is started manually via `pg_ctl`, **NOT** via PM2. See [Section 17.2](#172-pm2-process-management) for details.

---

## 2. Tenant Management

### 2.1 Creating a New Tenant

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

### 2.2 Tenant Lifecycle

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

### 2.3 Tenant Configuration

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

### 2.4 Demo Tenants

The system includes pre-configured demo tenants:

| Tenant | Email | Password | Properties |
|--------|-------|----------|------------|
| Royal Stay Hotels | admin@royalstay.in | admin123 | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | admin@oceanview.com | admin123 | - |
| Platform Admin | platform@staysuite.com | admin123 | (All tenants) |

### 2.5 Usage Tracking

1. Navigate to **Admin → Usage Tracking**
2. View metrics per tenant:
   - API calls, Storage used
   - Active users, Booking count
   - WiFi sessions

---

## 3. User & Role Management

### 3.1 Role Configuration

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

### 3.2 Creating Custom Roles

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

### 3.3 User Provisioning

1. Navigate to **Admin → User Management**
2. Click **Add User**
3. Configure: Email, Name, Role, Properties, 2FA requirement
4. Send invitation

### 3.4 SSO Configuration

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

## 4. Security Configuration

### 4.1 Password Policy

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

### 4.2 Two-Factor Authentication

1. Navigate to **Security Center → Two-Factor Auth**
2. Configure:
   - Require 2FA for all users or admins only
   - Allowed methods (TOTP, SMS, Email)
3. Users set up 2FA via Profile → Security

### 4.3 Session Management

1. Navigate to **Security Center → Device Sessions**
2. Configure:
   - Session timeout (default: 30 min idle)
   - Concurrent sessions limit
   - Force logout on password change

### 4.4 Account Lockout

- 5 failed login attempts → 30 minute lockout
- Configurable via Security Settings

### 4.5 Audit Logs

1. Navigate to **Security Center → Audit Logs**
2. View all system activity:
   - User actions, Data changes
   - Login attempts, API calls
3. Filter by: User, Module, Action type, Date range
4. Export logs

---

## 5. Integration Setup

### 5.1 API Access

1. Navigate to **Settings → System Integrations → API**
2. Generate API keys: Key name, Expiration date, Scopes
3. Copy and store securely (shown only once)

### 5.2 Webhooks

1. Navigate to **Webhooks** module
2. Add webhook endpoint: URL, Secret, Events
3. Monitor delivery in **Delivery Logs**
4. Retry failed deliveries from **Retry Queue**

### 5.3 Third-Party API Connections

1. Navigate to **Integrations → Third-Party APIs**
2. Configure external services: API endpoint, Authentication, Rate limits

---

## 6. WiFi Gateway Configuration

### 6.1 FreeRADIUS Architecture

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

### 6.2 Adding a WiFi Gateway

1. Navigate to **WiFi → RADIUS & Gateway**
2. Add RADIUS client:
   - Gateway IP (NAS IP)
   - Shared Secret
   - Auth Port (1812), Acct Port (1813)
   - Vendor type
3. Configure NAS settings
4. Test connection
5. Save configuration

### 6.3 Captive Portal

The captive portal redirect service runs on port 8888:
- Redirects guests to StaySuite portal on port 3000
- Configurable whitelist for portal-exempt URLs
- Template-based portal pages

### 6.4 Bandwidth Plans

6 pre-configured WiFi plans:

| Plan | Download | Upload | Data Cap |
|------|----------|--------|----------|
| Free | 2 Mbps | 1 Mbps | 500 MB/day |
| Basic | 5 Mbps | 2 Mbps | 1 GB/day |
| Standard | 10 Mbps | 5 Mbps | 3 GB/day |
| Premium | 25 Mbps | 10 Mbps | 10 GB/day |
| Business | 50 Mbps | 25 Mbps | Unlimited |
| Enterprise | 100 Mbps | 50 Mbps | Unlimited |

### 6.5 Advanced Network Features

- **DHCP Server**: Subnet management, reservations, hostname filters
- **DNS Server**: DNS records, redirect rules, zones
- **Firewall**: Zone-based firewall, bandwidth pools, rate limiting
- **Content Filter**: Web category blocking with scheduling
- **VLAN Management**: Per-room and per-floor VLAN configuration
- **Multi-WAN**: Failover and load balancing configuration

---

## 7. Channel Manager Setup

### 7.1 Connecting Booking.com

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection → Booking.com**
3. Enter credentials: Hotel ID, API Key, API Secret
4. Test connection
5. Enable connection

### 7.2 Channel Mapping

1. Navigate to **Channel Manager → Mapping**
2. Map room types: Internal room type ↔ OTA room type
3. Map rate plans: Internal rate plan ↔ OTA rate plan
4. Verify mappings
5. Enable sync

### 7.3 Sync Configuration

| Setting | Value |
|---------|-------|
| Sync Mode | Real-time / Scheduled |
| Sync Interval | 5 minutes (if scheduled) |
| Retry Attempts | 5 |
| Retry Delay | Exponential backoff |
| Conflict Resolution | Prefer OTA / Prefer PMS |

---

## 8. Payment Gateway Setup

### 8.1 Stripe Integration

1. Navigate to **Integrations → Payment Gateways → Stripe**
2. Configure: Publishable Key, Secret Key, Webhook Secret
3. Set webhook URL in Stripe dashboard
4. Test payment
5. Enable

### 8.2 Razorpay Integration (India)

1. Click **Add Gateway → Razorpay**
2. Configure: Key ID, Key Secret, Webhook Secret
3. Enable payment methods: Cards, UPI, NetBanking, Wallets
4. Test and enable

### 8.3 Multi-Gateway Routing

1. Navigate to **Integrations → Payment Gateways → Routing**
2. Configure: Primary gateway, Fallback gateway, Routing by currency/amount
3. Enable routing

---

## 9. Cron Job Management

### 9.1 Overview

StaySuite v2.1 includes **11 automated cron jobs** managed via the Cron mini-service (`staysuite-cron` on port 3005). These jobs handle recurring operational tasks such as night audit processing, OTA synchronization, billing generation, and system cleanup.

### 9.2 Cron Job List

| # | Job Name | Schedule | Description |
|---|----------|----------|-------------|
| 1 | Night Audit Runner | Daily at configured audit time | Triggers the full night audit sequence (see [Section 10](#10-night-audit-configuration)) |
| 2 | OTA Rate Sync | Every 5 minutes | Synchronizes rates and availability with connected OTAs |
| 3 | Scheduled Charges Generator | Daily at 00:00 | Creates recurring charges for in-house guests (see [Section 12](#12-scheduled-charges-setup)) |
| 4 | Posting Rules Processor | Daily at 01:00 | Applies auto-posting rules to guest folios (see [Section 11](#11-posting-rules-configuration)) |
| 5 | Reservation Reminder | Daily at 09:00 | Sends check-in/reminders to guests with upcoming reservations |
| 6 | No-Show Marker | Daily at 12:00 | Automatically marks unarrived past-due reservations as no-shows |
| 7 | Webhook Retry Queue | Every 15 minutes | Retries failed webhook deliveries |
| 8 | Session Cleanup | Daily at 03:00 | Purges expired sessions and stale data |
| 9 | Report Cache Refresh | Hourly | Refreshes cached dashboard metrics and report data |
| 10 | Commission Calculator | Daily at 02:00 | Calculates travel agent commissions on settled invoices (see [Section 14](#14-commission-rules-setup)) |
| 11 | Backup Coordinator | Daily at 04:00 | Coordinates automated database backups (see [Section 16](#16-backup--recovery)) |

### 9.3 Configuring Cron Jobs

1. Navigate to **Admin → Cron Job Management**
2. Select the cron job from the list
3. Configure:

| Setting | Description |
|---------|-------------|
| **Enabled** | Toggle the job on/off |
| **Schedule** | Cron expression (e.g., `0 2 * * *` for 2:00 AM daily) |
| **Timeout** | Maximum execution time before force-termination (default: 300s) |
| **Retry on Failure** | Number of retries if the job fails (default: 3) |
| **Alert on Failure** | Send notification to admins on failure |

4. Click **Save**

### 9.4 Monitoring Cron Jobs

1. Navigate to **Admin → Cron Job Management → Execution History**
2. View details for each run:
   - Start time, End time, Duration
   - Status (Success / Failed / Running)
   - Output / Error logs
3. Filter by job name, date range, or status
4. Manually trigger a job by clicking **Run Now**

### 9.5 Cron Job Logs

```bash
pm2 logs staysuite-cron          # View cron service logs
pm2 logs staysuite-cron --lines 100  # Last 100 lines
```

---

## 10. Night Audit Configuration

### 10.1 Overview

The Night Audit is a critical end-of-day hotel operations process that closes the business day, posts charges, generates reports, and prepares the system for the next day. StaySuite automates this via the Night Audit Runner cron job.

### 10.2 Setting Up Night Audit

1. Navigate to **Admin → Night Audit Configuration**

### 10.3 Audit Schedule

| Setting | Description |
|---------|-------------|
| **Audit Time** | Time of day to trigger night audit (default: 23:59) |
| **Business Day End** | Cutoff time for the current business day (default: 23:00) |
| **Auto-Run** | Enable/disable automatic execution via cron |
| **Require Confirmation** | If enabled, a night auditor must confirm before execution |

### 10.4 Night Audit Steps

The night audit process runs the following steps in sequence. Each step can be enabled/disabled individually:

| Step | Name | Description | Default |
|------|------|-------------|---------|
| 1 | **Close Business Day** | Locks all postings to the current business day | Enabled |
| 2 | **Apply Posting Rules** | Runs auto-posting rules (room charges, taxes, packages) | Enabled |
| 3 | **Process Scheduled Charges** | Generates recurring charges for in-house guests | Enabled |
| 4 | **Post Room Charges** | Posts nightly room rate to each occupied room's folio | Enabled |
| 5 | **Apply Tax Rules** | Calculates and posts applicable taxes | Enabled |
| 6 | **Update Room Status** | Updates room status based on departure dates | Enabled |
| 7 | **Generate No-Shows** | Marks unarrived reservations past arrival date | Enabled |
| 8 | **Auto-Check-Out** | Checks out guests whose departure date has passed | Disabled |
| 9 | **Calculate Commissions** | Processes travel agent commissions | Enabled |
| 10 | **Generate Reports** | Produces end-of-day reports (occupancy, revenue, arrivals/departures) | Enabled |
| 11 | **Roll Date** | Advances the system date to the next business day | Enabled |

### 10.5 Running Night Audit Manually

1. Navigate to **Billing → Night Audit**
2. Review the pre-audit checklist (incomplete folios, pending charges, etc.)
3. Click **Run Night Audit** or confirm the auto-audit prompt
4. Monitor progress on the Night Audit dashboard
5. Review post-audit summary and generated reports

### 10.6 Night Audit History

1. Navigate to **Admin → Night Audit Configuration → History**
2. View past audit runs with timestamps, duration, step results, and any errors

---

## 11. Posting Rules Configuration

### 11.1 Overview

Posting Rules define automated charge entries that are applied to guest folios on a scheduled or event-driven basis. Common examples include daily room charges, continental breakfast add-ons, and resort fee postings.

### 11.2 Creating a Posting Rule

1. Navigate to **Billing → Posting Rules**
2. Click **Add Posting Rule**
3. Configure the rule:

| Field | Description |
|-------|-------------|
| **Rule Name** | Descriptive name (e.g., "Daily Room Charge") |
| **Revenue Account** | Target revenue account for postings (see [Section 13](#13-revenue-accounts-setup)) |
| **Trigger** | When to apply: Night Audit, Check-In, Check-Out, Scheduled |
| **Frequency** | Daily, Weekly, Monthly, Once, Custom |
| **Amount Type** | Fixed amount, Percentage of room rate, Per-person, Per-room |
| **Amount** | The charge amount (or percentage) |
| **Tax Group** | Applicable tax group |
| **Apply To** | All room types, specific room types, or specific rate plans |
| **Condition** | Optional conditions (e.g., only for adults, only for stays ≥ 3 nights) |
| **Priority** | Execution order when multiple rules apply (lower = first) |
| **Enabled** | Toggle rule on/off |

4. Click **Save**

### 11.3 Common Posting Rule Examples

| Rule | Trigger | Frequency | Amount Type |
|------|---------|-----------|-------------|
| Room Charge | Night Audit | Daily | Per-room (room rate) |
| Continental Breakfast | Night Audit | Daily | Per-person (₹500) |
| Resort Fee | Check-In | Once | Per-room (₹200) |
| Extra Bed Charge | Night Audit | Daily | Per-unit (₹1000) |
| Tourism Levy | Night Audit | Daily | Percentage (2% of room rate) |

### 11.4 Managing Posting Rules

- **Edit**: Click on a rule to modify its configuration
- **Duplicate**: Clone an existing rule with a new name for quick setup
- **Reorder**: Drag and drop rules to change execution priority
- **Enable/Disable**: Toggle individual rules without deleting them
- **Test Run**: Preview what charges would be generated for current in-house guests without actually posting

### 11.5 Posting Rule Execution Logs

1. Navigate to **Billing → Posting Rules → Execution Logs**
2. View each execution: date, rules applied, total postings created, errors

---

## 12. Scheduled Charges Setup

### 12.1 Overview

Scheduled Charges allow administrators to define recurring charges that are automatically generated for in-house guests on a regular cadence (daily, weekly, monthly). These are distinct from Posting Rules in that they are attached to a reservation or guest profile and represent ongoing service charges.

### 12.2 Creating a Scheduled Charge Template

1. Navigate to **Billing → Scheduled Charges**
2. Click **Add Charge Template**
3. Configure:

| Field | Description |
|-------|-------------|
| **Template Name** | Name for the recurring charge (e.g., "Weekly Laundry Package") |
| **Charge Code** | Unique short code (e.g., `LAUNDRY-WK`) |
| **Description** | Appears on guest folios |
| **Revenue Account** | Target revenue account |
| **Amount** | Charge amount per occurrence |
| **Tax Group** | Applicable tax group |
| **Frequency** | Daily, Weekly, Monthly |
| **Billing Day** | For weekly/monthly: which day to charge |
| **Apply To** | All guests, specific room types, or opt-in only |

4. Click **Save**

### 12.3 Assigning Scheduled Charges

Scheduled charges can be assigned in two ways:

**Automatic Assignment:**
- Set "Apply To" in the template to automatically include eligible guests

**Manual Assignment:**
1. Open a reservation or guest folio
2. Navigate to **Charges → Scheduled Charges**
3. Click **Add Scheduled Charge**
4. Select from available templates
5. Set start date and optional end date
6. Click **Assign**

### 12.4 Managing Scheduled Charges

1. Navigate to **Billing → Scheduled Charges → Active Charges**
2. View all currently active recurring charges across guests
3. Actions per charge:
   - **Pause**: Temporarily stop charge generation
   - **Resume**: Restart a paused charge
   - **Terminate**: End the scheduled charge permanently
   - **Adjust Amount**: Temporarily or permanently change the charge amount

### 12.5 Scheduled Charges Report

1. Navigate to **Reports → Scheduled Charges**
2. Filter by: Date range, Template, Revenue account, Status
3. View generated charges, upcoming charges, and revenue impact

---

## 13. Revenue Accounts Setup

### 13.1 Overview

Revenue Accounts define the Chart of Accounts used to categorize all financial transactions in StaySuite. Proper configuration ensures accurate reporting, tax compliance, and financial analysis.

### 13.2 Revenue Account Structure

Accounts are organized in a hierarchical structure:

```
Revenue (Root)
├── Room Revenue
│   ├── Standard Room
│   ├── Deluxe Room
│   ├── Suite
│   └── Extra Bed
├── Food & Beverage
│   ├── Restaurant
│   ├── Room Service
│   ├── Minibar
│   └── Banquet
├── Other Revenue
│   ├── Laundry
│   ├── Spa
│   ├── Parking
│   ├── WiFi
│   └── Miscellaneous
└── Adjustments
    ├── Discounts
    ├── Complimentary
    └── Corrections
```

### 13.3 Creating a Revenue Account

1. Navigate to **Billing → Revenue Accounts**
2. Click **Add Account**
3. Configure:

| Field | Description |
|-------|-------------|
| **Account Code** | Unique account code (e.g., `ROOM-STD`, `FNB-RS`) |
| **Account Name** | Display name |
| **Parent Account** | Parent category for hierarchy (optional) |
| **Account Type** | Revenue, Expense, Tax, Discount, Liability |
| **Description** | Purpose of the account |
| **Tax Applicable** | Whether charges to this account attract tax |
| **Default Tax Group** | Pre-selected tax group for this account |
| **Active** | Toggle account visibility and usability |

4. Click **Save**

### 13.4 Managing Revenue Accounts

- **Edit**: Modify account name, type, or tax settings
- **Merge**: Move all transactions from one account to another (requires date range confirmation)
- **Archive**: Deactivate an account without deleting historical transactions
- **Reorder**: Adjust the display order in reports and dropdowns

### 13.5 Revenue Account Reports

1. Navigate to **Reports → Revenue → Revenue by Account**
2. Breakdown of revenue by account code for any date range
3. Export to CSV/PDF for accounting integration

### 13.6 Integrating with External Accounting

Revenue account codes can be mapped to external accounting system codes:

1. Navigate to **Settings → Accounting Integration**
2. Map each StaySuite revenue account to the corresponding external ledger code
3. Export transactions in the format required by your accounting software

---

## 14. Commission Rules Setup

### 14.1 Overview

Commission Rules define how travel agent commissions are calculated on bookings. When a reservation is made through a travel agent, StaySuite automatically calculates the commission based on the configured rules.

### 14.2 Creating a Commission Rule

1. Navigate to **Billing → Commission Rules**
2. Click **Add Commission Rule**
3. Configure:

| Field | Description |
|-------|-------------|
| **Rule Name** | Descriptive name (e.g., "Standard Agent Commission") |
| **Commission Type** | Percentage of total, Percentage of room revenue, Fixed amount per night |
| **Rate** | Commission rate (e.g., 10% or ₹500/night) |
| **Minimum Commission** | Floor amount (e.g., ₹200 minimum) |
| **Maximum Commission** | Cap amount (optional, e.g., ₹5000 maximum) |
| **Applicable Agents** | All agents, specific agents, or agent groups |
| **Applicable Rate Plans** | All rate plans or specific rate plans |
| **Calculation Basis** | Gross amount or net of taxes |
| **Payment Terms** | Net 15, Net 30, Net 45 |
| **Enabled** | Toggle rule on/off |

4. Click **Save**

### 14.3 Travel Agent Management

1. Navigate to **Billing → Travel Agents**
2. Click **Add Travel Agent**
3. Configure:

| Field | Description |
|-------|-------------|
| **Agent Name** | Travel agency or agent name |
| **Agent Code** | Unique code (e.g., `EXPEDIA`, `MAKEMYTRIP`) |
| **Contact Person** | Primary contact |
| **Email** | Contact email |
| **Phone** | Contact phone |
| **Address** | Billing address |
| **PAN/GST** | Tax registration number |
| **Default Commission Rule** | Pre-selected rule for this agent |
| **Credit Limit** | Maximum outstanding commission payable |
| **Status** | Active / Inactive |

4. Click **Save**

### 14.4 Assigning Agents to Reservations

1. Open a reservation
2. Navigate to **Billing → Commission**
3. Select the travel agent from the dropdown
4. The applicable commission rule is automatically applied
5. Commission is calculated and displayed on the folio

### 14.5 Commission Settlement

1. Navigate to **Billing → Commission → Settlement**
2. View outstanding commission balances per agent
3. Actions:
   - **Generate Statement**: Create a commission statement for a date range
   - **Mark as Paid**: Record commission payment with reference number
   - **Adjust**: Apply manual adjustments with reason notes
4. Print or export settlement reports

### 14.6 Commission Reports

1. Navigate to **Reports → Commission**
2. Filter by: Agent, Date range, Status, Amount range
3. View: Total commission payable, Paid, Outstanding, Overdue

---

## 15. Mini-Services Management

### 15.1 Overview

StaySuite v2.1 operates **11 mini-services** managed via PM2. Each service handles a specific domain of functionality and can be independently started, stopped, restarted, and monitored.

> **Important**: PostgreSQL is **NOT** managed by PM2. It must be started manually via `pg_ctl`. See [Section 17.3](#173-postgresql-management) for details.

### 15.2 Complete PM2 Services List

| # | Service Name | Port | Description |
|---|-------------|------|-------------|
| 1 | `staysuite-nextjs` | 3000 | Main Next.js application (web UI & API) |
| 2 | `staysuite-freeradius` | 1812/1813 | FreeRADIUS server for WiFi authentication (auth/acct) |
| 3 | `staysuite-captive-redirect` | 8888 | Captive portal redirect service |
| 4 | `staysuite-realtime` | 3003 | WebSocket server for real-time notifications |
| 5 | `staysuite-cron` | 3005 | Cron job scheduler for all 11 automated tasks |
| 6 | `staysuite-ota-sync` | 3006 | Channel manager / OTA synchronization service |
| 7 | `staysuite-notifications` | 3007 | Email, SMS, and push notification service |
| 8 | `staysuite-billing` | 3008 | Background billing engine (posting rules, scheduled charges) |
| 9 | `staysuite-webhook` | 3009 | Webhook delivery and retry queue processor |
| 10 | `staysuite-reports` | 3010 | Background report generation service |
| 11 | `staysuite-media` | 3011 | Media processing and image optimization service |

### 15.3 Managing Services via PM2

```bash
# View status of all 11 services
pm2 status

# View logs for a specific service
pm2 logs staysuite-cron
pm2 logs staysuite-billing --lines 50

# Restart a single service
pm2 restart staysuite-cron

# Restart all services
pm2 restart all

# Stop a single service
pm2 stop staysuite-notifications

# Stop all services
pm2 stop all

# Start all services
pm2 start all

# Monitor CPU/Memory usage in real-time
pm2 monit
```

### 15.4 Service Health Monitoring

1. Navigate to **Admin → System Health**
2. View real-time status of all 11 mini-services:
   - **Status**: Online / Offline / Restarting
   - **Uptime**: Current uptime duration
   - **CPU**: Current CPU usage percentage
   - **Memory**: Current memory usage (RSS/Heap)
   - **Restarts**: Count of unexpected restarts
3. Click on a service for detailed metrics and recent log entries

### 15.5 PM2 Ecosystem Configuration

The PM2 ecosystem file (`ecosystem.config.js`) defines all 11 services:

```javascript
module.exports = {
  apps: [
    { name: 'staysuite-nextjs',           script: 'app.js', port: 3000 },
    { name: 'staysuite-freeradius',       script: 'freeradius.js', port: 1812 },
    { name: 'staysuite-captive-redirect', script: 'captive.js', port: 8888 },
    { name: 'staysuite-realtime',         script: 'realtime.js', port: 3003 },
    { name: 'staysuite-cron',             script: 'cron.js', port: 3005 },
    { name: 'staysuite-ota-sync',         script: 'ota-sync.js', port: 3006 },
    { name: 'staysuite-notifications',    script: 'notifications.js', port: 3007 },
    { name: 'staysuite-billing',          script: 'billing.js', port: 3008 },
    { name: 'staysuite-webhook',          script: 'webhook.js', port: 3009 },
    { name: 'staysuite-reports',          script: 'reports.js', port: 3010 },
    { name: 'staysuite-media',            script: 'media.js', port: 3011 },
  ]
};
```

### 15.6 Auto-Restart Configuration

PM2 is configured to automatically restart services on failure:

| Setting | Value |
|---------|-------|
| Watch | Enabled for development |
| Max Memory Restart | 512 MB per service |
| Restart Delay | 4000 ms |
| Max Restarts | 10 per hour |
| Restart Delay Exponential | Enabled |

### 15.7 Service Startup on Boot

To ensure all 11 services start on system boot:

```bash
pm2 startup              # Generate startup script
pm2 save                 # Save current process list
```

---

## 16. Backup & Recovery

### 16.1 Automated Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Transaction Logs (WAL) | Continuous | 24 hours |

### 16.2 Manual Backup

```bash
pg_dump staysuite > /backups/staysuite_$(date +%Y%m%d).sql
gzip /backups/staysuite_$(date +%Y%m%d).sql
```

### 16.3 Data Export (GDPR)

1. Navigate to **Settings → GDPR → Export Data**
2. Select tenant and data scope
3. Generate and download archive

### 16.4 Recovery

```bash
psql -U postgres -d staysuite < /backups/staysuite_YYYYMMDD.sql
```

---

## 17. System Monitoring

### 17.1 Health Dashboard

1. Navigate to **Admin → System Health**
2. View metrics:
   - API Response Time
   - Database Connections
   - FreeRADIUS Status
   - Realtime Service Status
   - Memory Usage
   - CPU Usage
   - All 11 mini-service statuses

### 17.2 PM2 Process Management

The platform runs 11 services managed via PM2 (see [Section 15.2](#152-complete-pm2-services-list) for the full list with ports).

```bash
pm2 status                       # Check all 11 services
pm2 logs staysuite-nextjs        # View main app logs
pm2 logs staysuite-cron          # View cron job logs
pm2 restart all                  # Restart all services
pm2 monit                        # Real-time monitoring dashboard
```

### 17.3 PostgreSQL Management

> **⚠️ Important**: PostgreSQL is **NOT** managed by PM2. It must be started and stopped manually using `pg_ctl`.

**Starting PostgreSQL:**

```bash
pg_ctl -D /usr/local/pgsql/data start
```

**Stopping PostgreSQL:**

```bash
pg_ctl -D /usr/local/pgsql/data stop
```

**Checking PostgreSQL Status:**

```bash
pg_ctl -D /usr/local/pgsql/data status
```

**Restarting PostgreSQL:**

```bash
pg_ctl -D /usr/local/pgsql/data restart
```

**Connecting to PostgreSQL:**

```bash
psql -U postgres -d staysuite
```

### 17.4 Health Check Endpoint

```http
GET /api/health
```

Response includes status of all 11 mini-services and PostgreSQL connectivity.

---

## 18. Troubleshooting

### 18.1 Common Issues

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

**Cron Job Failures:**

| Issue | Solution |
|-------|----------|
| Night audit didn't run | Check `staysuite-cron` service status and logs |
| Scheduled charges missing | Verify charge templates are enabled and assigned |
| Posting rules not applied | Check rule configuration and execution logs |
| OTA sync not running | Verify `staysuite-ota-sync` service and API credentials |

**Mini-Service Issues:**

| Issue | Solution |
|-------|----------|
| Service shows "errored" | Check `pm2 logs <service-name>` for error details |
| Service high memory | Check `pm2 monit`, may need max_memory_restart adjustment |
| Service not starting | Verify port availability, check for port conflicts |
| All services down | Run `pm2 start all`, check PostgreSQL is running via `pg_ctl` |

### 18.2 Diagnostic Tools

1. **Gateway Diagnostics**: WiFi → Gateway Diagnostics → Speed test
2. **Webhook Test**: Send test webhook from Webhooks module
3. **RADIUS Test**: Check NAS health and reload logs
4. **Connection Test**: Test gateway connections
5. **Cron Job Test**: Run any cron job manually from Admin → Cron Job Management → Run Now
6. **Service Health**: `pm2 status` and `pm2 monit` for real-time service diagnostics

### 18.3 Support Escalation

| Priority | Response | Contact |
|----------|----------|---------|
| P1 - Critical | 15 min | support@cryptsk.com |
| P2 - High | 1 hour | support@cryptsk.com |
| P3 - Medium | 4 hours | support@cryptsk.com |
| P4 - Low | 24 hours | support@cryptsk.com |

---

*© 2026 Cryptsk Pvt Ltd*

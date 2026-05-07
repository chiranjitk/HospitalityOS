# Platform Admin Setup Guide

This guide explains how to set up and manage platform administrators in StaySuite.

**Last Updated**: May 2026 | **Version**: v2.1

### Platform Scale (v2.1)

| Metric | Count |
|--------|-------|
| API Routes | 617 |
| Database Models | 294 |
| React Components | 532 |
| Mini-Services | 11 |
| Cron Jobs | 11 |

---

## Overview

Platform administrators have special privileges that allow them to:
- Access Tenant Management (create, edit, delete tenants)
- View all tenants across the platform
- Manage tenant subscriptions and limits
- Access system-wide analytics
- Manage FreeRADIUS and system health
- **Manage city ledger accounts** (v2.1)
- **Configure commission rules** (v2.1)
- **Set up revenue accounts** (v2.1)
- **Configure posting rules** (v2.1)
- **Manage scheduled charges** (v2.1)
- **Configure night audit settings** (v2.1)

## Requirements

A user must have `isPlatformAdmin: true` in the database to access platform-level features.

---

## Setup Methods

### Method 1: Using the ensure-platform-admin API (Recommended)

This is the easiest way to create or fix platform admin users.

#### Step 1: Check if user exists and has platform admin access

```bash
curl -X GET "https://your-domain.com/api/admin/ensure-platform-admin?email=admin@royalstay.in"
```

#### Step 2: Create or update platform admin

```bash
curl -X POST "https://your-domain.com/api/admin/ensure-platform-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "setup-platform-admin-2024",
    "email": "admin@royalstay.in",
    "password": "admin123"
  }'
```

#### Step 3: Logout and Login Again

After creating/updating the platform admin:
1. Logout from the application
2. Login again with the credentials
3. The session will now include `isPlatformAdmin: true`

### Method 2: Direct Database Update (PostgreSQL)

If you have direct database access:

```sql
-- Update existing user to be platform admin
UPDATE "User" SET "isPlatformAdmin" = true WHERE email = 'admin@royalstay.in';

-- Verify the update
SELECT id, email, "firstName", "lastName", "isPlatformAdmin" 
FROM "User" WHERE email = 'admin@royalstay.in';
```

### Method 3: Using Seed Data (Development Only)

For development environments, run the seed script:

```bash
bun run db:seed
```

This creates platform admin and tenant admin users:

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | admin@royalstay.in | admin123 |
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |

**Warning:** Running seed will clear and re-seed all data. Do not use in production.

---

## Platform Admin Features (v2.1)

### 1. Managing City Ledger Accounts

City Ledger (also known as House Ledger or Accounts Receivable) tracks charges for non-guest accounts — travel agents, corporate clients, and walk-in charges.

#### Access
Navigate to **Platform Admin → Finance → City Ledger**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Create Ledger Account | Add new city ledger accounts for travel agents, corporate clients, or other entities |
| Set Credit Limit | Define maximum credit allowed per ledger account |
| Post Charges | Post room charges, F&B charges, and service charges to ledger accounts |
| Record Payments | Record payments received against ledger balances |
| Generate Statements | Generate monthly/periodic account statements |
| Aging Report | View outstanding balances by aging bucket (30/60/90/120+ days) |
| Write-offs | Write off uncollectible amounts with approval trail |

#### Configuration

```bash
# API endpoints for city ledger
POST   /api/admin/city-ledger/accounts          # Create account
GET    /api/admin/city-ledger/accounts          # List all accounts
GET    /api/admin/city-ledger/accounts/:id      # Get account details
PUT    /api/admin/city-ledger/accounts/:id      # Update account
POST   /api/admin/city-ledger/accounts/:id/postings      # Post charge/payment
GET    /api/admin/city-ledger/accounts/:id/statement     # Generate statement
GET    /api/admin/city-ledger/aging-report      # Aging report across all accounts
```

#### Important Notes
- City ledger accounts are linked to tenants but accessible across properties within a tenant
- Each posting requires a revenue code and posting rule
- Credit limit enforcement is checked during posting

---

### 2. Configuring Commission Rules

Commission rules define how agents, OTAs, and referral partners earn commissions on bookings.

#### Access
Navigate to **Platform Admin → Finance → Commission Rules**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Create Commission Rule | Define commission structure (percentage, flat, or tiered) |
| Assign to Agent | Link commission rules to specific travel agents or OTA channels |
| Configure Tiers | Set up tiered commissions (e.g., 10% for first 50 rooms, 15% beyond) |
| Settlement Schedule | Define when commissions are settled (per-booking, weekly, monthly) |
| Override per Booking | Allow manual commission override on individual bookings |

#### Rule Types

```
Percentage-based:  10% of room revenue
Flat-fee:          ₹500 per booking
Tiered:            10% up to ₹50,000, 12% up to ₹1,00,000, 15% above
Hybrid:            ₹200 flat + 8% of revenue
```

#### API Endpoints

```bash
POST   /api/admin/commission/rules              # Create rule
GET    /api/admin/commission/rules              # List all rules
PUT    /api/admin/commission/rules/:id          # Update rule
DELETE /api/admin/commission/rules/:id          # Delete rule
POST   /api/admin/commission/settle             # Trigger manual settlement
GET    /api/admin/commission/history            # Settlement history
```

---

### 3. Setting Up Revenue Accounts

Revenue accounts (revenue codes) define the chart of accounts used for posting charges to folios and city ledgers.

#### Access
Navigate to **Platform Admin → Finance → Revenue Accounts**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Create Revenue Account | Define revenue codes for room, F&B, laundry, spa, etc. |
| Organize by Category | Group revenue accounts into categories (Room Revenue, F&B Revenue, etc.) |
| Set Tax Treatment | Define which taxes apply to each revenue account |
| Map to Posting Rules | Link revenue accounts to automatic posting rules |
| Configure GL Mapping | Map revenue codes to general ledger account codes |

#### Default Revenue Accounts (Created on Seed)

| Code | Name | Category |
|------|------|----------|
| ROOM | Room Revenue | Room Revenue |
| FNBRK | F&B Revenue | Food & Beverage |
| LAUND | Laundry Revenue | Other Revenue |
| SPA | Spa Revenue | Other Revenue |
| PHCL | Telephone Charges | Other Revenue |
| MINBR | Mini Bar Revenue | Room Revenue |
| EXCHR | Extra Charges | Other Revenue |
| TXGST | GST Tax | Taxes |
| TXSGST | SGST Tax | Taxes |
| TXCGST | CGST Tax | Taxes |

#### API Endpoints

```bash
POST   /api/admin/revenue/accounts             # Create revenue account
GET    /api/admin/revenue/accounts             # List all accounts
PUT    /api/admin/revenue/accounts/:id         # Update account
DELETE /api/admin/revenue/accounts/:id         # Archive account
POST   /api/admin/revenue/accounts/bulk-import # Bulk import revenue codes
```

---

### 4. Configuring Posting Rules

Posting rules automate the posting of charges to guest folios at specific events (check-in, daily, check-out, etc.).

#### Access
Navigate to **Platform Admin → Finance → Posting Rules**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Create Posting Rule | Define when and what charges to auto-post |
| Set Trigger Events | Choose trigger: check-in, check-out, midnight, housekeeping complete, etc. |
| Define Charge Calculation | Fixed amount, percentage, or quantity-based |
| Set Target Folio | Post to guest folio, city ledger, or both |
| Enable/Disable | Toggle rules on/off without deleting |

#### Rule Triggers

| Trigger | Typical Use |
|---------|-------------|
| `CHECK_IN` | Welcome amenities, tourism levy, deposit deduction |
| `DAILY_MIDNIGHT` | Room rate, daily taxes, insurance |
| `CHECK_OUT` | Late checkout charges, damage deposits |
| `HOUSEKEEPING_DONE` | Extra cleaning charges |
| `FOLIO_TRANSFER` | Inter-folio transfer fees |
| `CUSTOM` | Custom scheduled triggers |

#### API Endpoints

```bash
POST   /api/admin/posting-rules               # Create posting rule
GET    /api/admin/posting-rules               # List all rules
PUT    /api/admin/posting-rules/:id           # Update rule
DELETE /api/admin/posting-rules/:id           # Delete rule
POST   /api/admin/posting-rules/:id/execute   # Manually trigger a rule
```

---

### 5. Managing Scheduled Charges

Scheduled charges are recurring or one-time future charges that are automatically posted to guest folios or city ledgers.

#### Access
Navigate to **Platform Admin → Finance → Scheduled Charges**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Create Schedule | Define recurring charge (daily, weekly, monthly, custom) |
| Assign to Guest | Link scheduled charge to a specific guest folio |
| Assign to Ledger | Link scheduled charge to a city ledger account |
| Set Start/End Dates | Define when the schedule is active |
| View Schedule Status | See upcoming charges, last posted, next posting date |
| Cancel Schedule | Cancel future scheduled charges |

#### Schedule Types

```
Daily:       Post every day (e.g., parking charge ₹200/day)
Weekly:      Post every week (e.g., weekly service ₹1,500)
Monthly:     Post every month (e.g., monthly retainer ₹5,000)
One-time:    Post once on a specific date (e.g., event venue ₹10,000 on Mar 15)
Custom:      Cron expression for complex schedules
```

#### API Endpoints

```bash
POST   /api/admin/scheduled-charges           # Create scheduled charge
GET    /api/admin/scheduled-charges           # List all scheduled charges
GET    /api/admin/scheduled-charges/:id       # Get charge details
PUT    /api/admin/scheduled-charges/:id       # Update charge
DELETE /api/admin/scheduled-charges/:id       # Cancel charge
GET    /api/admin/scheduled-charges/upcoming  # View upcoming charges
POST   /api/admin/scheduled-charges/process   # Process due charges now
```

---

### 6. Night Audit Configuration

Night Audit is the daily end-of-day process that closes the business day, posts charges, and generates the night audit report. It is the most critical automated process in any PMS.

#### Access
Navigate to **Platform Admin → Operations → Night Audit**

#### Key Operations

| Operation | Description |
|-----------|-------------|
| Configure Audit Time | Set the time night audit runs (default: 00:00 / midnight) |
| Configure Auto-Post | Set which posting rules execute during night audit |
| Configure Revenue Cut-off | Set revenue posting cut-off time |
| Configure Room Rate Rollover | Auto-extend stay or mark no-show for expected check-outs |
| Run Night Audit Manually | Trigger night audit outside of scheduled time |
| View Audit History | Browse past night audit reports |
| Night Audit Checklist | Configure verification items before audit closure |

#### Night Audit Process Flow

```
1. PRE-AUDIT CHECK
   ├── Verify all folios are balanced
   ├── Check for unposted charges
   └── Verify room discrepancies

2. PROCESSING
   ├── Post daily room charges (posting rules)
   ├── Post scheduled charges
   ├── Process scheduled charges due
   ├── Calculate agent commissions
   ├── Generate revenue snapshot
   ├── Mark no-shows / auto-extend stays
   ├── Update room rates for next day
   └── Archive current day data

3. POST-AUDIT
   ├── Generate Night Audit Report
   ├── Update dashboard analytics
   ├── Send notifications to management
   └── Record audit completion timestamp
```

#### Configuration in .env

```env
# Night Audit Configuration
NIGHT_AUDIT_TIME=00:00
NIGHT_AUDIT_AUTO_POST=true
NIGHT_AUDIT_ROOM_ROLLOVER=true
NIGHT_AUDIT_NOSHOW_MARKING=true
NIGHT_AUDIT_REQUIRES_APPROVAL=false
NIGHT_AUDIT_NOTIFICATION_EMAILS=gm@royalstay.in,accounts@royalstay.in
```

#### API Endpoints

```bash
POST   /api/admin/night-audit/run             # Run night audit now
GET    /api/admin/night-audit/status           # Get current audit status
GET    /api/admin/night-audit/history          # View audit history
GET    /api/admin/night-audit/report/:id       # Get specific audit report
PUT    /api/admin/night-audit/config           # Update configuration
GET    /api/admin/night-audit/config           # Get current configuration
GET    /api/admin/night-audit/checklist        # Get pre-audit checklist
POST   /api/admin/night-audit/checklist/verify # Mark checklist item verified
```

> **Critical**: Night Audit must complete successfully before the next day's check-ins are processed. Monitor `pm2 logs staysuite-scheduler | grep night-audit` daily. If night audit fails, resolve issues and re-run manually via the API or Platform Admin UI.

---

## Security Configuration

### Environment Variable

Set the `PLATFORM_ADMIN_SECRET` environment variable in production:

```env
PLATFORM_ADMIN_SECRET=your-very-secure-random-string-here
```

This secret is required to use the ensure-platform-admin API and prevents unauthorized access.

### Production Recommendations

1. **Use strong passwords** — At least 12 characters with mixed case, numbers, and symbols
2. **Change the default secret key** — Use a cryptographically secure random string
3. **Enable Two-Factor Authentication** — After login, enable 2FA in Security Center
4. **Limit platform admins** — Only grant platform admin to trusted users
5. **Monitor audit logs** — Review admin actions in Security Center → Audit Logs
6. **Night audit access** — Restrict night audit configuration to senior management only
7. **Financial controls** — Use approval workflows for city ledger write-offs and commission overrides

---

## Troubleshooting

### Issue: "Platform admin access required" error when accessing Tenant Management

**Cause:** Your user account doesn't have `isPlatformAdmin: true`

**Solution:** Use the ensure-platform-admin API or direct database update to set the flag

### Issue: After updating isPlatformAdmin, still can't access

**Cause:** Your session still has the old user data cached

**Solution:**
1. Clear browser cookies
2. Logout and login again
3. Or use a private/incognito window

### Issue: Menu items not showing after login

**Cause:** Permission context not properly initialized

**Solution:**
1. Refresh the page (F5)
2. Clear browser cache
3. Logout and login again

### Issue: Night audit fails to run

**Cause:** Scheduler service is down or posting rules are misconfigured

**Solution:**
1. Check scheduler status: `pm2 status staysuite-scheduler`
2. Check logs: `pm2 logs staysuite-scheduler --lines 500 | grep night-audit`
3. Verify posting rules are active in Platform Admin → Finance → Posting Rules
4. Run manually via API: `POST /api/admin/night-audit/run`

### Issue: City ledger postings fail

**Cause:** Revenue account or posting rule not configured, or credit limit exceeded

**Solution:**
1. Verify the revenue account exists and is active
2. Check the posting rule for the specific trigger event
3. Verify credit limit on the city ledger account
4. Check logs: `pm2 logs staysuite-revenue-service`

---

## API Reference

### GET /api/admin/ensure-platform-admin

Check if a user exists and has platform admin access.

**Parameters:**
- `email` (query, optional): Email to check. Default: `admin@royalstay.in`

**Response:**
```json
{
  "exists": boolean,
  "user": { ... } | null,
  "canAccessTenantManagement": boolean,
  "hint": string
}
```

### POST /api/admin/ensure-platform-admin

Create or update a platform admin user.

**Request Body:**
```json
{
  "secretKey": string,
  "email": string,
  "password": string
}
```

**Response:**
```json
{
  "success": boolean,
  "message": string,
  "user": {
    "id": string,
    "email": string,
    "firstName": string,
    "lastName": string,
    "isPlatformAdmin": boolean
  }
}
```

---

## Demo Credentials

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Platform Admin | admin@royalstay.in | admin123 | Full platform access (all tenants, all features) |
| Property Admin | admin@royalstay.in | admin123 | Single tenant (Royal Stay Hotels) |
| Front Desk | frontdesk@royalstay.in | admin123 | Property operations only |
| Housekeeping | housekeeping@royalstay.in | admin123 | Housekeeping module only |

> **Note**: The primary admin account `admin@royalstay.in` serves as both the Platform Admin and the Property Admin for Royal Stay Hotels. After login, the platform admin dashboard is accessible via the tenant switcher or the Platform Admin menu.

---

## Demo Tenants

The seed script creates these tenants:

| Tenant | Admin Email | Properties |
|--------|-----------|------------|
| Royal Stay Hotels | admin@royalstay.in | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | admin@oceanview.com | Ocean View Goa (80 rooms) |

### Royal Stay Hotels (Primary Demo Tenant)

- **Location**: Kolkata, West Bengal
- **Properties**: 2 (Royal Stay Kolkata, Royal Stay Darjeeling)
- **Total Rooms**: 170
- **Admin**: admin@royalstay.in
- **Features Enabled**: Full suite — PMS, POS, Housekeeping, WiFi, OTA, Revenue Management, City Ledger, Night Audit

### Ocean View Resorts (Secondary Demo Tenant)

- **Location**: Goa
- **Properties**: 1 (Ocean View Goa)
- **Total Rooms**: 80
- **Admin**: admin@oceanview.com
- **Features Enabled**: PMS, Housekeeping, WiFi

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)

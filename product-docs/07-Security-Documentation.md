# StaySuite Security Documentation
## Security and Compliance Manual

**Version**: 2.1  
**Last Updated**: May 2026

---

## Table of Contents

1. [Security Architecture](#1-security-architecture)
2. [Authentication](#2-authentication)
3. [Authorization](#3-authorization)
4. [Data Protection](#4-data-protection)
5. [Network Security](#5-network-security)
6. [GDPR Compliance](#6-gdpr-compliance)
7. [Audit Logging](#7-audit-logging)
8. [Cron Jobs Security](#8-cron-jobs-security)
9. [Scheduled Charges Security](#9-scheduled-charges-security)
10. [Night Audit Security](#10-night-audit-security)
11. [City Ledger Security](#11-city-ledger-security)
12. [Incident Response](#12-incident-response)
13. [Security Best Practices](#13-security-best-practices)

---

## 1. Security Architecture

### 1.1 Security Layers

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │    Input    │  │    Auth     │  │   Output    │ │
│  │ Validation  │  │   Checks    │  │ Sanitization│ │
│  │  (Zod v4)  │  │  (bcrypt)  │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│                    Service Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   RBAC/ABAC │  │   Audit     │  │   Rate      │ │
│  │   Controls  │  │   Logging   │  │   Limiting  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│                     Data Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Encryption  │  │    Tenant   │  │   Backup    │ │
│  │ AES-256-GCM │  │  Scoping    │  │   & DR      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.2 Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in Depth** | Multiple security layers |
| **Least Privilege** | RBAC + ABAC |
| **Zero Trust** | Verify every request |
| **Defense by Default** | Secure defaults |
| **Fail Securely** | Deny on failure |

### 1.3 System Scale

| Metric | Count |
|--------|-------|
| **API Routes** | 617 |
| **Database Models** | 294 |
| **Default Roles** | 9 |
| **Permission Modules** | 15+ |

---

## 2. Authentication

### 2.1 Authentication System

StaySuite uses a **custom session-based authentication** system (not standard NextAuth flow):

```
1. POST /api/auth/login with { email, password }
2. Validate credentials via bcrypt
3. Create Session record in PostgreSQL (token = 32-byte random hex)
4. Set session_token as httpOnly cookie
5. Return { user, token }
```

### 2.2 Authentication Methods

| Method | Use Case |
|--------|----------|
| Email/Password | Default (bcrypt hashing) |
| Two-Factor (TOTP) | Enhanced security (otplib) |
| SSO (SAML 2.0) | Enterprise |
| SSO (OIDC) | Enterprise |
| SSO (LDAP) | Corporate |

### 2.3 Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum Length | 8 characters |
| Maximum Length | 128 characters |
| Complexity | Upper + lower + digit + special |
| History | Last N passwords |
| Expiry | Configurable per tenant (default: 90 days) |
| Hashing | bcrypt |

### 2.4 Session Management

| Setting | Default |
|---------|---------|
| Session Timeout (Idle) | 30 minutes (configurable per tenant) |
| Absolute Timeout | 7 days |
| Concurrent Sessions | 5 sessions |
| Cookie | httpOnly, secure flag |

### 2.5 Account Lockout

- 5 failed login attempts → 30 minute lockout
- Configurable via security settings

### 2.6 Two-Factor Authentication

**Supported Methods:**
- TOTP (Google Authenticator, Authy) — primary
- SMS (fallback)
- Email (backup)

### 2.7 Single Sign-On (SSO)

**SAML 2.0**, **OIDC**, and **LDAP** configurations available in Security Center → SSO Configuration.

---

## 3. Authorization

### 3.1 Role-Based Access Control (RBAC)

9 Default Roles:

| Role | Permissions |
|------|-------------|
| **Admin** | `*` — full system access |
| **Manager** | dashboard, bookings, guests, rooms, housekeeping, billing, reports, frontdesk |
| **Front Desk** | dashboard ops, bookings CRUD, guests CRUD, rooms view, frontdesk, billing, chat |
| **Housekeeping** | dashboard HK, rooms view/status, tasks, housekeeping, maintenance, assets |
| **Night Auditor** | dashboard ops, bookings view, guests view, billing, reports, checkin/checkout |
| **Revenue Manager** | dashboard, reports, revenue, pricing, channels, bookings view, inventory |
| **Marketing** | dashboard, guests, CRM, marketing, reports, communication |
| **Accountant** | dashboard, billing, reports revenue/occupancy, invoices, payments |
| **Maintenance** | dashboard HK, rooms view, tasks, maintenance, assets, IoT |

### 3.2 Permission Format

```
"module.action"  — e.g., "bookings.view", "rooms.manage"
"*"              — all permissions (admin)
"module.*"       — all actions in module
```

### 3.3 Three-Layer Access Control

```
Layer 1: Authentication (is user logged in?)
  └── Layer 2: Permissions (does user have permission X?)
        └── Layer 3: Feature Flags (is feature X enabled for this plan?)
```

### 3.4 Tenant Scoping

All API queries are automatically scoped to the authenticated user's tenant:
```typescript
const where = { deletedAt: null, tenantId: ctx.tenantId };
```

Platform admins can bypass tenant scoping when needed.

---

## 4. Data Protection

### 4.1 Encryption Standards

| Data State | Encryption |
|------------|------------|
| In Transit | TLS 1.3 |
| At Rest | AES-256-GCM |
| Database | PostgreSQL encryption |
| Passwords | bcrypt |
| Backups | AES-256 |

### 4.2 Sensitive Data Handling

**Encrypted Fields:**
- Guest identification numbers
- Payment card tokens
- Passwords (bcrypt)
- Session tokens
- City ledger financial data
- CRON_SECRET tokens

**Masked Fields:**
- Card numbers (show last 4)
- Phone numbers (partial)

### 4.3 Payment Card Data (PCI-DSS)

- No raw card data stored
- Tokenization via payment gateways
- Secure transmission only

### 4.4 Data Retention

| Data Type | Retention | After Retention |
|-----------|-----------|-----------------|
| Booking Data | 7 years | Archived |
| Payment Records | 7 years | Archived |
| Guest Profiles | Until deletion request | Anonymized |
| Audit Logs | 2 years | Deleted |
| Session Data | 30 days | Deleted |

---

## 5. Network Security

### 5.1 Firewall Rules

**Inbound:**

| Port | Source | Purpose |
|------|--------|---------|
| 443 | Any | HTTPS |
| 80 | Any | HTTP → HTTPS redirect |
| 1812 | WiFi Gateways | RADIUS Auth |
| 1813 | WiFi Gateways | RADIUS Acct |
| 3000 | Internal | Next.js App |
| 3003 | Internal | Realtime WebSocket |
| 8888 | Internal | Captive Portal Redirect |

**Outbound:**

| Port | Destination | Purpose |
|------|-------------|---------|
| 443 | Payment gateways | Payment processing |
| 443 | OTA APIs | Channel sync |
| 5432 | localhost | PostgreSQL |

### 5.2 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 10 | 1 minute |
| API | 300 | 1 minute |
| Webhooks | 100 | 1 minute |
| Cron Endpoints | 5 | 1 minute |

---

## 6. GDPR Compliance

### 6.1 Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Access | Export via API/UI (Settings → GDPR) |
| Rectification | Edit in UI |
| Erasure | Delete with audit trail |
| Portability | JSON/CSV export |
| Objection | Opt-out mechanisms |

### 6.2 Consent Management

Navigate to **Settings → GDPR** to configure consent types:
- Marketing emails
- Analytics tracking
- Third-party sharing

### 6.3 Data Export / Erasure

- **GDPRRequest** and **ConsentRecord** models track all data subject requests
- Export generates comprehensive archive of all guest data
- Erasure anonymizes data within 30 days with audit trail

---

## 7. Audit Logging

### 7.1 Logged Events

| Category | Events |
|----------|--------|
| Authentication | Login, logout, password change, 2FA, session creation |
| Authorization | Role change, permission update |
| Data Access | View sensitive data, export data |
| Data Modification | Create, update, delete operations |
| System | Configuration changes, integrations |
| Security | Failed logins, lockouts, suspicious activity |

### 7.2 Billing & Financial Audit (NEW in v2.1)

All billing mutations are fully audit logged to ensure financial traceability:

| Module | Audited Operations |
|--------|-------------------|
| **Posting Rules** | Create, update, delete, enable/disable posting rules |
| **Scheduled Charges** | Create, update, delete, pause, resume scheduled charges |
| **City Ledger** | Post charges, post payments, adjust balances, credit/debit memos, account transfers |
| **Commissions** | Create, update, process commission payments |

Each billing audit entry captures:
- Operator (userId) who performed the action
- Tenant context (tenantId)
- Before/after values for update operations
- Affected entity IDs (e.g., reservationId, cityLedgerAccountId)
- Timestamp with millisecond precision

### 7.3 Night Audit Audit Trail (NEW in v2.1)

All night audit operations are fully tracked:

| Operation | Logged Details |
|-----------|---------------|
| Night audit start/end | Operator, timestamp, property |
| Room rate auto-posting | Affected reservations, amounts posted |
| Folio closing | Closed folios, carry-forward balances |
| Day-end processing | Summary of all end-of-day mutations |
| Revenue snapshot | Captured revenue figures for the audit period |
| Audit corrections | Original value, corrected value, reason |

### 7.4 Housekeeping Operations Audit (NEW in v2.1)

Housekeeping operations are audit logged for accountability:

| Module | Audited Operations |
|--------|-------------------|
| **Laundry** | Laundry item creation, dispatch, return, inventory adjustments, loss reporting |
| **Lost & Found** | Item registration, retrieval, disposal, owner notification |
| **Minibar** | Stock updates, consumption posting, restocking, inventory adjustments |

### 7.5 Audit Log Model

```typescript
await db.auditLog.create({
  data: {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    module: 'billing',          // e.g., 'billing', 'nightAudit', 'housekeeping', 'cityLedger'
    action: 'postCharge',       // e.g., 'create', 'update', 'pause', 'resume', 'postCharge'
    entityType: 'CityLedger',   // e.g., 'PostingRule', 'ScheduledCharge', 'CityLedger', 'Minibar'
    entityId: id,
    newValue: JSON.stringify(updatedFields),
    oldValue: JSON.stringify(previousFields),
    metadata: {
      reason: reason || null,
      source: 'api' | 'cron' | 'nightAudit',
    },
  }
});
```

### 7.6 Log Retention

| Period | Storage |
|--------|---------|
| 0-90 days | Hot storage (database) |
| 90 days - 2 years | Cold storage |
| 2+ years | Deleted |

---

## 8. Cron Jobs Security

### 8.1 Overview

StaySuite uses cron-based scheduled tasks for automated background operations such as scheduled charge processing, night audit triggers, rate calculations, and data cleanup. All cron endpoints are protected by a **secret-based authentication mechanism** to prevent unauthorized or accidental execution.

### 8.2 CRON_SECRET Authentication

**Every request to `/api/cron/*` endpoints must include a valid `CRON_SECRET` header.**

```
CRON_SECRET: <server-side environment variable>
```

| Mechanism | Detail |
|-----------|--------|
| **Header Name** | `x-cron-secret` |
| **Environment Variable** | `CRON_SECRET` |
| **Validation** | Constant-time string comparison |
| **Failure Response** | `401 Unauthorized` — no details leaked |
| **Success** | Proceeds to cron handler |

### 8.3 Cron Middleware

```typescript
// Middleware applied to all /api/cron/* routes
export async function validateCronRequest(req: Request): boolean {
  const secret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!secret || !expectedSecret) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret));
}
```

### 8.4 Protected Cron Endpoints

| Endpoint | Purpose | Schedule |
|----------|---------|----------|
| `POST /api/cron/scheduled-charges` | Process pending scheduled charges | Daily / configurable |
| `POST /api/cron/night-audit` | Trigger night audit processing | Daily (configurable time) |
| `POST /api/cron/rate-calculation` | Auto-calculate room rates | As configured |
| `POST /api/cron/data-cleanup` | Purge expired sessions, temp data | Daily |
| `POST /api/cron/reports-generation` | Generate scheduled reports | As configured |

### 8.5 Security Best Practices for Cron Jobs

- **Never expose** `CRON_SECRET` in client-side code or logs
- Rotate `CRON_SECRET` periodically (recommended: quarterly)
- Restrict cron endpoint access to internal network / known IPs where possible
- All cron operations are audit logged with source `cron`
- Rate limiting is enforced on cron endpoints (5 requests/minute)
- Failed cron authentication attempts are logged as security events

---

## 9. Scheduled Charges Security

### 9.1 Overview

Scheduled charges allow properties to configure recurring or conditional billing rules that are automatically posted to guest folios or city ledger accounts. Given the financial nature of these operations, access is strictly controlled.

### 9.2 Access Control

| Action | Required Permissions | Authorized Roles |
|--------|---------------------|-----------------|
| **Create** scheduled charge | `billing.manage` | Admin, Manager, Accountant |
| **Update** scheduled charge | `billing.manage` | Admin, Manager, Accountant |
| **Delete** scheduled charge | `billing.manage` | Admin, Manager |
| **Pause** scheduled charge | `billing.manage` | Admin, Manager, Accountant |
| **Resume** scheduled charge | `billing.manage` | Admin, Manager, Accountant |
| **View** scheduled charges | `billing.view` | All billing-access roles |

### 9.3 Pause/Resume Authorization

Only authorized users with the `billing.manage` permission can **pause or resume** scheduled charges:

```typescript
// Authorization check for pause/resume
if (!hasPermission(ctx.user, 'billing.manage')) {
  throw new AuthorizationError('Only authorized users can modify scheduled charge status');
}
```

**Business Rules:**
- Paused charges are skipped during cron processing
- Resume operations are audit logged with operator, timestamp, and reason
- Bulk pause/resume is restricted to Admin and Manager roles only
- System-generated charges (from posting rules) cannot be individually paused — only the parent rule can be disabled

### 9.4 Financial Safeguards

- All scheduled charge mutations are validated against posting rules
- Maximum charge amounts can be configured per property
- Duplicate charge prevention via unique constraints on (tenantId, reservationId, chargeType, date)
- All mutations are audit logged (see [Section 7.2](#72-billing--financial-audit-new-in-v21))

---

## 10. Night Audit Security

### 10.1 Overview

Night audit is a critical end-of-day financial reconciliation process in hotel operations. It closes business for the current day, posts outstanding charges, updates room statuses, and generates revenue snapshots. Given its financial impact, night audit requires specific role-based permissions.

### 10.2 Required Role: `night_auditor`

Night audit operations are restricted to users with the **Night Auditor** role (or Admin):

```
Required Role: Night Auditor
```

| Operation | Allowed Roles |
|-----------|--------------|
| Start night audit | Night Auditor, Admin |
| Close folios | Night Auditor, Admin |
| Post auto-charges | Night Auditor, Admin (system) |
| View night audit reports | Night Auditor, Admin, Manager |
| Reverse night audit | Admin only |
| Re-run night audit | Admin only |

### 10.3 Night Audit Process Security

```
Step 1: Verify night_auditor role
  └── Step 2: Check no duplicate audit for the date
        └── Step 3: Lock affected reservations (pessimistic locking)
              └── Step 4: Post outstanding charges
                    └── Step 5: Close folios
                          └── Step 6: Generate revenue snapshot
                                └── Step 7: Create audit trail entry
```

### 10.4 Security Controls

| Control | Description |
|---------|-------------|
| **Role Enforcement** | Only users with `night_auditor` role can initiate the process |
| **Idempotency** | System prevents duplicate night audits for the same property/date |
| **Pessimistic Locking** | Reservations are locked during processing to prevent concurrent modifications |
| **Immutable Records** | Completed night audit records cannot be modified; reversals create new entries |
| **Full Audit Trail** | Every operation within night audit is logged (see [Section 7.3](#73-night-audit-audit-trail-new-in-v21)) |
| **CRON Trigger** | Night audit can be triggered via cron with `CRON_SECRET` (see [Section 8](#8-cron-jobs-security)) |
| **Reversal Restrictions** | Only Admin users can reverse a night audit, with mandatory reason |

### 10.5 Night Audit Data Protection

- Revenue snapshots are stored as immutable records
- Night audit operations are scoped to the property level
- Financial data is encrypted at rest (AES-256-GCM)
- Night audit reports respect RBAC — users can only view data for properties they have access to

---

## 11. City Ledger Security

### 11.1 Overview

The City Ledger module manages accounts receivable for non-guest entities such as corporate accounts, travel agencies, and direct bill clients. It contains highly sensitive financial data including outstanding balances, payment histories, and credit terms. Access is strictly restricted.

### 11.2 Access Control

| Action | Required Permissions | Authorized Roles |
|--------|---------------------|-----------------|
| **View** city ledger accounts | `billing.view` + `cityLedger.view` | Admin, Manager, Accountant |
| **Create** account | `billing.manage` + `cityLedger.manage` | Admin, Manager |
| **Post charges** | `cityLedger.manage` | Admin, Manager, Accountant |
| **Post payments** | `cityLedger.manage` | Admin, Manager, Accountant |
| **Adjust balances** | `cityLedger.manage` | Admin, Accountant |
| **Credit/Debit memos** | `cityLedger.manage` | Admin, Accountant |
| **View aging reports** | `billing.view` + `cityLedger.view` | Admin, Manager, Accountant, Revenue Manager |
| **Export** data | `cityLedger.export` | Admin, Accountant |

### 11.3 Data Protection Measures

| Measure | Implementation |
|---------|---------------|
| **Encryption** | Financial data encrypted at rest (AES-256-GCM) |
| **Tenant Isolation** | Strict tenant scoping on all queries |
| **Field-Level Access** | Credit limits and payment terms visible only to authorized roles |
| **Bulk Export Restrictions** | Exports require explicit `cityLedger.export` permission |
| **Immutable Ledger** | Posted entries cannot be deleted; corrections via reversal entries |

### 11.4 Financial Safeguards

- **Balance validation**: All postings validate available credit limits before committing
- **Double-entry verification**: Charge and payment postings follow double-entry accounting principles
- **Reconciliation**: City ledger balances are reconciled against general ledger during night audit
- **Audit Trail**: All city ledger mutations are fully audit logged (see [Section 7.2](#72-billing--financial-audit-new-in-v21))
- **Aging enforcement**: Automated aging reports flag overdue accounts per configured thresholds

### 11.5 API Security

```
All /api/city-ledger/* endpoints require:
  1. Valid session authentication
  2. billing.view or billing.manage permission (minimum)
  3. cityLedger.view or cityLedger.manage permission (as applicable)
  4. Tenant scoping automatically applied
```

---

## 12. Incident Response

### 12.1 Incident Categories

| Severity | Examples |
|----------|----------|
| Critical | Data breach, system compromise, CRON_SECRET exposure |
| High | Unauthorized access, data leak, financial data tampering |
| Medium | Failed login attempts, policy violation, unauthorized cron triggers |
| Low | Suspicious activity, minor misconfigurations |

### 12.2 Response Procedure

1. **Identification**: Detect via monitoring, validate severity
2. **Containment**: Isolate systems, revoke credentials, block IPs, rotate exposed secrets (including CRON_SECRET)
3. **Eradication**: Remove threat, patch vulnerabilities
4. **Recovery**: Restore from backup, monitor for recurrence
5. **Lessons Learned**: Document, update procedures, train team

### 12.3 Secret Rotation

In the event of a security incident involving exposed secrets:

| Secret | Rotation Procedure |
|--------|-------------------|
| `CRON_SECRET` | Generate new secret, update environment variable, restart services |
| API Keys | Revoke compromised keys, issue new ones, update integrations |
| Session Tokens | Force logout all users, invalidate all active sessions |
| Encryption Keys | Key rotation via key management service, re-encrypt affected data |

---

## 13. Security Best Practices

### 13.1 For Administrators

- Enable 2FA for all admin accounts
- Review audit logs weekly
- Rotate API keys quarterly
- Rotate `CRON_SECRET` quarterly or after any suspected exposure
- Update passwords per expiry policy
- Review user access quarterly
- Test backup restoration monthly
- Monitor night audit completion logs daily
- Review city ledger aging reports weekly
- Audit scheduled charge configurations monthly

### 13.2 Security Checklist

**Daily:** Monitor security alerts, review failed logins, verify night audit completion  
**Weekly:** Review audit logs, check integration health, review city ledger aging reports  
**Monthly:** User access review, password compliance, audit scheduled charge configurations  
**Quarterly:** Penetration testing, security training, rotate `CRON_SECRET` and API keys  

### 13.3 Cron & Scheduled Operations Checklist

- Verify `CRON_SECRET` is set in production environment and not in version control
- Confirm cron jobs are completing successfully (monitor logs)
- Validate that no cron endpoints are accessible without the secret header
- Review scheduled charge processing results for anomalies
- Ensure night audit ran successfully for each property

---

## Security Contact

**Security Team**: security@cryptsk.com  
**Bug Bounty**: security@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd*

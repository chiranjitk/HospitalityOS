# StaySuite Security Documentation
## Security and Compliance Manual

**Version**: 2.0  
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
8. [Incident Response](#8-incident-response)
9. [Security Best Practices](#9-security-best-practices)

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

### 7.2 Audit Log Model

```typescript
await db.auditLog.create({
  data: {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    module: 'users',
    action: 'update',
    entityType: 'User',
    entityId: id,
    newValue: JSON.stringify(updatedFields),
  }
});
```

### 7.3 Log Retention

| Period | Storage |
|--------|---------|
| 0-90 days | Hot storage (database) |
| 90 days - 2 years | Cold storage |
| 2+ years | Deleted |

---

## 8. Incident Response

### 8.1 Incident Categories

| Severity | Examples |
|----------|----------|
| Critical | Data breach, system compromise |
| High | Unauthorized access, data leak |
| Medium | Failed login attempts, policy violation |
| Low | Suspicious activity |

### 8.2 Response Procedure

1. **Identification**: Detect via monitoring, validate severity
2. **Containment**: Isolate systems, revoke credentials, block IPs
3. **Eradication**: Remove threat, patch vulnerabilities
4. **Recovery**: Restore from backup, monitor for recurrence
5. **Lessons Learned**: Document, update procedures, train team

---

## 9. Security Best Practices

### 9.1 For Administrators

- Enable 2FA for all admin accounts
- Review audit logs weekly
- Rotate API keys quarterly
- Update passwords per expiry policy
- Review user access quarterly
- Test backup restoration monthly

### 9.2 Security Checklist

**Daily:** Monitor security alerts, review failed logins  
**Weekly:** Review audit logs, check integration health  
**Monthly:** User access review, password compliance  
**Quarterly:** Penetration testing, security training

---

## Security Contact

**Security Team**: security@cryptsk.com  
**Bug Bounty**: security@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd*

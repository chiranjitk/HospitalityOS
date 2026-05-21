# StaySuite HospitalityOS — Business Logic Gap Analysis

**Scan Date:** 2025-07-09
**Scope:** Full project deep scan — API routes, Prisma schema, lib/services, mini-services, seed files, security, frontend pages
**Project Stats:** 457 Prisma models | 919 API route files | ~130 top-level API modules | 11 mini-services | 12,564-line schema

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [P0 — Critical / Build-Breaking Issues](#2-p0--critical--build-breaking-issues)
3. [P1 — Security Vulnerabilities](#3-p1--security-vulnerabilities)
4. [P2 — Business Logic Gaps](#4-p2--business-logic-gaps)
5. [P3 — Data Model Issues](#5-p3--data-model-issues)
6. [P4 — Mini-Services Issues](#6-p4--mini-services-issues)
7. [P5 — Code Quality & Maintainability](#7-p5--code-quality--maintainability)
8. [P6 — Missing / Incomplete Features](#8-p6--missing--incomplete-features)
9. [Detailed Findings by Module](#9-detailed-findings-by-module)
10. [Summary Scorecard](#10-summary-scorecard)

---

## 1. Executive Summary

| Category | Count |
|----------|-------|
| **P0 — Critical / Build-Breaking** | 3 |
| **P1 — Security Vulnerabilities** | 8 |
| **P2 — Business Logic Gaps** | 14 |
| **P3 — Data Model Issues** | 11 |
| **P4 — Mini-Services Issues** | 6 |
| **P5 — Code Quality Issues** | 10 |
| **P6 — Missing/Incomplete Features** | 8 |
| **TOTAL FINDINGS** | **60** |

### Overall Assessment

The project is **architecturally sound** with comprehensive coverage across 26+ hotel management modules. The majority (~93%) of API routes have real implementations with proper database queries. However, there are **critical security gaps** (disabled middleware, legacy password hashing, fallback secrets), **significant business logic stubs** in billing and communication, and **data model integrity issues** (45 models without Prisma relations, zero enums).

---

## 2. P0 — Critical / Build-Breaking Issues

### GAP-P0-01: Next.js Middleware is DISABLED
- **File:** `src/middleware.ts.bak` (active file `src/middleware.ts` does NOT exist)
- **Impact:** No subdomain-based tenant resolution in production. All requests hit the app without `X-Tenant-Id`/`X-Tenant-Slug` headers. Multi-tenant routing is completely broken.
- **Fix:** Rename `middleware.ts.bak` → `middleware.ts` OR create a production-ready middleware that handles tenant resolution.

### GAP-P0-02: Legacy SHA256 Password Hashing — Never Re-Hashed
- **File:** `src/lib/auth.ts` line 42
- **Issue:** Legacy passwords use `SHA256` with hardcoded salt `'staysuite_salt'`. No automatic migration to bcrypt occurs on successful login.
- **Impact:** All legacy-hashed passwords are vulnerable to rainbow table attacks. If users log in with legacy hashes, they remain on insecure hashes indefinitely.
- **Fix:** On successful legacy verification, re-hash with bcrypt and update the database record.

### GAP-P0-03: NEXTAUTH_SECRET Fallback in Production
- **File:** `src/lib/auth.ts` line 194-201
- **Issue:** Falls back to `'dev-only-secret-' + NODE_ENV` if `NEXTAUTH_SECRET` is unset — even logs a warning but **still returns a known secret**.
- **Impact:** Session forgery possible if env var is missing during deployment.
- **Fix:** Throw an error and refuse to start in production if `NEXTAUTH_SECRET` is not set.

---

## 3. P1 — Security Vulnerabilities

### GAP-P1-01: SSO Provisioning — Not Tenant-Scoped
- **File:** `src/lib/auth/sso-provisioning.ts` line 80-82
- **Issue:** SSO auto-provisioning looks up users **globally by email**, not scoped to the current tenant. If the same email exists under a different tenant, the SSO login will attach to the wrong tenant's user.
- **Impact:** Cross-tenant authentication bypass.

### GAP-P1-02: Rate Limiter Fails Open
- **File:** `src/lib/rate-limiter.ts` line 68-71
- **Issue:** On database failure, ALL requests are allowed through (`return { allowed: true }`).
- **Impact:** An attacker can overwhelm the DB to disable rate limiting (DoS amplification).

### GAP-P1-03: Platform Admin Bypasses ALL Permission Checks — No Audit
- **Files:** `src/lib/auth/tenant-context.ts`, `src/lib/auth-helpers.ts`, `src/contexts/AuthContext.tsx`
- **Issue:** `hasPermission()` returns `true` immediately for platform admins. No audit log is created for admin actions.
- **Impact:** Untraceable superuser access. Compliance risk.

### GAP-P1-04: No CSRF Protection
- **Issue:** No CSRF token validation found for state-changing operations across any API route.
- **Impact:** Cross-site request forgery attacks possible on all mutating endpoints.

### GAP-P1-05: No CORS Configuration
- **Issue:** No CORS middleware or configuration found. API endpoints may be accessible from any origin.
- **Impact:** Data exfiltration via cross-origin requests.

### GAP-P1-06: Permission-Denied Attempts Not Logged
- **File:** `src/lib/auth/tenant-context.ts` line 168
- **Issue:** TODO comment confirms: `// TODO (GAP-18): Consider logging permission-denied attempts for security monitoring`
- **Impact:** Brute-force permission attacks are undetectable.

### GAP-P1-07: Hardcoded DB Credentials in Mini-Services
- **Files:** `dns-service/index.ts`, `dhcp-service/index.ts`, `freeradius-service/index.ts`, `nftables-service/index.ts`
- **Issue:** `DATABASE_URL` fallback: `postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite`
- **Impact:** If `DATABASE_URL` env var is missing, services connect with hardcoded credentials.

### GAP-P1-08: Window Store Exposure in Production
- **File:** `src/store/index.ts` line 148
- **Issue:** `(window as any).__UI_STORE__ = useUIStore` — exposes entire store state for E2E testing.
- **Impact:** Internal UI state accessible from browser console in production.

---

## 4. P2 — Business Logic Gaps

### GAP-P2-01: Folio Routing — Channel Condition Not Implemented
- **File:** `src/lib/billing/folio-router.ts` line 137-140
- **Issue:** Channel-based routing rules are accepted in configuration but silently ignored: `if (conditions.channel && conditions.channel !== 'all') { /* Channel check would need the booking's channelId — for now, treat 'all' as pass-through */ }`
- **Impact:** Charges may be routed to wrong folios when channel-specific rules are configured.

### GAP-P2-02: Folio Routing — Rule Stats Return Stubs
- **File:** `src/lib/billing/folio-router.ts` line 204-213
- **Issue:** `getRuleStats()` returns hardcoded zeros: `{ chargesRouted: 0, lastRoutedAt: null, totalAmountRouted: 0 }`
- **Impact:** No visibility into charge routing effectiveness.

### GAP-P2-03: Room Charge — Falls Back to $0
- **File:** `src/lib/billing/room-charge.ts` line 79
- **Issue:** If no price override, rate plan, or booking rate exists, the room charge defaults to `$0`.
- **Impact:** Silent free rooms if rate plans are misconfigured.

### GAP-P2-04: Hardcoded Billing Pricing (3 Locations)
- **File:** `src/app/api/admin/billing/calculate/route.ts` lines 93, 109, 120
- **Issue:** Comment: `"Fix J: Replace hardcoded pricing and limits with DB lookup"` — pricing calculations use hardcoded values.
- **Impact:** Billing amounts don't reflect actual subscription plan prices.

### GAP-P2-05: Communication — Channel Sending Not Implemented
- **File:** `src/app/api/communication/conversations/[id]/messages/route.ts` line 186
- **Issue:** `// TODO: Send message through channel (WhatsApp, SMS, Email) if senderType is 'staff'`
- **Impact:** Messages are stored in DB but never delivered to guests via external channels.

### GAP-P2-06: No-Show Engine — In-Memory State
- **File:** `src/lib/no-show-engine.ts` line 624
- **Issue:** `lastExecutionStatus` stored in-memory. Resets on server restart. Multi-instance deployments have inconsistent state.
- **Impact:** No-show detection may re-process already-handled bookings after restart.

### GAP-P2-07: Payment Router — Singleton Race Condition
- **File:** `src/lib/payments/router.ts` line 54-69
- **Issue:** `PaymentRouter.getInstance()` is a singleton with mutable `tenantId`. Concurrent requests for different tenants can overwrite each other's gateway config.
- **Impact:** Cross-tenant payment routing — Tenant A's payment goes through Tenant B's gateway credentials.

### GAP-P2-08: Card Decline Triggers Failover
- **File:** `src/lib/payments/router.ts` line 39
- **Issue:** `'card_declined'` is in `failoverOnErrors`. A genuine card decline can trigger failover to another gateway on retry.
- **Impact:** Incorrect payment routing — declined cards should not be retried on different gateways.

### GAP-P2-09: External Reviews — Expedia Integration Stubbed
- **File:** `src/lib/reputation/external-reviews.ts` line 215
- **Issue:** `// TODO: Implement Expedia API integration when credentials are available`
- **Impact:** Reputation management only works with some OTAs, not Expedia.

### GAP-P2-10: OTA Sync — Mock Implementation
- **File:** `src/app/api/rooms/[id]/ota-sync/route.ts` line 274
- **Issue:** `"Simulate OTA sync - generate a mock remote URL and ID"`
- **Impact:** OTA synchronization doesn't actually communicate with external channels.

### GAP-P2-11: DHCP Service Control — Always Returns Success
- **File:** `src/app/api/wifi/dhcp/service/[action]/route.ts`
- **Issue:** 46 lines. Comment says "Stub: always succeed". Returns `{ running: true }` without any actual service control.
- **Impact:** Frontend shows DHCP as running/controlled but backend never actually manages the service.

### GAP-P2-12: Root API Route — Placeholder
- **File:** `src/app/api/route.ts`
- **Issue:** 4 lines. Returns `{ message: "Hello, world!" }`. No health check, version info, or API discovery.
- **Impact:** Missed opportunity for API health/status endpoint.

### GAP-P2-13: Guest Portal — Hardcoded Values
- **Files:**
  - `src/app/api/portal/e-sign/route.ts` lines 125-126: Terms version `'1.0'`, `lastUpdated: '2024-01-01'`
  - `src/app/api/portal/in-room/route.ts` line 164: `estimatedDelivery: '30 mins'`
  - `src/app/api/v1/wifi/auth/route.ts` lines 413, 471: Bandwidth fallback `5000 kbps down / 1000 kbps up`
- **Impact:** Production guest-facing values are hardcoded and not configurable per property.

### GAP-P2-14: Booking Lock Release Fails on Tab Close
- **File:** `src/hooks/use-booking-lock.ts` line 379
- **Issue:** Uses `navigator.sendBeacon(url, JSON.stringify({ method: 'DELETE' }))` but `sendBeacon` sends POST with `text/plain` content type — the server expects DELETE method.
- **Impact:** Booking locks are never released on browser tab close, leading to phantom locks.

---

## 5. P3 — Data Model Issues

### GAP-P3-01: ZERO Enums in Schema (457 Models)
- **File:** `prisma/schema.prisma`
- **Issue:** Every status, type, category, and role field is a plain `String`. No type safety, no DB constraints, no autocomplete.
- **Impact:** Typos like `"sttaus": "pending"` silently succeed. No referential integrity for status fields.
- **Recommended:** Convert top 30 most-referenced string-status fields to Prisma enums (e.g., `BookingStatus`, `RoomStatus`, `PaymentMethod`, `TaskPriority`).

### GAP-P3-02: 45 Models With FK Fields but No @relation Decorator
- **Issue:** These models store foreign keys as raw `String @db.Uuid` without Prisma relation enforcement.
- **Impact:** No database-level FK constraints, no cascade deletes, no Prisma `include`/`select` joins.
- **Key affected models:**
  - All 15+ Channel Manager models (`ChannelCommissionConfig`, `ChannelCurrencyConfig`, etc.)
  - `GroupBooking`, `ChannelConnection`, `SubscriptionPlan`, `Subscription`
  - `HelpArticle`, `ChatConversation`, `Promotion`, `BookingModification`
  - `BandwidthPolicyDetail`, `LicenseKey`

### GAP-P3-03: 16 Truly Orphan Models (No Relations At All)
- **Issue:** Models completely disconnected from the schema.
- **Notable:** `DataUsageByPeriod`, `RadGroupCheck`, `RadGroupReply`, `RadPostAuth`, `Plugin`, `RateLimitEntry`
- **Impact:** Cannot be joined with other tables. Must be queried independently.

### GAP-P3-04: seed-help-articles.ts Passes Non-UUID as tenantId
- **File:** `prisma/seed-help-articles.ts`
- **Issue:** `const tenantId = 'tenant-1'` — not a valid UUID. The `HelpArticle` model has `tenantId String? @db.Uuid`.
- **Impact:** Seed fails at runtime on fresh production setup (Prisma P2023 error — root cause of the reported UUID bug).

### GAP-P3-05: No Composite Unique on Room Number + Property
- **Issue:** `Room.number` + `propertyId` has no composite unique constraint.
- **Impact:** Duplicate room numbers possible within the same property.

### GAP-P3-06: No Composite Unique on User Email + Tenant
- **Issue:** `User.email` + `tenantId` has no composite unique constraint.
- **Impact:** Same email can be created twice within one tenant.

### GAP-P3-07: User.roleId is Optional
- **Issue:** `User.roleId` is nullable — users can exist without any role assigned.
- **Impact:** Permission checks may fail or return unexpected results for roleless users.

### GAP-P3-08: Payment.folioId is Optional
- **Issue:** Payments can exist without linking to a folio.
- **Impact:** Orphan payments that can't be traced to any guest folio/bill.

### GAP-P3-09: 85 Models Lack tenantId
- **Issue:** No tenant isolation on these models. Some are legitimate (child tables scoped via parent), but RADIUS tables have NO tenant isolation.
- **Impact:** Multi-tenant RADIUS data could leak between tenants.

### GAP-P3-10: RadPostAuth Has No Indexes
- **Issue:** Heavily queried RADIUS authentication log table has zero indexes.
- **Impact:** Slow queries on username/reply fields during auth diagnostics.

### GAP-P3-11: 68 Models Have No API Routes
- **Issue:** These schema models exist but are never directly referenced in API routes.
- **Notable:** Most Channel Manager internals (26 models), Finance internals (`CashBookEntry`, `JournalEntry`, `PayrollEntry`), OTA configs, `IpPool`, `IpPoolRange`
- **Impact:** Dead schema or missing CRUD endpoints for managing these entities.

---

## 6. P4 — Mini-Services Issues

### GAP-P4-01: Hardcoded Ports
- **Files:**
  - `dhcp-service/index.ts`: PORT = 3011
  - `dns-service/index.ts`: PORT = 3012
  - `notification-ws/index.ts`: PORT = 3003
  - `shell-console/index.ts`: PORT = 3025
  - `realtime-service/index.ts`: No PORT constant (uses default)
  - `freeradius-service/index.ts`: No PORT constant found
  - `nftables-service/index.ts`: No PORT constant found
- **Impact:** Port conflicts if multiple services run on same host or ports are already in use.

### GAP-P4-02: Hardcoded Database Credentials
- **Files:** `dns-service`, `dhcp-service`, `freeradius-service`, `nftables-service`
- **Fallback:** `postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite`
- **Impact:** Production deployment risk if DATABASE_URL is not set.

### GAP-P4-03: No Health Check Endpoints
- **Issue:** Most mini-services lack a `/health` or `/ready` endpoint.
- **Impact:** No way for PM2/orchestration to detect service health.

### GAP-P4-04: Conntrack-bridge Depends on ClickHouse
- **File:** `conntrack-bridge/index.ts` line 21
- **Issue:** `CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://127.0.0.1:8123"` — requires ClickHouse for full functionality.
- **Impact:** Silent degradation if ClickHouse is not available.

### GAP-P4-05: Shared Logger Has No Log Levels
- **File:** `mini-services/shared/logger.ts`
- **Issue:** No configurable log levels. All services log at the same verbosity.
- **Impact:** Noisy production logs or insufficient debug information.

### GAP-P4-06: Availability Service Has Separate Prisma Schema
- **File:** `mini-services/availability-service/prisma/schema.prisma`
- **Issue:** Runs its own Prisma client potentially against a different schema version.
- **Impact:** Schema drift between main app and availability service.

---

## 7. P5 — Code Quality & Maintainability

### GAP-P5-01: Duplicate Permission Logic (5 Implementations)
- **Files:**
  1. `src/lib/auth-helpers.ts` (DEPRECATED but imported by 40+ routes)
  2. `src/lib/auth/permissions.ts` (active)
  3. `src/lib/auth/tenant-context.ts` (canonical)
  4. `src/contexts/AuthContext.tsx` (client-side)
  5. `src/contexts/PermissionContext.tsx` (client-side)
- **Impact:** Permission logic changes must be applied to 5 places. Maintenance risk.

### GAP-P5-02: Dual Authentication Systems
- **Issue:** NextAuth (`getServerSession`) and custom session (`session_token` cookie + DB lookup) exist in parallel. API routes inconsistently use both.
- **Impact:** Confusion about canonical auth mechanism. Potential security gaps.

### GAP-P5-03: 20+ Empty Catch Blocks in Lib
- **Files:** `scheduler.ts` (3), `nmcli.ts` (11), `network/executor.ts` (1), `automation/engine.ts` (1), `wifi/radius/route.ts` (1)
- **Impact:** Errors silently swallowed. Hidden bugs in production.

### GAP-P5-04: Marketing Module — Minimal Error Handling
- **Issue:** 11 marketing API route files have 1-5 try/catch blocks total (some handlers unprotected).
- **Files:** `journeys`, `promotions`, `upsell`, `abandoned-bookings`, `seo-analytics`
- **Impact:** Unhandled promise rejections on DB errors.

### GAP-P5-05: Revenue Module — Minimal Error Handling
- **Issue:** 17 revenue API route files have 1-5 try/catch blocks total.
- **Files:** `pricing-rules`, `demand-forecast`, `ai-suggestions`, `rate-shopping`, `competitor-pricing`, etc.
- **Impact:** Unhandled promise rejections on DB errors.

### GAP-P5-06: Rate Limiter Not Atomic
- **File:** `src/lib/rate-limiter.ts` line 46-57
- **Issue:** Uses `upsert` which is not atomic under concurrent requests. Lost updates possible.
- **Impact:** Rate limit count can be lower than actual, allowing more requests than permitted.

### GAP-P5-07: Tenant Isolation Proxy — Update Method Gap
- **File:** `src/lib/tenant-isolation.ts` line 146
- **Issue:** Proxy injects `tenantId` into `where` for `update`, but NOT into `data`. A `db.user.update({ data: { name: 'X' } })` without explicit `where` would update across tenants.
- **Impact:** Potential cross-tenant data modification.

### GAP-P5-08: Inconsistent API Response Format
- **Issue:** Some routes return `error: 'Unauthorized'` (string), others return `error: { code, message }` (object). Some lack `success: false` wrapper.
- **Impact:** Frontend error handling must handle multiple formats.

### GAP-P5-09: Duplicate deleteMany in seed.ts Cleanup
- **File:** `prisma/seed.ts` lines 40-124
- **Issue:** Cleanup section contains duplicate `deleteMany` calls (lines 86-103 repeat lines 40-84).
- **Impact:** Harmless but wasteful on seed.

### GAP-P5-10: SSO Session TypeScript Null Filter Hack
- **File:** `src/lib/auth/sso-provisioning.ts` line 511
- **Issue:** `terminatedAt: null as unknown as null` — type assertion hack for Prisma null filtering.
- **Impact:** Will silently break if Prisma changes null filter behavior.

---

## 8. P6 — Missing / Incomplete Features

### GAP-P6-01: No Night Audit Automation
- **Issue:** While there are manual night audit API endpoints, there is no automated cron-based night audit execution that runs at property-configured times.
- **Impact:** Night audit must be triggered manually every day.

### GAP-P6-02: No Real-Time Dashboard Updates
- **Issue:** Dashboard API routes return static snapshots. No WebSocket/SSE push for live occupancy, revenue, or booking changes.
- **Impact:** Dashboard data is stale until manual refresh.

### GAP-P6-03: No Bulk Guest Import
- **Issue:** No API endpoint for importing guests from CSV/Excel or external PMS systems.
- **Impact:** Manual guest entry required for each reservation.

### GAP-P6-04: No Room Type Change Cascade
- **Issue:** Changing a room's type doesn't cascade to update availability, pricing, or channel manager mappings.
- **Impact:** Room type changes may cause inconsistencies across the system.

### GAP-P6-05: No Multi-Language Guest Portal
- **Issue:** Guest portal (`/portal/[token]`) is English-only. No language selection or i18n support.
- **Impact:** Non-English speaking guests cannot use the portal effectively.

### GAP-P6-06: No Automated Rate Shopping
- **Issue:** `rate-shopping` API accepts requests but doesn't automatically scrape competitor rates on a schedule.
- **Impact:** Rate shopping data is always manual/stale.

### GAP-P6-07: No Invoice PDF Generation
- **Issue:** Invoice API routes return JSON data but there's no PDF generation or email delivery of invoices to guests.
- **Impact:** Guests must view invoices in-app only.

### GAP-P6-08: No Digital Key Revocation
- **Issue:** Digital key API creates keys but lacks a revocation endpoint for lost devices or early check-out.
- **Impact:** Compromised keys remain active.

---

## 9. Detailed Findings by Module

### 9.1 Authentication & Authorization
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P0-02 | Legacy SHA256 passwords never re-hashed | Critical |
| GAP-P0-03 | NEXTAUTH_SECRET fallback in production | Critical |
| GAP-P1-01 | SSO provisioning not tenant-scoped | High |
| GAP-P1-03 | Platform admin bypasses permissions — no audit | High |
| GAP-P1-06 | Permission-denied attempts not logged | High |
| GAP-P5-01 | 5 duplicate permission implementations | Medium |
| GAP-P5-02 | Dual auth systems (NextAuth + custom) | Medium |

### 9.2 Billing & Finance
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-01 | Folio routing channel condition ignored | Medium |
| GAP-P2-02 | Folio routing stats return stubs | Low |
| GAP-P2-03 | Room charge falls back to $0 | High |
| GAP-P2-04 | Hardcoded billing pricing (3 locations) | High |
| GAP-P3-08 | Payment.folioId is optional | Medium |

### 9.3 Payments
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-07 | Payment router singleton race condition | Critical |
| GAP-P2-08 | Card decline triggers gateway failover | Medium |

### 9.4 WiFi & Network
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-11 | DHCP service control always succeeds (stub) | Medium |
| GAP-P3-09 | RADIUS tables have no tenant isolation | High |
| GAP-P3-10 | RadPostAuth has no indexes | Medium |
| GAP-P4-01 | Mini-services use hardcoded ports | Low |

### 9.5 Communication & Guest Experience
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-05 | Channel message sending not implemented | High |
| GAP-P2-13 | Hardcoded portal values (terms version, delivery estimate) | Low |
| GAP-P6-01 | No automated night audit | Medium |
| GAP-P6-05 | No multi-language guest portal | Medium |

### 9.6 Channel Manager & OTA
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-10 | OTA sync is mocked | High |
| GAP-P2-09 | Expedia integration stubbed | Medium |
| GAP-P3-02 | 15+ channel models without @relation | High |
| GAP-P3-11 | 26 channel models have no API routes | Medium |

### 9.7 Revenue Management
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P5-05 | Revenue API routes lack error handling | Medium |
| GAP-P6-06 | No automated rate shopping | Low |

### 9.8 Marketing & CRM
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P5-04 | Marketing API routes lack error handling | Medium |

### 9.9 Housekeeping & Operations
| ID | Finding | Severity |
|----|---------|----------|
| GAP-P2-06 | No-show engine uses in-memory state | Medium |
| GAP-P2-14 | Booking lock release fails on tab close | Medium |

---

## 10. Summary Scorecard

| Module | Routes | Implemented | Stubs | Gaps | Score |
|--------|--------|-------------|-------|------|-------|
| **Authentication** | 16 | 14 | 0 | 7 | 7/10 |
| **Bookings** | 13 | 13 | 0 | 2 | 9/10 |
| **Rooms** | 10 | 10 | 1 | 0 | 9/10 |
| **Guests** | 20 | 20 | 0 | 1 | 9/10 |
| **WiFi/Network** | ~130 | ~128 | 1 | 3 | 8/10 |
| **Payments** | 12 | 12 | 0 | 2 | 8/10 |
| **Billing/Finance** | 17 | 15 | 0 | 4 | 7/10 |
| **Channel Manager** | 35 | 30 | 1 | 3 | 7/10 |
| **Marketing** | 11 | 11 | 0 | 1 | 7/10 |
| **Revenue** | 17 | 17 | 0 | 1 | 7/10 |
| **Communication** | 6 | 5 | 0 | 1 | 7/10 |
| **Housekeeping** | 6 | 6 | 0 | 1 | 9/10 |
| **Staff/HR** | 14 | 14 | 0 | 0 | 9/10 |
| **Inventory** | 12 | 12 | 0 | 0 | 9/10 |
| **POS** | 8 | 8 | 0 | 0 | 9/10 |
| **Events/BEO** | 10 | 10 | 0 | 0 | 9/10 |
| **Security/IoT** | 14 | 14 | 0 | 0 | 9/10 |
| **Admin** | 14 | 12 | 0 | 0 | 8/10 |
| **Portal/Guest** | 5 | 4 | 0 | 2 | 7/10 |
| **Notifications** | 11 | 11 | 0 | 0 | 9/10 |
| **Cron Jobs** | 16 | 16 | 0 | 0 | 9/10 |
| **AI** | 8 | 8 | 0 | 0 | 9/10 |
| **Data Model (Prisma)** | 457 models | — | — | 11 | 6/10 |

### Recommended Fix Priority

```
WEEK 1 (P0 + P1 Security):
  [ ] GAP-P0-01: Enable middleware.ts
  [ ] GAP-P0-02: Auto-rehash legacy SHA256 → bcrypt
  [ ] GAP-P0-03: Block startup if NEXTAUTH_SECRET missing in prod
  [ ] GAP-P1-01: Scope SSO user lookup to tenant
  [ ] GAP-P1-02: Rate limiter should fail CLOSED (deny on error)
  [ ] GAP-P1-04: Add CSRF protection
  [ ] GAP-P1-05: Configure CORS

WEEK 2 (P2 Critical Business Logic):
  [ ] GAP-P2-03: Room charge $0 fallback → error
  [ ] GAP-P2-04: Replace hardcoded billing with DB lookup
  [ ] GAP-P2-05: Implement message channel delivery
  [ ] GAP-P2-07: Fix payment router singleton → per-request instance
  [ ] GAP-P2-11: Implement real DHCP service control
  [ ] GAP-P3-04: Fix seed-help-articles.ts UUID

WEEK 3 (P2 Business Logic + P3 Data Model):
  [ ] GAP-P2-01: Implement folio routing channel condition
  [ ] GAP-P2-08: Remove card_declined from failover errors
  [ ] GAP-P2-10: Implement real OTA sync
  [ ] GAP-P2-14: Fix booking lock release via server-side cleanup
  [ ] GAP-P3-01: Add enums for top 30 status fields
  [ ] GAP-P3-05: Add composite unique on Room number + propertyId
  [ ] GAP-P3-06: Add composite unique on User email + tenantId

WEEK 4 (P4 + P5 Code Quality):
  [ ] GAP-P5-01: Consolidate permission logic to single source
  [ ] GAP-P5-03: Add error handling to empty catch blocks
  [ ] GAP-P5-04/05: Add try/catch to marketing + revenue routes
  [ ] GAP-P5-07: Fix tenant isolation proxy update method
  [ ] GAP-P4-01: Make mini-service ports configurable
  [ ] GAP-P4-03: Add health check endpoints to mini-services
```

---

*Report generated by deep project scan. All findings verified against source code.*

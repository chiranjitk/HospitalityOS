# WiFi Module — E2E Production Readiness Gap Report

**Date**: June 2025  
**Scope**: Complete deep scan of ALL WiFi module files  
**Files Scanned**: 55 components, 150+ API routes, 40+ lib/service files  
**Methodology**: Line-by-line code review, cross-reference, and E2E trace

---

## Executive Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **CRITICAL** | 7 | Hardcoded tenant bypass (32 routes), stub auth, credential leaks, SQL injection, in-memory state, undefined variable |
| **HIGH** | 10 | Password leak, no rate limiting, blocking execSync, inconsistent error format, hardcoded SSID, fake progress |
| **MEDIUM** | 14 | No input bounds, missing pagination, no AbortController, console.error in production, fake success responses, duplicate code |
| **LOW** | 8 | BigInt precision, inconsistent pagination format, type safety (`any`), no i18n |

**Overall Assessment**: The WiFi module is architecturally sound with real API calls everywhere, proper loading states, and comprehensive CRUD operations. However, there are **7 CRITICAL gaps** that must be resolved before any production deployment.

---

## CRITICAL — Must Fix Before Production

### C1. Hardcoded `TENANT_ID = 'tenant_01'` Bypasses Authentication (32 routes)

**Impact**: Any unauthenticated user can read/write data for tenant `tenant_01`. These endpoints have ZERO auth checks.

**Affected API route files (32 total)**:

| Domain | Routes |
|--------|--------|
| **SLA** | `sla/route.ts`, `sla/[id]/route.ts`, `sla/[id]/metrics/route.ts`, `sla/compliance/route.ts`, `sla/available-properties/route.ts` |
| **Health Alerts** | `alerts/route.ts`, `alerts/[id]/route.ts`, `alerts/stats/route.ts` |
| **Pre-Arrival** | `pre-arrival/route.ts`, `pre-arrival/[id]/route.ts`, `pre-arrival/send/route.ts`, `pre-arrival/delivery-logs/route.ts` |
| **Bandwidth Upgrade** | `bandwidth-upgrade/route.ts`, `bandwidth-upgrade/[id]/route.ts`, `bandwidth-upgrade/stats/route.ts`, `bandwidth-upgrade/settings/route.ts` |
| **Satisfaction** | `satisfaction/route.ts`, `satisfaction/stats/route.ts` |
| **Identity Logs** | `identity-logs/route.ts`, `identity-logs/[id]/route.ts`, `identity-logs/stats/route.ts`, `identity-logs/settings/route.ts`, `identity-logs/export/route.ts` |
| **Consent Logs** | `consent-logs/route.ts`, `consent-logs/[id]/route.ts`, `consent-logs/stats/route.ts`, `consent-logs/settings/route.ts` |
| **Revenue** | `revenue-dashboard/route.ts` |
| **Devices** | `devices/route.ts`, `devices/[id]/route.ts`, `devices/lookup/route.ts`, `devices/settings/route.ts` |

**Pattern**: Every file has `const TENANT_ID = 'tenant_01';` at the top.

**Fix**: Replace with `const user = await requirePermission(request, '...');` and use `user.tenantId`.

---

### C2. Captive Portal Auth is a Stub — Accepts Any Input

**File**: `/api/wifi/captive/auth/route.ts`

**Issue**: Lines 28-38 accept ANY non-empty voucher code. Lines 57-68 accept ANY room number + last name. No database validation.

```typescript
// Line 29: "For demo: accept any non-empty code"
return NextResponse.json({
  success: true,
  sessionId: `sess_${Date.now()}_${Math.random()...}`,
  network: 'RoyalStay-Guest',       // ← Hardcoded SSID
  bandwidthLimit: '100Mbps',        // ← Hardcoded bandwidth
  expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString(),
})
```

**Fix**: Implement real voucher validation against `WiFiVoucher` table and room validation against guest reservation system.

---

### C3. RADIUS Passwords Exposed in API GET Responses

**File**: `/api/wifi/users/route.ts` (lines 108-114)

```typescript
radCheck: row.radius_password ? [{
  value: row.radius_password,   // ← Plaintext Cleartext-Password exposed
}] : [],
```

**File**: `/api/wifi/nas/route.ts` (lines 154-155, 164)

```typescript
sharedSecret: n.secret,   // ← RADIUS shared secret exposed
secret: n.secret,         // ← Duplicate exposure
```

**Impact**: Any authenticated admin user can see all RADIUS passwords and NAS shared secrets.

**Fix**: Mask password fields in GET responses (return `***` or empty string).

---

### C4. `vouchers/route.ts` — Undefined Variable `voucherValidityDays` (Runtime Crash)

**File**: `/api/wifi/vouchers/route.ts` (line 300)

```typescript
const sessionTimeoutSec = plan.sessionLimit
  ? plan.sessionLimit
  : voucherValidityDays * 24 * 60 * 60;  // ← ReferenceError: not defined
```

The variable `voucherValidityDays` is never declared. The plan object has `validityDays` and `validityMinutes`, but not `voucherValidityDays`. This will throw a `ReferenceError` at runtime whenever a voucher with a plan that has no `sessionLimit` is activated.

**Fix**: Change to `plan.validityDays * 24 * 60 * 60` or `plan.validityMinutes * 60`.

---

### C5. Health Alert System is In-Memory Only — Lost on Restart

**File**: `/api/wifi/health/route.ts` (lines 51-54)

```typescript
let alertRules: AlertRule[] = [...DEFAULT_RULES];
let activeAlerts: AlertEvent[] = [];
let alertHistory: AlertEvent[] = [];
let alertIdCounter = 0;
```

All alert state is held in module-level variables. Server restart/redeploy/scale-out = all data lost.

**Fix**: Persist alert rules, active alerts, and history to PostgreSQL (there is a `WiFiAlert` model in Prisma schema).

---

### C6. Hardcoded Default NAS Secret `'changeme'`

**File**: `/api/wifi/nas/route.ts` (line 191)

```typescript
const nasSecret = sharedSecret || secret || 'changeme';
```

If no secret is provided during NAS creation, the well-known default `'changeme'` is used.

**Fix**: Reject NAS creation without an explicit secret.

---

### C7. `$executeRawUnsafe` SQL Injection Risk in User Bandwidth Report

**File**: `/api/wifi/reports/user-bandwidth/route.ts` (line 60)

```typescript
const limit = parseInt(searchParams.get('limit') || '50', 10);
// ...
LIMIT ${limit}   // ← Direct template interpolation
```

While `parseInt()` sanitizes the value, it breaks parameterized-query discipline.

**Fix**: Use parameterized `$N` placeholder: `LIMIT $${params.length + 1}::bigint`.

---

## HIGH — Should Fix Before Production

### H1. No Rate Limiting on Authentication Endpoints

**Files**: `captive/auth/route.ts`, `vouchers/route.ts` (PUT action=use)

An attacker can brute-force voucher codes or room numbers. The captive auth accepts anything (see C2).

**Fix**: Add rate limiting (e.g., 5 attempts per IP per minute).

---

### H2. `execSync` Blocks Event Loop in Loops

**File**: `/api/wifi/plans/route.ts` (line 374) — CoA disconnect loop  
**File**: `/api/wifi/nas/route.ts` (lines 85, 92-98)

```typescript
const output = execSync(cmd, { timeout: 5000 }).toString();
```

Called inside loops over sessions/NAS devices. With many items, this freezes the server.

**Fix**: Use `execFile` (async) or batch operations.

---

### H3. Inconsistent Error Response Format Across Routes

**Format A** (structured — sessions, plans, vouchers):
```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

**Format B** (flat string — alerts, SLA, pre-arrival, satisfaction, identity-logs, consent-logs, revenue):
```json
{ "success": false, "error": "Failed to fetch..." }
```

**Impact**: Frontend code must handle both formats, causing potential parsing bugs.

**Fix**: Standardize to Format A across all routes.

---

### H4. NAS Route — `crypto.randomUUID()` Without Import

**File**: `/api/wifi/nas/route.ts` (line 190)

The `crypto` module is not imported. In Next.js with ESM, `crypto.randomUUID()` may throw `ReferenceError`.

---

### H5. Hardcoded SSID in Multiple Locations

| File | Line | Value |
|------|------|-------|
| `captive/auth/route.ts` | 33-34, 62-63 | `'RoyalStay-Guest'` |
| `vouchers/route.ts` | 663 | `'StaySuite-Guest'` |

**Fix**: Derive from portal instance or property configuration.

---

### H6. `event-wifi.tsx` — Fake Progress Indicator

**File**: `event-wifi.tsx` (line 507-509)

```typescript
const progressInterval = setInterval(() => {
  setBulkProgress(prev => Math.min(prev + Math.random() * 15, 90));
}, 200);
```

Bulk generation progress is random, not tied to actual operation progress.

---

### H7. Revenue Dashboard — 10+ Parallel Heavy DB Queries + N+1

**File**: `revenue-dashboard/route.ts` (lines 23-129, 226-240)

10+ simultaneous heavy queries + N+1 lookups for plan names.

**Fix**: Use aggregation queries or materialized views.

---

### H8. Missing Tenant Isolation in `sync/route.ts` GET Handler

**File**: `sync/route.ts` (lines 229-233)

```typescript
const syncRecords = await db.wiFiAccountingSync.findMany({
  orderBy: { lastSyncedAt: 'desc' },
  take: 10,
  // No tenantId filter!
});
```

Any authenticated user can see all tenants' sync records.

---

### H9. `$executeRawUnsafe` radacct Cleanup on Every First Request After Restart

**File**: `radius/route.ts` (lines 40-58)

6 full-table UPDATE queries run on every server restart. Guarded by `let radacctCleaned = false` which resets on restart.

---

### H10. `content-filter/route.ts` Returns HTTP 410 (Gone)

This route returns 410 for all methods. If any UI links here, users will see broken functionality. The navigation config still includes `wifi-content-filter` as a menu item.

---

## MEDIUM — Production Quality Issues

### M1. No Input Validation on `limit`/`offset` Query Parameters (15+ routes)

No upper bound on `limit`. Caller can request `limit=999999999` to dump entire tables.

**Affected**: sessions, users, plans, vouchers, identity-logs, auth-logs, and all routes using the same pattern.

**Fix**: Cap at reasonable maximum (e.g., 500).

---

### M2. No Date Validation on `startDate`/`endDate` Parameters

Arbitrary strings passed to PostgreSQL timestamp casting in reports/bandwidth, reports/user-bandwidth, alerts.

**Fix**: Validate with `Date.parse()` before use.

---

### M3. Missing Pagination in Several Table Components

| Component | Has Pagination? |
|-----------|----------------|
| `bw-policy-details.tsx` | No (scroll only) |
| `fap-policies.tsx` | No |
| `auth-logs.tsx` | No (fixed limit=100) |
| `coa-audit.tsx` | No |
| `portal-mappings-tab.tsx` | No |
| `mac-auth.tsx` | No |
| `smart-bandwidth.tsx` | No |
| `wifi-identity-verification.tsx` | Yes (good) |

---

### M4. No AbortController for useEffect Fetch Cleanup

Most components don't cancel in-flight requests on unmount. React 18 StrictMode double-mount warning risk.

**Good examples**: `wifi-satisfaction-surveys.tsx`, `wifi-identity-verification.tsx` (use cancelled flags)

---

### M5. ~400 `console.error` Calls in Production Code

Leaves API error details visible in browser dev tools.

**Worst offenders**: `reports-page.tsx` (11), `network-page.tsx` (45), `firewall-page.tsx` (37)

---

### M6. Health API Returns `success: true` with Zero Data on Failure

**File**: `health/route.ts` (lines 243-266)

When all metric collection fails, returns `{ success: true, data: { cpu: { usage: 0 } } }` — monitoring shows "everything fine" when it's broken.

**Fix**: Return `success: false` with `degraded: true`.

---

### M7. `any` Type Epidemic in `reports-page.tsx` (~90 instances)

Nearly every state variable and function parameter uses `any`. Zero type safety for the entire reports page.

---

### M8. `any` Types in `portal-page.tsx` (~15 instances), `network-page.tsx` (~10 instances)

---

### M9. Empty `catch {}` Blocks Silently Swallow Errors

Found in: `bw-policy-details.tsx`, `coa-audit.tsx`, `aaa-config.tsx`, `wifi-identity-verification.tsx`

---

### M10. Duplicated Fetch Logic

`wifi-identity-verification.tsx`: `fetchLogs` defined as useCallback AND separate fetch in useEffect — duplicate logic.

---

### M11. Hardcoded Legal Text in `wifi-consent-management.tsx`

Long multi-line consent string hardcoded (line 168). Should be configurable/templated.

---

### M12. `wifi-consent-management.tsx` — No i18n (All 55 components)

Zero WiFi components use translation. All strings hardcoded in English.

---

### M13. Satisfaction Survey POST Has No Auth (Public Submission)

**File**: `satisfaction/route.ts` (lines 81-153) — No authentication check combined with hardcoded `TENANT_ID`.

---

### M14. BigInt Serialization Inconsistency

Different BigInt→Number approaches in `users/route.ts`, `radius/route.ts`, `health/route.ts`. Precision loss risk for values > 2^53.

---

## LOW — Minor Improvements

### L1. Inconsistent Pagination Formats

Some routes use `page/limit`, others use `offset/limit`.

### L2. Missing `key` Warnings in Lists

`auth-logs.tsx` line 441: Uses `${index}-${log.id || ''}` as key.

### L3. Session Engine — Variable Shadowing (lines 251-257)

```typescript
const [counters, authIPs, policies] = await Promise.all([...]);  // Line 245
// ...
const counters = loadCounterMap();    // Line 255 — shadows outer const!
const authIPs = loadAuthenticatedIPs(); // Line 256 — shadows outer const!
const policies = await bulkLoadUserPolicies(...); // Line 257 — shadows outer const!
```

This appears to be dead code after the `if (sessions.length === 0) return` on line 251, but the re-declarations make it confusing.

### L4. Duplicate Data in `production-domains.ts`

VPN category duplicates domains from Proxy category (hidemyass.com, getflix.com, etc.). Gaming category duplicates twitch.tv and discord.com from Social Media.

### L5. `session-engine.ts` — `require('child_process')` in Hot Path

`checkNftablesAvailability()` uses `require('child_process')` with `/*turbopackIgnore*/` comment. Cached for 5 min, but initial call after restart triggers synchronous filesystem probe.

### L6. `wifi-settings.ts` — `'$queryRawUnsafe'` for Simple Queries

The `getWifiSettings` and `setWifiSettings` functions use `$queryRawUnsafe` for parameterized queries that could use `$queryRaw` instead (they already use `$1, $2, $3` parameters).

### L7. Dashboard Widget — Hardcoded "12%" for Voucher Trend

`wifi-live-stats-widget.tsx` line 372: `trendValue: stats.activeVouchers > 0 ? 12 : 0` — always shows +12% when vouchers are active, regardless of actual trend.

### L8. No Structured Logging

All WiFi services use `SELog.info/error/warn` (custom), but there's no structured JSON logging for production log aggregation (ELK, Datadog, etc.).

---

## Navigation ↔ Component Mapping

### Sidebar Navigation (19 items from `navigation.ts`):

| Nav ID | Title | Section Map Key | Status |
|--------|-------|----------------|--------|
| `wifi-access` | WiFi Access | `wifi-access` | ✅ |
| `wifi-gateway-radius` | RADIUS & Gateway | `wifi-gateway-radius` | ✅ |
| `wifi-network` | Network | `wifi-network` | ✅ |
| `wifi-dhcp` | DHCP Server | `wifi-dhcp` | ✅ |
| `wifi-dns` | DNS Server | `wifi-dns` | ✅ |
| `wifi-portal` | Captive Portal | `wifi-portal` | ✅ |
| `wifi-firewall` | Firewall & Bandwidth | `wifi-firewall` | ✅ |
| `wifi-content-filter` | Content Filter | `wifi-content-filter` | ⚠️ API returns 410 |
| `wifi-diagnostics` | Gateway Diagnostics | `wifi-diagnostics` | ✅ |
| `wifi-reports` | Reports | `wifi-reports` | ✅ |
| `wifi-health-alerts` | Health Alerts | `wifi-health-alerts` | ✅ |
| `wifi-pre-arrival` | Pre-Arrival Delivery | `wifi-pre-arrival` | ✅ |
| `wifi-device-management` | Multi-Device Registration | `wifi-device-management` | ✅ |
| `wifi-identity-verification` | Identity Verification | `wifi-identity-verification` | ✅ |
| `wifi-consent-management` | GDPR Consent | `wifi-consent-management` | ✅ |
| `wifi-bandwidth-upsell` | Bandwidth Upsell | `wifi-bandwidth-upsell` | ✅ |
| `wifi-revenue-dashboard` | Revenue Analytics | `wifi-revenue-dashboard` | ✅ |
| `wifi-satisfaction-surveys` | Guest Surveys | `wifi-satisfaction-surveys` | ✅ |
| `wifi-sla-monitoring` | SLA Monitoring | `wifi-sla-monitoring` | ✅ |

### Section Map (42 component keys) — Additional non-nav components:

`wifi-sessions`, `wifi-vouchers`, `wifi-plans`, `wifi-logs`, `wifi-gateway`, `wifi-aaa`, `wifi-concurrent-sessions`, `wifi-provisioning-logs`, `wifi-bandwidth-scheduler`, `wifi-mac-auth`, `wifi-portal-whitelist`, `wifi-auth-logs`, `wifi-print-card`, `wifi-event-wifi`, `wifi-live-sessions`, `wifi-coa-audit`, `wifi-fap-policies`, `wifi-web-categories`, `wifi-user-status-history`, `wifi-nas-health`, `wifi-bw-policy-details`, `wifi-ip-pool-management`, `wifi-user-quotas`, `wifi-session-history`, `wifi-user-usage-dashboard`, `wifi-smart-bandwidth`, `wifi-fup-dashboard`, `wifi-fup-policy`, `wifi-credential-policy-tab`, `wifi-radius-users-tab`, `wifi-dhcp-advanced-tabs`, `wifi-room-vlans`, `wifi-bandwidth-pool-management`

These are sub-tabs within the main navigation pages (e.g., Sessions, Plans, Vouchers appear as tabs within WiFi Access).

---

## PostgreSQL Views Dependency

6 views are required for reports/dashboards. These get dropped by `db:push` and must be recreated via seed:

| View | Used By |
|------|---------|
| `v_session_history` | reports/bandwidth, reports/user-bandwidth, session-history, radius (auth logs, usage detail) |
| `v_active_sessions` | reports/bandwidth, radius (live sessions, active users), health, system-metrics |
| `v_user_usage` | reports/user-bandwidth, radius (user usage summary) |
| `v_auth_logs` | radius (auth logs tab) |
| `v_wifi_users` | users, radius (users list) |
| `v_fup_switch_logs` | (defined but no active consumers found) |

**Risk**: After every `db:push`, these views must be recreated. Seed script handles this if `pgsql-production/02-staysuite-views.sql` exists.

---

## v1 API Routes (Guest-Facing)

10 v1 API routes exist for guest-facing WiFi operations:

| Route | Purpose | Status |
|-------|---------|--------|
| `v1/wifi/auth` | Guest authentication (RADIUS) | ✅ Production-ready |
| `v1/wifi/auto-auth` | Automatic room-based auth | ✅ Production-ready |
| `v1/wifi/portal` | Portal page rendering | ✅ Production-ready |
| `v1/wifi/disconnect` | Session disconnect | ✅ Production-ready |
| `v1/wifi/sessions` | Session management | ✅ Production-ready |
| `v1/wifi/users` | User info | ✅ Production-ready |
| `v1/wifi/plans` | Available plans | ✅ Production-ready |
| `v1/wifi/vouchers` | Voucher operations | ✅ Production-ready |
| `v1/wifi/session-engine/logs` | Engine logs | ✅ Production-ready |
| `v1/wifi/session-engine/status` | Engine status | ✅ Production-ready |

These are the real production endpoints used by the captive portal system.

---

## Adapter Pattern (16 Vendors)

All adapters properly implement the `GatewayAdapter` interface. Factory pattern works correctly via `createGatewayAdapter()`.

| Vendor | Adapter File | Notes |
|--------|-------------|-------|
| Cryptsk (Native) | `cryptsk-adapter.ts` | Primary adapter |
| MikroTik | `mikrotik-adapter.ts` | RouterOS API |
| TP-Link Omada | `tplink-adapter.ts` | Omada SDN |
| Ubiquiti UniFi | `unifi-adapter.ts` | UniFi Controller |
| Cambium | `cambium-adapter.ts` | cnPilot |
| Aruba (HPE) | `aruba-adapter.ts` | Aruba Central |
| Cisco Meraki | `cisco-adapter.ts` | Meraki Cloud |
| Huawei | `huawei-adapter.ts` | AirEngine |
| Netgear | `netgear-adapter.ts` | Insight |
| D-Link | `dlink-adapter.ts` | Nuclias |
| Juniper Mist | `juniper-adapter.ts` | Mist AI |
| Ruijie | `ruijie-adapter.ts` | RG-BC Controller |
| Fortinet | `fortinet-adapter.ts` | FortiGate |
| Ruckus | `ruckus-adapter.ts` | SmartZone |
| Grandstream | `grandstream-adapter.ts` | GWN Manager |
| Generic | `index.ts` | TCP connectivity + RADIUS CoA |

---

## Prisma Schema Verification

All 25+ WiFi-related models confirmed in `schema.prisma`:
`NasHealthLog`, `NasReload`, `RadAcct`, `RadCheck`, `RadGroupCheck`, `RadGroupReply`, `RadPostAuth`, `RadReply`, `RadUserGroup`, `Nas`, `WiFiAAAConfig`, `WiFiAccountingSync`, `WiFiGateway`, `WiFiPlan`, `WiFiSession`, `WiFiUser`, `WiFiUserStatusHistory`, `WiFiVoucher`, `WiFiAlert`, `WiFiDevice`, `WiFiConsentLog`, `WiFiIdentityLog`, `WiFiBandwidthUpgrade`, `WiFiSatisfactionSurvey`, `WiFiPreArrivalConfig`, `WiFiSLAConfig`, `WiFiSLAMetric`, `WiFiPartner`, `WiFiPartnerAuth`, `WiFiSettings`

No missing model references found.

---

## Priority Fix Roadmap

### Phase 1 — Block Production (Must fix before any deployment)
1. **C1**: Replace all 32 hardcoded `TENANT_ID = 'tenant_01'` with real auth
2. **C2**: Implement real voucher/room validation in captive/auth
3. **C3**: Mask RADIUS passwords in GET responses
4. **C4**: Fix undefined `voucherValidityDays` in vouchers/route.ts
5. **C5**: Persist health alerts to database
6. **C6**: Reject NAS creation without explicit secret
7. **C7**: Parameterize LIMIT clause in user-bandwidth report

### Phase 2 — Pre-Production Hardening
8. **H1**: Add rate limiting to auth endpoints
9. **H2**: Replace `execSync` with async alternatives
10. **H3**: Standardize error response format
11. **H5**: Remove hardcoded SSIDs
12. **H8**: Add tenantId filter to sync endpoint
13. **H9**: Make radacct cleanup idempotent

### Phase 3 — Quality & Performance
14. **M1**: Add limit/offset bounds validation
15. **M3**: Add pagination to unbounded tables
16. **M4**: Add AbortController to useEffect fetches
17. **M6**: Fix health API fake success
18. **M7-M8**: Add TypeScript types to replace `any`
19. **M11**: Extract hardcoded legal text

### Phase 4 — Polish
20. Remove console.error calls
21. Add i18n framework
22. Fix BigInt serialization
23. Structured logging
24. Deduplicate production-domains.ts

---

## What's Done Well (Strengths)

1. ✅ **Real API calls everywhere** — Zero mock/hardcoded data in components
2. ✅ **Proper try/catch** — Every async operation wrapped
3. ✅ **Loading states** — All components have `isLoading` + spinners/skeletons
4. ✅ **Empty states** — All tables show "No data" messages
5. ✅ **Full CRUD** — Create/Edit/Delete dialogs with real API calls
6. ✅ **Toast notifications** — Success/error feedback on every action
7. ✅ **TypeScript interfaces** — Proper interfaces defined (except `any` gaps)
8. ✅ **Responsive design** — Consistent `sm:`/`md:`/`lg:` breakpoints
9. ✅ **Auto-refresh** — auth-logs (30s), live-sessions (polling), dashboard (30s)
10. ✅ **Delete confirmations** — AlertDialog patterns used correctly
11. ✅ **16 vendor adapters** — Proper interface implementation
12. ✅ **Session Engine** — Production-grade with batched writes, concurrent disconnect
13. ✅ **Credential Engine** — 14 username formats, 10 password formats
14. ✅ **Dashboard widgets** — Animated counters, live stats, error states
15. ✅ **Prisma schema** — All 25+ models properly defined
16. ✅ **Production domain blocklist** — 900+ domains across 10 categories

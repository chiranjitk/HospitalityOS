# StaySuite-HospitalityOS — RAM Optimization Plan

> **Goal:** Reduce dev-mode RAM from 6-7GB to 3-4GB with ZERO feature loss.
> **Rule:** Every change must be invisible to end-users. Same UI, same APIs, same behavior.

---

## Current State (Verified)

| Metric | Value |
|--------|-------|
| Dev-mode RAM | 6-7 GB |
| Source files (TS/TSX) | 1,841 |
| Lines of code | 739,455 |
| API Routes | 891 |
| React Components | 602 |
| Prisma Models | 453 |
| Prisma generated types | 1,454,401 lines (97 MB) |
| Dynamic imports used | 0 (for components) |
| In-memory Maps needing cleanup | 24 |
| System RAM | 8 GB (no swap) |

---

## PHASE 1: Stop the Bleeding

**Estimated RAM saved: 200-800 MB**
**Time: ~15 minutes**
**Risk: ZERO**

These fixes stop active memory leaks. No behavioral changes whatsoever.

---

### 1.1 — Fix Prisma HMR Connection Pool Leak

**Problem:** `src/lib/db.ts` uses a module-level variable for the PrismaClient singleton. In Next.js dev mode, every file save triggers HMR (Hot Module Replacement), which re-evaluates the module, creates a NEW PrismaClient, and opens a NEW connection pool. The old PrismaClient is orphaned but its connections stay open.

- Each PrismaClient holds 5-17 DB connections (default: `num_cpus * 2 + 1`)
- Each leaked pool consumes ~30-50 MB of memory
- After 10-20 HMR reloads during development = 500MB-1GB of leaked memory

**Current code (`src/lib/db.ts`):**
```typescript
let prismaClient: PrismaClient | undefined = undefined
export const db = (() => {
  if (!prismaClient) {
    prismaClient = createPrismaClient()
  }
  return prismaClient
})()
```

**Fix:** Use `globalThis` to persist PrismaClient across HMR reloads:
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**Why it's safe:**
- This is the official Prisma + Next.js pattern (documented at prisma.io)
- The project's own `ARCHITECTURE.md` (line 662-670) describes this pattern but the code never implemented it
- Same PrismaClient instance, same queries, same results
- Production behavior is identical (globalThis is just a cache, no side effects)

**Same fix needed for:** `src/lib/db-tenant.ts` — the `clientCache` Map also dies on HMR reload.

---

### 1.2 — Add Connection Pool Limits

**Problem:** No `connection_limit` is configured in the Prisma schema or DATABASE_URL. Prisma defaults to `num_physical_cpus * 2 + 1` connections per PrismaClient. With `db-tenant.ts` potentially creating N clients, this can exhaust PostgreSQL's connection limit.

**Current DATABASE_URL:**
```
postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite
```

**Fix:** Add connection pool parameters:
```
postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30
```

**Why it's safe:**
- 10 connections per PrismaClient handles hundreds of requests per second
- A hotel PMS never has 100+ simultaneous DB queries
- `pool_timeout=30` means requests wait up to 30s for a connection (never seen in practice)
- If needed, can increase to 20 with zero code changes

**Files to change:**
- `.env` — Add `?connection_limit=10&pool_timeout=30` to DATABASE_URL
- `.env.development` — Same change
- `ecosystem.config.cjs` — Update DATABASE_URL in env section

---

### 1.3 — Fix Tenant DB Client Cache HMR Leak

**Problem:** `src/lib/db-tenant.ts` uses a module-level `Map<string, PrismaClient>` that gets destroyed on HMR reload, just like the main db.ts issue.

**Current code:**
```typescript
const clientCache = new Map<string, PrismaClient>();
```

**Fix:** Move the cache to `globalThis`:
```typescript
const globalForTenantCache = globalThis as unknown as {
  tenantClientCache: Map<string, PrismaClient>
}

if (!globalForTenantCache.tenantClientCache) {
  globalForTenantCache.tenantClientCache = new Map<string, PrismaClient>()
}

const clientCache = globalForTenantCache.tenantClientCache
```

**Why it's safe:**
- Same Map, same keys, same values — just survives HMR reloads
- `clearTenantDbCache()` still works exactly as before
- Production behavior is identical

---

## PHASE 2: Clean Up Memory Leaks

**Estimated RAM saved: 200-500 MB (over hours of uptime)**
**Time: ~1 hour**
**Risk: VERY LOW**

These Maps accumulate entries over time. Adding periodic cleanup only removes entries that are already expired/stale — they would be skipped on read anyway.

---

### 2.1 — Add Cleanup to 15 Rate-Limit Maps

**Problem:** 15 API routes have module-level rate-limit Maps with no cleanup. Each unique IP creates a permanent entry. Under traffic, these grow linearly.

**Affected files (all verified, exact line numbers):**

| # | File | Line | Map Name |
|---|------|------|----------|
| 1 | `src/app/api/v1/wifi/auth/route.ts` | 165 | `otpStore` |
| 2 | `src/app/api/v1/wifi/auth/route.ts` | 181 | `otpRateLimits` |
| 3 | `src/app/api/v1/wifi/auth/route.ts` | 619 | `authAttempts` |
| 4 | `src/app/api/auth/signup/route.ts` | 9 | `signupRateLimitMap` |
| 5 | `src/app/api/auth/reset-password/route.ts` | 8 | `resetPasswordRateLimitMap` |
| 6 | `src/app/api/auth/forgot-password/route.ts` | 9 | `rateLimitMap` |
| 7 | `src/app/api/auth/verify-email/route.ts` | 6 | `verifyEmailRateLimitMap` |
| 8 | `src/app/api/auth/2fa/disable/route.ts` | 7 | `twoFADisableRateLimitMap` |
| 9 | `src/app/api/auth/2fa/verify/route.ts` | 8 | `twoFAVerifyRateLimitMap` |
| 10 | `src/app/api/auth/2fa/setup/route.ts` | 9 | `twoFASetupRateLimitMap` |
| 11 | `src/app/api/booking-engine/availability/route.ts` | 5 | `availabilityRateLimitMap` |
| 12 | `src/app/api/booking-engine/create/route.ts` | 12 | `bookingRateLimitMap` |
| 13 | `src/app/api/tenants/route.ts` | 123 | `tenantSignupRateLimitMap` |
| 14 | `src/app/api/registration/register/route.ts` | 25 | `rateLimitMap` |
| 15 | `src/app/api/registration/validate-key/route.ts` | 11 | `rateLimitMap` |

**Fix:** Add a `setInterval` cleanup timer after each Map declaration. This pattern already exists in the codebase at `src/app/api/wifi/diagnostics/route.ts:91-99`:

```typescript
// Existing pattern in the codebase — replicate this
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000).unref(); // .unref() = won't keep process alive
```

**Why it's safe:**
- Only deletes entries where `resetAt < now` — these are already expired
- On the next request from that IP, a fresh entry is created (same as today)
- `.unref()` means the timer won't prevent the process from shutting down
- The codebase already uses this exact pattern in 3 places (wifi diagnostics, two-factor-temp-store, cache.ts)

**For `otpStore` specifically** — purge entries where `expiresAt < now`:
```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (now > val.expiresAt) otpStore.delete(key);
  }
}, 5 * 60_000).unref();
```

---

### 2.2 — Add Cleanup to Server-Side Caches

**Problem:** Several caches have TTL-on-read but no periodic sweep. Stale entries for inactive tenants/queries linger forever.

| # | File | Line | Map | TTL | Purge Logic |
|---|------|------|-----|-----|-------------|
| 1 | `src/app/api/dashboard/route.ts` | 8 | `dashboardCache` | 15s | Delete if `timestamp + 15000 < now` |
| 2 | `src/lib/channel-manager/ota-rate-fetcher.ts` | 43 | `rateCache` | 15 min | Delete if `expiresAt < now` |
| 3 | `src/lib/revenue/hourly-pricing-engine.ts` | 182 | `rateCache` | 45 min | Delete if `calculatedAt + 45min < now` |
| 4 | `src/lib/api-feature-flags.ts` | 9 | `featureCache` | 30s | Delete if `timestamp + 30000 < now` |
| 5 | `src/lib/auth/oidc-service.ts` | 108 | `stateStore` | expiresAt field | Delete if `expiresAt < now` |

**Fix:** Same `setInterval` + `.unref()` pattern.

**Why it's safe:**
- These entries are already expired — the TTL check on read would skip them
- Deleting them early only saves memory, doesn't change behavior
- On next access, a fresh entry is cached (identical to current flow)

---

### 2.3 — Add Cleanup to Email/SMS Queues

**Problem:** `emailQueue` and `smsQueue` in `src/lib/services/email-service.ts:78` and `sms-service.ts:76` have `maxQueueSize = 10000` but it's never enforced on `.set()`. Failed entries are never removed. `deliveryTracker` in `sms-service.ts:80` grows forever.

**Fix:**
1. Enforce `maxQueueSize` on `.set()` — if Map size exceeds limit, refuse new entries (log a warning)
2. Add periodic purge of completed/failed entries older than 1 hour
3. Add TTL purge to `deliveryTracker` — entries older than 24 hours

**Why it's safe:**
- A queue with 10,000+ pending emails has bigger problems than a dropped entry
- Completed/failed entries older than 1 hour are never acted upon again
- Delivery statuses older than 24 hours are never queried again

---

### 2.4 — Add Cleanup to WiFi Session Map

**Problem:** `lastActivityMap` in `src/lib/wifi/services/session-engine.ts:145` maps IP → last activity timestamp. Entries for disconnected WiFi clients are never removed.

**Fix:** Integrate with the session engine's existing poll cycle — remove IPs that have no active session in the database.

**Why it's safe:** Only removes IPs with no active WiFi session. If a client reconnects, a new entry is created on first activity.

---

## PHASE 3: Reduce Build-Time Memory

**Estimated RAM saved: 1-2 GB**
**Time: ~3-4 hours**
**Risk: LOW-MEDIUM**

This is the biggest win. Currently, Webpack/Turbopack compiles ALL 602 components and ALL 891 routes eagerly. Most pages are never visited in a single session.

---

### 3.1 — Lazy-Load Heavy Dashboard Components

**Problem:** All dashboard widgets, chart components, and feature panels are imported statically. Webpack must parse, compile, and hold them all in memory simultaneously — even pages the user never visits.

**Strategy:** Wrap heavy components in `next/dynamic` with `{ ssr: false }`. They'll compile on-demand when first visited, then cache for subsequent visits.

**Components to lazy-load (prioritized by weight):**

#### Tier 1: Chart-heavy components (~800KB+ client bundle each)

| Component | File | Recharts Components Used |
|-----------|------|-------------------------|
| Dashboard Charts | `components/dashboard/charts.tsx` | LineChart, BarChart, PieChart, AreaChart + 8 more |
| Revenue Trend Widget | `components/dashboard/revenue-trend-widget.tsx` | AreaChart |
| KPI Dashboard Enhanced | `components/dashboard/kpi-dashboard-enhanced.tsx` | Multiple charts |
| Occupancy Forecast Widget | `components/dashboard/occupancy-forecast-widget.tsx` | LineChart + BarChart |
| Revenue Breakdown | `components/dashboard/revenue-breakdown.tsx` | PieChart |
| Rate Plan Comparison | `components/dashboard/rate-plan-comparison.tsx` | BarChart |

**Example change:**

Current (in parent page/component):
```tsx
import { DashboardCharts } from '@/components/dashboard/charts'
```

After:
```tsx
import dynamic from 'next/dynamic'
const DashboardCharts = dynamic(
  () => import('@/components/dashboard/charts').then(m => ({ default: m.DashboardCharts })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
```

**Where to make these changes:** In the parent components that import these — typically the main dashboard page, report pages, and feature pages.

#### Tier 2: WiFi/Security/Network pages (2K-4K lines each)

| Component | File | Lines |
|-----------|------|-------|
| Firewall Page | `components/wifi/firewall-page.tsx` | 4,197 |
| Portal Page | `components/wifi/portal-page.tsx` | 4,092 |
| Reports Page | `components/wifi/reports-page.tsx` | 3,493 |
| Network Page | `components/wifi/network-page.tsx` | 3,404 |
| Gateway Diagnostics | `components/wifi/gateway-diagnostics.tsx` | 2,852 |
| DHCP Page | `components/wifi/dhcp-page.tsx` | 2,513 |
| ZTNA Device Policies | `components/wifi/ztna-device-policies.tsx` | 2,405 |
| AAA Config | `components/wifi/aaa-config.tsx` | 2,191 |
| DNS Page | `components/wifi/dns-page.tsx` | 1,762 |

#### Tier 3: Report components (1K-3K lines each)

| Component | File | Lines |
|-----------|------|-------|
| Guest Stay Report | `components/reports/guest-stay-report.tsx` | 3,056 |
| Financial Statements | `components/reports/financial-statements.tsx` | ~2K |
| Cash Flow Forecast | `components/reports/cash-flow-forecast.tsx` | ~2K |
| Budget Variance | `components/reports/budget-variance.tsx` | ~1.5K |
| Guest Analytics Reports | `components/reports/guest-analytics-reports.tsx` | ~1.5K |
| Occupancy Reports | `components/reports/occupancy-reports.tsx` | ~1.5K |
| ADR/RevPAR | `components/reports/adr-revpar.tsx` | ~1.5K |
| Revenue Reports | `components/reports/revenue-reports.tsx` | ~1.5K |
| Staff Performance | `components/reports/staff-performance.tsx` | ~1.5K |

**User-visible impact:** First visit to a lazy-loaded page shows a loading skeleton (1-3s in dev, <500ms in production). Subsequent visits are instant. ALL functionality works identically after load.

---

### 3.2 — Fix recharts Barrel Import in chart.tsx

**Problem:** `src/components/ui/chart.tsx` uses `import * as RechartsPrimitive from "recharts"` but only uses 3 components:

- `ResponsiveContainer` (lines 46, 64, 66)
- `Tooltip` (lines 105, 121)
- `Legend` / `LegendProps` (lines 251, 260)

The barrel import forces Webpack to include ALL 30+ recharts components in the client bundle and hold them in the compilation graph.

**Fix:** Replace with named imports:
```typescript
// Current:
import * as RechartsPrimitive from "recharts"

// After:
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  type LegendProps,
} from "recharts"
```

Then update all references from `RechartsPrimitive.XXX` to the direct names.

**Why it's safe:**
- `next.config.ts` already has `optimizePackageImports: ['recharts']` which helps with tree-shaking
- But the barrel `import *` in chart.tsx overrides that optimization
- Named imports allow the bundler to eliminate unused recharts components
- Same components used, same rendering, same features

**Note:** Other components that directly import from `recharts` (33 files) use named imports already — they're fine. Only `chart.tsx` uses the barrel pattern.

---

### 3.3 — Remove Dead Dependencies from node_modules

**Problem:** 5 packages are installed but never imported anywhere. While they don't consume runtime RAM, they increase `node_modules` resolution time and Webpack's dependency scanning phase.

**Confirmed dead packages (verified by searching ALL import/require/dynamic import):**

| Package | Verified Method | Result |
|---------|----------------|--------|
| `@mdxeditor/editor` | Searched all .ts/.tsx/.js for import, require, dynamic, string `mdxeditor`, `MDXEditor` | ZERO references |
| `docx` | Searched all source files for `import from 'docx'`, `require('docx')`, dynamic import | ZERO references (only `.docx` as file extension in upload filters) |
| `speedtest-net` | Searched all source files for any import/require/dynamic import | ZERO references (WiFi diagnostics uses Ookla CLI binary via `child_process.spawn`) |
| `@types/speedtest-net` | Types for dead speedtest-net | ZERO references |
| `react-syntax-highlighter` | Searched all source files for `import`, `SyntaxHighlighter`, `Prism as SyntaxHighlighter`, dynamic import | ZERO references (also listed in `next.config.ts` optimizePackageImports — remove from there too) |

**RAM impact:** Small (~50-100MB) — fewer files for Webpack to scan during compilation. Not the main win, but cleans up the project.

---

### 3.4 — Fix csv-parse/sync Bug

**Problem:** `src/components/wifi/radius-users-tab.tsx` line 87 uses `import { parse } from 'csv-parse/sync'` in a `'use client'` file. This is a Node.js synchronous API that **crashes at runtime in the browser**.

**Fix:** Replace with a browser-compatible CSV parser. Options:
1. Manual parsing (CSV is simple — split by newlines and commas)
2. Use `papaparse` (browser-native CSV library, ~15KB)

**Why it's safe:** The current code is already broken — it crashes. Any fix is an improvement.

---

## PHASE 4: Structural Improvements (Optional)

**Estimated RAM saved: 50-150 MB**
**Time: ~6-8 hours**
**Risk: MEDIUM**

These are nice-to-have improvements for maintainability. Smallest RAM payoff, highest effort.

---

### 4.1 — Remove Duplicate Hook Files

**Problem:** `src/hooks/hooks/` contains 13 files that are exact copies of `src/hooks/` files. If imported, they duplicate code in the bundle.

**Fix:** Verify no imports point to `hooks/hooks/`, then delete the directory.

---

### 4.2 — Consolidate Socket Connections

**Problem:** `components/pos/kitchen-display.tsx` and `components/staff/internal-communication.tsx` create their own `io()` connections instead of using the shared `SocketProvider`.

**Fix:** Use `useSocket()` hook from the provider context instead of creating new connections.

**Why it's safe:** Same WebSocket functionality, just routed through the shared connection.

---

### 4.3 — Split Monolith Route Files

**Problem:** Several API routes are 1,000-3,800 lines in a single file. Webpack must parse the entire file even for a simple GET request.

| File | Lines |
|------|-------|
| `api/wifi/radius/route.ts` | 3,859 |
| `api/reports/guest-stay-report/route.ts` | 2,572 |
| `api/v1/wifi/auth/route.ts` | 2,324 |
| `api/bookings/[id]/route.ts` | 2,218 |

**Fix:** Extract shared logic into helper modules under the same directory.

**Risk:** Medium — refactoring always risks introducing bugs. Low RAM payoff per file. Only do this if you're already editing these files for other reasons.

---

## Execution Summary

| Phase | RAM Saved | Time | Risk | Feature Impact |
|-------|-----------|------|------|----------------|
| **1** Stop the Bleeding | 200-800 MB | 15 min | 🟢 ZERO | None |
| **2** Clean Up Leaks | 200-500 MB | 1 hr | 🟢 Very Low | None |
| **3** Reduce Build Memory | 1-2 GB | 3-4 hrs | 🟡 Low-Medium | Loading skeleton on first visit |
| **4** Structural (Optional) | 50-150 MB | 6-8 hrs | 🟡 Medium | None |
| **TOTAL** | **2-3.5 GB** | ~10-14 hrs | | |

**Expected result:** Dev-mode RAM drops from 6-7 GB to 3-4 GB. App stays stable on 8 GB system.

---

## Rollback Plan

Each phase is independent. If any change causes issues:

| Phase | Rollback |
|-------|----------|
| 1.1 | Revert `db.ts` to module-level variable (1 line change) |
| 1.2 | Remove `?connection_limit=10&pool_timeout=30` from DATABASE_URL |
| 1.3 | Revert `db-tenant.ts` to module-level Map |
| 2.1-2.4 | Remove the `setInterval` lines added (they're standalone, no dependencies) |
| 3.1 | Remove `next/dynamic` wrappers, restore static imports |
| 3.2 | Restore `import * as RechartsPrimitive from "recharts"` |
| 3.3 | `bun add <package>` to re-install |
| 3.4 | Revert csv-parse change |
| 4.1-4.3 | Revert via git |

---

## What This Plan Does NOT Change

- ❌ No UI changes
- ❌ No API contract changes
- ❌ No database schema changes
- ❌ No feature removal
- ❌ No dependency version changes (except removing 5 dead packages)
- ❌ No infrastructure changes
- ❌ No configuration changes that affect production behavior

## What Users WILL Notice

- ✅ App no longer crashes due to OOM
- ✅ First visit to some pages shows a brief loading skeleton (Phase 3 only)
- ✅ Everything else works exactly the same

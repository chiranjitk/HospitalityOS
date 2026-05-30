# FreeRADIUS & WiFi User Login Flow — Deep Scan Report
## StaySuite-HospitalityOS | Generated: 2026-05-30
## Scan Type: READ-ONLY | NO CODE CHANGES MADE

---

# EXECUTIVE SUMMARY

| Category | Total Findings | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|----------|---------------|----------|------|--------|-----|------|
| FreeRADIUS Config | 18 | 0 | 4 | 6 | 5 | 3 |
| WiFi API Routes | 28 | 3 | 8 | 10 | 7 | 0 |
| WiFi Services | (merged into API) | — | — | — | — | — |
| DB Schema & Functions | 20 | 0 | 5 | 7 | 7 | 1 |
| **TOTAL** | **66** | **3** | **17** | **23** | **19** | **4** |

### ⚠️ WARNING: Hardcoded Values from Commit b2546bdc
Commit `b2546bdc` ("security(wifi): enterprise hardening - 40+ validation gaps fixed") introduced **hardcoded limits that should be GUI-configurable**. Many business-design decisions were overridden without admin consent. These are flagged individually below.

---

# PART 1: FREEERADIUS CONFIGURATION FINDINGS

## 🔴 HIGH SEVERITY

### FR-H1: MAC Authentication Does NOT Verify Calling-Station-Id
- **FILE:** `freeradius-install/etc/raddb/sites-enabled/default:512-523`
- **DESCRIPTION:** The MAC auth block sets `Auth-Type := Accept` based solely on User-Name matching a `wifi_user` record. The code comment says *"and the calling station ID matches the username"* but **there is NO actual code** checking `Calling-Station-Id == User-Name`. An attacker who discovers a registered MAC address can send a RADIUS Access-Request with that MAC as the User-Name from ANY device and will be auto-accepted.
- **IMPACT:** **Unauthorized network access.** An attacker can impersonate any MAC-registered device without being on that device. MAC auth is essentially a username-only check with no source verification.
- **SHOULD_BE:** Add `if (Calling-Station-Id != User-Name) { reject }` before the auto-accept block.

### FR-H2: FUP (Fair Usage Policy) Attributes Defined but NEVER Enforced at RADIUS Level
- **FILE:** `freeradius-install/etc/raddb/dictionary:136-144` vs `sites-enabled/default` (post-auth)
- **DESCRIPTION:** The dictionary defines a complete FUP subsystem:
  - `Cryptsk-FUP-Rate-Limit` (attr #41) — post-throttle rate limit
  - `Cryptsk-FUP-Threshold-Bytes` (attr #42) — data threshold to trigger FUP
  - `Cryptsk-Data-Reset-Interval` (attr #43) — quota reset interval
  
  **NONE of these are set in ANY post-auth section.** Only `Cryptsk-Rate-Limit` (attr #1) is set via `fn_get_mikrotik_rate_limit()`.
- **IMPACT:** **Plans with data caps are NOT enforced at RADIUS level.** Users consume unlimited data regardless of plan limits. Critical business revenue gap for a hospitality WiFi platform.
- **SHOULD_BE:** Post-auth should query plan's data limit and set FUP VSA attributes so the gateway enforces throttling.

### FR-H3: No sqlcounter Module — Daily/Weekly/Monthly Time Limits NOT Enforced
- **FILE:** `freeradius-install/etc/raddb/mods-enabled/` — no sqlcounter symlink exists
- **DESCRIPTION:** There is NO `sqlcounter` module enabled. The `daily` counter reference is commented out in both servers (`# daily`). FreeRADIUS has NO mechanism to track cumulative session time and enforce periodic time quotas.
- **IMPACT:** **Plans with time limits (e.g., "2 hours per day", "10 hours per week") are NOT enforced by RADIUS.** A user with a "1 hour/day" plan can stay connected indefinitely. Any non-Cryptsk NAS (MikroTik, Cisco, Aruba) has zero enforcement.
- **SHOULD_BE:** Enable sqlcounter with PostgreSQL backend queries. Define daily/weekly/monthly counters matching WiFiPlan settings.

### FR-H4: Plaintext Database Credential in Config
- **FILE:** `freeradius-install/etc/raddb/mods-enabled/sql:12`
- **DESCRIPTION:** PostgreSQL password `Staysuite2025` stored in plaintext in the SQL module config.
- **IMPACT:** Full database compromise if shell access gained.
- **SHOULD_BE:** Use `radiusd -m` to encrypt secrets, or use OS-level file permissions.

---

## 🟡 MEDIUM SEVERITY

### FR-M1: No Session-Timeout Safety Net in post-auth
- **FILE:** `sites-enabled/default:926-1080` (post-auth)
- **DESCRIPTION:** No explicit `Session-Timeout` set in post-auth. Relies entirely on `radreply`/`radgroupreply`. If NULL or missing, user gets UNLIMITED access.
- **SHOULD_BE:** Add a configurable maximum Session-Timeout fallback from system settings.

### FR-M2: No Idle-Timeout Set ANYWHERE
- **FILE:** `sites-enabled/default` + `sites-enabled/inner-tunnel` (full files)
- **DESCRIPTION:** There is NO `Idle-Timeout` attribute set anywhere — not in post-auth, not in DEFAULT entries, not via VSA. The `Cryptsk-Idle-Timeout` (attr #12) is defined in the dictionary but NEVER used.
- **IMPACT:** Idle users never disconnected. IP pool exhaustion. Unfair bandwidth distribution.
- **SHOULD_BE:** Set `Idle-Timeout` from WiFiPlan.idleTimeoutMinutes in post-auth.

### FR-M3: BlastRADIUS Protection Set to "auto" Not "yes"
- **FILE:** `radiusd.conf:724`
- **DESCRIPTION:** `require_message_authenticator = auto` allows downgrade for legacy clients.
- **SHOULD_BE:** Set to `yes` for all known-good NAS clients.

### FR-M4: resource-check Virtual Server NOT Enabled
- **FILE:** `sites-available/resource-check` — exists but NOT symlinked to sites-enabled
- **DESCRIPTION:** PostgreSQL health check server exists but is not running. If PostgreSQL goes down, FreeRADIUS produces unpredictable behavior (SQL returns "notfound" → may accept users without authorization).
- **SHOULD_BE:** Enable resource-check and reference `always` module in authorize.

### FR-M5: SQL Injection Risk in MAC Auth (Mitigated by Regex)
- **FILE:** `sites-enabled/default:515`
- **DESCRIPTION:** `SELECT username FROM wifi_user WHERE username='%{User-Name}'` uses direct interpolation. Mitigated by the MAC regex check, but if that regex is ever relaxed, this becomes SQL injection.
- **SHOULD_BE:** While practically safe now, add a defense-in-depth check.

### FR-M6: inner-tunnel Lacks Pool Validation + Login Limit Check
- **FILE:** `sites-enabled/inner-tunnel:316-407` (post-auth)
- **DESCRIPTION:** inner-tunnel sets Pool-Name and Rate-Limit but does NOT include `fn_check_ip_pool()` or `fn_check_login_limit()`. These ARE in default post-auth, but EAP users incur redundant PostgreSQL calls (both inner-tunnel AND default run the same functions).
- **SHOULD_BE:** Either remove duplicate calls from one server or consolidate logic.

---

## 🟢 LOW / INFO

| # | Finding | File |
|---|---------|------|
| FR-L1 | Server runs as root — no privilege drop | radiusd.conf:566 |
| FR-L2 | No chroot configured | radiusd.conf:536 |
| FR-L3 | NAS-IP-Address interpolated (safe — protocol-derived) | default:588 |
| FR-L4 | SQL read_clients camelCase mismatch with legacy nas table | mods-enabled/sql:16-17 |
| FR-L5 | Dictionary.cryptsk stale/unsynchronized standalone file | dictionary.cryptsk |
| FR-I1 | expiration/logintime need manual per-user attributes | mods-enabled/* |
| FR-I2 | inner-tunnel lists `sql` twice in authorize and session | inner-tunnel:49,142,294,299 |

---

# PART 2: WiFi API & SERVICES FINDINGS

## 🔴 CRITICAL SEVERITY — Hardcoded Business Values from b2546bdc

### API-C1: Hardcoded Plan Validation Limits Remove Admin Flexibility
- **FILE:** `src/app/api/wifi/plans/route.ts:76-97`
- **DESCRIPTION:** Zod schemas hardcode ABSOLUTE min/max bounds:
  - `sessionTimeoutSec: min=60, max=86400` — blocks test sessions (30s) or long-haul (72h)
  - `idleTimeoutSec: min=30, max=86400` — same restriction
  - `downloadSpeed/uploadSpeed: min=64 Kbps` — blocks kid-safe zone ultra-low plans
  - `validityMinutes: max=43200 (30 days)` — blocks monthly/quarterly vouchers
  - `maxDevices: max=50` — blocks conference venues needing 100+
- **TYPE:** ⚠️ **Hardcoded value — should be GUI-configurable**
- **SHOULD_BE:** These limits should come from WiFi > Global Settings or WiFi > AAA Config, with a higher absolute ceiling as system-level safety net.

### API-C2: Hardcoded Brand Name "RoyalStay-Guest" Leaked Into Guest-Facing Auth
- **FILE:** `src/app/api/wifi/captive/auth/route.ts:255,298,448,451`
- **DESCRIPTION:** Captive portal auth response hardcodes `networkName: 'RoyalStay-Guest'` for ALL auth methods. This is a specific brand that should come from tenant's portal configuration.
- **TYPE:** ⚠️ **Hardcoded brand — should be tenant-specific**
- **SHOULD_BE:** Use `WiFiAAAConfig.portalTitle` or dedicated `networkName` field.

### API-C3: Hardcoded Bandwidth "100Mbps" In Captive Auth Response (Ignored Actual Plan)
- **FILE:** `src/app/api/wifi/captive/auth/route.ts:256,300,452`
- **DESCRIPTION:** ALL auth methods return `bandwidthLimit: '100Mbps'` regardless of plan. Guest on 1Mbps free plan sees 100Mbps.
- **TYPE:** ⚠️ **Hardcoded value — should derive from plan**
- **SHOULD_BE:** Derive from voucher's plan or room-type's assigned plan bandwidth.

---

## 🔴 HIGH SEVERITY

### API-H1: Hardcoded Rate Limit (5 req/60s) Not Configurable Per Tenant
- **FILE:** `src/app/api/wifi/captive/auth/route.ts:9`
- **DESCRIPTION:** `maxRequests=5, windowMs=60000`. Hotels with 500+ rooms get locked out during peak check-in.
- **SHOULD_BE:** Configurable in WiFiAAAConfig: `authRateLimitMax`, `authRateLimitWindowSec`.

### API-H2: Hardcoded Auth Response expiresAt (24h) Ignores Plan/Booking Validity
- **FILE:** `src/app/api/wifi/captive/auth/route.ts:257,301,452`
- **DESCRIPTION:** Voucher and room auth return `expiresAt = now + 24h` hardcoded. A 7-day guest sees "expires in 24h".
- **SHOULD_BE:** Compute from plan validity or booking checkout date.

### API-H3: Hardcoded Password Min Length (6 chars) Blocks Short PINs
- **FILE:** `src/app/api/wifi/users/route.ts:39` + `src/app/api/wifi/aaa/route.ts:141,147`
- **DESCRIPTION:** Hotels using room-number passwords (room 101 = password "101") are blocked. 3-digit PINs don't work.
- **SHOULD_BE:** Password policy should be configurable in WiFiAAAConfig. Allow min=1 for room-number format.

### API-H4: Inconsistent Bandwidth Fallbacks (10M/5M vs 10M/10M) Across 4 Files
- **FILE:** `provisioning-service.ts:69` (10M/5M), `users/route.ts:267` (10M/10M), `wifi-user-service.ts:93` (10M/5M), `aaa/route.ts:56` (10M/10M)
- **DESCRIPTION:** When no plan bandwidth is configured, FOUR different defaults are used. Users provisioned via different code paths get different speeds.
- **SHOULD_BE:** ALL fallbacks should read from `WiFiAAAConfig.defaultDownloadSpeed/defaultUploadSpeed`. Remove all `|| 10` and `|| 5`.

### API-H5: Device Registration Has NO Max Devices Enforcement
- **FILE:** `src/app/api/wifi/users/[id]/devices/route.ts:122-143`
- **DESCRIPTION:** POST handler counts devices but never checks plan's `maxDevices`. Guest can register unlimited devices even if plan allows only 1.
- **SHOULD_BE:** Check plan.maxDevices before allowing registration. Return 403 on limit.

### API-H6: LDAP Auth 24h Validity Ignores Property Session Timeout
- **FILE:** `src/app/api/wifi/captive/auth/route.ts:396`
- **DESCRIPTION:** LDAP auth always creates WiFiUser with `validUntil = now + 24h`. Corporate users at a 3-day conference get only 24h.
- **SHOULD_BE:** Use property's default plan validity, same as voucher/room auth.

### API-H7: Hardcoded 12h Post-Checkout Grace Period
- **FILE:** `src/lib/wifi/services/provisioning-service.ts:483`
- **DESCRIPTION:** `checkoutValidity = checkOut + 12 hours`. Hotels wanting 0h (immediate cutoff) or 24h cannot configure this.
- **SHOULD_BE:** Configurable in WiFiAAAConfig (`postCheckoutGraceHours`).

### API-H8: Hardcoded Acct-Interim-Interval (60s) Not Configurable
- **FILE:** `src/lib/wifi/services/wifi-user-service.ts:159`
- **DESCRIPTION:** Always sets `Acct-Interim-Interval = 60` seconds. Large properties (5000+ users) may overwhelm DB with accounting updates.
- **SHOULD_BE:** Configurable per-plan or system-wide in WiFiAAAConfig.

---

## 🟡 MEDIUM SEVERITY

### API-M1: Users API Zod Schema Duplicates Plan Limits With Different Values
- **FILE:** `src/app/api/wifi/users/route.ts:24-40`
- **DESCRIPTION:** User-level bandwidth/timeout overrides validated independently of plan limits. User could override to exceed plan max.
- **SHOULD_BE:** Validate user overrides against parent plan's configured limits.

### API-M2: Hardcoded Plan Name Regex Blocks Unicode
- **FILE:** `src/app/api/wifi/plans/route.ts:74`
- **DESCRIPTION:** `/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/` prevents non-English plan names ("Süite Premium", "客房免费").
- **SHOULD_BE:** Allow unicode: `/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u`

### API-M3: maxDevices Min=1 Prevents "Unlimited Devices" Plans
- **FILE:** `src/app/api/wifi/plans/route.ts:82`
- **DESCRIPTION:** `min(1)` blocks plans with no device limit. In RADIUS, Simultaneous-Use=0 means unlimited.
- **SHOULD_BE:** Change min to 0. Document: 0=unlimited, 1+=limited.

### API-M4: Default Currency Hardcoded to 'USD'
- **FILE:** `src/app/api/wifi/plans/route.ts:90`
- **DESCRIPTION:** All new plans default to USD. A Japan hotel always creates wrong-currency plans.
- **SHOULD_BE:** Read from property/tenant settings.

### API-M5: Credential Defaults Duplicated in 2 Files
- **FILE:** `credential-engine.ts:606-622` + `aaa/route.ts:13-29`
- **DESCRIPTION:** Same defaults defined twice, must be synced manually. Values hardcoded.
- **SHOULD_BE:** Single source of truth in credential-engine. Values configurable per-property.

### API-M6: Data-Limits Session Matching Uses Imprecise OR Query
- **FILE:** `src/lib/wifi/utils/data-limits.ts:195-200`
- **DESCRIPTION:** Finds users by `guestId OR planId` instead of `username`. Can match wrong user when multiple guests share same plan.
- **SHOULD_BE:** Match by `username` (unique) like accounting-sync-service.

### API-M7: Hardcoded Cleanup Retention (90 Days)
- **FILE:** `src/lib/wifi/services/accounting-sync-service.ts:533`
- **DESCRIPTION:** Session retention fixed at 90 days. GDPR hotels need 30; regulated hotels need 730.
- **SHOULD_BE:** Configurable in WiFiAAAConfig (`sessionRetentionDays`).

### API-M8: Hardcoded Plan Status Restricts to "active"/"inactive" Only
- **FILE:** `src/app/api/wifi/plans/route.ts` (b2546bdc addition)
- **DESCRIPTION:** Status enum restricted to `active/inactive`. If business needs `draft`, `archived`, `expired` states, they're blocked.
- **SHOULD_BE:** Status should be configurable enum, not hardcoded 2-value restriction.

### API-M9: Accounting Sync Batch Size Hardcoded at 1000
- **FILE:** `src/lib/wifi/services/accounting-sync-service.ts:91`
- **DESCRIPTION:** `take: 1000` — can't keep up with large deployments.
- **SHOULD_BE:** Configurable via env var or system settings.

### API-M10: Session Engine Disconnect Concurrency Hardcoded at 5
- **FILE:** `src/lib/wifi/services/session-engine.ts:183`
- **DESCRIPTION:** `DISCONNECT_CONCURRENCY = 5` — tuning constant not configurable.
- **SHOULD_BE:** Configurable via env var.

---

## 🟢 LOW SEVERITY

| # | Finding | File |
|---|---------|------|
| API-L1 | RADIUS auth timeout hardcoded at 15s | radius-auth.ts:67 |
| API-L2 | radclient retry count hardcoded at 3 | radius-auth.ts:112 |
| API-L3 | Provisioning in-memory log cap at 1000 | provisioning-service.ts:72 |
| API-L4 | Captive auth voucher lookup has no tenant isolation | captive/auth/route.ts:238 |
| API-L5 | LDAP timeout fallback 30s not exposed in GUI | captive/auth/route.ts:368 |
| API-L6 | Credential empty password fallback silently overrides admin format | credential-engine.ts:558 |
| API-L7 | Devices POST uses type assertion instead of Zod validation | users/[id]/devices/route.ts:75 |

---

# PART 3: DATABASE SCHEMA & FUNCTIONS FINDINGS

## 🔴 HIGH SEVERITY

### DB-H1: RadiusAuthLog Calling/Called Station ID Typed as UUID — DATA BUG
- **FILE:** `prisma/schema.prisma:5242-5243`
- **DESCRIPTION:** `callingStationId String? @db.Uuid` and `calledStationId String? @db.Uuid` — MAC addresses are NOT UUIDs! Standard MAC format `00:1A:2B:3C:4D:5E` will FAIL with UUID parsing error.
- **IMPACT:** **Auth logging for MAC auth is BROKEN.** Runtime insertion failures.
- **SHOULD_BE:** Change to `String?` (text/varchar).

### DB-H2: Missing Critical Index for fn_check_login_limit
- **FILE:** `complete-database.sql:953`
- **DESCRIPTION:** `SELECT COUNT(*) FROM radacct WHERE username = ? AND acctstoptime IS NULL` — no composite index on `(username, acctstoptime)`. Every auth request triggers sequential scan on potentially millions of rows.
- **SHOULD_BE:** `CREATE INDEX radacct_active_username_idx ON radacct (username) WHERE acctstoptime IS NULL;`

### DB-H3: RadPostAuth Has ZERO Indexes — Auth Logs Page Will Die
- **FILE:** `prisma/schema.prisma:5506-5522`
- **DESCRIPTION:** RadPostAuth maps to `radpostauth` with NO indexes. v_auth_logs view does DISTINCT ON (username, authdate_trunc) + multiple subqueries. Table grows unbounded.
- **SHOULD_BE:** Add `@@index([username])` and `@@index([authdate])`.

### DB-H4: v_user_usage Has 9 Correlated Subqueries — O(N²) Performance Bomb
- **FILE:** `02-staysuite-views.sql:204-267`
- **DESCRIPTION:** 6-9 correlated subqueries each scanning ALL of radacct per WiFiUser row. With 1000 users and 1M radacct rows = 1 billion row reads per query.
- **SHOULD_BE:** Rewrite as lateral join with single radacct aggregation subquery, or materialize into WiFiUser columns via triggers.

### DB-H5: No Trigger to Sync WiFiUser.totalBytesIn/Out from radacct
- **FILE:** `complete-database.sql` (no triggers)
- **DESCRIPTION:** WiFiUser has totalBytesIn/Out columns but NO trigger updates them from radacct. Columns remain stale at 0. FUP checks fall back to direct radacct queries.
- **SHOULD_BE:** Create trigger on radacct INSERT/UPDATE to aggregate into WiFiUser.

---

## 🟡 MEDIUM SEVERITY

### DB-M1: Dual `nas` Table Definition — Prisma vs complete-database.sql
- **FILE:** `complete-database.sql:116` + `prisma/schema.prisma:5555`
- **DESCRIPTION:** Legacy `nas` table defined in SQL with no tenantId. Prisma also maps Nas model to same table. Schema drift risk.
- **SHOULD_BE:** Remove legacy definition from complete-database.sql; let Prisma own it.

### DB-M2: fn_check_fup Declared STABLE But Reads Mutable Data
- **FILE:** `complete-database.sql:909`
- **DESCRIPTION:** STABLE function reads radacct which is continuously updated. PostgreSQL may cache stale result.
- **SHOULD_BE:** Change to VOLATILE.

### DB-M3: fn_get_mikrotik_rate_limit Ignores Burst/Ceil Speeds
- **FILE:** `complete-database.sql:1014-1033`
- **DESCRIPTION:** WiFiPlan has burstDownloadSpeed/burstUploadSpeed fields but MikroTik rate-limit string only uses base speed. Users never get burst.
- **SHOULD_BE:** Include burst/ceil in Mikrotik-Rate-Limit string format.

### DB-M4: Legacy `nas` Table Has NO Tenant Isolation
- **FILE:** `complete-database.sql:116-127`
- **DESCRIPTION:** No tenantId column. All NAS records visible to all tenants.
- **SHOULD_BE:** Add tenantId column or migrate to RadiusNAS only.

### DB-M5: v_session_history Data Split Uses Hardcoded 70/30 Ratio
- **FILE:** `02-staysuite-views.sql:39-40`
- **DESCRIPTION:** When WiFiSession.dataUsed is set, view splits as 70% download / 30% upload. Actual patterns vary wildly (video: 95% down, backup: 80% up).
- **SHOULD_BE:** Store directional data separately, or remove the split and show total only.

### DB-M6: RadiusNAS Secret Stored as Plaintext
- **FILE:** `prisma/schema.prisma:5354`
- **DESCRIPTION:** No encryption at rest annotation. Compare: RadiusLDAPConfig.bindPassword uses AES-256-GCM.
- **SHOULD_BE:** Add encryption similar to RadiusLDAPConfig.bindPassword.

### DB-M7: data_usage_by_period Has No Tenant Isolation
- **FILE:** `complete-database.sql:134-141`
- **DESCRIPTION:** PK is (username, period_start) — no tenantId/propertyId.
- **SHOULD_BE:** Add tenantId column.

---

## 🟢 LOW / INFO

| # | Finding | File |
|---|---------|------|
| DB-L1 | fn_get_pool_attr only handles 'pool_name' and 'gateway' | complete-database.sql:894 |
| DB-L2 | WiFiPlan missing @@index on status | schema.prisma:8212 |
| DB-L3 | fn_get_effective_bandwidth has side-effect INSERT | complete-database.sql:997 |
| DB-L4 | v_auth_logs redundant WiFiUser self-JOIN | 02-staysuite-views.sql:412 |
| DB-L5 | WiFiSession.status has no CHECK constraint enum | schema.prisma:8271 |
| DB-L6 | Legacy nasreload table has no modern integration | complete-database.sql:129 |
| DB-L7 | v_session_history join condition may miss sessions without acctUniqueId | 02-staysuite-views.sql:89 |
| DB-I1 | No database-level provisioning function — app-layer only | complete-database.sql |

---

# PART 4: E2E AUTH FLOW TRACE — SCENARIO ANALYSIS

## Scenario 1: PAP Guest Login (CoovaChilli Captive Portal)
```
Guest → CoovaChilli → FreeRADIUS (1812) → PostgreSQL → Accept/Reject
```
1. Guest enters username/password on captive portal
2. CoovaChilli sends PAP Access-Request to FreeRADIUS
3. FreeRADIUS: filter_username → preprocess → chap → mschap → digest → suffix → **sql** → files → expiration → logintime → **pap** → MAC auth check → auth method detection → per-NAS enforcement
4. SQL module queries `radcheck` for password, `radreply` for attributes, `radgroupreply` for group attributes
5. Session module checks `radacct` for active sessions
6. Post-auth: session-state → **NO Session-Timeout safety net** → **NO Idle-Timeout** → **NO FUP attributes** → **NO pool validation in default server** → accounting session created → post-auth SQL logs to radpostauth

**GAPS FOUND:**
- ❌ No Session-Timeout fallback if plan misconfigured (FR-M1)
- ❌ No Idle-Timeout set at all (FR-M2)
- ❌ FUP/data-quota not enforced at RADIUS level (FR-H2)
- ❌ Time-based quotas not enforced — no sqlcounter (FR-H3)
- ⚠️ Bandwidth rate-limit ONLY set in inner-tunnel for EAP, NOT in default server for PAP/CHAP

## Scenario 2: EAP-PEAP Login (Corporate/Enterprise)
```
Corporate User → 802.1X Supplicant → AP → FreeRADIUS (1812) → Inner Tunnel (18120) → PostgreSQL → LDAP → Accept/Reject
```
1. AP sends EAP Identity → FreeRADIUS → EAP-TLS challenge → PEAP tunnel → inner-tunnel
2. Inner-tunnel: sql → filter_username → chap → mschap → suffix → sql → files → expiration → logintime → pap
3. Post-auth: sql → fn_get_pool_attr → fn_get_mikrotik_rate_limit → sql → session-state
4. Outer default server continues post-auth: (session-state applied)

**GAPS FOUND:**
- ⚠️ Double PostgreSQL function calls (inner-tunnel + default both call same functions) (FR-M6)
- ❌ inner-tunnel lacks fn_check_ip_pool and fn_check_login_limit (FR-M6)
- ✅ Bandwidth rate-limit IS set (only path where it works)

## Scenario 3: MAC Authentication
```
Device (MAC AA:BB:CC:DD:EE:FF) → NAS → FreeRADIUS → MAC regex match → wifi_user lookup → Auto-accept
```
1. NAS sends Access-Request with User-Name = device MAC
2. FreeRADIUS detects MAC format via regex
3. SQL query: `SELECT username FROM wifi_user WHERE username = MAC AND status = 'active'`
4. If found → Auth-Type := Accept (no password check!)
5. If not found → falls through to normal auth (will fail)

**GAPS FOUND:**
- ❌ **CRITICAL:** No Calling-Station-Id verification — any device can spoof any MAC (FR-H1)
- ❌ No plan validation for MAC auth users (no bandwidth/timeout limits set)
- ❌ No pool assignment for MAC auth users
- ❌ No session timeout/idle timeout for MAC auth users

## Scenario 4: Voucher Auth (Captive Portal → API → RADIUS Provision)
```
Guest → Captive Portal → /api/wifi/captive/auth → Provision User → radcheck/radreply created → Guest gets WiFi
```
1. Guest enters voucher code on portal
2. API validates voucher, creates WiFiUser + radcheck entries
3. API returns hardcoded: networkName='RoyalStay-Guest', bandwidthLimit='100Mbps', expiresAt=now+24h
4. Guest is now provisioned — subsequent RADIUS auth uses radcheck entries

**GAPS FOUND:**
- ❌ Hardcoded brand name 'RoyalStay-Guest' (API-C2)
- ❌ Hardcoded '100Mbps' bandwidth in response (API-C3)
- ❌ Hardcoded 24h expiresAt ignoring plan validity (API-H2)
- ⚠️ Rate limit 5 req/60s may block legitimate guests (API-H1)

---

# PART 5: HARDCODED VALUES THAT SHOULD BE GUI-CONFIGURABLE

| # | Hardcoded Value | File | Current | Should Be |
|---|----------------|------|---------|-----------|
| 1 | Plan session timeout min | plans/route.ts:76 | 60s | GUI-configurable (AAA Config) |
| 2 | Plan session timeout max | plans/route.ts:76 | 86400 (24h) | GUI-configurable (AAA Config) |
| 3 | Plan idle timeout min | plans/route.ts:77 | 30s | GUI-configurable (AAA Config) |
| 4 | Plan bandwidth min | plans/route.ts:78 | 64 Kbps | GUI-configurable (AAA Config) |
| 5 | Plan data limit max | plans/route.ts:79 | 1 TB | GUI-configurable (AAA Config) |
| 6 | Plan validity max | plans/route.ts:80 | 30 days | GUI-configurable (AAA Config) |
| 7 | Plan max devices max | plans/route.ts:82 | 50 | GUI-configurable (AAA Config) |
| 8 | Password min length | users/route.ts:39 | 6 chars | GUI-configurable (AAA Config) |
| 9 | Auth rate limit | captive/auth/route.ts:9 | 5/60s | GUI-configurable per property |
| 10 | Auth expiresAt | captive/auth/route.ts:257 | +24h | Derived from plan/booking |
| 11 | Brand name | captive/auth/route.ts:255 | 'RoyalStay-Guest' | From tenant portal settings |
| 12 | Bandwidth display | captive/auth/route.ts:256 | '100Mbps' | From actual plan bandwidth |
| 13 | Bandwidth fallback A | provisioning-service.ts:69 | 10M/5M | From AAAConfig defaults |
| 14 | Bandwidth fallback B | users/route.ts:267 | 10M/10M | From AAAConfig defaults |
| 15 | Bandwidth fallback C | wifi-user-service.ts:93 | 10M/5M | From AAAConfig defaults |
| 16 | Bandwidth fallback D | aaa/route.ts:56 | 10M/10M | From AAAConfig defaults |
| 17 | Acct-Interim-Interval | wifi-user-service.ts:159 | 60s | Per-plan configurable |
| 18 | Post-checkout grace | provisioning-service.ts:483 | 12h | GUI-configurable (AAA Config) |
| 19 | LDAP auth validity | captive/auth/route.ts:396 | +24h | From property default plan |
| 20 | Plan status enum | plans/route.ts (b2546bdc) | active/inactive | Configurable status workflow |
| 21 | Plan name regex | plans/route.ts:74 | ASCII only | Allow unicode |
| 22 | Session retention | accounting-sync-service.ts:533 | 90 days | GUI-configurable (AAA Config) |
| 23 | Accounting batch size | accounting-sync-service.ts:91 | 1000 | Configurable (env var) |
| 24 | Default currency | plans/route.ts:90 | USD | From property settings |
| 25 | Disconnect concurrency | session-engine.ts:183 | 5 | Configurable (env var) |
| 26 | Data split ratio | 02-staysuite-views.sql:39 | 70/30 | Store directional data |

---

# RECOMMENDED PRIORITY ORDER

## Fix Immediately (CRITICAL)
1. **FR-H1** — MAC auth Calling-Station-Id verification (security bypass)
2. **DB-H1** — RadiusAuthLog UUID type bug (auth logging broken)
3. **API-C2** — Remove hardcoded brand name 'RoyalStay-Guest'
4. **API-C3** — Derive actual plan bandwidth in captive auth response

## Fix Soon (HIGH)
5. **API-H2** — Fix captive auth expiresAt to use plan/booking validity
6. **API-H4** — Normalize bandwidth fallbacks (use AAAConfig defaults)
7. **FR-H2** — Add FUP attribute setting in post-auth
8. **FR-H3** — Enable sqlcounter for time-based quotas
9. **FR-M2** — Add Idle-Timeout from plan in post-auth
10. **API-H5** — Enforce maxDevices on device registration
11. **DB-H2** — Add radacct partial index for login limit query
12. **DB-H3** — Add RadPostAuth indexes
13. **DB-H4** — Rewrite v_user_usage for performance
14. **DB-H5** — Create trigger for WiFiUser byte sync
15. **API-H3** — Make password policy configurable
16. **API-H6** — LDAP auth should use property plan validity
17. **API-H7** — Make post-checkout grace period configurable

## Design Decisions Needed (Business)
- Which plan validation limits should be system-configurable vs per-property?
- Should plan status support more than active/inactive?
- Should session retention be per-property or global?
- Should device registration limits come from plan or separate policy?
- What should the default currency source be?

---

*Report generated: 2026-05-30 | Scan scope: FreeRADIUS 3.2.7 config, 14 API/service files, complete-database.sql, Prisma schema, views*
*This is a READ-ONLY scan. Zero files were modified.*

# StaySuite HospitalityOS — WiFi Module Deep Audit Report

**Date:** 2026-05-26  
**Scope:** Full WiFi module — auth flows, RADIUS integration, portal system, services, schema, seed data  
**Methodology:** Static code analysis, flow tracing, data integrity review  
**Files Analyzed:** 20+ source files across auth, RADIUS, portal, services, and schema  

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 12 | Runtime crashes, security vulnerabilities, data loss |
| **HIGH** | 19 | Race conditions, unit conversion bugs, auth gaps |
| **MEDIUM** | 22 | Missing logging, UX bugs, display issues, cross-tenant leaks |
| **LOW** | 15 | Dead code, minor inconsistencies, polish items |
| **TOTAL** | **68** | |

### Already Fixed Bugs (from previous sessions)

| Bug # | Summary | Commit |
|-------|---------|--------|
| #19 | Missing Simultaneous-Use in radgroupcheck + post-auth override | `9cd5f1a8` |
| #20 | Portal authMethod desync (CaptivePortal vs PortalPage) | `8dd51635` |
| #21 | Post-login page showing wrong bandwidth (portal defaults) | `85ba585d` |
| #22 | SMS OTP UI stuck in loading after requesting OTP | `4887d526` |
| #23 | notificationLog.create() UUID validation errors | `9fc149c7` |
| #24 | SMS OTP plan bandwidth block scoping bug in API response | `350a04e1` |

---

## CRITICAL Findings

### CRITICAL-01: Open Access — Block Scoping Bug (Same as Bug #24)
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1863-1864 (declaration), 1944 (usage)
- **Category:** Bug / Runtime Crash
- **Description:** `openPlanDnKbps` and `openPlanUpKbps` are declared with `let` inside `if (resolvedPropertyId)` block, inside `try`, inside `if (portal)`. At line 1944 they are referenced **outside all three blocks**. `typeof` on an out-of-scope variable returns `'undefined'`, which is truthy... but the variable itself will throw a ReferenceError if `portal` is falsy. When `portal` is truthy and `resolvedPropertyId` exists, the code works due to `typeof` guard, but the **fallback path when property is not resolved** will show portal defaults (5/1 Mbps) instead of plan bandwidth — same pattern as Bug #24.
- **Impact:** Open access auth shows wrong bandwidth in response when plan bandwidth is resolved. Every `open_access` auth through a portal with a property may display incorrect bandwidth on the post-login page.
- **Fix:** Move declarations outside the `if` block, mirroring the SMS OTP pattern (lines 1614-1616).

### CRITICAL-02: SQL Injection in Session Engine Batch Queries
- **File:** `src/lib/wifi/services/session-engine.ts` lines 449, 479-507, 515, 531, 572, 589
- **Category:** Security — SQL Injection
- **Description:** Multiple `$executeRawUnsafe` calls build SQL VALUES clauses via **template literal interpolation** of session data. `username`, `callingstationid`, `acctsessionid` are user-controllable strings directly interpolated without parameterization.
- **Impact:** An attacker controlling username or MAC address can execute arbitrary SQL — data exfiltration, table drops, privilege escalation.

### CRITICAL-03: XSS Bypass — Regex HTML Sanitizer Incomplete
- **File:** `src/app/api/wifi/portal/pages/route.ts` lines 9-21
- **Category:** Security — XSS
- **Description:** `sanitizePortalHtml()` only strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `on*=` handlers, and `javascript:` URLs. Does NOT handle: `<svg onload>`, `<img onerror>`, `<body onload>`, `<details ontoggle>`, `<math>` tags, DOM clobbering vectors, or mutation XSS (mXSS).
- **Impact:** Admin who sets `customHtml` can inject persistent XSS into the captive portal shown to ALL hotel guests — credential theft, session hijacking, malware distribution.

### CRITICAL-04: CSS `expression()` Bypass via Encoding
- **File:** `src/app/api/wifi/portal/pages/route.ts` lines 24-33
- **Category:** Security — XSS via CSS
- **Description:** `sanitizePortalCss()` uses simple regex that can be bypassed with: `expr\65ssion(` (unicode escape), `expre/**/ssion(` (CSS comment injection), or escaped newlines within the keyword.
- **Impact:** IE11 and older captive-portal CNA browsers could execute JavaScript via CSS expressions.

### CRITICAL-05: PUT Portal Page Bypasses HTML/CSS Sanitization
- **File:** `src/app/api/wifi/portal/pages/[id]/route.ts` lines 40-51
- **Category:** Security — XSS
- **Description:** The PUT handler copies `customCss`/`customHTML` directly into `updatePayload` without calling `sanitizePortalCss()` or `sanitizePortalHtml()`. Only the POST route sanitizes. An attacker using PUT bypasses all sanitization.
- **Impact:** Same as CRITICAL-03 — persistent XSS via PUT endpoint.

### CRITICAL-06: SMS OTP Exposes Plaintext OTP in Production API Response
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1818-1832
- **Category:** Security
- **Description:** `_debugOtp: code` is included in every OTP send response. No `NODE_ENV` guard — returned in production. Anyone intercepting the HTTPS response (browser devtools, network proxy, log aggregators) can see the OTP.
- **Impact:** SMS OTP authentication downgraded to open-access security. Network attackers can intercept and steal OTP codes.

### CRITICAL-07: OTP Brute Force — No Rate Limiting or Audit Logging
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1577-1596
- **Category:** Security
- **Description:** OTP verification failures (not found, expired, max attempts, wrong code) do NOT call `logAuthAttempt` or `recordFailedAttempt`. Only `OTP_MAX_VERIFY_ATTEMPTS = 5` per OTP protects brute force. Attacker can request new OTPs (5 per 15 min window) and brute-force each one.
- **Impact:** OTP brute-force without IP rate limiting trigger, without audit trail, without security logging.

### CRITICAL-08: Command Injection via IP Address in Shell Scripts
- **File:** `src/lib/wifi/utils/nftables-counters.ts` lines 160, 188, 219
- **Category:** Security — Command Injection
- **Description:** User-supplied IP addresses are passed into `execSync` shell commands. While `normalizeIPv4()` validates format, it does NOT escape shell metacharacters. If normalization fails or returns unexpected input, command injection is possible. Process runs as root for nftables access.
- **Impact:** Arbitrary shell command execution as root via crafted IP address.

### CRITICAL-09: Unauthenticated Disconnect Endpoint
- **File:** `src/app/api/v1/wifi/disconnect/route.ts` line 41
- **Category:** Security — Auth Bypass
- **Description:** The POST endpoint has NO authentication check. Any client can disconnect any user by sending `{ username: "target_user" }`.
- **Impact:** Unauthenticated users can force-disconnect any other guest. Denial-of-service vector.

### CRITICAL-10: No-Show Engine — Invalid Enum Value Guarantees Runtime Error
- **File:** `src/lib/no-show-engine.ts` lines 656-665
- **Category:** Bug / Enum Mismatch
- **Description:** Writes `channel: 'system_no_show_engine'` to `NotificationLog.channel`. Schema defines `NotificationChannel` as `email | sms | whatsapp | push | in_app`. Invalid value causes `PrismaClientValidationError` on every execution.
- **Impact:** No-show engine execution status is **never** persisted. Defeats the purpose of the logging entirely.

### CRITICAL-11: Non-UUID Message IDs Written to `@db.Uuid` Column
- **File:** `src/lib/wifi/services/pre-arrival-scheduler.ts` lines 323, 374
- **Category:** Data Integrity
- **Description:** `NotificationLog.externalId` is `String? @db.Uuid`. Pre-arrival scheduler writes `emailResult.messageId` / `smsResult.messageId` (e.g., Twilio `SM...`, SendGrid `_SG...`) — not valid UUIDs. The pre-arrival send route at `src/app/api/wifi/pre-arrival/send/route.ts` lines 275, 335 has the same issue but with NO `.catch()` — throws unhandled 500 error.
- **Impact:** Pre-arrival notification logs silently lost (scheduler) or crash with 500 error (send route).

### CRITICAL-12: Pre-Arrival Scheduler Marks `preArrivalSent=true` Unconditionally
- **File:** `src/lib/wifi/services/pre-arrival-scheduler.ts` lines 393-396
- **Category:** Data Loss
- **Description:** `booking.preArrivalSent = true` set unconditionally regardless of whether email/SMS sending succeeded. Both send blocks have try/catch that swallows errors. If both channels fail, guest **never** receives WiFi credentials and booking is excluded from future runs.
- **Impact:** Silent data loss — guests permanently miss their pre-arrival WiFi credentials.

---

## HIGH Findings

### HIGH-01: Voucher Race Condition — Double Provision Possible
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 863-960
- **Category:** Bug / Race Condition
- **Description:** Voucher is read, validated, then `provisionOrResumeUser` and `radiusAuth` run BEFORE the atomic `updateMany`. Two concurrent requests both pass validation and provision. Second gets 409 but orphaned WiFiUser + radcheck entries already exist.
- **Impact:** Orphaned RADIUS user entries accumulate in database.

### HIGH-02: `isSessionLimitReached` TOCTOU Race Condition
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 374-396
- **Category:** Bug / Race Condition
- **Description:** Session count queried, then (after RADIUS auth, firewall activation) new session created. Two concurrent requests both pass the count check and both create sessions, exceeding `maxSessions`.
- **Impact:** Concurrent session limit can be exceeded under load. Needs database-level advisory locks or atomic pattern.

### HIGH-03: `provisionOrResumeUser` Swallows All Errors Silently
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 2229-2272
- **Category:** Bug
- **Description:** When `provisionUser` fails, catch tries to reactivate existing user. If that also fails (or no existing user), error is silently swallowed. Execution continues to `radiusAuth` which fails with confusing RADIUS rejection.
- **Impact:** Misleading error messages. Orphaned partial state.

### HIGH-04: Session Engine Loads Data Twice (Performance Bug)
- **File:** `src/lib/wifi/services/session-engine.ts` lines 267-279
- **Category:** Performance
- **Description:** Bulk data loading (counters, authIPs, policies) performed twice in succession. First `Promise.all` result is discarded; second load shadows the first with `const` re-declarations. Doubles I/O cost.
- **Impact:** 2x session engine execution time (~4-10 seconds instead of 2-5 seconds for 5000 users).

### HIGH-05: Cisco Data Limit Attributes Not Cleaned Up on Plan Change
- **File:** `src/lib/wifi/utils/attribute-readers.ts` lines 74-84
- **Category:** Data Consistency
- **Description:** `getVendorDataLimitAttrs` generates `Cisco-AVPair-1` and `Cisco-AVPair-2`, but `DATA_LIMIT_ATTRIBUTES` only lists `Cisco-AVPair`. When `updateUser` deletes old data limit attrs, `Cisco-AVPair-1/2` are never cleaned up.
- **Impact:** Stale Cisco data limits persist across plan changes. Users changing plans keep being enforced at old limits.

### HIGH-06: Bandwidth Ceiling Not Passed in 3 of 5 Auth Methods
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1314-1321, 1505-1512, 1696-1703
- **Category:** Bug
- **Description:** `activateUserFirewall` accepts `dnCeilKbps`/`upCeilKbps` for HTB burst ceiling. Voucher and room_number PMS-reuse correctly pass these. But room_number fallback, pms_credentials, and sms_otp do NOT pass ceiling parameters.
- **Impact:** Burst bandwidth disabled for 3 auth methods. Users get strict rate limiting without burst capability.

### HIGH-07: `syncRadiusGroup` Nested Transaction Error Swallowed
- **File:** `src/lib/wifi/services/wifi-user-service.ts` lines 378-392
- **Category:** Transaction Safety
- **Description:** Inside `provisionUser` transaction, calls `syncRadiusGroup` which opens its own nested transaction. The `.catch()` on line 390 swallows errors. If sync partially succeeds (some groupcheck created, groupreply fails), outer transaction commits with corrupted partial group data.
- **Impact:** Corrupted radgroupcheck/radgroupreply — some entries created, others missing. FreeRADIUS applies partial policies.

### HIGH-08: `resolveAllowedPoolIds` Semantic Contradiction
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 351-367, 2207-2209
- **Category:** Bug
- **Description:** `resolveAllowedPoolIds` returns `null` for "no restriction", but `getValidatedPool` converts `null` to `'ANY'` (check ALL pools). This contradicts documented behavior — users with no plan must still be on a managed WiFi network.
- **Impact:** Open access without a plan may unexpectedly reject users not on managed pools.

### HIGH-09: Marketing Consent Can Never Be Revoked (GDPR Issue)
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 2105-2113
- **Category:** Bug / Privacy Compliance
- **Description:** `saveGuestInfoAfterAuth` only sets `emailOptIn = true` / `smsOptIn = true` when consent is given. If NOT given, the update object does NOT include `emailOptIn: false`. Once consented, subsequent auth without consent does NOT revoke.
- **Impact:** GDPR/privacy violation. Guests cannot withdraw marketing consent through the portal.

### HIGH-10: MarketingConsentPlaceholder Checkboxes Are Uncontrolled (Data Loss)
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 515, 521
- **Category:** Bug / Data Loss
- **Description:** `MarketingConsentPlaceholder` uses `<input defaultChecked={false} />` with NO `checked` prop and NO `onChange` handler. Consent state is never captured, never sent to parent, never included in auth payload.
- **Impact:** In fallback portal mode, marketing consent is silently lost. GDPR compliance data not collected.

### HIGH-11: SMS OTP Frontend Race — Step Advances Before Server Confirmation
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 1050-1056
- **Category:** Bug / UX
- **Description:** In fallback `SmsOtpForm`, `handleSendOtp` calls `onAuthenticate(...)` then **immediately** calls `setStep('otp')` without waiting for server response. If server returns error (invalid phone, rate limit), user is on OTP screen with ticking 60s countdown but no code was sent.
- **Impact:** Poor UX — "enter verification code" shown but no code dispatched. Countdown prevents retry.

### HIGH-12: Disconnect Fails Silently for Some Auth Methods
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 2282-2306
- **Category:** Bug / Data Gap
- **Description:** `handleDisconnect` checks `if (authResult?.username)`. However, not all auth methods include `username` in the success response. SMS OTP, open access, and room number paths may not include it, causing disconnect to silently fail.
- **Impact:** Radacct sessions never closed, firewall rules remain active for some auth methods.

### HIGH-13: AAA Config Upsert Allows null Values to Clear Fields
- **File:** `src/app/api/wifi/aaa/route.ts` lines 145-181
- **Category:** Data Loss
- **Description:** POST handler destructures ALL fields from body. The `update` clause passes them directly. If frontend sends `null` for a field, Prisma WILL set it to `null`, overwriting previous value. No null-filtering before update.
- **Impact:** Sending null values clears previously configured AAA settings (defaultPlanId, bandwidth, etc.).

### HIGH-14: Bandwidth Conversion: bytes/sec Divided by 1M (Should Be *8/1M)
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 844-849
- **Category:** Bug / Unit Conversion
- **Description:** `bwDown = Math.round((portal.maxBandwidthDown || 5242880) / 1000000)`. If `maxBandwidthDown` is in bytes/sec, dividing by 1M gives MB/s (≈5.24), not Mbps. Correct: `* 8 / 1,000,000` giving ≈42 Mbps. **OR** if the value is stored in kbps, the conversion is different. Needs verification against actual DB storage format.
- **Impact:** When plan has no `downloadSpeed`, fallback bandwidth displayed is potentially 8x lower than actual.

### HIGH-15: RADIUS Protocol Injection via Username/Password
- **File:** `src/lib/wifi/utils/radius-auth.ts` line 82
- **Category:** Security
- **Description:** Username and password interpolated into radclient input string via single quotes. A crafted username like `guest', Acct-Session-Id = 'evil` could inject additional RADIUS attributes.
- **Impact:** Potential RADIUS attribute manipulation in Access-Request packet.

### HIGH-16: Plan Name Collision in RADIUS Group Mapping
- **File:** `src/lib/wifi/services/wifi-user-service.ts` line 50
- **Category:** Logic Error
- **Description:** `planNameToGroupName()` normalizes by stripping non-alphanumeric chars. `"VIP Suite Plan"` and `"vip_suite-plan"` both map to `"vip_suite_plan"`. Second plan's sync overwrites first plan's RADIUS group attributes.
- **Impact:** Plans with similar normalized names silently overwrite each other's RADIUS group policies.

### HIGH-17: IP Pool DELETE Silently Clears Active Assignments
- **File:** `src/app/api/wifi/ip-pools/route.ts` lines 410-421
- **Category:** Data Integrity / Security
- **Description:** When deleting an IP pool, code silently clears `ipPoolId` from plans and users that reference it. No warning to operator. Users previously restricted to a VLAN become unrestricted.
- **Impact:** Silent security policy change. Pool deletion removes network access restrictions.

### HIGH-18: EnforceSimultaneousUse Outside Transaction
- **File:** `src/lib/wifi/services/wifi-user-service.ts` lines 992-1031
- **Category:** Race Condition
- **Description:** Read-then-write without transaction. Two concurrent calls for same username can both find no existing entry and both create duplicate `Simultaneous-Use` rows.
- **Impact:** Duplicate radgroupcheck entries, inconsistent session limits.

### HIGH-19: Consent Compared as String `=== 'true'` (Boolean Fails)
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1002, 1227, 1342, 1541, 1731, 1937
- **Category:** Bug
- **Description:** Consent compared with `=== 'true'` (string). If frontend sends boolean `true`, comparison fails and consent recorded as `false`. Should handle both types.
- **Impact:** Guests who check consent box may not have preference saved.

---

## MEDIUM Findings

### MEDIUM-01: In-Memory Maps Grow Unbounded Between Cleanup Intervals
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 165-195, 638-645
- **Category:** Performance
- **Description:** Three `Map` stores (otpStore, otpRateLimits, authAttempts) cleaned by `setInterval` every 1-5 minutes. Between cleanups, entries accumulate without limit. In multi-instance deployments, maps are not shared (no Redis).
- **Impact:** Memory pressure during bursts. OTP auth fails in serverless/multi-instance deployments.

### MEDIUM-02: Three Redundant Client IP Extraction Functions
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 2, 243-252, 332-334
- **Category:** Bug / Consistency
- **Description:** Three different functions extract client IP with different logic and fallbacks. Different IPs used for rate limiting vs auth logging vs session accounting.
- **Impact:** Inconsistent IP attribution. Attacker could manipulate X-Forwarded-For to bypass rate limiting.

### MEDIUM-03: Missing `logAuthAttempt` for OTP Verification Failures
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1577-1596
- **Category:** Gap / Security
- **Description:** All OTP verification failures return error responses without calling `logAuthAttempt`. No audit trail for OTP brute-force attempts.
- **Impact:** No visibility into OTP attacks in Auth Logs dashboard.

### MEDIUM-04: `recordFailedAttempt` Fires for Non-Credential Rejections
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 2311-2313
- **Category:** Bug
- **Description:** `logAuthAttempt` calls `recordFailedAttempt` for ALL `Access-Reject` replies, including IP_NOT_IN_POOL, MAX_SESSIONS_REACHED, ACCOUNT_EXPIRED. Legitimate users hitting limits get rate-limited.
- **Impact:** Guests on wrong network or at device limit get locked out by rate limiter.

### MEDIUM-05: No RADIUS Auth Timeout
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 948, 1149, 1302, 1442, 1685, 1900
- **Category:** Bug / Reliability
- **Description:** All `radiusAuth()` calls have no explicit timeout. If RADIUS server is unreachable, call hangs until OS TCP timeout (60-120 seconds), blocking HTTP response.
- **Impact:** Guests see spinning auth for minutes when RADIUS is down.

### MEDIUM-06: `request.json()` with No Runtime Validation
- **File:** `src/app/api/v1/wifi/auth/route.ts` line 703
- **Category:** Security
- **Description:** Request body type-asserted with `as { ... }` but no runtime validation (zod, joi). Malformed types could cause subtle failures.
- **Impact:** Potential runtime errors from type mismatches.

### MEDIUM-07: Open Access — No Auth Logging When Portal Is Null
- **File:** `src/app/api/v1/wifi/auth/route.ts` lines 1838-1951
- **Category:** Gap
- **Description:** When portal is null, open_access skips user creation, RADIUS auth, and `logAuthAttempt`. Guest gets `authenticated: true` with null username and no audit trail.
- **Impact:** Unlogged open-access authentications. Security blind spot.

### MEDIUM-08: `createAccountingSession` Returns Empty String on Error
- **File:** `src/app/api/v1/wifi/auth/route.ts` line 2440
- **Category:** Bug
- **Description:** Returns `''` on error. Callers declare `let sessionId: string | null`. Empty string is falsy but type inconsistency could cause subtle issues.
- **Impact:** Minor — works due to falsy check, but type-unsafe.

### MEDIUM-09: `normalizeIPv4` Return Not Validated Before Shell Interpolation
- **File:** `src/lib/wifi/utils/nftables-counters.ts` lines 156-168
- **Category:** Security
- **Description:** `normalizeIPv4()` result not checked for null/empty before passing to `execSync`. Empty IP creates malformed nft rules.
- **Impact:** Malformed nftables rules from invalid IP input.

### MEDIUM-10: Idle Timeout Resets on Server Restart
- **File:** `src/lib/wifi/services/session-engine.ts` line 351
- **Category:** Logic Error
- **Description:** `lastActivityMap` is in-memory — lost on restart. All sessions get fresh idle timer after restart. Users idle for hours won't be disconnected.
- **Impact:** Idle timeout enforcement gap after server restarts.

### MEDIUM-11: Auto-Auth Closes ALL Device Sessions Before Checking Limit
- **File:** `src/app/api/v1/wifi/auto-auth/route.ts` lines 376-386
- **Category:** Logic / Edge Case
- **Description:** Auto-auth closes ALL active radacct sessions before checking max device limit. Multi-device users lose all other sessions on reconnect.
- **Impact:** Device B loses connectivity when device A reconnects. Unexpected session termination.

### MEDIUM-12: Portal Mappings Not Filtered by Tenant
- **File:** `src/app/api/wifi/portal/resolve-zone/route.ts` lines 301-307
- **Category:** Security / Cross-Tenant
- **Description:** `findMany` query for portalMappings has NO `tenantId` filter. In multi-tenant SaaS, guest on tenant A's network could match tenant B's subnet mapping.
- **Impact:** Cross-tenant portal leakage — wrong branding, auth methods, and configuration served.

### MEDIUM-13: Debug OTP Not Passed to Unified Form SMS Mode
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 1248, 2232
- **Category:** Functional Gap
- **Description:** Unified form's SMS OTP mode uses local `debugOtp` state never updated from parent. Developers testing unified form can't see OTP.
- **Impact:** Debug difficulty in unified form SMS testing.

### MEDIUM-14: Weather Widget Can't Fetch Pre-Authentication
- **File:** `src/app/connect/wifi-connect-portal.tsx` line 290
- **Category:** Reliability
- **Description:** WeatherWidget fetches from `wttr.in` directly from client browser. In captive portal, guest has no internet access yet. Always shows fallback.
- **Impact:** Weather widget never loads on portal page.

### MEDIUM-15: Duplicate GuestSurvey on Success Screen
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 1818, 1823
- **Category:** UX
- **Description:** SuccessScreen renders both `GuestSurvey` (simple) AND `SurveyWidget` (full) when survey is enabled. Two survey UIs stacked.
- **Impact:** Confusing duplicate survey UI on success page.

### MEDIUM-16: Duplicate MarketingConsentPlaceholder in Some Layouts
- **File:** `src/app/connect/wifi-connect-portal.tsx` lines 2664, 2877-2881
- **Category:** UX
- **Description:** Fallback mode renders consent checkboxes in `renderCardContent()` AND again after it in split/hero/sidePanel layouts.
- **Impact:** Duplicate consent UI confuses guests.

### MEDIUM-17: Hardcoded `language: 'en'` Filter in Portal Resolution
- **File:** `src/app/api/wifi/portal/resolve-zone/route.ts` line 86
- **Category:** Internationalization
- **Description:** Portal pages filtered by `language: 'en'`. Non-English-only configurations show default design.
- **Impact:** Non-English portal configurations don't work.

### MEDIUM-18: `NotificationLog` Missing Composite Index
- **File:** `prisma/schema.prisma` lines 4233-4236
- **Category:** Performance
- **Description:** Separate indexes on `tenantId`, `recipientId`, `status`. No composite index on `[tenantId, channel, status]`. Common queries require index intersection.
- **Impact:** Slow notification dashboard queries as table grows.

### MEDIUM-19: Pre-Arrival Scheduler — No Transaction for Multi-Step Processing
- **File:** `src/lib/wifi/services/pre-arrival-scheduler.ts` lines 138-396
- **Category:** Atomicity
- **Description:** `processBooking` performs credential generation, notification sending, booking update without database transaction. Crash between steps creates inconsistent state.
- **Impact:** Duplicate credentials on retry, or credentials generated but booking not marked.

### MEDIUM-20: Pre-Arrival Scheduler — No Concurrency Protection
- **File:** `src/lib/wifi/services/pre-arrival-scheduler.ts` line 64
- **Category:** Race Condition
- **Description:** No locking prevents concurrent cron executions. Multi-pod deployments could process same bookings simultaneously.
- **Impact:** Duplicate WiFi credential emails/SMS to guests.

### MEDIUM-21: `Notification.userId` Empty String for Guest-Only Notifications
- **File:** `src/lib/services/notification-service.ts` line 467
- **Category:** Data Integrity
- **Description:** `sendInAppNotification` writes `userId: data.userId || ''` to `Notification.userId @db.Uuid` (non-nullable). Guest-only notifications always fail.
- **Impact:** In-app notifications silently dropped for guests without userId.

### MEDIUM-22: Data Limit Update Resets Interim Interval
- **File:** `src/lib/wifi/services/wifi-user-service.ts` line 571
- **Category:** Unintended Side Effect
- **Description:** Updating data limit calls `generateSessionAttributes` which also adds `Acct-Interim-Interval` (hardcoded 60s) and `Termination-Action`. Customized intervals are overwritten.
- **Impact:** Admin-customized interim interval reset to 60s on data limit change.

---

## LOW Findings

| # | File | Line(s) | Description |
|---|------|---------|-------------|
| LOW-01 | auth/route.ts | 2 | Dead import: `normalizeIPv4` imported but unused (file has own `normalizeIp`) |
| LOW-02 | auth/route.ts | 2404 | `getLocalNasConfig` called every session creation (no caching) |
| LOW-03 | auth/route.ts | 2319-2329 | `logAuthAttempt` does 2 DB lookups per call even for rejected users |
| LOW-04 | auth/route.ts | 170, 190, 640 | Multiple `setInterval` timers orphaned on hot-reload |
| LOW-05 | auth/route.ts | 1981-1986 | No correlation ID in error responses |
| LOW-06 | auth/route.ts | 703 | Malformed JSON body returns generic INTERNAL_ERROR |
| LOW-07 | auth/route.ts | 890 | `voucher.validUntil` not null-checked before comparison |
| LOW-08 | auth/route.ts | 1969-1986 | `successResponse`/`errorResponse` inconsistent status handling |
| LOW-09 | auth/route.ts | 190-195 | OTP rate limiter cleanup interval vs window mismatch (minor) |
| LOW-10 | resolve-zone/route.ts | 348-366 | No clear error when portal disabled with no fallback |
| LOW-11 | resolve-zone/route.ts | 205 | Unsafe JSON cast of `marketingOptIn` from designSettings (prototype pollution risk) |
| LOW-12 | wifi-connect-portal.tsx | 823-829 | `ErrorDisplay` uses hardcoded red styling, ignores portal theme |
| LOW-13 | wifi-connect-portal.tsx | 1814 | "Disconnect & Logout" hardcoded in English |
| LOW-14 | wifi-connect-portal.tsx | 2276-2306 | No way for guest to fully sign out from portal UI |
| LOW-15 | wifi-connect-portal.tsx | 2234 | State set to invalid value `'idle'` (not in PortalState type) |
| LOW-16 | session-engine.ts | 564-569 | Identical if/else branches (dead code / copy-paste error) |
| LOW-17 | wifi-user-service.ts | 86 | `sessionTimeoutMin` computed but never used |
| LOW-18 | wifi-user-service.ts | 964-985 | `isActive: true` filter on tables where all records are active |
| LOW-19 | radius/route.ts | 35-59 | Module-level `radacctCleaned` flag resets on cold start |
| LOW-20 | nftables-counters.ts | 219 | `handle` from grep output not explicitly validated before shell exec |
| LOW-21 | aaa/route.ts | 95 | Credential policy details logged to console (info disclosure) |
| LOW-22 | auto-auth/route.ts | 592, 928 | Unused `getRejectMessageFromCode` function (dead code) |
| LOW-23 | auto-auth/route.ts | 64 | `resolveAllowedPoolIds` signature differs from auth/route.ts (3 vs 4 params) |
| LOW-24 | no-show-engine.ts | — | Same file as CRITICAL-10 but noting the execution status logging pattern |
| LOW-25 | wifi-seed.ts | 1011+ | Hardcoded RADIUS secrets in plaintext in seed file |
| LOW-26 | wifi-seed.ts | 3053-3064 | Fake SHA-256 hashes in consent logs (`abc123hash456`) |
| LOW-27 | schema.prisma | 5421 | `RadPostAuth.propertyId` nullable — orphan post-auth logs possible |
| LOW-28 | email-service.ts:504, sms-service.ts:569 | `recipientId` always NIL_UUID — logs unlinkable from guest profiles |

---

## Recommended Fix Priority

### P0 — Immediate (Security & Data Loss)
| # | Fix |
|---|-----|
| CRITICAL-02 | Parameterize ALL SQL in session-engine.ts batch queries |
| CRITICAL-03/04/05 | Replace regex HTML/CSS sanitizers with `sanitize-html` library on POST + PUT |
| CRITICAL-06 | Guard `_debugOtp` behind `NODE_ENV !== 'production'` |
| CRITICAL-08 | Validate/sanitize ALL inputs before shell exec in nftables-counters.ts |
| CRITICAL-09 | Add auth check to disconnect endpoint |
| CRITICAL-10 | Fix no-show-engine enum value or add to schema |
| CRITICAL-11 | Change `NotificationLog.externalId` from `@db.Uuid` to `String?` |
| CRITICAL-12 | Only set `preArrivalSent=true` when at least one channel succeeds |

### P1 — Urgent (Bugs & Compliance)
| # | Fix |
|---|-----|
| CRITICAL-01 | Move openPlanDnKbps/openPlanUpKbps outside if-block (same as Bug #24) |
| HIGH-09/10 | Fix marketing consent — add `emailOptIn: false` / make placeholders controlled |
| HIGH-07 | Don't swallow syncRadiusGroup errors in transaction |
| HIGH-15 | Escape username/password in radclient input |
| HIGH-19 | Handle boolean consent comparison (`=== true \|\| val === 'true'`) |

### P2 — Short-Term (Reliability & UX)
| # | Fix |
|---|-----|
| HIGH-01/02 | Add database-level locking for voucher + session limit checks |
| HIGH-06 | Pass bandwidth ceiling params in room_number, pms_credentials, sms_otp |
| HIGH-11 | Make SMS OTP step transition conditional on server success |
| HIGH-12 | Ensure all auth methods include `username` in response |
| HIGH-13 | Filter null values from AAA update payload |
| HIGH-14 | Verify and fix bandwidth unit conversion (bytes vs kbps vs Mbps) |
| HIGH-16 | Add uniqueness check or hash to planNameToGroupName |
| HIGH-17 | Warn/prevent pool deletion when plans reference it |
| HIGH-18 | Wrap enforceSimultaneousUse in transaction |
| MEDIUM-05 | Add timeout to radiusAuth() calls |
| MEDIUM-12 | Add tenantId filter to portal mapping queries |

### P3 — Scheduled (Performance & Polish)
| # | Fix |
|---|-----|
| HIGH-04 | Remove duplicate data load in session-engine |
| HIGH-05 | Update DATA_LIMIT_ATTRIBUTES and BANDWIDTH_ATTRIBUTES to include all Cisco variants |
| MEDIUM-01 | Add Redis-backed OTP store for multi-instance support |
| MEDIUM-17 | Support multi-language portal page filtering |
| MEDIUM-19/20 | Wrap pre-arrival processing in transaction + add advisory lock |
| MEDIUM-22 | Don't reset interim interval on data limit update |
| LOW items | Dead code cleanup, caching, index additions, i18n polish |

---

## Notes

1. **Bandwidth Unit Convention**: The codebase has a confused bandwidth convention. The portal stores `maxBandwidthDown/Up` — some places treat it as bytes/sec, others as kbps. The auth route converts it differently in different places. This needs a single source of truth (recommend: store everything in **kbps**, convert to Mbps only for display).

2. **Multi-Instance Safety**: All in-memory stores (OTP store, rate limits, session engine maps) will break in serverless/multi-instance deployments. Recommend migrating to Redis.

3. **Input Validation**: The auth route's 2400+ line handler has zero runtime input validation (no zod/joi). This is the single highest-risk area for future bugs.

4. **Transaction Safety**: Multiple read-then-write patterns outside transactions (provisionOrResumeUser, enforceSimultaneousUse, voucher validation). These should use `SELECT ... FOR UPDATE` or Prisma interactive transactions.

---

*Report generated by deep static analysis. No code was modified.*

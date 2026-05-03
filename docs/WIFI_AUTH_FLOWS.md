# StaySuite WiFi Authentication Flows

> **Version:** 1.0  
> **Last Updated:** 2025  
> **Module:** WiFi AAA (Authentication, Authorization, Accounting)  
> **Source:** `src/app/api/v1/wifi/auth/route.ts`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Standard Hotel WiFi Flow](#2-standard-hotel-wifi-flow)
3. [Authentication Methods](#3-authentication-methods)
   - [3.1 PMS Credentials](#31-pms-credentials)
   - [3.2 Room Number + Last Name](#32-room-number--last-name)
   - [3.3 Voucher Code](#33-voucher-code)
   - [3.4 SMS OTP](#34-sms-otp)
   - [3.5 Open Access](#35-open-access)
   - [3.6 Auto Auth](#36-auto-auth)
4. [Shared Infrastructure](#4-shared-infrastructure)
5. [API Reference](#5-api-reference)
6. [Security](#6-security)
7. [Configuration](#7-configuration)

---

## 1. Overview

### What is StaySuite WiFi Authentication?

StaySuite WiFi Authentication is the guest-facing captive portal authentication system that controls network access for hospitality properties. It provides six authentication methods, validates client network context, provisions RADIUS credentials, activates firewall rules, and tracks sessions — all through a single API endpoint.

The system is designed for the hospitality market with support for:

- **Hotels** — Room-based auth, PMS integration, check-in/check-out lifecycle
- **Cafes & Co-work spaces** — Voucher-based access with configurable data caps
- **Lobbies & Public Areas** — Open access with bandwidth restrictions
- **Corporate Properties** — Username/password credentials for business guests

### Architecture

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│              │     │                │     │                 │
│  Guest       │────▶│  StaySuite API │────▶│   PostgreSQL    │
│  Device      │     │  (Next.js)     │     │                 │
│  (Browser)   │     │                │     │  ┌───────────┐  │
│              │◀────│  /api/v1/wifi  │◀────│  │ WiFiUser   │  │
└──────────────┘     │  /auth         │     │  │ RadCheck   │  │
       │             │                │     │  │ RadReply   │  │
       │ HTTP        │  Validates:    │     │  │ RadUserGrp │  │
       │ POST        │  • Credentials │     │  │ RadGrpChk  │  │
       │             │  • IP Pool     │     │  │ RadGrpRpl  │  │
       │             │  • Session     │     │  │ RadAcct    │  │
       │             │  • Rate Limit  │     │  └───────────┘  │
       │             │                │     │                 │
       │             │  Activates:    │     └────────┬────────┘
       │             │  • Firewall    │              │
       │             │  • Bandwidth   │              │ Shared DB
       │             │  • Accounting  │              │ (no sync needed)
       │             └────────┬───────┘              │
       │                      │                      │
       │             ┌────────▼───────┐     ┌───────▼────────┐
       │             │  FreeRADIUS    │────▶│  Access Point  │
       │             │  (port 1812)   │     │  / Controller  │
       │             │  Auth + Acct   │     │  (UniFi, etc)  │
       │             └────────────────┘     └────────────────┘
       │                                            │
       └──────────── WiFi 802.11 ──────────────────┘
```

### Single Endpoint Design

All authentication flows are handled through one unified endpoint:

```
POST /api/v1/wifi/auth
```

The `method` field in the request body selects the authentication strategy:

| Method | Value | Typical Use Case |
|--------|-------|------------------|
| PMS Credentials | `pms_credentials` | Corporate/business hotels |
| Room Number | `room_number` | Budget/mid-range hotels |
| Voucher Code | `voucher` | Cafes, co-work, lobbies |
| SMS OTP | `sms_otp` | Modern/tech-forward hotels |
| Open Access | `open_access` | Free WiFi lobbies/cafes |
| Auto Auth | `auto_auth` | Device fingerprint (separate flow) |

### Validation Order

The auth endpoint follows a strict validation pipeline to ensure accurate rejection logging:

```
Step 0: Per-IP Rate Limit (10 req/min)
    │
Step 1: Parse Request Body → Extract method, credentials
    │
Step 2: Validate Credentials (method-specific)
    │  • Wrong password → "Rejected — invalid credentials"
    │  • If invalid → STOP (no IP check needed)
    │
Step 3: Validate Client IP Against Allocated IP Pools
    │  • Wrong network → "Rejected — IP not in managed pool"
    │  • If invalid → STOP
    │
Step 4: Check Concurrent Session Limits
    │
Step 5: Authenticate via FreeRADIUS
    │
Step 6: Activate Firewall + Bandwidth Shaping
    │
Step 7: Create Accounting Session + Log Auth Attempt
    │
Step 8: Return Success Response
```

---

## 2. Standard Hotel WiFi Flow

### Full Lifecycle: Check-in to Check-out

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GUEST WiFi LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐                  │
│  │  STAGE 1    │    │   STAGE 2    │    │   STAGE 3     │                  │
│  │  Check-in   │───▶│  Guest       │───▶│  Auth         │                  │
│  │  (PMS)      │    │  Connects    │    │  (Captive     │                  │
│  │             │    │  (WiFi)      │    │   Portal)     │                  │
│  └─────────────┘    └──────────────┘    └───────┬───────┘                  │
│        │                                          │                         │
│   PMS auto-prov.                                   │                         │
│   WiFiUser + RadCheck                              │                         │
│   + RadReply + RadUserGroup                        │                         │
│                                                    │                         │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────▼──────┐                  │
│  │  STAGE 6    │    │   STAGE 5    │    │   STAGE 4     │                  │
│  │  Check-out  │◀───│  Active      │◀───│  RADIUS       │                  │
│  │  (PMS)      │    │  Session     │    │  Auth         │                  │
│  │             │    │  Mgmt        │    │               │                  │
│  └─────────────┘    └──────────────┘    └───────────────┘                  │
│        │                                                                    │
│   Deprovision user                                                          │
│   Delete RadCheck/Reply                                                      │
│   Terminate sessions                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage 1: Guest Check-in (PMS Auto-Provisioning)

When a guest checks in via the PMS, the system automatically provisions their WiFi account:

```
PMS Check-in Event
        │
        ▼
┌───────────────────────┐
│ wifiUserService       │
│ .provisionUser()      │
│                       │
│ Creates:              │
│  • WiFiUser record    │
│  • RadCheck           │  ← Cleartext-Password
│  • RadReply           │  ← Session-Timeout override
│  • RadUserGroup       │  ← Maps user → plan group
│  • RadGroupCheck      │  ← (synced from plan)
│  • RadGroupReply      │  ← (synced from plan)
└───────────────────────┘
```

**Provisioning Flow Detail:**

1. Generate a unique `username` (from `propertyId` + random bytes) or use the provided one
2. Create `WiFiUser` with `status: 'active'`, `radiusSynced: true`
3. Write `RadCheck` with `Cleartext-Password` attribute — this is what FreeRADIUS reads for authentication
4. Sync plan attributes to `RadGroupCheck` / `RadGroupReply` if group entries don't exist yet
5. Write per-user `RadReply` overrides only: `Session-Timeout` (based on checkout), `Cryptsk-Plan-Name`, `Cryptsk-User-Profile`
6. Create `RadUserGroup` mapping `username → groupName` (group name derived from plan name)
7. Write per-user `Simultaneous-Use` in `RadCheck` if explicitly provided

**Username Generation:**
```
WiFiUser.username = guest-{propertyId_short}-{random_8_bytes}
WiFiUser.password = {random_24_bytes_hex}
```

### Stage 2: Guest Connects (Captive Portal Redirect)

When a guest connects to the hotel WiFi:

```
Guest Device connects to SSID
        │
        ▼
DHCP assigns IP from managed pool
        │
        ▼
DNS redirect / captive portal detection
        │
        ▼
Browser opens: /connect?mac=AA:BB:CC:DD:EE:FF
        │
        ▼
┌──────────────────────────────────────┐
│ Portal Resolution                    │
│ 1. Client IP → PortalMapping lookup  │
│ 2. Match IP against portal subnets   │
│ 3. Load portal config (design, auth  │
│    methods, bandwidth, etc.)         │
│ 4. Check device fingerprint for      │
│    auto-reauth opportunity           │
└──────────────────────────────────────┘
        │
        ▼
Captive Portal UI rendered
(Designer-driven, multi-language)
```

### Stage 3: Authentication (Guest Picks a Method)

The portal presents available auth methods. The guest selects one and submits credentials:

```
Portal UI → POST /api/v1/wifi/auth
{
  "method": "room_number",        // selected method
  "portalSlug": "grand-hotel",    // identifies portal config
  "roomNumber": "101",
  "lastName": "Smith",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "fingerprintHash": "abc123...",  // browser fingerprint
  "storageToken": "xyz789..."      // localStorage token
}
```

### Stage 4: RADIUS Authentication

After credential + IP validation, the system authenticates via FreeRADIUS:

```
StaySuite API ──RADIUS PAP───▶ FreeRADIUS (port 1812/UDP)
                                      │
                                      ▼
                              ┌──────────────────┐
                              │ FreeRADIUS reads  │
                              │ PostgreSQL:       │
                              │  • RadCheck       │
                              │  • RadReply       │
                              │  • RadUserGroup   │
                              │  • RadGroupCheck  │
                              │  • RadGroupReply  │
                              └────────┬─────────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    Access-Accept  Access-Reject  (Timeout)
```

### Stage 5: Active Session Management

After successful auth, the system activates the session:

```
Successful RADIUS Auth
        │
        ├──▶ nftables: Add IP to "loggedinusers" set
        │         Insert fwmark rules in prerouting
        │         Add NAT masquerade rule
        │
        ├──▶ TC HTB: Create bandwidth classes on ifb0/ifb1
        │         Per-user rate limiting (download/upload)
        │         Pool-level rate limiting
        │
        ├──▶ RadAcct: Create accounting session (acctstoptime = NULL)
        │
        └──▶ DeviceProfile: Upsert browser fingerprint for auto-reauth
```

**Firewall Activation** is performed via `staysuite_login.sh`:
- Converts bandwidth from bytes/sec to kbps
- Generates deterministic HTB class IDs from username
- Looks up pool-level bandwidth limits
- Runs synchronously with a 15s timeout
- **Non-fatal**: errors don't block auth response

**Bandwidth Shaping Stack:**

```
                    ┌──────────────────────────────────┐
 Internet ◀─── NAT ──┤  TC HTB Hierarchy               │
                       │                                  │
                       │  ifb0 (download direction)       │
                       │  └── pool-root (pool rate limit) │
                       │       └── user-{classid}         │
                       │           (user rate limit)       │
                       │                                  │
                       │  ifb1 (upload direction)         │
                       │  └── pool-root (pool rate limit) │
                       │       └── user-{classid}         │
                       │           (user rate limit)       │
                       └──────────────────────────────────┘
```

### Stage 6: Guest Check-out (Session Termination)

When a guest checks out:

```
PMS Check-out Event
        │
        ▼
┌───────────────────────────┐
│ wifiUserService           │
│ .deprovisionUser()        │
│                           │
│ HARD DELETE:              │
│  • RadCheck (all rows)    │
│  • RadReply (all rows)    │
│  • RadUserGroup (all)     │
│                           │
│ SOFT UPDATE:              │
│  • WiFiUser.status        │
│    = 'revoked'            │
│  • WiFiUser.radiusSynced  │
│    = true                 │
└───────────────────────────┘
        │
        ▼
FreeRADIUS returns "User not found" on any future auth attempt
Active RADIUS sessions are terminated by the NAS
```

> **Note:** Deprovisioning uses **hard delete** on RADIUS tables (not soft `isActive=false`) because FreeRADIUS queries do not filter by `isActive`. The WiFiUser record itself is preserved with `status='revoked'` for audit purposes.

---

## 3. Authentication Methods

### 3.1 PMS Credentials (`pms_credentials`)

**Best for:** Corporate/business hotels where guests receive printed credentials at check-in.

#### Flow Diagram

```
Guest enters username + password
        │
        ▼
┌───────────────────────┐
│ Look up WiFiUser by   │
│ username              │
└───────────┬───────────┘
            │
     ┌──────┼──────┐
     │      │      │
  Found   Not    Found
           Found   │
            │      ▼
            ▼   Check password
  Error:      │
  INVALID     │
  CREDENTIALS │
            ▼
   ┌─────────────────┐
   │ Check status    │──── Not active ──▶ ACCOUNT_INACTIVE
   │ Check validUntil│──── Expired ────▶ ACCOUNT_EXPIRED
   └────────┬────────┘
            │ Valid
            ▼
   ┌─────────────────┐
   │ Validate IP     │──── Not in pool ──▶ IP_NOT_IN_POOL
   │ in pool         │
   └────────┬────────┘
            │ Valid
            ▼
   ┌─────────────────┐
   │ Ensure RADIUS   │
   │ creds exist     │
   │ (resume if not) │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Check session   │──── Over limit ──▶ MAX_SESSIONS_REACHED
   │ limit           │
   └────────┬────────┘
            │ OK
            ▼
   ┌─────────────────┐
   │ RADIUS Auth     │──── Failed ──▶ AUTH_FAILED
   │ (PAP)           │
   └────────┬────────┘
            │ Accepted
            ▼
   ┌─────────────────┐
   │ Set Session-    │
   │ Timeout to      │
   │ remaining time  │
   │ (never reset    │
   │  validUntil)    │
   └────────┬────────┘
            │
            ▼
   Activate firewall + accounting + device profile
            │
            ▼
       SUCCESS ✓
```

#### Request Format

```json
{
  "method": "pms_credentials",
  "portalSlug": "grand-hotel",
  "username": "guest-abc12345",
  "password": "x9k2m...",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "fingerprintHash": "sha256:abc...",
  "storageToken": "local-token..."
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "pms_credentials",
    "username": "guest-abc12345",
    "sessionTimeout": 1440,
    "remainingMinutes": 1380,
    "bandwidthDown": 10,
    "bandwidthUp": 5,
    "poolName": "guest-vlan-10",
    "message": "Connected successfully!"
  }
}
```

#### How It Works

1. Looks up `WiFiUser` by `username` (exact match)
2. Validates `password` matches `WiFiUser.password` (cleartext comparison)
3. Checks `status === 'active'` and `validUntil > now`
4. Validates client IP is in an allowed pool (derived from `WiFiPlan.ipPoolId` or `WiFiUser.ipPoolId`)
5. Ensures `RadCheck` exists — if deleted, calls `resumeUser()` to re-create RADIUS credentials
6. Checks concurrent session limit from `WiFiUser.maxSessions` or `WiFiPlan.maxDevices`
7. Authenticates via FreeRADIUS PAP
8. Caps `Session-Timeout` in `RadReply` to `min(planValidity, remainingValidity)` — **never resets `validUntil`**
9. Reads bandwidth from `RadReply` (user-level overrides take precedence over group-level)
10. Activates firewall, creates accounting session, upserts device profile

#### Plan-Level Attributes Used

| Attribute | Source | RADIUS Table |
|-----------|--------|-------------|
| Bandwidth (down/up) | `WiFiPlan.downloadSpeed` / `uploadSpeed` | `RadGroupReply` (group) |
| Session Timeout | `WiFiPlan.validityMinutes` or `validityDays` | `RadReply` (user override) |
| Data Limit | `WiFiPlan.dataLimit` | `RadGroupReply` (group) |
| Max Devices | `WiFiPlan.maxDevices` | `RadGroupCheck` (group) |
| Idle Timeout | `CaptivePortal.idleTimeout` | `RadReply` (user) |
| IP Pool | `WiFiPlan.ipPoolId` | Plan-level restriction |

---

### 3.2 Room Number + Last Name (`room_number`)

**Best for:** Budget and mid-range hotels — the most popular method in India. Guests just need to know their room number and last name.

#### Flow Diagram

```
Guest enters room number + last name
        │
        ▼
┌───────────────────────────────┐
│ Query Booking table:          │
│ room.roomNumber = roomNumber  │
│ booking.status = 'in_house'   │
│ (up to 10 results)            │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Find booking where:           │
│ primaryGuest.lastName matches │
│ (case-insensitive)            │
└───────────────┬───────────────┘
                │
         ┌──────┼──────┐
         │      │      │
      Found  Not   Found
              Found    │
               │       ▼
               ▼   ┌───────────────────────────┐
  Error:            │ UNIFICATION: Look for     │
  ROOM_NOT_FOUND    │ existing PMS-provisioned  │
                    │ WiFiUser                  │
                    └───────────┬───────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              Booking     Guest       No
              Match       Match     Match
                    │           │       │
                    │           │       ▼
                    │           │   Create
                    │           │   room-{number}
                    │           │   user (fallback)
                    ▼           ▼
              Reuse PMS   Reuse PMS
              user (best)  user
```

#### Unification: Reusing PMS-Provisioned Users

The room number method implements a **3-step lookup** to avoid creating duplicate users when a guest was already auto-provisioned at check-in:

```
Priority 1: WiFiUser WHERE bookingId = booking.id
            │  (PMS auto-provisioned for THIS booking)
            │
            ├─ Found? → Reuse this user (most precise match)
            │
            ▼ Not found
Priority 2: WiFiUser WHERE guestId = booking.primaryGuestId
            │                 AND status = 'active'
            │                 AND propertyId = booking.propertyId
            │
            ├─ Found? → Reuse this user (same guest, active)
            │
            ▼ Not found
Priority 3: Create room-{number} user (original fallback)
            │  Username: room-101
            │  Password: smith-{bookingId_first_8_chars}
            │  Uses portal defaults for bandwidth
            │  Uses resolved plan for device limit + data cap
```

When reusing a PMS-provisioned user, the guest gets **plan-level bandwidth, data limits, and session timeout** instead of portal defaults.

#### Request Format

```json
{
  "method": "room_number",
  "portalSlug": "grand-hotel",
  "roomNumber": "101",
  "lastName": "Smith",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "fingerprintHash": "sha256:abc...",
  "storageToken": "local-token..."
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "room_number",
    "username": "guest-abc12345",
    "sessionTimeout": 1440,
    "remainingMinutes": 1380,
    "bandwidthDown": 10,
    "bandwidthUp": 5,
    "poolName": "guest-vlan-10",
    "planName": "Deluxe Suite Plan",
    "message": "Connected successfully!"
  }
}
```

#### Plan Resolution

When no PMS-provisioned user exists, the plan is resolved as follows:

```
RoomType.wifiPlanId ──found──▶ Use this plan
        │
        ▼ not found
WiFiAAAConfig.defaultPlanId ──found──▶ Use property default
        │
        ▼ not found
Portal defaults (sessionTimeout, bandwidth)
```

---

### 3.3 Voucher Code (`voucher`)

**Best for:** Cafes, co-working spaces, hotel lobbies, and event venues where guests purchase access via a code.

#### Flow Diagram

```
Guest enters voucher code
        │
        ▼
┌───────────────────────────┐
│ Look up WiFiVoucher by    │
│ code (UPPERCASE)          │
└───────────┬───────────────┘
            │
     ┌──────┼──────┐
     │      │      │
  Found   Not    Found
           Found
            │
            ▼
   ┌────────────────┐
   │ Check status   │──── Not active ──▶ VOUCHER_USED
   │ Check isUsed   │──── Already used ─▶ VOUCHER_USED
   │ Check validUntil│─── Expired ────▶ VOUCHER_EXPIRED
   └───────┬────────┘
           │ Valid
           ▼
   ┌────────────────┐
   │ Validate IP    │──── Not in pool ──▶ IP_NOT_IN_POOL
   │ in pool        │
   └───────┬────────┘
           │ Valid
           ▼
   ┌────────────────┐
   │ Provision user │
   │ username:      │
   │  voucher-abc12 │
   │ password: ABC12│
   └───────┬────────┘
           │
           ▼
   ┌────────────────┐
   │ Check session  │──── Over limit ──▶ MAX_SESSIONS_REACHED
   │ limit          │
   └───────┬────────┘
           │ OK
           ▼
   ┌────────────────┐
   │ RADIUS Auth    │──── Failed ──▶ AUTH_FAILED
   └───────┬────────┘
           │ Accepted
           ▼
   ┌──────────────────────────────┐
   │ ATOMIC VOUCHER MARKING       │
   │ UPDATE ... SET isUsed=true   │
   │ WHERE id=X AND isUsed=false  │
   │                              │
   │ If count=0 → 409 Conflict    │
   │ (prevents double-use race)   │
   └───────┬──────────────────────┘
           │
           ▼
   Activate firewall + accounting + device profile
           │
           ▼
      SUCCESS ✓
```

#### Request Format

```json
{
  "method": "voucher",
  "portalSlug": "lobby-wifi",
  "voucherCode": "ABCDE-FGHIJ",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "fingerprintHash": "sha256:abc...",
  "storageToken": "local-token..."
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "voucher",
    "username": "voucher-abcde-fghij",
    "sessionTimeout": 1440,
    "bandwidthDown": 5,
    "bandwidthUp": 1,
    "poolName": "guest-vlan-20",
    "message": "Connected successfully!"
  }
}
```

#### Atomic Voucher Marking

The voucher is marked as used **after** successful RADIUS auth to prevent credential leaking on failed auth. The `updateMany` with `WHERE isUsed = false` ensures atomicity:

```typescript
const updatedVoucher = await db.wiFiVoucher.updateMany({
  where: { id: voucher.id, isUsed: false },
  data: { isUsed: true, usedAt: new Date(), status: 'used' },
});
if (updatedVoucher.count === 0) {
  // Another request already used this voucher
  return NextResponse.json({ success: false, error: 'Voucher already used' }, { status: 409 });
}
```

---

### 3.4 SMS OTP (`sms_otp`)

**Best for:** Modern/tech-forward hotels that want a phone-based, credential-free experience.

#### Two-Step Flow

```
STEP 1: Send OTP                     STEP 2: Verify OTP
┌────────────────────┐              ┌────────────────────┐
│ Guest enters phone │              │ Guest enters OTP   │
│ number             │              │ code               │
└────────┬───────────┘              └────────┬───────────┘
         │                                   │
         ▼                                   ▼
┌────────────────────┐              ┌────────────────────┐
│ Validate phone     │              │ Look up OTP in      │
│ (10-15 digits)     │              │ otpStore by phone   │
└────────┬───────────┘              └────────┬───────────┘
         │                                   │
         ▼                                   ▼
┌────────────────────┐              ┌────────────────────┐
│ Rate limit check   │              │ Check expiry       │
│ (5 per 15 min)     │              │ (5 minutes)        │
└────────┬───────────┘              └────────┬───────────┘
         │                                   │
    ┌────┼────┐                        ┌─────┼─────┐
    │         │                        │           │
  Limited    OK                     Expired     Valid
    │                                   │
    ▼                                   ▼
┌─────────────┐              ┌────────────────────┐
│ Generate    │              │ Track attempts     │
│ 6-digit OTP │              │ (max 5 wrong)      │
└────────┬────┘              └────────┬───────────┘
         │                           │
         ▼                      ┌────┼────┐
┌────────────────────┐          │         │
│ Store in otpStore  │       Wrong     Correct
│ with 5-min expiry  │          │         │
└────────┬───────────┘          │         │
         │                      │         │
         ▼                      ▼         ▼
┌────────────────────┐   Error:    Validate IP
│ Send via SMS       │   OTP_       → Provision user
│ (Twilio/Vonage/   │   INVALID    → RADIUS Auth
│  MessageBird/Mock) │              → Firewall
└────────┬───────────┘              → Accounting
         │                                   │
         ▼                                   ▼
┌────────────────────┐              ┌────────────────────┐
│ Return:            │              │ Return:            │
│ { otpSent: true }  │              │ { authenticated }  │
│ { otpSent: false } │              │                    │
│ (honest flag)      │              │                    │
└────────────────────┘              └────────────────────┘
```

#### Step 1: Send OTP — Request

```json
{
  "method": "sms_otp",
  "portalSlug": "grand-hotel",
  "phoneNumber": "+919876543210"
}
```

#### Step 1: Send OTP — Response

```json
{
  "success": true,
  "data": {
    "otpSent": true,
    "message": "OTP sent to your phone"
  }
}
```

```json
{
  "success": true,
  "data": {
    "otpSent": false,
    "message": "OTP generated but SMS delivery failed. Please try again.",
    "_error": "Twilio: Insufficient funds"
  }
}
```

> **Honest `otpSent` flag:** The response accurately reports whether the SMS was actually delivered. If delivery fails, `otpSent: false` is returned while the OTP is still stored in memory (available for development/debugging).

#### Step 2: Verify OTP — Request

```json
{
  "method": "sms_otp",
  "portalSlug": "grand-hotel",
  "phoneNumber": "+919876543210",
  "otpCode": "123456"
}
```

#### Step 2: Verify OTP — Response

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "sms_otp",
    "username": "sms-919876543210",
    "sessionTimeout": 1440,
    "bandwidthDown": 5,
    "bandwidthUp": 1,
    "poolName": "guest-vlan-10",
    "message": "Connected successfully!"
  }
}
```

#### Security Features

| Feature | Configuration | Behavior |
|---------|--------------|----------|
| Rate limiting (send) | 5 requests / 15 minutes / phone | Returns `OTP_RATE_LIMITED` with `retryAfterSec` |
| Wrong attempt tracking | Max 5 attempts per OTP | After 5 wrong tries, OTP is deleted |
| OTP expiry | 5 minutes | Returns `OTP_EXPIRED`, requires new OTP |
| Phone validation | 10-15 digits | Returns `INVALID_PHONE` |
| Per-IP rate limiting | 10 requests / 60 seconds | Returns `RATE_LIMITED` (429) |
| Phone normalization | Auto-prepend `+91` for 10-digit numbers | Default India country code |

#### SMS Delivery

The SMS is sent via the adapter system which supports:

```
┌──────────────────────────────────────────┐
│           SMS Provider Chain             │
│                                          │
│  1. Tenant-specific config (DB-first)   │
│     └── getSMSForTenant(tenantId)       │
│                                          │
│  2. Global env-var config                │
│     └── TWILIO_ACCOUNT_SID               │
│         TWILIO_AUTH_TOKEN                │
│         TWILIO_PHONE_NUMBER              │
│                                          │
│  3. Mock adapter (sandbox/development)  │
│     └── Logs to console                  │
└──────────────────────────────────────────┘
```

**OTP Message Template:**
```
Your StaySuite WiFi verification code is: {code}. Valid for 5 minutes. Do not share this code.
```

---

### 3.5 Open Access (`open_access`)

**Best for:** Free WiFi lobbies, cafes, and public areas where no credentials are required.

#### Flow Diagram

```
Guest clicks "Connect Now"
        │
        ▼
┌────────────────────┐
│ Validate IP in     │──── Not in pool ──▶ IP_NOT_IN_POOL
│ managed pool       │
└────────┬───────────┘
         │ Valid
         ▼
┌────────────────────┐
│ Generate unique    │
│ credentials:       │
│  username: open-   │
│    {timestamp}     │
│  password: open-   │
│    {timestamp}     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Provision RADIUS   │
│ user               │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ RADIUS Auth        │
│ Firewall           │
│ Accounting         │
└────────┬───────────┘
         │
         ▼
    SUCCESS ✓
```

#### Request Format

```json
{
  "method": "open_access",
  "portalSlug": "lobby-wifi",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "open_access",
    "username": "open-1712345678901",
    "sessionTimeout": 1440,
    "bandwidthDown": 5,
    "bandwidthUp": 1,
    "poolName": "guest-vlan-10",
    "message": "Connected successfully!"
  }
}
```

#### Key Behaviors

- No credential validation — only IP pool check
- Unique username per request (`open-{timestamp}`)
- Portal defaults applied for bandwidth and session timeout
- All firewall + accounting operations still performed
- Best-effort provisioning — errors don't block auth

---

### 3.6 Auto Auth (`auto_auth`)

**Note:** Auto authentication is **not** handled via the `/api/v1/wifi/auth` endpoint. It uses the `DeviceProfile` fingerprint system for silent re-authentication.

#### How It Works

```
Guest device visits /connect
        │
        ▼
┌────────────────────────────────────┐
│ Client generates browser           │
│ fingerprint (device-fingerprint.ts)│
│                                    │
│ • Canvas fingerprint               │
│ • WebGL renderer info              │
│ • Screen resolution                │
│ • User agent features              │
│ • Timezone + language              │
│ → SHA-256 hash → fingerprintHash   │
│ → Random UUID → storageToken       │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ Client checks localStorage for     │
│ stored token (from previous auth)  │
└──────────────┬─────────────────────┘
               │
         ┌─────┼─────┐
         │           │
      Token       No token
      found
         │
         ▼
┌────────────────────────────────────┐
│ Server: Look up DeviceProfile by   │
│ fingerprintHash + propertyId       │
│                                    │
│ Found + isActive + WiFiUser still  │
│ active + validUntil > now?         │
└──────────────┬─────────────────────┘
               │
         ┌─────┼─────┐
         │           │
      Match      No match
         │
         ▼
┌────────────────────────────────────┐
│ Silent re-auth:                    │
│  • Reuse existing WiFiUser         │
│  • Re-create RADIUS creds if needed│
│  • Activate firewall               │
│  • Create accounting session       │
│  • Update authCount + lastAuthAt   │
│  • Skip portal UI entirely         │
└────────────────────────────────────┘
```

#### DeviceProfile Schema

| Field | Type | Description |
|-------|------|-------------|
| `fingerprintHash` | string | SHA-256 browser fingerprint (unique per device) |
| `storageToken` | string | UUID stored in localStorage (backup identifier) |
| `propertyId` | string | Property where the device was authenticated |
| `wifiUserId` | string | Link to the WiFiUser being used |
| `guestId` | string? | Link to guest record |
| `ipAddress` | string | Last known client IP |
| `macAddress` | string? | Resolved MAC address |
| `deviceType` | string | `mobile`, `tablet`, `desktop`, `tv`, `unknown` |
| `deviceName` | string | `iPhone`, `Android Phone`, `Mac`, etc. |
| `authCount` | int | Number of times this device has authenticated |
| `lastAuthAt` | datetime | Last authentication timestamp |
| `lastSeenAt` | datetime | Last activity timestamp |
| `isActive` | boolean | Whether the device profile is active |

---

## 4. Shared Infrastructure

### 4.1 RADIUS Group-Level Provisioning

WiFi plans map to RADIUS groups via `planNameToGroupName()`:

```
WiFiPlan.name ──▶ planNameToGroupName() ──▶ RADIUS group name

"VIP Suite Plan"    ──▶ "vip_suite_plan"
"Free WiFi"         ──▶ "free_wifi"
"Standard Guest"    ──▶ "standard_guest"
```

#### What Goes Where

```
┌──────────────────────────────────────────────────────────────────┐
│                  RADIUS ATTRIBUTES LAYER MODEL                    │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │ radgroupcheck   │   │ radgroupreply    │   │ radreply     │ │
│  │ (GROUP CHECKS)  │   │ (GROUP REPLIES)  │   │ (USER        │ │
│  │                 │   │                  │   │  OVERRIDES)  │ │
│  │ • Session-      │   │ • WISPr-Bandwidth│   │              │ │
│  │   Timeout       │   │   -Max-Down/Up   │   │ • Session-   │ │
│  │ • Simultaneous- │   │ • Session-       │   │   Timeout    │ │
│  │   Use           │   │   Timeout        │   │   (capped to │ │
│  │ • Cryptsk-Rate- │   │ • Idle-Timeout   │   │   remaining) │ │
│  │   Limit         │   │ • Max-Total/     │   │              │ │
│  │ • Cryptsk-      │   │   Input/Output-  │   │ • Cryptsk-   │ │
│  │   Bandwidth-Max │   │   Octets         │   │   User-      │ │
│  │ • Cryptsk-      │   │ • Mikrotik-Rate- │   │   Profile    │ │
│  │   Session-      │   │   Limit          │   │ • Cryptsk-   │ │
│  │   Timeout       │   │ • ChilliSpot attrs│   │   Plan-Name  │ │
│  │ • Cryptsk-      │   │ • Termination-   │   │              │ │
│  │   Total-Limit   │   │   Action         │   └──────────────┘ │
│  └─────────────────┘   │ • Acct-Interim-  │                    │
│                        │   Interval       │                    │
│                        └──────────────────┘                    │
│                                                                  │
│  radcheck (USER CHECKS)                                         │
│  ┌──────────────────────────────────────────────┐               │
│  │ • Cleartext-Password                         │               │
│  │ • Simultaneous-Use (only if user override)    │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  radusergroup                                                    │
│  ┌──────────────────────────────────────────────┐               │
│  │ username → groupname (maps user to plan)     │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  FreeRADIUS priority: USER attrs > GROUP attrs                   │
└──────────────────────────────────────────────────────────────────┘
```

#### Vendor-Aware Attributes

The system generates attributes for all active NAS vendors at the property:

| Vendor | Check Attributes | Reply Attributes |
|--------|-----------------|------------------|
| **WISPr** (universal) | — | `WISPr-Bandwidth-Max-Down`, `WISPr-Bandwidth-Max-Up` |
| **Cryptsk** | `Cryptsk-Rate-Limit`, `Cryptsk-Bandwidth-Max-Down/Up`, `Cryptsk-Session-Timeout`, `Cryptsk-Total-Limit` | `Cryptsk-Idle-Timeout`, `Cryptsk-User-Profile`, `Cryptsk-Plan-Name`, `Cryptsk-Max-Input/Output-Octets` |
| **MikroTik** | — | `Mikrotik-Rate-Limit`, `Mikrotik-Total-Limit` |
| **ChilliSpot/Coova** | — | `ChilliSpot-Bandwidth-Max-Down/Up`, `ChilliSpot-Max-Total/Input/Output-Octets` |
| **RFC Standard** | — | `Session-Timeout`, `Idle-Timeout`, `Max-Total-Octets`, `Max-Input-Octets`, `Max-Output-Octets`, `Termination-Action`, `Acct-Interim-Interval` |

---

### 4.2 IP Pool Validation

Client IP is validated against allocated IP pools using PostgreSQL inet range comparison.

#### How It Works

```sql
SELECT DISTINCT ON (ip.id)
  ip.id, ip.name, ip.subnet::text, ip.gateway::text,
  ip."captivePortal", ip."isDefault"
FROM "IpPoolRange" r
JOIN "IpPool" ip ON ip.id = r."poolId"
WHERE $1::inet BETWEEN r."startIp" AND r."endIp"
  AND ip.enabled = true
  AND ip.id = ANY($2::uuid[])  -- optional plan restriction
ORDER BY ip.id, ip."isDefault" DESC
LIMIT 1
```

#### Conditions Checked

1. Client IP falls within an `IpPoolRange` (startIp–endIp)
2. The pool is `enabled = true`
3. The pool has `captivePortal = true` (managed network)
4. If `allowedPoolIds` is provided, the matched pool must be in that list (enforces plan→pool binding)

#### IP Resolution Priority

```
resolveAllowedPoolIds(planIpPoolId, userIpPoolId):
  1. WiFiUser.ipPoolId    → user-level override (highest priority)
  2. WiFiPlan.ipPoolId    → plan default
  3. null                 → no restriction, any captive portal pool
```

#### IP Normalization

```
Raw IP  → Strip IPv6-mapped prefix (::ffff:1.2.3.4 → 1.2.3.4)
        → Strip brackets ([::1] → ::1)
        → Validate as IPv4
```

---

### 4.3 Session Management

#### Accounting Sessions (RadAcct)

Each successful auth creates a `RadAcct` record:

| Field | Value |
|-------|-------|
| `acctuniqueid` | Random UUID |
| `acctsessionid` | `{timestamp}-{uuid8}` |
| `username` | WiFi username |
| `nasipaddress` | `127.0.0.1` (this device is the gateway) |
| `nasporttype` | `Wireless-802.11` |
| `acctstarttime` | Current timestamp |
| `acctupdatetime` | Current timestamp |
| `acctauthentic` | `PAP` |
| `framedipaddress` | Client IP |
| `acctstatus` | `start` |
| `acctstoptime` | `NULL` (active session) |
| `loginType` | `portal` or `auto_reauth` |
| `connectinfo_start` | `pool_id=...|pool_name=...|subnet=...|gateway=...` |

#### Firewall Activation

After RADIUS auth, `activateUserFirewall()` runs `staysuite_login.sh`:

```
staysuite_login.sh
├── nft add element inet loggedinusers { ip }
├── nft add rule inet prerouting ... fwmark {classid}
├── nft add rule nat postrouting masquerade
├── tc class add dev ifb0 parent ... classid {classid} htb rate {dnKbps}kbit ceil {ceilDn}kbit
├── tc filter add dev ifb0 ... flowid {classid}
├── tc class add dev ifb1 parent ... classid {classid} htb rate {upKbps}kbit ceil {ceilUp}kbit
└── tc filter add dev ifb1 ... flowid {classid}
```

**Non-fatal behavior:** Firewall activation errors are logged but do NOT block the auth response. The recovery script will catch up if this fails.

#### Bandwidth Shaping

```
                    User-Level Rate
                    (per-user cap)
                         │
                         ▼
              ┌─────────────────┐
              │  User HTB Class │
              │  (ifb0/ifb1)   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Pool HTB Root  │
              │  (shared cap)   │
              └─────────────────┘
```

- **User-level:** Derived from portal config or plan attributes
- **Pool-level:** Looked up from `BandwidthPool` by property + subnet
- Conversion: `bytes/sec × 8 / 1000 = kbps` for the login script

#### Auth Logging

Every auth attempt (success or failure) is logged to `RadPostAuth`:

```
INSERT INTO radpostauth (username, pass, reply, authdate, clientipaddress, "nasIpAddress")
VALUES ($1, $2, $3, NOW(), $4, '127.0.0.1')
```

- `pass` = rejection reason code (e.g., `IP_NOT_IN_POOL:1.2.3.4`, `INVALID_CREDENTIALS`)
- `reply` = `Access-Accept` or `Access-Reject`
- This feeds the `v_auth_logs` view for the Auth Logs dashboard

---

### 4.4 Concurrent Session Limits

Session limits are enforced at two levels:

| Level | RADIUS Table | Attribute | Precedence |
|-------|-------------|-----------|-----------|
| User | `RadCheck` | `Simultaneous-Use` | Higher (overrides group) |
| Group | `RadGroupCheck` | `Simultaneous-Use` | Default (from plan) |

#### Pre-Auth Check

Before RADIUS auth, the system checks active sessions:

```sql
SELECT COUNT(*)::bigint as count
FROM radacct
WHERE username = $1 AND acctstoptime IS NULL
```

If `activeCount >= maxSessions`, the auth is rejected with `MAX_SESSIONS_REACHED`.

```
Session limit resolution:
  WiFiUser.maxSessions → (if set, use this)
  WiFiPlan.maxDevices  → (fallback)
  1                    → (hardcoded minimum)
  0 or negative        → unlimited
```

> **Fail-closed:** If the session count query fails, access is denied (returns `true`).

---

## 5. API Reference

### `POST /api/v1/wifi/auth`

Single endpoint for all authentication methods.

#### Common Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | Yes | Authentication method identifier |
| `portalSlug` | string | Recommended | Captive portal slug for config lookup |
| `macAddress` | string | No | Client MAC address (from URL params) |
| `fingerprintHash` | string | No | Browser fingerprint hash for auto-reauth |
| `storageToken` | string | No | localStorage token for auto-reauth |

#### Method-Specific Request Fields

| Method | Fields | Required |
|--------|--------|----------|
| `pms_credentials` | `username`, `password` | Both required |
| `room_number` | `roomNumber`, `lastName` | Both required |
| `voucher` | `voucherCode` | Required |
| `sms_otp` (step 1) | `phoneNumber` | Required |
| `sms_otp` (step 2) | `phoneNumber`, `otpCode` | Both required |
| `open_access` | — | No fields required |

#### Common Success Response

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "method": "{method}",
    "username": "{wifi_username}",
    "sessionTimeout": 1440,
    "remainingMinutes": 1380,
    "bandwidthDown": 5,
    "bandwidthUp": 1,
    "poolName": "guest-vlan-10",
    "planName": "VIP Suite Plan",
    "message": "Connected successfully!"
  }
}
```

#### SMS OTP Step 1 Response

```json
{
  "success": true,
  "data": {
    "otpSent": true,
    "message": "OTP sent to your phone"
  }
}
```

#### Common Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

#### Error Codes

| Error Code | HTTP Status | Description |
|-----------|-------------|-------------|
| `MISSING_METHOD` | 400 | No `method` field provided |
| `INVALID_METHOD` | 400 | Method not in supported list |
| `MISSING_VOUCHER` | 400 | Voucher code not provided |
| `INVALID_VOUCHER` | 400 | Voucher code not found |
| `VOUCHER_USED` | 400 | Voucher already redeemed |
| `VOUCHER_EXPIRED` | 400 | Voucher past validUntil |
| `MISSING_ROOM` | 400 | Room number not provided |
| `MISSING_NAME` | 400 | Last name not provided |
| `ROOM_NOT_FOUND` | 400 | No in-house booking matches room+name |
| `MISSING_USERNAME` | 400 | Username not provided |
| `MISSING_PASSWORD` | 400 | Password not provided |
| `INVALID_CREDENTIALS` | 400 | Username not found or password mismatch |
| `ACCOUNT_INACTIVE` | 400 | WiFiUser status is not `active` |
| `ACCOUNT_EXPIRED` | 400 | WiFiUser validUntil has passed |
| `MISSING_PHONE` | 400 | Phone number not provided |
| `INVALID_PHONE` | 400 | Phone format invalid (10-15 digits) |
| `OTP_RATE_LIMITED` | 429 | Too many OTP sends (5/15min per phone) |
| `OTP_NOT_FOUND` | 400 | No OTP stored for this phone |
| `OTP_EXPIRED` | 400 | OTP has expired (5 min) |
| `OTP_INVALID` | 400 | Wrong OTP code |
| `OTP_MAX_ATTEMPTS` | 400 | Too many wrong OTP attempts (5 max) |
| `IP_NOT_IN_POOL` | 403 | Client IP not in any managed IP pool |
| `MAX_SESSIONS_REACHED` | 400 | Concurrent session limit exceeded |
| `AUTH_FAILED` | 400 | FreeRADIUS rejected authentication |
| `NO_PROPERTY` | 400 | No property configured for tenant |
| `RATE_LIMITED` | 429 | Per-IP rate limit exceeded (10/min) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 6. Security

### Rate Limiting

#### Per-IP Rate Limiting

```
Applies to: All auth methods
Limit: 10 requests per 60 seconds per IP
Implementation: In-memory Map (use Redis for production)
Response: 429 Too Many Requests
```

```typescript
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxAttempts = 10, windowMs = 60000): boolean
```

#### Per-Phone OTP Rate Limiting

```
Applies to: sms_otp Step 1 only
Limit: 5 OTP sends per 15 minutes per phone number
Implementation: In-memory Map (use Redis for production)
Response: 429 with retryAfterSec
```

```typescript
const OTP_MAX_REQUESTS = 5;
const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
```

### OTP Bombing Prevention

```
Attack:    Attacker sends many OTP requests to random/guest numbers
Defense 1: Per-phone rate limiting (5/15min)
Defense 2: Phone format validation (10-15 digits)
Defense 3: Wrong attempt tracking (max 5 per OTP)
Defense 4: OTP auto-expiry (5 minutes)
Defense 5: OTP deletion after max wrong attempts
Defense 6: Honest otpSent flag (fails gracefully on SMS provider issues)
```

### Device Fingerprinting

```
Purpose:  Silent re-authentication for returning guests
Method:   Browser fingerprinting via Canvas, WebGL, Screen, UA, TZ
Storage:  DeviceProfile table in PostgreSQL
Privacy:  Fingerprint is stored only with property context
Security: Fingerprint uniqueness enforced by DB unique constraint
                      (fingerprintHash, propertyId)
```

### Credential Validation Order

The system validates credentials BEFORE checking IP pool to ensure accurate rejection logging:

```
1. Credentials → Wrong password:  "Rejected — invalid credentials"
2. IP Pool     → Wrong network:   "Rejected — IP not in managed pool"
3. RADIUS      → Wrong auth:      "Rejected — RADIUS auth failed"
```

This prevents false positives where a guest on the wrong network gets a confusing "invalid credentials" message instead of "not connected to hotel WiFi".

---

## 7. Configuration

### WiFiPlan Setup

WiFi plans determine bandwidth, data limits, device limits, and session timeouts for guests:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable plan name (maps to RADIUS group) |
| `downloadSpeed` | number | Max download speed in bytes/sec |
| `uploadSpeed` | number | Max upload speed in bytes/sec |
| `dataLimit` | number? | Data cap in MB (0 = unlimited) |
| `sessionLimit` | number? | Max concurrent sessions (0 = unlimited) |
| `sessionTimeoutSec` | number? | RADIUS Session-Timeout in seconds |
| `idleTimeoutSec` | number? | Idle disconnect timeout in seconds |
| `validityMinutes` | number? | Plan validity in minutes |
| `validityDays` | number? | Plan validity in days |
| `maxDevices` | number? | Max devices per user |
| `ipPoolId` | string? | Bind plan to specific IP pool |

### CaptivePortal Setup

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `slug` | string | — | URL-friendly identifier |
| `sessionTimeout` | number | 86400 (24h) | Session duration in **seconds** |
| `idleTimeout` | number? | null | Idle disconnect in seconds |
| `maxBandwidthDown` | number | 5242880 (5 Mbps) | Default download in bytes/sec |
| `maxBandwidthUp` | number | 1048576 (1 Mbps) | Default upload in bytes/sec |
| `enabled` | boolean | true | Portal active/inactive |
| `propertyId` | string | — | Linked property |

### WiFiAAAConfig (Default Plan Per Property)

```typescript
const aaaConfig = await db.wiFiAAAConfig.findUnique({
  where: { propertyId: propertyId },
  select: { defaultPlanId: true },
});
```

The `defaultPlanId` is used as a fallback when:
- Room type has no WiFi plan assigned
- SMS OTP / Open Access need device limits and data caps

### RoomType → WiFiPlan Binding

```
RoomType.wifiPlanId ──▶ WiFiPlan
```

When a guest authenticates via room number:
1. Look up `RoomType.wifiPlanId` from the booking's room type
2. If set, use that plan for device limits and data caps
3. If not set, fall back to `WiFiAAAConfig.defaultPlanId`
4. If still null, use portal defaults (5 Mbps / 1 Mbps)

### SMS Provider Setup

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

#### Database Configuration (Per-Tenant)

SMS config is loaded from the database first (`getTwilioConfig(tenantId)`), then falls back to environment variables. This enables multi-tenant SMS provider configuration.

#### Provider Support

| Provider | Status | Config Source |
|----------|--------|--------------|
| **Twilio** | Production | DB-first, env fallback |
| **Mock** | Development/Sandbox | Default fallback (console logging) |

The SMS adapter uses a singleton pattern with `getSMS()` for the global instance and `getSMSForTenant(tenantId)` for per-tenant instances.

---

## Appendix: MAC Address Resolution

The system resolves client MAC addresses using three methods in priority order:

```
Priority 1: Request Body
  • Passed from URL query params (?mac=AA:BB:CC:DD:EE:FF)
  • UniFi, Mikrotik, Cisco redirect MAC to captive portal URL

Priority 2: HTTP Headers
  • X-MAC-Address, Client-MAC, Calling-Station-Id
  • mac (Mikrotik, CoovaChilli)
  • nas-mac (UniFi)
  • x-client-mac, x-forwarded-mac

Priority 3: DHCP Lease Lookup
  • Query DhcpLease table by client IP
  • Requires KEA/DHCP running with recorded leases
  • Non-critical: failure does not block auth
```

## Appendix: Username Patterns

| Auth Method | Username Pattern | Password |
|-------------|-----------------|----------|
| PMS Credentials | `guest-{propertyId_short}-{random}` | Random 24-byte hex |
| Room Number (PMS reuse) | Existing PMS username | Existing PMS password |
| Room Number (fallback) | `room-{room_number}` | `{lastName}-{bookingId[:8]}` |
| Voucher | `voucher-{code_lowercase}` | Original voucher code |
| SMS OTP | `sms-{digits_only_phone}` | OTP code |
| Open Access | `open-{timestamp}` | `open-{timestamp}` |

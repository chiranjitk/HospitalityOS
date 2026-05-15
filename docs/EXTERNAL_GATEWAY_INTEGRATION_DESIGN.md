# External Gateway Integration — StaySuite Captive Portal on MikroTik

> **Feature Code:** EXT-GW-PORTAL  
> **Version:** 1.0 — Design Document (Pre-Development)  
> **Status:** AWAITING FINAL CALL  
> **Date:** 2025-01  
> **Scope:** Use StaySuite as AAA + Captive Portal with external MikroTik as network gateway

---

## 1. Problem Statement

StaySuite currently works in **Internal NAS Mode**: StaySuite's own server (or Cryptsk native gateway) handles DHCP, firewall (nftables), bandwidth (tc), and session tracking. The captive portal at `/connect` authenticates guests and then directly opens the firewall via `staysuite_login.sh`.

**New requirement:** Deploy StaySuite with an **external MikroTik** as the network gateway. MikroTik handles WiFi, DHCP, and firewall. StaySuite acts purely as **AAA server** (authentication + authorization + accounting) + provides its own **captive portal UI** via `/connect`. The session engine + nftables bandwidth tracking is **NOT used** in this mode.

---

## 2. Architecture — Two Modes

### Current Mode (Unchanged)

```
Guest → WiFi → StaySuite Server → DHCP → nftables → Internet
         │
         └── /connect → /api/v1/wifi/auth → activateUserFirewall() → tc bandwidth → Internet
                        → nftables counters → session-engine tracking
```

### New Mode: External Gateway (MikroTik)

```
Guest → MikroTik WiFi → DHCP (MikroTik) → HTTP Redirect → /connect
         │                                              │
         │                                       StaySuite Portal
         │                                              │
         │                                      Guest enters creds
         │                                              │
         │                                      /api/v1/wifi/auth
         │                                      → validates credentials
         │                                      → creates radcheck/radreply
         │                                      → RADIUS auth (local FreeRADIUS)
         │                                      → returns { authenticated, redirectUrl }
         │                                              │
         │                                      Portal redirects to:
         │                                      http://<mikrotik>/login?username=X&password=Y
         │                                              │
         └──────── MikroTik RADIUS Access-Request ──────┘
                    (to FreeRADIUS on port 1812)
                              │
                    FreeRADIUS Accept
                    (Mikrotik-Rate-Limit, Session-Timeout etc.)
                              │
                    MikroTik opens firewall → Guest online
                              │
                    Accounting → FreeRADIUS (radacct)
```

### Key Difference

| Aspect | Internal NAS Mode | External Gateway Mode |
|--------|-------------------|----------------------|
| DHCP | StaySuite (KEA) | MikroTik |
| Firewall | nftables on StaySuite | MikroTik firewall |
| Bandwidth | tc on StaySuite | MikroTik (via RADIUS attributes) |
| Session tracking | nftables counters + session-engine | radacct (RADIUS accounting) |
| Captive portal | StaySuite `/connect` | StaySuite `/connect` |
| AAA | FreeRADIUS (local) | FreeRADIUS (local) |
| Post-auth redirect | None (direct firewall open) | **Redirect to MikroTik login URL** |

---

## 3. What Does NOT Change

1. **`/connect` portal page** — No changes. It already renders all themes, languages, auth methods.
2. **`/api/v1/wifi/auth` credential validation** — No changes. Voucher, room, PMS, SMS OTP, open access all work.
3. **RADIUS user creation** — No changes. `provisionOrResumeUser()` writes to `radcheck`/`radreply`.
4. **FreeRADIUS config** — No changes. It already reads from PostgreSQL.
5. **MikroTik adapter** — No changes. CoA, disconnect, bandwidth update already work.
6. **`freeradius-service` (port 3010)** — No changes. radclient proxy already works.
7. **Portal resolve-zone API** — Already IP-based, works unchanged.
8. **Device fingerprint + auto-auth** — Already works, unchanged.

---

## 4. What Changes — Exactly

### 4.1 Database: `WiFiGateway` Model — Add 3 Fields

**File:** `prisma/schema.prisma` — model `WiFiGateway` (line 7221)

Add these fields:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `externalPortalMode` | `Boolean` | `false` | When true, this gateway is external — StaySuite uses its own portal, not the gateway's built-in portal |
| `portalRedirectUrl` | `String?` | `null` | The URL to redirect the guest to after StaySuite auth. For MikroTik: `http://<mikrotik-ip>/login` |
| `walledGardenIps` | `String[]` | `[]` | IP addresses that MikroTik must whitelist (StaySuite server IP) so the portal loads before auth |

**Prisma migration:** Add 3 columns, no table recreation.

**Why these 3 fields only:**
- `externalPortalMode` — a single boolean flag on the gateway tells the auth router "this gateway needs redirect-back flow"
- `portalRedirectUrl` — the auth router needs to know WHERE to redirect after auth (MikroTik login endpoint)
- `walledGardenIps` — optional, for the admin to configure which IPs should be whitelisted on MikroTik

### 4.2 Backend: `/api/v1/wifi/auth/route.ts` — Add Redirect Logic

**This is the ONLY code change in the auth flow.**

Current behavior (simplified):
```
validate credentials → provision RADIUS user → radiusAuth() → 
activateUserFirewall() → addUserCounter() → return successResponse()
```

New behavior when `externalPortalMode = true`:
```
validate credentials → provision RADIUS user → radiusAuth() →
SKIP activateUserFirewall() → SKIP addUserCounter() →
return successResponse({ ...existing fields..., redirectUrl: portalRedirectUrl, radiusUsername, radiusPassword })
```

**Specifically:**
1. After `radiusAuth()` succeeds, check: does the portal have a gateway with `externalPortalMode = true`?
2. If YES → skip `activateUserFirewall()` and `addUserCounter()` (those are internal NAS only)
3. Add `redirectUrl` and `radiusPassword` to the success response
4. If NO → run existing flow unchanged (zero behavior change)

**Detection logic:**
```
const gateway = await db.wiFiGateway.findFirst({
  where: { 
    propertyId: resolvedPropertyId, 
    status: 'active',
    externalPortalMode: true 
  }
});

if (gateway?.externalPortalMode) {
  // External gateway mode — skip local firewall, add redirect
  return successResponse({
    ...existingData,
    redirectUrl: gateway.portalRedirectUrl,
    radiusUsername: wifiUsername,
    radiusPassword: userPassword,  // the password written to radcheck
  });
} else {
  // Internal NAS mode — existing flow (unchanged)
  await activateUserFirewall({...});
  addUserCounter(ip);
  return successResponse({ ...existingData });
}
```

### 4.3 Frontend: `wifi-connect-portal.tsx` — Handle Redirect

In `SuccessScreen` component (line 1572), after showing "Connected!" for 3 seconds, if `authResult.redirectUrl` exists, redirect the browser:

```
http://<mikrotik-ip>/login?username=<radiusUsername>&password=<radiusPassword>
```

This triggers MikroTik's HTTP login API, which then sends a RADIUS Access-Request to FreeRADIUS. FreeRADIUS finds the user (already in `radcheck`) and returns Accept with bandwidth attributes.

**No changes** to auth form, validation, fingerprint, or any other portal component.

### 4.4 GUI: `gateway-integration.tsx` — Add 3 Fields to Gateway Dialog

In the "Add/Edit Gateway" dialog, under the existing "RADIUS & CoA Settings" section, add a new section:

**Section: "External Portal Mode"**

| Field | Type | Description |
|-------|------|-------------|
| Enable External Portal | Switch | When ON, StaySuite portal is used instead of gateway's built-in portal |
| Portal Redirect URL | Text Input | URL to redirect after auth (e.g., `http://192.168.1.1/login`) |
| Walled Garden IPs | Text Input (comma-separated) | IPs that must be whitelisted on gateway (e.g., `10.0.0.50`) |

**Conditional visibility:** This section only appears when `type === 'mikrotik'` (can be extended later for other vendors).

**Gateway card badge:** When `externalPortalMode = true`, show a badge on the gateway card: "External Portal".

### 4.5 No Changes To

- `gateway-radius-page.tsx` — No new tabs. The "WiFi Controller" tab already has all the UI.
- `aaa-config.tsx` — No changes.
- `portal-page.tsx` — No changes.
- `wifi-access-page.tsx` — No changes.
- `captive-redirect` mini-service — Not used in this flow.
- `session-engine` — Not used for external gateway sessions.
- `nftables` — Not used for external gateway sessions.

---

## 5. Data Flow — Step by Step

### Step 1: Admin Configures MikroTik Gateway

```
Admin → WiFi → RADIUS & Gateway → WiFi Controller tab
  → "Add Gateway"
  → Type: MikroTik RouterOS
  → IP: 192.168.1.1
  → RADIUS Secret: sharedsecret123
  → CoA: Enabled, Port 3799
  → [NEW] External Portal Mode: ON
  → [NEW] Portal Redirect URL: http://192.168.1.1/login
  → [NEW] Walled Garden IPs: 10.0.0.50 (StaySuite server)
  → Save
```

### Step 2: Guest Connects to MikroTik WiFi

```
Guest phone → Connect to "HotelWiFi" SSID
MikroTik → DHCP assigns IP (e.g., 10.10.0.55)
Guest opens browser → MikroTik HTTP redirect → http://10.0.0.50/connect?mac=AA:BB:CC:DD:EE:FF
```

### Step 3: StaySuite Portal Loads

```
/connect → resolve-zone API → finds portal config by IP (10.10.0.55 matches MikroTik subnet)
→ renders designer-driven portal (theme, language, form fields)
→ guest enters voucher code / room+name / password
```

### Step 4: Authentication

```
/api/v1/wifi/auth (POST)
  → validates credentials (existing code, unchanged)
  → provisionOrResumeUser() → writes radcheck/radreply (unchanged)
  → radiusAuth() → FreeRADIUS Accept (unchanged)
  → checks gateway.externalPortalMode → TRUE
  → SKIPS activateUserFirewall() + addUserCounter()
  → returns: {
      authenticated: true,
      username: "room-101",
      sessionTimeout: 1440,
      bandwidthDown: 5,
      bandwidthUp: 1,
      redirectUrl: "http://192.168.1.1/login",
      radiusUsername: "room-101",
      radiusPassword: "smith101"
    }
```

### Step 5: Portal Redirects to MikroTik

```
SuccessScreen shows "Connected!" for 3 seconds
→ window.location.href = "http://192.168.1.1/login?username=room-101&password=smith101"
```

### Step 6: MikroTik Completes Auth

```
MikroTik receives /login request
→ sends RADIUS Access-Request to FreeRADIUS (127.0.0.1:1812)
  User-Name: room-101
  User-Password: smith101
  NAS-IP-Address: 192.168.1.1
  NAS-Identifier: mikrotik-1
→ FreeRADIUS looks up radcheck → match found
→ returns Access-Accept with:
  Mikrotik-Rate-Limit: "1000k/5000k"
  Session-Timeout: 86400
  Idle-Timeout: 300
→ MikroTik opens firewall for 10.10.0.55
→ Guest has internet with bandwidth limits
```

### Step 7: Accounting (Existing)

```
MikroTik → RADIUS Accounting-Request (Start) → FreeRADIUS → radacct table
MikroTik → RADIUS Accounting-Request (Interim-Update) → radacct table (every 60s)
MikroTik → RADIUS Accounting-Request (Stop) → radacct table (session closed)
```

---

## 6. MikroTik RouterOS Configuration (Generated by StaySuite)

StaySuite will have a "Generate MikroTik Setup Script" button in the gateway config dialog that outputs:

```routeros
# ═══════════════════════════════════════════════════
# StaySuite External Gateway Setup — MikroTik RouterOS
# Generated by StaySuite HospitalityOS
# ═══════════════════════════════════════════════════

# 1. HOTSPOT — Disable built-in portal, redirect to StaySuite
/ip hotspot
add name=staysuite-guest interface=bridge disabled=no

/ip hotspot profile
add name=staysuite-profile hotspot-address=10.10.0.1 \
    html-directory=none \
    login-by=http-chap,http-pap \
    html-override=\
    "/connect?mac=$(mac)&identity=$(identity)&ip=$(ip)" \
    use-radius=yes

# 2. RADIUS — Point to StaySuite FreeRADIUS
/radius
add address=10.0.0.50 secret=sharedsecret123 service=hotspot,ip timeout=3000ms \
    timeout=3000ms accounting-port=1813 auth-port=1812

/radius
add address=10.0.0.50 secret=sharedsecret123 service=hotspot,ip timeout=3000ms \
    timeout=3000ms accounting-port=1813 auth-port=1812

# 3. HOTSPOT SERVER — Bind RADIUS
/ip hotspot server profile
set [find name=staysuite-guest] use-radius=yes

# 4. WALLED GARDEN — Whitelist StaySuite server
/ip hotspot walled-garden
add dst-host=10.0.0.50
add dst-host=10.0.0.50 dst-port=80
add dst-host=10.0.0.50 dst-port=443

# 5. RADIUS NAS — Configure CoA (port 3799)
/radius incoming
set accept=yes port=3799

# 6. IP POOL — Guest DHCP range
/ip pool
add name=guest-pool ranges=10.10.0.10-10.10.0.250

/ip dhcp-server
add name=guest-dhcp interface=bridge address-pool=guest-pool \
    lease-time=1d disabled=no

# 7. DNS — Allow through walled garden
/ip hotspot walled-garden
add dst-host=8.8.8.8 dst-port=53
add dst-host=8.8.4.4 dst-port=53

# 8. COA — Enable Change of Authorization
/tool user-manager
set access-port=3799
```

**This script is informational only** — displayed in a dialog or copyable text block. Admins paste it into MikroTik terminal. No MikroTik API automation needed (though it could be added later via the existing MikroTik adapter REST API).

---

## 7. File Change Summary

| File | Change Type | Lines Changed (Estimate) |
|------|------------|--------------------------|
| `prisma/schema.prisma` | Add 3 fields to WiFiGateway | +8 lines |
| `src/app/api/v1/wifi/auth/route.ts` | Add external gateway check after radiusAuth, skip firewall | +30 lines |
| `src/app/connect/wifi-connect-portal.tsx` | Add redirect in SuccessScreen | +15 lines |
| `src/components/wifi/gateway-integration.tsx` | Add "External Portal Mode" section in dialog + gateway badge | +80 lines |
| **Total** | **4 files** | **~133 lines** |

---

## 8. What Stays Unchanged (Guaranteed No Regression)

| Component | Reason |
|-----------|--------|
| Internal NAS mode flow | Gated by `externalPortalMode` boolean — when false, runs existing code path |
| All auth methods (voucher, room, PMS, SMS OTP, open) | Validation logic unchanged, only post-auth path diverges |
| FreeRADIUS config | No changes to any RADIUS config files |
| Portal designer, themes, languages | No changes to portal rendering |
| Device fingerprint + auto-auth | No changes |
| Bandwidth enforcement (internal mode) | `activateUserFirewall()` still called when `externalPortalMode = false` |
| Session engine + nftables counters | Still called when `externalPortalMode = false` |
| CoA / disconnect | Already works via freeradius-service, unchanged |
| Accounting (radacct) | FreeRADIUS handles this, unchanged |
| WiFi Controller tab structure | No new tabs, just extra fields in existing dialog |

---

## 9. Risk Analysis

| Risk | Mitigation |
|------|-----------|
| MikroTik `/login` endpoint format changes | Only tested with standard RouterOS hotspot login. Document supported versions (6.43+). |
| Redirect URL not reachable from guest network | Admin must configure walled garden on MikroTik. Setup script includes this. |
| Guest refreshes `/connect` after auth | Auto-auth (fingerprint) detects returning device and skips to success screen. |
| RADIUS secret mismatch | Admin configures same secret in both StaySuite gateway dialog and MikroTik RADIUS config. |
| Gateway has `externalPortalMode = true` but no `portalRedirectUrl` | Auth router treats this as internal mode (fallback). Won't break. |
| Multiple gateways with mixed modes | Auth router checks propertyId → finds active gateway with `externalPortalMode`. If multiple, uses first match. |

---

## 10. Testing Checklist

| # | Test Case | Mode | Expected Result |
|---|-----------|------|-----------------|
| 1 | Voucher auth, internal NAS | Internal | Firewall opens, bandwidth enforced by tc, session tracked |
| 2 | Room auth, internal NAS | Internal | Same as above |
| 3 | Voucher auth, external gateway | External | No firewall activation, response includes redirectUrl |
| 4 | Room auth, external gateway | External | Same as above |
| 5 | Redirect after auth | External | Portal shows success, then redirects to MikroTik login URL |
| 6 | MikroTik RADIUS auth after redirect | External | MikroTik sends Access-Request → FreeRADIUS Accept → guest online |
| 7 | Bandwidth enforcement | External | MikroTik applies Mikrotik-Rate-Limit from radgroupreply |
| 8 | CoA disconnect from admin panel | External | Admin clicks disconnect → MikroTik receives CoA → session terminated |
| 9 | Auto-auth returning device | External | Fingerprint matches → auto-authenticated → redirected to MikroTik |
| 10 | Gateway `externalPortalMode = false` | Internal | Zero behavior change from current |

---

## 11. Future Extensions (NOT in This Scope)

1. **Automated MikroTik setup** — Push config via MikroTik REST API (already supported by adapter)
2. **Multi-vendor support** — Cisco Meraki, UniFi, Aruba portal redirect (same pattern, different login URL format)
3. **Per-property gateway mode** — Some properties internal, some external
4. **MikroTik walled garden auto-sync** — Automatically push StaySuite IP to MikroTik when gateway is configured
5. **External accounting source** — Pull active sessions from MikroTik instead of radacct

---

## 12. Implementation Order

| Step | Task | Effort | Dependency |
|------|------|--------|------------|
| 1 | Add 3 fields to `WiFiGateway` Prisma model + `bun run db:push` | 10 min | None |
| 2 | Add "External Portal Mode" section in `gateway-integration.tsx` dialog | 30 min | Step 1 |
| 3 | Add external gateway check in `/api/v1/wifi/auth/route.ts` | 30 min | Step 1 |
| 4 | Add redirect logic in `wifi-connect-portal.tsx` SuccessScreen | 15 min | Step 3 |
| 5 | Add "Generate Setup Script" button in gateway dialog | 20 min | Step 2 |
| 6 | Test internal NAS mode (regression) | 15 min | Step 3 |
| 7 | Test external gateway mode (e2e) | 15 min | Steps 1-5 |

**Total estimated effort: ~2.5 hours**

---

**AWAITING FINAL CALL.** Confirm this design and I'll start development.

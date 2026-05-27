# AD/LDAP Integration with FreeRADIUS — Architecture & Setup Guide

> **Module:** RADIUS & Gateway → AD/LDAP Tab  
> **Status:** Production-Ready (Feature Flag — OFF by default)  
> **Version:** 1.0.0  
> **Last Updated:** May 2026

---

## 1. Overview

Enterprise hotels and resorts often need to authenticate **corporate guests** (business travelers, conference attendees, long-term residents) using their existing **Active Directory** or **LDAP** credentials — instead of creating temporary room-based credentials.

This module integrates FreeRADIUS with external AD/LDAP directories, enabling:

- **LDAP Bind (PAP)** — OpenLDAP, 389DS, cloud LDAP (Google Secure LDAP, AWS Managed AD)
- **MS-CHAPv2 (ntlm_auth)** — Active Directory, Azure AD, Samba4
- **EAP-TTLS + LDAP Inner** — 802.1X / WPA2-Enterprise / WPA3-Enterprise

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Feature Flag** | Per-property `enabled` toggle. OFF by default. Zero impact on existing FreeRADIUS flow when disabled. |
| **Non-Breaking** | LDAP is added BEFORE SQL in FreeRADIUS authorize{}. If LDAP search fails, SQL auth (existing guest flow) takes over. |
| **Isolated Schema** | Separate `RadiusLDAPConfig` model — not mixed with existing `SSOConnection` or `RadiusServerConfig`. |
| **Separation of Concerns** | Application SSO (staff login) uses `SSOConnection`. Guest WiFi AAA uses `RadiusLDAPConfig`. |

---

## 2. Architecture

### 2.1 End-to-End Authentication Flow

```
┌──────────────┐     RADIUS Access-Request      ┌──────────────────┐
│   WiFi AP    │ ◀────────────────────────────── │   FreeRADIUS     │
│  (NAS)       │ ───────────────────────────────▶ │   Server         │
└──────────────┘     (User-Password: "jd@corp")  │                  │
                                                  │  1. authorize{}  │
                                                  │     ├─ ldap      │ → Search user in AD/LDAP
                                                  │     │   └─ fail → -sql (fallback)
                                                  │     └─ sql       │ → Check radcheck (transient)
                                                  │
                                                  │  2. authenticate{}│
                                                  │     ├─ ntlm_auth → AD validates MS-CHAPv2
                                                  │     ├─ ldap      → bind-as-user (PAP)
                                                  │     └─ PAP/CHAP  → SQL password check
                                                  │
                                                  │  3. post-auth{}  │
                                                  │     ├─ Ldap-Group → Map AD groups → RADIUS attrs
                                                  │     └─ sql       → Reply attrs (bandwidth/VLAN)
                                                  │
                                            RADIUS Access-Accept     ┌─────────────────┐
                                            (Session-Timeout,        │  AD/LDAP Server  │
                                             WISPr-Bandwidth)         │  192.168.x.x     │
                                                                       │  port 389/636   │
                                                                       └─────────────────┘
```

### 2.2 Auth Priority (LDAP enabled)

```
Access-Request arrives
    │
    ├─ authorize{} — LDAP first, SQL fallback
    │   ├─ ldap: Search for user DN in AD
    │   │   └─ Found: set control:Ldap-UserDn, Ldap-Group
    │   │   └─ Not found: continue to SQL
    │   └─ sql: Check radcheck for transient guests
    │
    ├─ authenticate{} — Method-specific
    │   ├─ MS-CHAPv2 + ntlm_auth: AD validates challenge/response
    │   ├─ LDAP Bind-as-User: User's password verified against AD
    │   └─ PAP/CHAP: SQL password check (existing flow)
    │
    └─ post-auth{} — Attribute mapping
        ├─ Ldap-Group → Assign RADIUS reply attributes from AD groups
        └─ sql → Existing reply attributes (Session-Timeout, bandwidth)
```

### 2.3 When LDAP is DISABLED (Default)

```
Access-Request arrives
    │
    ├─ authorize{} — SQL only (ldap module not loaded)
    │   └─ sql: Check radcheck
    │
    ├─ authenticate{} — Existing methods only
    │   └─ PAP/CHAP/MS-CHAP: SQL password
    │
    └─ post-auth{} — SQL reply attributes only
```

**Zero changes to existing flow.** The LDAP module is not even loaded by FreeRADIUS.

---

## 3. Database Schema

### RadiusLDAPConfig Model

```prisma
model RadiusLDAPConfig {
  id              String    @id @default(uuid()) @db.Uuid
  tenantId        String    @db.Uuid
  propertyId      String    @unique @db.Uuid
  enabled         Boolean   @default(false)

  // Connection
  serverUrl       String    // "ldaps://ad.corp.com:636"
  baseDn          String    // "DC=corp,DC=com"
  bindDn          String    // "CN=readonly,OU=ServiceAccounts,DC=corp,DC=com"
  bindPassword    String    // AES-256 encrypted at rest
  searchFilter    String    @default("(sAMAccountName=%{User-Name})")
  useTls          Boolean   @default(true)
  useStartTls     Boolean   @default(false)
  timeout         Int       @default(30)
  poolMin         Int       @default(5)
  poolMax         Int       @default(20)
  networkTimeout  Int       @default(5)

  // Auth methods
  ldapBindAuth    Boolean   @default(true)   // PAP via bind-as-user
  mschapAuth      Boolean   @default(false)  // MS-CHAPv2 via ntlm_auth
  eapTtlsAuth     Boolean   @default(false)  // EAP-TTLS + LDAP inner

  // ntlm_auth (MS-CHAPv2 for AD)
  ntlmAuthPath    String    @default("/usr/bin/ntlm_auth")
  winbindDomain   String?   // "CORP"

  // Attribute mapping
  usernameAttr    String    @default("sAMAccountName")
  groupAttr       String    @default("memberOf")
  filterGroup     String?   // Restrict to specific AD group

  // Auto-provisioning
  autoSyncGroups     Boolean @default(false)
  syncIntervalMin    Int     @default(60)
  defaultPlanId      String?
  autoAssignPlan     Boolean @default(false)

  // Status tracking
  lastTestAt       DateTime?
  lastTestOk       Boolean?
  lastTestLatencyMs Int?
  lastSyncAt       DateTime?
  usersSynced      Int       @default(0)
  status           String    @default("inactive")
}
```

---

## 4. File Structure

### Frontend
| File | Purpose |
|------|---------|
| `src/components/wifi/ldap-radius-config.tsx` | Main UI component (7 sections) |
| `src/components/wifi/gateway-radius-page.tsx` | Tab page (added 'ldap' tab) |

### API Routes
| Route | Method | Action |
|-------|--------|--------|
| `/api/wifi/radius-ldap` | GET | Fetch config for property |
| `/api/wifi/radius-ldap` | POST | Save (upsert) config |
| `/api/wifi/radius-ldap` | POST `action=test` | Test LDAP connection |
| `/api/wifi/radius-ldap` | POST `action=toggle` | Enable/disable module |
| `/api/wifi/radius-ldap` | POST `action=diagnostics` | Full diagnostic check |
| `/api/wifi/radius-ldap` | POST `action=search-users` | Search AD/LDAP users |
| `/api/wifi/radius-ldap` | POST `action=sync-groups` | Sync AD groups → RADIUS |

### Mini-Service (FreeRADIUS Manager)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/service/apply-ldap-config` | POST | Write ldap module config + toggle in sites + reload |
| `/api/service/ldap-diagnostics` | POST | Check module status, ntlm_auth, config state |

### FreeRADIUS Config Files Modified
| File | Change |
|------|--------|
| `mods-available/ldap` | Full rlm_ldap config generated from StaySuite settings |
| `mods-enabled/ldap` | Symlink created/removed based on enabled state |
| `sites-available/default` | `-ldap` added/removed in authorize{}, Auth-Type LDAP in authenticate{}, Ldap-Group in post-auth{} |
| `mods-available/mschap` | ntlm_auth path configured when MS-CHAPv2 enabled |

---

## 5. Authentication Methods

### 5.1 LDAP Bind-as-User (PAP)
- **Protocol:** PAP (Password Authentication Protocol)
- **How it works:** FreeRADIUS connects to LDAP, searches for user DN, then re-binds as the user with their password
- **Use case:** OpenLDAP, 389 Directory Server, cloud LDAP (Google Secure LDAP)
- **Requirements:** Network access to LDAP server on port 389 or 636

### 5.2 MS-CHAPv2 via ntlm_auth (Active Directory)
- **Protocol:** MS-CHAPv2 (Microsoft Challenge Handshake)
- **How it works:** FreeRADIUS sends challenge → AP sends MS-CHAPv2 response → FreeRADIUS calls `ntlm_auth` helper → AD validates
- **Use case:** Active Directory (on-premise), Azure AD, Samba4
- **Requirements:** Samba + winbind installed and joined to AD domain
- **Setup:** `net ads join -U admin` on the RADIUS server

### 5.3 EAP-TTLS + LDAP Inner (802.1X)
- **Protocol:** EAP-TTLS outer tunnel, PAP inner auth against LDAP
- **How it works:** TLS outer tunnel established, then PAP credentials validated against LDAP inside the tunnel
- **Use case:** Enterprise 802.1X (WPA2-Enterprise / WPA3-Enterprise)
- **Requirements:** TLS certificates configured in FreeRADIUS

---

## 6. Setup Guide

### 6.1 Prerequisites

| For | Requirement |
|-----|-------------|
| LDAP Bind (PAP) | Network access to LDAP server (port 389 or 636) |
| MS-CHAPv2 (AD) | Samba + winbind installed, joined to AD domain |
| EAP-TTLS | TLS certificates in FreeRADIUS |

### 6.2 Active Directory Setup (MS-CHAPv2)

```bash
# 1. Install Samba + winbind
sudo dnf install samba-winbind samba-winbind-clients -y

# 2. Join the AD domain
sudo net ads join -U admin -D CORP

# 3. Verify ntlm_auth works
ntlm_auth --domain=CORP --username=admin --password=******

# 4. Verify ntlm_auth binary path
which ntlm_auth
# Output: /usr/bin/ntlm_auth
```

### 6.3 OpenLDAP Setup (PAP)

No server-side prerequisites beyond network access. Just configure:
- Server URL: `ldaps://ldap.example.com:636` or `ldap://10.0.0.1:389`
- Base DN: `dc=example,dc=com`
- Bind DN: `cn=readonly,ou=serviceaccounts,dc=example,dc=com`
- Search Filter: `(uid=%{User-Name})` or `(sAMAccountName=%{User-Name})`

### 6.4 In StaySuite UI

1. Navigate to **RADIUS & Gateway → AD/LDAP** tab
2. Fill in **Connection Settings** (Server URL, Base DN, Bind DN, Bind Password)
3. Click **Test Connection** to verify
4. Choose **Authentication Method** (at least one must be enabled)
5. Click **Save Configuration**
6. Toggle the **Enable** switch — this activates LDAP in FreeRADIUS
7. Verify in **Status & Diagnostics** that the module is active

---

## 7. Security Considerations

### 7.1 Password Storage
- LDAP bind passwords are stored in the database (encrypted at rest via AES-256-GCM in the Prisma schema)
- The password is written to FreeRADIUS's `mods-available/ldap` config file (only readable by `radiusd` user)

### 7.2 TLS/Encryption
- **LDAPS (port 636):** Recommended — full TLS encryption from connection start
- **StartTLS:** Upgrades plain LDAP to TLS after initial connection
- **Plain LDAP:** Not recommended — credentials sent in cleartext

### 7.3 Bind DN Best Practices
- Use a **read-only service account** (not admin)
- Restrict the service account to only read user/group attributes
- Set minimum necessary permissions: `read` on `baseDn` subtree

### 7.4 Filter Group
- When `filterGroup` is set, only members of that AD group can authenticate
- Example: `CN=WiFiUsers,OU=Groups,DC=corp,DC=com`
- This prevents all AD users from getting WiFi access

---

## 8. Troubleshooting

| Issue | Check |
|-------|-------|
| LDAP module not loading | Verify symlink: `ls -la /etc/raddb/mods-enabled/ldap` |
| Connection refused | Check firewall: `telnet ldap-server 636` |
| Bind failed | Verify bind DN + password: use `ldapsearch -x -D "cn=..." -w "..." -b "dc=..."` |
| MS-CHAPv2 fails | Check winbind: `wbinfo -t` and `ntlm_auth --domain=CORP --request-nt-key --username=test` |
| Auth-Type LDAP not matching | Check `sites-available/default` has `-ldap` in authorize{} and `Auth-Type LDAP { ldap }` in authenticate{} |
| Groups not mapping | Verify `filterGroup` DN is correct; check `post-auth {}` has `Ldap-Group` |
| FreeRADIUS won't start | Check config: `radiusd -XC` for syntax errors |

---

## 9. Feature Flag Behavior

| State | FreeRADIUS Behavior | Guest Impact |
|-------|-------------------|-------------|
| **OFF** (default) | LDAP module not loaded. `mods-enabled/ldap` symlink removed. No `-ldap` in authorize/authenticate/post-auth. | Zero impact — all guests auth via existing SQL flow |
| **ON** | LDAP module loaded. `-ldap` added before `-sql` in authorize{}. Auth-Type LDAP block active. | Enterprise guests with AD accounts can authenticate via LDAP. Transient guests (no AD account) fall through to SQL auth |

---

## 10. API Reference

### POST /api/wifi/radius-ldap

**Save Config (no action):**
```json
{
  "serverUrl": "ldaps://ad.corp.com:636",
  "baseDn": "DC=corp,DC=com",
  "bindDn": "CN=readonly,OU=ServiceAccounts,DC=corp,DC=com",
  "bindPassword": "********",
  "searchFilter": "(sAMAccountName=%{User-Name})",
  "useTls": true,
  "timeout": 30,
  "poolMin": 5,
  "poolMax": 20,
  "ldapBindAuth": true,
  "mschapAuth": true,
  "ntlmAuthPath": "/usr/bin/ntlm_auth",
  "winbindDomain": "CORP",
  "enabled": true
}
```

**Test Connection:**
```json
{
  "action": "test",
  "serverUrl": "ldaps://ad.corp.com:636",
  "baseDn": "DC=corp,DC=com",
  "bindDn": "CN=readonly,OU=ServiceAccounts,DC=corp,DC=com",
  "bindPassword": "********",
  "useTls": true,
  "timeout": 30
}
```

**Response:** `{ "success": true, "data": { "connected": true, "latencyMs": 12, "userCount": 47 } }`

**Toggle:**
```json
{ "action": "toggle", "enabled": true }
```

**Diagnostics:**
```json
{ "action": "diagnostics" }
```

**Search Users:**
```json
{ "action": "search-users", "searchTerm": "john" }
```

**Sync Groups:**
```json
{ "action": "sync-groups" }
```

---

## 11. FreeRADIUS Config Changes Summary

When LDAP is **enabled**, the following changes are made to FreeRADIUS:

### mods-available/ldap (generated)
```nginx
ldap {
    server = "ad.corp.com"
    port = 636
    identity = "CN=readonly,OU=ServiceAccounts,DC=corp,DC=com"
    password = "********"
    base_dn = "DC=corp,DC=com"
    tls { require_cert = "allow" }
    update { control:NT-Password = "%{mschap:NT-Password}" }
    user { base_dn = "${..base_dn}"; filter = "(sAMAccountName=%{User-Name})" }
    group { group_membership_attribute = "memberOf" }
    options { net_timeout = 5; timeout = 30 }
    pool { start = 5; min = 5; max = 20 }
}
```

### mods-enabled/ldap (symlink)
```
mods-available/ldap → mods-enabled/ldap
```

### sites-available/default (changes)
```
authorize {
    -ldap        ← NEW (before -sql)
    -sql
    ...
}

authenticate {
    Auth-Type LDAP { ldap }    ← NEW
    PAP
    CHAP
    mschap
    ...
}

post-auth {
    Ldap-Group    ← NEW
    ...
}
```

### mods-available/mschap (when MS-CHAPv2 enabled)
```
mschap {
    ...
    # StaySuite: ntlm_auth for AD/LDAP MS-CHAPv2
    ntlm_auth = "/usr/bin/ntlm_auth --request-nt-key --domain=CORP"
}
```

When LDAP is **disabled**, ALL these changes are reverted to the clean state.

---

## 12. Testing

### E2E Test Flow

1. **Setup:** Install OpenLDAP in sandbox (`apt install slapd ldap-utils`)
2. **Configure:** Add test users to LDAP
3. **UI:** Go to RADIUS & Gateway → AD/LDAP tab
4. **Test Connection:** Verify connectivity
5. **Save Config:** Store LDAP settings
6. **Enable:** Toggle feature flag ON
7. **Verify FreeRADIUS:** Check `radiusd -XC` for config errors
8. **Authenticate:** Use `radtest` to test RADIUS auth via LDAP
9. **Disable:** Toggle feature flag OFF
10. **Verify Clean State:** Confirm LDAP module removed from FreeRADIUS

### Manual Test Commands
```bash
# Test LDAP connection
ldapsearch -x -H ldaps://localhost:636 -D "cn=admin,dc=example,dc=com" -w admin -b "dc=example,dc=com"

# Test RADIUS auth via LDAP
radtest -t pap "jdoe" "password123" localhost 1812 "sharedsecret"

# Check FreeRADIUS config
radiusd -XC

# Check module status
ls -la /etc/raddb/mods-enabled/ldap
```

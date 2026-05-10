# StaySuite WiFi Module — Complete Database Design Document

> **Version**: 2026-06  
> **Last Updated**: Based on live `prisma/schema.prisma` + `complete-database.sql`  
> **Deployment**: PostgreSQL 17 · FreeRADIUS 3.2.7 · Prisma ORM 6 · Bun Runtime

---

## Section 1: Architecture Overview

### 1.1 Table Count Summary

| Category | Count | Managed By |
|----------|-------|------------|
| Prisma ORM Tables (WiFi Module) | ~66 | `prisma db push` |
| Native SQL Tables (RADIUS/helper) | 9 | `complete-database.sql` |
| Reporting Views | 6 | `complete-database.sql` |
| Database Functions | 8 | `complete-database.sql` |
| nftables Service Tables | 5 | `nftables-service-tables.sql` |
| **Total** | **~94** | — |

### 1.2 Technology Stack

- **Database**: PostgreSQL 17 (with `citext` extension)
- **ORM**: Prisma ORM 6 (for application-layer tables)
- **RADIUS**: FreeRADIUS 3.2.7 (uses native SQL tables for credentials/accounting)
- **Runtime**: Bun (TypeScript)
- **Firewall**: nftables (kernel-level, with SQL persistence)
- **DHCP**: ISC Kea (with SQL-backed configuration)
- **DNS**: dnsmasq (split-horizon, LAN resolution)
- **Content Filter**: e2guardian (domain-based filtering)

### 1.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        StaySuite WiFi Module Architecture                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │  PMS Layer   │     │  PMS Layer   │     │  PMS Layer   │                 │
│  │  Booking     │     │  Guest       │     │  Room        │                 │
│  │  Guest       │     │  Property    │     │  RoomType    │                 │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                 │
│         │                    │                    │                          │
│         └────────────────────┼────────────────────┘                          │
│                              │                                              │
│                    ┌─────────▼─────────┐                                    │
│                    │   WiFi AAA Layer   │                                    │
│                    │  ┌──────────────┐  │                                    │
│                    │  │ WiFiAAAConfig │  │                                    │
│                    │  │ WiFiUser      │  │                                    │
│                    │  │ WiFiPlan      │  │                                    │
│                    │  │ WiFiVoucher   │  │                                    │
│                    │  │ WiFiSession   │  │                                    │
│                    │  └──────┬───────┘  │                                    │
│                    └─────────┼─────────┘                                    │
│                              │                                              │
│              ┌───────────────┼───────────────┐                              │
│              │               │               │                              │
│     ┌────────▼────────┐ ┌───▼────┐ ┌────────▼────────┐                     │
│     │ RADIUS Layer     │ │ IpPool │ │ Captive Portal  │                     │
│     │ ┌──────────────┐ │ │ Layer  │ │ ┌──────────────┐ │                     │
│     │ │ RadiusServer │ │ │        │ │ │ CaptivePortal│ │                     │
│     │ │ RadiusNAS    │ │ │ IpPool │ │ │ PortalPage   │ │                     │
│     │ │ RadCheck     │ │ │ IpPool │ │ │ PortalAuth   │ │                     │
│     │ │ RadReply     │ │ │ Range  │ │ │ PortalMap    │ │                     │
│     │ │ RadUserGroup │ │ │        │ │ │ PortalTmpl   │ │                     │
│     │ │ RadPostAuth  │ │ │        │ │ └──────────────┘ │                     │
│     │ │ RadAcct      │ │ │        │ │                  │                     │
│     │ │ CoaSession   │ │ │        │ │ ┌──────────────┐ │                     │
│     │ │ RadiusMacAuth│ │ │        │ │ │ PortalWhite  │ │                     │
│     │ │ RadiusEvent  │ │ │        │ │ │ list         │ │                     │
│     │ └──────────────┘ │ │        │ │ └──────────────┘ │                     │
│     └────────┬─────────┘ └────────┘ └────────┬─────────┘                     │
│              │                              │                               │
│     ┌────────▼──────────────────────────────▼─────────┐                      │
│     │            Bandwidth / FUP Layer                 │                      │
│     │  ┌──────────────┐  ┌──────────────┐             │                      │
│     │  │ BandwidthPol │  │ FairAccess   │             │                      │
│     │  │ BWPolicyDetail│ │ Policy       │             │                      │
│     │  │ BandwidthPool│  │ FupSwitchLog │             │                      │
│     │  │ BandwidthTop │  │              │             │                      │
│     │  │ up           │  │              │             │                      │
│     │  └──────────────┘  └──────────────┘             │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
│     ┌──────────────────────────────────────────────────┐                      │
│     │          Network Infrastructure Layer            │                      │
│     │  ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │                      │
│     │  │ NetworkIntf │ │ VlanConfig  │ │ DhcpSubnet│  │                      │
│     │  │ IntfRole    │ │ DhcpReserv  │ │ DhcpLease │  │                      │
│     │  │ IntfConfig  │ │ DhcpOption  │ │ DhcpBlack │  │                      │
│     │  │ IntfAlias   │ │ DhcpTagRule │ │ DhcpHostF │  │                      │
│     │  │ BondConfig  │ │ DhcpScript  │ │ DhcpLease │  │                      │
│     │  │ BondMember  │ │             │ │ Script    │  │                      │
│     │  │ BridgeConfig│ │             │ │           │  │                      │
│     │  └─────────────┘ └─────────────┘ └───────────┘  │                      │
│     │  ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │                      │
│     │  │ DnsZone     │ │ FirewallZone│ │ WiFiGateway│  │                      │
│     │  │ DnsRecord   │ │ FirewallRule│ │ DnsRedir   │  │                      │
│     │  │             │ │ FW Schedule │ │ ContFilter │  │                      │
│     │  │             │ │ QuickBlock  │ │ WebCateg   │  │                      │
│     │  │             │ │ PortFwdRule│ │ WebCatSched│  │                      │
│     │  └─────────────┘ └─────────────┘ └───────────┘  │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
│     ┌──────────────────────────────────────────────────┐                      │
│     │          Data / Monitoring Layer                 │                      │
│     │  ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │                      │
│     │  │ BWUsageDaily│ │ NatLog      │ │ NetCfgBkup│  │                      │
│     │  │ BWUsageSess │ │ DataUsage   │ │ SysNetHlth│  │                      │
│     │  │             │ │ ByPeriod    │ │ SyslogSrvr│  │                      │
│     │  │             │ │             │ │ DevProfile│  │                      │
│     │  └─────────────┘ └─────────────┘ └───────────┘  │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
│     ┌──────────────────────────────────────────────────┐                      │
│     │          Reporting (6 Views)                     │                      │
│     │  v_session_history · v_active_sessions           │                      │
│     │  v_auth_logs · v_user_usage · v_wifi_users       │                      │
│     │  v_fup_switch_logs                               │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
│     ┌──────────────────────────────────────────────────┐                      │
│     │          Database Functions (8)                  │                      │
│     │  fn_check_ip_pool · fn_get_user_pool_info         │                      │
│     │  fn_get_pool_attr · fn_check_fup                  │                      │
│     │  fn_check_login_limit · fn_get_effective_bandwidth │                      │
│     │  fn_get_mikrotik_rate_limit · fn_is_fup_throttled │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
│     ┌──────────────────────────────────────────────────┐                      │
│     │          nftables Service Tables (5)             │                      │
│     │  NftGuiRule · NftPortForward · NftRateLimit     │                      │
│     │  NftQuickBlock · NftSchedule                     │                      │
│     └──────────────────────────────────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 2: Core WiFi/RADIUS Tables (Prisma ORM)

### 2.1 WiFiUser

**Description**: Central user entity for WiFi access. Bridges PMS guest/booking data with RADIUS authentication. Each user maps to `radcheck`/`radreply`/`radusergroup` records for FreeRADIUS credential delivery.

**PostgreSQL Table**: `"WiFiUser"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| username | String | UNIQUE, NOT NULL | | RADIUS username |
| password | String | NOT NULL | | Stored in WiFiUser; synced to radcheck |
| guestId | UUID | FK→Guest, nullable | | PMS guest reference |
| bookingId | UUID | FK→Booking, nullable | | PMS booking reference |
| userType | String | NOT NULL | 'guest' | guest, staff, event |
| planId | UUID | FK→WiFiPlan, nullable | | Assigned WiFi plan |
| ipPoolId | UUID | FK→IpPool, nullable | | IP pool override |
| validFrom | Timestamptz | NOT NULL | | Credential validity start |
| validUntil | Timestamptz | NOT NULL | | Credential validity end |
| maxSessions | Int | NOT NULL | 1 | Max concurrent sessions |
| sessionCount | Int | NOT NULL | 0 | Current active sessions |
| totalBytesIn | BigInt | NOT NULL | 0 | Upload bytes (from acctinputoctets) |
| totalBytesOut | BigInt | NOT NULL | 0 | Download bytes (from acctoutputoctets) |
| status | String | NOT NULL | 'active' | active, suspended, expired |
| radiusSynced | Boolean | NOT NULL | false | Synced to radcheck/radreply |
| radiusSyncedAt | Timestamptz | nullable | | Last sync timestamp |
| lastAccountingAt | Timestamptz | nullable | | Last accounting update |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([tenantId])`
- `@@index([propertyId])`
- `@@index([username])`
- `@@index([guestId])`
- `@@index([bookingId])`
- `@@index([status])`
- `@@index([ipPoolId])`

**Relations**:
- `radCheck RadCheck[]` — RADIUS check attributes
- `radReply RadReply[]` — RADIUS reply attributes
- `deviceProfiles DeviceProfile[]` — Linked device fingerprints
- `plan WiFiPlan?` — FK→WiFiPlan(planId)
- `ipPool IpPool?` — FK→IpPool(ipPoolId) via `"UserIpPoolOverride"`
- `property Property` — FK→Property(propertyId)
- `tenant Tenant` — FK→Tenant(tenantId)

---

### 2.2 WiFiPlan

**Description**: Defines bandwidth, data limits, session timeouts, and validity for WiFi service tiers. Plans can be assigned to room types or individual users.

**PostgreSQL Table**: `"WiFiPlan"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| name | String | NOT NULL | | Plan display name |
| description | String | nullable | | |
| downloadSpeed | Int | NOT NULL | | Download speed in Mbps |
| uploadSpeed | Int | NOT NULL | | Upload speed in Mbps |
| burstDownloadSpeed | Int | nullable | | Burst ceil download (Mbps); null=no burst |
| burstUploadSpeed | Int | nullable | | Burst ceil upload (Mbps); null=no burst |
| dataLimit | Int | nullable | | Data limit in MB; null=unlimited |
| sessionLimit | Int | nullable | | Max sessions |
| sessionTimeoutSec | Int | nullable | | Session timeout seconds |
| idleTimeoutSec | Int | nullable | | Idle timeout seconds |
| maxDevices | Int | NOT NULL | 1 | Max devices per user |
| fupPolicyId | UUID | FK→FairAccessPolicy, nullable | | FUP policy reference |
| ipPoolId | UUID | FK→IpPool, nullable | | Default IP pool for plan |
| price | Float | NOT NULL | 0 | |
| currency | String | NOT NULL | 'USD' | |
| priority | Int | NOT NULL | 0 | |
| validityDays | Int | NOT NULL | 1 | Voucher validity days |
| validityMinutes | Int | NOT NULL | 1440 | Fine-grained validity (minutes) |
| status | String | NOT NULL | 'active' | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([tenantId])`
- `@@index([ipPoolId])`

**Relations**:
- `aaaaConfigs WiFiAAAConfig[]` — AAA configs using this as default plan
- `fupPolicy FairAccessPolicy?` — FK→FairAccessPolicy(fupPolicyId)
- `ipPool IpPool?` — FK→IpPool(ipPoolId)
- `roomTypes RoomType[]` — Via `"RoomTypeWiFiPlan"`
- `tenant Tenant` — FK→Tenant(tenantId)
- `sessions WiFiSession[]`
- `wifiUsers WiFiUser[]`
- `vouchers WiFiVoucher[]`

---

### 2.3 WiFiSession

**Description**: Tracks each user WiFi session with data usage, duration, and device info. Sessions are created on portal login and linked to RADIUS accounting via `acctUniqueId`.

**PostgreSQL Table**: `"WiFiSession"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| planId | UUID | FK→WiFiPlan, nullable | | |
| guestId | UUID | FK→Guest, nullable | | |
| bookingId | UUID | FK→Booking, nullable | | |
| username | String | nullable | | RADIUS username |
| acctUniqueId | String | nullable | | Links to radacct.acctuniqueid |
| macAddress | String | NOT NULL | | Client MAC address |
| ipAddress | String | nullable | | Assigned IP |
| deviceName | String | nullable | | |
| deviceType | String | nullable | | |
| startTime | Timestamptz | NOT NULL | now() | Session start |
| endTime | Timestamptz | nullable | | Session end |
| dataUsed | BigInt | NOT NULL | 0 | Total data (bytes) |
| duration | Int | NOT NULL | 0 | Duration (seconds) |
| authMethod | String | NOT NULL | 'voucher' | voucher, room_number, pms_credentials, etc. |
| status | String | NOT NULL | 'active' | active, completed, terminated |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([tenantId])`
- `@@index([macAddress])`
- `@@index([guestId])`
- `@@index([username])`
- `@@index([acctUniqueId])`

**Relations**:
- `plan WiFiPlan?` — FK→WiFiPlan(planId)
- `tenant Tenant` — FK→Tenant(tenantId)

---

### 2.4 WiFiVoucher

**Description**: Pre-generated access codes linked to a WiFi plan. Used for guest self-service WiFi access.

**PostgreSQL Table**: `"WiFiVoucher"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| planId | UUID | FK→WiFiPlan, NOT NULL | | |
| code | String | UNIQUE, NOT NULL | | Voucher access code |
| guestId | UUID | FK→Guest, nullable | | Guest who used voucher |
| bookingId | UUID | FK→Booking, nullable | | |
| isUsed | Boolean | NOT NULL | false | |
| usedAt | Timestamptz | nullable | | |
| validFrom | Timestamptz | NOT NULL | | |
| validUntil | Timestamptz | NOT NULL | | |
| status | String | NOT NULL | 'active' | active, used, expired |
| notes | String | nullable | | |
| issuedTo | String | nullable | | |
| issuedAt | Timestamptz | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([tenantId])`
- `@@index([code])`

**Relations**:
- `plan WiFiPlan` — FK→WiFiPlan(planId) onDelete Cascade
- `tenant Tenant` — FK→Tenant(tenantId)

---

### 2.5 WiFiAAAConfig

**Description**: Per-property AAA configuration controlling auto-provisioning, credential generation, portal settings, and session limits. One per property (UNIQUE propertyId).

**PostgreSQL Table**: `"WiFiAAAConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, UNIQUE, NOT NULL | | One per property |
| defaultPlanId | UUID | FK→WiFiPlan, nullable | | Default WiFi plan |
| defaultDownloadSpeed | Int | NOT NULL | 10 | Mbps |
| defaultUploadSpeed | Int | NOT NULL | 10 | Mbps |
| defaultSessionLimit | Int | nullable | | |
| defaultDataLimit | Int | nullable | | MB |
| autoProvisionOnCheckin | Boolean | NOT NULL | true | Auto-create WiFiUser on check-in |
| autoDeprovisionOnCheckout | Boolean | NOT NULL | true | Auto-delete WiFiUser on checkout |
| autoDeprovisionDelay | Int | NOT NULL | 0 | Minutes after checkout |
| authMethod | String | NOT NULL | 'pap' | pap, chap, mschapv2 |
| allowMacAuth | Boolean | NOT NULL | false | |
| accountingSyncInterval | Int | NOT NULL | 5 | Minutes between accounting syncs |
| lastSyncAt | Timestamptz | nullable | | |
| lastSyncId | UUID | nullable | | |
| maxConcurrentSessions | Int | NOT NULL | 3 | |
| sessionTimeoutPolicy | String | NOT NULL | 'hard' | hard, soft |
| portalEnabled | Boolean | NOT NULL | true | |
| portalTitle | String | nullable | | |
| portalLogo | String | nullable | | |
| portalTerms | String | nullable | | |
| portalRedirectUrl | String | nullable | | |
| portalBrandColor | String | NOT NULL | '#0d9488' | |
| voucherPortalUrl | String | nullable | | QR code base URL |
| usernameFormat | String | NOT NULL | 'room_random' | Credential generation format |
| usernamePrefix | String | nullable | | Custom prefix |
| usernameCase | String | NOT NULL | 'lowercase' | lowercase, uppercase, as_is |
| usernameMinLength | Int | NOT NULL | 4 | |
| usernameMaxLength | Int | NOT NULL | 32 | |
| passwordFormat | String | NOT NULL | 'random_alphanumeric' | |
| passwordFixedValue | String | nullable | | For 'fixed' format |
| passwordLength | Int | NOT NULL | 8 | |
| passwordIncludeUppercase | Boolean | NOT NULL | true | |
| passwordIncludeNumbers | Boolean | NOT NULL | true | |
| passwordIncludeSymbols | Boolean | NOT NULL | false | |
| credentialSeparator | String | NOT NULL | '_' | |
| credentialPrintOnVoucher | Boolean | NOT NULL | true | |
| credentialShowInPortal | Boolean | NOT NULL | true | |
| duplicateUsernameAction | String | NOT NULL | 'append_random' | |
| status | String | NOT NULL | 'active' | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([tenantId])`

**Relations**:
- `defaultPlan WiFiPlan?` — FK→WiFiPlan(defaultPlanId)
- `property Property` — FK→Property(propertyId) onDelete Cascade
- `tenant Tenant` — FK→Tenant(tenantId)

---

### 2.6 RadiusServerConfig

**Description**: Per-property FreeRADIUS server configuration. Controls ports, logging, data caps, MAC auth, and concurrent session policy. One per property.

**PostgreSQL Table**: `"RadiusServerConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, UNIQUE, NOT NULL | | |
| serverIp | String | NOT NULL | '127.0.0.1' | |
| serverHostname | String | nullable | | |
| authPort | Int | NOT NULL | 1812 | |
| acctPort | Int | NOT NULL | 1813 | |
| coaPort | Int | NOT NULL | 3799 | |
| listenAllInterfaces | Boolean | NOT NULL | true | |
| bindAddress | String | NOT NULL | '0.0.0.0' | |
| maxAuthWait | Int | NOT NULL | 30 | |
| maxAcctWait | Int | NOT NULL | 30 | |
| cleanupSessions | Boolean | NOT NULL | true | |
| sessionCleanupInterval | Int | NOT NULL | 3600 | Seconds |
| logAuth | Boolean | NOT NULL | true | |
| logAuthBadpass | Boolean | NOT NULL | false | |
| logAuthGoodpass | Boolean | NOT NULL | false | |
| logDestination | String | NOT NULL | 'files' | files, syslog, stdout |
| logLevel | String | NOT NULL | 'info' | debug, info, warn, error |
| status | String | NOT NULL | 'active' | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |
| interimUpdateInterval | Int | NOT NULL | 60 | Seconds |
| dataCapAction | String | NOT NULL | 'disconnect' | disconnect, throttle, notify |
| dataCapThrottleRate | String | NOT NULL | '1M/1M' | |
| macAuthEnabled | Boolean | NOT NULL | false | |
| macAuthBypassPortal | Boolean | NOT NULL | true | |
| portalWhitelistEnabled | Boolean | NOT NULL | false | |
| concurrentSessionAction | String | NOT NULL | 'reject' | reject, disconnect_oldest |

**Indexes**:
- `@@index([tenantId])`

---

### 2.7 RadiusNAS

**Description**: Network Access Server (AP/controller/gateway) registry. Each NAS device that authenticates against FreeRADIUS needs an entry here and in the `nas` table.

**PostgreSQL Table**: `"RadiusNAS"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | NAS display name |
| shortname | String | NOT NULL | | RADIUS shortname |
| ipAddress | String | NOT NULL | | NAS IP address |
| type | String | NOT NULL | 'other' | cisco, mikrotik, aruba, tplink, etc. |
| ports | String | nullable | | RADIUS ports |
| secret | String | NOT NULL | | Shared RADIUS secret |
| server | String | nullable | | Proxy target |
| community | String | nullable | | SNMP community |
| description | String | nullable | | |
| coaEnabled | Boolean | NOT NULL | true | |
| coaPort | Int | NOT NULL | 3799 | |
| authPort | Int | NOT NULL | 1812 | |
| acctPort | Int | NOT NULL | 1813 | |
| apiUsername | String | nullable | | REST API username (MikroTik) |
| apiPassword | String | nullable | | REST API password (MikroTik) |
| apiPort | Int | NOT NULL | 443 | REST API port |
| status | String | NOT NULL | 'active' | |
| lastSeenAt | Timestamptz | nullable | | |
| lastWentOnlineAt | Timestamptz | nullable | | |
| lastWentOfflineAt | Timestamptz | nullable | | |
| totalAuths | Int | NOT NULL | 0 | |
| totalAccts | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([propertyId, ipAddress])`
- `@@unique([propertyId, shortname])`
- `@@index([tenantId])`
- `@@index([propertyId])`
- `@@index([status])`

---

### 2.8 RadiusCoaLog

**Description**: Audit log for Change of Authorization (CoA) operations — bandwidth changes, session disconnects triggered by data caps or manual actions.

**PostgreSQL Table**: `"RadiusCoaLog"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| action | String | NOT NULL | | disconnect, bandwidth_change, data_cap_disconnect |
| username | String | NOT NULL | | |
| sessionId | UUID | nullable | | |
| nasIpAddress | String | nullable | | |
| sharedSecret | String | nullable | | |
| attributes | String | nullable | | JSON: CoA attributes sent |
| result | String | NOT NULL | | success, failed, timeout |
| responseCode | String | nullable | | |
| errorMessage | String | nullable | | |
| triggeredBy | String | NOT NULL | | auto, manual, data_cap, checkout |
| triggeredById | UUID | nullable | | Staff user who triggered |
| timestamp | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([propertyId])`
- `@@index([action])`
- `@@index([username])`
- `@@index([result])`
- `@@index([timestamp])`

---

### 2.9 RadiusProvisioningLog

**Description**: Persistent log of user provisioning/deprovisioning operations (create, suspend, resume, delete WiFi users).

**PostgreSQL Table**: `"RadiusProvisioningLog"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| action | String | NOT NULL | | provision, deprovision, suspend, resume, update |
| username | String | NOT NULL | | |
| guestId | UUID | nullable | | |
| bookingId | UUID | nullable | | |
| userId | UUID | nullable | | Staff who triggered |
| result | String | NOT NULL | | success, failed, skipped |
| details | String | nullable | | JSON context |
| error | String | nullable | | |
| durationMs | Int | nullable | | |
| timestamp | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([propertyId])`
- `@@index([action])`
- `@@index([username])`
- `@@index([result])`
- `@@index([timestamp])`
- `@@index([bookingId])`

---

### 2.10 RadiusAuthLog

**Description**: RADIUS authentication attempt log (Access-Accept/Reject) for property-level reporting.

**PostgreSQL Table**: `"RadiusAuthLog"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| username | String | NOT NULL | | |
| authResult | String | NOT NULL | | Access-Accept, Access-Reject |
| authType | String | nullable | | PAP, CHAP, MS-CHAPv2, EAP |
| nasIpAddress | String | nullable | | |
| nasIdentifier | String | nullable | | |
| callingStationId | UUID | nullable | | Client MAC |
| calledStationId | UUID | nullable | | AP MAC |
| clientIpAddress | String | nullable | | |
| replyMessage | String | nullable | | |
| terminateReason | String | nullable | | |
| timestamp | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([propertyId])`
- `@@index([username])`
- `@@index([authResult])`
- `@@index([timestamp])`
- `@@index([callingStationId])`

---

### 2.11 RadiusMacAuth

**Description**: MAC address whitelist for auto-authentication. Devices listed here bypass the captive portal.

**PostgreSQL Table**: `"RadiusMacAuth"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| macAddress | String | NOT NULL | | |
| username | String | nullable | | Linked WiFi username |
| guestId | UUID | nullable | | |
| guestName | String | nullable | | |
| description | String | nullable | | |
| autoLogin | Boolean | NOT NULL | true | |
| validFrom | Timestamptz | NOT NULL | now() | |
| validUntil | Timestamptz | nullable | | |
| lastSeenAt | Timestamptz | nullable | | |
| loginCount | Int | NOT NULL | 0 | |
| status | String | NOT NULL | 'active' | |
| bandwidthDown | Int | nullable | | kbps |
| bandwidthUp | Int | nullable | | kbps |
| sessionTimeout | Int | nullable | | seconds |
| dataLimitMB | Int | nullable | | MB |
| groupName | String | nullable | | |
| planId | UUID | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([propertyId, macAddress])`
- `@@index([propertyId])`
- `@@index([macAddress])`
- `@@index([status])`
- `@@index([guestId])`
- `@@index([planId])`

---

### 2.12 RadiusEventUser

**Description**: Event/conference bulk WiFi users. Created for events where many attendees need temporary WiFi access.

**PostgreSQL Table**: `"RadiusEventUser"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | NOT NULL | | |
| eventId | UUID | NOT NULL | | References Event model |
| eventName | String | NOT NULL | | |
| username | String | UNIQUE, NOT NULL | | |
| password | String | NOT NULL | | |
| planId | UUID | nullable | | |
| bandwidthDown | Int | NOT NULL | 5 | Mbps |
| bandwidthUp | Int | NOT NULL | 2 | Mbps |
| dataLimitMb | Int | nullable | | null=unlimited |
| validFrom | Timestamptz | NOT NULL | | |
| validUntil | Timestamptz | NOT NULL | | |
| maxSessions | Int | NOT NULL | 1 | |
| guestName | String | nullable | | |
| guestEmail | String | nullable | | |
| guestCompany | String | nullable | | |
| status | String | NOT NULL | 'active' | active, used, expired, revoked |
| usedAt | Timestamptz | nullable | | |
| firstUsedAt | Timestamptz | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([propertyId])`
- `@@index([eventId])`
- `@@index([status])`
- `@@index([validUntil])`

---

### 2.13 CoaSessionDetail

**Description**: Detailed per-session CoA audit record — captures before/after bandwidth and session time data when a CoA action is performed.

**PostgreSQL Table**: `"CoaSessionDetail"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| sessionId | UUID | NOT NULL | | |
| username | String | NOT NULL | | |
| userId | UUID | nullable | | |
| coaType | String | NOT NULL | | bandwidth_change, disconnect |
| policyName | String | nullable | | |
| bandwidthPercent | Float | nullable | | |
| triggeredBy | String | NOT NULL | 'system' | |
| nasIpAddress | String | nullable | | |
| actualSessionTime | Int | NOT NULL | 0 | |
| effectiveSessionTime | Int | NOT NULL | 0 | |
| actualDownloadBytes | Int | NOT NULL | 0 | |
| actualUploadBytes | Int | NOT NULL | 0 | |
| effectiveDownloadBytes | Int | NOT NULL | 0 | |
| effectiveUploadBytes | Int | NOT NULL | 0 | |
| result | String | NOT NULL | 'pending' | |
| errorMessage | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([propertyId])`
- `@@index([tenantId])`
- `@@index([sessionId])`
- `@@index([username])`
- `@@index([userId])`
- `@@index([coaType])`
- `@@index([createdAt])`

---

### 2.14 WiFiAccountingSync

**Description**: Tracks the last accounting sync position — used by the session engine cron to resume incremental syncs.

**PostgreSQL Table**: `"WiFiAccountingSync"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| lastRadAcctId | String | NOT NULL | | Last processed radacct ID |
| lastSyncedAt | Timestamptz | NOT NULL | now() | |
| recordsProcessed | Int | NOT NULL | 0 | |
| errors | Int | NOT NULL | 0 | |
| lastError | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

---

### 2.15 WiFiGateway

**Description**: Physical WiFi gateway device (MikroTik, UniFi, etc.) with RADIUS config, captive portal settings, and API credentials.

**PostgreSQL Table**: `"WiFiGateway"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| ipAddress | String | NOT NULL | | |
| macAddress | String | nullable | | |
| vendor | String | NOT NULL | | |
| model | String | nullable | | |
| version | String | nullable | | |
| radiusSecret | String | NOT NULL | | |
| radiusAuthPort | Int | NOT NULL | 1812 | |
| radiusAcctPort | Int | NOT NULL | 1813 | |
| coaEnabled | Boolean | NOT NULL | false | |
| coaPort | Int | NOT NULL | 3799 | |
| coaSecret | String | nullable | | |
| captivePortalEnabled | Boolean | NOT NULL | false | |
| captivePortalUrl | String | nullable | | |
| splashPageId | UUID | nullable | | |
| defaultVlan | Int | nullable | | |
| guestVlan | Int | nullable | | |
| staffVlan | Int | nullable | | |
| managementUrl | String | nullable | | |
| apiUsername | String | nullable | | |
| apiPassword | String | nullable | | |
| apiPort | Int | nullable | | |
| status | String | NOT NULL | 'active' | |
| lastSeenAt | Timestamptz | nullable | | |
| firmwareVersion | String | nullable | | |
| totalClients | Int | NOT NULL | 0 | |
| totalSessions | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([propertyId, ipAddress])`
- `@@index([tenantId])`
- `@@index([propertyId])`
- `@@index([vendor])`
- `@@index([status])`

---

## Section 3: Native RADIUS SQL Tables (Managed by FreeRADIUS Directly)

These tables are managed by Prisma ORM but follow the standard FreeRADIUS schema naming convention.

### 3.1 RadCheck (radcheck)

**Description**: RADIUS user check attributes — primarily `Cleartext-Password` for PAP authentication. FreeRADIUS reads these during the authorize phase.

**PostgreSQL Table**: `radcheck`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| wifiUserId | UUID | FK→WiFiUser, nullable | | |
| username | String | NOT NULL | | |
| attribute | String | NOT NULL | | e.g., Cleartext-Password |
| op | String | NOT NULL | ':=' | |
| value | String | NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| isActive | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([username])`
- `@@index([attribute])`

### 3.2 RadReply (radreply)

**Description**: RADIUS user reply attributes — bandwidth limits, session timeout, etc. sent back to NAS after successful authentication.

**PostgreSQL Table**: `radreply`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| wifiUserId | UUID | FK→WiFiUser, nullable | | |
| username | String | NOT NULL | | |
| attribute | String | NOT NULL | | e.g., Cryptsk-Rate-Limit |
| op | String | NOT NULL | ':=' | |
| value | String | NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| isActive | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes**:
- `@@index([username])`
- `@@index([attribute])`

### 3.3 RadUserGroup (radusergroup)

**Description**: Maps users to RADIUS groups. Groups provide group-level check/reply attributes via `radgroupcheck`/`radgroupreply`.

**PostgreSQL Table**: `radusergroup`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| username | String | NOT NULL | | |
| groupname | String | NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([username])`
- `@@index([groupname])`

### 3.4 RadGroupCheck (radgroupcheck)

**Description**: Group-level check attributes. Evaluated for all users in the group during authorization.

**PostgreSQL Table**: `radgroupcheck`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| groupname | String | NOT NULL | | |
| attribute | String | NOT NULL | | |
| op | String | NOT NULL | ':=' | |
| value | String | NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([groupname])`

### 3.5 RadGroupReply (radgroupreply)

**Description**: Group-level reply attributes. Applied to all users in the group after successful authentication.

**PostgreSQL Table**: `radgroupreply`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| groupname | String | NOT NULL | | |
| attribute | String | NOT NULL | | |
| op | String | NOT NULL | ':=' | |
| value | String | NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([groupname])`

### 3.6 RadAcct (radacct)

**Description**: FreeRADIUS accounting table — stores every Start/Interim-Update/Stop packet from NAS devices. This is the primary data source for session tracking, bandwidth usage, and data cap enforcement.

**PostgreSQL Table**: `radacct`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| radacctid | BigInt | PK, autoincrement | | |
| acctsessionid | String | NOT NULL | '' | |
| acctuniqueid | String | UNIQUE, NOT NULL | | |
| username | String | nullable | | |
| realm | String | nullable | | |
| nasipaddress | String | NOT NULL | | |
| nasportid | String | nullable | | |
| nasporttype | String | nullable | | |
| acctstarttime | Timestamptz | nullable | | |
| acctupdatetime | Timestamptz | nullable | | |
| acctstoptime | Timestamptz | nullable | | |
| acctinterval | BigInt | nullable | | |
| acctsessiontime | BigInt | nullable | 0 | |
| acctauthentic | String | nullable | | |
| connectinfo_start | String | nullable | | |
| connectinfo_stop | String | nullable | | |
| acctinputoctets | BigInt | nullable | 0 | User upload bytes |
| acctoutputoctets | BigInt | nullable | 0 | User download bytes |
| acctinputgigawords | BigInt | nullable | 0 | |
| acctoutputgigawords | BigInt | nullable | 0 | |
| calledstationid | String | nullable | | AP MAC |
| callingstationid | String | nullable | | Client MAC |
| acctterminatecause | String | nullable | | |
| servicetype | String | nullable | | |
| framedprotocol | String | nullable | | |
| framedipaddress | String | nullable | | |
| framedipv6address | String | nullable | | |
| framedipv6prefix | String | nullable | | |
| framedinterfaceid | String | nullable | | |
| delegatedipv6prefix | String | nullable | | |
| acctinputpackets | Int | nullable | 0 | |
| acctoutputpackets | Int | nullable | 0 | |
| acctstatus | String | nullable | 'start' | |
| loginType | String | nullable | 'portal' | portal, mac, voucher |
| createdAt | Timestamptz | NOT NULL | now() | Column: createdat |
| updatedAt | Timestamptz | NOT NULL | updatedAt | Column: updatedat |
| radiusClass | String | nullable | | Column: class |

**Indexes**:
- `@@index([acctuniqueid])` — `radacct_active_session_idx`
- `@@index([nasipaddress, acctstarttime])` — `radacct_bulk_close`
- `@@index([acctstarttime, username])` — `radacct_start_user_idx`

### 3.7 RadPostAuth (radpostauth)

**Description**: Authentication attempt log written by FreeRADIUS after every auth attempt (Accept or Reject). Extended with StaySuite columns for property-level tracking and rejection reasons.

**PostgreSQL Table**: `radpostauth`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | BigInt | PK, autoincrement | | |
| username | String | NOT NULL | | |
| pass | String | nullable | | |
| reply | String | nullable | | Access-Accept, Access-Reject |
| calledstationid | String | nullable | | |
| callingstationid | String | nullable | | |
| authdate | Timestamptz | NOT NULL | now() | |
| propertyId | UUID | nullable | | |
| nasIpAddress | String | nullable | | |
| clientipaddress | String | nullable | | |
| radiusClass | String | nullable | | Column: class |
| replyMessage | String | nullable | | |

### 3.8 Nas (nas)

**Description**: FreeRADIUS NAS client registry — also managed by Prisma ORM. FreeRADIUS reads this table for client authentication.

**PostgreSQL Table**: `nas`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | Int | PK, autoincrement | | |
| nasname | String | NOT NULL | | NAS IP/hostname |
| shortname | String | NOT NULL | | |
| type | String | NOT NULL | 'other' | |
| ports | Int | nullable | | |
| secret | String | NOT NULL | | |
| server | String | nullable | | |
| community | String | nullable | | |
| description | String | nullable | | |

**Indexes**:
- `@@index([nasname])`

### 3.9 NasReload (nasreload)

**Description**: Tracks when FreeRADIUS NAS configuration was last reloaded.

**PostgreSQL Table**: `nasreload`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| NASIPAddress | inet | PK | | |
| ReloadTime | Timestamptz | NOT NULL | | |

---

## Section 4: IP Pool Tables

### 4.1 IpPool

**Description**: IP address pool for user restriction (IPAM). Pools can be assigned to WiFi plans or users. Priority chain: User override > Plan pool > Default pool > No restriction.

**PostgreSQL Table**: `"IpPool"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | nullable | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| gateway | Inet | nullable | | |
| subnet | Inet | nullable | | CIDR subnet |
| isDefault | Boolean | NOT NULL | false | Default pool if no assignment |
| captivePortal | Boolean | NOT NULL | false | Written to restrictednetwork for default-deny |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([tenantId, name])`
- `@@index([tenantId])`
- `@@index([propertyId])`
- `@@index([isDefault])`
- `@@index([captivePortal])`

### 4.2 IpPoolRange

**Description**: Individual IP range within a pool. Uses PostgreSQL `inet` type for efficient range queries.

**PostgreSQL Table**: `"IpPoolRange"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| poolId | UUID | FK→IpPool, NOT NULL | | |
| startIp | Inet | NOT NULL | | Range start (inclusive) |
| endIp | Inet | NOT NULL | | Range end (inclusive) |
| comment | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes**:
- `@@index([poolId])`

---

## Section 5: Captive Portal Tables

### 5.1 CaptivePortal

**Description**: Portal instance configuration for each VLAN/zone. Supports zone-based routing, roaming, and multiple authentication methods.

**PostgreSQL Table**: `"CaptivePortal"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| listenIp | String | NOT NULL | '0.0.0.0' | |
| listenPort | Int | NOT NULL | 80 | |
| useSsl | Boolean | NOT NULL | false | |
| sslCertPath | String | nullable | | |
| sslKeyPath | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| isDefault | Boolean | NOT NULL | false | Fallback portal |
| autoAuthEnabled | Boolean | NOT NULL | true | Silent re-auth |
| maxConcurrent | Int | NOT NULL | 1000 | |
| sessionTimeout | Int | NOT NULL | 86400 | |
| idleTimeout | Int | NOT NULL | 3600 | |
| redirectUrl | String | nullable | | |
| successMessage | String | nullable | | |
| failMessage | String | nullable | | |
| slug | String | UNIQUE, NOT NULL | 'default-zone' | URL path segment |
| roamingMode | String | NOT NULL | 'auth_origin' | auth_origin, seamless, reauth |
| allowsRoamingFrom | String | NOT NULL | '[]' | JSON array of slugs |
| authMethod | String | NOT NULL | 'voucher' | |
| maxBandwidthDown | Int | NOT NULL | 5242880 | bytes/sec |
| maxBandwidthUp | Int | NOT NULL | 1048576 | bytes/sec |
| bandwidthPolicy | String | NOT NULL | 'zone' | zone, origin, minimum |
| nasIdentifier | String | NOT NULL | '' | |
| ssidList | String | NOT NULL | '[]' | JSON array |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 5.2 PortalPage

**Description**: Portal page design/styling per language per portal. Controls colors, layout, form fields, and auth flow.

**PostgreSQL Table**: `"PortalPage"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| portalId | UUID | FK→CaptivePortal, NOT NULL | | |
| language | String | NOT NULL | 'en' | |
| title | String | nullable | | |
| subtitle | String | nullable | | |
| logoUrl | String | nullable | | |
| backgroundImage | String | nullable | | |
| backgroundColor | String | NOT NULL | '#ffffff' | |
| textColor | String | NOT NULL | '#1f2937' | |
| accentColor | String | NOT NULL | '#0d9488' | |
| termsText | String | nullable | | |
| termsUrl | String | nullable | | |
| customCss | String | NOT NULL | '' | |
| customHtml | String | NOT NULL | '' | |
| showSocial | Boolean | NOT NULL | false | |
| showBranding | Boolean | NOT NULL | true | |
| formFields | String | NOT NULL | (JSON) | Field visibility config |
| authFlow | String | NOT NULL | 'pms_credentials' | |
| socialProviders | String | NOT NULL | (JSON) | |
| voucherTemplate | String | NOT NULL | 'default' | |
| designSettings | String | NOT NULL | '{}' | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([portalId, language])`

### 5.3 PortalAuthentication

**Description**: Defines which authentication methods are available for each portal and their priority/order.

**PostgreSQL Table**: `"PortalAuthentication"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| portalId | UUID | FK→CaptivePortal, NOT NULL | | |
| method | String | NOT NULL | 'voucher' | |
| enabled | Boolean | NOT NULL | true | |
| priority | Int | NOT NULL | 0 | |
| config | String | NOT NULL | '{}' | JSON: method-specific |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([portalId, method])`

### 5.4 PortalMapping

**Description**: Maps portal to VLAN/SSID/subnet for routing decisions.

**PostgreSQL Table**: `"PortalMapping"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| portalId | UUID | FK→CaptivePortal, NOT NULL | | |
| vlanId | Int | nullable | | |
| vlanConfigId | UUID | nullable | | |
| ssid | String | nullable | | |
| subnet | String | nullable | | |
| priority | Int | NOT NULL | 0 | |
| fallbackPortalId | UUID | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 5.5 PortalTemplate

**Description**: Reusable portal design templates. Can be built-in or custom.

**PostgreSQL Table**: `"PortalTemplate"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| category | String | NOT NULL | 'hotel' | hotel, resort, corporate, etc. |
| thumbnail | String | nullable | | |
| htmlContent | String | NOT NULL | | |
| cssContent | String | NOT NULL | | |
| isBuiltIn | Boolean | NOT NULL | false | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 5.6 PortalWhitelist

**Description**: Captive portal bypass URLs for hotel services (e.g., Apple CNA detection, DNS resolution).

**PostgreSQL Table**: `"PortalWhitelist"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| domain | String | NOT NULL | | |
| path | String | nullable | | null=all paths |
| description | String | nullable | | |
| protocol | String | NOT NULL | 'https' | |
| bypassAuth | Boolean | NOT NULL | true | |
| priority | Int | NOT NULL | 0 | |
| status | String | NOT NULL | 'active' | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([propertyId, domain, path])`

---

## Section 6: Bandwidth / FUP Tables

### 6.1 BandwidthPolicy

**Description**: Bandwidth shaping policy linked to WiFi plans. Defines download/upload speeds with optional burst.

**PostgreSQL Table**: `"BandwidthPolicy"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | |
| downloadKbps | Int | NOT NULL | 10240 | 10 Mbps |
| uploadKbps | Int | NOT NULL | 10240 | |
| burstDownloadKbps | Int | nullable | | |
| burstUploadKbps | Int | nullable | | |
| priority | Int | NOT NULL | 5 | 0=highest, 10=lowest |
| planId | UUID | nullable | | FK→WiFiPlan |
| description | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 6.2 BandwidthPolicyDetail

**Description**: Time-scheduled bandwidth rules within a policy. Supports different rates for different time periods.

**PostgreSQL Table**: `"BandwidthPolicyDetail"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| bandwidthPolicyId | UUID | NOT NULL | | |
| scheduleAccessId | UUID | nullable | | |
| downloadLimitBps | Int | NOT NULL | 0 | |
| uploadLimitBps | Int | NOT NULL | 0 | |
| guaranteedDownBps | Int | NOT NULL | 0 | |
| guaranteedUpBps | Int | NOT NULL | 0 | |
| burstTimeSeconds | Int | NOT NULL | 0 | |
| burstThresholdBytes | Int | NOT NULL | 0 | |
| burstUpTimeSeconds | Int | NOT NULL | 0 | |
| burstUpThresholdBytes | Int | NOT NULL | 0 | |
| contentionRatio | Int | NOT NULL | 1 | |
| priority | Int | NOT NULL | 0 | |
| isEnabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 6.3 BandwidthPool

**Description**: Shared bandwidth pool per subnet. Acts as HTB parent class for traffic control. Min 100 Mbps, Max 10 Gbit.

**PostgreSQL Table**: `"BandwidthPool"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | nullable | | |
| name | String | NOT NULL | | |
| subnet | String | nullable | | |
| vlanId | Int | nullable | | |
| totalDownloadKbps | Int | NOT NULL | 2000000 | Pool container: 2Gbit |
| totalUploadKbps | Int | NOT NULL | 2000000 | |
| perUserDownloadKbps | Int | nullable | | Default per-user download |
| perUserUploadKbps | Int | nullable | | Default per-user upload |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 6.4 BandwidthTopup

**Description**: Purchasable bandwidth topup packages.

**PostgreSQL Table**: `"BandwidthTopup"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| allottedUploadMb | Float | NOT NULL | 0 | |
| allottedDownloadMb | Float | NOT NULL | 0 | |
| allottedTotalMb | Float | NOT NULL | 0 | |
| applicableType | String | NOT NULL | 'total' | total, download, upload |
| bandwidthPolicyId | UUID | nullable | | |
| price | Float | NOT NULL | 0 | |
| currency | String | NOT NULL | 'USD' | |
| validityMinutes | Int | NOT NULL | 60 | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 6.5 BandwidthUsageDaily

**Description**: Daily aggregate bandwidth statistics per property.

**PostgreSQL Table**: `"BandwidthUsageDaily"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| date | Timestamptz | NOT NULL | | |
| totalDownloadMb | Float | NOT NULL | 0 | |
| totalUploadMb | Float | NOT NULL | 0 | |
| uniqueUsers | Int | NOT NULL | 0 | |
| peakUsers | Int | NOT NULL | 0 | |
| peakTime | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**:
- `@@unique([propertyId, date])`

### 6.6 BandwidthUsageSession

**Description**: Per-session bandwidth tracking.

**PostgreSQL Table**: `"BandwidthUsageSession"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| sessionId | UUID | NOT NULL | | |
| username | String | nullable | | |
| ipAddress | String | NOT NULL | | |
| macAddress | String | nullable | | |
| planId | UUID | nullable | | |
| policyId | UUID | nullable | | |
| downloadBytes | Int | NOT NULL | 0 | |
| uploadBytes | Int | NOT NULL | 0 | |
| durationSeconds | Int | NOT NULL | 0 | |
| startedAt | Timestamptz | NOT NULL | now() | |
| endedAt | Timestamptz | nullable | | |

### 6.7 FairAccessPolicy

**Description**: Fair Access Policy (FUP) — defines data thresholds after which users are throttled to reduced bandwidth. Extended with `throttleDownKbps`/`throttleUpKbps` columns (added via `complete-database.sql` ALTER TABLE).

**PostgreSQL Table**: `"FairAccessPolicy"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| cycleType | String | NOT NULL | 'daily' | daily, weekly, monthly |
| limitType | String | NOT NULL | 'total' | |
| dataLimitMb | Float | NOT NULL | | Threshold in MB |
| dataLimitUnit | String | NOT NULL | 'mb' | |
| switchOverBwPolicyId | UUID | nullable | | FK→BandwidthPolicy |
| cycleResetHour | Int | NOT NULL | 23 | |
| cycleResetMinute | Int | NOT NULL | 59 | |
| applicableOn | String | NOT NULL | 'total' | |
| isEnabled | Boolean | NOT NULL | true | |
| priority | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |
| throttleDownKbps | Int | NOT NULL | 256 | (via ALTER TABLE) |
| throttleUpKbps | Int | NOT NULL | 128 | (via ALTER TABLE) |

### 6.8 FupSwitchLog (fup_switch_log)

**Description**: FUP throttle/restore audit trail. Records every time a user crosses the FUP threshold and gets throttled.

**PostgreSQL Table**: `fup_switch_log`

| Column | PG Type | Constraints | Default | Comment |
|--------|---------|-------------|---------|---------|
| id | BIGINT | PK, autoincrement | | |
| username | TEXT | NOT NULL | | |
| fup_policy_name | TEXT | nullable | | Column: fup_policy_name |
| usage_mb | DOUBLE PRECISION | NOT NULL | 0 | Column: usage_mb |
| limit_mb | DOUBLE PRECISION | NOT NULL | 0 | Column: limit_mb |
| throttle_down_kbps | INT | NOT NULL | 0 | Column: throttle_down_kbps |
| throttle_up_kbps | INT | NOT NULL | 0 | Column: throttle_up_kbps |
| triggered_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| property_id | UUID | nullable | | |
| plan_name | TEXT | nullable | | Column: plan_name |
| cycle_type | TEXT | nullable | | Column: cycle_type |
| action | TEXT | NOT NULL | 'throttle' | |
| original_down_kbps | INT | NOT NULL | 0 | Column: original_down_kbps |
| original_up_kbps | INT | NOT NULL | 0 | Column: original_up_kbps |
| nas_ip | TEXT | nullable | | Column: nas_ip |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Indexes**:
- `fup_switch_log_triggered_idx` on `triggered_at`
- `fup_switch_log_username_idx` on `username`
- `idx_fup_switch_log_created_at` on `created_at`

---

## Section 7: Network Infrastructure Tables

### 7.1 NetworkInterface

**PostgreSQL Table**: `"NetworkInterface"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | eth0, eth1, wlan0 |
| type | String | NOT NULL | 'ethernet' | ethernet, vlan, bridge, bond, alias, loopback, wireless |
| hwAddress | String | nullable | | MAC address |
| mtu | Int | NOT NULL | 1500 | |
| speed | String | nullable | | 1000M, 2500M, 10000M |
| status | String | NOT NULL | 'down' | up, down, unknown |
| carrier | Boolean | NOT NULL | false | |
| isManagement | Boolean | NOT NULL | false | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, name])`

### 7.2 InterfaceRole

**PostgreSQL Table**: `"InterfaceRole"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| interfaceId | UUID | FK→NetworkInterface, NOT NULL | | |
| role | String | NOT NULL | 'lan' | wan, lan, dmz, management, wifi, unused |
| priority | Int | NOT NULL | 0 | WAN failover ordering |
| isPrimary | Boolean | NOT NULL | false | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, interfaceId])`

### 7.3 InterfaceConfig

**PostgreSQL Table**: `"InterfaceConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| interfaceId | UUID | FK→NetworkInterface, NOT NULL | | |
| mode | String | NOT NULL | 'static' | static, dhcp, disabled |
| ipAddress | String | nullable | | |
| netmask | String | nullable | | |
| gateway | String | nullable | | |
| dnsPrimary | String | nullable | | |
| dnsSecondary | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, interfaceId])`

### 7.4 VlanConfig

**PostgreSQL Table**: `"VlanConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| parentInterfaceId | UUID | FK→NetworkInterface, NOT NULL | | |
| vlanId | Int | NOT NULL | | VLAN tag |
| subInterface | String | NOT NULL | | eth0.100 |
| description | String | nullable | | |
| mtu | Int | NOT NULL | 1500 | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, vlanId])`, `@@unique([propertyId, subInterface])`

### 7.5 BridgeConfig

**PostgreSQL Table**: `"BridgeConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | br0, br-guest |
| memberInterfaces | String | NOT NULL | '[]' | JSON: ["eth1","eth2"] |
| stpEnabled | Boolean | NOT NULL | false | |
| forwardDelay | Int | NOT NULL | 15 | |
| helloTime | Int | NOT NULL | 2 | |
| maxAge | Int | NOT NULL | 20 | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, name])`

### 7.6 BondConfig

**PostgreSQL Table**: `"BondConfig"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | FK→Tenant, NOT NULL | | |
| propertyId | UUID | FK→Property, NOT NULL | | |
| name | String | NOT NULL | | bond0 |
| mode | String | NOT NULL | 'active-backup' | active-backup, balance-rr, 802.3ad |
| miimon | Int | NOT NULL | 100 | |
| lacpRate | String | NOT NULL | 'slow' | |
| primaryMember | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Indexes/Uniques**: `@@unique([propertyId, name])`

### 7.7 BondMember

**PostgreSQL Table**: `"BondMember"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| bondConfigId | UUID | FK→BondConfig, NOT NULL | | |
| interfaceId | UUID | FK→NetworkInterface, NOT NULL | | |
| priority | Int | NOT NULL | 0 | |
| createdAt | Timestamptz | NOT NULL | now() | |

**Indexes/Uniques**: `@@unique([bondConfigId, interfaceId])`

---

## Section 8: DHCP Tables

### 8.1 DhcpSubnet

**PostgreSQL Table**: `"DhcpSubnet"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| subnet | String | NOT NULL | | 192.168.1.0/24 |
| gateway | String | nullable | | |
| poolStart | String | NOT NULL | | 192.168.1.100 |
| poolEnd | String | NOT NULL | | 192.168.1.254 |
| leaseTime | Int | NOT NULL | 3600 | |
| vlanId | Int | nullable | | |
| vlanConfigId | UUID | nullable | | |
| domainName | String | nullable | | |
| dnsServers | String | NOT NULL | '[]' | |
| ntpServers | String | NOT NULL | '[]' | |
| bootFileName | String | nullable | | |
| nextServer | String | nullable | | |
| ipv6Enabled | Boolean | NOT NULL | false | |
| ipv6Prefix | String | nullable | | |
| ipv6PoolStart | String | nullable | | |
| ipv6PoolEnd | String | nullable | | |
| ipv6LeaseTime | Int | NOT NULL | 3600 | |
| ipv6RAType | String | NOT NULL | 'slaac' | |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 8.2 DhcpReservation

**PostgreSQL Table**: `"DhcpReservation"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | NOT NULL | | |
| macAddress | String | NOT NULL | | |
| ipAddress | String | NOT NULL | | |
| hostname | String | nullable | | |
| leaseTime | Int | nullable | | |
| linkedType | String | nullable | | guest, room, device, staff |
| linkedId | UUID | nullable | | |
| description | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([subnetId, macAddress])`, `@@unique([subnetId, ipAddress])`

### 8.3 DhcpLease

**PostgreSQL Table**: `"DhcpLease"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | NOT NULL | | |
| macAddress | String | NOT NULL | | |
| ipAddress | String | NOT NULL | | |
| hostname | String | nullable | | |
| clientId | String | nullable | | |
| leaseStart | Timestamptz | NOT NULL | now() | |
| leaseEnd | Timestamptz | NOT NULL | | |
| state | String | NOT NULL | 'active' | active, expired, released, declined |
| lastSeenAt | Timestamptz | NOT NULL | now() | |

**Uniques**: `@@unique([subnetId, ipAddress])`

### 8.4 DhcpOption

**PostgreSQL Table**: `"DhcpOption"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | nullable | | null=global option |
| code | Int | NOT NULL | | DHCP option code |
| name | String | NOT NULL | | |
| value | String | NOT NULL | | |
| type | String | NOT NULL | 'string' | string, ip, integer, boolean, hex |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 8.5 DhcpBlacklist

**PostgreSQL Table**: `"DhcpBlacklist"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | nullable | | null=global |
| macAddress | String | NOT NULL | | Supports wildcards |
| reason | String | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 8.6 DhcpHostnameFilter

**PostgreSQL Table**: `"DhcpHostnameFilter"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | nullable | | |
| pattern | String | NOT NULL | | Supports trailing wildcard |
| action | String | NOT NULL | 'ignore' | ignore, deny |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 8.7 DhcpTagRule

**PostgreSQL Table**: `"DhcpTagRule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| subnetId | UUID | nullable | | |
| name | String | NOT NULL | | |
| matchType | String | NOT NULL | | mac, vendor_class, user_class, hostname |
| matchPattern | String | NOT NULL | | |
| setTag | String | NOT NULL | | |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 8.8 DhcpLeaseScript

**PostgreSQL Table**: `"DhcpLeaseScript"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| scriptPath | String | NOT NULL | | Absolute path |
| events | String | NOT NULL | '["add","del","old"]' | JSON |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([tenantId, scriptPath])`

---

## Section 9: DNS Tables

### 9.1 DnsZone

**PostgreSQL Table**: `"DnsZone"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| domain | String | NOT NULL | | staysuite.local |
| description | String | nullable | | |
| vlanId | Int | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([propertyId, domain])`

### 9.2 DnsRecord

**PostgreSQL Table**: `"DnsRecord"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| zoneId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| type | String | NOT NULL | 'A' | A, AAAA, CNAME, MX, TXT, SRV, PTR |
| value | String | NOT NULL | | |
| ttl | Int | NOT NULL | 300 | |
| priority | Int | nullable | | For MX/SRV |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([zoneId, name, type])`

### 9.3 DnsRedirectRule

**PostgreSQL Table**: `"DnsRedirectRule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| matchPattern | String | NOT NULL | | *, *.example.com |
| targetIp | String | NOT NULL | | Captive portal IP |
| applyTo | String | NOT NULL | 'unauthenticated' | |
| priority | Int | NOT NULL | 0 | |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

---

## Section 10: Firewall Tables

### 10.1 FirewallZone

**PostgreSQL Table**: `"FirewallZone"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | lan, wan, dmz, guest, staff, iot |
| interfaces | String | NOT NULL | '[]' | JSON: ["eth0","eth1"] |
| inputPolicy | String | NOT NULL | 'accept' | |
| forwardPolicy | String | NOT NULL | 'accept' | |
| outputPolicy | String | NOT NULL | 'accept' | |
| masquerade | Boolean | NOT NULL | false | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([propertyId, name])`

### 10.2 FirewallRule

**PostgreSQL Table**: `"FirewallRule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| zoneId | UUID | NOT NULL | | |
| chain | String | nullable | 'input' | input, forward, output, prerouting, postrouting |
| protocol | String | nullable | | tcp, udp, icmp |
| sourceIp | String | nullable | | |
| sourceMac | String | nullable | | |
| sourcePort | String | nullable | | |
| sourcePortType | String | nullable | | include, exclude |
| destIp | String | nullable | | |
| destPort | String | nullable | | |
| destPortType | String | nullable | | include, exclude |
| action | String | NOT NULL | 'accept' | |
| jumpTarget | String | nullable | | |
| logPrefix | String | nullable | | |
| proxyTo | String | nullable | | |
| sourceIpType | String | nullable | 'ip' | ip, cidr, domain |
| destIpType | String | nullable | 'ip' | |
| sourceIpResolved | String | nullable | | |
| destIpResolved | String | nullable | | |
| name | VarChar(255) | NOT NULL | 'Unnamed Rule' | |
| enabled | Boolean | NOT NULL | true | |
| comment | String | nullable | | |
| priority | Int | NOT NULL | 0 | |
| scheduleId | UUID | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 10.3 FirewallSchedule

**PostgreSQL Table**: `"FirewallSchedule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| daysOfWeek | String | NOT NULL | '1,2,3,4,5,6,7' | 1=Mon, 7=Sun |
| startTime | String | NOT NULL | '00:00' | |
| endTime | String | NOT NULL | '23:59' | |
| timezone | String | NOT NULL | 'UTC' | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 10.4 PortForwardRule

**PostgreSQL Table**: `"PortForwardRule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| protocol | String | NOT NULL | 'tcp' | tcp, udp, both |
| externalPort | Int | NOT NULL | | |
| internalIp | String | NOT NULL | | |
| internalPort | Int | NOT NULL | | |
| sourceIp | String | nullable | | CIDR restriction |
| interfaceId | UUID | nullable | | |
| enabled | Boolean | NOT NULL | true | |
| description | String | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 10.5 ContentFilter

**PostgreSQL Table**: `"ContentFilter"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| category | String | NOT NULL | | social_media, streaming, adult, etc. |
| domains | String | NOT NULL | '[]' | JSON: domain list |
| enabled | Boolean | NOT NULL | true | |
| scheduleId | UUID | nullable | | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

---

## Section 11: Data/Reporting Tables

### 11.1 DataUsageByPeriod (data_usage_by_period)

**Description**: Aggregated data usage per user per time period. Used for FUP cycle tracking.

**PostgreSQL Table**: `data_usage_by_period`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| username | String | NOT NULL, PK (composite) | | |
| periodStart | Timestamptz | NOT NULL, PK (composite) | | |
| periodEnd | Timestamptz | nullable | | |
| acctinputoctets | BigInt | NOT NULL | 0 | Upload bytes |
| acctoutputoctets | BigInt | NOT NULL | 0 | Download bytes |

**PK**: `@@id([username, periodStart])`

### 11.2 NatLog

**PostgreSQL Table**: `"NatLog"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| timestamp | Timestamptz | NOT NULL | now() | |
| sourceIp | String | NOT NULL | | |
| sourcePort | Int | NOT NULL | | |
| destIp | String | NOT NULL | | |
| destPort | Int | NOT NULL | | |
| protocol | String | NOT NULL | | tcp, udp |
| destDomain | String | nullable | | |
| action | String | NOT NULL | 'allow' | allow, deny |
| bytes | Int | NOT NULL | 0 | |
| sessionId | UUID | nullable | | |

### 11.3 NetworkConfigBackup

**PostgreSQL Table**: `"NetworkConfigBackup"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| configData | String | NOT NULL | | Full JSON snapshot |
| version | Int | NOT NULL | 1 | |
| autoBackup | Boolean | NOT NULL | false | |
| createdAt | Timestamptz | NOT NULL | now() | |

---

## Section 12: System Monitoring Tables

### 12.1 SystemNetworkHealth

**PostgreSQL Table**: `"SystemNetworkHealth"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | UNIQUE, NOT NULL | | |
| hostname | String | nullable | | |
| kernelVersion | String | nullable | | |
| uptime | Int | NOT NULL | 0 | Seconds |
| cpuUsage | Float | NOT NULL | 0 | Percentage |
| ramTotal | Int | NOT NULL | 0 | KB |
| ramUsed | Int | NOT NULL | 0 | KB |
| diskTotal | Int | NOT NULL | 0 | KB |
| diskUsed | Int | NOT NULL | 0 | KB |
| cpuTemperature | Float | nullable | | |
| services | String | NOT NULL | '{}' | JSON: service status |
| lastUpdated | Timestamptz | NOT NULL | now() | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 12.2 SyslogServer

**PostgreSQL Table**: `"SyslogServer"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| protocol | String | NOT NULL | 'udp' | udp, tcp, tls |
| host | String | NOT NULL | | |
| port | Int | NOT NULL | 514 | |
| format | String | NOT NULL | 'ietf' | bsd, ietf, json |
| facility | String | NOT NULL | 'local1' | |
| severity | String | NOT NULL | 'info' | |
| categories | String | NOT NULL | '[]' | JSON |
| enabled | Boolean | NOT NULL | false | |
| tlsCertPath | String | nullable | | |
| tlsVerify | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 12.3 DeviceProfile

**Description**: Browser device fingerprint / storage token mapping for silent re-authentication. Survives MAC randomization.

**PostgreSQL Table**: `"DeviceProfile"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| wifiUserId | UUID | NOT NULL | | |
| guestId | UUID | nullable | | |
| fingerprintHash | String | NOT NULL | | SHA-256 of hardware signals |
| storageToken | String | nullable | | localStorage token |
| macAddress | String | nullable | | RADIUS MAC (after auth) |
| ipAddress | String | nullable | | |
| userAgent | String | nullable | | |
| deviceName | String | nullable | | |
| deviceType | String | nullable | | |
| fingerprintData | String | nullable | | Debug JSON |
| authCount | Int | NOT NULL | 0 | |
| lastAuthAt | Timestamptz | nullable | | |
| firstSeenAt | Timestamptz | NOT NULL | now() | |
| lastSeenAt | Timestamptz | NOT NULL | updatedAt | |
| isActive | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

**Uniques**: `@@unique([fingerprintHash, propertyId])`, `@@unique([storageToken, propertyId])`

### 12.4 WebCategory

**PostgreSQL Table**: `"WebCategory"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| name | String | NOT NULL | | |
| description | String | nullable | | |
| categoryType | String | NOT NULL | 'custom' | |
| isUploadRestricted | Boolean | NOT NULL | false | |
| isDefault | Boolean | NOT NULL | false | |
| implementationOn | String | NOT NULL | 'block' | block, allow |
| sortOrder | Int | NOT NULL | 0 | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

### 12.5 WebCategorySchedule

**PostgreSQL Table**: `"WebCategorySchedule"`

| Column | Type | Constraints | Default | Comment |
|--------|------|-------------|---------|---------|
| id | UUID | PK | uuid() | |
| tenantId | UUID | NOT NULL | | |
| propertyId | UUID | NOT NULL | | |
| webCategoryId | UUID | NOT NULL | | |
| scheduleAccessId | UUID | nullable | | |
| isAllow | Boolean | NOT NULL | false | |
| orderIndex | Int | NOT NULL | 0 | |
| startTime | String | NOT NULL | '00:00' | |
| endTime | String | NOT NULL | '23:59' | |
| daysOfWeek | String | NOT NULL | '1,2,3,4,5,6,7' | |
| enabled | Boolean | NOT NULL | true | |
| createdAt | Timestamptz | NOT NULL | now() | |
| updatedAt | Timestamptz | NOT NULL | updatedAt | |

---

## Section 13: Views (6 Views)

### 13.1 v_session_history — Master Session View

Performs a FULL JOIN between Prisma `WiFiSession` and FreeRADIUS `radacct`, then uses LATERAL joins to resolve `WiFiUser` (via username or guestId) and `DeviceProfile`. Uses 3-way COALESCE for MAC fallback: WiFiSession.macAddress → radacct.callingstationid → DeviceProfile.macAddress.

```sql
CREATE VIEW v_session_history AS
SELECT
    COALESCE(s.id::text, r.acctuniqueid) AS session_id,
    COALESCE(s.id::text, r.radacctid::text) AS radacctid,
    COALESCE(s.id::text, r.acctsessionid) AS acctsessionid,
    COALESCE(s."tenantId", '00000000-0000-0000-0000-000000000000'::uuid) AS "tenantId",
    COALESCE(s."planId", '00000000-0000-0000-0000-000000000000'::uuid) AS "planId",
    COALESCE(s."guestId", '00000000-0000-0000-0000-000000000000'::uuid) AS "guestId",
    COALESCE(s."bookingId", '00000000-0000-0000-0000-000000000000'::uuid) AS "bookingId",
    COALESCE(s."macAddress", r.callingstationid, dp."macAddress") AS callingstationid,
    COALESCE(s."macAddress", r.callingstationid, dp."macAddress") AS wifi_mac,
    COALESCE(s."ipAddress", r.framedipaddress) AS "ipAddress",
    COALESCE(s."ipAddress", r.framedipaddress) AS framedipaddress,
    COALESCE(dp."deviceName", s."deviceName") AS "deviceName",
    COALESCE(dp."deviceType", s."deviceType") AS "deviceType",
    COALESCE(s."startTime", r.acctstarttime) AS acctstarttime,
    COALESCE(s."startTime", r.acctupdatetime) AS acctupdatetime,
    COALESCE(s."endTime", r.acctstoptime) AS acctstoptime,
    COALESCE(s."dataUsed", 0::bigint) + COALESCE(r.acctinputoctets, 0::bigint)
        + COALESCE(r.acctoutputoctets, 0::bigint) AS total_data_used,
    COALESCE(s.duration::bigint, r.acctsessiontime, 0::bigint) AS acctsessiontime,
    COALESCE(
        CASE WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.7)::bigint
        ELSE r.acctoutputoctets END, 0::bigint) AS acctoutputoctets,
    COALESCE(
        CASE WHEN s."dataUsed" IS NOT NULL THEN (s."dataUsed"::numeric * 0.3)::bigint
        ELSE r.acctinputoctets END, 0::bigint) AS acctinputoctets,
    s."authMethod",
    COALESCE(s.status,
        CASE WHEN r.acctstoptime IS NULL THEN 'active'::text ELSE 'completed'::text END) AS session_status,
    -- ... (52 total columns)
    COALESCE(wp."sessionTimeoutSec", 0) AS "sessionTimeoutSec",
    COALESCE(wp."idleTimeoutSec", 0) AS "idleTimeoutSec",
    wp."burstDownloadSpeed",
    wp."burstUploadSpeed"
FROM "WiFiSession" s
    FULL JOIN (
        SELECT DISTINCT ON (radacct.username, radacct.acctsessionid) radacct.*
        FROM radacct ORDER BY radacct.username, radacct.acctsessionid, radacct.radacctid DESC
    ) r ON COALESCE(s."acctUniqueId", '')::text = r.acctuniqueid
         AND (s."acctUniqueId" IS NOT NULL OR s.id IS NULL)
    LEFT JOIN LATERAL (
        SELECT "WiFiUser".* FROM "WiFiUser"
        WHERE "WiFiUser".username = r.username
          OR (r.username IS NULL AND "WiFiUser"."guestId" IS NOT NULL AND "WiFiUser"."guestId" = s."guestId")
        LIMIT 1
    ) wu ON true
    LEFT JOIN LATERAL (
        SELECT "DeviceProfile"."deviceName","DeviceProfile"."deviceType","DeviceProfile"."macAddress",
               "DeviceProfile"."userAgent","DeviceProfile"."authCount","DeviceProfile"."wifiUserId"
        FROM "DeviceProfile"
        WHERE "DeviceProfile"."wifiUserId" = wu.id AND "DeviceProfile"."isActive" = true
        ORDER BY "DeviceProfile"."lastSeenAt" DESC LIMIT 1
    ) dp ON true
    LEFT JOIN "Guest" g ON COALESCE(wu."guestId", s."guestId") = g.id
    LEFT JOIN "Booking" b ON COALESCE(wu."bookingId", s."bookingId") = b.id
    LEFT JOIN "Room" rm ON b."roomId" = rm.id
    LEFT JOIN "Property" p ON COALESCE(wu."propertyId", b."propertyId") = p.id
    LEFT JOIN "WiFiPlan" wp ON COALESCE(s."planId", wu."planId") = wp.id;
```

### 13.2 v_active_sessions — Active Sessions Filter

Filters `v_session_history` where `session_status = 'active'`.

```sql
CREATE VIEW v_active_sessions AS
SELECT /* all 52 columns from v_session_history */
FROM v_session_history
WHERE session_status = 'active'::text;
```

### 13.3 v_auth_logs — Authentication Log

Enriched radpostauth with user/guest/room/plan info. Deduplicates Accept+Reject pairs using `DISTINCT ON (username, authdate_trunc)`.

```sql
CREATE VIEW v_auth_logs AS
SELECT pa.id::text AS id,
    pa.username,
    pa.reply AS auth_result,
    pa.authdate AS "timestamp",
    -- ... (20 total columns with enriched data)
    wp."downloadSpeed" AS plan_download_speed,
    wp."uploadSpeed" AS plan_upload_speed,
    wp."dataLimit" AS plan_data_limit
FROM (
    SELECT DISTINCT ON (username, authdate_trunc) *
    FROM (SELECT *, date_trunc('second', authdate) AS authdate_trunc FROM radpostauth) r
    ORDER BY username, authdate_trunc, id DESC
) pa
    LEFT JOIN LATERAL (SELECT framedipaddress FROM radacct WHERE radacct.username = pa.username ORDER BY radacct.acctstarttime DESC LIMIT 1) acct ON true
    LEFT JOIN "WiFiUser" u ON pa.username = u.username
    LEFT JOIN "WiFiUser" wu ON pa.username = wu.username
    LEFT JOIN "Guest" g ON u."guestId" = g.id
    LEFT JOIN "Booking" b ON u."bookingId" = b.id
    LEFT JOIN "Room" rm ON b."roomId" = rm.id
    LEFT JOIN "Property" p ON u."propertyId" = p.id
    LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
    LEFT JOIN LATERAL (SELECT groupname FROM radusergroup WHERE username = pa.username LIMIT 1) rg ON true;
```

### 13.4 v_user_usage — User Usage Aggregation

Aggregates bytes from BOTH WiFiUser AND radacct for external NAS users. Uses GREATEST to prefer the higher value.

```sql
CREATE VIEW v_user_usage AS
SELECT u.id AS user_id, u."tenantId", u."propertyId",
    u."guestId", u."bookingId", u.username, u."planId", u.status,
    COALESCE(u."totalBytesIn", 0::bigint) AS "totalBytesIn",
    COALESCE(u."totalBytesOut", 0::bigint) AS "totalBytesOut",
    GREATEST(
        COALESCE(u."totalBytesIn", 0::bigint) + COALESCE(u."totalBytesOut", 0::bigint),
        COALESCE((SELECT SUM(acctinputoctets + acctoutputoctets) FROM radacct acct WHERE acct.username = u.username), 0::bigint)
    ) AS total_data_used,
    -- ... session counts, download/upload bytes, guest/room/plan enrichment
FROM "WiFiUser" u
    LEFT JOIN "Guest" g ON u."guestId" = g.id
    LEFT JOIN "Booking" b ON u."bookingId" = b.id
    LEFT JOIN "Room" r ON b."roomId" = r.id
    LEFT JOIN "Property" p ON u."propertyId" = p.id
    LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;
```

### 13.5 v_wifi_users — WiFi User Profile with RADIUS Bridging

Complete WiFi user profile with RADIUS credential bridging via subqueries into `radcheck` and `radusergroup`.

```sql
CREATE VIEW v_wifi_users AS
SELECT u.id, u."tenantId", u."propertyId", u."guestId", u."bookingId",
    u.username, u."planId", u.status, u."validFrom", u."validUntil",
    u."totalBytesIn", u."totalBytesOut", u."sessionCount",
    u."lastAccountingAt" AS "lastSeenAt", u."createdAt", u."updatedAt",
    (SELECT rc.value FROM radcheck rc WHERE rc.username = u.username
        AND rc.attribute = 'Cleartext-Password' LIMIT 1) AS radius_password,
    (SELECT rg.groupname FROM radusergroup rg WHERE rg.username = u.username
        LIMIT 1) AS radius_group,
    -- ... guest, room, plan enrichment
FROM "WiFiUser" u
    LEFT JOIN "Guest" g ON u."guestId" = g.id
    LEFT JOIN "Booking" b ON u."bookingId" = b.id
    LEFT JOIN "Room" r ON b."roomId" = r.id
    LEFT JOIN "Property" p ON u."propertyId" = p.id
    LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id;
```

### 13.6 v_fup_switch_logs — FUP Event Log

FUP throttle/restore events enriched with user/plan/property data.

```sql
CREATE VIEW v_fup_switch_logs AS
SELECT fsl.id::text AS id, fsl.username, fsl.fup_policy_name,
    fsl.usage_mb, fsl.limit_mb, fsl.throttle_down_kbps, fsl.throttle_up_kbps,
    fsl.triggered_at,
    COALESCE(p.name, ''::text) AS property_name,
    wu."planId", wp.name AS plan_name, rg.groupname AS radius_group
FROM fup_switch_log fsl
    LEFT JOIN "WiFiUser" wu ON wu.username = fsl.username
    LEFT JOIN "Property" p ON p.id = fsl.property_id
    LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
    LEFT JOIN radusergroup rg ON rg.username = fsl.username
ORDER BY fsl.triggered_at DESC;
```

---

## Section 14: Database Functions (8 Functions)

### 14.1 fn_check_ip_pool

```sql
CREATE OR REPLACE FUNCTION public.fn_check_ip_pool(p_username text, p_ip inet)
 RETURNS integer
LANGUAGE plpgsql STABLE
AS $function$
DECLARE
    v_user_pool_id UUID; v_plan_id UUID; v_plan_pool_id UUID; v_in_pool BOOLEAN;
BEGIN
    SELECT wu."ipPoolId", wu."planId" INTO v_user_pool_id, v_plan_id
    FROM "WiFiUser" wu WHERE wu.username = p_username AND wu.status = 'active' LIMIT 1;
    IF v_user_pool_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM "IpPoolRange" WHERE "poolId" = v_user_pool_id
            AND p_ip >= "startIp" AND p_ip <= "endIp") INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;
    IF v_plan_id IS NULL THEN RETURN 1; END IF;
    SELECT wp."ipPoolId" INTO v_plan_pool_id FROM "WiFiPlan" wp WHERE wp.id = v_plan_id LIMIT 1;
    IF v_plan_pool_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM "IpPoolRange" WHERE "poolId" = v_plan_pool_id
            AND p_ip >= "startIp" AND p_ip <= "endIp") INTO v_in_pool;
        IF v_in_pool THEN RETURN 1; ELSE RETURN 0; END IF;
    END IF;
    RETURN 1;  -- No pool restriction
END;
$function$;
```

### 14.2 fn_get_user_pool_info

```sql
CREATE OR REPLACE FUNCTION public.fn_get_user_pool_info(p_username text)
 RETURNS TABLE(pool_name text, pool_id uuid, is_override boolean, source text)
LANGUAGE plpgsql STABLE
```

### 14.3 fn_get_pool_attr

```sql
CREATE OR REPLACE FUNCTION public.fn_get_pool_attr(p_username text, p_attr text)
 RETURNS text
LANGUAGE plpgsql STABLE
```

### 14.4 fn_check_fup

```sql
CREATE OR REPLACE FUNCTION public.fn_check_fup(p_username text)
 RETURNS TABLE(fup_triggered boolean, throttle_down integer, throttle_up integer,
    policy_name text, usage_mb double precision, limit_mb double precision)
LANGUAGE plpgsql STABLE
```

### 14.5 fn_check_login_limit

```sql
CREATE OR REPLACE FUNCTION public.fn_check_login_limit(p_username text)
 RETURNS integer  -- 0=allowed, 1=limit exceeded
LANGUAGE plpgsql STABLE
```

### 14.6 fn_get_effective_bandwidth

```sql
CREATE OR REPLACE FUNCTION public.fn_get_effective_bandwidth(p_username text, p_direction text)
 RETURNS integer  -- bps
LANGUAGE plpgsql
```

### 14.7 fn_get_mikrotik_rate_limit

```sql
CREATE OR REPLACE FUNCTION public.fn_get_mikrotik_rate_limit(p_username text)
 RETURNS text  -- e.g., "5120K/10240K"
LANGUAGE plpgsql
```

### 14.8 fn_is_fup_throttled

```sql
CREATE OR REPLACE FUNCTION public.fn_is_fup_throttled(p_username text)
 RETURNS integer  -- 0=not throttled, 1=throttled
LANGUAGE plpgsql
```

---

## Section 15: FreeRADIUS SQL Module Configuration

**Source**: `freeradius-install/etc/raddb/mods-enabled/sql`

```nginx
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    server = "localhost"
    port = 5432
    login = "staysuite"
    password = "Staysuite2025"
    radius_db = "staysuite"

    read_clients = yes
    client_table = "nas"
    sql_user_name = "%{User-Name}"

    pool {
        start = 1
        min = 1
        max = 5
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
        connect_timeout = 5.0
    }

    authorize_check_query = "SELECT id, username, attribute, value, op
        FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"

    authorize_reply_query = "SELECT id, username, attribute, value, op
        FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"

    group_membership_query = "SELECT groupname, priority
        FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"

    authorize_group_check_query = "SELECT id, groupname, attribute, value, op
        FROM radgroupcheck WHERE groupname = '%{Sql-Group}' ORDER BY id"

    authorize_group_reply_query = "SELECT id, groupname, attribute, value, op
        FROM radgroupreply WHERE groupname = '%{Sql-Group}' ORDER BY id"

    simul_count_query = "SELECT COUNT(*) FROM radacct
        WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"

    simul_verify_query = "SELECT radacctid, acctsessionid, username, nasipaddress,
        framedipaddress, calledstationid, callingstationid FROM radacct
        WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"

    accounting {
        query = "INSERT INTO radacct (...) VALUES (...)
            ON CONFLICT(acctuniqueid) DO UPDATE SET ..."
    }

    post-auth {
        query = "INSERT INTO radpostauth (username, pass, reply, authdate,
            clientipaddress, callingstationid, calledstationid,
            \"nasIpAddress\", \"replyMessage\")
            VALUES ('%{SQL-User-Name}', '', '%{reply:Packet-Type}',
            '%S'::timestamptz, '%{NAS-IP-Address}',
            '%{Calling-Station-Id}', '%{Called-Station-Id}',
            '%{NAS-IP-Address}', '%{reply:Reply-Message}')"
    }

    session {
        query = "SELECT * FROM radacct
            WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' AND acctstoptime IS NULL"
    }
}
```

---

## Section 16: Entity-Relationship Diagrams (ASCII Art)

### 16.1 WiFi Core ER Diagram

```
┌──────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────┐
│  Tenant  │────<│Property │────<│  WiFiUser   │────<│ WiFiPlan │
└──────────┘     └──────────┘     └──────┬────────┘     └────┬─────┘
                                        │                    │
                    ┌───────────────┐     │         ┌────▼───────┐
                    │ WiFiSession │     │         │WiFiVoucher│
                    └──────────────┘     │         └───────────┘
                                        │
                              ┌────────────┐   │
                              │  RadCheck  │   │
                              │  RadReply │◄──┘
                              │RadUserGrp │
                              └────────────┘
                                        │
                              ┌────────────┐
                              │  RadAcct   │
                              │RadPostAuth│
                              └────────────┘
```

### 16.2 Network Infrastructure ER Diagram

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Property    │────<│NetworkIntf│────<│  VlanConfig  │
└──────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                     │
                    ┌──────────┼──────────┐
                    │          │          │
             ┌──────────▼──┐ ┌──▼──────────┐ ┌▼──────────┐
             │InterfaceRole│ │InterfaceCfg│ │BondConfig │
             └────────────┘ └───────────┘ └─────┬────┘
                                                   │
                                             ┌──▼────────┐
                                             │ BondMember│
                                             └───────────┘
                    ┌──────────┐ ┌──▼──────────┐
                    │DhcpSubnet│ │BridgeConfig│
                    └──────────┘ └───────────┘
```

### 16.3 Captive Portal ER Diagram

```
┌──────────┐     ┌──────────────┐
│ Property │────<│CaptivePortal│
└──────────┘     └──────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────▼──────┐ ┌────▼──────┐ ┌────▼────────┐
   │ PortalPage  │ │PortalAuth │ │PortalMap   │
   └────────────┘ └──────────┘ └────────────┘
          │             │
   ┌──────▼──────┐ ┌────▼────────┐
   │PortalTmpl  │ │PortalWhite  │
   └────────────┘ │ list       │
                    └───────────┘
```

### 16.4 Bandwidth/FUP ER Diagram

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│ WiFiPlan │────<│BandwidthPol │────<│FairAccessPolicy│
└──────────┘     └──────────────┘     └───────┬──────────┘
                        │                     │
              ┌─────────┼─────────┐
              │                    │
     ┌────────▼────────┐ ┌─────▼──────────┐
     │BWPolicyDetail   │ │ FupSwitchLog  │
     └────────────────┘ └──────────────┘
                        │
     ┌─────────┬─────────┐
     │         │         │
┌────▼─────┐ ┌▼─────────┐ │
│BWPool   │ │BWTopup  │ │
└─────────┘ └─────────┘ │
                        │
              ┌─────────┴──────────┐
              │                   │
     ┌────────▼────────┐ ┌──────▼──────────┐
     │BWUsageDaily     │ │BWUsageSession │
     └────────────────┘ └────────────────┘
```

---

## Section 17: Data Flows (ASCII Sequence Diagrams)

### 17.1 PMS Check-In → WiFi User Provisioning Flow

```
Guest          Booking       WiFiService         RadiusProvisioningLog     RadCheck/RadReply
  │               │              │                      │                    │
  │──Check-In──────>│              │                      │                    │
  │               │──CheckInEvent──>│                      │                    │
  │               │              │──Create WiFiUser──────>│                    │
  │               │              │  (generate creds)      │                    │
  │               │              │                      │                    │
  │               │              │──INSERT provisioningLog─>│                    │
  │               │              │                      │                    │
  │               │              │──INSERT radcheck──────>│──INSERT radreply──>│
  │               │              │  (Cleartext-Password)  │  (Rate-Limit, etc)  │
  │               │              │  (User-Password)       │  (Session-Timeout)   │
  │               │              │                      │                    │
  │               │              │──INSERT radusergroup─>│                    │
  │               │              │  (plan group name)       │                    │
  │               │              │                      │                    │
  │<──WiFi Creds───│<──────────────│<─────────────────────│                    │
```

### 17.2 MikroTik Captive Portal → RADIUS Authentication Flow

```
Guest Device       MikroTik AP      FreeRADIUS          RadCheck           PostAuth
  │                   │               │                      │                  │
  │──Connect WiFi────>│               │                      │                  │
  │                   │──Access-Req───>│                      │                  │
  │                   │  (User-Name,   │                      │                  │
  │                   │   User-Password)  │                      │                  │
  │                   │               │──authorize_check_query──>│                  │
  │                   │               │                      │                  │
  │                   │               │──authorize_reply_query─>│                  │
  │                   │               │                      │                  │
  │                   │               │──simul_count_query──>│                  │
  │                   │               │                      │                  │
  │                   │               │──fn_check_ip_pool──>│                  │
  │                   │               │                      │                  │
  │                   │               │──fn_check_fup───────>│                  │
  │                   │               │                      │                  │
  │                   │               │──fn_get_effective───>│                  │
  │                   │               │  bw (bps)            │                  │
  │                   │               │                      │                  │
  │                   │               │──Access-Accept──────>│                  │
  │                   │               │  +Reply attrs       │                  │
  │                   │               │                      │──INSERT radpostauth>│
  │                   │<──Access-Accept─│                      │                  │
  │<──Redirect────────│  +rate-limit  │                      │                  │
  │   to internet      │  +session-T │                      │                  │
```

### 17.3 FreeRADIUS Auth + Accounting Flow

```
NAS AP         FreeRADIUS           PostgreSQL         Application
  │               │                   │                  │
  │──Access-Req───>│                   │                  │
  │  (packet)       │──sql authorize──────>│                  │
  │               │  SELECT radcheck   │                  │
  │               │  SELECT radreply    │                  │
  │               │  SELECT radusergrp  │                  │
  │               │  fn_check_ip_pool  │                  │
  │               │  fn_check_fup      │                  │
  │               │  fn_check_login   │                  │
  │               │  fn_eff_bw        │                  │
  │               │                   │                  │
  │               │<──password/data────│                  │
  │               │                   │                  │
  │<──Access-Accept─│                   │                  │
  │  +reply attrs  │                   │                  │
  │               │                   │                  │
  │──Acct-Start──>│──accounting query─>│                  │
  │  (Start)       │  INSERT radacct    │                  │
  │               │  ON CONFLICT      │                  │
  │               │  DO UPDATE       │                  │
  │               │                   │                  │
  │──Interim──────>│──accounting query─>│                  │
  │  (Interim)     │  UPDATE radacct    │                  │
  │               │  (bytes/time)     │                  │
  │               │                   │                  │
  │──Acct-Stop────>│──accounting query─>│                  │
  │  (Stop)        │  UPDATE radacct    │                  │
  │               │  SET stoptime    │                  │
  │               │  SET terminate  │                  │
  │               │                   │                  │
  │               │──post-auth query──>│                  │
  │               │  INSERT radpostauth│                  │
  │               │                   │                  │
  │               │<──OK──────────│                  │
```

### 17.4 Session Engine Cron Flow

```
Cron (every N min)    WiFiService          PostgreSQL         WiFiUser
  │                    │                   │                  │
  │──trigger───────────>│                   │                  │
  │                    │──SELECT radacct───>│                  │
  │                    │ WHERE stop=NULL    │                  │
  │                    │ AND update>lastSync│                  │
  │                    │                   │                  │
  │                    │──For each row:      │                  │
  │                    │  UPDATE WiFiUser     │<─────────────────│
  │                    │  SET totalBytesIn  │                  │
  │                    │  SET totalBytesOut │                  │
  │                    │  SET lastAcctAt   │                  │
  │                    │                   │                  │
  │                    │──Check data caps───>│                  │
  │                    │  If exceeded:       │                  │
  │                    │    fn_check_fup     │                  │
  │                    │    CoA disconnect│                  │
  │                    │    UPDATE status  │                  │
  │                    │                   │                  │
  │                    │──Stale sessions──>│                  │
  │                    │  WHERE last seen   │                  │
  │                    │  > timeout     │                  │
  │                    │  UPDATE status  │                  │
  │                    │  to 'completed'  │                  │
```

### 17.5 FUP Throttle Flow

```
Interim-Update     FreeRADIUS              fn_check_fup()       FupSwitchLog    CoA
  │                   │                        │                      │              │
  │──radacct──────>│──post-auth sql───>│──Get usage in cycle──>│              │
  │  (interim)        │  (updates acct)     │                      │              │
  │                   │                        │──Check threshold──>│              │
  │                   │                        │  if exceeded:   │              │
  │                   │                        │                │              │
  │                   │                        │──INSERT ─────────>│──Throttle CoA─>│
  │                   │                        │  action=throttle │  Set rate   │
  │                   │                        │  log original  │  limit     │
  │                   │                        │  + throttle  │              │
  │                   │                        │  + limit     │              │
  │                   │                        │              │<──OK─────│
  │                   │                        │              │
  │                   │                        │──Get throttled──>│              │
  │                   │                        │  bandwidth   │              │
  │                   │                        │  for reply   │              │
  │                   │                        │              │              │
  │                   │<──eff_bw────────────│              │              │
  │                   │  (throttled       │              │              │
  │                   │   or normal)       │              │              │
  │                   │  as radreply     │              │              │
  │                   │                        │              │              │
  │<──Interim-Reply──│<──Access-Accept─────│              │              │
  │  +rate-limit     │  +Cryptsk-Rate-   │              │              │
  │                  │   Limit etc.      │              │              │
```

### 17.6 IP Pool Assignment Flow

```
Auth Request       fn_check_ip_pool()         IpPoolRange          RadCheck
  │                    │                        │                   │
  │──auth req──────>│                        │                   │
  │  (username,    │──Get WiFiUser ───>│                   │
  │   client IP)    │  Get WiFiPlan ───>│                   │
  │               │                        │                   │
  │               │──Priority 1:──────>│──Check user pool──>│                   │
  │               │  User ipPoolId       │                   │                   │
  │               │  pool range?         │                   │                   │
  │               │                        │                   │                   │
  │               │──If match:        │                   │                   │
  │               │  RETURN 1          │                   │                   │
  │               │                        │                   │                   │
  │               │──Priority 2:──────>│──Check plan pool──>│                   │                   │
  │               │  Plan.ipPoolId        │                   │                   │                   │
  │               │  pool range?         │                   │                   │                   │
  │               │                        │                   │                   │
  │               │──If match:        │                   │                   │
  │               │  RETURN 1          │                   │                   │
  │               │                        │                   │                   │
  │               │──Priority 3:──────>│──No plan pool──>│                   │                   │
  │               │  RETURN 1          │                   │                   │
  │               │  (no restriction)   │                   │                   │
  │               │                        │                   │                   │
  │<──Accept/Reject─│<─────────────────>│                   │                   │
```

---

## Section 18: Table Count Summary

### Prisma ORM Tables (WiFi Module)

| # | Table Name | Description |
|---|-----------|-------------|
| 1 | WiFiUser | WiFi user credentials linked to PMS guest/booking |
| 2 | WiFiPlan | Bandwidth/data/session plan definitions |
| 3 | WiFiSession | User session tracking with data usage |
| 4 | WiFiVoucher | Pre-generated access codes |
| 5 | WiFiAAAConfig | Per-property AAA configuration |
| 6 | WiFiAccountingSync | Accounting sync position tracker |
| 7 | WiFiGateway | Physical gateway device registry |
| 8 | RadCheck | RADIUS check attributes (passwords) |
| 9 | RadReply | RADIUS reply attributes (bandwidth, limits) |
| 10 | RadUserGroup | User-to-group mapping |
| 11 | RadGroupCheck | Group-level check attributes |
| 12 | RadGroupReply | Group-level reply attributes |
| 13 | RadAcct | FreeRADIUS accounting data |
| 14 | RadPostAuth | Auth attempt log |
| 15 | Nas | FreeRADIUS NAS client registry |
| 16 | RadiusServerConfig | Per-property RADIUS server config |
| 17 | RadiusNAS | Network Access Server registry |
| 18 | RadiusCoaLog | CoA action audit log |
| 19 | RadiusProvisioningLog | Provision/deprovision log |
| 20 | RadiusAuthLog | Auth attempt log (property-level) |
| 21 | RadiusMacAuth | MAC auto-auth whitelist |
| 22 | RadiusEventUser | Event/conference WiFi users |
| 23 | CoaSessionDetail | Per-session CoA audit detail |
| 24 | CaptivePortal | Portal instance configuration |
| 25 | PortalPage | Portal page design per language |
| 26 | PortalAuthentication | Portal auth method config |
| 27 | PortalMapping | Portal-to-VLAN/SSID mapping |
| 28 | PortalTemplate | Reusable portal design templates |
| 29 | PortalWhitelist | Captive portal bypass URLs |
| 30 | IpPool | IP address pool for user restriction |
| 31 | IpPoolRange | IP range within a pool |
| 32 | BandwidthPolicy | Bandwidth shaping policy |
| 33 | BandwidthPolicyDetail | Time-scheduled bandwidth rules |
| 34 | BandwidthPool | Shared bandwidth pool per subnet |
| 35 | BandwidthTopup | Purchasable bandwidth topups |
| 36 | BandwidthUsageDaily | Daily bandwidth aggregates |
| 37 | BandwidthUsageSession | Per-session bandwidth tracking |
| 38 | FairAccessPolicy | FUP data threshold policy |
| 39 | FupSwitchLog | FUP throttle/restore audit |
| 40 | NetworkInterface | Physical/virtual network interface |
| 41 | InterfaceRole | WAN/LAN/DMZ role assignment |
| 42 | InterfaceConfig | IP configuration per interface |
| 43 | InterfaceAlias | Secondary IPs per interface |
| 44 | VlanConfig | VLAN configuration |
| 45 | BondConfig | Link aggregation config |
| 46 | BondMember | Interface in a bond |
| 47 | BridgeConfig | Network bridge config |
| 48 | DhcpSubnet | DHCP subnet configuration |
| 49 | DhcpReservation | Static DHCP reservations |
| 50 | DhcpLease | Live DHCP lease state |
| 51 | DhcpOption | Custom DHCP options |
| 52 | DhcpBlacklist | MAC deny list |
| 53 | DhcpHostnameFilter | Hostname-based filters |
| 54 | DhcpTagRule | Tag-based classification |
| 55 | DhcpLeaseScript | Lease event hook scripts |
| 56 | DnsZone | DNS zone for LAN resolution |
| 57 | DnsRecord | Individual DNS record |
| 58 | DnsRedirectRule | DNS redirect rules |
| 59 | FirewallZone | Logical firewall zone |
| 60 | FirewallRule | Firewall rule |
| 61 | FirewallSchedule | Time-based rule activation |
| 62 | PortForwardRule | NAT port forwarding rules |
| 63 | ContentFilter | DNS/content filtering categories |
| 64 | DataUsageByPeriod | Aggregated data usage per period |
| 65 | NatLog | NAT translation log |
| 66 | NetworkConfigBackup | Network config backup/restore |
| 67 | SystemNetworkHealth | Gateway system health metrics |
| 68 | SyslogServer | Remote syslog server config |
| 69 | DeviceProfile | Browser device fingerprint |
| 70 | WebCategory | Web category for content filtering |
| 71 | WebCategorySchedule | Time-based category rules |
| 72 | WiFiUserStatusHistory | User status change audit trail |

### Native SQL Tables

| # | Table Name | Description |
|---|-----------|-------------|
| 73 | nasreload | NAS reload tracking |
| 74 | data_usage_by_period | Aggregated usage per user/period |
| 75 | fup_switch_log | FUP throttle/restore log (native) |

### nftables Service Tables

| # | Table Name | Description |
|---|-----------|-------------|
| 76 | NftGuiRule | GUI firewall rules |
| 77 | NftPortForward | Port forwarding rules |
| 78 | NftRateLimit | Rate limiting rules |
| 79 | NftQuickBlock | Instant IP/subnet/MAC blocks |
| 80 | NftSchedule | Firewall schedules |

### Views (6)

| # | View Name | Description |
|---|-----------|-------------|
| 81 | v_session_history | Master session view (FULL JOIN) |
| 82 | v_active_sessions | Active session filter |
| 83 | v_auth_logs | Auth log with deduplication |
| 84 | v_user_usage | User usage aggregation |
| 85 | v_wifi_users | WiFi user + RADIUS bridge |
| 86 | v_fup_switch_logs | FUP event enrichment |

### Database Functions (8)

| # | Function Name | Description |
|---|-------------|-------------|
| 87 | fn_check_ip_pool | Check if IP belongs to user's pool |
| 88 | fn_get_user_pool_info | Resolve user's IP pool assignment |
| 89 | fn_get_pool_attr | Get pool attribute (gateway) |
| 90 | fn_check_fup | Check FUP threshold |
| 91 | fn_check_login_limit | Check concurrent session limit |
| 92 | fn_get_effective_bandwidth | Get BW considering FUP |
| 93 | fn_get_mikrotik_rate_limit | Format MikroTik rate limit string |
| 94 | fn_is_fup_throttled | Simple FUP throttle check |

### Grand Total: **~94 objects**

---

*End of StaySuite WiFi Module — Complete Database Design Document*

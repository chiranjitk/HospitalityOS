# StaySuite WiFi Gateway — Feature Suggestions & Product Roadmap

> **Context:** StaySuite HospitalityOS WiFi module is a **PMS-integrated hotel/resort WiFi gateway product**  
> **Current State:** 19/26 features have code (2 production-ready, 15 partial, 2 schema-only) — 41 components, 127+ API routes, 86 Prisma models, 15 vendor adapters, FreeRADIUS, KEA DHCP, nftables  
> **Perspective:** Competing with Purple WiFi, Cloud4Wi, Spectra, GoCaptive, Cisco Spaces  
> **Focus:** AAA + RADIUS + Gateway + External Integration capabilities for the hospitality market

---

## Executive Summary

The WiFi module is already exceptionally deep technically, but to be a **competitive hospitality WiFi gateway product**, it needs features in 5 key areas that differentiate a PMS-integrated solution from a standalone WiFi controller:

1. **Revenue Generation** — WiFi as a profit center, not just a cost
2. **Guest Experience** — Personalized, frictionless, revenue-driving portal
3. **Security & Compliance** — Regulatory compliance across jurisdictions
4. **Operational Intelligence** — Analytics that drive decisions
5. **Ecosystem Integration** — Deep PMS + third-party connectivity

Below are **26 feature suggestions** organized by business value.

### Production-Ready Status Summary

| Status | Count | Features |
|--------|-------|----------|
| **✅ PRODUCTION READY** | **2** | F4 (Plans), F24 (Cloud Controller Integration) |
| **⚠️ PARTIAL** (UI + API exist with significant gaps) | **15** | F1, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F20, F22, F23 |
| **🔴 SCHEMA ONLY** (DB model exists, zero UI/API) | **2** | F2 (Ad-Supported WiFi), F3 (Partner WiFi) |
| **❌ NOT IMPLEMENTED** | **7** | F16, F17, F18, F19, F21, F25, F26 |

### Systemic Issues Across All Partial Features

| Issue | Affected Features |
|-------|-------------------|
| **Hardcoded `TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b'`** — bypasses auth | F1, F6, F7, F9, F12, F13, F14, F20, F22 (9 features) |
| **No `requirePermission()` middleware** — security hole | F1, F2, F3, F6, F7, F9, F12, F13, F14, F20, F22 |
| **No background cron/scheduler for automated actions** | F7, F9, F13, F20, F22 |
| **No guest-facing portal integration** | F1, F2, F3, F12 |

---

## CATEGORY 1: REVENUE GENERATION (WiFi as Profit Center)

### F1. Bandwidth Upsell in Captive Portal ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Bandwidth Upsell** (`#wifi-bandwidth-upsell`) |
| **Component** | `src/components/wifi/wifi-bandwidth-upsell.tsx` (905 lines) |
| **API** | `/api/wifi/bandwidth-upgrade/route.ts` (GET/POST), `[id]/route.ts` (PATCH), `settings/route.ts` (GET/PUT), `stats/route.ts` (GET) — **4 routes** |
| **Verified Working** | ✅ Transaction listing with filters, ✅ Upgrade path visualization, ✅ Settings (tiers, pricing, currency), ✅ Refund action, ✅ Revenue stats |
| **Critical Gaps** | 🔴 **Fake CoA** — POST creates record with `coaStatus: 'applied'` but performs zero actual RADIUS CoA bandwidth change. 🔴 **Hardcoded tenant ID** (no auth). 🟡 No captive portal upsell UI for guests. 🟡 Currency hardcoded `₹` in tier settings. |

### F2. Ad-Supported Free WiFi (Monetized Portal) 🔴 SCHEMA ONLY
| | |
|---|---|
| **Page/Menu** | ❌ **NONE** — not in navigation, not accessible from UI |
| **Component** | ❌ **NONE** — no WiFi portal ad component exists |
| **API** | ❌ **NONE** — no routes under `/api/wifi/` for portal ads |
| **What Exists** | Prisma model `PortalAdCampaign` (schema.prisma lines 7709–7738) with fields: advertiser, creativeUrl, creativeType, slot, impressions, clicks, revenue, targeting, status. Revenue dashboard (`/api/wifi/revenue-dashboard`) queries this model but always gets ₹0. |
| **Critical Gaps** | 🔴 Zero management UI. 🔴 Zero CRUD API. 🔴 No portal-side ad rendering. 🔴 No impression/click tracking. Complete feature gap — only a database model. |

### F3. Partner WiFi / Sponsored Access 🔴 SCHEMA ONLY
| | |
|---|---|
| **Page/Menu** | ❌ **NONE** — not in navigation, not accessible from UI |
| **Component** | ❌ **NONE** — no partner management component exists |
| **API** | ❌ **NONE** — no routes for managing WiFi partners |
| **What Exists** | Prisma models `WiFiPartner` + `WiFiPartnerAuth` (schema.prisma lines 7740–7787) with fields: partnerType, authMethod, costPerAuth, commission, maxDailyAuths. Seed data exists. Revenue dashboard queries this model but always gets ₹0. |
| **Critical Gaps** | 🔴 Zero management UI. 🔴 Zero CRUD API. 🔴 No captive portal promo code entry. 🔴 No partner onboarding. Complete feature gap — only database models. |

### F4. Time-Based / Session-Based Plans ✅ PRODUCTION READY
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → WiFi Access → **Plans** tab |
| **Component** | `src/components/wifi/plans.tsx` (1000+ lines) |
| **API** | `/api/wifi/plans/route.ts` (full CRUD with `requirePermission`) — **1 route, all methods** |
| **Verified Working** | ✅ Full CRUD with RBAC + tenant isolation. ✅ RADIUS group sync (`syncRadiusGroup()`). ✅ Real CoA bandwidth push on plan update — local NAS via `tc` (non-disruptive), external NAS via vendor-specific radclient (MikroTik, Cisco, generic WISPr). ✅ Idle timeout sync to active users. ✅ Delete removes RADIUS group. ✅ Premium card UI with speed badges. ✅ Stats cards. |
| **Minor Notes** | This is the **most production-ready WiFi feature**. Properly uses `requirePermission(request, 'wifi.manage')`. |

### F5. Conference / Event WiFi Packages ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → WiFi Access → **Event WiFi** tab |
| **Component** | `src/components/wifi/event-wifi.tsx` (1000+ lines), `print-card.tsx` (215 lines) |
| **API** | Proxied through `/api/wifi/radius` (POST with action parameter): `event-users`, `create-event`, `create-event-attendee`, `generate-event-users`, `delete-event`, `revoke-event-user` |
| **Verified Working** | ✅ Event creation with organizer info. ✅ Bulk credential generation with progress bar. ✅ QR code print cards. ✅ Revocation. ✅ Credential table. |
| **Critical Gaps** | 🔴 **No dedicated Prisma model** — all event data lives in RADIUS service, not queryable via Prisma. 🔴 RADIUS service must be running (operations fail otherwise). 🟡 No event-level revenue tracking. 🟡 No CSV/PDF export. |

### F6. WiFi Revenue Analytics Dashboard ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Revenue Analytics** (`#wifi-revenue-dashboard`) |
| **Component** | `src/components/wifi/wifi-revenue-dashboard.tsx` (490 lines) |
| **API** | `/api/wifi/revenue-dashboard/route.ts` (GET, 298 lines) — **1 route** |
| **Verified Working** | ✅ 5 KPI cards (Total Revenue, MRR, ARPU, Conversion Rate, Active Subs). ✅ Revenue by source breakdown. ✅ 30-day bar chart. ✅ Top plans by revenue. ✅ Peak revenue hours. ✅ Revenue forecast. |
| **Critical Gaps** | 🔴 **Hardcoded tenant ID** (no auth). 🔴 **Queries ghost models** — partner auth (F3) and ad campaign (F2) queries always return ₹0 since those features have no UI/API. 🔴 **Currency hardcoded to INR** (`₹`, Cr, L formatting). 🟡 No user-selectable date range (hardcoded 30 days). 🟡 N+1 query pattern for plan names. |

---

## CATEGORY 2: GUEST EXPERIENCE (Frictionless & Personalized)

### F7. Pre-Arrival WiFi Credential Delivery ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Pre-Arrival Delivery** (`#wifi-pre-arrival`) |
| **Component** | `src/components/wifi/wifi-pre-arrival.tsx` (975 lines) |
| **API** | `/api/wifi/pre-arrival/route.ts` (GET/POST), `[id]/route.ts` (GET/PATCH/DELETE), `send/route.ts` (POST), `delivery-logs/route.ts` (GET) — **4 routes** |
| **Verified Working** | ✅ Config UI (email/SMS/QR templates, delivery timing). ✅ Delivery logs viewer. ✅ Template customization. |
| **Critical Gaps** | 🔴 **Email/SMS delivery is SIMULATED** — `send/route.ts` only creates `notificationLog` records with `status: 'sent'`. Zero SMTP/Twilio integration. 🔴 **Hardcoded tenant ID** (no auth). 🔴 **No scheduler/cron** — `hoursBeforeArrival` config stored but no background job triggers delivery. 🟡 `delivery-logs` propertyId filter is broken (no-op query). |

### F8. Personalized Captive Portal (PMS-Aware) ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Captive Portal** (`#wifi-portal`) |
| **Component** | `src/components/wifi/portal-page.tsx` (4,092 lines — largest component in project) |
| **API** | **19 route files** under `/api/wifi/portal/`: instances, instances/[id], templates, templates/[id], mappings, mappings/[id], pages, pages/[id], auth-methods, auth-methods/[id], vouchers, analytics, dns-zones, dns-zones/[id], dns-redirects, dns-redirects/[id], dns-records, dns-records/[id], resolve-zone |
| **Verified Working** | ✅ **25 themes** (5 Premium + 4 Corporate + 6 Lifestyle + 5 Modern + 2 Seasonal + 3 Specialty). ✅ **8 designer sub-tabs** (templates, layout, background, typography, formstyle, content, fields, advanced). ✅ **16 languages** (en, es, fr, de, zh, ja, ko, ar, hi, pt, ru, it, nl, th, vi, tr). ✅ Zone-based architecture with roaming config (3 modes). ✅ Portal instance CRUD with slug, SSID, bandwidth policy. ✅ 7 top-level tabs (Portals, Pool Mappings, Portal Designer, Analytics, Voucher Designer, Print Cards, Walled Garden). |
| **Critical Gaps** | 🔴 **No guest-facing captive portal rendering** — `/app/portal/[token]/` is a pre-arrival KYC portal, NOT a WiFi captive portal. `/app/portal/captive/` exists but doesn't render the designed themes. 🟡 Portal templates are frontend-only constants (not stored in DB). 🟡 Roaming config stored but no runtime enforcement (see F11). |

### F9. Multi-Device Auto-Registration ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Multi-Device Registration** (`#wifi-device-management`) |
| **Component** | `src/components/wifi/wifi-device-management.tsx` (1,406 lines) |
| **API** | `/api/wifi/devices/route.ts` (GET/POST), `[id]/route.ts` (GET/PATCH/DELETE), `settings/route.ts` (GET/PUT), `lookup/route.ts` — **4 routes** + separate `/api/v1/wifi/auto-auth/route.ts` (1,004 lines) |
| **Verified Working** | ✅ Full device registry CRUD with search, filtering, approval. ✅ Settings (max devices, cleanup days). ✅ Guest grouping with collapsible rows. ✅ The REAL auto-auth system (`/api/v1/wifi/auto-auth`) uses fingerprinting + actual FreeRADIUS integration (`radiusAuth()`, `radCheck`/`radReply`). |
| **Critical Gaps** | 🔴 **`autoAuth` flag is DB-only** — toggling it in the admin UI only updates the database boolean. Zero code pushes MAC addresses to FreeRADIUS when enabled. 🔴 **Admin UI and real auto-auth system are disconnected** — `wifi-device-management.tsx` manages `WiFiDevice` records, while the production auto-auth uses `DeviceProfile` + fingerprinting (completely separate system). 🔴 **Hardcoded tenant ID**. 🔴 **No cleanup cron** — `autoCleanupDays` setting stored but no job deletes stale devices. |

### F10. Digital Directory & Services in Portal (Walled Garden) ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → Captive Portal → **Walled Garden** sub-tab |
| **Component** | `src/components/wifi/portal-whitelist.tsx` (862 lines) |
| **API** | `/api/wifi/portal-whitelist/route.ts` (GET/POST/PUT/DELETE), `/api/wifi/walled-garden/route.ts` (GET/POST) — **2 routes** |
| **Verified Working** | ✅ Domain CRUD with search, export DNS config, duplicate detection. ✅ **8 hotel service presets** (Hotel Website, Booking Engine, Payment Gateway, Restaurant Menu, Spa, Concierge, TripAdvisor, Google Maps). ✅ **Real nftables firewall integration** — `scripts/staysuite_core/walled-garden-apply.sh` (661 lines) is production-grade: queries PostgreSQL, resolves domains via `dig`, manages nftables sets, writes dnsmasq config, handles wildcards. ✅ Proper `requirePermission()` auth. |
| **Minor Gaps** | 🟡 No auto-apply on whitelist change — must manually click "Apply to Firewall". 🟡 DNS export uses generic fallback hostname. |

### F11. Seamless Multi-Property Roaming ⚠️ PARTIAL (CONFIG ONLY)
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → Captive Portal → **Portal Instances** tab (roaming fields) |
| **Component** | Part of `src/components/wifi/portal-page.tsx` (not standalone) |
| **API** | `/api/wifi/portal/instances/route.ts` (POST/GET), `instances/[id]/route.ts` (PUT/DELETE), `resolve-zone/route.ts` — **3 routes** |
| **Verified Working** | ✅ Roaming config UI: `roamingMode` select (auth_origin / seamless / reauth), `allowsRoamingFrom` multi-select, `bandwidthPolicy` (zone/origin/minimum). ✅ Visual roaming badges. ✅ Zone-based portal architecture with slug. ✅ Proper `requirePermission()` auth. |
| **Critical Gaps** | 🔴 **NO runtime enforcement** — No `roaming-validate` API. The `resolve-zone` route only looks up portals by slug. The auto-auth flow (`/api/v1/wifi/auto-auth`) does NOT validate roaming permissions. 🔴 **No RADIUS-level roaming check** — FreeRADIUS config doesn't reference roaming zones. 🔴 **Bandwidth policy stored but not enforced** — no code applies different bandwidth based on roaming origin. |

### F12. In-Portal Satisfaction Survey ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Guest Surveys** (`#wifi-satisfaction-surveys`) |
| **Component** | `src/components/wifi/wifi-satisfaction-surveys.tsx` (775 lines) |
| **API** | `/api/wifi/satisfaction/route.ts` (GET/POST), `satisfaction/stats/route.ts` (GET) — **2 routes** |
| **Verified Working** | ✅ Admin dashboard: overall rating, distribution (1–5), category scores (speed, coverage, ease of connect), trend comparison. ✅ Survey creation with star ratings + comments. ✅ Alerts for low-rated APs/rooms. ✅ Statistics API with daily trends. |
| **Critical Gaps** | 🔴 **Hardcoded tenant ID** (no auth). 🔴 **No rate limiting** on survey submission. 🔴 **No guest-facing portal integration** — surveys only submittable from admin dashboard, NOT from captive portal or guest portal. 🔴 No guestId binding in admin submissions (anonymous). 🔴 Categories hardcoded to `['speed', 'coverage', 'easeOfConnect']`. |

---

## CATEGORY 3: SECURITY & COMPLIANCE

### F13. Captive Portal GDPR/Privacy Consent ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **GDPR Consent** (`#wifi-consent-management`) |
| **Component** | `src/components/wifi/wifi-consent-management.tsx` (908 lines) |
| **API** | `/api/wifi/consent-logs/route.ts` (GET/POST), `consent-logs/[id]/route.ts` (PATCH/DELETE), `consent-logs/settings/route.ts` (GET/PUT), `consent-logs/stats/route.ts` (GET) — **4 routes** |
| **Verified Working** | ✅ Full consent log CRUD (list, create, view, revoke, delete). ✅ SHA-256 consent text hashing. ✅ Configurable consent text + retention days (30/60/90/180/365). ✅ Marketing opt-in toggle. ✅ Cookie Policy URL configurable. ✅ Stats: total consents, opt-in rate, active consents, daily trend. ✅ 3 consent types: wifi_access, marketing, data_processing. ✅ Consent preview dialog. |
| **Critical Gaps** | 🔴 **No auto-delete cron** — `expiresAt` field set on revoke but **never enforced for deletion**. GDPR Article 17 (Right to Erasure) not automated. 🔴 **Hardcoded tenant ID** (no auth). 🟡 DELETE endpoint exists but no delete button in UI. |

### F14. Identity Verification / KYC for WiFi ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Identity Verification** (`#wifi-identity-verification`) |
| **Component** | `src/components/wifi/wifi-identity-verification.tsx` (1,235 lines) |
| **API** | `/api/wifi/identity-logs/route.ts` (GET/POST), `identity-logs/[id]/route.ts` (GET/PATCH), `identity-logs/stats/route.ts` (GET), `identity-logs/settings/route.ts` (GET/PUT), `identity-logs/export/route.ts` (GET) — **5 routes** |
| **Verified Working** | ✅ All **6 verification methods** defined: room_number, otp_sms, otp_email, government_id, selfie_verify, none. ✅ 4 statuses (pending/verified/failed/skipped). ✅ 4 ID types (aadhaar/passport/national_id/driving_license). ✅ Full dashboard: KPI cards, method breakdown, failure reasons, compliance report. ✅ CSV export. ✅ Privacy masking (masks emails, phones, IDs). ✅ Settings: requiredMethods, OTP expiry/retries, autoVerify. |
| **Critical Gaps** | 🔴 **No actual OTP verification backend** — settings allow configuring OTP expiry but no endpoint sends/verifies OTPs. `otp_sms` and `otp_email` methods tracked in logs but verification flow doesn't exist. 🔴 **No selfie/GovID verification integration** — no connection to Onfido, Jumio, or any document verification API. 🔴 **Hardcoded tenant ID** (no auth). 🟡 "Add Test Log" button exposed in production UI (creates records with hardcoded IP `192.168.1.100`). 🟡 Duplicate `useEffect` hooks cause double API calls. |

### F15. Per-Room Network Isolation (Room VLANs) ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Network** (`#wifi-network`) → Room VLANs tab (within network-page.tsx) |
| **Component** | `src/components/wifi/room-vlans.tsx` (1,385 lines) |
| **API** | `/api/wifi/network/room-vlans/route.ts` (GET/POST), `room-vlans/[id]/route.ts` (GET/PUT/DELETE), `room-vlans/bulk/route.ts` (POST) — **3 routes** |
| **Verified Working** | ✅ Feature-gated behind `room_vlan_isolation` flag. ✅ Full CRUD: create, edit, delete, toggle active. ✅ Bulk generation with floor-based room ranges (e.g., "101-110"). ✅ Auto-calculation of subnet/gateway from VLAN ID. ✅ Firewall preview: generates nftables rules. ✅ Room types: standard, suite, conference, vip. ✅ Duplicate prevention. |
| **Critical Gaps** | 🔴 **`handleApplyRules()` is a TOAST STUB** — `room-vlans.tsx:586-592`: shows "Firewall Rules Queued" toast but performs zero actual `nft` execution. Doesn't even call the bulk `generate-firewall` API. 🔴 **No `ip link add` integration** — VLAN interface creation on the host not implemented. 🔴 RADIUS Tunnel attributes exist in vendor adapters (MikroTik, D-Link, Cryptsk) but room-vlans component doesn't trigger CoA to push them. |

### F16. Zero Trust Network Access (ZTNA) ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE |
| **API** | ❌ NONE |
| **Verified** | Only a string label `'Zero Trust Network Access (ZTNA)'` in Fortinet adapter features array. Zero functional ZTNA code. Firewall page has nftables CRUD but no per-device Zero Trust policies. |

---

## CATEGORY 4: OPERATIONAL INTELLIGENCE

### F17. WiFi Heatmap / Coverage Visualization ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE — `occupancy-heatmap.tsx` is room occupancy (unrelated), `floor-plan-editor.tsx` is PMS property management |
| **API** | ❌ NONE |
| **Verified** | Zero code for AP signal strength mapping, RSSI-to-color, SVG floor plan overlay, or coverage visualization. |

### F18. Predictive Bandwidth Forecasting ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE — `revenue-forecast.tsx` forecasts WiFi revenue (money), not bandwidth |
| **API** | ❌ NONE |
| **Verified** | Zero code for bandwidth demand prediction, occupancy-based bandwidth projection, or capacity forecasting. |

### F19. Guest WiFi Satisfaction → Review Score Correlation ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE |
| **API** | ❌ NONE |
| **Verified** | WiFi satisfaction surveys and guest review scores exist as separate systems with zero cross-referencing logic. No correlation analysis code. |

### F20. Real-Time WiFi Health Alerts ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Health Alerts** (`#wifi-health-alerts`) |
| **Component** | `src/components/wifi/wifi-health-alerts.tsx` (1,031 lines) |
| **API** | `/api/wifi/alerts/route.ts` (GET/POST), `alerts/[id]/route.ts` (GET/PATCH/DELETE), `alerts/stats/route.ts` (GET) — **3 routes** |
| **Verified Working** | ✅ **7 alert types**: ap_down, latency, capacity, auth_failure, radius_error, bandwidth_exhaustion, nas_offline. ✅ **3 severities**: critical, warning, info. ✅ Acknowledge → resolve lifecycle with state validation. ✅ Stats: by severity/type/status, weekly trend, avg resolution time. ✅ Expandable alert details with metadata JSON viewer. |
| **Critical Gaps** | 🔴 **NO automatic health monitoring cron** — NAS health check (`nas-health-check.ts`) pings devices every 60s and tracks online/offline state, but **does NOT create `WiFiAlert` records**. All alerts are manual/API-only. 🔴 **Hardcoded tenant ID** (no auth). 🔴 No notification push on alert creation. 🟡 Only 7 alert types (document previously claimed 8). |

### F21. AP Capacity Planning Report ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE |
| **API** | ❌ NONE |
| **Verified** | Zero code for per-AP client density analysis, max client recommendations, or overloaded AP detection. |

### F22. WiFi SLA Monitoring & Compliance ⚠️ PARTIAL (DASHBOARD ONLY)
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **SLA Monitoring** (`#wifi-sla-monitoring`) |
| **Component** | `src/components/wifi/wifi-sla-monitoring.tsx` (1,034 lines) |
| **API** | `/api/wifi/sla/route.ts` (GET/POST), `sla/[id]/route.ts` (GET/PATCH/DELETE), `sla/compliance/route.ts` (GET), `sla/[id]/metrics/route.ts` (GET), `sla/available-properties/route.ts` (GET) — **5 routes** |
| **Verified Working** | ✅ SLA config CRUD per property (uptime %, speed targets, latency target, measurement interval). ✅ Compliance dashboard with overall score, per-property cards. ✅ Breach trend chart (30 days). ✅ Breach by type breakdown. ✅ `WiFiSLAMetric` table schema exists and is queryable. |
| **Critical Gaps** | 🔴 **NO automatic metric collection cron** — Zero code populates the `WiFiSLAMetric` table. No job measures uptime, speed, or latency. Compliance dashboard **always shows null/empty values**. 🔴 **Hardcoded tenant ID** (no auth). 🔴 `alertOnBreach` setting has no effect — no bridge from SLA breach to alerts system (F20). |

---

## CATEGORY 5: ECOSYSTEM INTEGRATION

### F23. Deep PMS ↔ WiFi Auto-Provisioning Pipeline ⚠️ PARTIAL
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → RADIUS & Gateway → AAA Config tab (provisioning toggles). Provisioning Logs accessible via hash route. |
| **Component** | `src/components/wifi/aaa-config.tsx` (2,191 lines), `provisioning-logs.tsx` (600 lines) |
| **API** | `/api/wifi/provisioning-logs/route.ts` (GET), `/api/wifi/aaa-config/route.ts` (GET/POST), `/api/wifi/aaa/route.ts` (POST/GET) |
| **Verified Working** | ✅ **Event-driven pipeline is REAL**: `provisioning-service.ts` (774 lines) subscribes to `booking.checked_in`, `booking.checked_out`, `booking.cancelled` events. ✅ **Plan selection chain**: Room Type WiFi Plan → AAA Config Default Plan → AAA Config Default Bandwidth → System Fallback (10M/5M). ✅ **Credential engine**: supports room_random, mobile, email, passport, booking_random formats. ✅ Creates WiFi user with RADIUS credentials via `wifiUserService.provisionUser()`. ✅ Deprovisioning with CoA disconnect. ✅ Comprehensive audit logging to `RadiusProvisioningLog`. ✅ 30-second dedup window. ✅ Non-blocking design (never blocks check-in). |
| **Critical Gaps** | 🔴 **`autoProvisionOnCheckin` toggle is NOT enforced** — the provisioning service always provisions regardless of the toggle setting. The event handler fires unconditionally (`provisioning-service.ts:84,117`). **This is a functional bug.** 🟡 Dual logging (in-memory ring buffer + DB) — API queries DB, service reads in-memory. 🟡 Provisioning Logs removed from wifi-access-page tabs (accessible via separate hash route only). |

### F24. Cloud WiFi Controller Integration ✅ PRODUCTION READY
| | |
|---|---|
| **Page/Menu** | Sidebar → WiFi → **Gateway Diagnostics** (`#wifi-diagnostics`) |
| **Component** | `src/components/wifi/gateway-diagnostics.tsx` (2,852 lines) |
| **API** | `/api/integrations/wifi-gateways/route.ts` (GET/POST/PUT/DELETE, 983 lines) — **1 route, all methods** |
| **Verified Working** | ✅ **15 real vendor adapters** (6,933 LOC total), ALL with actual HTTP/REST API calls: MikroTik, Cisco Meraki (full `MerakiDashboardClient` with rate limiting), Aruba Central, Ruckus (SmartZone + ZoneDirector dual client), Juniper Mist, Fortinet, Huawei, Ubiquiti UniFi, TP-Link Omada, Cambium cnMaestro, Netgear Insight, D-Link Nuclias, Ruijie RG-BC, Grandstream GWN, Cryptsk (native FreeRADIUS). ✅ **11 diagnostic tools**: Live Ping, Traceroute, DNS Lookup, ARP Table, Network Scan, Packet Capture, Speed Test, Port Check, Connection Table, Route Table, Interface Stats, Server Console. ✅ **NAS Health Monitoring** (617 lines): probes all NAS every 60s via ICMP + UDP RADIUS port check, tracks state transitions, 7-day retention. ✅ Auto-sync config + test-connection + CoA operations (disconnect/bandwidth) + push-config. ✅ SSRF prevention on create. ✅ Encrypted API key storage. ✅ Abstract `GatewayAdapter` base class with 8 abstract methods. |
| **Minor Gaps** | 🟡 Auto-sync declared but no cron triggers it — only manual via `?action=sync`. 🟡 Dead code: commented-out factory in `gateway-adapter.ts:217`. |

### F25. Third-Party Captive Portal Aggregation ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE |
| **API** | ❌ NONE |
| **Verified** | `purplewifi` and `cloud4wifi` appear only as vendor identification strings in `vendor-attributes.ts` and NAS vendor dropdown options in `aaa-config.tsx`. No `PortalExternalProvider` model. No aggregation logic. No external portal API integration. |

### F26. OTA Channel Manager ↔ WiFi Integration ❌ NOT IMPLEMENTED
| | |
|---|---|
| **Page/Menu** | ❌ NONE |
| **Component** | ❌ NONE |
| **API** | ❌ NONE |
| **Verified** | Channel Manager module (`lib/channel-manager/`, `lib/ota/`) and WiFi module are completely separate with zero cross-references. No WiFi data pushed to OTA channels. No WiFi-amenity fields on OTA types. `'Free WiFi'` appears as a static string in portal template — purely cosmetic. |

---

## WiFi Navigation Map (Complete)

All WiFi features accessible from **Sidebar → WiFi** category (`navigation.ts` lines 385–410):

| # | Nav ID | Menu Title | Type | Feature |
|---|--------|-----------|------|---------|
| 1 | `wifi-access` | WiFi Access | Tab Page (12 tabs) | F4, F5, F9† |
| 2 | `wifi-gateway-radius` | RADIUS & Gateway | Tab Page | F23 (AAA Config tab), NAS, RADIUS config |
| 3 | `wifi-network` | Network | Tab Page | F15 (Room VLANs tab), VLANs, Firewall zones |
| 4 | `wifi-dhcp` | DHCP Server | Tab Page | DHCP management |
| 5 | `wifi-dns` | DNS Server | Tab Page | DNS management |
| 6 | `wifi-portal` | Captive Portal | Tab Page (7 tabs) | F8, F10 (Walled Garden tab), F11 (Instances tab) |
| 7 | `wifi-firewall` | Firewall & Bandwidth | Tab Page | nftables rules, bandwidth policies |
| 8 | `wifi-content-filter` | Content Filter | Section | Content filtering |
| 9 | `wifi-diagnostics` | Gateway Diagnostics | Section | **F24** (15 adapters, 11 tools) |
| 10 | `wifi-reports` | Reports | Section | Bandwidth, session, health reports |
| 11 | `wifi-health-alerts` | Health Alerts | Section | **F20** |
| 12 | `wifi-pre-arrival` | Pre-Arrival Delivery | Section | **F7** |
| 13 | `wifi-device-management` | Multi-Device Registration | Section | **F9** |
| 14 | `wifi-identity-verification` | Identity Verification | Section | **F14** |
| 15 | `wifi-consent-management` | GDPR Consent | Section | **F13** |
| 16 | `wifi-bandwidth-upsell` | Bandwidth Upsell | Section | **F1** |
| 17 | `wifi-revenue-dashboard` | Revenue Analytics | Section | **F6** |
| 18 | `wifi-satisfaction-surveys` | Guest Surveys | Section | **F12** |
| 19 | `wifi-sla-monitoring` | SLA Monitoring | Section | **F22** |

† F9 has both a tab in WiFi Access (device management) and a standalone section page. The admin UI and real auto-auth system are disconnected.

**Features with NO menu presence**: F2, F3, F16, F17, F18, F19, F21, F25, F26

---

## WiFi Cron Jobs (Existing vs Missing)

| Cron Job | Status | File | WiFi Relevance |
|----------|--------|------|---------------|
| Session Engine | ✅ Running | `src/app/api/cron/session-engine/route.ts` | WiFi session accounting (every 60s) |
| NAS Health Check | ✅ Running | `src/lib/jobs/scheduler.ts:112-121` | Pings NAS devices (every 60s) |
| WiFi Expiration | ✅ Running | `src/app/api/cron/expiration/route.ts` | WiFi user expiration + notifications |
| **WiFi Health Alert Generator** | ❌ **MISSING** | — | Should create WiFiAlert from NAS health check |
| **SLA Metric Collector** | ❌ **MISSING** | — | Should populate WiFiSLAMetric table |
| **Consent Auto-Delete** | ❌ **MISSING** | — | Should purge expired consent records (GDPR) |
| **Device Cleanup** | ❌ **MISSING** | — | Should delete stale WiFiDevice records |
| **Pre-Arrival Scheduler** | ❌ **MISSING** | — | Should trigger credential delivery before arrival |
| **Gateway Auto-Sync** | ❌ **MISSING** | — | Should trigger periodic adapter sync |

---

## QUICK WINS (Can be done in < 1 day each)

| # | Feature | Fix Needed | Impact |
|---|---|---|---|
| **F23** | Auto-Provision toggle | Read `autoProvisionOnCheckin` in provisioning-service before provisioning | HIGH — functional bug |
| **F9** | Device autoAuth sync | Push MAC addresses to FreeRADIUS when `autoAuth` toggled | HIGH — core feature broken |
| **F20** | Auto-alert cron | Bridge NAS health check → WiFiAlert creation | HIGH — proactive monitoring |
| **F13** | Consent auto-delete | Cron to purge expired consent records | HIGH — GDPR compliance |
| **All** | Remove hardcoded tenant ID | Replace `TENANT_ID` with auth context in 9 features | HIGH — security + multi-tenancy |
| **F1** | Real CoA on upsell | Call radclient/tc on bandwidth upgrade purchase | HIGH — revenue feature |
| **F7** | Real email/SMS delivery | Integrate SMTP (Resend) + Twilio in pre-arrival send | HIGH — guest experience |
| **F15** | Real firewall apply | Call bulk API + nft from `handleApplyRules()` | MEDIUM — security |

## MEDIUM-TERM (1-2 weeks each)

| # | Feature | Fix Needed | Impact |
|---|---|---|---|
| **F22** | SLA metric collection | Create cron that measures uptime/speed/latency | HIGH — SLA compliance |
| **F2** | Ad portal UI + API | Build management component + CRUD API + portal rendering | HIGH — revenue |
| **F3** | Partner WiFi UI + API | Build partner management + auth flow | HIGH — revenue |
| **F11** | Roaming runtime enforcement | Validate roaming in auth flow + RADIUS | MEDIUM — chain hotels |
| **F8** | Guest-facing portal | Build captive portal page that renders designed themes | MEDIUM — core product |
| **F12** | Guest survey portal | Embed survey in captive portal flow | MEDIUM — feedback |

## LONG-TERM (2-4 weeks each)

| # | Feature | Fix Needed | Impact |
|---|---|---|---|
| **F16** | ZTNA | Per-device firewall policies + guest zone isolation | HIGH — security |
| **F17** | WiFi Heatmap | SVG floor plan + RSSI overlay + AP location | MEDIUM — operations |
| **F18** | Bandwidth Forecasting | ML/predictive model for demand projection | MEDIUM — capacity |
| **F19** | Satisfaction-Review Correlation | Cross-reference WiFi scores with CRM reviews | MEDIUM — analytics |
| **F21** | AP Capacity Planning | Per-AP density analysis + recommendations | MEDIUM — operations |
| **F24** | Auto-sync scheduler | Cron for periodic gateway adapter sync | LOW — already 95% done |
| **F25** | Third-Party Portal | PortalExternalProvider model + delegation | MEDIUM — flexibility |

---

## COMPETITIVE COMPARISON

| Feature | StaySuite (Current) | Purple WiFi | Cloud4Wi | Spectra |
|---|---|---|---|---|
| RADIUS Integration | ✅ 15 vendors | ✅ | ✅ | ✅ |
| Captive Portal | ✅ 25 themes, 16 langs | ✅ 10+ methods | ✅ | ✅ |
| Bandwidth Management | ✅ FUP + Scheduling | ✅ | ✅ | ✅ |
| Content Filtering | ⚠️ DB-only | ✅ DNS-based | ✅ | ✅ |
| **Pre-Arrival WiFi Delivery** | ⚠️ Simulated | ✅ | ✅ | ✅ |
| **Personalized Portal** | ⚠️ Admin-only | ✅ | ✅ | ✅ |
| **Bandwidth Upsell** | ⚠️ Fake CoA | ✅ | ✅ | ❌ |
| **Ad-Supported WiFi** | 🔴 Schema only | ✅ | ✅ | ❌ |
| **Multi-Device Registration** | ⚠️ Disconnected | ✅ | ✅ | ❌ |
| **WiFi Heatmap** | ❌ | ✅ (add-on) | ✅ | ✅ |
| **Identity Verification** | ⚠️ No actual OTP/KYC | ✅ | ✅ | ✅ |
| **PMS Integration** | ✅ **DEEP** | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| **Folio/Billing** | ✅ **NATIVE** | ❌ | ❌ | ❌ |
| **Event WiFi** | ⚠️ No Prisma model | ⚠️ | ⚠️ | ❌ |
| **Loyalty Integration** | ✅ **NATIVE** | ⚠️ | ❌ | ❌ |
| **Revenue Analytics** | ⚠️ Hardcoded tenant | ✅ | ✅ | ❌ |
| **Multi-Property Roaming** | ⚠️ Config only | ✅ | ✅ | ❌ |
| **SLA Monitoring** | ⚠️ No data collection | ✅ | ✅ | ❌ |

**StaySuite's Unique Advantage:** Deep PMS integration (folio, loyalty, bookings, events, auto-provisioning) is something NO standalone WiFi gateway product can match. The critical gaps are: (1) fixing the 9 features with hardcoded tenant IDs, (2) adding missing cron jobs for monitoring, (3) building guest-facing captive portal rendering, and (4) completing F2/F3 which are currently schema-only.

---

## RECOMMENDED PRIORITY ORDER

> Features NOT YET IMPLEMENTED, prioritized by business impact:

1. **Fix hardcoded tenant IDs** (9 features) — Security + multi-tenancy. Blocks any multi-tenant deployment.
2. **Fix F23 auto-provision toggle bug** — Core pipeline has a functional bug where the toggle is ignored.
3. **F16 (ZTNA)** — Core security: prevent guest access to hotel POS, PMS, CCTV, HVAC.
4. **Add missing cron jobs** (5 missing) — Health alerts, SLA metrics, consent cleanup, device cleanup, pre-arrival, auto-sync.
5. **F8 guest-facing portal** — The portal designer is world-class but guests never see it.
6. **F2/F3 (Ad + Partner WiFi)** — Currently schema-only. Revenue features with zero functional code.
7. **F17 (WiFi Heatmap)** — Operations visibility: identify dead zones, optimize AP placement.
8. **F1 real CoA** — Bandwidth upsell is the #1 revenue feature but purchase doesn't change actual bandwidth.
9. **F7 real delivery** — Pre-arrival is simulated. Integrate SMTP/Twilio.
10. **F14 actual KYC** — Settings exist but no OTP/selfie/GovID backend.

---

## WiFi Module Statistics

| Metric | Count |
|--------|-------|
| WiFi components | 41 |
| WiFi API route files | 157 |
| WiFi Prisma models | 86 |
| Vendor adapters | 15 |
| Vendor adapter LOC | 6,933 |
| Largest component | portal-page.tsx (4,092 lines) |
| Captive portal themes | 25 |
| Supported languages | 16 |
| Diagnostic tools | 11 |
| Sidebar menu items | 19 |
| WiFi cron jobs (running) | 3 |
| WiFi cron jobs (missing) | 6 |
| Features with hardcoded tenant ID | 9 |
| Total WiFi features | 26 |

---

*This document reflects the current state of the StaySuite WiFi module as of thorough code audit. Each feature has been verified against actual source code, not assumptions. Production-ready assessment considers: functional completeness, authentication/authorization, multi-tenancy, background automation, and guest-facing integration.*

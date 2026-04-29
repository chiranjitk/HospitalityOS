# StaySuite WiFi Gateway — Feature Suggestions & Product Roadmap

> **Context:** StaySuite HospitalityOS WiFi module is a **PMS-integrated hotel/resort WiFi gateway product**  
> **Current State:** 9/10 — 41 components, 127 API routes, 86 Prisma models, 14 vendor adapters, FreeRADIUS, KEA DHCP, nftables  
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

Below are **28 new feature suggestions** organized by business value.

---

## CATEGORY 1: REVENUE GENERATION (WiFi as Profit Center)

### F1. Bandwidth Upsell in Captive Portal
**What:** After guest connects on free tier, show a real-time upgrade offer: "Upgrade to Premium 50Mbps — ₹299/stay"
**Why:** Hotels report 15-25% upsell conversion. This is the #1 revenue feature for WiFi gateways.
**How:**
- New API: `POST /api/wifi/upgrade` — upgrade plan mid-session via CoA bandwidth change
- Portal page: Show current speed test result + upgrade options with one-click purchase
- Integrate with existing folio/billing for room charge
- Pre-built upsell tiers: Free (2Mbps) → Standard (10Mbps) → Premium (50Mbps) → Ultra (100Mbps)

### F2. Ad-Supported Free WiFi (Monetized Portal)
**What:** Guests get free WiFi in exchange for watching a 15-second video ad or viewing a branded page
**Why:** Ad revenue can exceed paid WiFi revenue in high-traffic properties (airports, malls, resorts)
**How:**
- New model: `PortalAdCampaign` — advertiser, creative (image/video), impressions, clicks, revenue
- New model: `PortalAdSlot` — position on portal page (banner, interstitial, footer)
- API: Ad serving + click/impression tracking
- Revenue dashboard: impressions, CTR, revenue per campaign
- Integration with CRM ad-campaigns module (shared advertiser database)

### F3. Partner WiFi / Sponsored Access
**What:** Allow partners (airlines, credit cards, loyalty programs) to sponsor guest WiFi access
**Why:** "Free WiFi for Emirates Skywards members" — partner pays per-authentication, hotel gets commission
**How:**
- New model: `WiFiPartner` — partner name, auth method (promo code, auto-detect loyalty tier), cost-per-auth, commission
- New model: `WiFiPartnerAuth` — individual sponsored sessions
- Captive portal: "Enter your Emirates Skywards number for free WiFi"
- API: Partner auth validation + per-session billing to partner account

### F4. Time-Based / Session-Based Plans
**What:** Sell WiFi by the hour, day, or session (common in airports, co-working, cafes)
**Why:** Not all guests need room-length WiFi. Day visitors, lobby users, event attendees.
**How:**
- Extend `WiFiPlan` with `billingUnit` (hour/day/stay/unlimited)
- New model: `WiFiPlanPurchase` — tracks time-based purchases with auto-expiry
- Portal: Timer showing remaining time, option to extend
- API: Session timer enforcement via CoA Session-Timeout attribute

### F5. Conference / Event WiFi Packages
**What:** Pre-sell WiFi packages for events (attendee count × days × plan)
**Why:** Events are high-margin — 500 attendees × ₹500/day = ₹250,000/event
**How:**
- Extend existing `event-wifi.tsx` with package builder
- New model: `EventWiFiPackage` — attendee count, plan, duration, quoted price, actual usage
- Bulk credential generation with expiry tied to event end time
- Post-event usage report per event

### F6. WiFi Revenue Analytics Dashboard
**What:** Dedicated dashboard showing WiFi revenue, upsell conversion, partner commissions, ad revenue
**Why:** Without measurement, revenue optimization is impossible
**How:**
- New component: `wifi-revenue-dashboard.tsx`
- Metrics: Revenue by source (upsell/voucher/partner/ad), conversion rate, ARPU, peak hours
- Compare WiFi revenue vs cost (bandwidth, hardware, licenses)
- Forecast: Project monthly WiFi revenue based on occupancy trends

---

## CATEGORY 2: GUEST EXPERIENCE (Frictionless & Personalized)

### F7. Pre-Arrival WiFi Credential Delivery
**What:** Send WiFi credentials via email/SMS 24 hours before check-in
**Why:** #1 guest complaint: "WiFi password not ready at check-in." Pre-arrival delivery eliminates this.
**How:**
- New API: `POST /api/wifi/pre-arrival-notify` — triggered by booking confirmation
- Email template: Hotel-branded with WiFi name, username, password, valid dates
- SMS template: Short format for mobile (link to connect page with pre-filled code)
- Settings: Enable/disable per property, customize timing (24h/12h/6h before arrival)
- Integration with existing notification/communication system

### F8. Personalized Captive Portal (PMS-Aware)
**What:** Portal page shows guest's name, room number, stay dates, and personalized offers
**Why:** Personalization increases engagement by 3-5x. Guests feel recognized, not anonymous.
**How:**
- Extend `CaptivePortal` with `personalizationEnabled` flag
- When guest authenticates with room number/PMS credentials, fetch guest profile from PMS
- Portal template variables: `{{guest.name}}`, `{{room.number}}`, `{{stay.checkout}}`, `{{loyalty.tier}}`
- Show tier-appropriate content: VIP gets spa discount, regular gets restaurant promo
- Store personalized portal views in `PortalPage` per-language templates

### F9. Multi-Device Auto-Registration
**What:** After first device authenticates, subsequent devices from the same guest auto-connect
**Why:** Average guest has 3-4 devices (phone, laptop, tablet, smart watch). Forcing auth on each is friction.
**How:**
- New model: `WiFiDevice` — guestId, macAddress, deviceName, deviceType, firstSeen, lastSeen
- New API: `POST /api/wifi/device-register` — called after first successful auth
- Subsequent connections: Match MAC address to known device → auto-authenticate
- Settings: Max devices per guest (e.g., 5), approval flow for new devices
- Portal: "Your phone is connected. Connect your laptop? [Auto-Connect] [Enter Code]"

### F10. Digital Directory & Services in Portal
**What:** After authentication, portal shows hotel services (restaurants, spa, activities, local info)
**Why:** Post-auth portal is prime real estate — 100% of guests see it. Drives ancillary revenue.
**How:**
- Extend `PortalPage` with `postAuthContent` (HTML blocks)
- New model: `PortalContentBlock` — title, content (HTML), position, visibility rules
- Content types: Restaurant menu, spa booking link, activity schedule, local map, weather, transport
- Integration with existing experience-catalog module for activity listings
- Click tracking: Measure which services guests browse from portal

### F11. Seamless Multi-Property Roaming
**What:** Guest checks into Property A, moves to Property B (same chain) — WiFi auto-connects
**Why:** Chain hotels need consistent experience. Guest shouldn't re-authenticate at each property.
**How:**
- Leverage existing `roamingMode` (auth_origin, seamless, reauth) in CaptivePortal
- New API: `POST /api/wifi/roaming-validate` — validate guest credentials across properties
- RADIUS proxy: Forward auth requests to originating property's RADIUS server
- Shared session token: JWT or HMAC-signed token valid across chain
- Portal: "Welcome back, Mr. Sharma. You're at Beach Resort — connected automatically."

### F12. In-Portal Satisfaction Survey
**What:** After N minutes of WiFi usage, show a quick satisfaction survey (1-5 stars + comment)
**Why:** Captures WiFi-specific feedback (speed, coverage, ease of connection) — correlates with overall reviews
**How:**
- New model: `WiFiSatisfactionSurvey` — guestId, rating, comment, responseTime, deviceType
- API: `POST /api/wifi/satisfaction` — called from portal after configurable delay
- Dashboard: Average rating, trends, filter by location/room/AP
- Auto-alert: Rating < 3 triggers maintenance ticket

---

## CATEGORY 3: SECURITY & COMPLIANCE

### F13. Captive Portal GDPR/Privacy Consent
**What:** Mandatory consent screen before WiFi access (required in EU, India IT Act, GDPR)
**Why:** Legal requirement in many jurisdictions. Fine risk without it.
**How:**
- Extend `PortalPage` with `consentConfig` JSON:
  ```json
  {
    "requireConsent": true,
    "consentText": "We collect your MAC address, device type, and browsing metadata for security. Data is retained for 90 days.",
    "dataRetentionDays": 90,
    "allowMarketingOptIn": true,
    "cookiePolicyUrl": "https://hotel.com/privacy"
  }
  ```
- New model: `WiFiConsentLog` — guestId, consentTextHash, ipAddress, timestamp
- API: Log consent at authentication time
- Auto-delete browsing data after retention period

### F14. Identity Verification / KYC for WiFi (Regulatory)
**What:** In India (IT Act), Saudi Arabia, China, UAE — mandatory to log guest identity for public WiFi
**Why:** Hotels face fines ₹25,000+ per violation in India. Mandatory in 15+ countries.
**How:**
- Extend `CaptivePortal` with `identityVerification` config:
  - `none` — No verification (private networks)
  - `room_number` — Verify against PMS room guest list (already implemented)
  - `otp_sms` — Send OTP to registered mobile (needs SMS provider)
  - `otp_email` — Send OTP to email on booking
  - `government_id` — Capture ID number (Aadhaar, passport, national ID)
  - `selfie_verify` — Selfie + ID match (AI-powered, optional)
- New model: `WiFiIdentityLog` — username, verificationMethod, verifiedIdentity, ipAddress, timestamp
- Compliance report: "All WiFi sessions in last 90 days with verified identities"

### F15. Network Quarantine / Device Posture Check
**What:** Before granting full network access, check device health (antivirus, OS version, firewall status)
**Why:** Prevents malware spread from guest devices to hotel network / other guests
**How:**
- New model: `WiFiQuarantinePolicy` — check types, action (allow/quarantine/deny), quarantine VLAN
- New API: `POST /api/wifi/device-check` — assess device posture
- Integration with vendor adapters that support posture assessment (Cisco ISE, Fortinet NAC)
- Quarantine VLAN: Limited access (updates only) until device passes checks
- Guest notification: "Your device needs a security update. Connect to [Quarantine Network] for help."

### F16. Per-Room Network Isolation
**What:** Each room's WiFi is on its own VLAN/subnet — guests can't see other guests' devices
**Why:** Security best practice. Prevents ARP spoofing, lateral movement, and snooping.
**How:**
- Leverage existing VLAN infrastructure (VlanConfig, DhcpSubnet)
- Auto-create per-room VLANs: `guest-101`, `guest-102`, etc.
- WiFiAAAConfig: `perRoomIsolation: true` — auto-assign VLAN at authentication
- RADIUS: Return `Tunnel-Type=13`, `Tunnel-Medium-Type=6`, `Tunnel-Private-Group-Id=<vlan>` in RadReply
- Dashboard: Room-to-VLAN mapping, isolation status

### F17. Zero Trust Network Access (ZTNA)
**What:** Guests only have access to internet + specific hotel services, nothing else on the internal network
**Why:** Prevents guests from accessing hotel POS, PMS, CCTV, HVAC, and other internal systems
**How:**
- Leverage existing FirewallZone (lan/wan/dmz/guest/staff/iot)
- Enforce: Guest WiFi → guest zone → internet only
- Explicit allow-list for hotel services (booking engine, digital directory, guest app)
- nftables: Default deny on guest zone, explicit allows for whitelisted services
- Audit: Periodic scan for accidental zone leaks

---

## CATEGORY 4: OPERATIONAL INTELLIGENCE

### F18. WiFi Heatmap / Coverage Visualization
**What:** Visual map of WiFi signal strength across property floors with AP locations
**Why:** Front desk can direct guests to rooms with best coverage. Facilities can identify dead zones.
**How:**
- New model: `WiFiHeatmapData` — apMac, location (x,y), signalStrength, clientCount, timestamp
- New component: `wifi-heatmap.tsx` — SVG floor plan overlay with color-coded signal strength
- Data source: AP health metrics from vendor adapters (signal surveys, client RSSI)
- Integration: Import floor plan images from existing floor-plan-editor module
- Historical comparison: Signal strength over time (identify degradation)

### F19. Predictive Bandwidth Forecasting
**What:** Predict bandwidth demand based on occupancy, events, weather, historical patterns
**Why:** Prevents bandwidth exhaustion. Allows proactive capacity planning.
**How:**
- API: `GET /api/wifi/reports/forecast` — returns predicted bandwidth usage for next 7 days
- Model inputs: Occupancy forecast, events calendar, day of week, season, weather
- Output: Predicted peak bandwidth, recommended capacity, risk hours
- Dashboard: "Expected peak: 850 Mbps at 8 PM — current capacity: 1 Gbps — buffer: 15%"
- Alert: If predicted demand > 80% capacity, recommend upgrade

### F20. Guest WiFi Satisfaction → Review Score Correlation
**What:** Analyze correlation between WiFi satisfaction scores and online review scores (Google, TripAdvisor)
**Why:** Proves WiFi ROI — "Improving WiFi from 3★ to 4.5★ correlates with 0.3 increase in Google rating"
**How:**
- Cross-reference WiFi satisfaction surveys with CRM feedback-reviews module
- Statistical analysis: Pearson correlation between WiFi score and overall rating
- Dashboard: "Properties with WiFi score > 4.0 average 0.4 higher on Google Reviews"
- Action items: "Rooms 201-210 have low WiFi scores — recommend AP addition"

### F21. Real-Time WiFi Health Alerts
**What:** Automatic alerts when WiFi quality degrades (AP down, high latency, capacity warning)
**Why:** Currently WiFi issues are discovered only when guests complain. Proactive monitoring prevents negative reviews.
**How:**
- Extend existing `NasHealthLog` with threshold-based alerting
- New model: `WiFiAlert` — type (ap_down/latency/capacity/auth_failure/radius_error), severity, message, acknowledged, resolvedAt
- API: `GET /api/wifi/alerts`, `POST /api/wifi/alerts/[id]/acknowledge`
- Alert channels: In-app notification, email, SMS (for critical), Slack/PagerDuty webhook
- Dashboard: Active alerts with trend (new this week vs last week)
- Integration with existing alerts-panel in dashboard module

### F22. AP Capacity Planning Report
**What:** Report showing per-AP client density, recommended max clients, and overloaded APs
**Why:** Overloaded APs = slow WiFi for everyone. Planning prevents this.
**How:**
- API: `GET /api/wifi/reports/ap-capacity` — per-AP metrics
- Data: Client count, bandwidth utilization, connection failures, channel utilization
- Recommendation: "AP-Lobby-01: 87 clients (recommended max: 60). Consider adding AP-Lobby-03."
- Historical trend: AP utilization over 30 days with growth projection

### F23. WiFi SLA Monitoring & Compliance
**What:** Track whether WiFi meets defined SLA targets (uptime, speed, latency) and generate reports
**Why:** Hotels with managed WiFi services need to prove SLA compliance to management/owners.
**How:**
- New model: `WiFiSLAConfig` — uptimeTarget (%), speedTarget (Mbps), latencyTarget (ms), measurementInterval
- New model: `WiFiSLAMetric` — actual uptime, speed, latency per measurement period
- Dashboard: SLA compliance percentage (green/yellow/red)
- Monthly report: "WiFi uptime: 99.7% (target: 99.9%), avg speed: 45 Mbps (target: 50 Mbps)"
- Breach alert: Automatic notification when SLA threshold breached for > 15 minutes

---

## CATEGORY 5: ECOSYSTEM INTEGRATION

### F24. Deep PMS ↔ WiFi Auto-Provisioning Pipeline
**What:** Complete auto-provision pipeline: Booking confirmed → WiFi credentials generated → Email/SMS sent → AP configured → Room VLAN assigned → Auto-deprovision at checkout
**Why:** Currently provisioning exists but the full pipeline has gaps (no pre-arrival email, no auto VLAN)
**How:**
- Orchestration service that chains: Booking event → WiFi user create → Credential delivery → VLAN assignment → NAS group assignment
- Event-driven: Listen to booking status changes (confirmed, checked-in, checked-out, cancelled)
- Idempotent: Safe to retry on failure without duplicate credentials
- Audit trail: Full provisioning log per guest stay
- Extend existing `provisioning-service.ts` with email/SMS delivery hooks

### F25. Cloud WiFi Controller Integration (Meraki Central, Aruba Central, Ruckus Cloud)
**What:** Instead of managing APs individually via vendor adapters, integrate with cloud management platforms
**Why:** Most enterprise WiFi is cloud-managed. Direct API to cloud controller = single pane of glass.
**How:**
- Extend existing adapters to support cloud controller APIs (not just device APIs)
- Meraki Dashboard API: Dashboard-level operations (network-wide SSID, firewall, VLAN)
- Aruba Central API: Full AP management, client monitoring, RF optimization
- Ruckus Cloud API: AP configuration, health monitoring, client analytics
- Benefits: Push SSID/VLAN changes to all APs at once, monitor health from one dashboard
- New adapter method: `configureNetworkWide()` vs current per-device `configureAP()`

### F26. RADIUS Proxy for Multi-Brand / Franchise
**What:** Central RADIUS server that proxies auth requests to individual property RADIUS servers
**Why:** Franchise hotels (Marriott, Hilton) route auth through brand RADIUS → property RADIUS → local auth
**How:**
- New model: `RadiusProxyRealm` — realm name (e.g., `hotel.chicago.example.com`), homeServer, sharedSecret
- New model: `RadiusProxyServer` — server IP, port, secret, status, healthCheck
- FreeRADIUS: Enable `proxy.conf` with realm-based routing
- Use case: Brand RADIUS → StaySuite RADIUS → Property RADIUS → FreeRADIUS → AP
- Supports: load balancing, failover, and realm-based routing
- API: `GET/POST /api/wifi/radius-proxy/realms`, health monitoring

### F27. Third-Party Captive Portal Aggregation
**What:** Support connecting to third-party captive portal providers (Purple WiFi, Cloud4Wi, Socio)
**Why:** Some properties already have contracts with these providers. StaySuite should be able to delegate portal to them.
**How:**
- New model: `PortalExternalProvider` — provider (purple, cloud4wi, socio, custom), apiKey, config
- CaptivePortal: `portalMode` (built_in | external)
- When external: RADIUS auth delegates to external provider's RADIUS server
- External provider handles portal UI, StaySuite handles RADIUS + bandwidth + accounting
- Benefits: Best of both worlds — external portal UX + StaySuite PMS integration

### F28. OTA Channel Manager ↔ WiFi Integration
**What:** Include WiFi as a property amenity in OTA listings (Booking.com, Expedia, Airbnb)
**Why:** "Free High-Speed WiFi" is the #1 searched amenity on OTAs. Managed WiFi quality data increases booking conversion.
**How:**
- API: `GET /api/wifi/ota-amenity` — returns WiFi amenity data in OTA format
- Data: Speed tier, coverage (rooms/lobby/pool), SSID, captive portal type, guest rating
- Integration with existing channel-manager module: Push WiFi amenity to OTA channels
- Auto-update: When WiFi plan changes, sync to OTA listings
- Competitor analysis: Compare WiFi offering vs competitor properties

---

## QUICK WINS (Can be done in < 1 day each)

| # | Feature | Impact | Effort |
|---|---|---|---|
| F7 | Pre-arrival WiFi credential email | HIGH guest satisfaction | Small — use existing notification system |
| F9 | Multi-device auto-registration | HIGH — reduces support tickets | Small — new model + MAC match |
| F14 | Identity verification logging | HIGH — legal compliance | Small — extend existing auth flow |
| F21 | WiFi health alerts | HIGH — proactive issue detection | Small — extend NasHealthLog |
| F1 | Bandwidth upsell in portal | HIGH revenue | Medium — portal UI + CoA |
| F13 | GDPR consent screen | HIGH — legal requirement | Small — extend portal template |
| F16 | Per-room VLAN isolation | MEDIUM security | Medium — RADIUS attribute + VLAN auto-creation |

## MEDIUM-TERM (1-2 weeks each)

| # | Feature | Impact | Effort |
|---|---|---|---|
| F24 | Full PMS-WiFi auto-provision pipeline | HIGH — zero-touch WiFi | Medium |
| F2 | Ad-supported WiFi portal | HIGH revenue potential | Medium |
| F8 | Personalized captive portal | MEDIUM — engagement | Medium |
| F18 | WiFi heatmap | MEDIUM — operations | Medium |
| F26 | RADIUS proxy for franchises | MEDIUM — chain support | Medium |

## LONG-TERM (2-4 weeks each)

| # | Feature | Impact | Effort |
|---|---|---|---|
| F3 | Partner/sponsored WiFi | HIGH revenue | Large |
| F19 | Predictive bandwidth forecasting | MEDIUM — planning | Large |
| F25 | Cloud WiFi controller integration | HIGH — enterprise | Large |
| F27 | Third-party portal aggregation | MEDIUM — flexibility | Large |
| F20 | WiFi satisfaction ↔ review correlation | MEDIUM — analytics | Medium |

---

## COMPETITIVE COMPARISON

| Feature | StaySuite (Current) | Purple WiFi | Cloud4Wi | Spectra |
|---|---|---|---|---|
| RADIUS Integration | ✅ 14 vendors | ✅ | ✅ | ✅ |
| Captive Portal | ✅ 7 auth methods | ✅ 10+ methods | ✅ | ✅ |
| Bandwidth Management | ✅ FUP + Scheduling | ✅ | ✅ | ✅ |
| Content Filtering | ⚠️ DB-only | ✅ DNS-based | ✅ | ✅ |
| **Pre-Arrival WiFi Delivery** | ❌ | ✅ | ✅ | ✅ |
| **Personalized Portal** | ❌ | ✅ | ✅ | ✅ |
| **Bandwidth Upsell** | ❌ | ✅ | ✅ | ❌ |
| **Ad-Supported WiFi** | ❌ | ✅ | ✅ | ❌ |
| **Multi-Device Registration** | ❌ | ✅ | ✅ | ❌ |
| **WiFi Heatmap** | ❌ | ✅ (add-on) | ✅ | ✅ |
| **Identity Verification** | ❌ | ✅ | ✅ | ✅ |
| **PMS Integration** | ✅ **DEEP** | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| **Folio/Billing** | ✅ **NATIVE** | ❌ | ❌ | ❌ |
| **Event WiFi** | ✅ | ⚠️ | ⚠️ | ❌ |
| **Loyalty Integration** | ✅ **NATIVE** | ⚠️ | ❌ | ❌ |
| **Revenue Analytics** | ❌ | ✅ | ✅ | ❌ |
| **RADIUS Proxy** | ❌ | ❌ | ✅ | ❌ |
| **Multi-Property Roaming** | ⚠️ Partial | ✅ | ✅ | ❌ |

**StaySuite's Unique Advantage:** Deep PMS integration (folio, loyalty, bookings, events) is something NO standalone WiFi gateway product can match. The gap is in **guest-facing portal experience** and **revenue features** — which are relatively quick to build on top of the existing infrastructure.

---

## RECOMMENDED PRIORITY ORDER

1. **F1 (Bandwidth Upsell)** — Direct revenue, uses existing CoA + billing infrastructure
2. **F7 (Pre-Arrival Delivery)** — Highest guest satisfaction impact, uses existing notification system
3. **F9 (Multi-Device Auto-Registration)** — Biggest support ticket reducer
4. **F14 (Identity Verification)** — Legal requirement in India, Saudi, UAE, EU
5. **F13 (GDPR Consent)** — Legal requirement in EU
6. **F21 (WiFi Health Alerts)** — Proactive operations, prevents negative reviews
7. **F8 (Personalized Portal)** — Differentiation, leverages PMS data advantage
8. **F18 (WiFi Heatmap)** — Operations tool, leverages existing vendor adapters
9. **F24 (Full PMS Pipeline)** — Completes the zero-touch vision
10. **F2 (Ad-Supported WiFi)** — New revenue stream, leverages existing ad-campaigns module

---

*This document is a feature suggestion only — no development has been done. All suggestions are designed to work with the existing architecture (FreeRADIUS, PostgreSQL, vendor adapters, mini-services).*

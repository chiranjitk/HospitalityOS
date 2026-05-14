# 🚀 CRYPTSK STAYSUITE — FINAL MASTER (REFINED, FLOW-BASED, ZERO-LOSS)

> PURPOSE: This version is fully structured, dependency-aware, and flow-driven so AI agents can execute without ambiguity.
> RULE: No feature removed. Only categorized, expanded with flows, and clarified.

---

# 🧠 0. EXECUTION ORDER (STRICT)

Auth → Tenant → Core → PMS → Booking → Billing → WiFi → Operations → Experience → CRM → Automation → Reports → Integrations

AI MUST FOLLOW THIS ORDER.

---

# 🏗 1. FOUNDATION LAYER

## 1.1 AUTH & SECURITY

### Features
- JWT + refresh
- 2FA (TOTP)
- RBAC + ABAC
- Device sessions
- Audit logs
- Encryption (TLS + AES-256)
- IP whitelist
- SSO (Google, SAML, LDAP future)

### Flow
User Login → Auth → Token → Role Check → Access Control → Action → Audit Log

---

## 1.2 TENANT SYSTEM

### Features
- Multi-tenant SaaS
- Subdomain routing
- tenant_id enforcement
- PostgreSQL RLS

### Lifecycle Flow
Signup → Trial → Active → Suspended → Cancelled → Archived

### Request Flow
Request → Middleware → Resolve Tenant → Attach tenant_id → Enforce RLS → Process

---

## 1.3 GLOBAL SYSTEM

- Multi-language (UI + notifications)
- Multi-currency
- Timezone (UTC)
- Global search

---

## 1.4 RESOURCE CONTROL

- API limits
- Storage limits
- User limits
- Property limits
- Usage tracking

---

# 🧩 2. PLATFORM CORE

## 2.1 MODULE SYSTEM

- PMS, Billing, WiFi, Reports, Automation, AI, Integrations
- Enable/disable per tenant

---

## 2.2 API SYSTEM

- REST + OpenAPI
- Versioning
- Pagination/filter

---

## 2.3 DATA SYSTEM

- PostgreSQL + Prisma
- Backup + PITR
- GDPR export

---

## 2.4 QUEUE + REALTIME

- BullMQ
- Socket.io
- Retry (DLQ)

---

# 🏨 3. PMS CORE

## 3.1 PROPERTY + INVENTORY

### Features
- Multi-property
- Room types
- Rooms

### Flow
Create Property → Add Room Types → Add Rooms → Set Availability

---

## 3.2 INVENTORY LOCKING

Flow:
Select Date Range → Apply Lock → Prevent Booking

---

## 3.3 PRICING ENGINE

Flow:
Base Price → Apply Rules → Final Price → Booking

---

## 3.4 OVERBOOKING

Flow:
Threshold → Booking Attempt → Alert or Block

---

# 📅 4. BOOKING ENGINE

## 4.1 CORE

- Calendar
- Real-time availability

### Flow
Search → Check Availability → Lock Room → Create Booking → Confirm

---

## 4.2 ADVANCED

- Waitlist
- Partial availability
- Upgrade suggestions

---

## 4.3 STATE MACHINE

Draft → Confirmed → Checked_In → Checked_Out → Cancelled

---

## 4.4 CONCURRENCY

Booking Request → DB Lock → Validate → Commit

---

## 4.5 GUEST SELF SERVICE

Booking → Pre-arrival Link → KYC → Payment → Preferences → E-sign → Confirm

---

# 🧑‍💼 5. OPERATIONS

## 5.1 FRONT DESK

Flow:
Walk-in → Assign Room → Check-in → Stay → Check-out

---

## 5.2 HOUSEKEEPING

Flow:
Checkout → Room Dirty → Assign Task → Clean → Update Status

### Advanced
- Preventive maintenance
- Asset tracking

---

## 5.3 STAFF APP

- Real-time updates
- Maintenance reporting

---

# 🛎 6. GUEST EXPERIENCE

## 6.1 REQUESTS

Guest → Request → Assign → Complete → Notify

---

## 6.2 COMMUNICATION

Guest → Message → Staff Reply → Log

---

## 6.3 DIGITAL KEY

Check-in → Generate Key → Mobile Unlock

---

## 6.4 SUPER APP

Booking → Check-in → Services → Chat → Checkout

---

# 📶 7. WIFI SYSTEM

## Flow
Check-in → Create User → Gateway Auth → Session Start → Usage → Session End → Billing

### Features
- Voucher system
- Session tracking
- Social login
- Bandwidth tiers

---

# 💰 8. BILLING

## 8.1 HOTEL

Flow:
Service → Add to Folio → Payment → Invoice

---

## 8.2 SaaS

Signup → Plan → Billing Cycle → Invoice

---

## 8.3 ADVANCED PAYMENTS

Gateway1 Fail → Gateway2 → Success

---

# 🍽 9. RESTAURANT POS

Flow:
Order → Kitchen → Serve → Bill → Folio

---

# 📦 10. INVENTORY

Stock → Usage → Low Alert → Purchase → Vendor

---

# 🚗 11. PARKING

Entry → Assign Slot → Link Guest → Exit → Billing

---

# 📹 12. CCTV

Camera → Event → Alert → Playback

---

# 🧠 13. CRM

Stay → Data → Segment → Campaign → Repeat Guest

---

# 🤖 14. AUTOMATION

Event → Condition → Action

---

# 📊 15. REPORTS

Data → Aggregate → Dashboard → Export

---

# 📈 16. REVENUE

Demand → Pricing → Optimization

---

# 🌐 17. PUBLIC SITE

Visitor → Search → Book → Pay → Confirm

---

# 📩 18. NOTIFICATIONS

Trigger → Channel → Retry → Delivered

---

# 🔌 19. INTEGRATIONS

Internal → Adapter → External API → Response

---

# 📡 20. WEBHOOKS

Event → Queue → Send → Retry → Log

---

# 🧠 21. AI MODULE

Data → AI → Insight → Action

---

# 📊 22. OBSERVABILITY

System → Logs → Metrics → Alerts

---

# 📦 23. MARKETPLACE

Plugin → Install → Enable → Use

---

# 🌐 19A. CHANNEL MANAGER (OTA + CRS) — CRITICAL

## PURPOSE
Single distribution layer for all external booking channels (OTA) + central control (CRS)

---

## 19A.1 OTA CONNECTIONS

- Booking.com
- Airbnb
- Expedia
- Future: Agoda, MakeMyTrip

---

## 19A.2 INVENTORY SYNC

### Flow
Room Availability Change → Channel Manager → OTA Push → OTA Update

- Real-time sync
- Bulk sync fallback

---

## 19A.3 RATE SYNC

### Flow
Price Update → Channel Manager → OTA → Confirm

- Per-channel pricing
- Promotions sync

---

## 19A.4 BOOKING SYNC (CRITICAL)

### Flow
OTA Booking → Webhook/API → Channel Manager → Create Booking → Lock Inventory

- Auto booking creation
- Conflict handling

---

## 19A.5 RESTRICTIONS

- Min stay (MLOS)
- Max stay
- Closed dates

---

## 19A.6 CHANNEL MAPPING

- Internal Room ↔ OTA Room mapping
- Rate plan mapping

---

## 19A.7 SYNC LOGS & RETRY

- Failed sync logs
- Retry queue

---

## 19A.8 CRS (CENTRAL RESERVATION SYSTEM)

### PURPOSE
Single source of truth for inventory, rates, and availability

### Flow
PMS → CRS → OTA / Website / API

### RULE
- No direct OTA calls from booking module
- All traffic must go through Channel Manager

---

## 19A.9 OTA WEBHOOK HANDLING (PRODUCTION-SAFE)

### Supported Events
- reservation.created
- reservation.modified
- reservation.cancelled
- rate.changed (optional)
- availability.changed (optional)

### Inbound Flow (Idempotent)
1. OTA → HTTPS Webhook (signed)
2. Verify signature (HMAC) + timestamp (replay protection)
3. Generate/Read `idempotency_key` (OTA event id)
4. Check idempotency store:
   - if processed → ACK 200 (no-op)
   - else continue
5. Validate payload schema (strict)
6. Map OTA entities → internal models (room, rate plan, guest)
7. Begin DB transaction
8. Acquire row lock (SELECT FOR UPDATE on inventory/booking rows)
9. Apply state transition:
   - created → create booking
   - modified → update booking (dates/guests/rate)
   - cancelled → cancel booking + release inventory
10. Write audit log + event log
11. Commit transaction
12. Mark idempotency key as processed
13. Return 200 OK

### Conflict Handling
- If inventory already booked:
  - Apply conflict policy:
    - Prefer OTA booking → auto-reallocate room OR
    - Put into overbooking queue + alert
- Always log `conflict_reason`

### Security
- HMAC signature validation
- IP allowlist (if provided by OTA)
- Rate limit webhook endpoint

---

## 19A.10 OUTBOUND SYNC (PMS → OTA)

### Triggers
- Inventory change
- Rate change
- Restrictions change
- Booking create/modify/cancel (two-way sync)

### Flow (Async)
1. Domain event emitted (e.g., inventory.updated)
2. Enqueue job (BullMQ) with `tenant_id`, `channel`, payload
3. Worker picks job → Adapter formats request per OTA
4. Send API request
5. Parse response
6. Update sync status + logs

---

## 19A.11 RETRY & DLQ STRATEGY

### Retry Policy (Exponential Backoff)
- attempt 1: immediate
- attempt 2: +30s
- attempt 3: +2m
- attempt 4: +10m
- attempt 5: +1h (max)

### Rules
- Max retries = 5
- Use idempotency keys for all outbound calls
- Safe to retry (PUT/POST designed idempotent via keys)

### Failure Handling
- After max retries → move to DLQ
- Raise alert (Ops dashboard)
- Show in "Sync Errors" UI with reprocess button

---

## 19A.12 SYNC CONSISTENCY GUARDS

- Versioning: include `version` or `updated_at` to avoid stale writes
- Ordering: per-room/channel queue (serialize updates)
- Debounce: coalesce rapid changes (e.g., 500ms window)
- Reconciliation Cron:
  - Periodic full sync (e.g., every 6h)
  - Compare CRS vs OTA → fix drift

---

## 19A.13 OBSERVABILITY

- Correlation ID per sync job
- Structured logs (request/response, redacted PII)
- Metrics:
  - success_rate
  - latency
  - retry_count
- Alerts on:
  - high failure rate
  - webhook signature failures

---

# 🧭 FINAL MENU (FULL PRODUCTION DESIGN)

# 🏠 Dashboard

* **Overview** → Aggregated KPIs (revenue, occupancy, active guests, WiFi usage)
* **Command Center (Live Ops)** → Real-time events (check-ins, bookings, alerts stream)
* **Alerts & Notifications** → System + business alerts (overbooking, failures, tasks)
* **KPI Cards** → Snapshot metrics (ADR, RevPAR, occupancy %, active sessions)

---

# 🏨 PMS

* **Properties** → Multi-property config (timezone, tax, base settings)
* **Room Types** → Logical categories (capacity, pricing base, amenities)
* **Rooms** → Physical inventory, mapped to room_type, live status
* **Inventory Calendar** → Date-wise availability UI (core availability engine)
* **Availability Control** → Open/close inventory, restrictions (min/max stay)
* **Inventory Locking** → Prevent double booking (DB locking logic)
* **Rate Plans** → Pricing models (BAR, seasonal, corporate)
* **Pricing Rules** → Dynamic adjustments (weekday, demand, events)
* **Overbooking Settings** → Allowed overbooking thresholds

---

# 📅 Bookings

* **Calendar View** → Drag-drop booking UI (real-time availability binding)
* **All Bookings** → List + filters (status, date, source)
* **Group Bookings** → Multi-room booking handling
* **Waitlist** → Queue when no availability
* **Booking Audit Logs** → History of changes (who/what/when)
* **Booking Conflicts** → Detect & resolve overlaps

---

# 🧑 Guests

* **Guest List** → Searchable guest directory
* **Guest Profiles** → Personal info + linked stays
* **KYC / Documents** → Identity storage (compliance)
* **Preferences** → Room/food/service preferences
* **Stay History** → Timeline of visits
* **Loyalty & Points** → Rewards + tier logic

---

# 🧑‍💼 Front Desk

* **Check-in** → Convert booking → stay, assign room, trigger WiFi
* **Check-out** → Finalize folio, release room, disable WiFi
* **Walk-in Booking** → Direct booking without prior reservation
* **Room Grid** → Live room status board (occupied/clean/dirty)
* **Room Assignment** → Assign/change room

---

# 🛎 Experience

* **Service Requests** → Guest requests (cleaning, food, etc.)
* **Guest Chat** → Unified messaging (WhatsApp/email/OTA future)
* **In-Room Portal (QR)** → Web portal for guest actions
* **Digital Keys** → Mobile-based access (future integration)
* **Guest App Controls** → Manage services/preferences

---

# 📶 WiFi

* **Active Sessions** → Live connected users (IP, MAC, usage)
* **Voucher Management** → Generate guest access credentials
* **Plans / Bandwidth Profiles** → QoS policies (speed/device limit)
* **Usage Logs** → Historical usage (from radacct sync)
* **Gateway Integration** → RADIUS clients + config

---

# 💰 Billing

* **Folios** → Booking-linked charges container
* **Invoices** → Final bill generation (PDF)
* **Payments** → Payment tracking (cash/card/online)
* **Refunds** → Reverse transactions
* **Discounts** → Apply manual/auto discounts

### SaaS Billing

* **Plans** → Subscription plans for hotels
* **Subscriptions** → Tenant billing lifecycle
* **Usage Billing** → Metered billing (optional)

---

# 🍽 Restaurant / POS

* **Orders** → Order lifecycle (create → serve)
* **Tables** → Table mapping & allocation
* **Kitchen (KDS)** → Kitchen display system
* **Menu Management** → Items + pricing
* **Billing** → POS billing + folio integration

---

# 🧹 Housekeeping & Maintenance

* **Tasks** → Cleaning/operations tasks
* **Kanban Board** → Task workflow UI
* **Room Status** → Clean/dirty/maintenance
* **Maintenance Requests** → Issue tracking
* **Preventive Maintenance** → Scheduled checks
* **Asset Management** → Equipment tracking

---

# 📦 Inventory & Procurement

* **Stock Items** → Inventory master
* **Consumption Logs** → Usage tracking
* **Low Stock Alerts** → Threshold alerts
* **Vendors** → Supplier management
* **Purchase Orders** → Procurement workflow

---

# 🚗 Parking

* **Parking Slots** → Slot inventory
* **Vehicle Tracking** → Guest vehicle mapping
* **Guest Mapping** → Link vehicle to booking
* **Billing** → Parking charges

---

# 📹 Security (CCTV)

* **Live Camera View** → Real-time feeds
* **Playback** → Historical footage
* **Event Alerts** → Motion/incidents
* **Incident Logs** → Security records

---

# 🧠 CRM & Marketing

* **Guest Segments** → Grouping (VIP, repeat)
* **Campaigns** → Email/SMS campaigns
* **Loyalty Programs** → Rewards system
* **Feedback & Reviews** → Guest feedback
* **Retention Analytics** → Repeat behavior insights

---

# 🤖 Automation

* **Workflow Builder** → Event-condition-action engine
* **Rules Engine** → Trigger definitions
* **Templates** → Reusable workflows
* **Execution Logs** → Run history

---

# 📊 Reports & BI

* **Revenue Reports** → Income tracking
* **Occupancy Reports** → Room usage
* **ADR / RevPAR** → Core hotel KPIs
* **Guest Analytics** → Behavior insights
* **Staff Performance** → Productivity
* **Scheduled Reports** → Auto reports

---

# 📈 Revenue Management

* **Pricing Rules** → Dynamic pricing logic
* **Demand Forecasting** → Predict occupancy
* **Competitor Pricing** → External benchmarking
* **AI Suggestions** → Optimization recommendations

---

# 🌐 Channel Manager

* **OTA Connections** → Connect Booking.com etc.
* **Inventory Sync** → Push availability
* **Rate Sync** → Push pricing
* **Booking Sync** → Import bookings
* **Restrictions** → Stop-sell/min stay
* **Channel Mapping** → Room mapping
* **Sync Logs** → Debug sync issues
* **CRS** → Central reservation control

---

# 🔌 Integrations

* **Payment Gateways** → Razorpay/Stripe etc.
* **WiFi Gateways** → MikroTik/UniFi
* **POS Systems** → External POS
* **Third-party APIs** → Open integrations

---

# 📩 Notifications

* **Templates** → Email/SMS templates
* **Delivery Logs** → Sent status
* **Channel Settings** → SMS/email config

---

# 📡 Webhooks

* **Event Logs** → Triggered events
* **Delivery Logs** → Success/failure
* **Retry Queue** → Failed retries

---

# 🧠 AI

* **AI Copilot** → Query system data (NL)
* **Provider Settings** → LLM config
* **AI Insights** → Recommendations

---

# 🧑‍💻 Admin

* **Tenant Management** → SaaS tenants
* **Usage Tracking** → Resource usage
* **Revenue Analytics** → SaaS revenue
* **System Health** → System metrics

---

# ⚙️ Settings

* **General Settings** → Basic config
* **Tax & Currency** → Financial config
* **Localization** → Language/timezone
* **Feature Flags** → Enable/disable modules
* **Security Settings** → RBAC, auth rules


---

# 🧠 24. ALL-IN-ONE HOSPITALITY OPERATING SYSTEM (2026 EXPANSION)

> OBJECTIVE: Transform system from PMS → Full Hospitality OS covering Guest Journey, Revenue, Operations, Marketing, and Intelligence.

---

## 24.1 GUEST JOURNEY ENGINE (CORE DIFFERENTIATOR)

### Flow
Discovery → Booking → Pre-arrival → Stay → Post-stay → Retention

### Features
- Guest timeline (full lifecycle view)
- Behavior tracking (visits, spend, preferences)
- Personalized offers
- Smart recommendations (room, services)
- Repeat guest intelligence

---

## 24.2 UNIFIED COMMUNICATION HUB (CRITICAL)

### Channels
- OTA messages
- WhatsApp
- Email
- SMS

### Flow
Guest Message → Unified Inbox → Assign Staff → Reply → Log → Trigger Automation

### Features
- Single inbox UI
- Auto routing
- Conversation history
- Multi-channel fallback

---

## 24.3 CRM + MARKETING ENGINE

### Flow
Guest Data → Segment → Campaign → Delivery → Conversion Tracking

### Features
- Guest segmentation (VIP, repeat, high-spend)
- Campaign builder (email/WhatsApp/SMS)
- Automated journeys
- Promo engine (coupon, referral)
- Abandoned booking recovery

---

## 24.4 DIRECT BOOKING GROWTH ENGINE

### Flow
Visitor → Website → Track → Retarget → Convert

### Features
- Conversion tracking
- Retargeting campaigns
- Promo & discount system
- Upsell engine (rooms/services)

---

## 24.5 ADVANCED PAYMENT PLATFORM

### Flow
Booking → Payment → Tokenize → Charge → Settlement → Refund

### Features
- Multi-gateway routing
- Failover payments
- Saved cards/tokenization
- Fraud detection
- Split & scheduled payments

---

## 24.6 EVENT / MICE MANAGEMENT

### Flow
Inquiry → Proposal → Booking → Resource Allocation → Event → Billing

### Features
- Hall/space booking
- Event calendar
- Resource allocation (staff/equipment)
- Event billing

---

## 24.7 STAFF MANAGEMENT SYSTEM

### Features
- Shift scheduling
- Attendance tracking
- Task assignment
- Internal communication
- Performance metrics

---

## 24.8 REPUTATION MANAGEMENT

### Flow
Stay → Feedback → Review → Analysis → Response

### Features
- Review aggregation (Google, OTA)
- Sentiment analysis
- Auto-response suggestions

---

## 24.9 METASEARCH & ADS ENGINE

### Features
- Google Hotel Ads integration
- Meta search connectivity
- Ad performance tracking
- ROI analytics

---

## 24.10 MULTI-BRAND / CHAIN MANAGEMENT

### Features
- Multi-brand control
- Central HQ dashboard
- Cross-property analytics
- Shared guest database

---

## 24.11 DATA PLATFORM (BI + WAREHOUSE)

### Flow
Operational Data → Warehouse → Analytics → Insights

### Features
- Data warehouse
- Advanced BI dashboards
- Export to external BI tools

---

## 24.12 TRAINING & ONBOARDING SYSTEM

### Features
- Guided UI tours
- Help center
- Tutorials
- Staff onboarding flows

---

## 24.13 AI COPILOT (ADVANCED)

### Features
- Revenue insights
- Guest insights
- Operational alerts
- Natural language queries

---

## 24.14 SMART HOTEL (IOT READY)

### Features
- Room automation (AC, lights)
- Occupancy sensors
- Energy optimization

---

## 24.15 EXPERIENCE INTELLIGENCE LAYER

### Flow
Event → Analyze → Trigger Action

### Examples
- Guest arrives → Welcome message + WiFi auto-enable
- VIP detected → Alert staff
- Delay in service → Escalation

---

# 🧭 FINAL MENU (UPDATED WITH HOSPITALITY OS)

## 🏠 Dashboard
- Overview
- Command Center
- Alerts

---

## 🏨 PMS
- Properties
- Rooms
- Inventory
- Pricing

---

## 📅 Bookings
- Calendar
- Bookings
- Waitlist

---

## 🧑 Guests
- Profiles
- KYC
- Loyalty

---

## 🧑‍💼 Front Desk
- Check-in/out
- Walk-in
- Room Grid

---

## 🛎 Experience
- Requests
- Digital Key
- Guest App

---

## 💬 Unified Inbox
- All Messages (OTA + WhatsApp + Email + SMS)
- Conversations
- Assignments

---

## 📶 WiFi
- Sessions
- Vouchers
- Plans

---

## 💰 Billing
- Folio
- Payments
- SaaS Billing

---

## 🍽 Restaurant / POS
- Orders
- Kitchen
- Menu

---

## 🧹 Housekeeping & Maintenance
- Tasks
- Maintenance
- Assets

---

## 📦 Inventory
- Stock
- Vendors

---

## 🚗 Parking
- Slots
- Vehicles

---

## 📹 Security
- CCTV
- Events

---

## 🧠 CRM & Marketing
- Segments
- Campaigns
- Promotions

---

## 📢 Ads & Metasearch
- Google Hotel Ads
- Campaign Tracking

---

## 🎉 Events / MICE
- Event Booking
- Resources
- Billing

---

## 👥 Staff Management
- Shifts
- Attendance
- Tasks

---

## ⭐ Reputation
- Reviews
- Sentiment

---

## 🤖 Automation
- Workflows
- Logs

---

## 📊 Reports & BI
- Reports
- Dashboards
- Data Export

---

## 📈 Revenue
- Pricing
- Forecasting

---

## 🌐 Channel Manager
- OTA
- CRS

---

## 🔌 Integrations
- APIs
- Gateways

---

## 📩 Notifications
- Templates
- Logs

---

## 📡 Webhooks
- Events
- Retry

---

## 🧠 AI
- Copilot
- Insights

---

## 🧑‍💻 Admin
- Tenants
- Usage

---

## 🏢 Multi-Brand HQ
- Brands
- Central Dashboard

---

## 🎓 Training Center
- Tutorials
- Help

---

## ⚙️ Settings
- General
- Security
- Localization

---

# 🧠 25. EXECUTION RULES (MANDATORY FOR AI AGENTS)

## 25.1 MODULE INTERACTION CONTRACT (STRICT)
- Booking → PMS (inventory check/lock)
- Booking → Billing (create/update folio)
- Booking → Events (emit booking.*)
- Check-in → WiFi (enable access)
- Check-out → WiFi (disable + finalize usage)
- OTA ↔ ONLY via Channel Manager (no direct calls)
- Payments → Billing → Events (payment.completed)

## 25.2 EVENT SYSTEM (BACKBONE)
Standard events (publish/subscribe):
- booking.created
- booking.modified
- booking.cancelled
- booking.checked_in
- booking.checked_out
- payment.initiated
- payment.completed
- wifi.session.started
- wifi.session.stopped
- inventory.updated
Rules:
- All cross-module communication via events
- Events are idempotent and versioned

## 25.3 CORE DATA ENTITIES (MINIMUM)
- Tenant, Property
- RoomType, Room
- Guest
- Booking (with state)
- Folio, Invoice, LineItem
- Payment
- WiFiSession
- Staff, Role, Permission
- Task (housekeeping/maintenance)
- ChannelMapping, SyncLog, IdempotencyKey

## 25.4 STATE MACHINE RULES (ENFORCED)
- Booking: Draft → Confirmed → Checked_In → Checked_Out | Cancelled
- Invalid transitions are rejected
- Cancelled bookings are immutable (except audit)
- Payments are idempotent and cannot double-settle

## 25.5 IDEMPOTENCY (NON-NEGOTIABLE)
Apply idempotency keys to:
- Booking create/modify/cancel
- Payments (charge/refund)
- OTA inbound/outbound sync
Store keys with status + response snapshot

## 25.6 ERROR FORMAT (GLOBAL)
{
  "code": "STRING_CODE",
  "message": "Human readable",
  "retryable": true|false,
  "details": {}
}

## 25.7 RBAC MATRIX (BASELINE)
- Admin: full access
- Manager: operations + reports
- Staff: scoped modules (front desk/housekeeping)
- Guest: self-service only

## 25.8 MINIMUM API CONTRACTS
- POST /bookings
- GET /availability
- POST /check-in
- POST /check-out
- POST /payments
- POST /wifi/sessions
- GET /guests/{id}
All APIs: pagination, filtering, sorting, rate-limited

## 25.9 LOGGING STANDARD
Every action logs:
- tenant_id, user_id, module, action
- entity_id, before/after (diff where applicable)
- timestamp, correlation_id

## 25.10 NON-NEGOTIABLE RULES
- ❌ No dummy/test data in production paths
- ❌ No hardcoded values
- ❌ No direct external API calls (use adapters)
- ❌ No cross-module DB writes (use APIs/events)
- ✅ Use events for side effects
- ✅ Enforce RLS on every query
- ✅ Validate all inputs (schema + business rules)

---

# 🧠 26. ENTERPRISE EXECUTION HARDENING (FINAL)

## 26.1 DATA OWNERSHIP RULE
- Booking → owned ONLY by Booking module
- Inventory → PMS only
- Payments → Billing only
- WiFiSession → WiFi module
Rule:
- ❌ No cross-module DB writes
- ✅ Use APIs/events only

---

## 26.2 SOURCE OF TRUTH
- CRS → availability + rates (MASTER)
- PMS → operational view
- OTA → external mirror
Rule:
- CRS always wins on conflict resolution

---

## 26.3 TIME STANDARDIZATION
- All timestamps stored in UTC
- UI converts to local timezone
- Default rules:
  - Check-in: 14:00
  - Check-out: 11:00
- Day-boundary logic must be consistent across PMS + OTA

---

## 26.4 SOFT DELETE & AUDIT
- No hard delete for:
  - bookings
  - payments
  - guests
- Use:
  - deleted_at
  - audit history (who, when, what changed)

---

## 26.5 PAGINATION STANDARD
All list APIs MUST support:
- page
- limit
- sort
- filters

---

## 26.6 RATE LIMIT STRATEGY
- Per tenant
- Per user
- Per API
- Burst + sustained limits

---

## 26.7 JOB TYPES (QUEUE)
- Immediate jobs (sync)
- Delayed jobs (reminders)
- Scheduled jobs (cron)
- Retry jobs (failed tasks)

---

## 26.8 WEBHOOK CONTRACT STANDARD
{
  event: "event.name",
  tenant_id: "",
  data: {},
  timestamp: "",
  signature: ""
}

---

## 26.9 TEST DATA STRATEGY
- Seed scripts allowed ONLY in dev
- No dummy/test data in production paths

---

## 26.10 FEATURE FLAG BEHAVIOR
- Disabled module:
  - API returns forbidden
  - UI hidden
  - Background jobs blocked

---

## 26.11 SLA DEFINITIONS
- Booking API < 200ms
- Payment processing < 3 sec
- OTA sync < 5 sec

---

## 26.12 HEALTH & STATUS DASHBOARD
- API health
- Queue backlog
- OTA sync status
- Payment gateway status

---

## 26.13 CONSISTENCY & DATA INTEGRITY RULES
- All writes must be transactional
- Use optimistic/pessimistic locking where needed
- No eventual consistency for booking/inventory critical path

---

## 26.14 CONFIGURATION MANAGEMENT
- All configs stored centrally
- Tenant-level overrides supported
- No hardcoded configs

---

## 26.15 VERSIONING STRATEGY
- API versioning (/v1, /v2)
- Event versioning
- Backward compatibility mandatory

---

## 26.16 SECURITY HARDENING
- Input validation (schema + business rules)
- Output sanitization
- Rate limiting + abuse detection
- Audit all sensitive actions

---

## 26.17 FAILSAFE & RECOVERY RULES
- All critical flows must support retry
- System must be restart-safe (idempotent operations)
- Recovery procedures defined for:
  - payment failure
  - OTA sync failure
  - booking conflict

---

## 26.18 DEPLOYMENT SAFETY RULES
- No breaking schema changes
- Use expand → migrate → contract
- Backward compatible releases only

---

## 26.19 DATA RETENTION POLICY
- Logs retention (configurable)
- GDPR compliance (delete/export)
- Archival strategy for old bookings

---

## 26.20 SYSTEM BOUNDARIES (VERY IMPORTANT)
System MUST NOT:
- Control network packets (WiFi handled externally)
- Replace accounting ERP fully (only operational finance)
- Store unnecessary raw data (optimize storage)

---

# 🏁 FINAL POSITIONING

NOT:
- PMS software

BUT:

👉 "All-in-One Hospitality Operating System"

---

# ✅ RESULT

- Full enterprise menu structure
- Covers all modules (no missing feature)
- Directly usable for UI routing + sidebar
- AI-friendly (clear grouping + hierarchy)

- AI understandable flows
- Dependency safe
- No feature loss
- Execution ready

- AI understandable flows
- Dependency safe
- No feature loss
- Execution ready


# StaySuite
## All-in-One Hospitality Operating System

---

**by Cryptsk Pvt Ltd**  
**Last Updated**: May 2026

---

## The Platform

**StaySuite** is a next-generation, AI-powered hospitality operating system designed for modern hotels, resorts, and property groups. From boutique properties to multi-location chains, StaySuite delivers unified operations, exceptional guest experiences, and revenue optimization — all from a single, intelligent platform.

**Positioning**: Not just a PMS — an All-in-One Hospitality Operating System.

**Scale**: 294 database models, 614 API routes, 529 React components, 30 navigation modules, 44 component directories.

---

## 🏆 Key Differentiators

### 1. WiFi AAA Gateway Integration *(Industry-First USP)*

The only hospitality platform with native WiFi Authentication, Authorization, and Accounting (AAA) integration:

- **FreeRADIUS v3.2.7**: Compiled from source with native PostgreSQL SQL module
- **Multi-Vendor Support**: Cisco, MikroTik, Ruckus, Huawei, Juniper, Fortinet, Aruba, D-Link, Netgear, Grandstream, Ubiquiti (11+ vendors)
- **Captive Portal**: Branded login pages with social auth, voucher codes, and room-based access (redirect service on port 8888)
- **Full Network Stack**: DHCP Server, DNS Server, Firewall, Content Filter, VLAN Management, Multi-WAN
- **Session Management**: Real-time tracking via PostgreSQL radacct
- **Bandwidth Control**: 6 tiered plans (Free through Enterprise, 2-100 Mbps)
- **Revenue Generation**: Tiered WiFi plans from complimentary to ₹699/day
- **Auto-Provisioning**: WiFi account created on check-in, disabled on check-out

### 2. Unified Channel Manager with CRS

Single distribution layer for all external booking channels with Central Reservation System:

- **OTA Connections**: 46+ channels (Booking.com, Airbnb, Expedia, Agoda, MakeMyTrip, Goibibo, and more)
- **Real-time Sync**: Instant inventory and rate synchronization
- **Intelligent Routing**: All OTA traffic through Channel Manager
- **Conflict Handling**: Dead letter queue with automated resolution
- **Idempotent Operations**: Safe retry mechanisms with IdempotencyKey

### 3. AI-Powered Revenue Intelligence

Machine learning algorithms that optimize pricing and maximize RevPAR:

- **Dynamic Pricing Engine**: Real-time rate adjustments via PricingRule model
- **Demand Forecasting**: Predict occupancy with DemandForecast model
- **Competitor Intelligence**: Automated rate shopping via CompetitorPrice model
- **AI Recommendations**: Actionable insights via AISuggestion model

### 4. Complete Guest Journey Engine

Transform every touchpoint of the guest lifecycle:

- **Discovery → Booking → Pre-arrival → Stay → Post-stay → Retention**
- **13 Experience Sub-features**: Catalog, Bookings, Pricing, Vendors, Feedback, Chat, Portal, Keys, App Controls
- **Digital Room Keys**: NFC/BLE keyless entry integration with QR code
- **Contactless Check-in/Out**: Express kiosk with e-signature and ID scanning
- **In-Room Portal**: QR-based web portal for services
- **Smart Recommendations**: Personalized room and service suggestions

---

## 📊 Platform Modules (30 Modules)

### Base Modules (8 — Always Enabled)

#### 🏨 Property Management System (12 features)
Multi-property, room types, rooms, inventory calendar, availability control, inventory locking, rate plans, overbooking, floor plans, room rate calendar, room out-of-order, package plans

#### 📅 Booking Engine (6 features)
Calendar view, group bookings, waitlist, conflicts, no-show automation, audit logs

#### 🧑‍💼 Front Desk (9 features)
Check-in/out, walk-in, room grid, room assignment, registration card, express kiosk, kiosk settings, room move, key card manager

#### 🧑 Guests & CRM (8 features)
Guest profiles, KYC/documents, stay history, preferences, loyalty & points, guest merge, guest journey, WiFi session history

#### 🧹 Housekeeping (11 features)
Tasks, kanban board, room status, maintenance, preventive maintenance, assets, inspection checklists, automation, lost & found, minibar, laundry

#### 💰 Billing & Payments (15 features)
Folios, invoices, payments, refunds, discounts, cancellation policies, folio transfer, payment plans, credit notes, multi-currency, night audit, city ledger, commissions, posting rules, scheduled charges

#### ⚙️ Settings (8 features)
General, tax & currency, localization, feature flags, license keys, GDPR, security, system integrations

#### 🎓 Help & Support (3 features)
Help center, articles, tutorial progress

### Addon Modules (22 — Toggleable)

#### 🛎 Guest Experience (13 features)
Service requests, unified inbox, guest chat, in-room portal, digital keys, guest app controls, experience catalog, experience bookings, pricing, vendor management, revenue analytics, calendar, guest feedback

#### 🍽 Restaurant & POS (15 features)
Orders (with split), tables (with layout), kitchen display, menu management, billing, room service, restaurant reports, recipes, staff assignment, receipt templates, inventory, modifiers, variants, layout, reservations

#### 📶 WiFi Management (10 features)
WiFi access, RADIUS & gateway (FreeRADIUS v3.2.7), network (VLANs, multi-WAN), DHCP server, DNS server, captive portal, firewall & bandwidth, content filter, gateway diagnostics, reports

#### 📊 Reports & BI (6 features)
Revenue, occupancy, ADR/RevPAR, guest analytics, staff performance, scheduled reports

#### 📈 Revenue Management (4 features)
Dynamic pricing, demand forecasting, competitor pricing, AI suggestions

#### 🌐 Channel Manager (8 features)
OTA connections (46+), inventory sync, rate sync, booking sync, restrictions, mapping, sync logs, CRS

#### 🧠 CRM & Marketing (5 features)
Guest segments, campaigns, loyalty programs, feedback & reviews, retention analytics

#### 📢 Marketing (4 features)
Reputation dashboard, review sources, direct booking engine, promotions & offers

#### 📣 Digital Advertising (4 features)
Ad campaigns, Google Hotel Ads, performance tracking, ROI analytics

#### 🤖 AI Assistant (3 features)
AI copilot, AI insights, provider settings

#### 🤖 Automation (4 features)
Workflow builder, rules engine, templates, execution logs

#### 🎉 Events / MICE (4 features)
Event spaces, calendar, bookings, resources

#### 👥 Staff Management (6 features)
Shift scheduling, attendance tracking, task assignment, internal communication, performance metrics, skills & certifications

#### 🛡 Security Center (5 features)
Security overview, audit logs, 2FA, device sessions, SSO configuration

#### 🔌 Integrations (4 features)
Payment gateways, SMS gateways, POS systems, third-party APIs

#### 🔔 Notifications (3 features)
Templates, delivery logs, channel settings

#### 🪝 Webhooks (3 features)
Event logs, delivery logs, retry queue

#### 📦 Inventory (5 features)
Stock items, consumption logs, low stock alerts, vendors, purchase orders

#### 🚗 Parking (4 features)
Parking slots, vehicle tracking, monthly passes, parking billing

#### 📹 Surveillance (6 features)
Camera management, live camera, playback, event alerts, incidents, surveillance settings

#### 💡 Smart Hotel / IoT (3 features)
Device management, room controls, energy dashboard

#### 🏢 Admin (7 features)
Tenant management, tenant lifecycle, roles & permissions, user management, usage tracking, revenue analytics, system health

#### 🏢 Chain Management (3 features)
Brand management, chain dashboard, cross-property analytics

#### 💎 SaaS Billing (3 features)
Plans, subscriptions, usage billing

---

## 🔐 Security & Compliance

### Authentication & Access

| Feature | Capability |
|---------|------------|
| Custom Session Auth | httpOnly cookies, 32-byte random tokens |
| Two-Factor Auth | TOTP, SMS, Email |
| SSO | SAML 2.0, OIDC, LDAP |
| RBAC + ABAC | 9 roles, module.action permissions |
| Device Sessions | Device trust and management |
| Account Lockout | 5 failed → 30 min lock |
| Idle Timeout | Configurable per tenant |

### Data Protection

| Standard | Compliance |
|----------|------------|
| Encryption | TLS 1.3 in transit, AES-256-GCM at rest |
| GDPR | Full compliance with export/deletion/consent |
| Audit Logging | Complete activity trail |
| Soft Delete | No hard deletes for critical data |
| Backup | Daily automated backups with PITR |
| Tenant Isolation | tenantId on all 294 models |

---

## 🏗 Technical Architecture

### Platform Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js + React + TypeScript | 16.1, 19, 5 |
| Styling | Tailwind CSS + shadcn/ui | 4 |
| Database | PostgreSQL | 17 |
| WiFi AAA | FreeRADIUS (compiled from source) | v3.2.7 |
| ORM | Prisma | 6.19+ |
| Auth | Custom Session + NextAuth.js | v4 |
| State | Zustand | 5.0+ |
| Server Cache | TanStack Query | 5.82+ |
| Real-time | Socket.io | 4.7+ |
| Forms | React Hook Form + Zod | 7.60, 4.0 |
| Package Manager | Bun | latest |

### Enterprise Features

- **Multi-Tenant SaaS**: Complete tenant isolation across 294 models
- **Feature Flags**: 8 base + 22 addon modules toggleable per plan
- **Rate Limiting**: Per tenant, user, and API endpoint
- **Idempotency**: Safe retries for all critical operations
- **Observability**: Logs, metrics, health dashboard
- **Process Management**: PM2 with 4 services (Next.js, FreeRADIUS, Captive Redirect, Realtime)

---

## 🌍 Global Ready

- **Languages**: 15 (8 Indian + 7 Global)
- **Currencies**: Multi-currency support
- **Timezones**: Full timezone support
- **RTL**: Arabic support

---

## 📞 Contact Sales

**Email**: sales@cryptsk.com
**Website**: www.staysuite.io

## 🚀 Get Started

1. **Request a Demo** — See StaySuite in action
2. **Technical Consultation** — Discuss your requirements
3. **Pilot Program** — Start with a trial property
4. **Full Deployment** — Roll out across your portfolio

---

## About Cryptsk Pvt Ltd

**Cryptsk Pvt Ltd** is a technology company building next-generation hospitality solutions. Our mission is to modernize hotel operations with intelligent, reliable, and scalable software.

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*
*StaySuite is a product of Cryptsk Pvt Ltd.*

# StaySuite Product Overview
## All-in-One Hospitality Operating System

**Version**: 2.1  
**Last Updated**: July 2025  
**Author**: Cryptsk Pvt Ltd

---

## 1. Executive Summary

### 1.1 Product Definition

**StaySuite** is an enterprise-grade, cloud-native hospitality operating system that unifies all aspects of hotel operations into a single, intelligent platform. Unlike traditional Property Management Systems (PMS), StaySuite is positioned as a complete **Hospitality Operating System** — covering guest journey, revenue, operations, marketing, and intelligence.

The platform comprises **294 database models**, **617 API routes**, and **532 React components** organized across **52 component directories**, making it one of the most comprehensive hospitality platforms in the industry.

### 1.2 Target Market

| Segment | Description |
|---------|-------------|
| **Boutique Hotels** | 10-50 rooms, design-focused properties |
| **Business Hotels** | 50-200 rooms, corporate travelers |
| **Resorts** | 50-300 rooms, leisure destinations |
| **Hotel Chains** | Multi-property groups, 2-100+ properties |
| **Serviced Apartments** | Extended stay properties |
| **Hostels** | Budget accommodations |

### 1.3 Key Differentiators

| Differentiator | Description |
|----------------|-------------|
| **WiFi AAA Gateway** | Industry-first native FreeRADIUS v3.2.7 integration with PostgreSQL SQL module, 11+ vendor support |
| **AI Revenue Engine** | Machine learning for dynamic pricing, demand forecasting, and competitor analysis |
| **Unified Channel Manager** | 46+ OTA connections with real-time sync and CRS |
| **Guest Journey Engine** | Complete lifecycle management from discovery to retention |
| **Unified Communication Hub** | Single inbox for OTA, WhatsApp, Email, SMS |
| **Scale** | 294 DB models, 617 API routes, 532 components, 30 navigation modules |

---

## 2. Product Vision

### 2.1 Mission Statement

To modernize hospitality operations with intelligent, reliable, and scalable software that empowers hotels to deliver exceptional guest experiences while maximizing revenue and operational efficiency.

### 2.2 Product Philosophy

1. **Unified Platform**: One system for all operations — no more fragmented tools
2. **AI-First**: Intelligence built into every workflow
3. **Guest-Centric**: Every feature designed around guest experience
4. **Integration-Ready**: Open APIs and extensible architecture
5. **Enterprise-Grade**: Security, reliability, and scalability by design

---

## 3. Product Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STAYSUITE PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Web App   │  │  Guest App  │  │  Staff App  │          │
│  │  (Next.js)  │  │   (PWA)     │  │   (PWA)     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                      API Layer (617 Routes)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │   PMS   │ │Booking  │ │Billing  │ │  WiFi   │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │   CRM   │ │Channel  │ │Revenue  │ │   AI    │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │   POS   │ │  IoT    │ │  Staff  │ │ Events  │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │  NextAuth │ │  Socket   │ │   Node    │                  │
│  │   v4      │ │   .io     │ │  Cron     │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │PostgreSQL │ │ FreeRADIUS│ │   S3      │                  │
│  │   v17     │ │  v3.2.7   │ │           │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js, React, TypeScript | 16.1, 19, 5 |
| Styling | Tailwind CSS, shadcn/ui | 4 |
| Backend | Next.js API Routes, Bun | 16.1, latest |
| Database | PostgreSQL | 17 |
| ORM | Prisma | 6.19+ |
| Auth | NextAuth.js | v4 |
| Real-time | Socket.io | 4.7+ |
| State | Zustand | 5.0+ |
| Server Cache | TanStack Query | 5.82+ |
| WiFi AAA | FreeRADIUS (compiled from source) | v3.2.7 |
| Forms | React Hook Form + Zod | 7.60, 4.0 |
| Charts | Recharts | 2.15+ |

### 3.3 Multi-Tenant Architecture

```
Request → Middleware → Resolve Tenant → Attach tenant_id → Enforce Scoping → Process
```

- Complete tenant isolation at database level (tenantId on all models)
- Scoped queries on every API route
- Tenant-specific configurations, branding, and feature flags
- Platform admin role for cross-tenant management

### 3.4 Platform Statistics

| Metric | Count |
|--------|-------|
| Prisma Database Models | 294 |
| API Routes | 617 |
| React Components | 532 |
| Component Subdirectories | 52 |
| Navigation Modules | 30 |
| API Route Directories | 134 |
| Mini-Services | 11 (Next.js, FreeRADIUS, Realtime, Captive Redirect, Availability, DHCP, DNS, DNS Parser, RADIUS Server, Conntrack Bridge, SNI Parser) |
| shadcn/ui Components | 56 |
| Supported Locales | 15 (8 Indian + 7 Global) |

---

## 4. Core Modules

The platform is organized into **8 base modules** (always enabled) and **22 addon modules** (toggleable via feature flags).

### 4.1 Property Management System (PMS) — Base

| Module | Description |
|--------|-------------|
| Properties | Multi-property configuration |
| Room Types | Logical room categories with amenities and pricing |
| Rooms | Physical inventory with 12+ status types |
| Inventory Calendar | Date-wise availability with visual calendar |
| Availability Control | Open/close inventory, restrictions |
| Inventory Locking | DB-level row locking to prevent overbooking |
| Rate Plans & Pricing | Pricing models (BAR, seasonal, corporate) |
| Overbooking Settings | Configurable thresholds with alerts |
| Floor Plans | Visual drag-drop floor plan editor |
| Room Rate Calendar | Date-grid rate management |
| Room Out-of-Order | Maintenance-based room unavailability |
| Package Plans | Bundled room + service packages |
| Travel Agents | Travel agent management with commission rules |

### 4.2 Bookings — Base

| Module | Description |
|--------|-------------|
| Calendar View | Visual booking interface with drag-drop |
| Group Bookings | Multi-room bookings for events/tours |
| Waitlist | Queue management when no availability |
| Conflicts | Overlap detection and resolution |
| No-Show Automation | Automatic no-show processing |
| Audit Logs | Complete booking change history |

### 4.3 Front Desk — Base

| Module | Description |
|--------|-------------|
| Check-in | Arrival processing with auto-triggers |
| Check-out | Departure processing with folio settlement |
| Walk-in Booking | Direct booking without prior reservation |
| Room Grid | Live color-coded status dashboard |
| Room Assignment | Smart room assignment with filters |
| Registration Card | Digital registration with e-signature |
| Express Kiosk | Self-service kiosk for check-in/out |
| Kiosk Settings | Kiosk configuration and branding |
| Room Move | Room change during stay |

### 4.4 Guest Management — Base

| Module | Description |
|--------|-------------|
| Guest List | Guest directory with search and filters |
| KYC/Documents | Identity document upload and management |
| Preferences | Guest preferences tracking |
| Stay History | Complete visit timeline |
| Loyalty & Points | Multi-tier rewards program |
| Guest Profile | 360-degree guest view |

### 4.5 Housekeeping — Base

| Module | Description |
|--------|-------------|
| Tasks | Cleaning and operations task management |
| Kanban Board | Visual workflow board |
| Room Status | Clean/dirty/maintenance tracking |
| Maintenance Requests | Issue tracking with prioritization |
| Preventive Maintenance | Scheduled equipment checks |
| Asset Management | Equipment lifecycle tracking |
| Inspection Checklists | Quality assurance workflows |
| Automation Rules | Auto-assignment and triggers |
| Lost & Found | Item tracking with guest notification |
| Minibar | Room minibar setup, consumption tracking, restocking |
| Laundry | Order tracking, item catalog, status management |

### 4.6 Billing — Base

| Module | Description |
|--------|-------------|
| Folios | Booking-linked charge containers |
| Invoices | PDF generation with templates |
| Payments | Multi-gateway transaction tracking |
| Refunds | Transaction reversal processing |
| Discounts | Manual and automatic discounts |
| Cancellation Policies | Configurable penalty rules |
| Folio Transfer | Cross-folio charge transfers |
| Payment Plans | Scheduled payment schedules |
| Credit Notes | Credit memo management |
| Multi-Currency | Exchange rate management |
| Posting Rules | Auto-posting configuration with condition-based triggers |
| Scheduled Charges | Recurring charge automation with pause/resume/history |
| City Ledger | Account-based billing for corporate and travel agent accounts |
| Commissions | Travel agent commission tracking with rules and payment management |
| Revenue Accounts | Chart of accounts for revenue categorization |
| Night Audit | Multi-step daily reconciliation and close process |

### 4.7 Guest Experience — Addon

| Module | Description |
|--------|-------------|
| Service Requests | Real-time guest request management |
| Unified Inbox | Single inbox for all communication channels |
| Guest Chat | Real-time messaging with chat transfer |
| In-Room Portal | QR-based web portal for guest self-service |
| Digital Keys | Mobile-based room access |
| Guest App Controls | Mobile service and preference management |
| Experience Catalog | Activity and service marketplace |
| Experience Bookings | Activity booking management |
| Pricing & Availability | Dynamic experience pricing |
| Vendor Management | Activity provider management |
| Revenue Analytics | Experience revenue tracking |
| Calendar | Activity scheduling |
| Guest Feedback | In-stay feedback collection |

### 4.8 Restaurant & POS — Addon

| Module | Description |
|--------|-------------|
| Orders | Complete order lifecycle management |
| Tables | Seating layout and allocation |
| Kitchen (KDS) | Real-time kitchen display system |
| Menu Management | Items, categories, pricing, images |
| Restaurant Billing | F&B charge processing |
| Room Service | In-room dining orders |
| Restaurant Reports | F&B analytics |
| Recipes | Recipe management with ingredients |
| Staff Assignment | Wait staff allocation |
| Receipt Templates | Customizable receipt formats |
| Inventory | F&B stock management |
| Menu Modifiers | Customization options (size, extras) |
| Menu Variants | Multiple presentation options |
| Table Layout | Visual floor plan editor |
| Reservations | Restaurant table reservations |

### 4.9 WiFi Management — Addon

| Module | Description |
|--------|-------------|
| WiFi Access | Session management and monitoring |
| RADIUS & Gateway | FreeRADIUS v3.2.7 with PostgreSQL SQL module |
| Network | Network configuration and VLANs |
| DHCP Server | DHCP management with reservations |
| DNS Server | DNS configuration and redirect rules |
| Captive Portal | Branded login pages |
| Firewall & Bandwidth | QoS policies and firewall rules |
| Content Filter | Web category blocking and scheduling |
| Gateway Diagnostics | Speed tests and network health |
| Reports | Usage analytics and session history |

### 4.10 Channel Manager — Addon

| Module | Description |
|--------|-------------|
| OTA Connections | 46+ channel integrations |
| Inventory Sync | Real-time availability push |
| Rate Sync | Dynamic pricing synchronization |
| Booking Sync | Automated reservation import |
| Restrictions | Stop-sell, MLOS, CTA rules |
| Channel Mapping | Room type and rate plan mapping |
| Sync Logs | Debug and monitoring |
| CRS | Central Reservation System |

### 4.11 Revenue Management — Addon

| Module | Description |
|--------|-------------|
| Dynamic Pricing | Real-time rate adjustments |
| Demand Forecasting | ML-based occupancy predictions |
| Competitor Pricing | Automated rate shopping |
| AI Suggestions | Actionable pricing recommendations |

### 4.12 CRM & Marketing — Addon

| Module | Description |
|--------|-------------|
| Guest Segments | VIP, repeat, high-spend grouping |
| Campaigns | Email/SMS/WhatsApp marketing |
| Loyalty Programs | Multi-tier rewards |
| Feedback & Reviews | Review aggregation and response |
| Retention Analytics | Churn prediction and retention metrics |

### 4.13 Additional Addon Modules

| Module | Description |
|--------|-------------|
| **Inventory** | Stock items, consumption logs, POs, vendors |
| **Parking** | Slot management, vehicle tracking, billing |
| **Surveillance** | Camera management, live view, playback, incidents |
| **Smart Hotel / IoT** | Device management, room controls, energy dashboard |
| **Events / MICE** | Event spaces, booking, resources, calendar |
| **Staff Management** | Shift scheduling, attendance, tasks, communication, skills |
| **Digital Advertising** | Ad campaigns, Google Hotel Ads, ROI analytics |
| **Reports & BI** | Revenue, occupancy, ADR/RevPAR, guest analytics, staff performance |
| **Automation** | Workflow builder, rules engine, templates, execution logs |
| **AI Assistant** | AI Copilot, insights, provider settings |
| **Security Center** | Security overview, audit logs, 2FA, sessions, SSO |
| **Integrations** | Payment gateways, SMS, POS, third-party APIs |
| **Notifications** | Templates, delivery logs, channel settings |
| **Webhooks** | Event logs, delivery logs, retry queue |
| **Admin** | Tenant management, lifecycle, roles, users, usage, revenue, health |
| **Chain Management** | Brand management, chain dashboard, cross-property analytics |
| **SaaS Billing** | Plans, subscriptions, usage billing |

---

## 5. Integration Ecosystem

### 5.1 Channel Manager Integrations

- Booking.com, Expedia, Airbnb, Agoda
- MakeMyTrip, Goibibo, Yatra, OYO
- Amadeus, Sabre, Travelport (GDS)
- Google Hotel Ads, TripAdvisor, Trivago

### 5.2 Payment Gateway Integrations

- Stripe, PayPal, Razorpay
- Square, Adyen, Authorize.net
- CCAvenue, PayU

### 5.3 WiFi Gateway Integrations

FreeRADIUS v3.2.7 compiled from source with native PostgreSQL SQL module:
- Cisco, MikroTik, Ruckus
- Huawei, Juniper, Fortinet
- Aruba, Ubiquiti, D-Link, Netgear, Grandstream

### 5.4 Door Lock Integrations

- Assa Abloy, dormakaba, Salto
- ONITY, August

### 5.5 IoT Integrations

- Smart room controls
- Energy management
- Occupancy sensors

---

## 6. Security & Compliance

### 6.1 Authentication

- Custom session-based auth with httpOnly cookies
- Two-factor authentication (TOTP)
- SSO (SAML 2.0, OIDC, LDAP)
- Device session management
- Account lockout (5 failed attempts → 30 min lock)

### 6.2 Authorization

- Role-Based Access Control (RBAC) with 9 default roles
- Attribute-Based Access Control (ABAC)
- Granular permissions per module (module.action format)
- Feature flags (plan-based access)

### 6.3 Data Protection

- TLS 1.3 encryption in transit
- AES-256-GCM encryption at rest
- PCI-compliant tokenization
- GDPR compliance tools (consent, export, erasure)
- Soft delete for all critical data

### 6.4 Audit & Compliance

- Complete audit logging for all mutations
- Password hashing with bcrypt
- Idle session timeout (configurable per tenant)
- Password expiry (configurable per tenant)
- Data retention policies

---

## 7. Deployment Options

| Option | Description |
|--------|-------------|
| **Cloud SaaS** | Multi-tenant hosted by Cryptsk |
| **Private Cloud** | Single-tenant dedicated instance |
| **On-Premise** | Self-hosted with enterprise support |
| **Hybrid** | Mixed deployment model |

### Deployment Architecture

The platform runs **11 services** managed by PM2:

1. **staysuite-nextjs** — Main application (port 3000)
2. **staysuite-freeradius** — FreeRADIUS v3.2.7 server (ports 1812/1813)
3. **staysuite-realtime** — WebSocket real-time service (port 3003)
4. **staysuite-captive-redirect** — Captive portal redirect service (port 8888)
5. **availability-service** — Room availability checker (port 3002)
6. **dhcp-service** — Custom DHCP server
7. **dns-service** — Custom DNS resolver
8. **dns-parser** — DNS packet parser
9. **radius-server** — Custom RADIUS implementation
10. **conntrack-bridge** — Linux conntrack session bridge
11. **sni-parser** — TLS SNI hostname parser

---

## 8. Demo Instance

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |
| Platform Admin | platform@staysuite.com | admin123 |

### Demo Tenant

| Tenant | City | Properties |
|--------|------|------------|
| Royal Stay Hotels | Kolkata, India | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | - | - |

### Demo Room Types (Royal Stay Kolkata)

| Type | Code | Base Price (INR) | Rooms |
|------|------|-------------------|-------|
| Standard Room | STD | 3,500 | 40 |
| Deluxe Room | DLX | 5,500 | 35 |
| Executive Suite | EXEC | 12,000 | 25 |
| Presidential Suite | PRES | 35,000 | 5 |

---

## 9. Cron Jobs & Scheduled Tasks

The platform includes a comprehensive cron job system powered by Node.js, responsible for automated daily operations, synchronizations, and background processing.

| Cron Job | Description |
|----------|-------------|
| **Auto Room Posting** | Automatic daily room charges applied to active folios |
| **Channel Sync** | OTA channel synchronization for inventory, rates, and bookings |
| **Execute Scheduled Charges** | Process recurring charges with pause/resume support |
| **Expiration** | Handle booking and rate plan expirations |
| **No-Show Detection** | Automatic no-show processing based on configurable rules |
| **PM Auto-Trigger** | Preventive maintenance triggers based on schedules |
| **Process Notifications** | Scheduled notification delivery across channels |
| **Recurring Invoices** | Automated invoice generation for recurring billing |
| **Recurring Tasks** | Scheduled task execution for operations |
| **Reports** | Scheduled report generation and delivery |
| **Session Engine** | WiFi session monitoring, cleanup, and enforcement |

---

## 10. Seed Data & Database Initialization

The platform uses Prisma seed files for database initialization and demo data population:

| File | Description |
|------|-------------|
| `prisma/seed.ts` | Comprehensive primary seed (3,425 lines) — entities, configurations, and demo data |
| `prisma/wifi-seed.ts` | WiFi-specific seed data — networks, RADIUS clients, captive portal configs |
| `prisma/seed-final.ts` | Supplementary seed for final-stage data and overrides |

---

## 11. Support & Maintenance

### 11.1 Support Channels

- Email: support@cryptsk.com
- In-app chat
- Help center with articles and tutorials
- Documentation portal

### 11.2 Support Tiers

| Priority | Response Time |
|----------|---------------|
| Critical | 15 minutes |
| High | 1 hour |
| Medium | 4 hours |
| Low | 24 hours |

---

## 12. Contact

**Cryptsk Pvt Ltd**

- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2025 Cryptsk Pvt Ltd. All rights reserved.*

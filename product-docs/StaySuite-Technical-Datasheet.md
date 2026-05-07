# StaySuite Technical Datasheet
## Enterprise Hospitality Platform Specifications

---

**Last Updated**: May 2026

---

## Product Overview

**StaySuite** by **Cryptsk Pvt Ltd** is a cloud-native, multi-tenant SaaS platform — an All-in-One Hospitality Operating System built on modern technologies for reliability, scalability, and security.

---

## Platform Scale

| Metric | Value |
|--------|-------|
| Prisma Database Models | 294 |
| API Routes | 614 |
| React Components | 529 |
| Component Subdirectories | 44 |
| API Route Directories | 134 |
| Navigation Modules | 30 |
| shadcn/ui Components | 51 |
| FreeRADIUS | v3.2.7 (compiled from source) |
| Supported Locales | 15 |
| Zustand Stores | 5 |
| React Contexts | 8 |

---

## 🏗 Technical Architecture

### Platform Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | Next.js (App Router) | 16.1 |
| **UI Library** | React | 19 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS | 4 |
| **Component Library** | shadcn/ui (New York style) | Latest |
| **Backend Runtime** | Next.js API Routes + Bun | - |
| **Database** | PostgreSQL | 17 |
| **ORM** | Prisma | 6.19+ |
| **Auth** | Custom Session + NextAuth.js | v4 |
| **State** | Zustand | 5.0+ |
| **Server Cache** | TanStack Query | 5.82+ |
| **Tables** | TanStack Table | 8.21+ |
| **Charts** | Recharts | 2.15+ |
| **Forms** | React Hook Form + Zod | 7.60, 4.0 |
| **Real-time** | Socket.io | 4.7+ |
| **Animations** | Framer Motion | 12.23+ |
| **WiFi AAA** | FreeRADIUS | v3.2.7 |
| **Package Manager** | Bun | Latest |

### Deployment Architecture

4 PM2-managed services:

| Service | Port | Technology |
|---------|------|-----------|
| staysuite-nextjs | 3000 | Next.js + Bun |
| staysuite-freeradius | 1812/1813 | FreeRADIUS v3.2.7 |
| staysuite-captive-redirect | 8888 | Bun |
| staysuite-realtime | 3003 | Socket.io + Bun |

### Deployment Options

| Option | Description |
|--------|-------------|
| **Cloud SaaS** | Multi-tenant hosted solution |
| **On-Premise** | Self-hosted with PM2 + Systemd |

---

## 🔌 WiFi AAA Gateway Specifications

### FreeRADIUS v3.2.7

Compiled from source with native PostgreSQL SQL module:

| Feature | Specification |
|---------|---------------|
| Version | 3.2.7 |
| Compilation | From source |
| SQL Backend | PostgreSQL 17 (native module) |
| Auth Port | 1812 |
| Acct Port | 1813 |
| CoA Support | Yes |
| Voucher System | Yes (WiFiVoucher model) |
| Bandwidth Plans | 6 (Free through Enterprise) |
| Captive Portal | Redirect service (port 8888) |
| DHCP Server | Built-in management |
| DNS Server | Built-in management |
| Firewall | Zone-based with bandwidth pools |
| Content Filter | Web category blocking |

### Supported Network Vendors (11+)

| Vendor | Protocols | Integration Type |
|--------|-----------|------------------|
| **Cisco** | RADIUS, CoA | WLC, ISE |
| **MikroTik** | RADIUS, API | Hotspot, User Manager |
| **Ruckus** | RADIUS, CoA | ZoneDirector, SmartZone |
| **Huawei** | RADIUS | AC Integration |
| **Juniper** | RADIUS, CoA | Mist Cloud Support |
| **Fortinet** | RADIUS, API | FortiGate, FortiWiFi |
| **Aruba** | RADIUS, CoA | Mobility Controller |
| **D-Link** | RADIUS | Unified Wireless |
| **Netgear** | RADIUS | Insight Integration |
| **Grandstream** | RADIUS | GWN Series |
| **Ubiquiti** | RADIUS | UniFi Controller |

### Authentication Methods

| Method | Description |
|--------|-------------|
| **Room-Based** | Guest name + room number (auto on check-in) |
| **Voucher-Based** | Pre-paid access codes |
| **Social Auth** | Google, Facebook, WhatsApp |
| **Email/SMS OTP** | One-time password verification |
| **LDAP/AD** | Corporate guest accounts |
| **Captive Portal** | Custom branded login pages |

### WiFi Plans

| Plan | Speed | Data Cap | Price |
|------|-------|----------|-------|
| Free | 2 Mbps | 500 MB/day | Complimentary |
| Basic | 5 Mbps | 1 GB/day | Complimentary |
| Standard | 10 Mbps | 3 GB/day | ₹99/day |
| Premium | 25 Mbps | 10 GB/day | ₹199/day |
| Business | 50 Mbps | Unlimited | ₹399/day |
| Enterprise | 100 Mbps | Unlimited | ₹699/day |

---

## 📡 Channel Manager Integration

### Supported Channels (46+)

**Global OTAs**: Booking.com, Expedia, Airbnb, Agoda, TripAdvisor, Hostelworld

**India**: MakeMyTrip, Goibibo, Yatra, OYO, Cleartrip, EaseMyTrip, Travelguru, FabHotels, Treebo

**GDS**: Amadeus, Sabre, Travelport

**Metasearch**: Google Hotel Ads, TripAdvisor, Trivago, Kayak, Skyscanner

### Sync Capabilities

| Feature | Description |
|---------|-------------|
| Inventory Sync | Real-time availability updates |
| Rate Sync | Dynamic pricing synchronization |
| Restrictions | Stop-sell, MLOS, CTA |
| Booking Import | Automatic with idempotency keys |
| Channel Mapping | Room type and rate plan mapping |
| Conflict Handling | Dead letter queue + manual resolution |
| Retry Queue | Exponential backoff (5 retries) |
| Reconciliation | Periodic full sync |

---

## 💳 Payment Gateway Integration

### Supported Gateways

| Gateway | Regions | Features |
|---------|---------|----------|
| **Stripe** | 46+ countries | Cards, Apple Pay, Google Pay |
| **PayPal** | 200+ countries | PayPal, Venmo, Cards |
| **Razorpay** | India | UPI, Cards, NetBanking |
| **Square** | US, Canada | Cards, Afterpay |
| **Adyen** | Global | 250+ payment methods |
| **Authorize.net** | US, Canada | Cards, eCheck |
| **CCAvenue** | India | Multi-bank support |
| **PayU** | 50+ countries | Local payment methods |

---

## 🏨 Property Management Specifications

### Database Schema

- **294 Prisma models** in `prisma/schema.prisma`
- All tenant-scoped models include `tenantId` field
- All models have `createdAt` and `updatedAt` (auto-managed)
- Soft delete: `deletedAt` field on critical models

### Booking State Machine

```
Draft → Confirmed → Checked_In → Checked_Out → Cancelled
```

### Inventory Management

| Feature | Specification |
|---------|---------------|
| Room Types | Unlimited |
| Rooms | Unlimited |
| Room Status | 12+ status types |
| Floor Plans | Visual editor with drag-drop |
| Inventory Locking | DB-level row locking |
| Overbooking | Configurable thresholds |

---

## 🤖 AI & Machine Learning

### Revenue AI

| Feature | Capability |
|---------|------------|
| Demand Forecasting | Occupancy predictions (DemandForecast model) |
| Dynamic Pricing | Real-time rate recommendations (PricingRule model) |
| Competitor Analysis | Rate shopping across channels (CompetitorPrice model) |
| AI Suggestions | Actionable recommendations (AISuggestion model) |

---

## 🔐 Security & Compliance

| Feature | Specification |
|---------|---------------|
| Auth System | Custom session-based (httpOnly cookies) |
| Password Hashing | bcrypt |
| Two-Factor | TOTP (otplib), SMS, Email |
| SSO | SAML 2.0, OIDC, LDAP |
| Account Lockout | 5 attempts → 30 min lock |
| Idle Timeout | Configurable per tenant |
| Encryption | AES-256-GCM at rest, TLS 1.3 in transit |
| PCI-DSS | Tokenization via payment gateways |
| GDPR | Full compliance (export, erasure, consent) |
| Audit Logging | Complete activity trail (AuditLog model) |
| Soft Delete | No hard deletes for critical data |
| RBAC | 9 default roles + custom |
| Feature Flags | Plan-based module access |

---

## 📱 Guest-Facing Applications

### PWA (Progressive Web App)

| Feature | Specification |
|---------|---------------|
| Installable | Works on any device |
| Languages | 15 languages |
| White-label | Custom branding |
| In-Room Portal | QR-based access |
| Digital Keys | QR code generation |

---

## 📊 API & Integration

### REST API

| Feature | Specification |
|---------|---------------|
| Routes | 614 |
| Versioning | URL-based (/v1) |
| Authentication | Session cookies + API Keys |
| Rate Limiting | Per tenant, user, endpoint |
| Idempotency | Supported via IdempotencyKey model |
| Webhooks | Event-driven with retry queue |
| Tenant Isolation | All queries scoped to tenantId |

### Mini-Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js | 3000 | Main application |
| Captive Redirect | 8888 | WiFi captive portal |
| Realtime | 3003 | Socket.IO real-time |
| Availability | 3002 | Room availability |
| FreeRADIUS Mgmt | 3010 | RADIUS management API |
| FreeRADIUS Server | 1812/1813 | RADIUS auth/acct |

---

## 🌍 Localization

### Supported Languages (15)

| Indian | Global |
|--------|--------|
| English (en) | Spanish (es) |
| Hindi (hi) | French (fr) |
| Bengali (bn) | German (de) |
| Tamil (ta) | Portuguese (pt) |
| Telugu (te) | Arabic (ar) |
| Marathi (mr) | Chinese (zh) |
| Gujarati (gu) | Japanese (ja) |
| Malayalam (ml) | |

---

## 📈 Performance & Scalability

| Metric | Target |
|--------|--------|
| Uptime SLA | 99.9% |
| API Response Time | < 200ms (p95) |
| Page Load Time | < 2s |
| Concurrent Users | 10,000+ |
| Transactions/Second | 1,000+ |

---

## 📋 System Requirements

### For On-Premise

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32+ GB |
| Storage | 100 GB SSD | 500+ GB SSD |
| Network | 100 Mbps | 1 Gbps |
| PostgreSQL | 17 | 17 |
| FreeRADIUS | v3.2.2+ | v3.2.7 |
| Bun | Latest | Latest |
| PM2 | Latest | Latest |

---

## 📞 Technical Support

| Channel | Contact |
|---------|---------|
| Sales | sales@cryptsk.com |
| Support | support@cryptsk.com |
| Documentation | docs.staysuite.io |

---

*Document Version: 3.0*
*Last Updated: May 2026*
*© 2026 Cryptsk Pvt Ltd*

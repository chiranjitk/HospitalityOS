# StaySuite Release Notes
## Version History

**Last Updated**: July 2025

---

## Version 2.1.0 — July 2025

### New Features

#### Billing Module Enhancements
- **City Ledger** — Account-based billing for corporate accounts and travel agents with invoice management, line items, and payment tracking
- **Commissions** — Travel agent commission management with configurable rules, automatic record creation, and payment processing
- **Night Audit** — Multi-step daily reconciliation process with audit step definitions, execution logging, and completion tracking
- **Posting Rules** — Automated posting rules with condition-based triggers for auto-charging folios (e.g., room charges, service fees)
- **Scheduled Charges** — Recurring charge automation with support for pause/resume, execution history tracking, and configurable schedules
- **Revenue Accounts** — Chart of accounts for revenue categorization across all billing categories

#### Housekeeping Module Enhancements
- **Laundry Management** — Complete laundry item catalog, order creation and tracking, per-item status management
- **Lost & Found** — Item reporting and tracking system with guest notification capability
- **Minibar Management** — Room-level minibar setup and configuration, consumption recording, automatic restocking alerts

#### PMS Module Enhancements
- **Travel Agents** — Travel agent management with contact details, commission rates, and booking source tracking
- **Package Plans** — Bundled room + service packages with component management and package-specific rates

#### Infrastructure
- **11 Mini-Services** — Expanded from 4 to 11 microservices including custom DHCP server, DNS resolver, RADIUS server, conntrack bridge, SNI parser, and DNS parser
- **Cron Job System** — 11 automated cron jobs for room posting, channel sync, scheduled charges, no-show detection, session engine, and more
- **Scheduled Charges API** — New endpoints for charge history (`/api/scheduled-charges/[id]/history`), pause (`/api/scheduled-charges/[id]/pause`), and resume (`/api/scheduled-charges/[id]/resume`)

### Platform Updates
- API Routes: 614 → 617
- Database Models: 294 (stable)
- React Components: 532
- Mini-Services: 4 → 11
- shadcn/ui Components: 51 → 56
- Seed file: `prisma/seed-final.ts` added for new feature seeding

### Bug Fixes
- FreeRADIUS dictionary path fix — Added `-D` flag for correct dictionary resolution
- Scheduled charges execution improvements

---

## Version 2.0.0 (May 2026)

### Major Update — Platform Scale-Up

StaySuite 2.0 represents a major platform expansion from the initial 1.0 release, delivering a production-grade hospitality operating system with comprehensive coverage of hotel operations.

### Scale Metrics

| Metric | v1.0 | v2.0 | Change |
|--------|------|------|--------|
| Database Models | 100+ | 294 | +194% |
| API Routes | 289 | 614 | +112% |
| React Components | 201 | 529 | +163% |
| Component Directories | 20+ | 44 | +120% |
| Navigation Modules | ~20 | 30 | +50% |
| API Route Directories | - | 134 | New |
| shadcn/ui Components | 51 | 51 | Stable |
| Supported Languages | 15 | 15 | Stable |

### Infrastructure Changes

| Component | v1.0 | v2.0 |
|-----------|------|------|
| Database | PostgreSQL 17 | PostgreSQL 17 |
| WiFi AAA | Basic RADIUS | FreeRADIUS v3.2.7 (compiled from source) |
| Runtime | Node.js | Bun |
| Frontend | Next.js 16 + React 18 | Next.js 16.1 + React 19 |
| Styling | Tailwind CSS 4 | Tailwind CSS 4 + shadcn/ui |
| State Management | Zustand | Zustand 5.0+ |
| Server Cache | Custom | TanStack Query 5.82+ |
| Forms | React Hook Form + Zod 3 | React Hook Form 7.60 + Zod 4 |

### New Modules

**Restaurant & POS** (expanded from 5 to 15 sub-features):
- Added: Room Service, Restaurant Reports, Recipes, Staff Assignment, Receipt Templates, POS Inventory, Menu Modifiers, Menu Variants, Table Layout, Reservations, Customer Display, Order Split, Order Discounts, Menu Image Upload

**Housekeeping** (expanded from 5 to 11 sub-features):
- Added: Inspection Checklists, Lost & Found, Minibar, Laundry, Housekeeping Automation

**WiFi** (expanded from 6 to 10 sub-features):
- Added: DHCP Server, DNS Server, Captive Portal, Firewall & Bandwidth, Content Filter, Gateway Diagnostics
- Full FreeRADIUS v3.2.7 with native PostgreSQL SQL module
- 6 WiFi plans (Free through Enterprise)

**Billing** (expanded from 6 to 15 sub-features):
- Added: Folio Transfer, Payment Plans, Credit Notes, Multi-Currency, Night Audit, City Ledger, Commissions, Posting Rules, Scheduled Charges

**Experience** (expanded from 5 to 13 sub-features):
- Added: Experience Catalog, Experience Bookings, Pricing & Availability, Vendor Management, Revenue Analytics, Calendar, Guest Feedback, Chat Transfer, Chat Attachment

**Front Desk** (expanded from 4 to 9 sub-features):
- Added: Registration Card, Express Kiosk, Kiosk Settings, Room Move, Auto-Assign, KYC Document Upload, Signature Pad, Key Card Manager, Kiosk Payment

**Bookings** (expanded from 4 to 6 sub-features):
- Added: No-Show Automation, Conflicts

**PMS** (expanded from 7 to 12 sub-features):
- Added: Room Rate Calendar, Room Out-of-Order, Package Plans, Floor Plan Editor, Room Image Gallery

**Guests** (expanded from 5 to 8 sub-features):
- Added: Guest Merge, WiFi Session History, Guest Journey

**New Standalone Modules:**
- Digital Advertising (4 sub-features)
- Events / MICE (4 sub-features)
- Smart Hotel / IoT (3 sub-features)
- Chain Management (3 sub-features)
- SaaS Billing (3 sub-features)
- Marketing (4 sub-features)
- Staff Management (6 sub-features)
- Security Center (5 sub-features)

**Enhanced Infrastructure:**
- PM2 process management for 4 services (Next.js, FreeRADIUS, Captive Redirect, Realtime)
- Captive portal redirect service (port 8888)
- Realtime WebSocket service (port 3003)
- FreeRADIUS compiled from source with PostgreSQL SQL module

### Database

- **PostgreSQL 17** is the exclusive database backend
- **294 Prisma models** covering all aspects of hotel operations
- Complete tenant isolation via `tenantId` on all models
- Soft delete with `deletedAt` on critical models
- UUID primary keys for all models

### Updated Demo Data

| Tenant | Properties |
|--------|------------|
| Royal Stay Hotels | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | - |

| User | Email | Role |
|------|-------|------|
| Rajesh Sharma | admin@royalstay.in | Admin |
| Priya Das | frontdesk@royalstay.in | Front Desk |
| Anita Roy | housekeeping@royalstay.in | Housekeeping |
| Platform Admin | platform@staysuite.com | Platform Admin |

---

## Version 1.0.0 (March 2026)

### Initial Release

StaySuite 1.0 was the first production release of the All-in-One Hospitality Operating System.

**Core Modules:**
- Property Management, Booking Engine, Guest Management, Front Desk
- Guest Experience, WiFi Management (basic RADIUS), Billing & Payments
- Channel Manager (OTA connections), Revenue Management, Housekeeping
- Reports & BI, AI Assistant, Automation, Admin

**Integrations:**
- Payment Gateways: Stripe, PayPal, Razorpay, Square, Adyen
- WiFi Gateways: 11+ vendors
- Door Locks: Assa Abloy, dormakaba, Salto, ONITY

**Security:**
- Custom session-based auth, 2FA (TOTP), RBAC (9 roles), Audit logging, GDPR compliance

---

## Version 0.9.0 (Beta — February 2026)

- Beta release for testing
- Core PMS functionality
- Basic booking engine
- Initial WiFi integration

## Version 0.8.0 (Alpha — January 2026)

- Alpha release
- Basic property management
- Guest profiles
- Front desk operations

---

## Upgrade Notes

### Upgrading from 2.0.0 to 2.1.0

```bash
# Pull the latest code
git pull origin main

# Install dependencies
bun install

# Generate Prisma client
npx prisma generate

# Sync schema to PostgreSQL 17
npx prisma db push

# Seed with new feature demo data (optional)
bun run db:seed-final
```

**Changes:**
- API routes expanded from 614 to 617
- Mini-Services expanded from 4 to 11
- React components increased from 529 to 532
- shadcn/ui components increased from 51 to 56
- FreeRADIUS dictionary path fix applied (add `-D` flag)
- New seed file `prisma/seed-final.ts` available

### Upgrading from 1.0.0 to 2.0.0

```bash
# Pull the latest code
git pull origin main

# Install dependencies
bun install

# Generate Prisma client
npx prisma generate

# Sync schema to PostgreSQL 17
npx prisma db push

# Seed with demo data (optional)
bun run db:seed
```

**Breaking Changes:**
- API routes expanded from 289 to 614
- New middleware and auth helpers
- FreeRADIUS now requires PostgreSQL SQL module (v3.2.7 compiled from source)
- React upgraded to 19, Next.js to 16.1

---

## Known Issues

### Version 2.1.0

| Issue | Workaround | Fix Version |
|-------|------------|-------------|
| Turbopack memory issues with many imports | Use `NEXT_DISABLE_TURBOPACK=1` (already set) | - |

### Version 2.0.0

| Issue | Workaround | Fix Version |
|-------|------------|-------------|
| Turbopack memory issues with many imports | Use `NEXT_DISABLE_TURBOPACK=1` (already set) | - |

---

## Changelog Format

```
## [version] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Deprecated
- Features to be removed

### Removed
- Features removed

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

## Support

- **Support**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

---

*© 2026 Cryptsk Pvt Ltd*

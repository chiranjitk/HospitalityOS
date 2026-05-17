# Bookings Module Overview — Bookings Management

## What is Bookings?

The Bookings module is the commercial engine of StaySuite. It manages the complete reservation lifecycle — from initial inquiry and calendar-based visual planning, through individual and group booking creation, to waitlist management, conflict resolution, no-show automation, and immutable audit trailing. Every revenue-generating interaction in StaySuite begins with a booking, making this module the bridge between PMS inventory (rooms, rates) and guest-facing operations (front desk, billing, housekeeping).

## Why This Module Exists

A hotel cannot sell rooms without a booking system. The Bookings module solves the following core business problems:

1. **Reservation Management** — Reservationists need to create, modify, and cancel bookings with proper validation, pricing engine integration, and conflict prevention.
2. **Visual Planning** — Staff need a calendar-based timeline view to see booking density, gaps, and patterns across properties and dates.
3. **Group Operations** — Tour operators, corporate clients, and event organizers need to book multiple rooms simultaneously with centralized contract and deposit management.
4. **Demand Capture** — When rooms are sold out, the waitlist captures potential revenue by tracking guests willing to book when cancellations occur.
5. **Conflict Prevention** — Double bookings, overbookings, and lock conflicts must be detected and resolved proactively to prevent guest dissatisfaction and revenue loss.
6. **No-Show Automation** — Unchecked-in guests must be identified automatically so rooms can be released for resale, reducing manual tracking overhead.
7. **Compliance & Debugging** — Every booking operation must be logged immutably for regulatory compliance, dispute resolution, security monitoring, and operational debugging.

---

## Entity Relationship Summary

```
GroupBooking (1) ──→ (N) Booking
                      │
                      ├──→ (1) Guest (primaryGuestId)
                      ├──→ (1) Property
                      ├──→ (1) RoomType
                      ├──→ (0..1) Room (assigned at check-in)
                      ├──→ (0..1) RatePlan
                      ├──→ (1) Folio (auto-created)
                      └──→ (N) BookingAuditLog

WaitlistEntry ──→ (1) Guest
WaitlistEntry ──→ (1) Property
WaitlistEntry ──→ (1) RoomType
WaitlistEntry ──→ (0..1) Booking (on conversion)

AuditLog ──→ (0..1) User
AuditLog ──→ (1) Tenant

Property ──→ noShowSettings (JSON column)
```

### Core Entity Flow

```
Calendar View → Create Booking (Individual or Group)
                        │
                        ├── Availability Check → Conflict Detection
                        │
                        ├── Confirmed → Check-in (Front Desk) → Folio
                        │
                        ├── Sold Out → Waitlist Entry
                        │
                        ├── Past Check-in Deadline → No-Show Detection
                        │
                        └── All Operations → Audit Log
```

### Key Relationships

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| `GroupBooking` | `Booking` | 1:N | A group contains multiple individual bookings |
| `Booking` | `Guest` | N:1 | Every booking has a primary guest |
| `Booking` | `Property` | N:1 | Every booking belongs to a property |
| `Booking` | `RoomType` | N:1 | Bookings specify a room type |
| `Booking` | `Room` | N:0..1 | Room assigned at check-in (nullable before) |
| `Booking` | `RatePlan` | N:0..1 | Bookings may reference a pricing plan |
| `Booking` | `Folio` | 1:1 | Auto-created folio for billing |
| `Booking` | `BookingAuditLog` | 1:N | Immutable per-booking audit trail |
| `WaitlistEntry` | `Guest` | N:1 | Waitlist entry belongs to a guest |
| `WaitlistEntry` | `Booking` | 1:0..1 | Optional linked booking on conversion |
| `AuditLog` | `User` | N:0..1 | System entries have no user |
| `AuditLog` | `Tenant` | N:1 | All logs are tenant-scoped |

---

## Business Flow

### 1. Calendar View → Booking Timeline

Staff open the Calendar View to see all bookings across properties. Date range filters, status filters, and search allow quick navigation to specific reservations. This is the operational "home base" for reservationists.

### 2. Create Booking → Individual or Group

From the calendar or directly, staff create bookings. Individual bookings are single room reservations. Group bookings are created via the Group Bookings page with centralized management (contacts, contracts, deposits).

### 3. Conflict Detection → Prevent Overbooking

Every booking creation checks for conflicts: double booking (same room, overlapping dates), room type overbooking (more bookings than rooms), and inventory lock conflicts. The Conflict Detection page provides a proactive scan of all active bookings.

### 4. Waitlist → Capture Sold-Out Demand

When a room type is fully booked, guests can be added to the waitlist. Entries are prioritized and auto-processed when rooms become available. This maximizes revenue by filling cancellation gaps.

### 5. No-Show → Release Rooms Quickly

The No-Show Automation module runs on a cron schedule to detect confirmed bookings past their check-in deadline. Auto-processing marks no-shows, applies penalties, and releases rooms for resale.

### 6. Audit Trail → Compliance & Debugging

Every booking operation (create, modify, cancel, check-in, check-out, conflict resolve) is logged immutably to the Audit Log. The Audit Logs page provides query, statistics, and export capabilities.

---

## Cross-Module Relationships

### PMS Module

| PMS Entity | Booking Usage |
|------------|---------------|
| `Property` | Every booking belongs to a property; check-in/out times define booking windows |
| `RoomType` | Bookings specify room type preference; availability checked before creation |
| `Room` | Assigned at check-in; conflict detection checks per-room overlaps |
| `RatePlan` | Determines nightly rate; pricing engine calculates total based on rate plan rules |
| `PriceOverride` | Date-specific rate adjustments applied during pricing calculation |
| `InventoryLock` | Booking creation checks for maintenance/event/session locks |
| `OverbookingSlot` | Consumed when booking exceeds physical room count |

### Front Desk Module

| Booking Entity | Front Desk Usage |
|----------------|------------------|
| `Booking` | Check-in assigns room, sets status to `checked_in`; check-out releases room |
| `Booking.actualCheckIn` | Timestamp recorded at check-in |
| `Booking.actualCheckOut` | Timestamp recorded at check-out |
| `Booking.portalToken` | Pre-arrival online check-in link |
| `Booking.kycStatus` | KYC verification progress tracked during check-in |

### Guests Module

| Booking Entity | Guest Usage |
|----------------|-------------|
| `Booking.primaryGuestId` | Links booking to guest profile |
| `Guest.loyaltyTier` | May influence rate or upgrade eligibility |
| `Guest.preferences` | Applied during booking creation |
| `Guest.totalStays` | Incremented via `GuestStay` on booking completion |

### Billing / Financials Module

| Booking Entity | Billing Usage |
|----------------|---------------|
| `Folio` | Auto-created on booking with room charge line item |
| `Booking.totalAmount` | Posted as initial folio balance |
| `Booking.roomRate` | Per-night rate used for daily room posting |
| `Booking.currency` | Determines folio currency |
| `Booking.guaranteeType` | Deposit/credit card requirements tracked |
| `GroupBooking.depositAmount` | Group deposit tracking and payment |

### Channel Manager / OTA Integration

| Booking Entity | Channel Usage |
|----------------|---------------|
| `Booking.source` | Tracks booking origin (direct, booking.com, expedia, etc.) |
| `Booking.channelId` | References the channel mapping |
| `Booking.externalRef` | OTA reservation ID for two-way sync |
| `Booking.idempotencyKey` | Prevents duplicate channel bookings |

### Housekeeping Module

| Booking Entity | Housekeeping Usage |
|----------------|-------------------|
| `Booking.checkIn` | Triggers room preparation workflow |
| `Booking.checkOut` | Room marked dirty, housekeeping task created |
| `Booking.specialRequests` | Passed to housekeeping for room preparation |

---

## Page Index

The Bookings module consists of 6 pages:

| # | Page | File | Section ID | Primary Purpose |
|---|------|------|------------|-----------------|
| 01 | Calendar View | `01-calendar-view.md` | `bookings-calendar` | Visual timeline of all bookings |
| 02 | Group Bookings | `02-group-bookings.md` | `bookings-groups` | Multi-room group/tour booking management |
| 03 | Waitlist | `03-waitlist.md` | `bookings-waitlist` | Manage demand when rooms are sold out |
| 04 | Conflicts | `04-conflicts.md` | `bookings-conflicts` | Detect and resolve booking conflicts |
| 05 | No-Show Automation | `05-no-show-automation.md` | `bookings-no-show` | Automated no-show detection and handling |
| 06 | Audit Logs | `06-audit-logs.md` | `bookings-audit` | Immutable system operations trail |

---

## Module Architecture Notes

- **Tenant isolation**: All booking data is scoped to a `tenantId`. Multi-property tenants manage bookings across properties from a single account.
- **Serializable transactions**: Booking creation uses PostgreSQL serializable isolation to prevent double-booking under high concurrency.
- **Idempotency keys**: External channel bookings use `idempotencyKey` to prevent duplicate creation on retries.
- **Pricing engine integration**: Bookings can trigger the pricing engine (`usePricingEngine: true`) for automatic rate calculation based on rate plans, promotions, and seasonal rules.
- **Soft deletes**: Bookings use `deletedAt` for soft deletion — records are never physically removed.
- **WebSocket events**: Booking creation, modification, and cancellation emit real-time events consumed by Front Desk, Dashboard, and other modules.
- **Automation hooks**: Booking creation fires `booking.created` automation events for workflow triggers (notifications, tasks, etc.).
- **Correlation IDs**: Audit logs support `correlationId` for tracing related operations across modules.

# Front Desk Module Overview — Guest Operations Hub

## What is Front Desk?

The Front Desk module is the core guest-facing operations hub of StaySuite. It manages every critical touchpoint in the guest lifecycle — from the initial check-in and room assignment, through in-stay room moves and registration card management, to check-out and folio settlement. It also powers guest self-service via express kiosks and provides a visual room grid for real-time property status monitoring. Every guest who walks through the hotel doors interacts with systems built in this module.

## Why This Module Exists

A hotel's front desk is the nerve center of daily operations. The Front Desk module solves the following core business problems:

1. **Check-In Processing** — Front desk agents need a streamlined workflow to verify guest identity, assign rooms, issue key cards, and confirm check-in — all within minutes of a guest arriving.
2. **Check-Out & Settlement** — Guests need a smooth departure with folio review, payment processing, key card return, and room release — preventing bottlenecks during peak check-out hours.
3. **Walk-In Management** — Hotels must handle walk-in guests efficiently with instant room search, rate selection, guest registration, and immediate check-in — capturing revenue from unbooked demand.
4. **Room Visibility** — Staff need a real-time visual overview of all room statuses (available, occupied, dirty, cleaning, out of order) for efficient operations and quick decision-making.
5. **Intelligent Room Assignment** — Hotels need AI-powered room assignment that considers guest preferences, stay duration, room features, and upgrade opportunities — maximizing guest satisfaction and revenue.
6. **Registration Compliance** — Legal and regulatory requirements demand guest registration cards with complete personal details, companions, vehicle info, and digital signatures.
7. **Self-Service Kiosks** — Reducing front desk wait times requires self-service check-in/check-out kiosks that guests can use independently, with configurable branding and behavior.
8. **In-Stay Flexibility** — Guests may request room moves during their stay; the system must handle reason tracking, rate difference calculation, and room status transitions across both rooms.
9. **Cross-Module Coordination** — Every front desk action triggers downstream effects in Housekeeping, Billing, and PMS — the module must orchestrate these transitions seamlessly.

---

## Entity Relationship Summary

```
Booking (1) ──→ Check-In (Front Desk)
  │                 │
  │                 ├──→ Room Assignment (auto or manual)
  │                 ├──→ Key Card Issuance
  │                 ├──→ Registration Card (PDF)
  │                 └──→ Folio Activation
  │
  ├──→ Check-Out (Front Desk)
  │       ├──→ Folio Settlement (Billing)
  │       ├──→ Key Card Return
  │       └──→ Room Status → dirty (Housekeeping)
  │
  ├──→ Room Move (in-stay)
  │       ├──→ Rate Difference (Billing)
  │       ├──→ Old Room → dirty (Housekeeping)
  │       └──→ New Room → occupied
  │
  └──→ Walk-In (instant create + check-in)

Kiosk Session ──→ Booking (self-service check-in/out)
  │
  └──→ Kiosk Settings (branding, behavior, terms)

Room Grid ──→ Room (real-time status visualization)
  │
  └──→ Housekeeping Status (cleaning progress)
```

### Core Entity Flow

```
Arrival → Check-In → Room Assignment → Key Card → Registration Card
                                │
                    ┌───────────┴───────────┐
                    │                       │
              Normal Stay              Room Move
                    │                       │
              Check-Out ←─────── New Room Assigned
                    │
              Folio Settlement
                    │
              Room → Dirty (Housekeeping)
```

### Key Relationships

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| `Booking` | `Room` | N:0..1 | Assigned at check-in via front desk |
| `Booking` | `KeyCard` | 1:N | Multiple key cards can be issued per stay |
| `Booking` | `RegistrationCard` | 0..1:1 | Optional registration card PDF |
| `Booking` | `RoomMove` | 1:N | Multiple room moves during a stay |
| `KioskSession` | `Booking` | N:1 | Kiosk session linked to a booking |
| `KioskSettings` | `Property` | N:1 | Per-property kiosk configuration |
| `Room` | `RoomGrid` | 1:1 | Every room appears on the visual grid |
| `AutoAssign` | `Booking` | N:1 | AI assignment links to a booking |

---

## Business Flow

### 1. Pre-Arrival → Online Check-In (Optional)

Guests may complete online check-in via a pre-arrival portal link (`booking.portalToken`). This populates KYC status and allows for pre-room assignment before physical arrival.

### 2. Check-In → Room Assignment → Key Card

Upon arrival, the front desk agent searches the booking, verifies guest ID, assigns a room (auto or manual), issues key cards, generates the registration card, and confirms check-in. The room status transitions from `available` to `occupied`, and housekeeping is notified.

### 3. Walk-In → Instant Registration + Check-In

For walk-in guests with no prior booking, the agent registers the guest, searches available rooms, selects a rate, creates the booking, assigns the room, and checks the guest in — all in one streamlined flow.

### 4. In-Stay → Room Move

If a guest requests a room change (maintenance, upgrade, preference), the agent creates a room move request. The system calculates rate differences, releases the old room to `dirty` status, and assigns the new room as `occupied`.

### 5. Check-Out → Settlement → Room Release

At departure, the agent reviews the folio, processes outstanding payments, collects key cards, and confirms check-out. The room transitions to `dirty`, triggering a housekeeping task.

### 6. Self-Service → Kiosk Check-In/Check-Out

Guests can bypass the front desk entirely using the express kiosk. They enter their booking code, verify their identity, and complete check-in or check-out — including optional payment processing for folio settlement.

---

## Cross-Module Relationships

### PMS Module

| PMS Entity | Front Desk Usage |
|------------|------------------|
| `Property` | Check-in/check-out times, property settings, kiosk branding |
| `Room` | Room assignment at check-in; status transitions (available → occupied → dirty) |
| `RoomType` | Room type matching during auto-assignment; upgrade suggestions |
| `RatePlan` | Rate calculation during walk-in booking; rate difference on room moves |
| `FloorPlan` | Visual room grid uses floor plan data for room positioning |
| `RoomTypeChange` | Room type upgrade/downgrade integration |

### Bookings Module

| Booking Entity | Front Desk Usage |
|----------------|------------------|
| `Booking` | Check-in sets status to `checked_in`; check-out sets to `checked_out` |
| `Booking.actualCheckIn` | Timestamp recorded at check-in |
| `Booking.actualCheckOut` | Timestamp recorded at check-out |
| `Booking.portalToken` | Pre-arrival online check-in link |
| `Booking.kycStatus` | KYC verification progress during check-in |
| `Booking.specialRequests` | Passed to housekeeping on check-in |
| `Booking.isWalkIn` | Flag for walk-in bookings |

### Guests Module

| Guest Entity | Front Desk Usage |
|--------------|------------------|
| `Guest` | Identity verification, profile lookup, walk-in registration |
| `Guest.idDocument` | ID verification during check-in (mandatory) |
| `Guest.preferences` | Applied during room assignment (floor, view, bed type) |
| `Guest.loyaltyTier` | VIP handling, upgrade eligibility |
| `Guest.isVip` | VIP badge, priority check-in, complimentary upgrades |

### Billing / Financials Module

| Billing Entity | Front Desk Usage |
|----------------|------------------|
| `Folio` | Activated at check-in; reviewed at check-out |
| `Folio.balance` | Must be zero or settled before check-out |
| `Payment` | Deposit collection at check-in; final settlement at check-out |
| `RegistrationCard` | Generated with billing details included |
| `RoomCharge` | Rate difference posted on room move |

### Housekeeping Module

| Housekeeping Entity | Front Desk Usage |
|--------------------|------------------|
| `Room.status` | Check-out sets room to `dirty`; housekeeping picks up cleaning task |
| `RoomMove` | Old room released to `dirty` on room move |
| `Task` | Cleaning task auto-created on check-out |
| `Task.priority` | VIP guests get high-priority room preparation |

### Rooms / Inventory Module

| Inventory Entity | Front Desk Usage |
|------------------|------------------|
| `Room.status` | Real-time status drives room grid visualization |
| `Room.features` | Considered during auto-assignment scoring |
| `Room.floor` | Floor-based filtering on room grid |
| `Availability` | Checked before walk-in booking and room assignment |

---

## Page Index

The Front Desk module consists of 9 pages:

| # | Page | File | Section ID | Primary Purpose |
|---|------|------|------------|-----------------|
| 01 | Check-In | `01-checkin.md` | `frontdesk-checkin` | Guest arrival and room assignment |
| 02 | Check-Out | `02-checkout.md` | `frontdesk-checkout` | Guest departure and folio settlement |
| 03 | Walk-In Booking | `03-walkin-booking.md` | `frontdesk-walkin` | Instant on-the-spot booking and check-in |
| 04 | Room Grid | `04-room-grid.md` | `frontdesk-room-grid` | Visual real-time room status overview |
| 05 | Room Assignment | `05-room-assignment.md` | `frontdesk-room-assign` | AI-powered and manual room assignment |
| 06 | Registration Card | `06-registration-card.md` | `frontdesk-reg-card` | Guest registration card PDF generation |
| 07 | Express Kiosk | `07-express-kiosk.md` | `frontdesk-kiosk` | Self-service guest check-in/check-out |
| 08 | Kiosk Settings | `08-kiosk-settings.md` | `frontdesk-kiosk-settings` | Kiosk appearance and behavior configuration |
| 09 | Room Move | `09-room-move.md` | `frontdesk-room-move` | In-stay room transfer management |

---

## Test Coverage

The Front Desk module has 10 test suites:

| # | Test Suite | File | Description |
|---|-----------|------|-------------|
| 01 | Check-In | `01-checkin.test.ts` | Full check-in workflow including ID verification, room assignment, key card |
| 02 | Check-Out | `02-checkout.test.ts` | Check-out workflow with folio settlement and room release |
| 03 | Walk-In Booking | `03-walkin-booking.test.ts` | Instant guest registration, booking creation, and check-in |
| 04 | Room Grid | `04-room-grid.test.ts` | Room status visualization, filtering, and details |
| 05 | Room Assignment | `05-room-assignment.test.ts` | Auto-assign algorithm, manual override, preference matching |
| 06 | Registration Card | `06-registration-card.test.ts` | PDF generation with guest details and signature |
| 07 | Express Kiosk | `07-express-kiosk.test.ts` | Self-service kiosk sessions, check-in, check-out |
| 08 | Kiosk Settings | `08-kiosk-settings.test.ts` | Kiosk configuration, branding, feature toggles |
| 09 | Room Move | `09-room-move.test.ts` | Room transfer, rate difference, history tracking |
| 10 | Cross-Module Verification | `10-cross-module-verification.test.ts` | End-to-end validation across PMS, Bookings, Billing, Housekeeping |

> **Sequential Dependency**: Tests 01–03 must run in order. Test 01 (check-in) creates the checked-in state required by test 02 (check-out). Test 03 (walk-in) exercises the complete walk-in lifecycle independently.

---

## API Endpoint Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `PUT` | `/api/bookings/[id]` | Update booking status (check-in, check-out) |
| `POST` | `/api/bookings/early-checkin` | Request early check-in before standard time |
| `POST` | `/api/bookings/late-checkout` | Request late check-out past standard time |
| `POST` | `/api/bookings/room-move` | Move guest to a different room |
| `GET` | `/api/bookings/room-move/history` | Get room move history for a booking |
| `POST` | `/api/frontdesk/auto-assign` | AI-powered automatic room assignment |
| `GET` | `/api/frontdesk/suggest-room` | Get room assignment suggestions with scoring |
| `GET` | `/api/frontdesk/kiosk-session` | Retrieve or create kiosk session |
| `POST` | `/api/frontdesk/kiosk-checkin` | Self-service kiosk check-in |
| `POST` | `/api/frontdesk/kiosk-checkout` | Self-service kiosk check-out |
| `GET` | `/api/frontdesk/kiosk-payment` | Get kiosk payment status |
| `POST` | `/api/frontdesk/kiosk-payment` | Process payment via kiosk |
| `GET` | `/api/frontdesk/kiosk-settings` | Get kiosk configuration (admin) |
| `PUT` | `/api/frontdesk/kiosk-settings` | Update kiosk configuration (admin) |
| `GET` | `/api/kiosk/public-settings` | Get kiosk configuration (public, no auth) |
| `GET` | `/api/rooms` | List all rooms with status (room grid) |
| `GET` | `/api/rooms/available` | Search available rooms (walk-in, assignment) |
| `GET` | `/api/rooms/[id]` | Get room details with full status |
| `POST` | `/api/key-cards` | Issue a new key card |
| `PUT` | `/api/key-cards` | Return/deactivate a key card |
| `POST` | `/api/guests` | Register a new guest (walk-in) |
| `GET` | `/api/folio/registration-card` | Generate registration card PDF (GET) |
| `POST` | `/api/folio/registration-card` | Generate registration card PDF (POST) |

---

## Module Architecture Notes

- **Tenant isolation**: All front desk operations are scoped to a `tenantId`. Multi-property front desk staff can operate across properties from a single interface.
- **Real-time room status**: Room status changes emit WebSocket events consumed by the Room Grid, Housekeeping, and Dashboard modules for live updates.
- **Sequential test dependency**: Tests 01–03 must execute in order because check-in creates state that check-out depends on. Tests 04–10 can run independently.
- **Kiosk public access**: Kiosk endpoints use a separate public route that does not require authentication. Session tokens provide security instead.
- **PDF generation**: Registration cards are generated server-side using a PDF engine and stored for audit purposes.
- **Rate difference handling**: Room moves calculate the rate difference between old and new rooms and auto-post to the guest's folio.
- **Key card lifecycle**: Key cards are issued at check-in and deactivated at check-out. Multiple key cards can be issued per booking for companions.
- **Auto-assign scoring**: The AI room assignment engine scores rooms based on guest preferences, stay duration, room features, floor proximity, and upgrade revenue potential.

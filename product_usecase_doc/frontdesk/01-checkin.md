# Check-In

> **Section ID**: `frontdesk-checkin`

## Purpose

The Check-In page is the primary guest arrival interface for front desk agents. It provides a streamlined workflow to process arriving guests — from booking lookup and identity verification, through room assignment (automatic or manual), key card issuance, and check-in confirmation. This page is the most frequently used front desk operation and must be fast, intuitive, and error-resistant to handle peak arrival periods efficiently.

The page solves the business problem of transforming a confirmed reservation into an active in-house stay, triggering downstream operations across Housekeeping (room preparation), Billing (folio activation), and PMS (room status update) — all while collecting mandatory compliance data (ID verification, registration details).

## Key Features

- **Booking Lookup**: Search by confirmation code (`SS-XXXXXX`), guest name, phone number, or email to quickly locate the arriving guest's booking
- **Identity Verification**: Scan or manually enter guest ID document details — passport, national ID, or driver's license — with mandatory verification before check-in
- **Auto Room Assignment**: AI-powered room assignment that considers guest preferences, stay duration, room features, and upgrade opportunities — one-click assignment
- **Manual Room Assignment**: Override auto-assignment to pick a specific room from available inventory with visual room grid integration
- **Key Card Issuance**: Generate one or more key cards for the guest and registered companions — encoded with room number and stay dates
- **Special Requests Review**: View and acknowledge guest special requests (extra pillows, late checkout, anniversary) before confirming check-in
- **Early Check-In Request**: Process early check-in requests outside the standard check-in time window, with manager approval workflow if required
- **VIP Handling**: Automatic VIP detection with priority room assignment, complimentary upgrade suggestions, and welcome amenity triggers
- **Deposit Collection**: Capture or verify security deposit (cash or card authorization) before releasing the room key
- **Pre-Arrival Status**: Display pre-arrival online check-in progress — showing which KYC fields the guest has already completed

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/bookings` | Search for arriving bookings (by name, code, date) |
| `GET` | `/api/bookings/[id]` | Get full booking details with guest, room type, folio |
| `PUT` | `/api/bookings/[id]` | Update booking status to `checked_in`, assign room |
| `POST` | `/api/frontdesk/auto-assign` | AI-powered automatic room assignment |
| `GET` | `/api/frontdesk/suggest-room` | Get ranked room suggestions with scoring breakdown |
| `POST` | `/api/key-cards` | Issue a new key card for the booking |
| `POST` | `/api/bookings/early-checkin` | Request or approve early check-in |
| `GET` | `/api/rooms/available` | List available rooms for manual assignment |
| `GET` | `/api/folio/registration-card` | Generate registration card PDF |
| `GET` | `/api/guests/[id]` | Retrieve guest profile with ID documents |

### Request Body (PUT /api/bookings/[id] — Check-In)

```json
{
  "status": "checked_in",
  "roomId": "uuid-of-assigned-room",
  "actualCheckIn": "2025-01-15T14:30:00Z",
  "checkedInBy": "uuid-of-staff-member",
  "kycStatus": "verified",
  "idVerificationMethod": "passport_scan",
  "keyCardsIssued": 2,
  "specialRequestsAcknowledged": true,
  "depositCollected": true,
  "depositAmount": 200.00,
  "depositMethod": "card_authorization"
}
```

### Response (Auto-Assign)

```json
{
  "suggestedRoom": {
    "roomId": "uuid",
    "roomNumber": "305",
    "floor": 3,
    "roomType": "Deluxe King",
    "score": 0.92,
    "scoreBreakdown": {
      "preferenceMatch": 0.95,
      "floorProximity": 0.88,
      "stayDurationFit": 0.90,
      "upgradeRevenue": 0.00,
      "featureMatch": 0.95
    },
    "reason": "Best match for guest preferences (high floor, king bed, city view)"
  },
  "alternatives": [
    { "roomId": "uuid", "roomNumber": "408", "score": 0.87, "roomType": "Deluxe King" },
    { "roomId": "uuid", "roomNumber": "210", "score": 0.79, "roomType": "Standard Queen" }
  ]
}
```

## Business Logic

### Check-In Time Restrictions

| Rule | Description |
|------|-------------|
| **Standard check-in time** | Defined per property (typically 3:00 PM / 15:00) |
| **Early check-in** | Before standard time; requires manager approval if more than 2 hours early |
| **Next-day check-in** | Guests arriving after midnight are treated as early check-in for the next day |
| **No future check-in** | Cannot check in for a date beyond the booking's scheduled check-in date |

### Deposit Requirements

| Guest Type | Deposit Requirement |
|------------|-------------------|
| Standard | Property-configured amount (e.g., $200) or credit card authorization |
| VIP / Loyalty Gold+ | Deposit waived |
| Corporate (guaranteed) | Deposit waived if company guarantee is on file |
| Walk-in | Full stay amount or credit card authorization required |

### ID Verification (Mandatory)

- All guests must present a valid government-issued photo ID
- Accepted documents: passport, national ID card, driver's license
- For international guests, passport is required
- ID details are stored encrypted in the guest profile
- `kycStatus` is set to `verified`, `partial`, or `pending`
- Check-in cannot proceed without `kycStatus: verified`

### VIP Handling

| VIP Level | Auto Actions |
|-----------|-------------|
| **Platinum** | Priority room assignment, complimentary suite upgrade, welcome amenity, late checkout auto-approved |
| **Gold** | Priority room assignment, upgrade suggestion shown, welcome amenity |
| **Silver** | Standard room assignment, welcome letter |
| **Standard** | Standard processing |

## Cross-Module Dependencies

| Module | Trigger | Effect |
|--------|---------|--------|
| **PMS — Rooms** | Room assigned at check-in | `Room.status` changes from `available` to `occupied` |
| **Billing — Folio** | Check-in confirmed | Folio activated, initial room charge posted |
| **Housekeeping** | Room occupied | Room removed from available cleaning queue; any pre-arrival cleaning marked complete |
| **Guests** | ID verified | Guest profile updated with ID document details |
| **Dashboard** | Check-in completed | Live arrival counter incremented, occupancy updated |
| **Kiosk** | Pre-arrival check-in | If guest used online check-in, data is pre-populated |

## User Flow

1. **Search Booking** — Enter confirmation code, guest name, or phone number in the search bar
2. **Review Booking** — Verify dates, room type, guest count, special requests, and source (direct, OTA)
3. **Verify Guest ID** — Scan or enter ID document; system validates and sets `kycStatus: verified`
4. **Assign Room** — Click "Auto Assign" for AI suggestion or manually select from room grid
5. **Review Suggestion** — See scored room recommendation with alternatives; accept or override
6. **Issue Key Cards** — Specify number of key cards (guest + companions); cards encoded and printed
7. **Collect Deposit** — Process cash deposit or card authorization; amount based on guest type
8. **Acknowledge Special Requests** — Review and confirm awareness of special requests
9. **Generate Registration Card** — System auto-generates registration card PDF with guest details
10. **Confirm Check-In** — Click "Check In" — booking status updated, room occupied, folio activated

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full check-in operations, override restrictions |
| Manager | `frontdesk.manage` | All check-in operations, approve early check-ins and upgrades |
| Front Desk Agent | `frontdesk.manage` | Standard check-in; early check-in requires manager approval |
| Night Auditor | `frontdesk.manage` | Standard check-in; next-day check-in processing |
| Reservationist | `bookings.view` | Read-only booking access; no check-in capability |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Booking not found | `BOOKING_NOT_FOUND` | Verify confirmation code; search by guest name instead |
| Room not available | `NO_ROOMS_AVAILABLE` | All rooms occupied; offer waitlist or nearby property |
| Missing ID verification | `KYC_REQUIRED` | Guest must present valid ID before check-in can proceed |
| Deposit not collected | `DEPOSIT_REQUIRED` | Process deposit or card authorization before room key release |
| Check-in before allowed time | `EARLY_CHECKIN_REQUIRES_APPROVAL` | Request manager approval or ask guest to return at standard time |
| Booking already checked in | `ALREADY_CHECKED_IN` | Booking status is already `checked_in`; direct to room |
| Booking cancelled | `BOOKING_CANCELLED` | Cannot check in to a cancelled booking; offer new booking |
| Room type mismatch | `ROOM_TYPE_UNAVAILABLE` | Requested room type sold out; offer alternative type or upgrade |

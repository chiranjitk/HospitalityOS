# Walk-In Booking

> **Section ID**: `frontdesk-walkin`

## Purpose

The Walk-In Booking page enables front desk agents to create bookings on-the-spot for guests who arrive without a prior reservation. This is a critical revenue capture feature — walk-in guests represent immediate, unbooked demand that would otherwise be lost. The page combines guest registration, room availability search, rate selection, booking creation, and immediate check-in into a single streamlined workflow, minimizing the time from guest arrival to room key handover.

The page solves the business problem of efficiently converting walk-in traffic into revenue while maintaining data quality (complete guest profiles, proper room assignment, folio creation) and compliance (ID verification, registration card).

## Key Features

- **Quick Guest Registration**: Create a new guest profile on the fly — name, contact, ID document, address — with minimal required fields for speed
- **Room Availability Search**: Real-time search of available rooms filtered by date range, room type, occupancy, and features — same inventory engine as online booking
- **Rate Selection**: Display available rate plans for the selected room type (BAR, corporate, promotional) with per-night breakdown and total calculation
- **Instant Booking Creation**: Create and confirm the booking in a single step with automatic folio creation and pricing engine integration
- **Immediate Check-In**: Transition directly from booking creation to check-in — assign room, issue key cards, verify ID — without navigating to a separate page
- **Companion Registration**: Add additional guests (companions) with basic details for key card issuance and registration card
- **Special Requests**: Capture any special requests during registration — passed to housekeeping for room preparation
- **Walk-In Rate Override**: Apply walk-in-specific rate adjustments (typically BAR + 10–20% premium for on-demand booking)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/guests` | Register a new guest profile (walk-in guest) |
| `POST` | `/api/bookings` | Create a new booking with pricing and folio |
| `GET` | `/api/rooms/available` | Search available rooms for the requested dates |
| `PUT` | `/api/bookings/[id]` | Assign room and update status to `checked_in` |
| `POST` | `/api/frontdesk/auto-assign` | Auto-assign best available room |
| `POST` | `/api/key-cards` | Issue key cards for the booking |
| `GET` | `/api/folio/registration-card` | Generate registration card PDF |
| `GET` | `/api/bookings/[id]` | Retrieve created booking with full details |

### Request Body (POST /api/guests — Walk-In Registration)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@email.com",
  "phone": "+1234567890",
  "idType": "passport",
  "idNumber": "AB1234567",
  "idExpiry": "2030-06-15",
  "address": "123 Main St, City, Country",
  "isWalkIn": true,
  "source": "walk_in"
}
```

### Request Body (POST /api/bookings — Walk-In Booking)

```json
{
  "primaryGuestId": "uuid-of-registered-guest",
  "propertyId": "uuid-of-property",
  "roomTypeId": "uuid-of-room-type",
  "roomId": "uuid-of-assigned-room",
  "ratePlanId": "uuid-of-rate-plan",
  "checkIn": "2025-01-15T15:00:00Z",
  "checkOut": "2025-01-18T11:00:00Z",
  "adults": 2,
  "children": 0,
  "source": "walk_in",
  "isWalkIn": true,
  "specialRequests": "Late arrival, extra towels",
  "guaranteeType": "credit_card",
  "usePricingEngine": true
}
```

## Business Logic

### Walk-In Rate Strategy

| Condition | Rate Applied |
|-----------|-------------|
| Standard availability | BAR (Best Available Rate) + walk-in premium (10–20%) |
| Low occupancy (<40%) | BAR only (no premium to encourage walk-ins) |
| High occupancy (>90%) | BAR + premium (up to 30%); highest available rate plan |
| Sold out for requested room type | Suggest alternative room type or deny walk-in |

### Deposit Requirements for Walk-Ins

| Payment Method | Requirement |
|----------------|-------------|
| Credit card | Full stay amount pre-authorized at check-in |
| Cash | Full stay amount collected upfront; no refund on early departure |
| Corporate guarantee | Authorization letter required; net-30 terms applied |
| Debit card | Full stay amount held; may take 5–7 days to release |

### Availability Validation

1. **Room type check**: Count available rooms of requested type for the date range; reject if zero
2. **Occupancy check**: Verify total guests (adults + children) do not exceed `RoomType.maxOccupancy`
3. **Inventory lock check**: Verify no active maintenance or event locks conflict with dates
4. **Overbooking check**: If overbooking is enabled, check if overbooking slots are available
5. **Rate plan validation**: Ensure selected rate plan is active and valid for the date range

### Walk-In vs. Standard Booking

| Aspect | Walk-In | Standard Booking |
|--------|---------|-----------------|
| Guest profile | Created on the spot | Pre-existing |
| Rate | BAR + premium | Negotiated / promotional |
| Deposit | Full stay required | Per guarantee policy |
| Check-in | Immediate | Scheduled future date |
| Source tracking | `walk_in` | `direct`, `ota`, etc. |
| Confirmation | Immediate | Email + SMS |

## Cross-Module Dependencies

| Module | Trigger | Effect |
|--------|---------|--------|
| **Guests** | Guest registration | New guest profile created with `source: walk_in` |
| **PMS — Rooms** | Room assigned | `Room.status` → `occupied`; availability reduced |
| **PMS — Rate Plans** | Rate selected | Rate plan applied with walk-in premium |
| **Bookings** | Booking created | New booking with `isWalkIn: true`; folio auto-created |
| **Billing — Folio** | Check-in completed | Folio activated; initial room charge posted |
| **Housekeeping** | Room occupied | Room preparation flagged; special requests forwarded |
| **Dashboard** | Walk-in recorded | Walk-in counter incremented; live occupancy updated |
| **Revenue** | Rate applied | Walk-in revenue tracked separately for yield analysis |

## User Flow

1. **Start Walk-In** — Click "Walk-In" button from front desk dashboard or room grid
2. **Register Guest** — Enter guest name, contact, and ID details; system creates guest profile
3. **Search Available Rooms** — Select dates (default: today → tomorrow); filter by room type and features
4. **Select Room & Rate** — Choose from available rooms; system shows rate options with total
5. **Review & Confirm** — Display booking summary: guest, room, dates, rate, total, special requests
6. **Collect Deposit** — Process payment authorization for full stay amount
7. **Assign Room** — Auto-assign best room or manually select; room locked to prevent double-assignment
8. **Check-In** — Verify ID, issue key cards, generate registration card
9. **Confirm** — Guest receives room key and welcome information

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full walk-in operations, rate override |
| Manager | `frontdesk.manage` | All walk-in operations, approve rate discounts |
| Front Desk Agent | `frontdesk.manage` | Create walk-in bookings with standard rates only |
| Night Auditor | `frontdesk.manage` | Walk-in processing during overnight hours |
| Receptionist | `frontdesk.view` | View-only; cannot create bookings |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| No rooms available | `SOLD_OUT` | No rooms available for requested dates; suggest alternative dates or room types |
| Guest already exists | `GUEST_DUPLICATE` | Link to existing guest profile instead of creating new one |
| Invalid ID document | `INVALID_ID` | Guest must provide valid government-issued ID |
| Payment declined | `PAYMENT_DECLINED` | Retry with different payment method |
| Rate plan inactive | `RATE_PLAN_INACTIVE` | Select an active rate plan; system shows only active options |
| Occupancy exceeded | `OCCUPANCY_EXCEEDED` | Guest count exceeds room capacity; suggest larger room type |
| Minimum stay required | `MIN_STAY_REQUIRED` | Rate plan requires longer stay; show alternative rates |

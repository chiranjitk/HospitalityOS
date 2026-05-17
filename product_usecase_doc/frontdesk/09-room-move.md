# Room Move

> **Section ID**: `frontdesk-room-move`

## Purpose

The Room Move page manages the process of transferring a guest from one room to another during their stay. Guests may request room moves for various reasons — noise complaints, maintenance issues, upgrade requests, room type changes, or simply a preference for a different location. The page handles the complete room move lifecycle: creating the move request, selecting the new room, calculating rate differences, transitioning both room statuses, and recording the move history for audit and billing purposes.

The page solves the business problem of coordinating room moves across multiple systems. A room move affects the old room (release to housekeeping), the new room (occupy from available), the billing folio (rate difference posting), and housekeeping priorities (both rooms need attention). Without a dedicated room move workflow, agents must manually update each system, increasing the risk of data inconsistency and operational errors.

## Key Features

- **Room Move Request**: Create a formal room move request linked to a booking with reason, urgency level, and requested room type
- **Reason Tracking**: Standardized move reasons (guest request, maintenance, upgrade, downgrade, availability, other) for analytics and reporting
- **Rate Difference Calculation**: Automatic calculation of the rate difference between old and new rooms, posted to the guest's folio
- **Room Selection**: Search and select the new room from available inventory; system validates compatibility (occupancy, dates, features)
- **Dual Room Transition**: Old room transitions to `dirty` status; new room transitions to `occupied` status — both updated atomically
- **Move History**: Complete audit trail of all room moves for a booking — old room, new room, reason, rate difference, timestamp, staff member
- **Key Card Reissuance**: Automatic deactivation of old room key cards and issuance of new key cards for the new room
- **Housekeeping Coordination**: Old room flagged for cleaning with priority; new room marked as occupied
- **Guest Notification**: Optional notification to guest (in-room display, SMS, or app push) confirming the room move

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/bookings/room-move` | Create and process a room move |
| `GET` | `/api/bookings/room-move/history?bookingId=uuid` | Get room move history for a booking |
| `GET` | `/api/rooms/available` | Search available rooms for the move target |
| `GET` | `/api/bookings/[id]` | Get current booking with room assignment |
| `PUT` | `/api/key-cards` | Deactivate old key cards and issue new ones |

### Request Body (POST /api/bookings/room-move)

```json
{
  "bookingId": "uuid",
  "fromRoomId": "uuid-of-current-room",
  "toRoomId": "uuid-of-new-room",
  "reason": "maintenance",
  "reasonNotes": "Air conditioning unit malfunction in room 305",
  "urgency": "high",
  "processedBy": "uuid-of-staff-member",
  "rateDifference": {
    "oldRatePerNight": 150.00,
    "newRatePerNight": 180.00,
    "differencePerNight": 30.00,
    "remainingNights": 2,
    "totalDifference": 60.00,
    "waived": false,
    "waiveReason": null
  },
  "notifyGuest": true,
  "reissueKeyCards": true,
  "keyCardCount": 1
}
```

### Response

```json
{
  "roomMoveId": "uuid",
  "bookingId": "uuid",
  "fromRoom": {
    "roomId": "uuid",
    "roomNumber": "305",
    "status": "dirty"
  },
  "toRoom": {
    "roomId": "uuid",
    "roomNumber": "412",
    "status": "occupied"
  },
  "reason": "maintenance",
  "rateDifference": {
    "totalDifference": 60.00,
    "postedToFolio": true,
    "folioLineItemId": "uuid"
  },
  "processedBy": "uuid-of-staff-member",
  "processedAt": "2025-01-16T10:30:00Z",
  "keyCards": {
    "deactivated": 1,
    "issued": 1
  }
}
```

### Room Move History Response

```json
{
  "bookingId": "uuid",
  "moves": [
    {
      "roomMoveId": "uuid",
      "fromRoomNumber": "305",
      "toRoomNumber": "412",
      "reason": "maintenance",
      "rateDifference": 60.00,
      "processedBy": "Jane Smith",
      "processedAt": "2025-01-16T10:30:00Z"
    }
  ],
  "totalMoves": 1,
  "totalRateAdjustments": 60.00
}
```

## Business Logic

### Move Reasons

| Reason Code | Description | Rate Difference Handling |
|-------------|-------------|--------------------------|
| `guest_request` | Guest requested a room change | Standard rate difference applies |
| `maintenance` | Room requires repair; guest must move | Rate difference typically waived (hotel fault) |
| `upgrade` | Guest or staff initiated upgrade to better room | Guest pays upgrade difference |
| `downgrade` | Guest requested downgrade to lower room type | Difference credited back to folio |
| `availability` | Room needed for another booking (group, VIP) | Rate difference waived (hotel operational) |
| `other` | Other reason (requires notes) | Configurable per property |

### Rate Difference Calculation

1. **Calculate per-night difference**: `newRatePerNight - oldRatePerNight`
2. **Multiply by remaining nights**: `differencePerNight × (checkOut - today)`
3. **Apply waiver logic**: If reason is `maintenance` or `availability`, rate difference is waived by default (manager can override)
4. **Post to folio**: If rate difference > 0, post as a line item; if < 0, post as a credit
5. **Negative difference (downgrade)**: Credit posted to folio; guest receives refund or credit balance

### Waiver Authorization

| Rate Difference | Approval Required |
|-----------------|-------------------|
| Waived (maintenance/availability) | Manager approval recommended |
| $0–$50 | Front desk agent |
| $50–$200 | Manager approval |
| $200+ | Manager + Revenue Manager approval |

### Atomic Room Transition

Room moves use a database transaction to ensure both rooms are updated atomically:

```
BEGIN TRANSACTION
  1. Update old room: status → 'dirty'
  2. Update new room: status → 'occupied'
  3. Update booking: roomId → newRoomId
  4. Create room move record
  5. Post rate difference to folio (if applicable)
  6. Deactivate old key cards
  7. Issue new key cards
  8. Emit WebSocket events
COMMIT TRANSACTION
```

If any step fails, the entire transaction rolls back, preventing inconsistent state.

## Cross-Module Dependencies

| Module | Trigger | Effect |
|--------|---------|--------|
| **PMS — Rooms (Old)** | Room move confirmed | `status` → `dirty`; available inventory increased |
| **PMS — Rooms (New)** | Room move confirmed | `status` → `occupied`; available inventory decreased |
| **Bookings** | Room move confirmed | `roomId` updated to new room |
| **Billing — Folio** | Rate difference calculated | Line item posted (charge or credit) |
| **Housekeeping** | Old room → dirty | Cleaning task created with priority based on next booking |
| **Housekeeping** | New room → occupied | Room removed from cleaning queue |
| **Key Cards** | Move confirmed | Old cards deactivated; new cards issued |
| **Dashboard** | Move completed | Room grid updated; occupancy stats recalculated |
| **Audit Log** | Move completed | Room move record created with full details |

## User Flow

1. **Initiate Room Move** — From booking detail or room grid, click "Move Room"
2. **Select Reason** — Choose move reason from dropdown; add notes if required
3. **Search Available Rooms** — System shows rooms matching the booking's room type (or allow type change for upgrades)
4. **Select New Room** — Click an available room; system shows room details and rate
5. **Review Rate Difference** — System calculates and displays the rate impact; agent can waive if authorized
6. **Confirm Move** — Click "Confirm Room Move" — both rooms transition, keys updated, folio posted
7. **Notify Guest** — Optional guest notification sent via preferred channel
8. **Assist Guest** — Agent helps guest relocate to the new room with new key cards

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full room move operations, unlimited waiver authority |
| Manager | `frontdesk.manage` | All room moves, waive rate differences up to $200 |
| Front Desk Agent | `frontdesk.manage` | Standard room moves; rate difference waivers require approval |
| Night Auditor | `frontdesk.manage` | Room moves during overnight; no waiver authority |
| Revenue Manager | `revenue.manage` | Approve large rate difference waivers ($200+) |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| No available rooms | `NO_ROOMS_AVAILABLE` | No rooms available for the move; add to waitlist or negotiate |
| New room occupied | `ROOM_NOT_AVAILABLE` | Selected room was just booked by another guest; refresh and reselect |
| Booking not checked in | `NOT_CHECKED_IN` | Cannot move room for a guest who hasn't checked in |
| Rate difference exceeds authority | `APPROVAL_REQUIRED` | Escalate to manager or revenue manager for approval |
| Transaction conflict | `CONFLICT_ERROR` | Another operation modified room or booking simultaneously; retry |
| Key card issuance failed | `KEY_CARD_ERROR` | Room move completed but keys need manual issuance at front desk |
| Old room already dirty | `INVALID_ROOM_STATUS` | Old room status is not `occupied`; check for data inconsistency |

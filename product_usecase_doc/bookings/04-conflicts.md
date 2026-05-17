# Conflicts

> **Section ID**: `bookings-conflicts`

## Purpose

The Conflicts page detects and resolves booking conflicts that can occur due to double bookings, room type overbooking, or inventory lock conflicts. It provides a proactive scan of all active bookings to identify situations where rooms are over-committed, and offers actionable resolution options to resolve each conflict. This is a critical operational tool for preventing guest dissatisfaction and revenue loss from overbooking scenarios.

The page solves the business problem of conflict detection and resolution at scale. Without automated conflict detection, staff would need to manually cross-reference booking dates against room assignments — an error-prone and time-consuming process that becomes impossible as booking volume grows.

## Key Features

- **Double Booking Detection**: Scans for multiple bookings assigned to the same room with overlapping dates
- **Room Type Overbooking Detection**: Identifies dates where more bookings exist for a room type than physical rooms available
- **Lock Conflict Detection**: Identifies bookings that conflict with active inventory locks (maintenance, event, overbooking)
- **Session Lock Visibility**: Shows active booking session locks that may indicate pending bookings
- **Resolution Actions**: Provides actionable resolution options for each conflict type
- **Summary Statistics**: Dashboard showing total conflicts, critical issues, warnings, and active session locks
- **Date Range Filtering**: Scan specific date ranges and properties

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/bookings/conflicts` | Detect and list all booking conflicts |
| `POST` | `/api/bookings/conflicts` | Resolve a specific conflict with an action |
| `PUT` | `/api/bookings/conflicts` | Legacy endpoint — resolves conflicts (same as POST) |

### Query Parameters (GET /api/bookings/conflicts)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | No | Filter conflicts to a specific property |
| `startDate` | `ISO date` | No | Start of date range for conflict scanning |
| `endDate` | `ISO date` | No | End of date range for conflict scanning |
| `includeLocks` | `boolean` | No | Include lock conflicts (default `true`) |

### Resolution Request Body (POST)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conflictId` | `string` | **Yes** | Identifier of the conflict to resolve |
| `conflictType` | `string` | **Yes** | Type: `double_booking`, `overbooking`, `lock_conflict` |
| `bookingIds` | `UUID[]` | **Yes** | Array of booking IDs involved in the conflict |
| `resolution` | `string` | **Yes** | Resolution action (see below) |
| `targetRoomId` | `UUID?` | Conditional | Required for `move_room` resolution |
| `newCheckIn` | `ISO date?` | Conditional | Required for `modify_dates` resolution |
| `newCheckOut` | `ISO date?` | Conditional | Required for `modify_dates` resolution |
| `splitDate` | `ISO date?` | No | Date to split the stay (for `split_stay`; defaults to midpoint) |
| `cancellationReason` | `string?` | No | Reason for cancellation (for `cancel` resolution) |
| `notifyGuest` | `boolean` | No | Whether to notify the guest (default `true`) |

### Resolution Actions

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `move_room` | Move one booking to a different room of the same type | `targetRoomId` |
| `cancel` | Cancel the conflicting booking(s) | `cancellationReason` (optional) |
| `modify_dates` | Change the dates of one booking to avoid overlap | `newCheckIn`, `newCheckOut` |
| `split_stay` | Split a booking into two parts — first part stays, second part moves to another room | `splitDate` (optional, defaults to midpoint) |
| `keep_both` | Acknowledge the conflict and keep both bookings (intentional overbooking) | — |

## Data Model

### Conflict Response Structure

```json
{
  "success": true,
  "data": {
    "conflicts": [
      {
        "id": "conflict_<roomId>_<i>_<j>",
        "type": "double_booking",
        "severity": "critical",
        "bookings": [...],
        "roomId": "...",
        "roomNumber": "101",
        "overlappingDates": { "start": "...", "end": "..." },
        "description": "Double booking detected for room 101..."
      }
    ],
    "overbookings": [
      {
        "id": "overbooking_<roomTypeId>_<date>",
        "type": "overbooking",
        "severity": "warning",
        "roomTypeId": "...",
        "roomTypeName": "Deluxe Suite",
        "totalRooms": 10,
        "bookedRooms": 12,
        "date": "2024-12-15",
        "bookings": [...],
        "description": "Overbooking detected for Deluxe Suite on 2024-12-15..."
      }
    ],
    "sessionLocks": [...]
  },
  "stats": {
    "totalConflicts": 5,
    "criticalConflicts": 2,
    "warnings": 3,
    "doubleBookings": 1,
    "overbookings": 2,
    "lockConflicts": 1,
    "activeSessionLocks": 4
  }
}
```

### Conflict Types & Severity

| Type | Severity | Description |
|------|----------|-------------|
| `double_booking` | `critical` | Two or more bookings assigned to the same room with overlapping dates |
| `overbooking` | `warning` | More bookings exist for a room type on a date than physical rooms |
| `lock_conflict` | `warning` | A booking conflicts with an active inventory lock (maintenance, event) |

## Business Logic

### Detection Algorithm

**Double Booking Detection:**

1. Fetch all active bookings (`confirmed` or `checked_in`) within the date range.
2. Group bookings by `roomId`.
3. For each room, sort bookings by `checkIn` ascending.
4. Compare each pair of bookings: if `booking2.checkIn < booking1.checkOut`, an overlap exists.
5. Calculate the exact overlap period: `start = max(checkIn1, checkIn2)`, `end = min(checkOut1, checkOut2)`.

**Room Type Overbooking Detection:**

1. Fetch all active bookings within the date range.
2. Group bookings by `roomTypeId`.
3. For each room type, get the total physical room count (`RoomType._count.rooms`).
4. Create a day-by-day map of booking count per date.
5. Any date where booking count exceeds physical room count is flagged as overbooking.

**Lock Conflict Detection:**

1. Fetch all active inventory locks (maintenance, event, overbooking) within the date range.
2. For each lock with a `roomId`, find bookings assigned to the same room with overlapping dates.
3. If `booking.checkIn < lock.endDate AND booking.checkOut > lock.startDate`, a conflict exists.

### Resolution Logic

**move_room:**

1. Verify the target room belongs to the same room type as the original booking.
2. Check the target room has no conflicting bookings for the same date range.
3. Update the booking's `roomId` to the target room.
4. Create a `BookingAuditLog` entry with action `room_change`.

**cancel:**

1. Update the booking status to `cancelled`.
2. Set `cancelledAt` timestamp and `cancellationReason`.
3. Create a `BookingAuditLog` entry with action `cancelled`.

**modify_dates:**

1. Validate that `newCheckIn < newCheckOut`.
2. Check the new dates don't create new conflicts in the same room.
3. Update `checkIn` and `checkOut` on the booking.
4. Create a `BookingAuditLog` entry with action `date_change`.

**split_stay:**

1. Determine the split date (provided or midpoint of the stay).
2. Validate the split date is between `checkIn` and `checkOut`.
3. Calculate proportional pricing for each part (room rate, taxes, fees, discounts divided by total nights).
4. Create two new bookings — first part keeps the original room, second part gets a new room (or the same if available).
5. Mark the original booking as cancelled with reason `split_stay`.
6. Create folios for both new bookings with proportional amounts.
7. Create `BookingAuditLog` entries for the original (cancelled) and both new bookings (created).

**keep_both:**

1. Create `BookingAuditLog` entries for all involved bookings with action `conflict_acknowledged`.
2. No booking data is modified — the conflict is acknowledged as intentional.
3. Used when overbooking is deliberate (e.g., based on historical no-show patterns).

### Transaction Safety

All resolution operations are wrapped in a database transaction (`db.$transaction`). If any step fails, the entire resolution is rolled back, preventing partial updates that could leave data in an inconsistent state.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **PMS — Rooms** | Room assignments checked for double booking; target room validated during move_room |
| **PMS — Room Types** | Room type overbooking calculated against physical room counts |
| **PMS — Inventory Locks** | Lock conflicts detected against maintenance, event, and booking session locks |
| **Bookings (Calendar)** | Resolved conflicts reflected on the calendar view |
| **Billing** | Split stay creates new folios with proportional amounts |
| **Audit Logs** | All resolution actions create BookingAuditLog entries |
| **Front Desk** | Room changes from conflict resolution affect front desk room board |

## User Flow

1. **Navigate to Bookings → Conflicts** from the main navigation sidebar
2. The page runs a conflict scan and displays results with summary statistics
3. Review **critical conflicts** (double bookings) first — these require immediate attention
4. Review **warnings** (overbookings, lock conflicts) — these may be intentional
5. Click on a conflict to see the full details: conflicting bookings, overlap dates, room numbers
6. Select a **resolution action** from the available options:
   - **Move Room**: Select a target room of the same type → confirm
   - **Cancel**: Select which booking to cancel → provide reason → confirm
   - **Modify Dates**: Enter new check-in/check-out dates → confirm
   - **Split Stay**: Choose split date → system creates two bookings → confirm
   - **Keep Both**: Acknowledge intentional overbooking → confirm
7. The system executes the resolution in a transaction and updates the conflict list
8. Re-scan to verify the conflict is resolved

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.bookings` | Full access to detection and all resolution actions |
| Front Desk Manager | `bookings.manage` | Detect conflicts, execute all resolution actions |
| Front Desk Staff | `bookings.view` | View conflicts (read-only); escalate to manager for resolution |
| Revenue Manager | `bookings.view` | View conflicts for analysis; may use `keep_both` for intentional overbooking |

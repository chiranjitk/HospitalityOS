# Inventory Locking

## Purpose

Inventory Locking allows hotel staff to block rooms or entire room types from being booked for specific date ranges. This is essential for managing maintenance windows, private events, group blocks, VIP reservations, and seasonal closures. Without inventory locking, the system would attempt to sell all rooms at all times, leading to over-commitment during periods when rooms are genuinely unavailable.

This page solves the business problem of temporarily removing inventory from the sellable pool without permanently deleting or disabling rooms.

## Features

- **Room-Level Locking**: Block a specific room for a date range
- **Room-Type-Level Locking**: Block all rooms of a type for a date range
- **Lock Type Classification**: Categorize locks (maintenance, event, overbooking, booking session)
- **Conflict Detection**: Prevent overlapping locks and conflicts with existing bookings
- **Lock Status Tracking**: Active, upcoming, past status computed from dates
- **Lock Duration Calculation**: Automatic computation of lock duration in days
- **Lock Statistics**: Dashboard summary of total, active, upcoming locks with type distribution
- **Serializable Transactions**: PostgreSQL serializable isolation prevents race conditions

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/inventory-locks` | List all locks (filterable by property, room, room type, status) |
| `POST` | `/api/inventory-locks` | Create a new inventory lock |
| `PUT` | `/api/inventory-locks/[id]` | Update lock details (dates, reason) |
| `DELETE` | `/api/inventory-locks/[id]` | Delete/release an inventory lock |

## Data Model

### `InventoryLock` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `roomId` | `UUID` | Conditional | — | FK to Room (required if no roomTypeId) |
| `roomTypeId` | `UUID` | Conditional | — | FK to RoomType (required if no roomId) |
| `startDate` | `date` | **Yes** | — | Lock start date |
| `endDate` | `date` | **Yes** | — | Lock end date (inclusive) |
| `reason` | `string` | **Yes** | — | Human-readable reason for the lock |
| `lockType` | `enum` | No | `"maintenance"` | `maintenance`, `event`, `overbooking`, `booking_session` |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Computed Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `isActive` | `boolean` | `true` if `startDate <= today <= endDate` |
| `isUpcoming` | `boolean` | `true` if `startDate > today` |
| `isPast` | `boolean` | `true` if `endDate < today` |
| `durationDays` | `number` | Number of days in the lock range |

### Lock Statistics (Aggregated)

| Stat | Description |
|------|-------------|
| `totalLocks` | Total number of locks for the property |
| `activeLocks` | Locks where today falls within the date range |
| `upcomingLocks` | Locks starting in the future |
| `lockTypeDistribution` | Breakdown by lockType (e.g., `{ maintenance: 5, event: 2, overbooking: 1 }`) |

## Business Logic

### Lock Scope

Locks operate at two levels of granularity:

| Scope | Target | Effect |
|-------|--------|--------|
| **Room-level** | Specific `roomId` | Only the individual room is blocked |
| **Room-type-level** | All rooms of `roomTypeId` | Every room of that type is blocked for the date range |

- A lock MUST specify either `roomId` OR `roomTypeId`, but not both.
- If `roomTypeId` is specified, the system effectively blocks all rooms where `Room.roomTypeId = lock.roomTypeId` for the date range.

### Lock Types

| Lock Type | Use Case |
|-----------|----------|
| `maintenance` | Planned maintenance or renovation |
| `event` | Private event, group buyout, or block |
| `overbooking` | System-generated lock to prevent further overbooking |
| `booking_session` | Temporary hold during active booking process (e.g., payment gateway processing) |

### Validation Rules

1. **Date validation**: `endDate` must be ≥ `startDate`.
2. **Overlap detection (same scope)**:
   - For room-level locks: No two locks can overlap on the same `roomId`.
   - For room-type-level locks: No two locks can overlap on the same `roomTypeId`.
3. **Booking conflict (room-level only)**: If locking a specific `roomId`, the system checks for existing bookings overlapping the lock date range. If conflicts exist, the lock creation is rejected with a list of conflicting bookings.
4. **Property scope**: Both `roomId` and `roomTypeId` must belong to the specified `propertyId`.

### Serializable Transactions

Lock creation and validation run within a **PostgreSQL serializable transaction** to prevent race conditions:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- Check for overlapping locks
-- Check for conflicting bookings
-- Insert lock if no conflicts
COMMIT;
```

If a concurrent transaction creates a conflicting lock, the serialization fails and the request is retried or rejected with a 409 Conflict.

### Date Range Behavior

- `startDate` and `endDate` are **inclusive** dates. A lock from Jan 5 to Jan 7 blocks Jan 5, Jan 6, and Jan 7 (3 days).
- `durationDays` = `(endDate - startDate) + 1`.

### Delete Behavior

- Deleting a lock immediately releases the blocked inventory.
- The room(s) become available again for the released dates.
- If the room has other active locks, it remains blocked for those dates.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Availability API** | Excludes locked rooms from available inventory computation. Locked rooms reduce `availableRooms` count. |
| **Bookings** | Booking creation checks for inventory locks before confirming. If a room or room type is locked, the booking is rejected or re-routed. |
| **Room Rate Calendar** | Calendar view shows lock status per date alongside rates. Locked dates are visually distinguished. |
| **Channel Manager** | Inventory locks reduce available room counts synced to OTAs. Maintenance locks may map to "out of service" status on channels. |
| **Revenue Management** | Lock statistics feed revenue forecasting. Event locks may trigger dynamic pricing adjustments. |
| **Front Desk** | Front desk staff see lock status on the room grid, preventing them from assigning locked rooms. |
| **Booking Engine** | Public booking engine does not display locked rooms/types as available options. |

## User Flow

1. **Navigate to PMS → Inventory Locking** from the main navigation sidebar
2. The dashboard shows lock statistics: total, active, upcoming locks with type distribution
3. Click **"New Lock"** to open the lock creation form
4. Select the **Property** from the dropdown
5. Choose lock scope:
   - **Room-level**: Select a specific room from the room picker
   - **Room-type-level**: Select a room type to block all rooms of that category
6. Set the **Date Range** (start and end dates)
7. Enter a **Reason** (e.g., "Annual maintenance shutdown", "Wedding block", "Deep cleaning")
8. Select the **Lock Type**: maintenance, event, overbooking, or booking_session
9. Click **"Create Lock"**
10. If conflicts exist (overlapping locks or conflicting bookings), the system shows an error with details
11. Resolve conflicts by adjusting dates or scope, then retry
12. Active locks appear in the list with status badges (Active, Upcoming, Past)
13. To release a lock early: click the lock → **"Delete Lock"** → confirm
14. Blocked rooms become immediately available for the released dates

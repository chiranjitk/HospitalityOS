# Waitlist

> **Section ID**: `bookings-waitlist`

## Purpose

The Waitlist page manages guest demand when rooms are sold out. When a room type has no availability for the requested dates, instead of turning the guest away, staff can add them to the waitlist. Waitlist entries capture the guest's desired room type, dates, and party size, along with a priority score. When rooms become available (through cancellations or modifications), the system can auto-process the waitlist to notify and convert high-priority entries into confirmed bookings.

This page solves the business problem of lost revenue during sold-out periods. Without a waitlist, hotels lose potential guests who would have booked if a room became available. The waitlist captures this demand and automates conversion, maximizing occupancy and revenue.

## Key Features

- **Create Waitlist Entry**: Add a guest to the waitlist with room type, dates, party size, and priority
- **Edit Waitlist Entry**: Update dates, priority, notes, or manually link a booking
- **Delete Waitlist Entry**: Remove an entry when the guest no longer needs the room
- **Priority System**: Higher priority entries are processed first; ties broken by creation time (earliest first)
- **Status Lifecycle**: Track entries through waiting → notified → converted → expired → cancelled
- **Auto-Process**: Automatically check availability and convert eligible waitlist entries when rooms open up
- **Statistics Dashboard**: View counts by status (waiting, notified, converted, expired)
- **Filtering**: Filter by status, property, and room type
- **Guest Enrichment**: Each entry displays guest name, email, phone, and VIP status

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/waitlist` | List all waitlist entries (filterable by `status`, `propertyId`, `roomTypeId`) |
| `POST` | `/api/waitlist` | Create a new waitlist entry |
| `PUT` | `/api/waitlist` | Update a waitlist entry (status, priority, notes, bookingId) |
| `DELETE` | `/api/waitlist` | Delete a waitlist entry |
| `POST` | `/api/waitlist/auto-process` | Automatically process waiting entries when rooms become available |

### Query Parameters (GET /api/waitlist)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `string` | No | Filter by status (waiting, notified, converted, expired, cancelled) |
| `propertyId` | `UUID` | No | Filter by property |
| `roomTypeId` | `UUID` | No | Filter by room type |
| `limit` | `number` | No | Results per page (max 100) |
| `offset` | `number` | No | Results offset for pagination |

## Data Model

### `WaitlistEntry` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `guestId` | `UUID` | **Yes** | — | FK to Guest |
| `roomTypeId` | `UUID` | **Yes** | — | FK to RoomType |
| `checkIn` | `datetime` | **Yes** | — | Desired check-in date |
| `checkOut` | `datetime` | **Yes** | — | Desired check-out date |
| `adults` | `number` | No | `1` | Number of adults |
| `children` | `number` | No | `0` | Number of children |
| `priority` | `number` | No | `0` | Priority score (higher = more important) |
| `status` | `string` | Auto | `"waiting"` | Current waitlist status |
| `notes` | `string` | No | — | Internal notes |
| `bookingId` | `UUID?` | Auto | — | FK to Booking (set on conversion) |
| `convertedAt` | `datetime` | Auto | — | Timestamp of conversion to booking |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Waitlist Status Lifecycle

| Status | Description | Transition To |
|--------|-------------|---------------|
| `waiting` | Entry is active, waiting for availability | notified, expired, cancelled |
| `notified` | Room available, guest has been notified | converted, expired, cancelled |
| `converted` | Guest confirmed, booking created | — (terminal) |
| `expired` | Entry expired without conversion (e.g., dates passed) | — (terminal) |
| `cancelled` | Entry cancelled by staff or guest | — (terminal) |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `guestId`, `roomTypeId`, `checkIn`, `checkOut` are mandatory.
2. **Property validation**: The property must belong to the tenant.
3. **Guest validation**: The guest must exist in the system.
4. **Room type validation**: The room type must belong to the specified property.
5. **Date validation**: `checkOut` must be after `checkIn`.
6. **Numeric constraints**: `adults` ≥ 1; `children` ≥ 0; `priority` ≥ 0.
7. **Default status**: New entries are created with status `"waiting"`.

### Ordering & Priority

Entries are always returned in priority order:
1. **Primary sort**: `priority DESC` (highest priority first)
2. **Secondary sort**: `createdAt ASC` (earliest entry first within same priority)

This ensures that VIP guests (high priority) are served before standard guests, and among equal priority, first-come-first-served applies.

### Auto-Process Logic

The `POST /api/waitlist/auto-process` endpoint:

1. Queries all waitlist entries with status `"waiting"`, ordered by priority (desc) then createdAt (asc).
2. For each entry, checks if a room of the requested type is available for the requested dates.
3. If available, updates the entry status to `"notified"` and sends a notification to the guest.
4. If the guest confirms (via manual booking creation linked to the waitlist entry), the entry is converted.

### Manual Conversion

Staff can manually convert a waitlist entry by:

1. Setting `bookingId` on the entry via the PUT endpoint.
2. The system automatically sets `status` to `"converted"` and records `convertedAt`.
3. The linked booking is created via the standard booking creation flow.

### Statistics

The GET endpoint returns aggregated statistics:

| Stat | Description |
|------|-------------|
| `total` | Total waitlist entries matching filters |
| `waiting` | Count of entries in waiting status |
| `notified` | Count of entries notified but not yet converted |
| `converted` | Count of successfully converted entries |
| `expired` | Count of expired entries |

### Deletion Rules

- Any waitlist entry can be deleted regardless of status.
- Deletion is permanent (no soft delete for waitlist entries).
- Staff should cancel rather than delete for audit trail purposes.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **PMS — Properties** | Waitlist entries are scoped to properties |
| **PMS — Room Types** | Entries specify desired room type; availability check against room type |
| **PMS — Rooms** | Room availability checked during auto-process and manual conversion |
| **Guests** | Guest profile linked to entry; guest contact used for notifications |
| **Bookings (Calendar)** | Converted entries create standard bookings visible on the calendar |
| **Notifications** | Auto-process sends notifications to guests when rooms become available |
| **Audit Logs** | Waitlist creation, updates, conversions, and deletions are logged |

## User Flow

1. **Navigate to Bookings → Waitlist** from the main navigation sidebar
2. The page displays a prioritized list of all waitlist entries with statistics
3. Click **"Add to Waitlist"** when a guest requests a sold-out room type
4. Select the guest, property, room type, desired dates, and party size
5. Set priority: higher values for VIP guests or important corporate clients
6. Click **"Add"** — entry is created with status `waiting`
7. To manually process: click **"Auto-Process"** — system checks availability for all waiting entries
8. Entries with available rooms are updated to `notified` and guest receives notification
9. When guest confirms, staff create the booking and link it to the waitlist entry
10. Entry status automatically changes to `converted` with a timestamp
11. To cancel an entry: click the entry → **"Cancel"** — status changes to `cancelled`
12. Use filters to view entries by status, property, or room type

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.bookings` | Full CRUD on all waitlist entries; auto-process |
| Front Desk | `bookings.manage` | Create, update, delete entries; trigger auto-process |
| Reservationist | `bookings.manage` | Add guests to waitlist; manage entries; auto-process |
| Revenue Manager | `bookings.view` | Read-only access for demand analysis |

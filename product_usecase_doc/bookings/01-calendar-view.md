# Calendar View

> **Section ID**: `bookings-calendar`

## Purpose

The Calendar View is the primary operational interface for reservation staff to visualize and manage all bookings across properties. It presents bookings in a calendar format, allowing staff to quickly identify booking density, gaps in occupancy, upcoming check-ins/check-outs, and booking patterns over time. This page serves as the "home base" for daily reservation operations, enabling staff to navigate to specific dates, search for bookings, and drill into booking details.

The page solves the business problem of needing a time-oriented overview of reservations — without a calendar view, staff would need to scan through paginated lists to understand booking patterns, identify availability windows, or prepare for upcoming arrivals.

## Key Features

- **Date Range Filtering**: View bookings within a specific date range (`checkInFrom`, `checkInTo`) to focus on upcoming periods
- **Status Filters**: Filter bookings by status (`draft`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`)
- **Property Filter**: Filter by `propertyId` to see bookings for a specific property
- **Guest Filter**: Filter by `guestId` to see all bookings for a specific guest
- **Search**: Full-text search across confirmation code, guest first name, last name, and email
- **Pagination**: Cursor-based pagination with configurable `limit` (1–200, default 50) and `offset`
- **Booking Details**: Each booking card displays confirmation code, guest name, room type, room number, dates, and status
- **Quick Actions**: Navigate to booking detail, edit, or create new booking from the calendar
- **Multi-Property View**: For multi-property tenants, view bookings across all properties or filter to one

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/bookings` | List all bookings with filtering, search, and pagination |
| `GET` | `/api/bookings/[id]` | Get single booking with full details including room, guest, folio |
| `POST` | `/api/bookings` | Create a new booking (with pricing engine, conflict checks, and folio creation) |
| `PUT` | `/api/bookings/[id]` | Update an existing booking |
| `DELETE` | `/api/bookings/[id]` | Soft-delete a booking (sets `deletedAt`) |
| `POST` | `/api/bookings/[id]/cancel` | Cancel a booking with reason |

### Query Parameters (GET /api/bookings)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `string` | No | Filter by booking status |
| `propertyId` | `UUID` | No | Filter by property |
| `guestId` | `UUID` | No | Filter by primary guest |
| `checkInFrom` | `ISO date` | No | Show bookings with check-in on or after this date |
| `checkInTo` | `ISO date` | No | Show bookings with check-in on or before this date |
| `search` | `string` | No | Search across confirmation code, guest name, guest email |
| `limit` | `number` | No | Results per page (1–200, default 50) |
| `offset` | `number` | No | Results offset for pagination |

## Data Model

### `Booking` Table (Primary Fields Shown on Calendar)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Primary key |
| `confirmationCode` | `string` | Unique code (format: `SS-XXXXXX`) |
| `primaryGuestId` | `UUID` | FK to Guest |
| `propertyId` | `UUID` | FK to Property |
| `roomTypeId` | `UUID` | FK to RoomType |
| `roomId` | `UUID?` | FK to Room (assigned at check-in) |
| `checkIn` | `datetime` | Scheduled check-in date |
| `checkOut` | `datetime` | Scheduled check-out date |
| `adults` | `number` | Number of adults (default 1) |
| `children` | `number` | Number of children (default 0) |
| `status` | `string` | Current booking status |
| `totalAmount` | `number` | Total booking value |
| `currency` | `string` | ISO 4217 currency code |
| `source` | `string` | Booking source (direct, booking.com, etc.) |
| `groupId` | `UUID?` | FK to GroupBooking (if group member) |
| `isGroupLeader` | `boolean` | Whether this is the primary booking in a group |

### Booking Status Enum

| Status | Description |
|--------|-------------|
| `draft` | Booking created but not yet confirmed |
| `confirmed` | Booking is active and guaranteed |
| `checked_in` | Guest has checked in |
| `checked_out` | Guest has checked out |
| `cancelled` | Booking was cancelled |
| `no_show` | Guest did not check in by the deadline |

### Computed Response Fields (GET /api/bookings)

| Field | Type | Description |
|-------|------|-------------|
| `primaryGuest` | `object` | Guest details (id, firstName, lastName, email, phone, isVip) |
| `room` | `object` | Room details (id, number, floor, roomTypeId) |
| `roomType` | `object` | Room type details (id, name, code, basePrice) |
| `property` | `object` | Property details (id, name, currency) |

## Business Logic

### Query & Filtering

1. **Tenant isolation**: All queries are scoped to the authenticated user's `tenantId`. Users cannot see bookings from other tenants.
2. **Soft-delete filtering**: Only bookings where `deletedAt IS NULL` are returned. Deleted bookings are excluded from all views.
3. **Search scope**: The `search` parameter matches against `confirmationCode`, `primaryGuest.firstName`, `primaryGuest.lastName`, and `primaryGuest.email` using case-insensitive contains matching.
4. **Date range**: When both `checkInFrom` and `checkInTo` are provided, only bookings with `checkIn` within the range are returned.
5. **Ordering**: Results are ordered by `checkIn ASC` then `createdAt DESC` — upcoming bookings first, newest first within the same date.

### Pagination

- Default page size is 50 bookings.
- Maximum page size is 200 (enforced server-side).
- Response includes `pagination` object with `total`, `limit`, and `offset` for client-side pagination controls.

### Booking Creation (from Calendar)

When creating a booking from the calendar view, the system performs:

1. **Property validation**: Verifies the property belongs to the tenant.
2. **Guest validation**: Verifies the guest exists.
3. **Room type validation**: Verifies the room type belongs to the property.
4. **Occupancy validation**: Checks total guests against `RoomType.maxOccupancy` and `maxAdults`.
5. **Date validation**: Check-out must be after check-in; check-in must not be in the past (timezone-aware).
6. **Rate plan validation**: If a rate plan is specified, validates minimum stay requirements.
7. **Availability check**: Counts overlapping confirmed/checked-in bookings for the room type. If `overbookingEnabled` is false and all rooms are booked, returns `SOLD_OUT` error.
8. **Conflict detection**: If a specific room is assigned, checks for date overlaps with existing bookings.
9. **Maintenance/lock check**: Verifies no active inventory locks conflict with the booking dates.
10. **Pricing calculation**: Optionally triggers the pricing engine for automatic rate computation.
11. **Folio creation**: Auto-creates a folio with initial room charge line item.
12. **Audit logging**: Creates `BookingAuditLog` entry and global `AuditLog` entry.
13. **WebSocket notification**: Emits `booking.created` event for real-time UI updates.
14. **Automation trigger**: Fires `booking.created` automation event.

### Idempotency

When `idempotencyKey` is provided (typically from channel bookings), the system checks inside the transaction whether a booking with that key already exists. If found, the existing booking is returned instead of creating a duplicate. This prevents double-booking from OTA retries.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **PMS — Rooms** | Room assignment and availability checking during booking creation |
| **PMS — Room Types** | Room type validation, occupancy limits, overbooking settings |
| **PMS — Rate Plans** | Rate plan validation, minimum stay, pricing engine integration |
| **PMS — Inventory Locks** | Maintenance and session lock conflict checking |
| **Guests** | Primary guest lookup and validation; guest profile enrichment in response |
| **Front Desk** | Check-in/check-out status transitions; room assignment at check-in |
| **Billing** | Auto-creation of folio and initial room charge line item on booking creation |
| **Channel Manager** | External reference tracking, idempotency keys, source/channel identification |
| **Housekeeping** | Special requests and check-in/check-out dates drive room preparation workflows |
| **Conflicts** | Calendar view may surface conflict indicators from the conflict detection engine |

## User Flow

1. **Navigate to Bookings → Calendar View** from the main navigation sidebar
2. The page loads the current month's bookings by default
3. Use **date range picker** to narrow the view to a specific period
4. Filter by **status** (e.g., only show confirmed and checked-in bookings)
5. Filter by **property** if managing multiple properties
6. Use **search** to find a specific booking by confirmation code or guest name
7. Browse the calendar grid — each booking appears as a card spanning its check-in to check-out dates
8. Click a **booking card** to open the detail view
9. From the detail view, edit the booking, cancel it, or navigate to related folio/guest profile
10. Click **"New Booking"** to open the booking creation form — pre-fill dates from the clicked calendar date

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.bookings` | Full CRUD on all bookings across all properties |
| Front Desk | `bookings.manage` or `bookings.view` | View all bookings; create and edit (manage) or view only |
| Reservationist | `bookings.manage` | Create, edit, cancel bookings |
| Revenue Manager | `bookings.view` | Read-only access to booking data for analysis |
| Housekeeping | — | No direct access (receives data via WebSocket events) |

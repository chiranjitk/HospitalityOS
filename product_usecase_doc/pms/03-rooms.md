# Rooms

## Purpose

Rooms represent the physical, individual bookable units within a property. While Room Types define categories (Deluxe, Suite), Rooms define the actual room numbers (101, 102, A1, etc.) with their floor, features, and real-time status. This page is the central inventory management tool — it tracks where every room is in its lifecycle (available → occupied → dirty → cleaning → inspected) and supports maintenance management.

The page solves the business problem of knowing exactly which physical rooms exist, where they are located, what features they have, and what state they are in at any given moment.

## Features

- **Create Room**: Add a physical room with number, type, floor, and feature flags
- **Edit Room**: Update room details, features, and manual status changes
- **Delete Room**: Remove room (decrements type and property total room counts)
- **Room Status Management**: Complex state machine tracking room lifecycle
- **Available Rooms Query**: Real-time filter for rooms available for booking on specific dates
- **Maintenance Blocks**: Create, view, cancel, and complete maintenance periods
- **Room Type Changes**: View room type change history
- **Feature Flags**: Accessible, smoking, balcony, sea view, mountain view, digital key

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rooms` | List all rooms (filterable by `propertyId`, `roomTypeId`, `status`) |
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/rooms/[id]` | Get single room with full details |
| `PUT` | `/api/rooms/[id]` | Update room details |
| `DELETE` | `/api/rooms/[id]` | Delete room (with count adjustments) |
| `GET` | `/api/rooms/available` | Query rooms available for a date range (excludes booked/OOO/maintenance) |
| `GET` | `/api/rooms/type-changes` | List room type change requests |
| `GET` | `/api/rooms/maintenance-blocks` | List all maintenance blocks |
| `POST` | `/api/rooms/maintenance-blocks` | Create a new maintenance block |
| `POST` | `/api/rooms/maintenance-blocks/[id]/cancel` | Cancel a maintenance block |
| `POST` | `/api/rooms/maintenance-blocks/[id]/complete` | Complete a maintenance block |

## Data Model

### `Room` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `roomTypeId` | `UUID` | **Yes** | — | FK to RoomType |
| `number` | `string` | **Yes** | — | Room number, unique per property (e.g., "101") |
| `name` | `string` | No | — | Optional display name (e.g., "Honeymoon Suite") |
| `floor` | `number` | No | `1` | Floor number |
| `isAccessible` | `boolean` | No | `false` | ADA/accessibility compliant |
| `isSmoking` | `boolean` | No | `false` | Smoking room |
| `hasBalcony` | `boolean` | No | `false` | Has balcony |
| `hasSeaView` | `boolean` | No | `false` | Sea/lake view |
| `hasMountainView` | `boolean` | No | `false` | Mountain view |
| `status` | `enum` | No | `"available"` | Current room status |
| `digitalKeyEnabled` | `boolean` | No | `false` | Supports digital key access |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Room Status Enum

| Status | Description |
|--------|-------------|
| `available` | Room is clean, inspected, and ready to sell |
| `occupied` | Room is currently assigned to a checked-in guest |
| `maintenance` | Room is under maintenance (via MaintenanceBlock) |
| `out_of_order` | Room cannot be sold (via MaintenanceBlock) |
| `dirty` | Guest has checked out; room needs cleaning |
| `cleaning` | Housekeeping staff is currently cleaning the room |
| `inspected` | Room has been cleaned and inspected, awaiting availability confirmation |

### `MaintenanceBlock` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `roomId` | `UUID` | **Yes** | — | FK to Room |
| `propertyId` | `UUID` | Auto | — | FK to Property |
| `reason` | `enum` | **Yes** | — | `maintenance`, `renovation`, `deep_cleaning`, `inspection`, `quarantine` |
| `priority` | `enum` | No | `"normal"` | `normal`, `high`, `urgent` |
| `startDate` | `datetime` | **Yes** | — | When block begins |
| `endDate` | `datetime` | **Yes** | — | When block is scheduled to end |
| `estimatedCost` | `number` | No | — | Estimated maintenance cost |
| `actualCost` | `number` | No | — | Actual cost incurred |
| `vendorId` | `UUID` | No | — | FK to Vendor (if applicable) |
| `status` | `enum` | Auto | `"scheduled"` | `scheduled`, `active`, `completed`, `cancelled` |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `roomTypeId`, `number` are mandatory.
2. **Room number uniqueness**: The `number` must be unique within the property. Two rooms in the same property cannot share the same number.
3. **Cross-property validation**: The `roomTypeId` must belong to the same `propertyId`. A room in Property A cannot reference a room type from Property B.
4. **Counter increment**: Creating a room automatically increments `RoomType.totalRooms` and `Property.totalRooms`.

### Room Status State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
  available ──→ occupied ──→ dirty ──→ cleaning ──→ inspected ──→ available
                    │                                          ▲
                    │                                          │
                    └────── occupied ◄──────────────────────────┘
                                         
                    available ──→ out_of_order ──→ available
                    available ──→ maintenance ──→ dirty ──→ cleaning ──→ inspected ──→ available
```

**Valid transitions:**

| From | To | Trigger |
|------|----|---------|
| `available` | `occupied` | Guest check-in |
| `occupied` | `dirty` | Guest check-out |
| `dirty` | `cleaning` | Housekeeping starts cleaning |
| `cleaning` | `inspected` | Cleaning complete, awaiting inspection |
| `inspected` | `available` | Inspection passed |
| `cleaning` | `available` | Inspection skipped (auto-available) |
| `available` | `out_of_order` | Maintenance block activated |
| `out_of_order` | `available` | Maintenance block cancelled, no other blocks |
| `available` | `maintenance` | Maintenance block activated |
| `maintenance` | `dirty` | Maintenance completed (triggers housekeeping) |

### Status Change Side Effects

- **WebSocket emission**: Every status change emits a real-time event to connected clients (Front Desk, Housekeeping, Dashboard).
- **Notification dispatch**: Status changes may trigger notifications to relevant staff (e.g., housekeeping team when a room becomes `dirty`).
- **Automation events**: Status transitions can trigger automated workflows (e.g., auto-assign cleaning task when status becomes `dirty`).

### Deletion Behavior

- Deleting a room decrements `RoomType.totalRooms` and `Property.totalRooms`.
- Cannot delete a room that is currently `occupied` or has active bookings.

### Available Rooms Query

The `GET /api/rooms/available` endpoint filters rooms by:
1. **Status**: Only `available` and `inspected` rooms are considered
2. **Booking overlap**: Rooms with bookings overlapping the requested date range are excluded
3. **Maintenance/Out-of-order**: Rooms in `maintenance` or `out_of_order` status are excluded
4. **Room type filter**: Optional `roomTypeId` parameter to filter by category

### Maintenance Block Lifecycle

1. **Create**: Set `roomId`, `reason`, `priority`, `startDate`, `endDate`
2. **Auto-activate**: If `startDate <= now`, status is set to `active` and `Room.status` → `out_of_order` or `maintenance`
3. **Complete**: Status → `completed`, `Room.status` → `dirty` (triggers housekeeping task)
4. **Cancel**: Status → `cancelled`. If no other active blocks remain on the room, `Room.status` → `available`

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | Rooms are assigned to bookings at check-in. Available rooms API is used during booking creation to find open rooms. |
| **Housekeeping** | Room `status` drives the housekeeping task queue. `dirty` rooms create cleaning tasks. `cleaning` rooms show as in-progress. `inspected` rooms are ready for sale. |
| **Front Desk** | Room status board shows real-time room states. Check-in assigns room (→ `occupied`). Check-out releases room (→ `dirty`). |
| **Inventory Locks** | Locked rooms cannot be assigned. Availability checks consider lock status. |
| **Availability API** | Room status directly impacts computed availability (maintenance/out_of_order reduce available count). |
| **Floor Plans** | Rooms are placed on floor plans with x,y coordinates. `Room.floor` groups rooms for floor plan display. |
| **Billing** | Room rate is determined by the room's type and associated rate plan. Room charges are posted to folios. |
| **Guest Portal** | Assigned room number shown to guest. Digital key enabled rooms allow mobile key access. |
| **Room Type Changes** | Room type changes reference specific rooms during a guest stay. |

## User Flow

1. **Navigate to PMS → Rooms** from the main navigation sidebar
2. The page displays a grid/list of all rooms grouped by floor or room type
3. Click **"New Room"** to open the creation form
4. Fill in required fields: Room Number (e.g., "101"), Room Type (select from dropdown), Floor
5. Toggle feature flags as applicable: Accessible, Smoking, Balcony, Sea View, Mountain View, Digital Key
6. Click **"Create Room"** — the room appears in the list with `available` status
7. To create a maintenance block: click the room card → "Block Room" → select reason, priority, date range → "Create Block"
8. Room status automatically updates to `out_of_order` or `maintenance`
9. When maintenance is done: click the block → "Complete Block" → room status changes to `dirty`, housekeeping is notified
10. Housekeeping cleans room → status progresses through `cleaning` → `inspected` → `available`

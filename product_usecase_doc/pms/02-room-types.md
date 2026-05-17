# Room Types

## Purpose

Room Types define the sellable categories of rooms within a property (e.g., Deluxe King, Standard Twin, Ocean Suite). They serve as the bridge between physical rooms and commercial pricing — every room belongs to a room type, and every rate plan is attached to a room type. This page allows hotel operators to define room categories with capacity limits, base pricing, amenities, images, and overbooking settings.

The page solves the business problem of organizing diverse physical room inventory into marketable categories that guests can search and book, while enabling revenue managers to set differentiated pricing per category.

## Features

- **Create Room Type**: Define a new room category with name, code, base price, and capacity settings
- **Edit Room Type**: Update pricing, capacity, amenities, images, and overbooking configuration
- **Delete Room Type**: Remove with safety check (blocked if rooms exist)
- **Amenity Management**: Associate amenity tags (WiFi, TV, minibar, etc.) with room types
- **Image Gallery**: Upload and manage room type images for the booking engine
- **Overbooking Configuration**: Enable per-type overbooking with percentage or hard limit
- **Sort Order**: Control display order in the booking engine
- **Overbooking Stats**: Real-time computed overbooking statistics from current bookings

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/room-types` | List all room types (filterable by `propertyId`) |
| `POST` | `/api/room-types` | Create a new room type |
| `GET` | `/api/room-types/[id]` | Get single room type with details and overbooking stats |
| `PUT` | `/api/room-types/[id]` | Update room type |
| `DELETE` | `/api/room-types/[id]` | Delete room type (with dependency check) |

## Data Model

### `RoomType` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `name` | `string` | **Yes** | — | Display name (e.g., "Deluxe King") |
| `code` | `string` | **Yes** | — | Short code, unique per property (e.g., "DLX-K") |
| `basePrice` | `number` | **Yes** | — | Default nightly rate (numeric) |
| `maxAdults` | `number` | No | `2` | Maximum adult occupancy |
| `maxChildren` | `number` | No | `0` | Maximum child occupancy |
| `maxOccupancy` | `number` | No | `2` | Total maximum guests (adults + children) |
| `totalRooms` | `number` | Computed | `0` | Count of rooms of this type (auto-managed) |
| `sizeSqMeters` | `number` | No | — | Room size in square meters |
| `amenities` | `string[]` | No | `[]` | Amenity tags |
| `currency` | `string` | No | Property default | ISO 4217 currency code |
| `images` | `string[]` | No | `[]` | Array of image URLs |
| `sortOrder` | `number` | No | `0` | Display order in booking engine |
| `overbookingEnabled` | `boolean` | No | `false` | Whether overbooking is allowed for this type |
| `overbookingPercentage` | `number` | No | — | Max overbooking as percentage (e.g., `5` = 5%) |
| `overbookingLimit` | `number` | No | — | Max overbooking as absolute room count |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Computed Fields (Response Only)

| Field | Type | Description |
|-------|------|-------------|
| `overbookingStats` | `object` | Real-time overbooking statistics computed from current bookings |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `name`, `code`, `basePrice` are mandatory.
2. **Code uniqueness**: The `code` must be unique within the property. Two room types in the same property cannot share the same code.
3. **Property scope**: The `propertyId` must reference a valid property owned by the current tenant.

### Capacity Validation

- `maxOccupancy` should be ≥ `maxAdults`. The system enforces that total occupancy includes adults and children.
- If `maxChildren` is not set, defaults to `0`.
- If `maxOccupancy` is not set, defaults to `maxAdults` (which defaults to `2`).

### Overbooking Configuration

- `overbookingEnabled` must be `true` to use overbooking for this room type.
- When enabled, at least ONE of `overbookingPercentage` OR `overbookingLimit` must be set:
  - `overbookingPercentage`: e.g., `5` means allow 5% over the physical room count. For 100 rooms, allows up to 105 bookings.
  - `overbookingLimit`: e.g., `3` means allow a maximum of 3 overbooked rooms regardless of percentage.
- If both are set, the more restrictive of the two applies.
- `overbookingStats` is computed at query time from current booking counts vs. `totalRooms`.

### Deletion Protection

- **Cannot delete if rooms exist**: If any `Room` records reference this room type, deletion is rejected with a 409 Conflict error.
- This prevents orphaned rooms and maintains data integrity.

### Base Price

- `basePrice` is the default nightly rate used as a fallback when no rate plan or price override applies.
- Rate plans can override the base price with their own `basePrice`.
- The `currency` field defaults to the property's currency if not explicitly set.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Rooms** | `Room.roomTypeId` is a required FK. Each physical room must belong to a room type. Creating a room increments `RoomType.totalRooms`. Deleting a room decrements it. |
| **Rate Plans** | `RatePlan.roomTypeId` is a required FK. Pricing strategies are defined per room type. |
| **Bookings** | `booking.roomTypeId` references the room type. Availability is checked at room type level before room assignment. |
| **Channel Manager** | Room types are mapped to OTA room categories. Each OTA channel maps its room listing to a StaySuite room type. |
| **Package Plans** | `PackagePlan.baseRoomTypeId` references a room type. Packages are built around a specific room category. |
| **Availability API** | Availability queries group results by room type, showing available count per type per date. |
| **Overbooking** | Per-type overbooking settings (`overbookingEnabled`, `overbookingPercentage`, `overbookingLimit`) interact with the property-level `OverbookingConfig`. |
| **Booking Engine** | Room types are displayed to guests in the public search results with images, amenities, and pricing. `sortOrder` controls display position. |

## User Flow

1. **Navigate to PMS → Room Types** from the main navigation sidebar
2. The page displays a grid/list of all room types for the current property
3. Click **"New Room Type"** to open the creation form
4. Fill in required fields: Name (e.g., "Deluxe King Room"), Code (e.g., "DLX-K"), Base Price (e.g., `15000`)
5. Set capacity: Max Adults (default 2), Max Children, Max Occupancy
6. Optionally add: Size in sq meters, Amenities (select from predefined list), Images (upload or URL)
7. Configure overbooking: Toggle "Allow Overbooking", then set either percentage or limit
8. Click **"Create Room Type"** — the type appears in the list
9. To edit: click the room type card, modify fields, click **"Save Changes"**
10. The room type is now available when creating Rooms and Rate Plans

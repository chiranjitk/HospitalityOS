# Overbooking Settings

## Purpose

Overbooking Settings configure the property's strategy for accepting more bookings than physical room count — a common hotel industry practice to mitigate revenue loss from cancellations and no-shows. This page allows revenue managers to enable/disable overbooking, set risk thresholds, define upgrade paths for overbooked guests, and manage blackout dates.

The system uses ML-driven cancellation risk prediction to make intelligent overbooking decisions, maximizing occupancy without causing guest walk-outs.

## Features

- **Enable/Disable Overbooking**: Property-level toggle for the overbooking strategy
- **Maximum Overbooking Percentage**: Global cap on how much inventory can be overbooked (default 5%)
- **Minimum Cancellation Risk Threshold**: ML confidence threshold for overbooking slot creation (default 0.15)
- **Allowed Room Types**: Granular control over which room types can be overbooked
- **Upgrade Paths**: Define room type upgrade cascades for overbooked guests (e.g., Deluxe → Suite)
- **Blacklist Dates**: Specific dates when overbooking is not allowed (holidays, full-house events)
- **Buffer Days**: Minimum days before check-in when overbooking slots stop being created
- **Auto-Overbooking Calculation**: System generates OverbookingSlots per room type per date with confidence scores

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/revenue/overbooking` | Get overbooking configuration for a property |
| `PUT` | `/api/revenue/overbooking` | Update overbooking configuration |
| `POST` | `/api/revenue/overbooking` | Create initial overbooking configuration |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | Yes | Property to manage overbooking for |

## Data Model

### `OverbookingConfig` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property (one config per property) |
| `enabled` | `boolean` | No | `false` | Master toggle for overbooking |
| `maxOverbookPercent` | `number` | No | `5` | Maximum overbooking as percentage (e.g., 5 = 5%) |
| `minCancellationRisk` | `number` | No | `0.15` | ML cancellation risk threshold for slot creation |
| `allowedRoomTypes` | `UUID[]` | No | `[]` | Array of roomTypeId values allowed to be overbooked |
| `upgradePaths` | `json[]` | No | `[]` | Array of upgrade path definitions |
| `blacklistDates` | `date[]` | No | `[]` | Dates when overbooking is disabled |
| `bufferDays` | `number` | No | `1` | Days before check-in when slot creation stops |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Upgrade Path Object

```json
{
  "fromRoomTypeId": "UUID",
  "toRoomTypeId": "UUID"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `fromRoomTypeId` | `UUID` | Room type being overbooked |
| `toRoomTypeId` | `UUID` | Room type to upgrade guest to when overbooked |

### `OverbookingSlot` Table (System-Generated)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Primary key |
| `propertyId` | `UUID` | FK to Property |
| `roomTypeId` | `UUID` | FK to RoomType |
| `date` | `date` | Specific date |
| `totalSlots` | `number` | Number of additional bookings allowed |
| `usedSlots` | `number` | Number of overbooking slots consumed |
| `confidenceScore` | `number` | ML-predicted cancellation probability |
| `createdAt` | `datetime` | Creation timestamp |

## Business Logic

### Configuration Rules

1. **One config per property**: Each property has exactly one `OverbookingConfig`. If none exists, the system uses defaults.
2. **Master toggle**: `enabled = false` disables all overbooking regardless of other settings.
3. **Percentage calculation**: `maxOverbookPercent` is applied to the room type's `totalRooms`. For 100 rooms at 5%, up to 5 additional bookings are allowed.
4. **Allowed room types**: Only room types listed in `allowedRoomTypes` are eligible for overbooking. If empty and `enabled = true`, all room types can be overbooked.
5. **Blacklist dates**: On these dates, no overbooking slots are created regardless of other settings.

### ML-Driven Overbooking

The system uses a cancellation risk prediction model to determine how many overbooking slots to create:

1. **Input features**: Historical cancellation rate, booking source, lead time, guest history, seasonal patterns, rate plan, length of stay.
2. **Output**: `confidenceScore` = predicted probability of cancellation (0.0 to 1.0).
3. **Slot creation logic**:
   - For each future date and each allowed room type, the ML model predicts cancellation risk.
   - If `confidenceScore >= minCancellationRisk`, an overbooking slot is created.
   - The number of slots is bounded by `maxOverbookPercent` of the room type's `totalRooms`.
4. **Buffer days**: No new overbooking slots are created for dates within `bufferDays` of today. This prevents overbooking guests who are about to arrive.

### Upgrade Path Logic

When a property is overbooked and a guest needs to be accommodated:

1. The system checks `upgradePaths` for the guest's booked room type.
2. If an upgrade path exists (`fromRoomTypeId` matches), the system checks if rooms of `toRoomTypeId` are available.
3. If available, the guest is upgraded at no additional cost (or at the original room type's rate).
4. Multiple upgrade paths can be defined to create cascading fallbacks (e.g., Standard → Deluxe → Suite).

### Interaction with Room Type Overbooking

- `RoomType.overbookingEnabled` and `RoomType.overbookingPercentage`/`overbookingLimit` provide per-type overrides.
- The property-level `OverbookingConfig.enabled` takes precedence: if disabled, per-type settings are ignored.
- If both property and room type settings allow overbooking, the more restrictive limit applies.

### Overbooking Slot Consumption

- Each booking that exceeds the physical room count consumes one overbooking slot.
- `usedSlots` increments on booking creation, decrements on booking cancellation.
- When `usedSlots >= totalSlots`, no more overbooking is allowed for that date/room type.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | Booking creation checks overbooking slots. If physical rooms are full but overbooking slots exist, the booking is allowed. Cancellation of overbooked bookings frees slots. |
| **Room Types** | Per-type overbooking settings interact with property-level config. Room type must be in `allowedRoomTypes` for overbooking. |
| **Availability API** | Available room count includes overbooking slots. `availableRooms = totalRooms + overbookingSlots - occupiedRooms`. |
| **Front Desk** | Check-in handles overbooked room assignments. If all rooms of the booked type are occupied, front desk uses upgrade paths to find alternative rooms. |
| **Revenue Management** | Overbooking configuration is part of the broader revenue strategy. ML model training uses historical booking and cancellation data. |
| **Room Rate Calendar** | Calendar may show overbooking indicators for dates where slots are active. |
| **Dashboard** | Overbooking statistics (used vs. available slots) displayed on operational dashboards. |

## User Flow

1. **Navigate to PMS → Overbooking Settings** from the main navigation sidebar
2. The page displays the current overbooking configuration for the selected property
3. **Enable overbooking** by toggling the master switch to `ON`
4. Set **Max Overbooking Percentage** (e.g., 5% — allows up to 5 extra bookings per 100 rooms)
5. Adjust **Minimum Cancellation Risk** threshold (e.g., 0.15 — only overbook when ML predicts >15% cancellation chance)
6. Select **Allowed Room Types**: check which room types can be overbooked
7. Define **Upgrade Paths**: for each overbookable room type, select the upgrade target
   - Example: Deluxe King → Executive Suite
   - Example: Standard Twin → Deluxe King
8. Add **Blacklist Dates**: select dates when overbooking should not occur (e.g., Christmas, New Year's Eve)
9. Set **Buffer Days** (default 1): how many days before check-in to stop creating overbooking slots
10. Click **"Save Configuration"**
11. The system automatically generates overbooking slots for eligible future dates based on ML predictions
12. Monitor slot usage on the dashboard: available vs. consumed slots per date

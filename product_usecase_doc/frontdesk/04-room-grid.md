# Room Grid

> **Section ID**: `frontdesk-room-grid`

## Purpose

The Room Grid page provides a real-time visual overview of all rooms in the property, displayed as a color-coded grid organized by floor. It is the primary operational dashboard for front desk agents and managers to understand property occupancy at a glance — which rooms are available, occupied, dirty, under maintenance, or reserved for upcoming arrivals. The grid enables quick decision-making for room assignments, housekeeping prioritization, and availability assessment during walk-in requests.

The page solves the business problem of needing instant, comprehensive visibility into room status without querying individual room records. The visual format allows staff to identify patterns (e.g., all dirty rooms on floor 3), spot issues (maintenance blocks), and make faster decisions during peak operations.

## Key Features

- **Color-Coded Room Status**: Each room cell is color-coded by status for instant visual recognition
- **Floor Organization**: Rooms grouped by floor with floor headers; supports multi-floor properties
- **Status Filtering**: Filter the grid to show only rooms of a specific status (e.g., show only `available` rooms for walk-in)
- **Room Type Filtering**: Filter by room type (Standard, Deluxe, Suite) to narrow the view
- **Room Details Popup**: Click any room cell to see full details — room number, type, current guest, booking dates, housekeeping status, maintenance info
- **Housekeeping Integration**: Shows cleaning progress (cleaning → inspected) alongside room status for coordinated operations
- **Real-Time Updates**: Room status changes (check-in, check-out, housekeeping) are reflected immediately via WebSocket events
- **Occupancy Summary**: Header displays total rooms, occupied, available, dirty, and occupancy percentage
- **Quick Actions**: Right-click or hover actions for common tasks — assign room, mark dirty, report maintenance
- **Arrival/Departure Indicators**: Rooms flagged with upcoming check-ins (arriving today) or check-outs (departing today)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rooms` | List all rooms with status, type, floor, current guest |
| `GET` | `/api/rooms/available` | Get available rooms with optional date filtering |
| `GET` | `/api/rooms/[id]` | Get full room details with booking, housekeeping, maintenance info |

### Query Parameters (GET /api/rooms)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | Yes | Filter by property |
| `status` | `string` | No | Filter by room status (`available`, `occupied`, `dirty`, `cleaning`, `inspected`, `out_of_order`) |
| `floor` | `number` | No | Filter by floor number |
| `roomTypeId` | `UUID` | No | Filter by room type |
| `includeGuest` | `boolean` | No | Include current guest details for occupied rooms (default: true) |
| `includeHousekeeping` | `boolean` | No | Include housekeeping task status (default: true) |

### Response (GET /api/rooms — Room Grid Data)

```json
{
  "rooms": [
    {
      "id": "uuid",
      "roomNumber": "301",
      "floor": 3,
      "roomTypeId": "uuid",
      "roomTypeName": "Deluxe King",
      "status": "occupied",
      "currentGuest": {
        "firstName": "John",
        "lastName": "Doe",
        "checkIn": "2025-01-15",
        "checkOut": "2025-01-18",
        "isVip": false
      },
      "housekeeping": {
        "status": null,
        "lastCleaned": "2025-01-15T13:30:00Z"
      },
      "features": ["city_view", "king_bed", "mini_bar"],
      "maintenanceBlock": null
    }
  ],
  "summary": {
    "total": 120,
    "available": 18,
    "occupied": 82,
    "dirty": 12,
    "cleaning": 5,
    "inspected": 3,
    "outOfOrder": 0,
    "occupancyPercent": 68.3
  }
}
```

## Room Status Color Scheme

| Status | Color | Description |
|--------|-------|-------------|
| `available` | Green | Room is clean, inspected, and ready for check-in |
| `occupied` | Blue | Room is currently occupied by an in-house guest |
| `dirty` | Red/Orange | Guest has checked out; room needs cleaning |
| `cleaning` | Yellow | Housekeeping is actively cleaning the room |
| `inspected` | Teal | Room is clean and inspected; ready for check-in |
| `out_of_order` | Gray | Room is under maintenance or blocked |

## Business Logic

### Grid Rendering

1. **Floor grouping**: Rooms are grouped by floor number (ascending). Floors without rooms are skipped.
2. **Room ordering**: Within each floor, rooms are ordered by room number (ascending).
3. **Status priority**: When multiple statuses could apply (e.g., occupied + maintenance), the most restrictive status is displayed (out_of_order takes precedence).
4. **Arrival indicators**: Rooms with a confirmed booking checking in today show a green "arriving" badge.
5. **Departure indicators**: Rooms with a checked-in guest checking out today show an orange "departing" badge.

### Real-Time Updates

- Room status changes are pushed via WebSocket (`room.status.changed` event)
- The grid updates in real-time without page refresh
- A subtle animation highlights rooms that changed status in the last 30 seconds
- Occupancy summary recalculates on every status change

### Housekeeping Integration

- Rooms in `cleaning` status show the assigned housekeeper's name and estimated completion time
- Rooms in `dirty` status show how long they've been waiting (with urgency coloring)
- Clicking a `dirty` room can optionally create a housekeeping task directly from the grid

## Cross-Module Dependencies

| Module | Dependency | Direction |
|--------|------------|-----------|
| **PMS — Rooms** | Room status, floor, features, room type | Read |
| **PMS — Floor Plans** | Room positioning coordinates for visual layout | Read |
| **Bookings** | Current guest info, arrival/departure dates | Read |
| **Housekeeping** | Cleaning status, assigned housekeeper, task progress | Read/Write |
| **Maintenance** | Out-of-order blocks, estimated repair time | Read |
| **Guests** | Guest name, VIP status, loyalty tier for occupied rooms | Read |

## User Flow

1. **Open Room Grid** — Navigate to Front Desk → Room Grid from the sidebar
2. **View Property Overview** — See all rooms organized by floor with color-coded statuses
3. **Review Occupancy Summary** — Check header stats: total rooms, available, occupancy percentage
4. **Filter by Status** — Click a status filter (e.g., "Available") to show only ready rooms
5. **Filter by Floor** — Select a floor from the floor dropdown to focus on a specific area
6. **Inspect Room** — Click a room cell to open the details popup with full information
7. **Take Quick Action** — From the popup, assign room, report issue, or navigate to booking
8. **Monitor Real-Time** — Watch for live status changes as check-ins/check-outs/housekeeping updates occur

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full grid view, all quick actions, status overrides |
| Manager | `frontdesk.manage` | Full grid view, all quick actions |
| Front Desk Agent | `frontdesk.manage` | Grid view, room assignment, report maintenance |
| Housekeeping Supervisor | `housekeeping.manage` | Grid view, housekeeping task creation |
| Reservationist | `bookings.view` | Read-only grid view; no actions |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Property not found | `PROPERTY_NOT_FOUND` | Verify property selection; user may not have access |
| WebSocket disconnected | `WS_DISCONNECTED` | Grid shows last known state; auto-reconnects; manual refresh available |
| Room data stale | `DATA_STALE` | Indicator shown; click to force-refresh from server |
| No rooms on floor | `EMPTY_FLOOR` | Floor header shown with "No rooms" message |

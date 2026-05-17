# Inventory Calendar

## Purpose

The Inventory Calendar provides a visual, date-range overview of room availability across all room types. It is the primary tool used by reservationists and revenue managers to understand at a glance which dates have capacity, which are sold out, and which have maintenance or operational constraints. The calendar computes availability in real-time by combining room counts, booking occupancy, maintenance blocks, and inventory locks.

This page solves the business problem of answering "Do we have availability for X guests on Y dates?" — the most common question in hotel operations — without requiring staff to manually cross-reference multiple data sources.

## Features

- **Visual Calendar View**: Date-grid display showing availability status across a configurable date range
- **Room Type Breakdown**: Availability grouped by room type with daily counts
- **Real-time Computation**: Data computed from Room, Booking, and InventoryLock tables at query time
- **Status Indicators**: Daily counts for totalRooms, availableRooms, occupiedRooms, maintenanceRooms, dirtyRooms
- **Occupancy & Availability Rates**: Calculated percentages for each date
- **Date Range Selection**: Query up to 730 days (2 years) into the future
- **Cached Responses**: 30-second TTL cache per tenant for high-performance queries
- **Public Booking Engine Integration**: Separate public endpoint for guest-facing availability

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/availability` | Internal real-time availability (authenticated, full detail) |
| `GET` | `/api/booking-engine/availability` | Public availability for booking engine (guest-facing) |

### Query Parameters (Internal)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | Yes | Filter by property |
| `startDate` | `date` | Yes | Start of date range |
| `endDate` | `date` | Yes | End of date range (max 730 days from start) |
| `roomTypeId` | `UUID` | No | Filter by specific room type |

## Data Model

### Computed Availability Structure (Response)

The availability response is computed from multiple tables and returned as a structured object — not stored in a single table.

```
Availability {
  propertyId: UUID
  dateRange: { startDate, endDate }
  roomTypes: [
    {
      roomTypeId: UUID
      roomTypeName: string
      totalRooms: number
      dailyAvailability: [
        {
          date: "YYYY-MM-DD"
          totalRooms: number
          availableRooms: number
          occupiedRooms: number
          maintenanceRooms: number
          dirtyRooms: number
          occupancyRate: number        // percentage
          availabilityRate: number     // percentage
        }
      ]
    }
  ]
}
```

### Source Tables for Computation

| Table | Contribution |
|-------|-------------|
| `Room` | `totalRooms` per room type, `status` (maintenance/dirty rooms) |
| `Booking` | `occupiedRooms` (count of bookings overlapping each date) |
| `InventoryLock` | Rooms blocked from sale (maintenance/event/overbooking locks) |
| `MaintenanceBlock` | Rooms out of order due to active maintenance |

## Business Logic

### Availability Computation Algorithm

For each date in the requested range, for each room type:

1. **Total Rooms** = `SELECT COUNT(*) FROM Room WHERE roomTypeId = ? AND status NOT IN ('maintenance', 'out_of_order')`
2. **Occupied Rooms** = `SELECT COUNT(DISTINCT roomId) FROM Booking WHERE roomTypeId = ? AND checkIn <= date AND checkOut > date AND status IN ('confirmed', 'checked_in')`
3. **Maintenance Rooms** = Count of rooms in `maintenance` or `out_of_order` status with active MaintenanceBlocks
4. **Dirty Rooms** = Count of rooms with `status = 'dirty'` or `status = 'cleaning'`
5. **Available Rooms** = `totalRooms - occupiedRooms - lockedRooms`
6. **Occupancy Rate** = `(occupiedRooms / totalRooms) * 100`
7. **Availability Rate** = `(availableRooms / totalRooms) * 100`

### Caching Strategy

- Availability data is cached with a **30-second TTL per tenant**.
- Cache key includes `tenantId + propertyId + startDate + endDate + roomTypeId` (if provided).
- This reduces database load during high-traffic booking periods.
- Cache is invalidated on booking creation/cancellation, room status changes, and inventory lock changes.

### Date Range Limit

- Maximum query range is **730 days** (2 years) from the start date.
- Requests exceeding this limit are rejected with a 400 Bad Request error.

### Public vs. Internal Endpoint

| Aspect | Internal (`/api/availability`) | Public (`/api/booking-engine/availability`) |
|--------|-------------------------------|---------------------------------------------|
| Authentication | Required (staff) | Not required |
| Data Detail | Full counts, maintenance, dirty rooms | Available rooms only, no operational details |
| Room Status | All statuses visible | Only available/sellable status |
| Purpose | Operations, revenue management | Guest booking engine |

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | Bookings are the primary driver of `occupiedRooms`. New bookings reduce available count; cancellations increase it. |
| **Rooms** | Room table provides `totalRooms` per type and `maintenance`/`dirty` status counts. |
| **Inventory Locks** | Locked rooms (from Inventory Locking page) are excluded from available count. |
| **Booking Engine** | Public availability endpoint powers the guest-facing booking flow. Guests see available room types and dates. |
| **Front Desk** | Used during walk-in bookings and phone reservations to quickly check availability. |
| **Channel Manager** | Availability data is synced to OTAs (Booking.com, Expedia, etc.). Real-time or near-real-time sync. |
| **Revenue Management** | Occupancy rates feed revenue forecasting and pricing optimization algorithms. |
| **Dashboard** | Availability overview may be displayed on operational dashboards for quick status monitoring. |

## User Flow

1. **Navigate to PMS → Inventory Calendar** from the main navigation sidebar
2. Select the **Property** from the property selector (if multi-property)
3. Choose the **Date Range** using the date picker (defaults to current month)
4. Optionally filter by **Room Type** to focus on a specific category
5. The calendar renders with a color-coded grid:
   - **Green**: High availability (>50% available)
   - **Yellow**: Limited availability (20–50% available)
   - **Red**: Low/No availability (<20% or sold out)
   - **Gray**: Maintenance/out-of-order rooms
6. Hover over a date cell to see detailed breakdown: total, available, occupied, maintenance, dirty
7. Click on a date to drill down into specific room availability
8. Use the navigation arrows to scroll through months
9. Export availability data for reporting purposes (if available)
10. Cross-reference with Room Rate Calendar to see pricing alongside availability

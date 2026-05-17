# Availability Control

## Purpose

Availability Control provides granular, room-type-level management of sellable inventory. While the Inventory Calendar offers a read-only overview, Availability Control focuses on **active management** — setting restrictions, closing specific dates to arrivals or departures, managing allocation, and understanding booking patterns that affect availability.

This page is the revenue manager's control panel for fine-tuning which inventory is sellable, when, and under what conditions. It complements the Inventory Calendar with actionable controls.

## Features

- **Room Type Availability View**: Detailed availability breakdown per room type with booking list
- **Booking Pattern Analysis**: See individual bookings contributing to occupancy on each date
- **Date-level Restrictions**: Control arrival/departure restrictions per date per room type
- **Real-time Computation**: Availability computed from bookings, locks, and room status
- **Min Stay Control**: Set minimum length-of-stay requirements per room type
- **Closed-to-Arrival / Closed-to-Departure**: Restrict specific date patterns

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/availability` | Query availability with room type filter and control data |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | Yes | Filter by property |
| `roomTypeId` | `UUID` | **Yes** | Room type to control (required for this page) |
| `startDate` | `date` | Yes | Start of control range |
| `endDate` | `date` | Yes | End of control range |

## Data Model

### Computed Availability Control Structure (Response)

```
AvailabilityControl {
  roomTypeId: UUID
  roomTypeName: string
  totalRooms: number
  bookings: [
    {
      id: UUID
      guestName: string
      checkIn: date
      checkOut: date
      roomNumber: string
      status: string
      ratePlanName: string
    }
  ]
  dailyAvailability: [
    {
      date: "YYYY-MM-DD"
      totalRooms: number
      availableRooms: number
      occupiedRooms: number
      maintenanceRooms: number
      lockedRooms: number
      occupancyRate: number
      availabilityRate: number
    }
  ]
}
```

### Source Tables

| Table | Contribution |
|-------|-------------|
| `Room` | Total rooms, room status (maintenance/out_of_order/dirty) |
| `Booking` | Occupied rooms, booking details per date, guest information |
| `InventoryLock` | Locked rooms reducing available inventory |
| `MaintenanceBlock` | Rooms blocked due to maintenance |
| `PriceOverride` | Closed-to-arrival/departure and min stay restrictions |

## Business Logic

### Availability Computation

Availability is computed identically to the Inventory Calendar but with the following additions specific to this control view:

1. **Booking list inclusion**: Individual bookings overlapping the date range are returned with guest name, check-in/out dates, room number, and status — enabling staff to understand WHO is occupying inventory.
2. **Locked room tracking**: `lockedRooms` count explicitly shown per date, distinguishing between maintenance locks and event/overbooking locks.
3. **Room type focus**: This page always queries for a specific `roomTypeId`, providing deeper detail than the multi-type calendar view.

### Restriction Types

Restrictions are managed through related entities:

| Restriction | Source | Effect |
|-------------|--------|--------|
| **Min Stay** | `PriceOverride.minStay` | Bookings shorter than N nights are rejected for this date |
| **Closed to Arrival** | `PriceOverride.closedToArrival` | No check-ins allowed on this date |
| **Closed to Departure** | `PriceOverride.closedToDeparture` | No check-outs allowed on this date |
| **Inventory Lock** | `InventoryLock` | Room/room type blocked entirely for this date range |
| **Rate Plan Closure** | `RatePlan` inactive or no plans available | No bookable rates for this room type |

### Channel Manager Sync

- Availability restrictions (min stay, CTA, CTD) set here are synced to connected OTA channels.
- Changes propagate to Booking.com, Expedia, Airbnb, etc., ensuring consistency between direct and channel bookings.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | Bookings are the primary data source showing occupied inventory. New bookings must check availability before confirmation. |
| **Inventory Locking** | Inventory locks directly reduce available room count. Locked rooms are invisible to the booking engine. |
| **Rate Plans & Pricing** | Price overrides define CTA/CTD/min-stay restrictions. Rate plan availability affects whether a room type is bookable on a given date. |
| **Channel Manager** | Availability and restrictions are synced to OTAs in real-time or batch mode. |
| **Room Rate Calendar** | Pricing data alongside availability helps revenue managers understand rate-occupancy relationships. |
| **Front Desk** | Walk-in and phone bookings use availability control to determine what can be sold. |
| **Booking Engine** | Public booking engine respects all availability restrictions set through this page. |

## User Flow

1. **Navigate to PMS → Availability Control** from the main navigation sidebar
2. Select the **Property** and **Room Type** from dropdowns
3. Choose the **Date Range** for the control view (e.g., next 30 days)
4. The page displays a detailed availability grid for the selected room type
5. Review the **daily breakdown**: available, occupied, maintenance, locked counts
6. Click on a date to see the **booking list** — which guests are occupying rooms on that date
7. To set restrictions, navigate to the linked **Rate Plans → Price Overrides** to configure:
   - Minimum stay requirements
   - Closed-to-arrival dates
   - Closed-to-departure dates
8. To block inventory, navigate to **Inventory Locking** to create room or room-type level locks
9. Monitor the impact: restricted dates show reduced availability or are marked as non-bookable
10. Verify channel sync status to ensure OTA listings reflect current restrictions

# PMS Module Overview — Property Management System

## What is PMS?

The PMS (Property Management System) module is the operational backbone of StaySuite. It manages the complete inventory lifecycle of a hotel property — from defining physical properties and room categories, through room-level inventory and pricing, to availability control and in-stay room management. Every booking, every housekeeping task, every billing charge, and every guest interaction ultimately references data created within this module.

## Why This Module Exists

A hotel cannot operate without a structured inventory model. The PMS module solves the following core business problems:

1. **Property Configuration** — Hotels need to define their physical assets (buildings, floors, rooms) with attributes, capacities, and features before any commercial activity can occur.
2. **Inventory Visibility** — Reservationists and revenue managers need real-time, date-specific visibility into which rooms are available, occupied, or blocked.
3. **Pricing Strategy** — Hotels need flexible, multi-layered pricing (base rates, seasonal adjustments, promotions, derived plans) to maximize revenue per available room (RevPAR).
4. **Availability Control** — Rooms must be blockable for maintenance, events, or group holds — preventing over-commitment while maximizing sellable inventory.
5. **Operational Continuity** — Room status must be tracked throughout the guest lifecycle (clean → occupied → dirty → cleaning → inspected), feeding housekeeping and front desk workflows.
6. **In-Stay Flexibility** — Guests may request room type upgrades/downgrades mid-stay; the system must handle rate differences, approvals, and folio adjustments automatically.

---

## Entity Relationship Summary

```
Property (1) ──→ (N) RoomType
  │                   │
  │                   ├──→ (N) Room
  │                   │
  │                   ├──→ (N) RatePlan
  │                   │       └──→ (N) PriceOverride
  │                   │
  │                   ├──→ (N) InventoryLock
  │                   │
  │                   └──→ (N) PackagePlan (baseRoomTypeId)
  │                           └──→ (N) PackageRate
  │                                   └──→ (N) PackageComponent
  │
  ├──→ (N) FloorPlan
  │       └──→ (N) FloorPlanRoom ←── Room
  │
  ├──→ (N) OverbookingConfig
  │       └──→ (N) OverbookingSlot
  │
  ├──→ (N) RoomTypeChange (via Booking + Room)
  │
  └──→ (1) TaxSettings
```

### Core Entity Flow

```
Property → RoomType → Room → Booking (assigns room at check-in)
                            ↑
RatePlan (provides pricing) → Booking (references ratePlanId)
```

### Key Relationships

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| `Property` | `RoomType` | 1:N | A property has multiple room categories |
| `RoomType` | `Room` | 1:N | A room type contains multiple physical rooms |
| `RoomType` | `RatePlan` | 1:N | A room type can have multiple pricing plans |
| `RatePlan` | `PriceOverride` | 1:N | A rate plan can have date-specific price overrides |
| `Property` | `FloorPlan` | 1:N | A property has floor plans (one per floor) |
| `FloorPlan` | `FloorPlanRoom` | 1:N | Rooms are placed on floor plans with coordinates |
| `RoomType` | `InventoryLock` | 1:N | Room types can have date-range blocks |
| `Room` | `InventoryLock` | 1:N | Individual rooms can be locked |
| `Property` | `OverbookingConfig` | 1:1 | One overbooking strategy per property |
| `PackagePlan` | `RoomType` | N:1 | Packages reference a base room type |

---

## Data Dependency Chain

Data must be created in the following order. Downstream entities reference upstream entities by foreign key.

```
Step 1: Property
   ↓
Step 2: RoomType (requires propertyId)
   ↓
Step 3: Room (requires propertyId + roomTypeId)
   ↓
Step 4: RatePlan (requires roomTypeId)
   ↓  (parallel)
   ├── Step 5a: PriceOverride (requires ratePlanId)
   ├── Step 5b: InventoryLock (requires propertyId + roomId OR roomTypeId)
   ├── Step 5c: FloorPlan (requires propertyId)
   │              └── Step 5c-i: FloorPlanRoom (requires floorPlanId + roomId)
   ├── Step 5d: PackagePlan (requires propertyId + baseRoomTypeId)
   │              └── Step 5d-i: PackageRate (requires packageId)
   └── Step 5e: OverbookingConfig (requires propertyId)
```

### Critical Dependency Rules

| Rule | Description |
|------|-------------|
| **Property first** | All entities require a `propertyId`. Cannot create any PMS data without a property. |
| **RoomType before Room** | `Room.roomTypeId` is a required FK. Cannot create rooms before defining room types. |
| **RoomType before RatePlan** | `RatePlan.roomTypeId` is a required FK. Pricing requires a room category. |
| **Room before FloorPlan placement** | `FloorPlanRoom.roomId` references a room that must exist. |
| **RoomType before PackagePlan** | `PackagePlan.baseRoomTypeId` references a room type. |
| **RatePlan before PriceOverride** | `PriceOverride.ratePlanId` references a specific rate plan. |
| **Cannot delete with dependents** | Deleting a Property fails if rooms exist. Deleting a RoomType fails if rooms exist. Deleting a FloorPlan cascades to FloorPlanRoom entries. |

---

## Cross-Module Relationships

The PMS module is referenced by virtually every other module in StaySuite.

### Bookings Module

| PMS Entity | Booking Usage |
|------------|---------------|
| `Property` | Every booking belongs to a property (`booking.propertyId`) |
| `RoomType` | Bookings specify room type preference (`booking.roomTypeId`) |
| `RatePlan` | Bookings reference pricing plan (`booking.ratePlanId`) for rate calculation |
| `Room` | Assigned at check-in via front desk (`booking.roomId`) |
| `InventoryLock` | Checked before booking creation to prevent conflicts |
| `OverbookingSlot` | Consumed when booking exceeds physical capacity |

### Guests Module

| PMS Entity | Guest Usage |
|------------|-------------|
| `Property` | Guest profiles are property-scoped |
| `Room` | Assigned room links guest to physical location |
| `PackagePlan` | Guest packages determine included services |

### Front Desk Module

| PMS Entity | Front Desk Usage |
|------------|------------------|
| `Room` | Check-in assigns a room; check-out releases it |
| `Room.status` | Drives the room status board (available/occupied/dirty/cleaning/inspected) |
| `RoomTypeChange` | Handles in-stay room type upgrades/downgrades |
| `MaintenanceBlock` | Front desk can see and report room issues |
| `FloorPlan` | Visual room grid for quick room assignment |

### Housekeeping Module

| PMS Entity | Housekeeping Usage |
|------------|-------------------|
| `Room.status` | Triggers housekeeping tasks (`dirty` → `cleaning` → `inspected`) |
| `Room.floor` | Groups tasks by floor for efficient routing |
| `FloorPlan` | Visual floor layout for task assignment |
| `MaintenanceBlock` | Completed blocks set room to `dirty`, auto-creating housekeeping tasks |
| `RoomType` | Determines cleaning standards (suite vs. standard) |

### Billing / Financials Module

| PMS Entity | Billing Usage |
|------------|---------------|
| `RatePlan` | Determines room charge rate per night |
| `PriceOverride` | Date-specific rate adjustments |
| `RoomTypeChange.rateDifference` | Auto-posted to folio on room change approval |
| `TaxSettings` | Tax calculation applied to room charges |
| `Property.currency` | Determines billing currency |
| `MaintenanceBlock.estimatedCost/actualCost` | Maintenance cost tracking |

### Channel Manager / OTA Integration

| PMS Entity | Channel Manager Usage |
|------------|---------------------|
| `RoomType` | Mapped to OTA room categories |
| `RatePlan` | Base rates synced to OTAs |
| `PriceOverride` | Date-specific rates pushed to channels |
| `InventoryLock` | Reduces available inventory on OTAs |
| `Availability` | Real-time availability synced to channels |

### Revenue Management

| PMS Entity | Revenue Mgmt Usage |
|------------|-------------------|
| `RatePlan` | Rate strategy analysis and optimization |
| `PriceOverride` | Historical pricing patterns |
| `OverbookingConfig` | Overbooking risk management |
| `Availability` | Occupancy forecasting |
| `RoomRateCalendar` | Rate calendar for trend analysis |

---

## Page Index

The PMS module consists of 13 pages:

| # | Page | File | Primary Purpose |
|---|------|------|-----------------|
| 01 | Properties | `01-properties.md` | Root entity — define hotel properties |
| 02 | Room Types | `02-room-types.md` | Room categories with capacity and base pricing |
| 03 | Rooms | `03-rooms.md` | Physical room inventory and status tracking |
| 04 | Inventory Calendar | `04-inventory-calendar.md` | Visual date-range availability overview |
| 05 | Availability Control | `05-availability-control.md` | Granular availability restrictions and allocation |
| 06 | Inventory Locking | `06-inventory-locking.md` | Block rooms/room types from booking |
| 07 | Rate Plans & Pricing | `07-rate-plans-pricing.md` | Pricing strategy, promotions, derived rates |
| 08 | Overbooking Settings | `08-overbooking-settings.md` | ML-driven overbooking configuration |
| 09 | Floor Plans | `09-floor-plans.md` | Visual drag-and-drop room placement |
| 10 | Room Rate Calendar | `10-room-rate-calendar.md` | Calendar view of rates across all plans |
| 11 | Room Out-of-Order | `11-room-out-of-order.md` | Track unsellable rooms and maintenance |
| 12 | Package Plans | `12-package-plans.md` | Bundled room + service packages |
| 13 | Room Type Change | `13-room-type-change.md` | In-stay room type upgrade/downgrade |

---

## Module Architecture Notes

- **Tenant isolation**: All PMS data is scoped to a `tenantId`. Multi-property tenants can manage multiple properties from a single account.
- **Real-time updates**: Room status changes emit WebSocket events consumed by Front Desk, Housekeeping, and Dashboard modules.
- **Serializable transactions**: Inventory locks and availability checks use PostgreSQL serializable isolation to prevent double-booking.
- **Caching**: Availability data is cached with a 30-second TTL per tenant to handle high query volume from booking engine and channel manager.
- **Computed fields**: Many PMS responses include computed data (occupancy rates, effective prices, overbooking stats) that are calculated at query time rather than stored.

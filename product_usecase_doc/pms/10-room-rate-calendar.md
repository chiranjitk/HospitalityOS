# Room Rate Calendar

## Purpose

The Room Rate Calendar is the revenue manager's primary tool for viewing and editing rates across all rate plans by date. It presents a matrix-style calendar where rows represent rate plans and columns represent dates, showing base rates, override rates, availability restrictions, and inventory lock status in a single view. This enables revenue managers to make informed pricing decisions with full context.

This page solves the business problem of "What are we charging for each room type on each date, and are there any restrictions?" — the most frequently asked question in revenue management.

## Features

- **Calendar Matrix View**: Date-by-date display of rates across all active rate plans for a room type
- **Rate Comparison**: Side-by-side comparison of base rates, override rates, and effective rates
- **Inventory Lock Indicators**: Visual markers showing locked dates alongside rate data
- **Arrival/Departure Restrictions**: CTA (Closed to Arrival) and CTD (Closed to Departure) indicators
- **Min Stay Display**: Minimum stay requirements per date per plan
- **Bulk Rate Editing**: Set rates for a date range in a single operation
- **Availability Column**: Shows available room count per date alongside pricing

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rate-plans/bulk-rates` | View rates for room type across all plans by date range |
| `POST` | `/api/rate-plans/bulk-rates` | Bulk set/update rates for a date range |

### GET Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roomTypeId` | `UUID` | **Yes** | Room type to display rates for |
| `propertyId` | `UUID` | No | Filter by property |
| `startDate` | `date` | Yes | Start of calendar range |
| `endDate` | `date` | Yes | End of calendar range |

## Data Model

### Response Structure (Calendar Data)

```
BulkRatesResponse {
  roomTypeId: UUID
  roomTypeName: string
  propertyId: UUID
  dateRange: { startDate, endDate }
  rates: [
    {
      date: "YYYY-MM-DD"
      dayName: "Monday"          // Day of week
      plans: [
        {
          ratePlanId: UUID
          ratePlanName: string
          baseRate: number          // Rate plan's basePrice
          overrideRate: number|null // PriceOverride rate if exists
          closedToArrival: boolean  // From PriceOverride
          closedToDeparture: boolean // From PriceOverride
          minStay: number|null      // From PriceOverride
        }
      ]
      available: number            // Available rooms for this date
      locked: boolean              // Whether inventory is locked for this date
      lockReason: string|null      // Reason for lock if locked
    }
  ]
}
```

### Source Tables

| Table | Contribution |
|-------|-------------|
| `RatePlan` | `baseRate`, `ratePlanName`, `ratePlanId` |
| `PriceOverride` | `overrideRate`, `closedToArrival`, `closedToDeparture`, `minStay` |
| `Room` | Total room count per room type |
| `Booking` | Occupied rooms per date (for available calculation) |
| `InventoryLock` | `locked`, `lockReason` per date |

## Business Logic

### Rate Display Logic

For each date and rate plan:

1. **Base Rate**: Always displayed from `RatePlan.basePrice`.
2. **Override Rate**: If a `PriceOverride` exists for this `ratePlanId` + `date`, the override rate is shown. Otherwise `null`.
3. **Effective Rate**: The rate actually charged to guests:
   - If override exists → override rate (then pricing rules applied)
   - If no override → base rate (then pricing rules applied)
4. **Day Name**: Computed from the date for easy pattern recognition (weekends vs. weekdays).

### Restriction Indicators

| Indicator | Source | Visual |
|-----------|--------|--------|
| **CTA** (Closed to Arrival) | `PriceOverride.closedToArrival` | Red arrow icon on date |
| **CTD** (Closed to Departure) | `PriceOverride.closedToDeparture` | Red arrow icon on date |
| **Min Stay** | `PriceOverride.minStay` | Number badge on date |
| **Locked** | `InventoryLock` active on date | Gray overlay or lock icon |
| **Available** | Computed from rooms - bookings - locks | Green/Yellow/Red count |

### Inventory Lock Integration

- The calendar checks `InventoryLock` records overlapping each date.
- If a lock exists for the room type on a date:
  - `locked = true`
  - `lockReason` = `InventoryLock.reason`
  - `available` reflects the reduced inventory
- Locked dates are visually distinguished to prevent revenue managers from setting rates on non-sellable dates.

### Bulk Rate Update Rules

When using `POST /api/rate-plans/bulk-rates`:

1. The request must include: `roomTypeId`, `startDate`, `endDate`, and an array of rate updates.
2. Each rate update specifies: `ratePlanId`, `date`, `rate` (optional), `closedToArrival` (optional), `closedToDeparture` (optional), `minStay` (optional).
3. The system creates or updates `PriceOverride` records as needed.
4. If a `rate` is provided, a `PriceOverride` is created/updated for that ratePlan + date.
5. If only restrictions are provided (CTA/CTD/minStay) without a rate, the existing override is updated or a new one created with the current base rate.
6. All updates within a single bulk request are executed atomically — either all succeed or all fail.

### Date Range Limits

- The calendar supports viewing and editing rates for any reasonable date range.
- Performance considerations: very large date ranges (>365 days) with many rate plans may require pagination or virtualized rendering.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Rate Plans & Pricing** | Source of rate plan definitions, base rates, and pricing engine rules. Price overrides created here modify rate plan behavior. |
| **Inventory Locking** | Lock status is displayed alongside rates. Locked dates affect sellable inventory. |
| **Availability API** | Available room count per date is computed and displayed. Low availability may trigger rate adjustments. |
| **Bookings** | Booking occupancy reduces available count. High occupancy on specific dates may prompt rate increases. |
| **Channel Manager** | Rates and restrictions from this calendar are synced to OTAs. Changes propagate to Booking.com, Expedia, etc. |
| **Revenue Management** | Historical rate and occupancy data from the calendar feeds revenue forecasting and pricing optimization algorithms. |
| **Booking Engine** | Public booking engine displays rates from this data. Guests see available plans, prices, and restrictions. |
| **Front Desk** | Front desk staff reference rates when quoting prices for walk-in and phone bookings. |

## User Flow

1. **Navigate to PMS → Room Rate Calendar** from the main navigation sidebar
2. Select the **Room Type** from the dropdown (required)
3. Select the **Property** if multi-property (optional, filters available room types)
4. Choose the **Date Range** using the date picker (e.g., next 90 days)
5. The calendar renders as a matrix:
   - **Rows**: Rate plans (Standard, Corporate, Summer Promo, etc.)
   - **Columns**: Dates
   - **Cells**: Base rate / override rate, with restriction badges
6. Review the matrix:
   - Cells showing override rates are highlighted differently from base rates
   - CTA/CTD indicators appear as icons on affected dates
   - Min stay badges show required nights
   - Locked dates have a distinct visual treatment
   - Available room count shown per date
7. **Single rate edit**: Click on a cell to edit the rate for that specific date and plan
   - Enter new rate, toggle CTA/CTD, set min stay
   - Click "Save" — a PriceOverride is created or updated
8. **Bulk rate edit**: Select multiple cells (drag or shift-click), then click "Bulk Edit"
   - Set a uniform rate or apply a rule (e.g., "+15% for all selected dates")
   - Click "Apply" — all overrides created in a single request
9. **Weekend highlighting**: Weekend dates are visually distinguished for easy pattern recognition
10. Navigate between months using arrows or jump to a specific date
11. Use the availability column to identify high-demand dates and adjust pricing accordingly

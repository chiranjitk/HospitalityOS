# Rate Plans & Pricing

## Purpose

Rate Plans & Pricing is the revenue management engine of the PMS. It defines how much each room type costs, under what conditions (seasonal, promotional, LOS-based), and through what pricing strategies (derived rates, discounts, overbooking surcharges). Rate plans bridge room inventory to commercial transactions — every booking references a rate plan to determine the guest's nightly rate.

This page solves the business problem of managing complex, dynamic pricing across multiple room types, seasons, channels, and guest segments without manual spreadsheet calculations.

## Features

- **Create Rate Plan**: Define pricing strategies per room type with base rate, meal plan, stay rules, and promotion settings
- **Derived Rate Plans**: Auto-calculate rates from a parent plan (percentage or fixed adjustment)
- **Promotion Management**: Time-limited promotions with discount codes, percentage or fixed amounts
- **Meal Plan Configuration**: Room-only, bed & breakfast, half board, full board, all-inclusive
- **Stay Restrictions**: Minimum/maximum stay, advance booking days
- **Cancellation Policy**: Per-plan cancellation terms
- **Bulk Rate Management**: Get or set rates for a date range across all active plans in a single request
- **Price Overrides**: Date-specific pricing with CTA/CTD and min stay restrictions
- **Pricing Engine**: Rules-based pricing computation (discount, surcharge, early bird, last minute, LOS graduated, weekend, seasonal, promo code, occupancy, advance booking)
- **Effective Price Calculation**: Computed field showing the final rate after all adjustments

## API Endpoints

### Rate Plans CRUD

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rate-plans` | List all rate plans (filterable by `roomTypeId`, `propertyId`) |
| `POST` | `/api/rate-plans` | Create a new rate plan |
| `GET` | `/api/rate-plans/[id]` | Get single rate plan with computed fields |
| `PUT` | `/api/rate-plans/[id]` | Update rate plan |
| `DELETE` | `/api/rate-plans/[id]` | Delete rate plan |

### Bulk Rates

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rate-plans/bulk-rates` | Get date-by-date rates for room type across all active plans |
| `POST` | `/api/rate-plans/bulk-rates` | Bulk set rates for a date range |

### Price Overrides

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/price-overrides` | List price overrides (filterable by `ratePlanId`, date range) |
| `POST` | `/api/price-overrides` | Create a price override |
| `GET` | `/api/price-overrides/[id]` | Get single override |
| `PUT` | `/api/price-overrides/[id]` | Update override |
| `DELETE` | `/api/price-overrides/[id]` | Delete override |

## Data Model

### `RatePlan` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `roomTypeId` | `UUID` | **Yes** | — | FK to RoomType |
| `name` | `string` | **Yes** | — | Display name (e.g., "Summer Saver", "Corporate Rate") |
| `code` | `string` | **Yes** | — | Short code, unique per tenant+roomType |
| `basePrice` | `number` | **Yes** | — | Default nightly rate |
| `currency` | `string` | No | Property default | ISO 4217 currency code |
| `mealPlan` | `enum` | No | `"room_only"` | `room_only`, `bed_breakfast`, `half_board`, `full_board`, `all_inclusive` |
| `minStay` | `number` | No | — | Minimum nights required |
| `maxStay` | `number` | No | — | Maximum nights allowed |
| `advanceBookingDays` | `number` | No | — | Minimum days in advance to book |
| `cancellationPolicy` | `string` | No | — | Free-text or structured cancellation terms |
| `promoCode` | `string` | No | — | Unique promo code for discounted access |
| `discountPercent` | `number` | No | — | Percentage discount (0–100) |
| `discountAmount` | `number` | No | — | Fixed amount discount |
| `promoStart` | `datetime` | No | — | Promotion start date/time |
| `promoEnd` | `datetime` | No | — | Promotion end date/time |
| `derivedFromId` | `UUID` | No | — | FK to parent RatePlan (for derived plans) |
| `derivationType` | `enum` | No | — | `percentage`, `fixed` |
| `derivationValue` | `number` | No | — | Derivation amount (e.g., 10 for 10%, or 50 for $50 adjustment) |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### `PriceOverride` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `ratePlanId` | `UUID` | **Yes** | — | FK to RatePlan |
| `date` | `date` | **Yes** | — | Specific date for the override |
| `rate` | `number` | **Yes** | — | Override rate for this date |
| `minStay` | `number` | No | — | Min stay requirement for this date |
| `closedToArrival` | `boolean` | No | `false` | No arrivals allowed on this date |
| `closedToDeparture` | `boolean` | No | `false` | No departures allowed on this date |
| `createdAt` | `datetime` | Auto | `now()` | Updated timestamp |

### Computed Fields (RatePlan Response)

| Field | Type | Description |
|-------|------|-------------|
| `hasActivePromo` | `boolean` | `true` if `promoStart <= now <= promoEnd` and discount is set |
| `effectivePrice` | `number` | Final rate after applying all pricing rules |
| `discountDisplay` | `string` | Human-readable discount string (e.g., "15% off" or "$30 off") |

## Business Logic

### Creation Rules

1. **Required fields**: `roomTypeId`, `name`, `code`, `basePrice` are mandatory.
2. **Code uniqueness**: The `code` must be unique per tenant + roomType combination. Two rate plans for the same room type cannot share a code.
3. **Room type scope**: The `roomTypeId` must belong to a valid room type within the tenant's properties.

### Derived Rate Plans

Derived plans automatically calculate their `basePrice` from a parent plan:

| Derivation Type | Formula | Example |
|----------------|---------|---------|
| `percentage` | `parent.basePrice * (1 - derivationValue / 100)` | Parent = $200, value = 10 → $180 |
| `fixed` | `parent.basePrice - derivationValue` | Parent = $200, value = $30 → $170 |

- `derivedFromId` references the parent rate plan.
- Changes to the parent's `basePrice` do NOT automatically cascade to derived plans. Derived plans store their own computed `basePrice` at creation time.
- Circular derivation (A derives from B, B derives from A) must be prevented.

### Promotion Rules

- `discountPercent`: Must be between 0 and 100.
- `discountAmount`: Must be ≥ 0.
- A plan can have either a percentage discount OR a fixed amount discount (or neither), but typically not both.
- `promoEnd` must be > `promoStart`.
- `hasActivePromo` is computed: `promoCode` exists AND `promoStart <= now <= promoEnd` AND (`discountPercent > 0` OR `discountAmount > 0`).

### Stay Restrictions

| Restriction | Field | Behavior |
|-------------|-------|----------|
| **Min Stay** | `minStay` | Booking length of stay must be ≥ `minStay` nights |
| **Max Stay** | `maxStay` | Booking length of stay must be ≤ `maxStay` nights |
| **Advance Booking** | `advanceBookingDays` | Check-in date must be at least N days from today |

### Cancellation Policy

- Stored as free text, allowing hotels to define custom terms.
- Displayed to guests during the booking process.
- Enforced at the booking modification/cancellation stage.

### Pricing Engine Rules

The pricing engine applies rules in priority order to compute the `effectivePrice`:

| Rule | Trigger | Effect |
|------|---------|--------|
| `discount` | `discountPercent` or `discountAmount` set | Reduces rate by percentage or fixed amount |
| `surcharge` | Weekend/holiday surcharge configured | Adds percentage or fixed amount |
| `early_bird` | Booking made > N days in advance | Applies early bird discount |
| `last_minute` | Booking made < N days before check-in | Applies last-minute rate |
| `long_stay` | Length of stay exceeds threshold | Applies LOS graduated discount |
| `weekend` | Check-in date falls on weekend | Applies weekend rate modifier |
| `seasonal` | Date falls within defined season | Applies seasonal rate |
| `promo_code` | Valid promo code applied at booking | Applies promotion discount |
| `occupancy` | Property occupancy exceeds threshold | Applies occupancy-based pricing |
| `advance_booking` | Based on `advanceBookingDays` | Controls rate visibility/availability |

### Bulk Rate Operations

- **GET bulk rates**: Returns a date-by-date array of rates for a specific room type across all active rate plans. Useful for populating the Room Rate Calendar.
- **POST bulk rates**: Allows setting rates for a date range in a single request. Efficient for seasonal rate updates affecting many dates.

### Price Override Constraints

- **Unique per ratePlan + date**: Only one override per rate plan per date is allowed.
- Overrides take precedence over the rate plan's `basePrice` for the specific date.
- If an override exists for a date, the `effectivePrice` uses the override rate, then applies any applicable pricing rules.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | `booking.ratePlanId` references a rate plan. The rate plan determines the nightly rate charged to the guest. Stay restrictions (minStay, maxStay, advanceBookingDays) are enforced during booking creation. |
| **Channel Manager** | Derives rates from master rate plans for OTA distribution. Each channel may have its own derived plan. |
| **Revenue Management** | Rate data feeds revenue forecasting, yield analysis, and pricing optimization. Historical rate and occupancy data drives algorithmic pricing suggestions. |
| **Billing** | Room charges on guest folios are based on the rate plan's effective price for each night of the stay. |
| **Room Rate Calendar** | Displays bulk rates and price overrides in a calendar view. The primary interface for revenue managers to view and edit rates. |
| **Availability Control** | Rate plan availability (active/inactive, seasonal) affects whether a room type is bookable. |
| **Booking Engine** | Public booking engine displays available rate plans with meal plans, prices, and stay restrictions. |
| **Package Plans** | Package pricing may reference rate plan rates for the room component. |

## User Flow

### Creating a Standard Rate Plan

1. **Navigate to PMS → Rate Plans & Pricing** from the main navigation sidebar
2. Click **"New Rate Plan"** to open the creation form
3. Select the **Room Type** from the dropdown
4. Fill in: Name (e.g., "Standard Rate"), Code (e.g., "STD"), Base Price (e.g., `12000`)
5. Select **Meal Plan**: room_only, bed_breakfast, half_board, full_board, or all_inclusive
6. Set optional stay restrictions: Min Stay (nights), Max Stay (nights), Advance Booking Days
7. Enter **Cancellation Policy** terms
8. Click **"Create Rate Plan"**

### Creating a Derived Rate Plan

1. From the rate plans list, click **"Create Derived Plan"**
2. Select the **Parent Plan** (e.g., "Standard Rate")
3. Set **Derivation Type**: percentage or fixed
4. Enter **Derivation Value**: e.g., 15 (for 15% off) or 2000 (for $20 off)
5. Name the derived plan (e.g., "Corporate Rate")
6. The system computes the derived `basePrice` automatically
7. Click **"Create"**

### Setting Up a Promotion

1. Edit an existing rate plan
2. Set `promoCode` (e.g., "SUMMER2024")
3. Set `discountPercent` (e.g., 15) or `discountAmount`
4. Set `promoStart` and `promoEnd` dates
5. Save — the promotion is active within the date window
6. `hasActivePromo` returns `true` during the active period

### Managing Bulk Rates

1. Select a room type and date range
2. Click **"Bulk Edit Rates"** to open the rate editor
3. Modify rates for individual dates or apply a rule (e.g., "+20% for weekends")
4. Click **"Save"** — all rates are updated in a single request

### Setting Price Overrides

1. Select a rate plan
2. Click **"Add Price Override"**
3. Select the **Date** and set the **Override Rate**
4. Optionally set: Min Stay, Closed to Arrival, Closed to Departure
5. Save — the override applies for that specific date

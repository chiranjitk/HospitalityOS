# Package Plans

## Purpose

Package Plans allow hotels to create sellable bundles that combine a room with additional services — meals, spa treatments, airport transfers, minibar, late checkout, etc. Packages are a key revenue driver in the hospitality industry, enabling upselling, creating differentiated offerings, and increasing average daily rate (ADR) without requiring additional room inventory.

This page solves the business problem of defining, pricing, and managing these bundled offerings as a cohesive product that can be sold through the booking engine, front desk, and channel partners.

## Features

- **Create Package Plan**: Define a new package with room type, validity dates, pricing, and components
- **Component Management**: Add included and add-on components (meals, experiences, spa, transfers, etc.)
- **Seasonal Package Rates**: Date-specific pricing for packages across different seasons
- **Package Status Control**: Activate/deactivate packages for sale
- **Room Rate Inclusive Option**: Include room rate in package total or price room separately
- **Nightly Limits**: Set minimum and maximum nights for package stays
- **Sort Order**: Control display order in the booking engine
- **Component Cost Tracking**: Track per-component unit costs for margin analysis

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/packages` | List all packages (filterable by `propertyId`, `status`) |
| `POST` | `/api/packages` | Create a new package plan |
| `GET` | `/api/packages/[id]` | Get single package with components |
| `PUT` | `/api/packages/[id]` | Update package details |
| `DELETE` | `/api/packages/[id]` | Delete package plan |
| `GET` | `/api/packages/[id]/components` | Get components for a package |
| `POST` | `/api/packages/rates` | Create a seasonal package rate |
| `GET` | `/api/packages/rates/[id]` | Get single package rate |
| `PUT` | `/api/packages/rates/[id]` | Update package rate |
| `DELETE` | `/api/packages/rates/[id]` | Delete package rate |

## Data Model

### `PackagePlan` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `name` | `string` | **Yes** | — | Display name (e.g., "Honeymoon Escape", "Business Executive") |
| `baseRoomTypeId` | `UUID` | **Yes** | — | FK to RoomType (primary room type for package) |
| `description` | `string` | No | — | Rich text description for marketing/booking engine |
| `roomRateInclusive` | `boolean` | No | `true` | Whether total price includes room rate |
| `minNights` | `number` | No | `1` | Minimum stay length |
| `maxNights` | `number` | No | — | Maximum stay length (null = unlimited) |
| `totalBasePrice` | `number` | No | — | Total package base price (if roomRateInclusive) |
| `currency` | `string` | No | Property default | ISO 4217 currency code |
| `sortOrder` | `number` | No | `0` | Display order in booking engine |
| `status` | `enum` | No | `"active"` | `active`, `inactive`, `draft` |
| `startDate` | `date` | **Yes** | — | Package valid from |
| `endDate` | `date` | **Yes** | — | Package valid until |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### `PackageComponent` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `packageId` | `UUID` | **Yes** | — | FK to PackagePlan |
| `type` | `enum` | **Yes** | — | Component category |
| `referenceId` | `UUID` | No | — | FK to referenced entity (spa service, restaurant item, etc.) |
| `referenceName` | `string` | No | — | Display name of the referenced service |
| `includedQty` | `number` | **Yes** | `1` | Quantity included in package |
| `unitCost` | `number` | No | `0` | Cost per unit of this component |
| `isIncluded` | `boolean` | **Yes** | `true` | `true` = included in base price; `false` = optional add-on |
| `createdAt` | `datetime` | Auto | `now()` | Timestamp |

### Component Types

| Type | Description | Example |
|------|-------------|---------|
| `meal` | Restaurant meal or dining credit | "Dinner for 2 at rooftop restaurant" |
| `experience` | Activity or tour | "City walking tour", "Sunset cruise" |
| `spa` | Spa treatment or wellness service | "60-minute couples massage" |
| `airport_transfer` | Airport pickup/dropoff | "Round-trip airport transfer" |
| `minibar` | Minibar inclusion or credit | "Complimentary minibar" |
| `laundry` | Laundry service inclusion | "Daily laundry service" |
| `late_checkout` | Late checkout privilege | "Complimentary late checkout until 4PM" |
| `early_checkin` | Early check-in privilege | "Early check-in from 10AM" |
| `other` | Custom component | "Welcome fruit basket", "Champagne on arrival" |

### `PackageRate` Table (Seasonal Pricing)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `packageId` | `UUID` | **Yes** | — | FK to PackagePlan |
| `roomTypeId` | `UUID` | **Yes** | — | FK to RoomType (room type for this rate) |
| `startDate` | `date` | **Yes** | — | Seasonal rate start |
| `endDate` | `date` | **Yes** | — | Seasonal rate end |
| `price` | `number` | **Yes** | — | Package price for this season and room type |
| `currency` | `string` | No | Package default | ISO 4217 currency code |
| `createdAt` | `datetime` | Auto | `now()` | Timestamp |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `name`, `baseRoomTypeId`, `startDate`, `endDate` are mandatory.
2. **Date validation**: `endDate` must be ≥ `startDate`. The package is only bookable within this date range.
3. **Room type scope**: `baseRoomTypeId` must belong to the specified `propertyId`.

### Component Rules

- **Included vs. Add-on**: `isIncluded = true` means the component is part of the base package price. `isIncluded = false` means it's an optional add-on that guests can purchase separately.
- **Included quantity**: `includedQty` defines how many units are included (e.g., 2 spa treatments, 1 airport transfer).
- **Unit cost**: `unitCost` tracks the internal cost of providing the component, used for margin/profitability analysis. This is NOT the guest-facing price.
- **Reference linking**: `referenceId` and `referenceName` link the component to actual service entities (e.g., a specific spa treatment). This enables service delivery tracking.

### Pricing Model

| `roomRateInclusive` | Behavior |
|---------------------|----------|
| `true` | `totalBasePrice` includes both the room rate AND all included components. The guest pays one bundled price. |
| `false` | Room rate is charged separately (via rate plan). `totalBasePrice` covers only the components. The booking engine shows room rate + package supplement. |

### Seasonal Package Rates

- Package rates allow different pricing for different seasons and room types.
- A package can have multiple rates covering different date ranges.
- Date ranges must not overlap for the same `packageId` + `roomTypeId`.
- If no seasonal rate matches the booking dates, the `totalBasePrice` from the package is used as the fallback.

### Package Status

| Status | Behavior |
|--------|----------|
| `draft` | Package is being configured. Not visible in booking engine or front desk. |
| `active` | Package is available for booking. Shown in booking engine, front desk, and channels. |
| `inactive` | Package is temporarily disabled. Not bookable but data is preserved. |

### Night Restrictions

- `minNights`: Bookings must be at least N nights to qualify for the package.
- `maxNights`: Bookings must not exceed N nights (null = no maximum).
- Both restrictions are enforced during booking creation.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | Bookings can reference a `packageId`. The package determines included services and total pricing for the stay. |
| **Rate Plans** | When `roomRateInclusive = false`, the room rate is determined by the rate plan. Rate plans may offer special package-compatible rates. |
| **Billing** | Package charges are posted to the guest folio. Included components are non-billable; add-on components are charged separately. Package rate + room rate = total folio charges. |
| **Guest Experience** | Package components are delivered to the guest: spa reservations, restaurant bookings, airport transfers, minibar setup, late checkout, etc. Each component's `referenceId` links to the service delivery system. |
| **Room Types** | `baseRoomTypeId` anchors the package to a specific room category. Seasonal rates can extend the package to additional room types. |
| **Booking Engine** | Active packages are displayed to guests during the booking flow. Components are listed, pricing is shown, and availability is checked. |
| **Channel Manager** | Packages can be mapped to OTA "rate plans with extras". Package components may map to OTA add-on services. |
| **Revenue Management** | Package data feeds ADR and RevPAR analysis. Package uptake rates and component profitability are tracked. |
| **Properties** | `propertyId` scopes packages. Package validity dates operate within property timezone. |

## User Flow

### Creating a New Package

1. **Navigate to PMS → Package Plans** from the main navigation sidebar
2. Click **"New Package"** to open the creation form
3. Fill in the **Name** (e.g., "Romantic Honeymoon Package")
4. Select the **Base Room Type** (e.g., "Ocean Suite")
5. Set **Validity Dates**: start and end dates for package availability
6. Set **Stay Limits**: min nights (e.g., 2) and max nights (e.g., 7)
7. Toggle **Room Rate Inclusive**: yes (one bundled price) or no (room + components separate)
8. Enter **Total Base Price** if room rate is inclusive
9. Set **Status**: draft while configuring, active when ready to sell
10. Click **"Create Package"**

### Adding Components

1. Open the package and navigate to **"Components"** tab
2. Click **"Add Component"**
3. Select **Component Type**: meal, spa, airport_transfer, etc.
4. Link to the actual service via **Reference** (e.g., select a specific spa treatment)
5. Set **Included Quantity** (e.g., 2 for two spa sessions)
6. Enter **Unit Cost** for internal tracking (e.g., cost of one spa session)
7. Toggle **Is Included**: true (part of package) or false (optional add-on)
8. Repeat for all components
9. The system calculates the total component cost for margin analysis

### Setting Seasonal Rates

1. Navigate to **"Rates"** tab of the package
2. Click **"Add Seasonal Rate"**
3. Select the **Room Type** (may differ from base room type)
4. Set the **Date Range** (e.g., Dec 20 – Jan 5 for holiday pricing)
5. Enter the **Price** for this season
6. Save — the rate applies to bookings within this date range for this room type

### Managing Package Lifecycle

1. Start in **draft** status while configuring components and rates
2. Test the package internally
3. Switch to **active** to make it available in the booking engine
4. Monitor uptake and profitability
5. Switch to **inactive** to stop selling (e.g., off-season)
6. Reactivate when the season returns

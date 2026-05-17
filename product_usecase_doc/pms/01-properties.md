# Properties

## Purpose

Properties are the root entity of the entire PMS system. A property represents a single hotel, resort, hostel, or serviced apartment building. Every other entity in StaySuite — rooms, bookings, guests, billing, housekeeping — belongs to a property. This page exists to allow hotel operators to create, configure, and manage their property(ies) within the system. Without a property, no other PMS operation can occur.

The page solves the business problem of multi-property management for hotel groups while supporting single-property operators with a straightforward setup flow.

## Features

- **Create Property**: Define a new hotel property with name, slug, location, and operational settings
- **Edit Property**: Update property details including contact info, branding, check-in/out times
- **Tax Settings Management**: Configure tax type (GST/VAT/Sales Tax), tax ID, default rates, service charges, and tax-inclusive pricing toggle
- **Property List**: View all properties with room and room type counts (`_count.rooms`, `_count.roomTypes`)
- **Delete Property**: Remove property with safety checks (blocked if active rooms or bookings exist)
- **Slug-based URL Identifier**: Unique URL-friendly slug for public-facing pages (`/^[a-z0-9-]+$/`)
- **Branding Configuration**: Primary/secondary brand colors for theming the booking engine and guest portal

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/properties` | List all properties for current tenant |
| `POST` | `/api/properties` | Create a new property |
| `GET` | `/api/properties/[id]` | Get single property with room/room type counts |
| `PUT` | `/api/properties/[id]` | Update property details |
| `DELETE` | `/api/properties/[id]` | Delete property (with dependency checks) |
| `GET` | `/api/properties/[id]/tax-settings` | Get tax configuration |
| `PUT` | `/api/properties/[id]/tax-settings` | Update tax configuration |

## Data Model

### `Property` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `name` | `string` | **Yes** | — | Display name (e.g., "The Grand Hotel") |
| `slug` | `string` | **Yes** | — | URL identifier, unique per tenant, regex `/^[a-z0-9-]+$/` |
| `address` | `string` | **Yes** | — | Street address |
| `city` | `string` | **Yes** | — | City |
| `country` | `string` | **Yes** | — | Country code or name |
| `checkInTime` | `string` | No | `"14:00"` | Standard check-in time |
| `checkOutTime` | `string` | No | `"11:00"` | Standard check-out time |
| `timezone` | `string` | No | `"UTC"` | IANA timezone identifier |
| `currency` | `string` | No | `"USD"` | ISO 4217 currency code |
| `totalFloors` | `number` | No | — | Number of floors in property |
| `primaryBrandColor` | `string` | No | — | Hex color for primary branding |
| `secondaryBrandColor` | `string` | No | — | Hex color for secondary branding |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### `TaxSettings` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `taxId` | `string` | No | — | Tax registration number |
| `taxType` | `enum` | No | `"none"` | `gst`, `vat`, `sales_tax`, `none` |
| `defaultTaxRate` | `number` | No | `0` | Default tax percentage |
| `taxComponents` | `json[]` | No | `[]` | Array of tax breakdown components |
| `serviceChargePercent` | `number` | No | `0` | Service charge added to bills |
| `includeTaxInPrice` | `boolean` | No | `false` | Whether displayed prices include tax |

### Computed Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `_count.rooms` | `number` | Total rooms belonging to this property |
| `_count.roomTypes` | `number` | Total room types belonging to this property |

## Business Logic

### Creation Rules

1. **Slug uniqueness**: The `slug` must be unique within the tenant. Validation regex: `/^[a-z0-9-]+$/`. Slugs cannot contain uppercase letters, spaces, or special characters.
2. **Required fields**: `name`, `slug`, `address`, `city`, `country` are mandatory for creation.
3. **Default operational settings**: If not provided, `checkInTime` defaults to `"14:00"`, `checkOutTime` to `"11:00"`, `timezone` to `"UTC"`, `currency` to `"USD"`.

### Deletion Protection

- **Cannot delete property with active rooms**: If `_count.rooms > 0`, the delete operation is rejected with a 409 Conflict error.
- **Cannot delete property with active bookings**: If any bookings reference this property, deletion is rejected.
- **Cascade behavior**: Deleting a property does NOT cascade-delete rooms, room types, or bookings. Deletion is blocked entirely until dependents are removed.

### Tax Settings

- Tax settings are stored as a separate entity linked to the property (one-to-one relationship).
- `taxComponents` is a JSON array allowing multi-component tax breakdowns (e.g., state tax + city tax + tourism levy).
- `includeTaxInPrice` affects how rates are displayed in the booking engine: when `true`, the displayed price already includes tax; when `false`, tax is added at checkout.

### Branding Colors

- `primaryBrandColor` and `secondaryBrandColor` are used to theme the booking engine, guest portal, and kiosk interfaces.
- Colors should be provided as hex strings (e.g., `"#1E40AF"`).

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **All PMS modules** | Every entity (RoomType, Room, RatePlan, etc.) requires `propertyId` as a foreign key |
| **Bookings** | `booking.propertyId` references the property; check-in/out times define booking window defaults |
| **Guests** | Guest profiles are scoped per property |
| **Front Desk** | Check-in/out times, timezone, and property branding drive the front desk interface |
| **Housekeeping** | Room status board groups rooms by property |
| **Billing** | `property.currency` determines billing currency; `TaxSettings` drive tax calculations on folios |
| **Channel Manager** | Property-level settings synced to OTAs (name, location, check-in/out times) |
| **Booking Engine** | Public availability endpoint groups by property; branding colors theme the public booking page |
| **Revenue Management** | Overbooking config is per-property |
| **Floor Plans** | `FloorPlan.propertyId` references the property |
| **Package Plans** | `PackagePlan.propertyId` references the property |

## User Flow

1. **Navigate to PMS → Properties** from the main navigation sidebar
2. Click **"New Property"** button to open the creation form
3. Fill in required fields: Property Name, Slug (auto-generated from name, editable), Address, City, Country
4. Optionally configure: Check-in/Check-out times, Timezone, Currency, Total Floors
5. Optionally set branding: Primary and secondary brand colors
6. Click **"Create Property"** — the property is created and appears in the list
7. Click the property card to open the detail view
8. Navigate to the **"Tax Settings"** tab to configure tax type, tax ID, default rate, service charge %, and tax components
9. Click **"Save Tax Settings"** to persist the configuration
10. The property is now ready — proceed to create Room Types under this property

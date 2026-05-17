# Group Bookings

> **Section ID**: `bookings-groups`

## Purpose

The Group Bookings page manages reservations for tour operators, corporate clients, event organizers, and other entities that require multiple rooms simultaneously. Unlike individual bookings, group bookings provide centralized management of contacts, contracts, deposits, room allocations, and rooming lists. Individual room bookings within the group are linked via `groupId`, with one booking marked as the group leader (`isGroupLeader: true`).

This page solves the business problem of managing complex multi-room reservations that would be cumbersome to handle as separate individual bookings. Groups often require negotiated rates, deposit tracking, contract management, and coordinated check-in/out — all of which are centralized here.

## Key Features

- **Create Group Booking**: Define a group with name, property, dates, room count, contact information, and total amount
- **Edit Group Booking**: Update group details, contacts, dates, and status
- **Delete Group Booking**: Remove group (blocked if associated bookings exist)
- **Status Lifecycle**: Track groups through inquiry → tentative → confirmed → in_progress → completed → cancelled
- **Contact Management**: Store group contact name, email, and phone for communication
- **Contract Management**: Upload contract URL and track contract signing date
- **Deposit Tracking**: Set deposit amount and track payment status (`depositPaid` boolean)
- **Room Booking**: Book multiple individual rooms within the group via the book-rooms endpoint
- **Room Release**: Release unsold rooms back to inventory before arrival via cutoff date
- **Rooming List**: Upload and manage rooming list URL for guest assignments
- **Search & Filter**: Search by group name, contact name, or contact email; filter by status and property

## API Endpoints

### Group Bookings CRUD

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/group-bookings` | List all group bookings (filterable by `status`, `propertyId`, `search`) |
| `POST` | `/api/group-bookings` | Create a new group booking |
| `PUT` | `/api/group-bookings` | Update an existing group booking |
| `DELETE` | `/api/group-bookings` | Delete a group booking (blocked if bookings exist) |
| `GET` | `/api/group-bookings/[id]` | Get single group booking with details |
| `DELETE` | `/api/group-bookings/[id]` | Delete group booking by ID |

### Room Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/group-bookings/book-rooms` | Book individual rooms within a group |
| `POST` | `/api/group-bookings/release-rooms` | Release unsold rooms back to inventory |

### Query Parameters (GET /api/group-bookings)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `string` | No | Filter by group status (inquiry, tentative, confirmed, in_progress, completed, cancelled) |
| `propertyId` | `UUID` | No | Filter by property |
| `search` | `string` | No | Search across group name, contact name, contact email |
| `limit` | `number` | No | Results per page (max 100) |
| `offset` | `number` | No | Results offset for pagination |

## Data Model

### `GroupBooking` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `name` | `string` | **Yes** | — | Group display name (e.g., "ABC Corp Annual Conference") |
| `description` | `string` | No | — | Group description or notes |
| `contactName` | `string` | No | — | Group contact person name |
| `contactEmail` | `string` | No | — | Group contact email (validated format) |
| `contactPhone` | `string` | No | — | Group contact phone |
| `checkIn` | `datetime` | **Yes** | — | Group check-in date |
| `checkOut` | `datetime` | **Yes** | — | Group check-out date |
| `totalRooms` | `number` | No | `1` | Total rooms allocated to the group |
| `bookedRooms` | `number` | Computed | — | Count of individual bookings linked via `groupId` |
| `totalAmount` | `number` | No | `0` | Total contract value for the group |
| `depositAmount` | `number` | No | `0` | Required deposit amount |
| `depositPaid` | `boolean` | No | `false` | Whether the deposit has been received |
| `status` | `string` | No | `"inquiry"` | Current group status |
| `contractUrl` | `string` | No | — | URL to the signed contract document |
| `contractSignedAt` | `datetime` | No | — | When the contract was signed |
| `cutoffDate` | `datetime` | No | — | Release unsold rooms X days before arrival |
| `releasedRooms` | `number` | No | `0` | Number of rooms released back to inventory |
| `roomingListUrl` | `string` | No | — | URL to the rooming list document |
| `notes` | `string` | No | — | Internal notes |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Group Status Lifecycle

| Status | Description | Transition To |
|--------|-------------|---------------|
| `inquiry` | Initial inquiry, no commitment | tentative, cancelled |
| `tentative` | Soft hold on rooms, pending confirmation | confirmed, cancelled |
| `confirmed` | Contract signed, deposit may be required | in_progress, cancelled |
| `in_progress` | Guests are currently checking in/staying | completed, cancelled |
| `completed` | All guests have checked out, group stay concluded | — (terminal) |
| `cancelled` | Group booking cancelled | — (terminal) |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `name`, `checkIn`, `checkOut` are mandatory.
2. **Date validation**: `checkOut` must be after `checkIn`.
3. **Property validation**: The property must belong to the tenant.
4. **Email validation**: If `contactEmail` is provided, it must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
5. **Numeric constraints**: `totalRooms` must be ≥ 1; `totalAmount` and `depositAmount` must be ≥ 0.
6. **Default status**: New groups are created with status `"inquiry"`.

### Update Rules

1. **Tenant isolation**: Only groups belonging to the authenticated user's tenant can be updated.
2. **Status validation**: Only valid status values are accepted.
3. **Email re-validation**: Contact email is re-validated on update.
4. **Numeric constraints**: Same creation constraints apply to updated values.

### Deletion Protection

- **Cannot delete group with bookings**: If any `Booking` records reference the group via `groupId`, deletion returns a 400 error with code `HAS_BOOKINGS`.
- All individual bookings must be cancelled or removed before the group can be deleted.

### Booking Individual Rooms

When booking rooms within a group (`POST /api/group-bookings/book-rooms`):

1. Individual `Booking` records are created with `groupId` set to the group's ID.
2. The first booking in the group is marked `isGroupLeader: true`.
3. Each booking follows standard booking creation rules (availability, conflicts, pricing).
4. The `bookedRooms` count is computed from the number of linked bookings.

### Cutoff Date & Room Release

- The `cutoffDate` specifies when unsold rooms in the group allocation should be released back to general inventory.
- The `release-rooms` endpoint releases rooms that are still unbooked as of the cutoff date.
- Released rooms are tracked in `releasedRooms` and become available for other bookings.

### Statistics

The GET endpoint returns aggregated statistics:

| Stat | Description |
|------|-------------|
| `total` | Total group bookings matching filters |
| `inquiry` | Count of groups in inquiry status |
| `confirmed` | Count of confirmed groups |
| `cancelled` | Count of cancelled groups |
| `totalValue` | Sum of `totalAmount` across all matching groups |

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **PMS — Properties** | Groups are scoped to properties; property name displayed in list |
| **Bookings (Individual)** | Individual bookings linked via `groupId`; room booking creates standard bookings |
| **PMS — Room Types** | Room booking validates room type availability |
| **PMS — Rates** | Group rates may use negotiated rate plans |
| **Billing** | Group deposits tracked; folios created per individual booking |
| **Guests** | Individual booking guests linked to group member profiles |
| **Audit Logs** | Group creation, updates, and status changes are logged |

## User Flow

1. **Navigate to Bookings → Group Bookings** from the main navigation sidebar
2. The page displays a list of all groups with statistics (total, confirmed, cancelled, total value)
3. Click **"New Group"** to open the group creation form
4. Fill in required fields: Group Name, Property, Check-in Date, Check-out Date
5. Add contact information: Contact Name, Email, Phone
6. Set room allocation: Total Rooms, Total Amount, Deposit Amount
7. Click **"Create Group"** — group is created with status `inquiry`
8. To progress the group: update status to `tentative` → upload contract → mark `confirmed`
9. Click **"Book Rooms"** to create individual bookings within the group
10. For each room booking, select the guest, room type, and specific dates
11. The first booking is automatically marked as the group leader
12. Track deposit payment status — update `depositPaid` when deposit is received
13. If some rooms remain unbooked, set a cutoff date and release unsold rooms
14. After all guests check out, update status to `completed`

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.bookings` | Full CRUD on all group bookings |
| Front Desk | `bookings.manage` | Create, edit, delete groups; book rooms |
| Reservationist | `bookings.manage` | Create and manage groups; book rooms |
| Sales Manager | `bookings.manage` | Create groups, negotiate contracts, track deposits |
| Revenue Manager | `bookings.view` | Read-only access for revenue analysis |

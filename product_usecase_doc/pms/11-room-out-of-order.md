# Room Out-of-Order

## Purpose

Room Out-of-Order manages rooms that cannot be sold due to maintenance, renovation, deep cleaning, inspection, or quarantine. This page provides a focused interface for tracking the full lifecycle of out-of-order rooms — from reporting the issue, through prioritizing and scheduling the fix, to completing the work and returning the room to sellable status.

This page solves the business problem of preventing unsellable rooms from appearing in availability, while maintaining a structured workflow for issue resolution with cost tracking and accountability.

## Features

- **Create Maintenance Block**: Report a room issue with reason, priority, date range, and cost estimates
- **Priority Management**: Classify blocks as normal, high, or urgent
- **Status Lifecycle**: Track blocks through scheduled → active → completed/cancelled
- **Auto Room Status Update**: Creating/completing/cancelling blocks automatically updates `Room.status`
- **Completion Workflow**: Mark blocks complete, triggering room status → dirty (for housekeeping)
- **Cancel Workflow**: Cancel blocks, restoring room to available if no other blocks remain
- **Cost Tracking**: Record estimated and actual costs for maintenance work
- **Vendor Tracking**: Associate maintenance blocks with external vendors

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rooms/maintenance-blocks` | List all maintenance blocks (filterable by property, room, status, priority) |
| `POST` | `/api/rooms/maintenance-blocks` | Create a new maintenance block |
| `POST` | `/api/rooms/maintenance-blocks/[id]/cancel` | Cancel a maintenance block |
| `POST` | `/api/rooms/maintenance-blocks/[id]/complete` | Complete a maintenance block |

### Query Parameters (List)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `propertyId` | `UUID` | No | Filter by property |
| `roomId` | `UUID` | No | Filter by specific room |
| `status` | `enum` | No | Filter by status: `scheduled`, `active`, `completed`, `cancelled` |
| `priority` | `enum` | No | Filter by priority: `normal`, `high`, `urgent` |

## Data Model

### `MaintenanceBlock` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `roomId` | `UUID` | **Yes** | — | FK to Room |
| `propertyId` | `UUID` | Auto | — | FK to Property (derived from Room) |
| `reason` | `enum` | **Yes** | — | `maintenance`, `renovation`, `deep_cleaning`, `inspection`, `quarantine` |
| `priority` | `enum` | No | `"normal"` | `normal`, `high`, `urgent` |
| `startDate` | `datetime` | **Yes** | — | When block starts |
| `endDate` | `datetime` | **Yes** | — | Expected completion date |
| `estimatedCost` | `number` | No | — | Estimated cost of the work |
| `actualCost` | `number` | No | — | Actual cost after completion |
| `vendorId` | `UUID` | No | — | FK to Vendor (external contractor) |
| `status` | `enum` | Auto | `"scheduled"` | `scheduled`, `active`, `completed`, `cancelled` |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Reason Types

| Reason | Description | Typical Duration |
|--------|-------------|-----------------|
| `maintenance` | Repair of broken equipment (plumbing, electrical, HVAC) | Hours to days |
| `renovation` | Room remodeling or refurbishment | Days to weeks |
| `deep_cleaning` | Intensive cleaning beyond standard turnaround | Hours |
| `inspection` | Safety, quality, or regulatory inspection | Hours |
| `quarantine` | Health or contamination quarantine | Days to weeks |

### Priority Levels

| Priority | Description | SLA Expectation |
|----------|-------------|-----------------|
| `normal` | Routine maintenance, non-urgent | Scheduled within available capacity |
| `high` | Affects guest experience, should be addressed soon | Within 24–48 hours |
| `urgent` | Critical issue (safety hazard, complete room failure) | Immediate attention |

## Business Logic

### Creation Flow

1. Staff creates a maintenance block with `roomId`, `reason`, `priority`, `startDate`, `endDate`.
2. **Auto-activation check**: If `startDate <= now`:
   - `status` is set to `"active"`
   - `Room.status` is set to `"out_of_order"`
3. If `startDate > now`:
   - `status` is set to `"scheduled"`
   - `Room.status` remains unchanged (the room is still available until the block starts)
4. A scheduled block auto-activates when `startDate` arrives (via scheduled job or query-time check).

### Completion Flow

1. Staff calls `POST /api/rooms/maintenance-blocks/[id]/complete`.
2. `status` is set to `"completed"`.
3. `actualCost` can be provided at completion time.
4. **Room status side effect**: `Room.status` is set to `"dirty"`.
   - This triggers housekeeping notification/workflow automatically.
   - The room goes through: `dirty` → `cleaning` → `inspected` → `available`.
5. If other active blocks exist on the same room, the room remains out of order.

### Cancellation Flow

1. Staff calls `POST /api/rooms/maintenance-blocks/[id]/cancel`.
2. `status` is set to `"cancelled"`.
3. **Room status side effect**: The system checks if any OTHER active maintenance blocks exist on the same room.
   - **No other active blocks**: `Room.status` → `"available"`.
   - **Other active blocks exist**: `Room.status` remains unchanged (still blocked by other blocks).

### Status Transition Diagram

```
                  ┌──────────┐
          ┌───────│ scheduled│
          │       └────┬─────┘
          │            │ (startDate arrives)
          │            ▼
          │       ┌──────────┐
          │       │  active  │
          │       └──┬───┬───┘
          │          │   │
          │    ┌─────┘   └──────┐
          │    │                │
          │    ▼                ▼
          │ ┌──────────┐  ┌──────────┐
          └─│cancelled │  │completed │
            └──────────┘  └──────────┘
```

### Cost Tracking

- `estimatedCost`: Set at creation time. Used for budgeting and approval workflows.
- `actualCost`: Set at completion time. Compared against estimate for variance analysis.
- Both fields accept numeric values in the property's currency.
- Billing module can reference maintenance costs for financial reporting.

### Vendor Association

- `vendorId` links the maintenance block to an external vendor/contractor record.
- Used for tracking which contractor performed the work, for warranty claims, and for vendor performance analysis.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Rooms** | `Room.status` is automatically updated based on maintenance block lifecycle. Blocked rooms cannot be booked or assigned. |
| **Availability** | Out-of-order rooms (`Room.status = 'out_of_order'`) are excluded from available room counts. The Inventory Calendar reflects reduced availability. |
| **Bookings** | Out-of-order rooms cannot be booked. Booking creation checks room status. Existing bookings are not affected (already-assigned rooms). |
| **Housekeeping** | Completing a maintenance block sets room to `dirty`, automatically triggering a housekeeping cleaning task. This ensures the room is cleaned and inspected before returning to the sellable pool. |
| **Billing / Financials** | `estimatedCost` and `actualCost` can be tracked as maintenance expenses. Vendor costs can be posted to accounts payable. Financial reports include maintenance spending analysis. |
| **Front Desk** | Front desk room grid shows out-of-order rooms with reason and priority. Staff can report new issues directly. Walk-in bookings automatically exclude these rooms. |
| **Inventory Locking** | Maintenance blocks and inventory locks are complementary mechanisms. Maintenance blocks focus on room lifecycle; inventory locks focus on availability blocking. Both affect the same outcome (room unavailable for booking). |
| **Dashboard** | Out-of-order room count displayed on operational dashboards. Urgent blocks trigger alerts. |

## User Flow

### Reporting an Issue

1. **Navigate to PMS → Room Out-of-Order** from the main navigation sidebar
2. Click **"Report Issue"** to open the maintenance block form
3. Select the **Room** from the room picker (filterable by floor, room type)
4. Select the **Reason**: maintenance, renovation, deep_cleaning, inspection, or quarantine
5. Set **Priority**: normal, high, or urgent
6. Enter the **Date Range**: when the room will be unavailable
7. Optionally enter **Estimated Cost** and select a **Vendor**
8. Click **"Create Block"**
9. If the start date is now or past: room immediately goes to `out_of_order` status
10. If the start date is future: room remains available until the block activates

### Completing a Repair

1. From the maintenance blocks list, find the active block
2. Click **"Complete"** on the block
3. Optionally enter the **Actual Cost**
4. Confirm completion
5. Room status changes to `dirty`
6. Housekeeping team receives notification to clean the room
7. After cleaning and inspection, room returns to `available`

### Cancelling a Block

1. From the maintenance blocks list, find the block (scheduled or active)
2. Click **"Cancel"** on the block
3. Confirm cancellation
4. If no other active blocks exist on the room: status → `available`
5. If other blocks remain: room stays in current blocked status

### Monitoring & Reporting

1. View the **dashboard summary**: total blocks, active blocks, by priority
2. Filter blocks by status, priority, reason, or date range
3. Sort by priority to identify urgent issues first
4. Review cost variance: estimated vs. actual for completed blocks
5. Export data for management reporting

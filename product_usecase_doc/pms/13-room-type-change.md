# Room Type Change

## Purpose

Room Type Change handles the operational workflow when a guest needs to change their room type during an active stay — typically an upgrade to a higher category (e.g., Standard → Deluxe) or occasionally a downgrade (e.g., Suite → Deluxe due to maintenance). This page manages the full request lifecycle including approval workflow, rate difference calculation, and automatic folio posting.

This page solves the business problem of in-stay room modifications that affect pricing, inventory counts, and guest satisfaction — requiring proper approval, billing adjustments, and audit trails.

## Features

- **Create Room Type Change Request**: Submit a request to change a guest's room type mid-stay
- **Approval Workflow**: Request → Pending Approval → Approved / Rejected
- **Rate Difference Calculation**: Automatic computation of price difference between old and new room types
- **Auto Folio Posting**: Approved changes with positive rate difference are automatically charged to the guest's folio
- **Status Tracking**: Full lifecycle tracking from request to completion
- **Reason Recording**: Document the reason for the change (guest request, maintenance, upgrade)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/rooms/type-changes` | List all room type change requests (filterable by booking, room, status) |
| `POST` | `/api/rooms/type-changes` | Create a new room type change request |
| `POST` | `/api/rooms/type-changes/[id]/approve` | Approve a pending request (triggers side effects) |
| `GET` | `/api/pms/room-type-change` | List room type changes (alternative endpoint) |
| `POST` | `/api/pms/room-type-change/[id]` | Process room type change (alternative endpoint) |

## Data Model

### `RoomTypeChange` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | Auto | — | FK to Property (derived from booking) |
| `bookingId` | `UUID` | **Yes** | — | FK to Booking (the guest's active stay) |
| `roomId` | `UUID` | **Yes** | — | FK to Room (the physical room) |
| `oldRoomTypeId` | `UUID` | **Yes** | — | FK to RoomType (original room type) |
| `newRoomTypeId` | `UUID` | **Yes** | — | FK to RoomType (target room type) |
| `reason` | `string` | No | — | Explanation for the change |
| `rateDifference` | `number` | No | `0` | Price difference (positive = guest pays more) |
| `status` | `enum` | Auto | `"requested"` | `requested`, `pending_approval`, `approved`, `completed`, `rejected` |
| `requestedBy` | `UUID` | Auto | — | FK to User (who created the request) |
| `approvedBy` | `UUID` | No | — | FK to User (who approved, if applicable) |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### Status Enum

| Status | Description |
|--------|-------------|
| `requested` | Initial state — change has been submitted |
| `pending_approval` | Awaiting manager/supervisor approval |
| `approved` | Change approved, rate difference posted to folio |
| `completed` | Physical room change has been executed |
| `rejected` | Change request denied |

## Business Logic

### Creation Rules

1. **Required fields**: `bookingId`, `roomId`, `oldRoomTypeId`, `newRoomTypeId` are mandatory.
2. **Booking must be active**: The referenced booking must have a status that indicates an in-progress stay (e.g., `checked_in`).
3. **Room must belong to booking**: The `roomId` should be the room currently assigned to the booking.
4. **Old room type validation**: `oldRoomTypeId` should match the current room type of the assigned room.
5. **New room type must differ**: `newRoomTypeId` must be different from `oldRoomTypeId`.

### Rate Difference Calculation

The `rateDifference` is computed as:

```
rateDifference = newRoomTypeRate - oldRoomTypeRate
```

Where rates are determined by:
1. The guest's current rate plan (`booking.ratePlanId`)
2. The nightly rate for the remaining nights of the stay
3. Applied per remaining night in the booking

- **Positive rateDifference**: Guest pays extra (upgrade). Charged to folio.
- **Negative rateDifference**: Guest receives a credit (downgrade). Credited to folio.
- **Zero rateDifference**: No billing adjustment (same price, different room type).
- Rate difference can be manually overridden by the staff member creating the request.

### Approval Workflow

```
requested → pending_approval → approved → completed
                              ↘ rejected
```

1. **Request created**: Status = `requested`. If the system is configured to require approval, it moves to `pending_approval`. Otherwise, it may auto-approve.
2. **Approval**: A manager calls `POST /api/rooms/type-changes/[id]/approve`.
3. **Approval side effects**:
   - Status → `approved`
   - If `rateDifference > 0`: A charge is automatically posted to the guest's folio (billing module).
   - If `rateDifference < 0`: A credit is posted to the guest's folio.
   - `approvedBy` is set to the current user.
4. **Rejection**: Status → `rejected`. `approvedBy` is NOT set. No folio changes.

### Completion Flow

After approval, the physical room change is executed:
1. Staff assigns the guest to a new room of the new room type.
2. The old room's status changes to `dirty` (triggers housekeeping).
3. The new room's status changes to `occupied`.
4. Status → `completed`.

### Inventory Impact

| Change Type | Old Room Type | New Room Type |
|-------------|--------------|---------------|
| Upgrade | `totalRooms` effective count decreases by 1 | `totalRooms` effective count increases by 1 |
| Downgrade | `totalRooms` effective count increases by 1 | `totalRooms` effective count decreases by 1 |

Note: The actual `RoomType.totalRooms` field is NOT modified by room type changes. The change affects the specific room's `roomTypeId` association. The room's type is updated, and the room type's total rooms count is adjusted accordingly (decrement old, increment new).

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Bookings** | `bookingId` references the active guest stay. The booking's `roomTypeId` and `roomId` may be updated upon completion. Booking status must be `checked_in` for a room type change. |
| **Rooms** | `roomId` references the physical room being changed. The room's `roomTypeId` is updated to the new type upon completion. |
| **Room Types** | `oldRoomTypeId` and `newRoomTypeId` reference the room categories. Rate comparison uses rate plans associated with these types. `totalRooms` counts are adjusted. |
| **Rate Plans** | Rate difference is calculated using the guest's rate plan rates for both old and new room types. Rate plan determines the nightly rates for remaining nights. |
| **Billing** | Approved changes with non-zero rate difference automatically post charges or credits to the guest's folio. Description references the room type change. |
| **Front Desk** | Front desk staff initiate room type changes (guest requests upgrades). Front desk executes the physical room move after approval. |
| **Housekeeping** | Old room becomes `dirty` after guest moves, triggering a cleaning task. New room should already be `available` or `inspected`. |
| **Availability** | Room type availability is affected: one room moves from one type to another. This impacts availability counts for both room types on remaining dates of the stay. |
| **Guest Portal** | If the property allows it, guests may see the room type change reflected in their booking details. |

## User Flow

### Guest Requests an Upgrade

1. Guest contacts front desk requesting a room upgrade (e.g., from Standard to Deluxe)
2. Front desk staff **Navigate to PMS → Room Type Change** (or access from the booking detail page)
3. Click **"New Room Type Change"**
4. Select the **Booking** (the guest's current stay)
5. The **Room**, **Old Room Type**, and current rate are auto-populated from the booking
6. Select the **New Room Type** (e.g., "Deluxe King")
7. Enter the **Reason** (e.g., "Guest requested upgrade")
8. Review the calculated **Rate Difference** (e.g., +₹3,000/night for 2 remaining nights = ₹6,000)
9. Click **"Submit Request"** — status = `requested` or `pending_approval`

### Manager Approves

1. A manager views the pending request in the list
2. Reviews the details: guest, old/new room types, rate difference, reason
3. Click **"Approve"** (or "Reject")
4. On approval:
   - Status → `approved`
   - If rate difference > 0: ₹6,000 charge posted to guest's folio
   - Guest and staff are notified

### Physical Room Change Execution

1. Front desk staff identifies an available room of the new room type
2. Prepares the new room key/digital key
3. Guest moves to the new room
4. Staff updates the system:
   - Old room → `dirty` status (housekeeping triggered)
   - New room → `occupied` status
   - Booking updated with new `roomId` and `roomTypeId`
5. Status → `completed`
6. Change is recorded in the audit trail

### Forced Downgrade (Maintenance)

1. Maintenance reports that the guest's current room has an issue requiring relocation
2. Front desk creates a room type change request:
   - Reason: "Maintenance issue - AC failure"
   - New room type: same or lower category (based on availability)
3. If downgrade: rate difference may be negative (guest receives credit)
4. Manager approves (typically fast-tracked for maintenance situations)
5. Guest is moved to the new room with complimentary adjustment

# No-Show Automation

> **Section ID**: `bookings-no-show`

## Purpose

The No-Show Automation page configures and manages the automated detection of guests who fail to check in by their scheduled arrival deadline. When a confirmed booking passes its check-in time plus a configurable buffer period without the guest checking in, the system can automatically mark the booking as a no-show, apply penalty charges, and release the room for resale. This reduces the manual burden on front desk staff and ensures rooms are quickly made available for other guests.

The page solves the business problem of tracking no-shows manually — without automation, front desk staff must periodically scan confirmed bookings and check whether guests have arrived, leading to delayed room releases and lost revenue.

## Key Features

- **Per-Property Configuration**: Each property has independent no-show settings stored in `Property.noShowSettings`
- **Buffer Hours**: Configurable number of hours after check-in time before a booking is considered a no-show (0–24 hours, default 1)
- **Auto-Process Toggle**: Enable or disable automatic no-show processing per property
- **Notification Settings**: Enable or disable notifications when a no-show is detected
- **Cron Job**: Scheduled task (`POST /api/cron/no-show-detection`) runs hourly to scan and process no-shows
- **Dry Run Mode**: Test the detection logic without actually processing any bookings
- **Execution Status**: View last execution status and next scheduled run time
- **Penalty Application**: Automatically post penalty charges to guest folios
- **Room Release**: Automatically update room status to release for new bookings

## API Endpoints

### Settings Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/no-show/settings?propertyId=xxx` | Get no-show automation settings for a property |
| `PUT` | `/api/no-show/settings?propertyId=xxx` | Update no-show automation settings for a property |

### Cron Job

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/cron/no-show-detection` | Get last execution status and next scheduled run info |
| `POST` | `/api/cron/no-show-detection` | Trigger no-show detection and processing (requires cron secret) |

### Settings Request/Response

```json
// GET /api/no-show/settings?propertyId=xxx
{
  "success": true,
  "data": {
    "propertyId": "...",
    "propertyName": "The Grand Hotel",
    "noShowBufferHours": 1,
    "autoProcessNoShows": false,
    "noShowNotificationEnabled": true
  }
}

// PUT /api/no-show/settings?propertyId=xxx
// Request body: { "noShowBufferHours": 2, "autoProcessNoShows": true }
```

### Cron Request Body (POST)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dryRun` | `boolean` | No | If true, scan without processing (default `false`) |
| `tenantId` | `string` | No | Process a single tenant (omit to process all) |

### Cron Response

```json
{
  "success": true,
  "message": "Processed 15 bookings: 3 marked as no-show, 3 penalties applied, 3 rooms released",
  "data": {
    "processed": 15,
    "markedNoShow": 3,
    "penaltiesApplied": 3,
    "roomsReleased": 3,
    "details": {
      "noShows": [
        {
          "bookingId": "...",
          "confirmationCode": "SS-A1B2C3",
          "guestName": "John Doe",
          "roomNumber": "101",
          "penaltyAmount": 150.00
        }
      ],
      "skipped": ["reason1", "reason2"]
    }
  }
}
```

## Data Model

### No-Show Settings (stored in `Property.noShowSettings` JSON)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `noShowBufferHours` | `number` | `1` | Hours after check-in time before marking as no-show (0–24) |
| `autoProcessNoShows` | `boolean` | `false` | Whether to automatically process detected no-shows |
| `noShowNotificationEnabled` | `boolean` | `true` | Whether to send notifications when a no-show is detected |

### Settings Validation Rules

| Field | Validation |
|-------|------------|
| `noShowBufferHours` | Must be a number between 0 and 24 (inclusive) |
| `autoProcessNoShows` | Must be a boolean |
| `noShowNotificationEnabled` | Must be a boolean |

## Business Logic

### Settings Management

1. **Property isolation**: Settings are stored per-property in the `Property.noShowSettings` JSON column.
2. **Merge semantics**: PUT updates merge new values with existing settings. Omitting a field preserves its current value.
3. **Default values**: If `noShowSettings` is null or invalid JSON, defaults are used: `{"noShowBufferHours": 1, "autoProcessNoShows": false, "noShowNotificationEnabled": true}`.
4. **Audit logging**: Settings changes are logged to the audit log with module `settings`, action `settings_update`, entityType `property`.
5. **Tenant isolation**: Only users belonging to the property's tenant can view or update settings.

### No-Show Detection Algorithm

The cron job (`detectAndProcessNoShows`) executes the following logic:

1. **Fetch properties**: Get all properties where `autoProcessNoShows` is `true` (or all if processing a specific tenant).
2. **For each property**:
   a. Load `noShowSettings` from the property record.
   b. Calculate the deadline: `checkIn + noShowBufferHours`.
   c. Query confirmed bookings where `checkIn + buffer < now()` AND `status = 'confirmed'` AND `actualCheckIn IS NULL`.
3. **For each detected no-show**:
   a. Mark the booking status as `no_show`.
   b. Record `cancelledAt` timestamp.
   c. If `noShowNotificationEnabled`, send notification to guest.
   d. Apply penalty charge to the guest's folio (first night's room rate).
   e. Release the assigned room (update room status).
   f. Emit WebSocket event for real-time UI update.
   g. Create audit log entries.

### Auto-Process vs Manual

- **Auto-process enabled** (`autoProcessNoShows: true`): The cron job automatically marks no-shows, applies penalties, and releases rooms.
- **Auto-process disabled** (`autoProcessNoShows: false`): The cron job detects no-shows but only logs them. Staff must manually process each no-show from the front desk.

### Cron Security

- The POST endpoint requires an `Authorization: Bearer <CRON_SECRET>` header.
- `CRON_SECRET` is set via the `CRON_SECRET` environment variable.
- In development mode, a default secret (`dev-only-cron-secret`) is used.
- In production, the endpoint returns 403 if `CRON_SECRET` is not configured.

### Penalty Calculation

- Default penalty: first night's room rate (`Booking.roomRate / numberOfNights`).
- Penalties are posted to the booking's folio as a line item with category `no_show_penalty`.
- The folio balance is updated to reflect the penalty charge.

### Room Release

- When a no-show is processed, the assigned room's status is updated to `available` (or `dirty` if housekeeping needs to clean it first).
- The room becomes available for new bookings immediately.
- A WebSocket event is emitted to update the front desk room board and calendar view in real-time.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **PMS — Properties** | Settings stored per property; check-in times used to calculate deadlines |
| **Bookings (Calendar)** | No-show status changes reflected on the calendar view |
| **Front Desk** | Room status board updates when rooms are released; manual no-show processing |
| **Billing** | Penalty charges posted to guest folios |
| **Guests** | Notifications sent to guest contact information |
| **Housekeeping** | Room status changes may trigger housekeeping workflows |
| **Audit Logs** | All no-show processing operations are logged |

## User Flow

1. **Navigate to Bookings → No-Show Automation** from the main navigation sidebar
2. The page displays settings for the selected property
3. Configure **buffer hours**: Set how many hours after check-in to wait before marking a no-show (e.g., 2 hours)
4. Toggle **auto-process**: Enable to automatically mark no-shows and release rooms
5. Toggle **notifications**: Enable to send guest notifications on no-show detection
6. Click **"Save Settings"** — settings are persisted to the property record
7. View **execution history**: See the last cron run status (processed count, no-shows marked, penalties applied)
8. View **next scheduled run**: See when the next detection scan will occur
9. For testing: click **"Dry Run"** to scan without processing — see what would be detected
10. The cron job runs hourly (recommended schedule) and processes no-shows automatically

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.bookings` | View and configure no-show settings for all properties |
| Front Desk Manager | `bookings.manage` | Configure no-show settings; trigger manual processing |
| Front Desk Staff | `bookings.view` | View settings and execution status (read-only) |
| System | `CRON_SECRET` | Cron job authentication for automated processing |

# Audit Logs

> **Section ID**: `bookings-audit`

## Purpose

The Audit Logs page provides a comprehensive, immutable record of all system operations across StaySuite. Every significant action — booking creation, modification, cancellation, check-in, check-out, payment, configuration change, login, and more — is automatically logged with details about who performed the action, when it occurred, what changed, and from where. The page provides query, filtering, statistics, and export capabilities for operational debugging, regulatory compliance, dispute resolution, and security monitoring.

The page solves the business problem of traceability and accountability. Without an audit trail, hotels cannot answer "who changed this booking?", "when was this rate modified?", or "why was this guest charged?". Audit logs are essential for GDPR compliance, financial audits, staff accountability, and investigating security incidents.

## Key Features

- **Query Logs**: Search and filter audit logs by module, action, user, entity, date range, and free-text search
- **Create Manual Entry**: Manually create audit log entries for notes or compliance documentation
- **Statistics Dashboard**: View aggregated statistics including top entity types, top IP addresses, security events, and failed logins
- **Export**: Download audit logs in CSV or JSON format (up to 50,000 records)
- **Correlation IDs**: Track related operations across modules using `correlationId`
- **Immutable Trail**: Audit logs cannot be modified or deleted — entries are append-only
- **Security Event Tracking**: Dedicated tracking of login failures, data exports, permission changes
- **Pagination**: Cursor-based pagination with configurable page size

## API Endpoints

### Log Query & Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/audit-logs` | Query audit logs with filtering, search, and pagination |
| `POST` | `/api/audit-logs` | Create a manual audit log entry |
| `GET` | `/api/audit-logs/stats` | Get audit log statistics (top entities, IPs, security events) |
| `GET` | `/api/audit-logs/export` | Export audit logs in CSV or JSON format |

### Query Parameters (GET /api/audit-logs)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | `string` | No | Filter by module (bookings, settings, auth, security, billing, etc.) |
| `action` | `string` | No | Filter by action (create, update, delete, login_failed, etc.) |
| `userId` | `UUID` | No | Filter by user who performed the action |
| `entityType` | `string` | No | Filter by entity type (booking, property, guest, folio, etc.) |
| `entityId` | `UUID` | No | Filter by specific entity ID |
| `ipAddress` | `string` | No | Filter by IP address |
| `dateFrom` | `ISO date` | No | Start of date range |
| `dateTo` | `ISO date` | No | End of date range |
| `search` | `string` | No | Free-text search across log fields |
| `page` | `number` | No | Page number (default 1) |
| `limit` | `number` | No | Results per page (default 50) |
| `stats` | `boolean` | No | Return inline statistics (default `false`) |
| `days` | `number` | No | Days for statistics (default 30) |

### Export Parameters (GET /api/audit-logs/export)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | `string` | No | Export format: `csv` or `json` (default `json`) |
| `module` | `string` | No | Filter by module |
| `action` | `string` | No | Filter by action |
| `userId` | `UUID` | No | Filter by user |
| `entityType` | `string` | No | Filter by entity type |
| `dateFrom` | `ISO date` | No | Start of date range |
| `dateTo` | `ISO date` | No | End of date range |
| `limit` | `number` | No | Max records to export (default 10,000, max 50,000) |

### Create Entry Body (POST /api/audit-logs)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `module` | `string` | **Yes** | Module name (bookings, settings, auth, etc.) |
| `action` | `string` | **Yes** | Action performed (create, update, note, etc.) |
| `entityType` | `string` | **Yes** | Type of entity affected |
| `entityId` | `UUID?` | No | ID of the entity affected |
| `oldValue` | `any` | No | Previous value (JSON-serializable) |
| `newValue` | `any` | No | New value (JSON-serializable) |
| `correlationId` | `UUID?` | No | Correlation ID for tracing related operations |
| `metadata` | `any` | No | Additional metadata (JSON-serializable) |

## Data Model

### `AuditLog` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `userId` | `UUID?` | Auto | — | FK to User (null for system actions) |
| `module` | `string` | **Yes** | — | Module where the action occurred |
| `action` | `string` | **Yes** | — | Action performed |
| `entityType` | `string` | **Yes** | — | Type of entity affected |
| `entityId` | `UUID?` | Auto | — | ID of the entity affected |
| `oldValue` | `string?` | Auto | — | Previous value (JSON string) |
| `newValue` | `string?` | Auto | — | New value (JSON string) |
| `ipAddress` | `string?` | Auto | — | IP address of the requester |
| `userAgent` | `string?` | Auto | — | Browser/client user agent |
| `correlationId` | `UUID?` | Auto | — | Correlation ID for tracing |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp (immutable) |
| `user` | `User?` | Relation | — | User who performed the action (if not system) |
| `tenant` | `Tenant` | Relation | — | Tenant that owns this log |

### Computed Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `userName` | `string` | Display name of the user or "System" for automated entries |
| `oldValue` | `object` | Parsed JSON of the old value (null-safe) |
| `newValue` | `object` | Parsed JSON of the new value (null-safe) |

### Module Values

| Module | Description | Common Actions |
|--------|-------------|----------------|
| `bookings` | Booking operations | `create`, `update`, `cancel`, `check_in`, `check_out`, `no_show` |
| `settings` | Configuration changes | `settings_update`, `feature_flag_change` |
| `auth` | Authentication events | `login`, `login_failed`, `logout`, `password_change` |
| `security` | Security events | `data_export`, `permission_change`, `suspicious_activity` |
| `billing` | Financial operations | `charge_posted`, `payment_received`, `refund_issued`, `folio_closed` |
| `pms` | PMS operations | `room_status_change`, `inventory_lock`, `maintenance_create` |
| `guests` | Guest management | `profile_create`, `profile_update`, `kyc_complete` |

### Statistics Response Structure

```json
{
  "success": true,
  "data": {
    "totalLogs": 15420,
    "logsByModule": { "bookings": 5200, "auth": 3100, "billing": 2800, ... },
    "logsByAction": { "create": 4500, "update": 3200, "login": 2800, ... },
    "topIpAddresses": [
      { "ipAddress": "192.168.1.100", "count": 1250 },
      { "ipAddress": "10.0.0.5", "count": 890 }
    ],
    "topEntityTypes": [
      { "entityType": "booking", "count": 5200 },
      { "entityType": "folio", "count": 2100 }
    ],
    "securityEventsCount": 42,
    "failedLoginsCount": 15
  }
}
```

## Business Logic

### Automatic Logging

Audit entries are automatically created by the system for all significant operations:

1. **Booking operations**: Every booking create, update, cancel, check-in, check-out creates audit entries via `logBooking()`.
2. **Authentication**: Login attempts (successful and failed) are logged.
3. **Configuration changes**: Property settings, no-show settings, feature flags are logged with old and new values.
4. **Financial operations**: Folio charges, payments, and refunds are logged.
5. **Data exports**: Every audit log export is itself logged as a security event.

### Manual Entry Creation

Staff can create manual audit log entries for:

- Compliance notes (e.g., "Guest ID verified manually")
- Dispute documentation (e.g., "Guest complained about rate; offered 10% discount")
- Operational notes (e.g., "Room 102 AC reported broken, maintenance notified")
- Audit annotations (e.g., "Quarterly audit review completed")

**Security**: The `userId` field is always set to the authenticated user's ID, never from the request body. This prevents audit trail impersonation.

### Query Behavior

1. **Tenant isolation**: All queries are scoped to the authenticated user's `tenantId`.
2. **Immutable**: Audit logs cannot be updated or deleted — they are append-only.
3. **JSON parsing**: `oldValue` and `newValue` are stored as JSON strings in the database but returned as parsed objects in the API response.
4. **Pagination**: Results are paginated with `page` (default 1) and `limit` (default 50, max configurable).

### Export Behavior

1. **Format options**: CSV (comma-separated with proper escaping) or JSON (pretty-printed).
2. **Size limits**: Maximum 50,000 records per export to prevent memory issues.
3. **Self-logging**: Every export action is logged as a security event (`module: security`, `action: data_export`) with the format, record count, and applied filters.
4. **Filename**: Export files are named `audit-logs-YYYY-MM-DD.csv` or `audit-logs-YYYY-MM-DD.json`.
5. **CSV headers**: ID, Timestamp, User, User Email, Module, Action, Entity Type, Entity ID, IP Address, User Agent, Old Value, New Value, Correlation ID.

### Correlation IDs

Correlation IDs link related audit entries across modules. For example:

- A booking creation flow may have: rate plan query → availability check → booking create → folio create → notification send — all sharing the same `correlationId`.
- This enables tracing the full lifecycle of an operation across multiple modules.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **All Modules** | Every module creates audit entries for its operations |
| **Bookings** | Booking create, update, cancel, check-in, check-out logged automatically |
| **PMS** | Room status changes, inventory locks, maintenance operations logged |
| **Front Desk** | Check-in, check-out, room assignment operations logged |
| **Billing** | Charges, payments, refunds, folio operations logged |
| **Settings** | Configuration changes logged with old/new value diffs |
| **Auth** | Login/logout, permission changes, password resets logged |
| **Security** | Data exports, suspicious activities, permission changes logged |

## User Flow

1. **Navigate to Bookings → Audit Logs** (or Settings → Audit Logs) from the main navigation sidebar
2. The page displays a table of recent audit log entries with pagination
3. Use **filters** to narrow results: select module, action, entity type, or enter a specific entity ID
4. Use **date range picker** to focus on a specific time period
5. Use **search** for free-text search across all log fields
6. Click **"View Details"** on a log entry to see the full old/new value comparison
7. Click **"Create Entry"** to manually add a compliance note or operational annotation
8. Navigate to the **Statistics** tab to see the dashboard with top entity types, IP addresses, and security events
9. Click **"Export"** to download logs — choose CSV or JSON format, apply filters, set record limit
10. Use **correlation ID** to trace related operations — click the correlation ID to filter all logs with that ID

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.audit` | Full access to query, create, export, and view statistics |
| Front Desk Manager | `audit.view` | Query and view logs; cannot create manual entries or export |
| Auditor | `audit.view` + `audit.export` | Query and export logs for compliance review |
| Compliance Officer | `audit.view` + `audit.export` | Full query and export access for regulatory compliance |
| Security Analyst | `audit.view` | Query logs focused on security module events |
| Front Desk Staff | — | No direct access (operations logged automatically) |

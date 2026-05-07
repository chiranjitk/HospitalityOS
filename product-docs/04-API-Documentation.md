# StaySuite API Documentation
## REST API Reference

**Version**: v2.1  
**Base URL**: `https://api.staysuite.io/v1`  
**Last Updated**: July 2025

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Rate Limits](#2-rate-limits)
3. [Response Format](#3-response-format)
4. [Pagination](#4-pagination)
5. [Errors](#5-errors)
6. [API Route Registry](#6-api-route-registry)
7. [Bookings API](#7-bookings-api)
8. [Guests API](#8-guests-api)
9. [Rooms API](#9-rooms-api)
10. [Availability API](#10-availability-api)
11. [Payments API](#11-payments-api)
12. [Billing API Extensions](#12-billing-api-extensions)
13. [Housekeeping API Extensions](#13-housekeeping-api-extensions)
14. [Cron Jobs API](#14-cron-jobs-api)
15. [Travel Agents API](#15-travel-agents-api)
16. [WiFi API](#16-wifi-api)
17. [Webhooks](#17-webhooks)

---

## 1. Authentication

### 1.1 Session-Based Authentication

StaySuite uses custom session-based auth. Login via the API sets an httpOnly cookie:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@royalstay.in",
  "password": "admin123"
}
```

Response:
```json
{
  "user": {
    "id": "...",
    "email": "admin@royalstay.in",
    "firstName": "Rajesh",
    "lastName": "Sharma",
    "tenantId": "...",
    "isPlatformAdmin": false
  },
  "token": "..."
}
```

The session token is set as an `httpOnly` cookie. All subsequent requests must include this cookie.

### 1.2 API Key Authentication (for external integrations)

Include API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
X-Tenant-ID: YOUR_TENANT_ID
```

### 1.3 Scopes

| Scope | Description |
|-------|-------------|
| `bookings:read` | Read bookings |
| `bookings:write` | Create/update bookings |
| `guests:read` | Read guest data |
| `guests:write` | Create/update guests |
| `payments:read` | Read payments |
| `payments:write` | Process payments |
| `wifi:read` | Read WiFi sessions |
| `wifi:write` | Manage WiFi access |
| `rooms:read` | Read room data |
| `rooms:manage` | Manage rooms |
| `inventory:read` | Read inventory |
| `inventory:write` | Update inventory |

---

## 2. Rate Limits

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Starter | 60 | 1,000 |
| Professional | 300 | 10,000 |
| Enterprise | 1,000 | Unlimited |

Rate limit headers:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1678900000
```

---

## 3. Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## 4. Pagination

Query parameters:

| Parameter | Default | Max |
|-----------|---------|-----|
| `page` | 1 | - |
| `limit` | 20 | 100 |
| `sort` | created_at | - |
| `order` | desc | asc/desc |

---

## 5. Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": { "field": "check_in", "expected": "YYYY-MM-DD" }
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid/missing credentials |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 6. API Route Registry

The platform provides **617 API routes** across **134 directories**:

| Module | Routes | Directory |
|--------|--------|-----------|
| accounting | - | /api/accounting |
| activity | - | /api/activity |
| admin | - | /api/admin |
| ads | - | /api/ads |
| ai | - | /api/ai |
| amenities | - | /api/amenities |
| assets | - | /api/assets |
| audit-logs | - | /api/audit-logs |
| auth | - | /api/auth |
| automation | - | /api/automation |
| availability | - | /api/availability |
| billing | - | /api/billing |
| bookings | - | /api/bookings |
| brands | - | /api/brands |
| campaigns | - | /api/campaigns |
| cancellation-policies | - | /api/cancellation-policies |
| channel-manager | - | /api/channel-manager |
| channels | - | /api/channels |
| chat-conversations | - | /api/chat-conversations |
| city-ledger | CRUD + items | /api/city-ledger |
| commissions | rules + records + payments | /api/commissions |
| communication | - | /api/communication |
| crm | - | /api/crm |
| cron | Multiple scheduled jobs | /api/cron |
| dashboard | - | /api/dashboard |
| digital-keys | - | /api/digital-keys |
| discounts | - | /api/discounts |
| dns | - | /api/dns |
| events | - | /api/events |
| experience-* | - | /api/experience-* |
| floor-plans | - | /api/floor-plans |
| folio | - | /api/folio |
| frontdesk | - | /api/frontdesk |
| gdpr | - | /api/gdpr |
| group-bookings | - | /api/group-bookings |
| guests | - | /api/guests |
| health | - | /api/health |
| help | - | /api/help |
| housekeeping | - | /api/housekeeping |
| integrations | - | /api/integrations |
| inventory | - | /api/inventory |
| invoices | - | /api/invoices |
| iot | - | /api/iot |
| kiosk | - | /api/kiosk |
| laundry | items + orders | /api/laundry |
| lost-found | CRUD + notify | /api/lost-found |
| loyalty | - | /api/loyalty |
| maintenance | - | /api/maintenance |
| marketing | - | /api/marketing |
| minibar | items + consumption + setup | /api/minibar |
| mini-services | - | /api/mini-services |
| networking | - | /api/networking |
| night-audit | CRUD + execute-step | /api/night-audit |
| notifications | - | /api/notifications |
| orders | - | /api/orders |
| parking | - | /api/parking |
| payments | - | /api/payments |
| posting-rules | CRUD | /api/posting-rules |
| pos | - | /api/pos |
| pricing | - | /api/pricing |
| properties | - | /api/properties |
| rate-plans | - | /api/rate-plans |
| recurring-invoices | - | /api/recurring-invoices |
| reservations | - | /api/reservations |
| reports | - | /api/reports |
| revenue | - | /api/revenue |
| revenue-accounts | CRUD | /api/revenue-accounts |
| rooms | - | /api/rooms |
| scheduled-charges | CRUD + history, pause, resume | /api/scheduled-charges |
| security | - | /api/security |
| settings | - | /api/settings |
| staff | - | /api/staff |
| tenants | - | /api/tenants |
| travel-agents | CRUD | /api/travel-agents |
| vehicles | - | /api/vehicles |
| vendors | - | /api/vendors |
| version | - | /api/version |
| waitlist | - | /api/waitlist |
| webhooks | - | /api/webhooks |
| wifi | - | /api/wifi |
| v1 | - | /api/v1 |

---

## 7. Bookings API

### 7.1 List Bookings

```http
GET /api/bookings
```

Query parameters: `status`, `check_in_from`, `check_in_to`, `guest_id`, `room_id`, `source`

### 7.2 Create Booking

```http
POST /api/bookings
```

```json
{
  "guest": { "email": "guest@example.com", "firstName": "John", "lastName": "Doe" },
  "roomTypeId": "rt_001",
  "ratePlanId": "rp_001",
  "checkIn": "2026-05-01",
  "checkOut": "2026-05-03",
  "adults": 2,
  "specialRequests": "Late check-in"
}
```

### 7.3 Check In

```http
POST /api/bookings/{id}/check-in
```

### 7.4 Check Out

```http
POST /api/bookings/{id}/check-out
```

---

## 8. Guests API

### 8.1 List Guests

```http
GET /api/guests
```

### 8.2 Get Guest Loyalty

```http
GET /api/guests/{id}/loyalty
```

### 8.3 Get Guest Stay History

```http
GET /api/guests/{id}/stays
```

---

## 9. Rooms API

### 9.1 List Rooms

```http
GET /api/rooms
```

### 9.2 Update Room Status

```http
PATCH /api/rooms/{id}/status
```

---

## 10. Availability API

### 10.1 Check Availability

```http
GET /api/availability?check_in=2026-05-01&check_out=2026-05-03&adults=2
```

---

## 11. Payments API

### 11.1 Process Payment

```http
POST /api/payments
```

### 11.2 Refund Payment

```http
POST /api/payments/{id}/refund
```

---

## 12. Billing API Extensions

### Posting Rules API

```http
GET    /api/posting-rules          # List all posting rules
POST   /api/posting-rules          # Create posting rule
GET    /api/posting-rules/{id}     # Get posting rule
PUT    /api/posting-rules/{id}     # Update posting rule
DELETE /api/posting-rules/{id}     # Delete posting rule
```

### Scheduled Charges API

```http
GET    /api/scheduled-charges              # List all scheduled charges
POST   /api/scheduled-charges              # Create scheduled charge
GET    /api/scheduled-charges/{id}         # Get scheduled charge
PUT    /api/scheduled-charges/{id}         # Update scheduled charge
DELETE /api/scheduled-charges/{id}         # Delete scheduled charge
GET    /api/scheduled-charges/{id}/history # Get execution history
POST   /api/scheduled-charges/{id}/pause   # Pause scheduled charge
POST   /api/scheduled-charges/{id}/resume  # Resume scheduled charge
```

### City Ledger API

```http
GET    /api/city-ledger            # List city ledger invoices
POST   /api/city-ledger            # Create city ledger invoice
GET    /api/city-ledger/{id}       # Get city ledger invoice
GET    /api/city-ledger/{id}/items # Get invoice line items
```

### Commissions API

```http
GET    /api/commissions/rules          # List commission rules
POST   /api/commissions/rules          # Create commission rule
GET    /api/commissions/rules/{id}     # Get commission rule
GET    /api/commissions/records        # List commission records
GET    /api/commissions/payments       # List commission payments
```

### Revenue Accounts API

```http
GET    /api/revenue-accounts      # List revenue accounts
POST   /api/revenue-accounts      # Create revenue account
GET    /api/revenue-accounts/{id} # Get revenue account
```

### Night Audit API

```http
GET    /api/night-audit                    # List night audit records
POST   /api/night-audit                    # Start night audit
GET    /api/night-audit/{id}               # Get night audit
POST   /api/night-audit/{id}/execute-step  # Execute audit step
```

---

## 13. Housekeeping API Extensions

### Laundry API

```http
GET    /api/laundry/items       # List laundry item catalog
POST   /api/laundry/items       # Create laundry item
GET    /api/laundry/orders      # List laundry orders
POST   /api/laundry/orders      # Create laundry order
GET    /api/laundry/orders/{id} # Get laundry order
```

### Lost & Found API

```http
GET    /api/lost-found            # List lost & found items
POST   /api/lost-found            # Report lost & found item
GET    /api/lost-found/{id}       # Get item details
POST   /api/lost-found/{id}/notify # Notify guest about found item
```

### Minibar API

```http
GET    /api/minibar/items           # List minibar item catalog
POST   /api/minibar/items           # Create minibar item
GET    /api/minibar/setup/{roomId}  # Get room minibar setup
POST   /api/minibar/setup/{roomId}  # Configure room minibar
GET    /api/minibar/consumption     # List consumption records
POST   /api/minibar/consumption/{id} # Record consumption
```

---

## 14. Cron Jobs API

### Cron Job Endpoints

```http
POST   /api/cron/auto-room-posting              # Trigger auto room posting
POST   /api/cron/channel-sync                   # Trigger channel sync
POST   /api/cron/execute-scheduled-charges      # Execute scheduled charges
POST   /api/cron/expiration                     # Process expirations
POST   /api/cron/no-show-detection              # Run no-show detection
POST   /api/cron/pm-autotrigger                 # Trigger preventive maintenance
POST   /api/cron/process-notifications          # Process scheduled notifications
POST   /api/cron/recurring-invoices             # Generate recurring invoices
POST   /api/cron/recurring-tasks                # Execute recurring tasks
POST   /api/cron/reports                        # Generate scheduled reports
POST   /api/cron/session-engine                 # Monitor WiFi sessions
```

---

## 15. Travel Agents API

```http
GET    /api/travel-agents      # List travel agents
POST   /api/travel-agents      # Create travel agent
GET    /api/travel-agents/{id} # Get travel agent
PUT    /api/travel-agents/{id} # Update travel agent
```

---

## 16. WiFi API

### 16.1 Create WiFi User

```http
POST /api/wifi/users
```

```json
{
  "bookingId": "bk_123",
  "username": "guest_101",
  "planId": "wp_standard",
  "devicesLimit": 3
}
```

### 16.2 List WiFi Sessions

```http
GET /api/wifi/sessions
```

### 16.3 Create Vouchers

```http
POST /api/wifi/vouchers
```

### 16.4 FreeRADIUS Management

WiFi authentication uses FreeRADIUS v3.2.7 with native PostgreSQL SQL module. The system automatically:
- Creates RADIUS users on guest check-in
- Removes users on check-out
- Applies bandwidth policies via RADIUS attributes
- Tracks sessions in PostgreSQL via radacct

---

## 17. Webhooks

### 17.1 Webhook Events

| Event | Description |
|-------|-------------|
| `booking.created` | New booking created |
| `booking.modified` | Booking updated |
| `booking.cancelled` | Booking cancelled |
| `booking.checked_in` | Guest checked in |
| `booking.checked_out` | Guest checked out |
| `payment.completed` | Payment successful |
| `payment.failed` | Payment failed |
| `payment.refunded` | Payment refunded |
| `wifi.session.started` | WiFi session began |
| `wifi.session.stopped` | WiFi session ended |
| `guest.created` | New guest profile |
| `inventory.updated` | Availability changed |

### 17.2 Signature Verification

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

### 17.3 Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 1 hour |

After 5 failures, webhook is disabled and alert sent.

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
```
GET /api/docs/openapi.json
```

---

## Support

- **Email**: support@cryptsk.com
- **Documentation**: docs.staysuite.io

---

*© 2026 Cryptsk Pvt Ltd*

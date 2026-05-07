# StaySuite API Documentation
## REST API Reference

**Version**: v1  
**Base URL**: `https://api.staysuite.io/v1`  
**Last Updated**: May 2026

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
12. [WiFi API](#12-wifi-api)
13. [Webhooks](#13-webhooks)

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

The platform provides **614 API routes** across **134 directories**:

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
| city-ledger | - | /api/city-ledger |
| commissions | - | /api/commissions |
| communication | - | /api/communication |
| crm | - | /api/crm |
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
| laundry | - | /api/laundry |
| lost-found | - | /api/lost-found |
| loyalty | - | /api/loyalty |
| maintenance | - | /api/maintenance |
| marketing | - | /api/marketing |
| mini-services | - | /api/mini-services |
| networking | - | /api/networking |
| night-audit | - | /api/night-audit |
| notifications | - | /api/notifications |
| orders | - | /api/orders |
| parking | - | /api/parking |
| payments | - | /api/payments |
| pos | - | /api/pos |
| pricing | - | /api/pricing |
| properties | - | /api/properties |
| rate-plans | - | /api/rate-plans |
| reservations | - | /api/reservations |
| reports | - | /api/reports |
| revenue | - | /api/revenue |
| rooms | - | /api/rooms |
| security | - | /api/security |
| settings | - | /api/settings |
| staff | - | /api/staff |
| tenants | - | /api/tenants |
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

## 12. WiFi API

### 12.1 Create WiFi User

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

### 12.2 List WiFi Sessions

```http
GET /api/wifi/sessions
```

### 12.3 Create Vouchers

```http
POST /api/wifi/vouchers
```

### 12.4 FreeRADIUS Management

WiFi authentication uses FreeRADIUS v3.2.7 with native PostgreSQL SQL module. The system automatically:
- Creates RADIUS users on guest check-in
- Removes users on check-out
- Applies bandwidth policies via RADIUS attributes
- Tracks sessions in PostgreSQL via radacct

---

## 13. Webhooks

### 13.1 Webhook Events

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

### 13.2 Signature Verification

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

### 13.3 Retry Policy

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

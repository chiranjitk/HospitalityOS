# StaySuite Integration Guide
## Third-Party Integration Manual

**Version**: 2.1  
**Last Updated**: June 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Door Lock Integration](#2-door-lock-integration)
3. [Payment Gateway Integration](#3-payment-gateway-integration)
4. [WiFi Gateway Integration](#4-wifi-gateway-integration)
5. [Channel Manager Integration](#5-channel-manager-integration)
6. [IoT Device Integration](#6-iot-device-integration)
7. [POS System Integration](#7-pos-system-integration)
8. [Custom Integrations](#8-custom-integrations)
9. [New Integration Endpoints](#9-new-integration-endpoints)
10. [Webhook Events](#10-webhook-events)

---

## 1. Overview

StaySuite provides multiple integration options across 134 API route directories with **617 API routes** and **294 data models**:

| Integration Type | Methods |
|------------------|---------|
| Door Locks | BLE/NFC, API |
| Payment Gateways | API, Webhooks |
| WiFi Gateways | RADIUS, API |
| OTAs | API, Webhooks |
| IoT Devices | MQTT, API |
| POS Systems | API, Webhooks |
| Custom | REST API (617 routes), Webhooks |

---

## 2. Door Lock Integration

### 2.1 Supported Lock Vendors

| Vendor | Protocol | Integration Type |
|--------|----------|------------------|
| Assa Abloy | BLE, NFC | API |
| dormakaba | BLE | API |
| Salto | BLE, NFC | API |
| ONITY | BLE | API |
| August | BLE | API |

### 2.2 Digital Key Flow

```
┌──────────┐     API      ┌──────────┐     BLE     ┌──────────┐
│StaySuite │ ──────────► │Lock Cloud│ ◄─────────► │  Guest   │
│          │             │          │             │  Phone   │
└──────────┘             └──────────┘             └──────────┘
     │
     │   Check-in Event → Generate Key → Send to Guest
     │   Check-out Event → Revoke Key
     └───────────────────────────────────────────────►
```

---

## 3. Payment Gateway Integration

### 3.1 Supported Gateways

| Gateway | Regions | Features |
|---------|---------|----------|
| **Stripe** | 46+ countries | Cards, Apple Pay, Google Pay |
| **PayPal** | 200+ countries | PayPal, Venmo, Cards |
| **Razorpay** | India | UPI, Cards, NetBanking |
| **Square** | US, Canada | Cards, Afterpay |
| **Adyen** | Global | 250+ payment methods |
| **Authorize.net** | US, Canada | Cards, eCheck |
| **CCAvenue** | India | Multi-bank support |
| **PayU** | 50+ countries | Local payment methods |

### 3.2 Multi-Gateway Routing

```json
{
  "routing": {
    "primary": "stripe",
    "fallback": ["razorpay", "paypal"],
    "rules": [
      { "currency": "INR", "gateway": "razorpay" },
      { "amount_min": 10000, "gateway": "stripe" }
    ]
  }
}
```

---

## 4. WiFi Gateway Integration

### 4.1 FreeRADIUS Architecture

StaySuite includes FreeRADIUS v3.2.7 compiled from source with native PostgreSQL SQL module:

```
┌──────────┐    Auth     ┌──────────┐    Auth    ┌──────────────┐
│  Guest   │ ──────────► │  NAS     │ ────────► │ FreeRADIUS   │
│  Device  │             │ (Gateway)│            │  v3.2.7      │
└──────────┘             └──────────┘            │  PostgreSQL  │
                               │                    │  SQL Module  │
                               │ Acct               └──────┬───────┘
                               ▼                           │
                         ┌──────────┐                  ┌────▼────┐
                         │  Usage   │                  │  Postgres│
                         │   Logs   │                  │   v17    │
                         └──────────┘                  └─────────┘
```

### 4.2 Supported Network Vendors (11+)

| Vendor | Protocol | Integration Type |
|--------|----------|------------------|
| **Cisco** | RADIUS, CoA | WLC, ISE |
| **MikroTik** | RADIUS, API | Hotspot, User Manager |
| **Ruckus** | RADIUS, CoA | ZoneDirector, SmartZone |
| **Huawei** | RADIUS | AC Integration |
| **Juniper** | RADIUS, CoA | Mist Cloud Support |
| **Fortinet** | RADIUS, API | FortiGate, FortiWiFi |
| **Aruba** | RADIUS, CoA | Mobility Controller |
| **D-Link** | RADIUS | Unified Wireless |
| **Netgear** | RADIUS | Insight Integration |
| **Grandstream** | RADIUS | GWN Series |
| **Ubiquiti** | RADIUS | UniFi Controller |

### 4.3 RADIUS Parameters

| Parameter | Value |
|-----------|-------|
| Auth Port | 1812 |
| Acct Port | 1813 |
| Protocol | RADIUS |
| Authentication | PAP/CHAP |
| Server | FreeRADIUS v3.2.7 (compiled from source) |
| Database | PostgreSQL 17 (native SQL module) |

### 4.4 MikroTik Configuration

```
/radius
add address=YOUR_SERVER_IP secret=YOUR_SHARED_SECRET service=hotspot

/ip hotspot profile
set [find name=default] login-by=http-chap,http-pap,cookie use-radius=yes
```

### 4.5 Captive Portal

- Portal redirect service on port 8888
- Redirects to StaySuite main app on port 3000
- Configurable whitelist, templates, and branding
- 6 WiFi plans: Free, Basic, Standard, Premium, Business, Enterprise

---

## 5. Channel Manager Integration

### 5.1 OTA Connection Flow

```
┌──────────┐   Push    ┌──────────┐   API    ┌──────────┐
│StaySuite │ ────────► │  CRS     │ ───────► │   OTA    │
│   PMS    │           │          │          │ (B.com)  │
└──────────┘           └──────────┘          └──────────┘
      ▲                                            │
      │              Webhook                       │
      └────────────────────────────────────────────┘
```

### 5.2 Supported Channels (46+)

**Global:** Booking.com, Expedia, Airbnb, Agoda, TripAdvisor, Hostelworld

**India:** MakeMyTrip, Goibibo, Yatra, OYO, Cleartrip, EaseMyTrip, Travelguru, FabHotels, Treebo

**GDS:** Amadeus, Sabre, Travelport

**Metasearch:** Google Hotel Ads, TripAdvisor, Trivago, Kayak, Skyscanner

### 5.3 Inventory Sync

- Real-time: Inventory changes pushed immediately
- Conflict resolution: Log → Alert → Configurable policy
- Idempotent operations with safe retry mechanisms
- Dead letter queue for failed syncs

---

## 6. IoT Device Integration

### 6.1 Supported Devices

| Type | Vendors |
|------|---------|
| Thermostats | Nest, Ecobee, Honeywell |
| Lighting | Philips Hue, LIFX |
| Blinds/Curtains | Somfy, Lutron |
| Sensors | Occupancy, Door/Window |

### 6.2 Smart Room Flow

```
Check-in Event
     ├──► Set temperature to guest preference
     ├──► Turn on lights
     ├──► Close curtains
     └──► Enable voice assistant

Check-out Event
     ├──► Set temperature to eco mode
     ├──► Turn off all lights
     ├──► Open curtains
     └──► Reset voice assistant
```

---

## 7. POS System Integration

### 7.1 Built-in POS

StaySuite includes a full-featured Restaurant & POS module with 15+ sub-features:
- Orders, Tables, Kitchen Display, Menu Management
- Room Service, Receipts, Recipes, Modifiers
- Billing, Inventory, Staff Assignment, Layout

### 7.2 External POS Integration

```http
POST /api/pos/orders
```

Orders are validated against active bookings and posted to guest folios automatically.

---

## 8. Custom Integrations

### 8.1 REST API

See API Documentation for complete reference. 617 API routes available across 294 data models.

### 8.2 Webhooks

1. Navigate to **Webhooks** module
2. Add endpoint URL
3. Select events (see [Section 10](#10-webhook-events) for full event list)
4. Set secret for signature verification

### 8.3 Mini-Services

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Next.js (main) | 3000 | HTTP | Main application (617 API routes) |
| Captive Redirect | 8888 | HTTP | WiFi captive portal redirect |
| Realtime | 3003 | Socket.IO | Real-time updates |
| Availability | 3002 | Socket.IO | Room availability |
| FreeRADIUS Mgmt | 3010 | HTTP | RADIUS management API |
| FreeRADIUS Server | 1812/1813 | RADIUS | Authentication/Accounting |

---

## 9. New Integration Endpoints

The following endpoints are available as of version 2.1:

### 9.1 Travel Agents API

```http
GET    /api/travel-agents
POST   /api/travel-agents
GET    /api/travel-agents/[id]
PUT    /api/travel-agents/[id]
DELETE /api/travel-agents/[id]
```

Manage travel agent profiles, commissions, and agreements.

### 9.2 Scheduled Charges API

```http
GET    /api/scheduled-charges
POST   /api/scheduled-charges
GET    /api/scheduled-charges/[id]
PUT    /api/scheduled-charges/[id]
DELETE /api/scheduled-charges/[id]
POST   /api/scheduled-charges/[id]/pause
POST   /api/scheduled-charges/[id]/resume
```

Create and manage recurring charges on guest folios. Use the pause/resume endpoints to temporarily halt scheduled charges without deleting them.

### 9.3 City Ledger API

```http
GET    /api/city-ledger
POST   /api/city-ledger
GET    /api/city-ledger/[id]
PUT    /api/city-ledger/[id]
DELETE /api/city-ledger/[id]
```

Manage city ledger accounts for direct bill, corporate accounts, and non-guest postings.

### 9.4 Commissions API

```http
GET    /api/commissions
POST   /api/commissions
GET    /api/commissions/[id]
PUT    /api/commissions/[id]
DELETE /api/commissions/[id]
```

Track and manage commissions for travel agents, OTAs, and referral partners.

### 9.5 Revenue Accounts API

```http
GET    /api/revenue-accounts
POST   /api/revenue-accounts
GET    /api/revenue-accounts/[id]
PUT    /api/revenue-accounts/[id]
DELETE /api/revenue-accounts/[id]
```

Configure revenue account codes and categories for financial reporting and posting rules.

### 9.6 Night Audit API

```http
POST   /api/night-audit
GET    /api/night-audit
GET    /api/night-audit/[id]
```

Trigger and review night audit operations including end-of-day closing, room charge posting, and financial roll-ups.

### 9.7 Cron Jobs API

```http
GET    /api/cron/*
POST   /api/cron/*
```

> **Authentication**: All Cron Jobs API endpoints require `CRON_SECRET` header authentication.
>
> ```http
> CRON_SECRET: your-cron-secret-value
> ```

The Cron Jobs API manages scheduled background tasks including automated night audit triggers, report generation, and system maintenance jobs.

---

## 10. Webhook Events

StaySuite supports webhook notifications for the following events:

### 10.1 Core Events

| Event | Description |
|-------|-------------|
| `booking.created` | New booking created |
| `booking.updated` | Booking modified |
| `booking.cancelled` | Booking cancelled |
| `booking.checked_in` | Guest checked in |
| `booking.checked_out` | Guest checked out |

### 10.2 Financial Events

| Event | Description |
|-------|-------------|
| `payment.completed` | Payment processed successfully |
| `payment.failed` | Payment attempt failed |
| `refund.processed` | Refund issued |
| `invoice.created` | Invoice generated |

### 10.3 Scheduled Charges Events

| Event | Description |
|-------|-------------|
| `scheduled_charge.executed` | A scheduled charge was successfully posted to a folio |
| `scheduled_charge.paused` | A scheduled charge has been paused |
| `scheduled_charge.resumed` | A paused scheduled charge has been resumed |

### 10.4 Night Audit Events

| Event | Description |
|-------|-------------|
| `night_audit.started` | Night audit process has begun |
| `night_audit.completed` | Night audit process finished successfully |

### 10.5 Commission Events

| Event | Description |
|-------|-------------|
| `commission.created` | A new commission record was created |

### 10.6 Hotel Services Events

| Event | Description |
|-------|-------------|
| `laundry.order.created` | New laundry order placed |
| `laundry.order.updated` | Laundry order status or details changed |
| `minibar.consumption.recorded` | Minibar consumption posted to guest folio |

---

## Support

- **Email**: integrations@cryptsk.com
- **Documentation**: docs.staysuite.io/integrations

---

*© 2026 Cryptsk Pvt Ltd*

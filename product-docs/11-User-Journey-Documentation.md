# StaySuite User Journey Documentation
## Complete User Lifecycle & Experience Flows

**Version**: 2.1  
**Last Updated: June 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guest Journey](#2-guest-journey)
3. [Staff Journey](#3-staff-journey)
4. [Administrator Journey](#4-administrator-journey)
5. [Property Manager Journey](#5-property-manager-journey)
6. [Channel Partner Journey](#6-channel-partner-journey)
7. [Night Audit Journey](#7-night-audit-journey)
8. [City Ledger Journey](#8-city-ledger-journey)
9. [Scheduled Charges Journey](#9-scheduled-charges-journey)
10. [Commission Journey](#10-commission-journey)

---

## 1. Overview

### 1.1 User Types

| User Type | Description | Primary Touchpoints |
|-----------|-------------|---------------------|
| **Guest** | End customer staying at property | Booking engine, Guest app, In-room portal |
| **Staff** | Hotel employees | Staff app, Web dashboard |
| **Administrator** | System administrators | Admin dashboard, Settings |
| **Property Manager** | Hotel owners/managers | Web dashboard, Reports |
| **Channel Partner** | OTA and booking channels | API endpoints |

### 1.2 Journey Touchpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                     GUEST JOURNEY TOUCHPOINTS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Discovery → Booking → Pre-Arrival → Stay → Post-Stay          │
│       │          │          │          │          │              │
│       ▼          ▼          ▼          ▼          ▼              │
│   Website    Booking    Email/     In-Room    Review/           │
│   OTA        Engine     SMS        Portal     Loyalty           │
│   Ads                   App        WiFi                          │
│                                  Digital Key                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Guest Journey

### 2.1 Complete Guest Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         GUEST LIFECYCLE FLOW                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │Discovery │──▶│ Booking  │──▶│Pre-Arrival│──▶│   Stay   │──▶│Post-Stay ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘│
│       │              │              │              │              │       │
│       ▼              ▼              ▼              ▼              ▼       │
│   Awareness      Reservation    Preparation    Experience   Retention    │
│   Interest       Confirmation   Documentation  Services     Loyalty      │
│   Consideration  Payment        Preferences    Support      Feedback     │
│                                                                   Referral│
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase 1: Discovery Journey

#### 2.2.1 Discovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISCOVERY PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐                                                     │
│  │ Travel  │                                                     │
│  │  Need   │                                                     │
│  └────┬────┘                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │           SEARCH CHANNELS               │                    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │                    │
│  │  │   OTA   │ │  Meta   │ │ Direct  │   │                    │
│  │  │(Booking)│ │(Google) │ │(Website)│   │                    │
│  │  └─────────┘ └─────────┘ └─────────┘   │                    │
│  └─────────────────────────────────────────┘                    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │ Property Listing│◀──── StaySuite Channel Manager Feed        │
│  │   (Photos,      │      (Real-time availability & rates)     │
│  │    Rates,       │                                             │
│  │    Reviews)     │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │   Comparison    │                                             │
│  │   & Decision    │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  Select Room    │                                             │
│  │  & Rate Plan    │                                             │
│  └─────────────────┘                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Discovery Touchpoints

| Channel | StaySuite Integration | Data Sync |
|---------|----------------------|-----------|
| Booking.com | Channel Manager API | Real-time |
| Airbnb | Channel Manager API | Real-time |
| Expedia | Channel Manager API | Real-time |
| Google Hotel Ads | Metasearch API | Real-time |
| Direct Website | Booking Engine Widget | Instant |
| Social Media | Tracking Pixels | Event-based |

### 2.3 Phase 2: Booking Journey

#### 2.3.1 Booking Flow (Direct)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIRECT BOOKING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest            StaySuite            Payment          Property│
│    │                  │                   │                │    │
│    │  1. Select Dates │                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  2. Availability │                   │                │    │
│    │◀─────────────────│                   │                │    │
│    │                  │                   │                │    │
│    │  3. Select Room  │                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  4. Enter Details│                   │                │    │
│    │─────────────────▶│                   │                │    │
│    │                  │                   │                │    │
│    │  5. Validate     │                   │                │    │
│    │                  │──▶ Validate ◀────▶│                │    │
│    │                  │    & Hold         │                │    │
│    │                  │    Inventory      │                │    │
│    │                  │                   │                │    │
│    │  6. Payment      │                   │                │    │
│    │─────────────────▶│──────────────────▶│                │    │
│    │                  │                   │                │    │
│    │                  │                   │ 7. Process     │    │
│    │                  │                   │    Payment     │    │
│    │                  │                   │                │    │
│    │                  │◀──────────────────│                │    │
│    │                  │   Payment Success │                │    │
│    │                  │                   │                │    │
│    │                  │ 8. Confirm Booking                │    │
│    │                  │──────────────────────────────────▶│    │
│    │                  │                   │                │    │
│    │  9. Confirmation │                   │                │    │
│    │◀─────────────────│                   │                │    │
│    │                  │                   │                │    │
│    │  10. Email/SMS   │                   │                │    │
│    │◀═════════════════│                   │                │    │
│    │                  │                   │                │    │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 Booking Flow (OTA)

```
┌─────────────────────────────────────────────────────────────────┐
│                      OTA BOOKING FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OTA           Channel Manager        StaySuite      Property   │
│   │                   │                   │              │      │
│   │ 1. Guest Books    │                   │              │      │
│   │ on OTA Platform   │                   │              │      │
│   │                   │                   │              │      │
│   │ 2. Webhook        │                   │              │      │
│   │──────────────────▶│                   │              │      │
│   │  (Reservation)    │                   │              │      │
│   │                   │                   │              │      │
│   │                   │ 3. Verify HMAC    │              │      │
│   │                   │    Signature      │              │      │
│   │                   │                   │              │      │
│   │                   │ 4. Check          │              │      │
│   │                   │    Idempotency    │              │      │
│   │                   │                   │              │      │
│   │                   │ 5. Map OTA Data   │              │      │
│   │                   │    to Internal    │              │      │
│   │                   │                   │              │      │
│   │                   │ 6. Create Booking │              │      │
│   │                   │──────────────────▶│              │      │
│   │                   │                   │              │      │
│   │                   │                   │ 7. Lock      │      │
│   │                   │                   │    Inventory │      │
│   │                   │                   │─────────────▶│      │
│   │                   │                   │              │      │
│   │                   │                   │ 8. Create    │      │
│   │                   │                   │    Folio     │      │
│   │                   │                   │              │      │
│   │                   │ 9. Booking Created│              │      │
│   │                   │◀──────────────────│              │      │
│   │                   │                   │              │      │
│   │ 10. ACK Response  │                   │              │      │
│   │◀──────────────────│                   │              │      │
│   │                   │                   │              │      │
│   │                   │ 11. Update        │              │      │
│   │                   │     Availability  │              │      │
│   │                   │─────────────────────────────────────────▶│
│   │                   │                   │              │      │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.3 Booking State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     ┌─────────┐                                  │
│                     │  DRAFT  │                                  │
│                     └────┬────┘                                  │
│                          │ Confirm                               │
│                          ▼                                       │
│                     ┌─────────┐                                  │
│           ┌────────│CONFIRMED│────────┐                          │
│           │        └────┬────┘        │                          │
│           │             │             │                          │
│        Cancel        Check-in     No-show                        │
│           │             │             │                          │
│           ▼             ▼             ▼                          │
│      ┌─────────┐  ┌──────────┐  ┌─────────┐                     │
│      │CANCELLED│  │CHECKED_IN│  │ NO-SHOW │                     │
│      └─────────┘  └────┬─────┘  └─────────┘                     │
│                        │                                        │
│                    Check-out                                    │
│                        │                                        │
│                        ▼                                        │
│                  ┌───────────┐                                  │
│                  │CHECKED_OUT│                                  │
│                  └───────────┘                                  │
│                                                                  │
│  State Rules:                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • DRAFT → Initial state, can be edited freely                  │
│  • CONFIRMED → Inventory locked, modification restricted        │
│  • CHECKED_IN → Guest on property, WiFi active, folio open      │
│  • CHECKED_OUT → Final state, folio closed, archived            │
│  • CANCELLED → Inventory released, refund processed             │
│  • NO-SHOW → Auto-cancellation after cut-off time               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Phase 3: Pre-Arrival Journey

#### 2.4.1 Pre-Arrival Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-ARRIVAL PHASE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Timeline: 48-72 hours before check-in                          │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Booking        │                                              │
│  │ Confirmed      │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐      ┌────────────────┐                     │
│  │ Pre-Arrival    │      │ Email/SMS with │                     │
│  │ Automation     │─────▶│ Pre-Check-in   │                     │
│  │ Triggered      │      │ Link           │                     │
│  └────────────────┘      └───────┬────────┘                     │
│                                  │                              │
│          ┌───────────────────────┘                              │
│          ▼                                                      │
│  ┌────────────────┐                                              │
│  │ Guest Receives │                                              │
│  │ Pre-Arrival    │                                              │
│  │ Link           │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               PRE-CHECK-IN PORTAL                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Verify Identity (Phone/Email OTP)                 │  │ │
│  │  │ 2. Complete Guest Details                            │  │ │
│  │  │ 3. Upload ID Documents (KYC)                         │  │ │
│  │  │ 4. Add Preferences (Room, Food, etc.)                │  │ │
│  │  │ 5. Add Special Requests                              │  │ │
│  │  │ 6. Payment Method (Pre-auth)                         │  │ │
│  │  │ 7. Digital Signature (Terms & Conditions)            │  │ │
│  │  │ 8. Early Check-in Request (if available)             │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Pre-Check-in   │                                              │
│  │ Complete       │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Digital Key    │      (If enabled & early check-in complete) │
│  │ Generated      │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Welcome Message│      (Scheduled for arrival day)            │
│  │ Sent           │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.2 Pre-Arrival Automation Triggers

| Trigger | Timing | Action |
|---------|--------|--------|
| Booking Confirmed | Immediate | Confirmation email |
| 72 hours before | T-72h | Pre-arrival email with check-in link |
| 48 hours before | T-48h | Reminder if pre-check-in incomplete |
| 24 hours before | T-24h | Final reminder |
| Day of arrival | T-0 | Welcome message + WiFi credentials |
| VIP Guest | Immediate | Alert to management |

### 2.5 Phase 4: Stay Journey

#### 2.5.1 Check-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECK-IN FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest          Front Desk         StaySuite        Systems     │
│    │                │                  │               │        │
│    │ 1. Arrive at   │                  │               │        │
│    │    Property    │                  │               │        │
│    │───────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 2. Find Booking  │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 3. Verify ID     │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 4. Review Folio  │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 5. Collect       │               │        │
│    │                │    Payment       │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 6. Assign Room   │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ 7. Update     │        │
│    │                │                  │    Room Status│        │
│    │                │                  │──────────────▶│        │
│    │                │                  │               │        │
│    │                │ 8. Check-In      │               │        │
│    │                │    Action        │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ ┌────────────────────┐ │
│    │                │                  │ │ AUTOMATIC TRIGGERS │ │
│    │                │                  │ ├────────────────────┤ │
│    │                │                  │ │ • WiFi Enable      │ │
│    │                │                  │ │ • Digital Key Gen  │ │
│    │                │                  │ │ • Room Status      │ │
│    │                │                  │ │ • Welcome Message  │ │
│    │                │                  │ │ • Loyalty Points   │ │
│    │                │                  │ │ • Upsell Offers    │ │
│    │                │                  │ └────────────────────┘ │
│    │                │                  │               │        │
│    │ 9. Key Card /  │                  │               │        │
│    │    Digital Key │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
│    │ 10. Room       │                  │               │        │
│    │     Directions │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.2 During Stay - Service Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest            In-Room         Staff          StaySuite      │
│    │               Portal            App              │         │
│    │                 │                │               │         │
│    │ 1. Open In-Room │                │               │         │
│    │    Portal (QR)  │                │               │         │
│    │────────────────▶│                │               │         │
│    │                 │                │               │         │
│    │ 2. Select       │                │               │         │
│    │    Service      │                │               │         │
│    │────────────────▶│                │               │         │
│    │                 │                │               │         │
│    │                 │ 3. Submit      │               │         │
│    │                 │    Request     │               │         │
│    │                 │───────────────────────────────▶│         │
│    │                 │                │               │         │
│    │                 │                │ 4. Notify     │         │
│    │                 │                │    Staff      │         │
│    │                 │                │◀──────────────│         │
│    │                 │                │               │         │
│    │                 │                │ 5. Accept     │         │
│    │                 │                │    Request    │         │
│    │                 │                │──────────────▶│         │
│    │                 │                │               │         │
│    │ 6. Status       │                │               │         │
│    │    Update       │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
│    │                 │                │ 7. Complete   │         │
│    │                 │                │    Service    │         │
│    │                 │                │──────────────▶│         │
│    │                 │                │               │         │
│    │ 8. Request      │                │               │         │
│    │    Complete     │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
│    │ 9. Rating       │                │               │         │
│    │    Request      │                │               │         │
│    │◀────────────────────────────────────────────────│         │
│    │                 │                │               │         │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.3 During Stay - WiFi Experience

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUEST WIFI EXPERIENCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest               Network             StaySuite              │
│    │                    │                    │                   │
│    │ 1. Connect to      │                    │                   │
│    │    "Hotel-Guest"   │                    │                   │
│    │    WiFi SSID       │                    │                   │
│    │───────────────────▶│                    │                   │
│    │                    │                    │                   │
│    │ 2. Redirect to     │                    │                   │
│    │    Captive Portal  │                    │                   │
│    │◀───────────────────│                    │                   │
│    │                    │                    │                   │
│    │ 3. Enter Room #    │                    │                   │
│    │    & Last Name     │                    │                   │
│    │───────────────────▶│                    │                   │
│    │                    │                    │                   │
│    │                    │ 4. RADIUS Auth     │                   │
│    │                    │    Request         │                   │
│    │                    │───────────────────▶│                   │
│    │                    │                    │                   │
│    │                    │                    │ 5. Verify Guest   │
│    │                    │                    │    (Checked-in)   │
│    │                    │                    │                   │
│    │                    │ 6. Auth Success    │                   │
│    │                    │    + Bandwidth     │                   │
│    │                    │◀───────────────────│                   │
│    │                    │                    │                   │
│    │ 7. Internet Access │                    │                   │
│    │    Granted         │                    │                   │
│    │◀───────────────────│                    │                   │
│    │                    │                    │                   │
│    │ 8. Browse Internet │                    │                   │
│    │───────────────────▶│ 9. Log Session     │                   │
│    │                    │───────────────────▶│                   │
│    │                    │                    │                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5.4 Check-Out Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECK-OUT FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest          Front Desk         StaySuite        Systems     │
│    │                │                  │               │        │
│    │ 1. Request     │                  │               │        │
│    │    Check-out   │                  │               │        │
│    │───────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 2. Retrieve      │               │        │
│    │                │    Booking       │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 3. Review Folio  │               │        │
│    │                │    (All Charges) │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │ 4. Review      │                  │               │        │
│    │    Charges     │                  │               │        │
│    │◀──────────────▶│                  │               │        │
│    │                │                  │               │        │
│    │                │ 5. Process       │               │        │
│    │                │    Final Payment │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │ 6. Generate      │               │        │
│    │                │    Invoice       │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │ 7. Print/Email │                  │               │        │
│    │    Invoice     │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
│    │                │ 8. Check-Out     │               │        │
│    │                │    Action        │               │        │
│    │                │─────────────────▶│               │        │
│    │                │                  │               │        │
│    │                │                  │ ┌────────────────────┐ │
│    │                │                  │ │ AUTOMATIC TRIGGERS │ │
│    │                │                  │ ├────────────────────┤ │
│    │                │                  │ │ • WiFi Disable     │ │
│    │                │                  │ │ • Digital Key Revk │ │
│    │                │                  │ │ • Room Dirty Status│ │
│    │                │                  │ │ • Housekeeping Task│ │
│    │                │                  │ │ • Feedback Request │ │
│    │                │                  │ │ • Loyalty Update   │ │
│    │                │                  │ │ • OTA Sync         │ │
│    │                │                  │ └────────────────────┘ │
│    │                │                  │               │        │
│    │ 9. Check-out   │                  │               │        │
│    │    Complete    │                  │               │        │
│    │◀───────────────│                  │               │        │
│    │                │                  │               │        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Phase 5: Post-Stay Journey

#### 2.6.1 Post-Stay Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     POST-STAY PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Timeline: After check-out                                      │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Check-out      │                                              │
│  │ Complete       │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 IMMEDIATE ACTIONS                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ • Thank you email with invoice                        │  │ │
│  │  │ • Loyalty points credited                             │  │ │
│  │  │ • Feedback request scheduled                          │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐      (24 hours after)                       │
│  │ Feedback       │                                              │
│  │ Request Sent   │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  FEEDBACK LOOP                             │ │
│  │                                                            │ │
│  │   Guest ──▶ Rating (1-5) ──▶ Comments ──▶ Submit          │ │
│  │                                                            │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │ IF Rating ≥ 4:                                       │  │ │
│  │   │   → Prompt for Google/OTA review                     │  │ │
│  │   │   → Add to VIP segment                               │  │ │
│  │   │   → Send referral offer                              │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │ IF Rating ≤ 3:                                       │  │ │
│  │   │   → Alert management                                 │  │ │
│  │   │   → Create follow-up task                            │  │ │
│  │   │   → Send apology email                               │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  CRM SEGMENTATION                          │ │
│  │                                                            │ │
│  │   Guest Profile Updated:                                   │ │
│  │   ┌────────────────────────────────────────────────────┐   │ │
│  │   │ • Total stays count                                 │   │ │
│  │   │ • Total lifetime value                              │   │ │
│  │   │ • Preferences captured                              │   │ │
│  │   │ • Segment assignment (VIP, Repeat, Corporate, etc.) │   │ │
│  │   │ • Loyalty tier                                      │   │ │
│  │   └────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                RETENTION MARKETING                         │ │
│  │                                                            │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │   │ Birthday    │ │ Anniversary │ │ Seasonal    │         │ │
│  │   │ Offer       │ │ Offer       │ │ Promotions  │         │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  │                                                            │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │   │ Abandoned   │ │ Last-Minute │ │ Loyalty     │         │ │
│  │   │ Cart        │ │ Deals       │ │ Rewards     │         │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Staff Journey

### 3.1 Staff Login & Daily Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAFF DAILY JOURNEY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Shift Start    │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   LOGIN & SETUP                            │ │
│  │                                                            │ │
│  │  1. Open Staff App / Web Portal                            │ │
│  │  2. Login with credentials                                 │ │
│  │  3. 2FA verification (if enabled)                          │ │
│  │  4. View assigned tasks                                    │ │
│  │  5. Check notifications                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 ROLE-BASED DASHBOARD                       │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Front Desk      │  │ Housekeeping    │                 │ │
│  │  │ • Arrivals      │  │ • Room Tasks    │                 │ │
│  │  │ • Departures    │  │ • Status Updates│                 │ │
│  │  │ • In-House      │  │ • Requests      │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Restaurant      │  │ Maintenance     │                 │ │
│  │  │ • Orders        │  │ • Tickets       │                 │ │
│  │  │ • Reservations  │  │ • Work Orders   │                 │ │
│  │  │ • Tables        │  │ • Assets        │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 TASK EXECUTION                             │ │
│  │                                                            │ │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐    │ │
│  │  │ Receive │──▶│ Accept  │──▶│ Execute │──▶│ Complete│    │ │
│  │  │  Task   │   │  Task   │   │  Task   │   │  Task   │    │ │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘    │ │
│  │       │                                          │         │ │
│  │       │          ┌─────────────────┐             │         │ │
│  │       └─────────▶│   Notify Next   │◀────────────┘         │ │
│  │                   │   Staff/Manager │                      │ │
│  │                   └─────────────────┘                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Shift End      │                                              │
│  │ • Clock out    │                                              │
│  │ • Handover     │                                              │
│  │ • Log out      │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Housekeeping Staff Journey

```
┌─────────────────────────────────────────────────────────────────┐
│              HOUSEKEEPING STAFF FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   MORNING ROUTINE                           ││
│  │                                                             ││
│  │  1. Login to Staff App                                      ││
│  │  2. View assigned rooms                                     ││
│  │  3. Check priority (check-outs first)                       ││
│  │  4. Collect supplies                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ROOM CLEANING                              ││
│  │                                                             ││
│  │   Room ──▶ Update ──▶ Clean ──▶ Mark ──▶ Request           ││
│  │   Selected   Status      Room     Clean    Inspection      ││
│  │                                                             ││
│  │   Status Options:                                           ││
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐            ││
│  │   │ Occupied   │ │ Vacant     │ │ Out of     │            ││
│  │   │ Clean      │ │ Clean      │ │ Order      │            ││
│  │   └────────────┘ └────────────┘ └────────────┘            ││
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐            ││
│  │   │ Occupied   │ │ Vacant     │ │ Out of     │            ││
│  │   │ Dirty      │ │ Dirty      │ │ Service    │            ││
│  │   └────────────┘ └────────────┘ └────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ISSUE REPORTING                            ││
│  │                                                             ││
│  │   Found Issue ──▶ Report in App ──▶ Add Photo ──▶ Submit   ││
│  │                                                             ││
│  │   Issue Types:                                              ││
│  │   • Maintenance required                                    ││
│  │   • Missing amenities                                       ││
│  │   • Damaged items                                           ││
│  │   • Lost & found                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   SHIFT COMPLETION                           ││
│  │                                                             ││
│  │   • Complete all assigned tasks                             ││
│  │   • Submit handover notes                                   ││
│  │   • Log out                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Administrator Journey

### 4.1 Admin Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PROPERTY ADMINISTRATION SETUP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Tenant Created │                                              │
│  │ (by Platform)  │                                              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  INITIAL SETUP                             │ │
│  │                                                            │ │
│  │  1. Welcome email with login link                          │ │
│  │  2. First login (force password change)                    │ │
│  │  3. Property details wizard                                │ │
│  │     ├── Property name & address                            │ │
│  │     ├── Timezone & currency                                │ │
│  │     ├── Contact information                                │ │
│  │     └── Tax configuration                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                PROPERTY CONFIGURATION                      │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Room Types      │  │ Rooms           │                 │ │
│  │  │ • Define types  │  │ • Add rooms     │                 │ │
│  │  │ • Set pricing   │  │ • Assign types  │                 │ │
│  │  │ • Amenities     │  │ • Features      │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Rate Plans      │  │ Users & Roles   │                 │ │
│  │  │ • Create plans  │  │ • Add staff     │                 │ │
│  │  │ • Restrictions  │  │ • Assign roles  │                 │ │
│  │  │ • Policies      │  │ • Permissions   │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                INTEGRATION SETUP                           │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Payment Gateway │  │ WiFi Gateway    │                 │ │
│  │  │ • API keys      │  │ • RADIUS config │                 │ │
│  │  │ • Merchant ID   │  │ • Shared secret │                 │ │
│  │  │ • Test trans.   │  │ • Test auth     │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  │                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ OTA Channels    │  │ Door Locks      │                 │ │
│  │  │ • Connect OTAs  │  │ • Lock vendor   │                 │ │
│  │  │ • Map rooms     │  │ • API config    │                 │ │
│  │  │ • Test sync     │  │ • Test unlock   │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Setup Complete │                                              │
│  │ Ready to Go    │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Property Manager Journey

### 5.1 Daily Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PROPERTY MANAGER DAILY FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    MORNING REVIEW                          │ │
│  │                                                            │ │
│  │  1. Login to Dashboard                                     │ │
│  │  2. Review overnight activity                              │ │
│  │  3. Check occupancy & revenue                              │ │
│  │  4. Review alerts                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  OPERATIONS REVIEW                         │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │                TODAY'S METRICS                       │   │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │ │
│  │  │  │Arrivals │ │Departures│ │Occupancy│ │ Revenue │   │   │ │
│  │  │  │   12    │ │    8    │ │   78%   │ │ $4,250  │   │   │ │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │                  ALERTS                              │   │ │
│  │  │  • Low inventory alert (2 rooms left for weekend)    │   │ │
│  │  │  • OTA sync error (Booking.com - needs attention)    │   │ │
│  │  │  • VIP arrival today (Room 305)                      │   │ │
│  │  │  • Maintenance overdue (Room 210)                    │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  DECISION MAKING                           │ │
│  │                                                            │ │
│  │  • Adjust pricing (based on demand)                        │ │
│  │  • Manage overbooking                                      │ │
│  │  • Approve upgrades                                        │ │
│  │  • Handle complaints                                       │ │
│  │  • Review staff performance                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  REPORTS & ANALYTICS                       │ │
│  │                                                            │ │
│  │  Daily:                                                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ Occupancy   │ │ Revenue     │ │ Staff       │          │ │
│  │  │ Report      │ │ Report      │ │ Performance │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  │                                                            │ │
│  │  Weekly/Monthly:                                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ Channel     │ │ Guest       │ │ Forecast    │          │ │
│  │  │ Analysis    │ │ Analytics   │ │ Report      │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Channel Partner Journey

### 6.1 OTA Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  CHANNEL PARTNER INTEGRATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OTA             Channel Manager           StaySuite            │
│   │                     │                      │                 │
│   │  1. Connection      │                      │                 │
│   │     Established     │                      │                 │
│   │◀───────────────────▶│                      │                 │
│   │                     │                      │                 │
│   │  2. Room Mapping    │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
│   │  3. Rate Mapping    │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
│   │                     │                      │                 │
│   │  ┌─────────────────────────────────────────────────────┐   │
│   │  │              ONGOING SYNCHRONIZATION                │   │
│   │  │                                                     │   │
│   │  │   INBOUND (OTA → StaySuite):                        │   │
│   │  │   ┌───────────────────────────────────────────┐     │   │
│   │  │   │ • New bookings (webhooks)                 │     │   │
│   │  │   │ • Booking modifications                   │     │   │
│   │  │   │ • Cancellations                           │     │   │
│   │  │   │ • Guest inquiries                         │     │   │
│   │  │   └───────────────────────────────────────────┘     │   │
│   │  │                                                     │   │
│   │  │   OUTBOUND (StaySuite → OTA):                       │   │
│   │  │   ┌───────────────────────────────────────────┐     │   │
│   │  │   │ • Inventory updates                       │     │   │
│   │  │   │ • Rate changes                            │     │   │
│   │  │   │ • Restrictions (MLOS, stop-sell)         │     │   │
│   │  │   │ • Booking confirmations                   │     │   │
│   │  │   └───────────────────────────────────────────┘     │   │
│   │  └─────────────────────────────────────────────────────┘   │
│   │                     │                      │                 │
│   │  4. Reconciliation  │                      │                 │
│   │     (Periodic)      │                      │                 │
│   │◀───────────────────▶│◀────────────────────▶│                 │
│   │                     │                      │                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Night Audit Journey

### 7.1 Night Audit Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIGHT AUDIT JOURNEY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Front Desk         StaySuite             Systems                │
│  Agent                  │                   │                    │
│    │ 1. Start Night      │                   │                    │
│    │    Audit Process    │                   │                    │
│    │────────────────────▶│                   │                    │
│    │                     │                   │                    │
│    │                     │ 2. Verify Room     │                    │
│    │                     │    Charges         │                    │
│    │                     │──────────────────▶│                    │
│    │                     │                   │                    │
│    │                     │ 3. Recalculate     │                    │
│    │                     │    Taxes           │                    │
│    │                     │──────────────────▶│                    │
│    │                     │                   │                    │
│    │                     │ 4. Process         │                    │
│    │                     │    Scheduled       │                    │
│    │                     │    Charges         │                    │
│    │                     │──────────────────▶│                    │
│    │                     │                   │                    │
│    │                     │ 5. Post            │                    │
│    │                     │    Commissions     │                    │
│    │                     │──────────────────▶│                    │
│    │                     │                   │                    │
│    │  6. Review Revenue   │                   │                    │
│    │    Summary           │                   │                    │
│    │◀────────────────────│                   │                    │
│    │                     │                   │                    │
│    │  7. Approve & Close  │                   │                    │
│    │    Business Day      │                   │                    │
│    │────────────────────▶│                   │                    │
│    │                     │                   │                    │
│    │                     │ 8. Create          │                    │
│    │                     │    Discrepancy     │                    │
│    │                     │    Report          │                    │
│    │                     │──────────────────▶│                    │
│    │                     │                   │                    │
│    │  9. Audit Complete   │                   │                    │
│    │    Report Generated  │                   │                    │
│    │◀────────────────────│                   │                    │
│    │                     │                   │                    │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Night Audit Steps Detail

| Step | Action | Description | Validation |
|------|--------|-------------|------------|
| 1 | Start Night Audit | Front desk agent initiates the night audit process for the current business day | No active check-ins in progress |
| 2 | Verify Room Charges | System cross-checks all room charges against booking rates, rate plans, and stay duration | Folio totals match expected charges |
| 3 | Recalculate Taxes | System recalculates all applicable taxes (GST, service tax, luxury tax) on room charges and posted folio items | Tax rules match current configuration |
| 4 | Process Scheduled Charges | System auto-executes all pending scheduled charges (e.g., daily breakfast, minibar, late checkout fees) | Charges mapped to correct folios |
| 5 | Post Commissions | System calculates and posts travel agent and channel partner commissions based on booking source | Commission rates match contracts |
| 6 | Review Revenue Summary | Revenue breakdown by category (room, F&B, laundry, other) presented for agent review | Totals reconcile |
| 7 | Close Business Day | Agent confirms and closes the business day, advancing the system to the next day | All folios balanced |
| 8 | Create Discrepancy Report | System generates a report highlighting any variances between expected and actual amounts | Flagged items for follow-up |
| 9 | Audit Complete | Final audit report archived and available for management review | Report stored in audit log |

---

## 8. City Ledger Journey

### 8.1 City Ledger Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CITY LEDGER JOURNEY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Manager         StaySuite          Agent            Systems     │
│    │                │                 │                │        │
│    │ 1. Create       │                 │                │        │
│    │    Corporate     │                 │                │        │
│    │    Account       │                 │                │        │
│    │─────────────────▶│                 │                │        │
│    │                │                 │                │        │
│    │ 2. Set Credit   │                 │                │        │
│    │    Terms         │                 │                │        │
│    │   (Net 30/60)   │                 │                │        │
│    │─────────────────▶│                 │                │        │
│    │                │                 │                │        │
│    │                │   3. Create City   │                │        │
│    │                │      Ledger       │                │        │
│    │                │      Invoice       │                │        │
│    │                │◀────────────────│                │        │
│    │                │                 │                │        │
│    │                │   4. Add Line      │                │        │
│    │                │      Items with    │                │        │
│    │                │      Revenue       │                │        │
│    │                │      Accounts      │                │        │
│    │                │◀────────────────│                │        │
│    │                │                 │                │        │
│    │                │   5. Post Charges  │                │        │
│    │                │      to City       │                │        │
│    │                │      Ledger        │                │        │
│    │                │◀────────────────│                │        │
│    │                │                 │                │        │
│    │  6. Track        │                 │                │        │
│    │    Payment       │                 │                │        │
│    │◀─────────────────│                 │                │        │
│    │                │                 │                │        │
│    │  7. Manage       │                 │                │        │
│    │    Aging Report  │                 │                │        │
│    │◀─────────────────│                 │                │        │
│    │                │                 │                │        │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 City Ledger Steps Detail

| Step | Action | Description | Validation |
|------|--------|-------------|------------|
| 1 | Create Corporate Account | Manager creates a corporate account entity with company details, contact info, and billing address | Unique account number assigned |
| 2 | Set Credit Terms | Manager configures credit terms (Net 15/30/60/90), credit limit, and billing cycle | Credit approval required for limits over threshold |
| 3 | Create City Ledger Invoice | Agent creates a new city ledger invoice linked to the corporate account | Invoice number auto-generated |
| 4 | Add Line Items | Agent adds line items with revenue accounts (room revenue, F&B, meeting rooms, etc.) | Revenue accounts map to chart of accounts |
| 5 | Post Charges | Charges posted to the city ledger folio with reference to original guest folio | Double-entry accounting validated |
| 6 | Track Payment | Agent records payments against outstanding city ledger balance | Payment applied to oldest invoices first |
| 7 | Manage Aging | Manager reviews aging reports: Current, 30 days, 60 days, 90+ days overdue | Follow-up actions triggered for overdue accounts |

### 8.3 Aging Buckets

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGING REPORT STRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │  Current  │ │ 1-30 Days │ │ 31-60 Days│ │  60+ Days │       │
│  │           │ │  Overdue  │ │  Overdue  │ │  Overdue  │       │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤       │
│  │  $12,500  │ │  $4,200   │ │  $1,800   │ │  $650     │       │
│  │  8 Accts  │ │  3 Accts  │ │  2 Accts  │ │  1 Acct   │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                  │
│  Total Outstanding: $19,150                                      │
│  Action Required: 1 account escalated to collections            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Scheduled Charges Journey

### 9.1 Scheduled Charges Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEDULED CHARGES JOURNEY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin            StaySuite          Agent            Systems    │
│    │                │                 │               │          │
│    │ 1. Create       │                 │               │          │
│    │    Charge        │                 │               │          │
│    │    Template      │                 │               │          │
│    │─────────────────▶│                 │               │          │
│    │                │                 │               │          │
│    │ 2. Assign to     │                 │               │          │
│    │    Room Types /  │                 │               │          │
│    │    Bookings      │                 │               │          │
│    │─────────────────▶│                 │               │          │
│    │                │                 │               │          │
│    │                │ 3. Charges        │               │          │
│    │                │    Auto-Execute   │               │          │
│    │                │    on Schedule    │               │          │
│    │                │──────────────────────────────────▶│          │
│    │                │                 │               │          │
│    │                │ 4. Charges Post   │               │          │
│    │                │    to Folios      │               │          │
│    │                │──────────────────────────────────▶│          │
│    │                │                 │               │          │
│    │                │   5. Review       │               │          │
│    │                │      Execution    │               │          │
│    │                │      History      │               │          │
│    │                │◀────────────────│               │          │
│    │                │                 │               │          │
│    │                │   6. Pause/Resume │               │          │
│    │                │      as Needed   │               │          │
│    │                │◀────────────────│               │          │
│    │                │                 │               │          │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Scheduled Charges Steps Detail

| Step | Action | Description | Validation |
|------|--------|-------------|------------|
| 1 | Create Charge Template | Admin creates a recurring charge template (e.g., daily breakfast $15, daily parking $20, weekly minibar restock) | Template name, amount, frequency, revenue account required |
| 2 | Assign to Room Types/Bookings | Admin assigns templates to specific room types, rate plans, or individual bookings | Assignment does not retroactively apply |
| 3 | Auto-Execute on Schedule | System automatically executes charges based on the configured schedule (daily, weekly, per-stay, custom) | Only executes for active checked-in guests |
| 4 | Post to Folios | Executed charges are posted to guest folios with descriptive line items | Folio balance updated in real-time |
| 5 | Review Execution History | Agent reviews a log of all scheduled charge executions, including successes, failures, and skipped charges | Failed charges flagged for retry |
| 6 | Pause/Resume as Needed | Agent can pause scheduled charges for a specific booking (e.g., guest opted out of breakfast) or resume them | Pause effective immediately |

### 9.3 Charge Template Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│               SCHEDULED CHARGE TEMPLATE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Template Name: Daily Continental Breakfast                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Amount:              $15.00                                  │ │
│  │  Revenue Account:     F&B - Breakfast (6100)                 │ │
│  │  Tax Group:           F&B Tax                                │ │
│  │  Frequency:           Daily                                  │ │
│  │  Execution Time:      06:00 AM (property local time)        │ │
│  │  Start Trigger:       Check-in date                          │ │
│  │  End Trigger:         Check-out date (excluded)              │ │
│  │  Assign To:           Room Types - Deluxe Suite, Premium     │ │
│  │  Status:              Active                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Template Name: Weekly Minibar Restock                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Amount:              $35.00                                  │ │
│  │  Revenue Account:     Minibar (6200)                         │ │
│  │  Tax Group:           Minibar Tax                            │ │
│  │  Frequency:           Weekly (every 7 days)                  │ │
│  │  Execution Time:      10:00 AM (property local time)        │ │
│  │  Start Trigger:       Check-in date                          │ │
│  │  End Trigger:         Check-out date                         │ │
│  │  Assign To:           All Room Types                         │ │
│  │  Status:              Active                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Commission Journey

### 10.1 Commission Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMISSION JOURNEY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin            StaySuite          Manager          Systems   │
│    │                │                  │               │         │
│    │ 1. Set          │                  │               │         │
│    │    Commission   │                  │               │         │
│    │    Rules for    │                  │               │         │
│    │    Travel Agent │                  │               │         │
│    │─────────────────▶│                  │               │         │
│    │                │                  │               │         │
│    │                │ 2. Booking Comes  │               │         │
│    │                │    from Travel    │               │         │
│    │                │    Agent          │               │         │
│    │                │──────────────────────────────────▶│         │
│    │                │                  │               │         │
│    │                │ 3. System         │               │         │
│    │                │    Auto-Calculates│               │         │
│    │                │    Commission     │               │         │
│    │                │──────────────────────────────────▶│         │
│    │                │                  │               │         │
│    │                │ 4. Commission     │               │         │
│    │                │    Record         │               │         │
│    │                │    Created        │               │         │
│    │                │──────────────────────────────────▶│         │
│    │                │                  │               │         │
│    │                │   5. Manager      │               │         │
│    │                │      Reviews      │               │         │
│    │                │      Commission   │               │         │
│    │                │◀─────────────────│               │         │
│    │                │                  │               │         │
│    │                │   6. Processes     │               │         │
│    │                │      Payment      │               │         │
│    │                │◀─────────────────│               │         │
│    │                │                  │               │         │
│    │  7. Payment     │                  │               │         │
│    │    Confirmation │                  │               │         │
│    │◀─────────────────│                  │               │         │
│    │                │                  │               │         │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Commission Steps Detail

| Step | Action | Description | Validation |
|------|--------|-------------|------------|
| 1 | Set Commission Rules | Admin configures commission rates per travel agent or channel partner (flat %, sliding scale, per-room-type) | Rules tied to valid agent/partner account |
| 2 | Booking Received | A new booking is received from a configured travel agent or channel partner | Booking source matched to commission rule |
| 3 | Auto-Calculate Commission | System automatically calculates commission based on the applicable rule and booking value | Calculation uses rule priority (most specific first) |
| 4 | Commission Record Created | A commission record is created with status "Pending" linked to the booking and agent | Record includes calculated amount, booking ref, agent details |
| 5 | Manager Reviews | Manager reviews pending commission records, can approve, adjust, or dispute | Approval workflow for amounts over threshold |
| 6 | Process Payment | Approved commissions are batched and processed for payment to the agent | Payment scheduled per agreed terms |
| 7 | Payment Confirmation | Payment confirmation recorded against the commission record with reference number | Record status updated to "Paid" |

### 10.3 Commission Rule Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│                 COMMISSION RULE STRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Travel Agent: Global Travel Partners                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Default Rate:        10% of room revenue                   │ │
│  │  Sliding Scale:                                              │ │
│  │    • 1-50 room nights:   10%                                 │ │
│  │    • 51-200 room nights: 12%                                 │ │
│  │    • 200+ room nights:   15%                                 │ │
│  │  Applicable To:        Room revenue only (excl. F&B, etc.)  │ │
│  │  Payment Terms:        Net 30 after checkout                 │ │
│  │  Minimum Payout:       $100                                  │ │
│  │  Status:              Active                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Channel Partner: Booking.com                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Default Rate:        Per-channel commission (auto-set)      │ │
│  │  Applicable To:        Total booking value                   │ │
│  │  Payment Terms:        Monthly invoice from channel           │ │
│  │  Deduction Method:     Auto-deducted by channel               │ │
│  │  Status:              Active                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: User Journey Quick Reference

### A.1 Guest Journey Summary

| Phase | Actions | System Triggers |
|-------|---------|-----------------|
| Discovery | Search, Compare, Select | OTA display, Rate sync |
| Booking | Reserve, Pay, Confirm | Inventory lock, Email confirm |
| Pre-Arrival | Pre-check-in, Upload docs | Automation triggers |
| Stay | Check-in, Services, Check-out | WiFi enable, Digital key |
| Post-Stay | Feedback, Loyalty | CRM update, Campaigns |

### A.2 Staff Journey Summary

| Role | Primary Actions | Dashboard Focus |
|------|-----------------|-----------------|
| Front Desk | Check-in/out, Reservations | Arrivals, Departures |
| Housekeeping | Cleaning, Status updates | Task list, Room grid |
| Restaurant | Orders, Billing | Kitchen display, Tables |
| Maintenance | Repairs, Assets | Work orders, Tickets |

### A.3 Admin Journey Summary

| Phase | Actions | Tools |
|-------|---------|-------|
| Setup | Configure property | Setup wizard |
| Users | Manage access | User management |
| Integrations | Connect systems | Integration hub |
| Monitoring | Health check | Admin dashboard |

---

## Appendix B: Event Triggers Reference

### B.1 Booking Events

| Event | Triggers |
|-------|----------|
| `booking.created` | Inventory lock, Email confirm, CRM update |
| `booking.confirmed` | OTA sync, Pre-arrival schedule |
| `booking.modified` | Inventory recheck, Rate adjustment |
| `booking.cancelled` | Inventory release, Refund process |
| `booking.checked_in` | WiFi enable, Digital key, Room status |
| `booking.checked_out` | WiFi disable, Housekeeping task, Feedback |

### B.2 Payment Events

| Event | Triggers |
|-------|----------|
| `payment.initiated` | Gateway selection, Fraud check |
| `payment.completed` | Invoice generate, Booking confirm |
| `payment.failed` | Alert, Retry, Alternative gateway |
| `refund.processed` | Inventory release, Notification |

### B.3 WiFi Events

| Event | Triggers |
|-------|----------|
| `wifi.session.started` | Usage tracking start |
| `wifi.session.stopped` | Usage calculation, Billing |
| `wifi.auth.failed` | Alert, Logging |

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*

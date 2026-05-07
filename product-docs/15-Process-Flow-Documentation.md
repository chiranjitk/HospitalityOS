# StaySuite Process Flow Documentation
## Operational Workflows & Business Processes

**Version**: 2.1  
**Last Updated: July 2026  
**Author**: Cryptsk Pvt Ltd

---

## Table of Contents

1. [Overview](#1-overview)
2. [Front Desk Processes](#2-front-desk-processes)
3. [Housekeeping Processes](#3-housekeeping-processes)
4. [Billing Processes](#4-billing-processes)
   - 4.1 [Folio Management](#41-folio-management-process)
   - 4.2 [Night Audit Process](#42-night-audit-process)
   - 4.3 [Scheduled Charges Process](#43-scheduled-charges-process)
   - 4.4 [City Ledger Process](#44-city-ledger-process)
   - 4.5 [Commission Process](#45-commission-process)
   - 4.6 [Posting Rules Process](#46-posting-rules-process)
5. [Reservation Processes](#5-reservation-processes)
6. [Guest Service Processes](#6-guest-service-processes)
7. [Reporting Processes](#7-reporting-processes)
8. [Automation Workflows](#8-automation-workflows)
9. [New Billing & Operations Workflows (v2.1)](#9-new-billing--operations-workflows-v21)

---

## 1. Overview

### 1.1 Purpose

This document defines the standard operational processes and workflows that drive daily hotel operations within StaySuite. Each process includes:
- Step-by-step flow
- System interactions
- Decision points
- Exception handling

### 1.2 Process Categories

| Category | Description |
|----------|-------------|
| **Front Desk** | Check-in, check-out, walk-in processes |
| **Housekeeping** | Room cleaning, maintenance, inspections |
| **Billing** | Payment processing, invoicing, refunds, night audit, scheduled charges, city ledger |
| **Billing (v2.1)** | Night audit, scheduled charges, city ledger, commissions, posting rules |
| **Reservation** | Booking creation, modification, cancellation |
| **Guest Service** | Requests, complaints, special arrangements |
| **Reporting** | Daily reports, analytics, audits |

---

## 2. Front Desk Processes

### 2.1 Guest Check-In Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GUEST CHECK-IN PROCESS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Arrives at Front Desk                                         │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Guest     │                                                   │
│           │   Arrives   │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐     ┌─────────────┐                              │
│           │  Greeting   │────▶│  Ask for    │                              │
│           │             │     │ Reservation │                              │
│           └─────────────┘     │   Details   │                              │
│                               └──────┬──────┘                              │
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                   │
│                    │                 │                 │                   │
│              Has Booking       Walk-in Guest     Search Failed            │
│                    │                 │                 │                   │
│                    ▼                 ▼                 ▼                   │
│           ┌─────────────┐   ┌─────────────┐   ┌─────────────┐             │
│           │   Search    │   │  Create New │   │  Manual     │             │
│           │   Booking   │   │  Booking    │   │  Search     │             │
│           └──────┬──────┘   └──────┬──────┘   └──────┬──────┘             │
│                  │                 │                 │                     │
│                  └─────────────────┼─────────────────┘                     │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────┐                                  │
│                           │  Verify     │                                  │
│                           │  Identity   │                                  │
│                           │  (ID/Passport)                                 │
│                           └──────┬──────┘                                  │
│                                  │                                          │
│                       ┌──────────┴──────────┐                              │
│                       │                     │                              │
│                  ID Verified           ID Not Valid                         │
│                       │                     │                              │
│                       ▼                     ▼                              │
│                ┌─────────────┐        ┌─────────────┐                     │
│                │  Continue   │        │  Request    │                     │
│                │             │        │  Alternative│                     │
│                └──────┬──────┘        └─────────────┘                     │
│                       │                                                    │
│                       ▼                                                    │
│                ┌─────────────┐                                             │
│                │  Review     │                                             │
│                │  Booking    │                                             │
│                │  Details    │                                             │
│                └──────┬──────┘                                             │
│                       │                                                    │
│         ┌─────────────┼─────────────┐                                     │
│         │             │             │                                     │
│    Pre-paid      Pay at Hotel   Payment                               │
│    Booking       (Deposit)       Issues                                   │
│         │             │             │                                     │
│         ▼             ▼             ▼                                     │
│    ┌─────────┐  ┌─────────┐  ┌─────────────┐                             │
│    │Continue │  │ Collect │  │ Resolve     │                             │
│    │         │  │ Payment │  │ Payment     │                             │
│    └────┬────┘  └────┬────┘  │ (Alt method)│                             │
│         │            │       └─────────────┘                             │
│         └─────┬──────┘                                                    │
│               │                                                            │
│               ▼                                                            │
│        ┌─────────────┐                                                    │
│        │  Assign     │                                                    │
│        │  Room       │                                                    │
│        └──────┬──────┘                                                    │
│               │                                                            │
│    ┌──────────┴──────────┐                                                │
│    │                     │                                                │
│ Room Ready         Room Not Ready                                          │
│    │                     │                                                │
│    ▼                     ▼                                                │
│ ┌─────────┐      ┌─────────────────┐                                      │
│ │Continue │      │ Offer           │                                      │
│ │         │      │ Alternatives:   │                                      │
│ └────┬────┘      │ • Different room│                                      │
│      │           │ • Wait in lobby │                                      │
│      │           │ • Early check-in│                                      │
│      │           │   fee           │                                      │
│      │           └────────┬────────┘                                      │
│      │                    │                                                │
│      └────────────────────┘                                                │
│               │                                                            │
│               ▼                                                            │
│        ┌─────────────┐                                                    │
│        │  Check-In   │                                                    │
│        │  Action     │──────────────────────────────────────────┐         │
│        │  (System)   │                                          │         │
│        └──────┬──────┘                                          │         │
│               │                                                 │         │
│               │  SYSTEM AUTOMATION:                             │         │
│               │  ─────────────────────────────────────────────│         │
│               │  • Update booking status → CHECKED_IN         │         │
│               │  • Update room status → OCCUPIED              │         │
│               │  • Enable WiFi access                         │         │
│               │  • Generate digital key (if enabled)          │         │
│               │  • Send welcome message                       │         │
│               │  • Create housekeeping check-in record        │         │
│               │  • Update guest profile (stay count)          │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  Hand Over  │                                         │         │
│        │  Key Card   │                                         │         │
│        └──────┬──────┘                                         │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  Provide    │                                         │         │
│        │  Information│                                         │         │
│        │  • Room #   │                                         │         │
│        │  • WiFi     │                                         │         │
│        │  • Amenities│                                         │         │
│        │  • Services │                                         │         │
│        └──────┬──────┘                                         │         │
│               │                                                 │         │
│               ▼                                                 │         │
│        ┌─────────────┐                                         │         │
│        │  END:       │                                         │         │
│        │  Guest      │                                         │         │
│        │  Checked In │                                         │         │
│        └─────────────┘                                         │         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Guest Check-Out Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GUEST CHECK-OUT PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Requests Check-Out                                            │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Guest     │                                                   │
│           │   Requests  │                                                   │
│           │   Check-Out │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Retrieve   │                                                   │
│           │  Booking    │                                                   │
│           │  (Room # or Name)                                               │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Review     │                                                   │
│           │  Folio      │                                                   │
│           │  • Room charges                                                │
│           │  • F&B charges                                                 │
│           │  • Extra services                                              │
│           │  • Taxes                                                       │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐     ┌─────────────┐                              │
│           │  Present    │────▶│  Guest      │                              │
│           │  Folio      │     │  Review     │                              │
│           │  Summary    │     │             │                              │
│           └─────────────┘     └──────┬──────┘                              │
│                                        │                                     │
│                          ┌─────────────┼─────────────┐                      │
│                          │             │             │                      │
│                     Approved      Dispute       Add Charges                 │
│                          │             │             │                      │
│                          ▼             ▼             ▼                      │
│                   ┌───────────┐ ┌───────────┐ ┌───────────┐                │
│                   │ Continue  │ │ Investigate│ │ Add Item  │                │
│                   │           │ │ & Resolve  │ │ to Folio  │                │
│                   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘                │
│                         │             │             │                       │
│                         └─────────────┼─────────────┘                       │
│                                       │                                      │
│                                       ▼                                      │
│                              ┌─────────────┐                                │
│                              │  Calculate  │                                │
│                              │  Balance    │                                │
│                              └──────┬──────┘                                │
│                                     │                                        │
│                      ┌──────────────┼──────────────┐                        │
│                      │              │              │                        │
│                 Balance=0     Credit Due     Payment Due                    │
│                      │              │              │                        │
│                      ▼              ▼              ▼                        │
│               ┌───────────┐  ┌───────────┐  ┌───────────┐                  │
│               │ Generate  │  │ Process   │  │ Process   │                  │
│               │ Invoice   │  │ Refund    │  │ Payment   │                  │
│               │ Only      │  │           │  │           │                  │
│               └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                  │
│                     │              │              │                         │
│                     └──────────────┼──────────────┘                         │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Generate   │                                │
│                             │  Invoice    │                                │
│                             └──────┬──────┘                                │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Deliver    │                                │
│                             │  Invoice    │                                │
│                             │  (Print/Email)                               │
│                             └──────┬──────┘                                │
│                                    │                                        │
│                                    ▼                                        │
│                             ┌─────────────┐                                │
│                             │  Check-Out  │                                │
│                             │  Action     │────────────────────────────┐   │
│                             │  (System)   │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    │  SYSTEM AUTOMATION:                │   │
│                                    │  ────────────────────────────────│   │
│                                    │  • Update booking → CHECKED_OUT  │   │
│                                    │  • Update room → VACANT_DIRTY    │   │
│                                    │  • Disable WiFi access           │   │
│                                    │  • Revoke digital key            │   │
│                                    │  • Create housekeeping task      │   │
│                                    │  • Send feedback request         │   │
│                                    │  • Update guest profile          │   │
│                                    │  • Credit loyalty points         │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  Collect    │                            │   │
│                             │  Key Card   │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  Thank      │                            │   │
│                             │  Guest      │                            │   │
│                             └──────┬──────┘                            │   │
│                                    │                                    │   │
│                                    ▼                                    │   │
│                             ┌─────────────┐                            │   │
│                             │  END:       │                            │   │
│                             │  Check-Out  │                            │   │
│                             │  Complete   │                            │   │
│                             └─────────────┘                            │   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Walk-In Booking Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WALK-IN BOOKING PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Arrives Without Reservation                                   │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Walk-in   │                                                   │
│           │   Guest     │                                                   │
│           │   Arrives   │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Ask for    │                                                   │
│           │  Stay Dates │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Check      │                                                   │
│           │  Availability│                                                  │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│        ┌─────────┴─────────┐                                                │
│        │                   │                                                │
│   Rooms Available    No Availability                                         │
│        │                   │                                                │
│        ▼                   ▼                                                │
│ ┌─────────────┐     ┌─────────────┐                                        │
│ │ Show        │     │ Offer       │                                        │
│ │ Available   │     │ Alternatives│                                        │
│ │ Rooms       │     │ • Waitlist  │                                        │
│ └──────┬──────┘     │ • Nearby    │                                        │
│        │            │   hotels    │                                        │
│        │            │ • Different │                                        │
│        │            │   dates     │                                        │
│        │            └─────────────┘                                        │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Present     │                                                             │
│ │ Options     │                                                             │
│ │ • Room types│                                                             │
│ │ • Rates     │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Guest       │                                                             │
│ │ Selection   │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Collect     │                                                             │
│ │ Guest Info  │                                                             │
│ │ • Name      │                                                             │
│ │ • Phone     │                                                             │
│ │ • Email     │                                                             │
│ │ • ID        │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐                                                             │
│ │ Create      │                                                             │
│ │ Booking     │                                                             │
│ │ (Status:    │                                                             │
│ │  CONFIRMED) │                                                             │
│ └──────┬──────┘                                                             │
│        │                                                                    │
│        ▼                                                                    │
│ ┌─────────────┐     ┌─────────────┐                                        │
│ │ Collect     │────▶│ Payment     │                                        │
│ │ Payment     │     │ Confirmed   │                                        │
│ └─────────────┘     └──────┬──────┘                                        │
│                            │                                                 │
│                            ▼                                                 │
│                     ┌─────────────┐                                         │
│                     │ Immediate   │                                         │
│                     │ Check-In    │                                         │
│                     │ (See        │                                         │
│                     │  Check-In   │                                         │
│                     │  Process)   │                                         │
│                     └─────────────┘                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Housekeeping Processes

### 3.1 Daily Housekeeping Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DAILY HOUSEKEEPING WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Morning Shift Begin                                                 │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │   Shift     │                                                   │
│           │   Start     │                                                   │
│           │   (7:00 AM) │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Staff      │                                                   │
│           │  Login      │                                                   │
│           │  (Staff App)│                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │                  VIEW TASK LIST                          │       │
│           │                                                          │       │
│           │   Priority Order:                                        │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   1. Check-outs (Departures today)                      │       │
│           │   2. Stay-overs (Guests continuing stay)                │       │
│           │   3. Vacant dirty rooms                                 │       │
│           │   4. Special requests                                   │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Start      │                                                   │
│           │  First Task │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│         ┌────────┴────────┐                                                 │
│         │                 │                                                 │
│    Check-Out         Stay-Over                                              │
│    Room              Room                                                   │
│         │                 │                                                 │
│         ▼                 ▼                                                 │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │ Full Clean   │  │ Light Clean  │                                        │
│  │              │  │              │                                        │
│  │ • Strip bed  │  │ • Make bed   │                                        │
│  │ • Fresh linen│  │ • Empty trash│                                        │
│  │ • Clean bath │  │ • Quick wipe │                                        │
│  │ • Dust all   │  │ • Check      │                                        │
│  │ • Vacuum     │  │   amenities  │                                        │
│  │ • Check mini │  │              │                                        │
│  │   bar        │  │              │                                        │
│  └──────┬───────┘  └──────┬───────┘                                        │
│         │                 │                                                 │
│         └────────┬────────┘                                                 │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Issues     │     ┌─────────────┐                              │
│           │  Found?     │────▶│ Yes         │                              │
│           └─────────────┘     │             │                              │
│                  │            │ ┌─────────┐ │                              │
│                  No           │ │Report   │ │                              │
│                  │            │ │Issue    │ │                              │
│                  │            │ │• Maint. │ │                              │
│                  │            │ │• Damage │ │                              │
│                  │            │ │• Lost & │ │                              │
│                  │            │ │  Found  │ │                              │
│                  │            │ └────┬────┘ │                              │
│                  │            └─────┼──────┘                              │
│                  │                  │                                      │
│                  └──────────────────┘                                      │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Update     │                               │
│                              │  Room Status│                               │
│                              │  → CLEAN    │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Complete   │                               │
│                              │  Task in    │                               │
│                              │  System     │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  More       │     ┌─────────────┐          │
│                              │  Tasks?     │────▶│ Yes         │          │
│                              └─────────────┘     │             │          │
│                                     │            │ Next Task   │          │
│                                     No           │             │          │
│                                     │            └──────┬──────┘          │
│                                     │                   │                  │
│                                     │    ┌──────────────┘                  │
│                                     │    │                                 │
│                                     │    └────────────────────┐            │
│                                     │                         │            │
│                                     │                         ▼            │
│                                     │                  ┌─────────────┐    │
│                                     │                  │   Process   │    │
│                                     │                  │   Next Task │    │
│                                     │                  └─────────────┘    │
│                                     │                                    │
│                                     ▼                                    │
│                              ┌─────────────┐                            │
│                              │  END:       │                            │
│                              │  Shift      │                            │
│                              │  Complete   │                            │
│                              └─────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Room Status State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ROOM STATUS STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌─────────────────┐                                │
│                          │   VACANT_DIRTY  │                                │
│                          │                 │                                │
│                          │  Room empty,    │                                │
│                          │  needs cleaning │                                │
│                          └────────┬────────┘                                │
│                                   │                                          │
│                      Housekeeping │ Clean                                    │
│                                   │ Complete                                 │
│                                   ▼                                          │
│                          ┌─────────────────┐                                │
│                          │   VACANT_CLEAN  │                                │
│                          │                 │                                │
│                          │  Room ready     │                                │
│                          │  for guest      │                                │
│                          └────────┬────────┘                                │
│                                   │                                          │
│                        Guest Check│-In                                       │
│                                   │                                          │
│                                   ▼                                          │
│              ┌────────────────────────────────────────────┐                 │
│              │                                             │                 │
│              │            OCCUPIED                         │                 │
│              │                                             │                 │
│              │   ┌─────────────┐    ┌─────────────┐       │                 │
│              │   │ OCCUPIED_   │◀──▶│ OCCUPIED_   │       │                 │
│              │   │ CLEAN       │    │ DIRTY       │       │                 │
│              │   │             │    │             │       │                 │
│              │   │ Guest in,   │    │ Guest in,   │       │                 │
│              │   │ room clean  │    │ needs clean │       │                 │
│              │   └─────────────┘    └─────────────┘       │                 │
│              │                                             │                 │
│              └──────────────────────┬─────────────────────┘                 │
│                                     │                                        │
│                        Guest Check-Out                                      │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────┐                                │
│                          │   VACANT_DIRTY  │                                │
│                          │   (Loop back)   │                                │
│                          └─────────────────┘                                │
│                                                                              │
│              ┌─────────────────────────────────────────────┐                │
│              │                                             │                │
│              │            SPECIAL STATUSES                  │                │
│              │                                             │                │
│              │   ┌─────────────────┐  ┌─────────────────┐ │                │
│              │   │ OUT_OF_ORDER    │  │ OUT_OF_SERVICE  │ │                │
│              │   │                 │  │                 │ │                │
│              │   │ Maintenance     │  │ Long-term       │ │                │
│              │   │ required        │  │ unavailable     │ │                │
│              │   │ (repair)        │  │ (renovation)    │ │                │
│              │   └─────────────────┘  └─────────────────┘ │                │
│              │                                             │                │
│              └─────────────────────────────────────────────┘                │
│                                                                              │
│  Transitions:                                                               │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  From              To                  Trigger                              │
│  ─────────────────────────────────────────────────────────────────────     │
│  VACANT_DIRTY   → VACANT_CLEAN      → Housekeeping complete               │
│  VACANT_CLEAN   → OCCUPIED_CLEAN    → Guest check-in                      │
│  OCCUPIED_CLEAN → OCCUPIED_DIRTY    → After time / guest request          │
│  OCCUPIED_DIRTY → OCCUPIED_CLEAN    → Housekeeping complete               │
│  OCCUPIED_*     → VACANT_DIRTY      → Guest check-out                     │
│  ANY            → OUT_OF_ORDER      → Maintenance issue reported          │
│  OUT_OF_ORDER   → VACANT_DIRTY      → Maintenance complete                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Billing Processes

### 4.1 Folio Management Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FOLIO MANAGEMENT PROCESS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FOLIO STRUCTURE                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         GUEST FOLIO                                  │   │
│  │                                                                      │   │
│  │   Date        Description              Debit      Credit    Balance │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │   Mar 15      Room Charge - Deluxe     $150.00              $150.00 │   │
│  │   Mar 15      Room Service             $35.00               $185.00 │   │
│  │   Mar 16      Room Charge - Deluxe     $150.00              $335.00 │   │
│  │   Mar 16      Mini Bar                 $25.00               $360.00 │   │
│  │   Mar 16      Deposit                            $200.00    $160.00 │   │
│  │   Mar 17      Room Charge - Deluxe     $150.00              $310.00 │   │
│  │   Mar 17      Tax (12%)                $37.20               $347.20 │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │   TOTAL DUE:                                        $347.20          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  CHARGE TYPES                                                               │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ROOM CHARGES    │  │ F&B CHARGES     │  │ SERVICE CHARGES │            │
│  │                 │  │                 │  │                 │            │
│  │ • Nightly rate  │  │ • Restaurant    │  │ • Laundry       │            │
│  │ • Extra person  │  │ • Room service  │  │ • Spa           │            │
│  │ • Rollaway bed  │  │ • Mini bar      │  │ • Transportation│            │
│  │ • Early/Late    │  │ • Bar           │  │ • Tours         │            │
│  │   check-in/out  │  │                 │  │ • Business ctr  │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ADJUSTMENTS     │  │ PAYMENTS        │  │ REFUNDS         │            │
│  │                 │  │                 │  │                 │            │
│  │ • Discounts     │  │ • Cash          │  │ • Cancellation  │            │
│  │ • Corrections   │  │ • Credit card   │  │ • Service issue │            │
│  │ • Write-offs    │  │ • Debit card    │  │ • Overcharge    │            │
│  │ • Comps         │  │ • UPI/Wallet    │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  FOLIO SPLITTING                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Single Folio                    Split Folio                       │   │
│  │                                                                      │   │
│  │   ┌─────────────────┐            ┌─────────────────┐               │   │
│  │   │  Master Folio   │            │  Room Folio     │               │   │
│  │   │                 │            │  (Company pays) │               │   │
│  │   │  All charges    │            │  • Room         │               │   │
│  │   │  to one account │            │  • Tax          │               │   │
│  │   └─────────────────┘            └─────────────────┘               │   │
│  │                                           │                         │   │
│  │                                           ▼                         │   │
│  │                                   ┌─────────────────┐               │   │
│  │                                   │  Incidentals    │               │   │
│  │                                   │  (Guest pays)   │               │   │
│  │                                   │  • F&B          │               │   │
│  │                                   │  • Services     │               │   │
│  │                                   │  • Mini bar     │               │   │
│  │                                   └─────────────────┘               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Night Audit Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NIGHT AUDIT PROCESS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Night Auditor Begins End-of-Day Procedure                           │
│  (Typically runs at 23:00 or configurable time)                            │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │  Night Audit│                                                   │
│           │  Initiated  │                                                   │
│           │  (Auto/Sched)│                                                  │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐     ┌─────────────┐                              │
│           │  Verify No  │────▶│  Lock Date  │                              │
│           │  Concurrent │     │  (Business  │                              │
│           │  Audit      │     │   Day Roll) │                              │
│           │  Running    │     └──────┬──────┘                              │
│           └─────────────┘            │                                      │
│                                       ▼                                      │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │              PHASE 1: ROOM VERIFICATION                 │       │
│           │                                                          │       │
│           │   Step 1: Verify All Room Statuses                      │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Compare physical room status vs system status       │       │
│           │   • Flag discrepancies (e.g., guest checked out but     │       │
│           │     room still shows OCCUPIED)                          │       │
│           │   • Identify rooms with extended stay not updated       │       │
│           │   • Check for overstay guests                           │       │
│           │                                                          │       │
│           │   Step 2: Room Revenue Posting                          │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Post nightly room charges for all occupied rooms   │       │
│           │   • Apply rate plan pricing                             │       │
│           │   • Post extra-person charges                           │       │
│           │   • Apply package plan inclusions/exclusions            │       │
│           │   • Post crib charges for children                      │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │              PHASE 2: CHARGE VERIFICATION               │       │
│           │                                                          │       │
│           │   Step 3: Review All Posted Charges                    │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Restaurant & POS charges                           │       │
│           │   • Mini-bar consumption                                │       │
│           │   • Laundry charges                                     │       │
│           │   • Spa & wellness charges                              │       │
│           │   • Business center charges                             │       │
│           │   • Transfer charges                                    │       │
│           │   • Telephone charges                                   │       │
│           │                                                          │       │
│           │   Step 4: Scheduled Charge Execution                   │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Execute all due scheduled/recurring charges        │       │
│           │   • Process posting rule triggers                      │       │
│           │   • Apply commission calculations                      │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │              PHASE 3: FINANCIAL RECONCILIATION          │       │
│           │                                                          │       │
│           │   Step 5: Cashier Reconciliation                       │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Summarize all payment methods for the day          │       │
│           │   • Cash: Opening balance + Received - Disbursed       │       │
│           │   • Credit cards: Verify batch totals vs gateway       │       │
│           │   • UPI/Digital: Match with bank settlements           │       │
│           │   • City ledger transfers                              │       │
│           │                                                          │       │
│           │   ┌──────────────┬──────────────────┐                    │       │
│           │   │              │                  │                    │       │
│           │   │  Balanced    │  Out of Balance  │                    │       │
│           │   │              │                  │                    │       │
│           │   │     │        └────────┬─────────┘                    │       │
│           │   │     │                 │                             │       │
│           │   │     ▼                 ▼                             │       │
│           │   │  Continue     ┌─────────────────┐                  │       │
│           │   │              │ Investigate &    │                  │       │
│           │   │              │ Create          │                  │       │
│           │   │              │ Adjustment Entry │                  │       │
│           │   │              └────────┬────────┘                  │       │
│           │   │                       │                           │       │
│           │   └───────────────────────┘                           │       │
│           │                                                          │       │
│           │   Step 6: Tax Calculation & Verification               │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Verify tax on all posted charges                    │       │
│           │   • Apply seasonal/special tax rates                   │       │
│           │   • Verify tax-exempt charges                           │       │
│           │   • Generate tax summary report                        │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────────────────────────────────────────────────┐       │
│           │              PHASE 4: ADVANCEMENT & CLOSE               │       │
│           │                                                          │       │
│           │   Step 7: No-Show Processing                           │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Identify unarrived confirmed reservations          │       │
│           │   ┌──────────────────┬──────────────────┐               │       │
│           │   │  Has deposit?    │  No deposit       │               │       │
│           │   │  ├─Keep deposit   │  ├─Mark NO_SHOW   │               │       │
│           │   │  ├─Post 1st night│  ├─Release room    │               │       │
│           │   │  └─Release room  │  └─Notify guest    │               │       │
│           │   └──────────────────┴──────────────────┘               │       │
│           │                                                          │       │
│           │   Step 8: Automatic Check-Outs                         │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Process departures where guest did not visit       │       │
│           │     front desk                                         │       │
│           │   • Post final room charges                             │       │
│           │   • Close folio if balance is zero                      │       │
│           │   • Generate invoice                                    │       │
│           │   • If balance > 0 → transfer to city ledger or         │       │
│           │     notify guest for payment                            │       │
│           │                                                          │       │
│           │   Step 9: Advance Business Date                        │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Roll system date to next business day               │       │
│           │   • Update all dashboard counters                       │       │
│           │   • Refresh availability calendar                       │       │
│           │   • Run scheduled reports                               │       │
│           │                                                          │       │
│           │   Step 10: Generate Night Audit Report                 │       │
│           │   ──────────────────────────────────────────────────── │       │
│           │   • Room revenue summary                                │       │
│           │   • F&B revenue summary                                  │       │
│           │   • Total revenue & tax breakdown                       │       │
│           │   • Occupancy statistics (ADR, RevPAR)                   │       │
│           │   • Arrival/departure summary                           │       │
│           │   • Payment method breakdown                            │       │
│           │   • Outstanding balances                                │       │
│           │   • City ledger activity                                 │       │
│           │                                                          │       │
│           └──────────────────────────────────────────────────────────┘       │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Mark Audit │                                                   │
│           │  as COMPLETE │─────────────────────────────────────┐              │
│           └──────┬──────┘                                      │              │
│                  │                                             │              │
│                  │  SYSTEM AUTOMATION POST-AUDIT:               │              │
│                  │  ────────────────────────────────────────── │              │
│                  │  • Archive audit log with timestamp         │              │
│                  │  • Store daily snapshot for reporting        │              │
│                  │  • Trigger post-audit reports to             │              │
│                  │    management                                │              │
│                  │  • Reset daily counters                     │              │
│                  │  • Prepare next-day arrival list             │              │
│                  │                                               │              │
│                  ▼                                               │              │
│           ┌─────────────┐                                       │              │
│           │  END:       │                                       │              │
│           │  Night Audit│                                       │              │
│           │  Complete   │                                       │              │
│           └─────────────┘                                       │              │
│                                                                    │              │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Scheduled Charges Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCHEDULED CHARGES PROCESS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OVERVIEW: Automated recurring or one-time future charges                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE A: CHARGE CREATION                         │   │
│  │                                                                      │   │
│  │   START: User Creates a Scheduled Charge                           │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Define     │                                                   │   │
│  │   │  Charge     │                                                   │   │
│  │   │  Details    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              CHARGE CONFIGURATION                    │          │   │
│  │   │                                                      │          │   │
│  │   │   Charge Name:  [Daily Room Service]                 │          │   │
│  │   │   Description: [Breakfast buffet per guest]           │          │   │
│  │   │   Amount:       [25.00]                               │          │   │
│  │   │   Tax Code:     [STANDARD_TAX]                        │          │   │
│  │   │   Revenue Acct: [F&B - Restaurant]                    │          │   │
│  │   │                                                      │          │   │
│  │   │   Schedule Type:  ┌───────────┬───────────────┐      │          │   │
│  │   │                   │ Recurring │ One-Time       │      │          │   │
│  │   │                   └─────┬─────┴───────┬───────┘      │          │   │
│  │   │                         │             │              │          │   │
│  │   │   Recurring Pattern:   ▼             │              │          │   │
│  │   │   ┌─────────────────────┐            │              │          │   │
│  │   │   │ • Daily             │            │              │          │   │
│  │   │   │ • Weekly (Day: __) │            │              │          │   │
│  │   │   │ • Monthly (Date: _)│            │              │          │   │
│  │   │   │ • Custom interval  │            │              │          │   │
│  │   │   └─────────────────────┘            │              │          │   │
│  │   │                         │             │              │          │   │
│  │   │   Start Date:  [2026-03-15]           │              │          │   │
│  │   │   End Date:    [2026-03-20] (if set)  │              │          │   │
│  │   │   End After:   [___] occurrences      │              │          │   │
│  │   │                         │             │              │          │   │
│  │   │   Target Scope:                     │              │          │   │
│  │   │   ┌─────────────────┐                 │              │          │   │
│  │   │   │ All properties  │                 │              │          │   │
│  │   │   │ Specific prop.  │                 │              │          │   │
│  │   │   │ Room types      │                 │              │          │   │
│  │   │   │ Booking sources │                 │              │          │   │
│  │   │   └─────────────────┘                 │              │          │   │
│  │   │                                                      │          │   │
│  │   │   Apply Conditions (optional):                        │          │   │
│  │   │   • Only if booking source = [OTA]                   │          │   │
│  │   │   • Only if room type = [Suite]                       │          │   │
│  │   │   • Only if rate plan = [Package]                     │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Validate   │                                                   │   │
│  │   │  & Save     │                                                   │   │
│  │   │  (Status:   │                                                   │   │
│  │   │   ACTIVE)   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE B: SCHEDULING & EXECUTION                   │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Cron Job   │                                                   │   │
│  │   │  Triggers  │                                                   │   │
│  │   │  (Night     │                                                   │   │
│  │   │   Audit)    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Query All  │                                                   │   │
│  │   │  Scheduled  │                                                   │   │
│  │   │  Charges    │                                                   │   │
│  │   │  Due Today  │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  For Each   │                                                   │   │
│  │   │  Due Charge │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Find All   │                                                   │   │
│  │   │  Matching   │                                                   │   │
│  │   │  Bookings   │                                                   │   │
│  │   │  (by scope) │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Evaluate   │                                                   │   │
│  │   │  Conditions │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │    ┌─────┴─────┐                                                   │   │
│  │    │           │                                                   │   │
│  │  Match     No Match                                               │   │
│  │    │           │                                                   │   │
│  │    ▼           ▼                                                   │   │
│  │ ┌────────┐  ┌──────────┐                                            │   │
│  │ │ Post   │  │ Skip     │                                            │   │
│  │ │ Charge │  │ Booking  │                                            │   │
│  │ │ to     │  └──────────┘                                            │   │
│  │ │ Folio  │                                                         │   │
│  │ └───┬────┘                                                         │   │
│  │     │                                                              │   │
│  │     ▼                                                              │   │
│  │ ┌─────────────┐                                                   │   │
│  │ │ Record      │                                                   │   │
│  │ │ Execution   │                                                   │   │
│  │ │ Log         │                                                   │   │
│  │ └──────┬──────┘                                                   │   │
│  │        │                                                          │   │
│  │        ▼                                                          │   │
│  │ ┌─────────────┐     ┌─────────────┐                              │   │
│  │ │ Recurring? │────▶│ Yes         │                              │   │
│  │ └──────┬──────┘     │             │                              │   │
│  │        │            │ Calculate   │                              │   │
│  │        No           │ Next Due    │                              │   │
│  │        │            │ Date        │                              │   │
│  │        │            └──────┬──────┘                              │   │
│  │        │                   │                                      │   │
│  │        │            ┌──────┴──────┐                              │   │
│  │        │            │ End Date    │                              │   │
│  │        │            │ Reached?    │                              │   │
│  │        │            └──────┬──────┘                              │   │
│  │        │              ┌────┴────┐                                │   │
│  │        │              │         │                                │   │
│  │        │            Yes         No                                │   │
│  │        │              │         │                                │   │
│  │        │         ┌────┴───┐  ┌──┴────┐                             │   │
│  │        │         │Status: │  │Update │                             │   │
│  │        │         │COMPLETE│  │NextDue│                             │   │
│  │        │         └───────┘  └───────┘                             │   │
│  │        │                                                          │   │
│  │        ▼                                                          │   │
│  │ ┌─────────────┐                                                   │   │
│  │ │ END:       │                                                   │   │
│  │ │ Charge     │                                                   │   │
│  │ │ Processed  │                                                   │   │
│  │ └─────────────┘                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE C: ERROR HANDLING                         │   │
│  │                                                                      │   │
│  │   Error Types:                                                      │   │
│  │   ─────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │   ┌──────────────────┬──────────────────────────────────────┐      │   │
│  │   │ Error             │ Action                                │      │   │
│  │   ├──────────────────┼──────────────────────────────────────┤      │   │
│  │   │ Folio closed      │ Log error, flag for manual review    │      │   │
│  │   │ Booking cancelled │ Skip, record in execution log        │      │   │
│  │   │ Guest checked out │ Skip, record in execution log        │      │   │
│  │   │ Tax calc failure  │ Post without tax, flag for review     │      │   │
│  │   │ Revenue acct miss │ Post to default account, alert admin │      │   │
│  │   │ DB connection err │ Retry 3x with exponential backoff    │      │   │
│  │   │ Duplicate charge  │ Skip (idempotency check on ref)      │      │   │
│  │   └──────────────────┴──────────────────────────────────────┘      │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE D: PAUSE / RESUME                         │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Admin      │                                                   │   │
│  │   │  Requests   │                                                   │   │
│  │   │  Pause/     │                                                   │   │
│  │   │  Resume     │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Validate   │                                                   │   │
│  │   │  Permission │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌──────────────────┬────────────────────────────────┐             │   │
│  │   │  PAUSE            │  RESUME                         │             │   │
│  │   │                   │                                 │             │   │
│  │   │  • Status →       │  • Status → ACTIVE             │             │   │
│  │   │    PAUSED          │  • Recalculate next due date   │             │   │
│  │   │  • Missed dates   │  • Optionally retroactively    │             │   │
│  │   │    recorded in    │    execute missed charges      │             │   │
│  │   │    execution log  │  • Resume normal scheduling     │             │   │
│  │   │  • No charges     │                                 │             │   │
│  │   │    posted while  │                                 │             │   │
│  │   │    paused         │                                 │             │   │
│  │   └──────────────────┴────────────────────────────────┘             │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 City Ledger Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CITY LEDGER PROCESS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OVERVIEW: Accounts receivable for non-guest billing entities                │
│  (Companies, Travel Agents, Corporate Accounts, Government)                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE A: ACCOUNT CREATION                        │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Request    │                                                   │   │
│  │   │  New City   │                                                   │   │
│  │   │  Ledger     │                                                   │   │
│  │   │  Account    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              ACCOUNT CONFIGURATION                    │          │   │
│  │   │                                                      │          │   │
│  │   │   Company Name:  [Acme Corporation]                   │          │   │
│  │   │   Account Type:   ┌─────────────────────┐            │          │   │
│  │   │                   │ Corporate Account   │            │          │   │
│  │   │                   │ Travel Agency       │            │          │   │
│  │   │                   │ Government          │            │          │   │
│  │   │                   │ Wholesale / Tour Op │            │          │   │
│  │   │                   │ Event / Conference  │            │          │   │
│  │   │                   │ Long-Stay Guest     │            │          │   │
│  │   │                   │ Insurance / Claims  │            │          │   │
│  │   │                   └─────────────────────┘            │          │   │
│  │   │                                                      │          │   │
│  │   │   Billing Contact: [Jane Doe, jane@acme.com]          │          │   │
│  │   │   Billing Address: [123 Corp Ave, City, ZIP]          │          │   │
│  │   │   Tax ID / VAT:    [EU123456789]                       │          │   │
│  │   │   Payment Terms:   [Net 15 / Net 30 / Net 45]        │          │   │
│  │   │   Credit Limit:    [10,000.00]                         │          │   │
│  │   │   Currency:        [USD]                                │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Approval   │     ┌─────────────┐                              │   │
│  │   │  Required?  │────▶│ Yes         │                              │   │
│  │   └──────┬──────┘     │             │                              │   │
│  │          │            │ Credit check│                              │   │
│  │          No           │ Manager     │                              │   │
│  │          │            │ approval    │                              │   │
│  │          │            └──────┬──────┘                              │   │
│  │          │                   │                                      │   │
│  │          └───────────────────┘                                      │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Create     │                                                   │   │
│  │   │  Account    │                                                   │   │
│  │   │  (Status:   │                                                   │   │
│  │   │   ACTIVE)   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE B: INVOICING & CHARGES                      │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              CHARGE SOURCES                           │          │   │
│  │   │                                                      │          │   │
│  │   │   1. Guest folio transfer (at check-out)              │          │   │
│  │   │      • Front desk routes charges to city ledger       │          │   │
│  │   │      • Room charges, F&B, services                    │          │   │
│  │   │                                                      │          │   │
│  │   │   2. Direct posting                                    │          │   │
│  │   │      • Event/banquet charges                          │          │   │
│  │   │      • Meeting room rentals                            │          │   │
│  │   │      • Group booking charges                           │          │   │
│  │   │                                                      │          │   │
│  │   │   3. Scheduled charges                                │          │   │
│  │   │      • Monthly retainer fees                          │          │   │
│  │   │      • Service agreement charges                      │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Charges    │                                                   │   │
│  │   │  Accumulate │                                                   │   │
│  │   │  in Account │                                                   │   │
│  │   │  Ledger     │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Invoice    │                                                   │   │
│  │   │  Cycle      │                                                   │   │
│  │   │  Triggered  │                                                   │   │
│  │   │  (Per terms)│                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              INVOICE GENERATION                     │          │   │
│  │   │                                                      │          │   │
│  │   │   • Aggregate all unbilled charges                  │          │   │
│  │   │   • Apply taxes per account jurisdiction             │          │   │
│  │   │   • Calculate discounts / contract rates             │          │   │
│  │   │   • Generate invoice number                          │          │   │
│  │   │   • Send to billing contact (email)                   │          │   │
│  │   │   • Record invoice in accounts receivable             │          │   │
│  │   │   • Update account balance                            │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE C: PAYMENT & AGING                          │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Payment    │                                                   │   │
│  │   │  Received   │                                                   │   │
│  │   │  (Check/Wire│                                                   │   │
│  │   │   /ACH/Card)│                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Record     │                                                   │   │
│  │   │  Payment    │                                                   │   │
│  │   │  Against    │                                                   │   │
│  │   │  Invoices   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Update     │                                                   │   │
│  │   │  Account    │                                                   │   │
│  │   │  Balance    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              AGING MANAGEMENT                        │          │   │
│  │   │                                                      │          │   │
│  │   │   Bucket        Days Outstanding   Action            │          │   │
│  │   │   ─────────────────────────────────────────────────── │          │   │
│  │   │   Current       0 - Payment Terms    Normal           │          │   │
│  │   │   30 Days       Payment Terms + 1-30  Reminder email   │          │   │
│  │   │   60 Days       Payment Terms + 31-60 Escalation call  │          │   │
│  │   │   90 Days       Payment Terms + 61-90 Manager review  │          │   │
│  │   │   120+ Days     > 90 days overdue    Collections       │          │   │
│  │   │                                                      │          │   │
│  │   │   ┌────────────────────────────────────────────┐      │          │   │
│  │   │   │  CREDIT LIMIT CHECK (Real-time)           │      │          │   │
│  │   │   │                                              │      │          │   │
│  │   │   │  Before posting new charge:               │      │          │   │
│  │   │   │  IF (outstanding + new charge) > limit:    │      │          │   │
│  │   │   │    → Alert front desk                      │      │          │   │
│  │   │   │    → Require manager override              │      │          │   │
│  │   │   │    → Block charge OR require deposit        │      │          │   │
│  │   │   └────────────────────────────────────────────┘      │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE D: ACCOUNT LIFECYCLE                        │   │
│  │                                                                      │   │
│  │   Status Transitions:                                               │   │
│  │   ─────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │   PENDING_APPROVAL → ACTIVE    (Approved by manager)                │   │
│  │   ACTIVE            → ON_HOLD   (Requested by billing)              │   │
│  │   ON_HOLD           → ACTIVE    (Cleared, payments resumed)         │   │
│  │   ACTIVE/ON_HOLD    → SUSPENDED (Credit limit exceeded)             │   │
│  │   SUSPENDED         → ACTIVE    (Payment received, cleared)         │   │
│  │   ACTIVE            → CLOSED    (Account settled, no activity)      │   │
│  │   ANY               → CLOSED    (Bad debt write-off)                │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Commission Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMISSION PROCESS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OVERVIEW: Managing commissions payable to travel agents, OTAs,             │
│  referral partners, and other intermediaries                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE A: COMMISSION RULE SETUP                   │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Navigate to│                                                   │   │
│  │   │  Commission │                                                   │   │
│  │   │  Settings   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              COMMISSION RULE CONFIG                  │          │   │
│  │   │                                                      │          │   │
│  │   │   Rule Name:       [OTA Base Commission]             │          │   │
│  │   │   Partner Type:    ┌─────────────────────┐            │          │   │
│  │   │                   │ Travel Agent        │            │          │   │
│  │   │                   │ OTA (Booking.com)   │            │          │   │
│  │   │                   │ OTA (Expedia)       │            │          │   │
│  │   │                   │ Corporate Account   │            │          │   │
│  │   │                   │ Referral Partner    │            │          │   │
│  │   │                   │ Tour Operator       │            │          │   │
│  │   │                   │ Wholesaler          │            │          │   │
│  │   │                   └─────────────────────┘            │          │   │
│  │   │                                                      │          │   │
│  │   │   Calculation Base: ┌───────────────┐                 │          │   │
│  │   │                    │ Room Revenue   │                 │          │   │
│  │   │                    │ Total Revenue  │                 │          │   │
│  │   │                    │ Room + F&B      │                 │          │   │
│  │   │                    │ Fixed Amount   │                 │          │   │
│  │   │                    └───────────────┘                 │          │   │
│  │   │                                                      │          │   │
│  │   │   Commission Type:  ┌───────────────┐                 │          │   │
│  │   │                    │ Percentage     │ [15%]          │          │   │
│  │   │                    │ Flat Rate      │ [$20/night]     │          │   │
│  │   │                    │ Tiered         │                │          │   │
│  │   │                    └───────────────┘                 │          │   │
│  │   │                                                      │          │   │
│  │   │   Tiered Example:                                    │          │   │
│  │   │   • 0-10 rooms/month  → 15%                           │          │   │
│  │   │   • 11-25 rooms/month → 18%                           │          │   │
│  │   │   • 26+ rooms/month   → 22%                           │          │   │
│  │   │                                                      │          │   │
│  │   │   Applicable:        [All Properties / Specific]      │          │   │
│  │   │   Room Types:        [All / Selected types]           │          │   │
│  │   │   Rate Plans:        [All / Selected plans]           │          │   │
│  │   │   Valid From:        [2026-01-01]                      │          │   │
│  │   │   Valid To:          [2026-12-31]                      │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE B: COMMISSION CALCULATION                   │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Booking    │                                                   │   │
│  │   │  Completed  │                                                   │   │
│  │   │  (Check-out)│                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Identify   │                                                   │   │
│  │   │  Booking    │                                                   │   │
│  │   │  Source     │                                                   │   │
│  │   │  (OTA/TA)   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Match to   │                                                   │   │
│  │   │  Commission │                                                   │   │
│  │   │  Rule       │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │    ┌─────┴─────┐                                                   │   │
│  │    │           │                                                   │   │
│  │  Rule Found  No Rule                                              │   │
│  │    │           │                                                   │   │
│  │    ▼           ▼                                                   │   │
│  │ ┌──────────┐ ┌──────────────┐                                       │   │
│  │ │ Calculate│ │ Use Default  │                                       │   │
│  │ │ Amount   │ │ (0% or prop  │                                       │   │
│  │ │          │ │  default)    │                                       │   │
│  │ └────┬─────┘ └──────────────┘                                       │   │
│  │      │                                                            │   │
│  │      ▼                                                            │   │
│  │ ┌─────────────┐                                                   │   │
│  │ │ Record      │                                                   │   │
│  │ │ Commission  │                                                   │   │
│  │ │ Entry       │                                                   │   │
│  │ │ (Status:    │                                                   │   │
│  │ │  PENDING)   │                                                   │   │
│  │ └──────┬──────┘                                                   │   │
│  │        │                                                          │   │
│  │        ▼                                                          │   │
│  │ ┌─────────────┐                                                   │   │
│  │ │ Accumulate  │                                                   │   │
│  │ │ per Partner │                                                   │   │
│  │ │ (Monthly    │                                                   │   │
│  │ │  Ledger)    │                                                   │   │
│  │ └──────┬──────┘                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE C: PAYMENT SETTLEMENT                       │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  End of     │                                                   │   │
│  │   │  Settlement │                                                   │   │
│  │   │  Period     │                                                   │   │
│  │   │  (Monthly)  │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Generate   │                                                   │   │
│  │   │  Commission │                                                   │   │
│  │   │  Summary    │                                                   │   │
│  │   │  per Partner│                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              SETTLEMENT REPORT                       │          │   │
│  │   │                                                      │          │   │
│  │   │   Partner: Booking.com        Period: Mar 2026        │          │   │
│  │   │   ─────────────────────────────────────────────────   │          │   │
│  │   │   Total Bookings:           45                         │          │   │
│  │   │   Total Room Nights:         128                        │          │   │
│  │   │   Gross Room Revenue:        $19,200.00                 │          │   │
│  │   │   Commission Rate:           15%                        │          │   │
│  │   │   Commission Amount:         $2,880.00                  │          │   │
│  │   │   Adjustments:              -$120.00 (cancellation)    │          │   │
│  │   │   Net Payable:               $2,760.00                  │          │   │
│  │   │   ─────────────────────────────────────────────────   │          │   │
│  │   │   Payment Method:           [Wire Transfer / ACH]      │          │   │
│  │   │   Payment Status:           PENDING                    │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Manager    │                                                   │   │
│  │   │  Reviews &  │                                                   │   │
│  │   │  Approves   │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Process    │                                                   │   │
│  │   │  Payment    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Update All │                                                   │   │
│  │   │  Commission │                                                   │   │
│  │   │  Entries →  │                                                   │   │
│  │   │  SETTLED    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Record in  │                                                   │   │
│  │   │  Financial  │                                                   │   │
│  │   │  Ledger     │                                                   │   │
│  │   └─────────────┘                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Commission Calculation Examples:                                         │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  Scenario           Base             Rate     Commission                   │
│  ─────────────────────────────────────────────────────────────────────     │
│  Booking.com std    $150/night       15%      $22.50/night                  │
│  Expedia negotiated  $150/night       18%      $27.00/night                  │
│  Travel Agent A      $200/night       10%      $20.00/night                  │
│  Referral Partner    $500 total       5%       $25.00 flat                   │
│  Corporate B         Fixed            $20/n    $20.00/night                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Posting Rules Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      POSTING RULES PROCESS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OVERVIEW: Automated charge posting based on configurable business rules     │
│  triggered by booking events, time schedules, or conditions                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE A: RULE CREATION                           │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Navigate to│                                                   │   │
│  │   │  Posting    │                                                   │   │
│  │   │  Rules      │                                                   │   │
│  │   │  Management │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │              POSTING RULE CONFIG                     │          │   │
│  │   │                                                      │          │   │
│  │   │   Rule Name:       [Early Check-In Fee]               │          │   │
│  │   │   Description:     [Auto-post when guest checks       │          │   │
│  │   │                     in before 2:00 PM]                │          │   │
│  │   │                                                      │          │   │
│  │   │   ┌────────────────────────────────────────────┐     │          │   │
│  │   │   │         TRIGGER CONFIGURATION               │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   │   Trigger Type:  ┌─────────────────────┐     │     │          │   │
│  │   │   │                  │ On Check-In         │     │     │          │   │
│  │   │   │                  │ On Check-Out        │     │     │          │   │
│  │   │   │                  │ Daily (Night Audit) │     │     │          │   │
│  │   │   │                  │ On Booking Create  │     │     │          │   │
│  │   │   │                  │ On Status Change   │     │     │          │   │
│  │   │   │                  │ Scheduled (Cron)   │     │     │          │   │
│  │   │   │                  └─────────────────────┘     │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   │   For On Check-In:                            │     │          │   │
│  │   │   │   • Time condition: check-in time < 14:00      │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   └────────────────────────────────────────────┘     │          │   │
│  │   │                                                      │          │   │
│  │   │   ┌────────────────────────────────────────────┐     │          │   │
│  │   │   │         CONDITIONS (Optional)                 │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   │   Room Type:        [All / Suite only]       │     │          │   │
│  │   │   │   Rate Plan:        [All / Standard]          │     │          │   │
│  │   │   │   Booking Source:   [All / OTA / Direct]      │     │          │   │
│  │   │   │   Guest Segment:    [All / VIP / Corporate]   │     │          │   │
│  │   │   │   Property:         [All / Specific]           │     │          │   │
│  │   │   │   Season:           [All / Peak / Off-peak]    │     │          │   │
│  │   │   │   Min Stay:         [Optional - min nights]    │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   └────────────────────────────────────────────┘     │          │   │
│  │   │                                                      │          │   │
│  │   │   ┌────────────────────────────────────────────┐     │          │   │
│  │   │   │         CHARGE CONFIGURATION                  │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   │   Charge Description: [Early Check-In Fee]  │     │          │   │
│  │   │   │   Amount Type:  ┌─────────────────────┐     │     │          │   │
│  │   │   │                │ Fixed Amount        │     │     │          │   │
│  │   │   │                │ Percentage of Rate  │     │     │          │   │
│  │   │   │                │ Per Person          │     │     │          │   │
│  │   │   │                │ From Rate Plan      │     │     │          │   │
│  │   │   │                └─────────────────────┘     │     │          │   │
│  │   │   │   Amount:       [50.00]                       │     │          │   │
│  │   │   │   Tax Code:     [STANDARD_TAX]                │     │          │   │
│  │   │   │   Revenue Acct: [Room Revenue]                │     │          │   │
│  │   │   │   Post To:      [Guest Folio / City Ledger]    │     │          │   │
│  │   │   │                                              │     │          │   │
│  │   │   └────────────────────────────────────────────┘     │          │   │
│  │   │                                                      │          │   │
│  │   │   Priority:       [1 = Highest]                      │          │   │
│  │   │   Status:         [ACTIVE / PAUSED]                 │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Save &     │                                                   │   │
│  │   │  Validate   │                                                   │   │
│  │   │  Rule       │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │  Common Posting Rule Examples:                     │          │   │
│  │   │                                                      │          │   │
│  │   │   1. Late Check-Out Fee                               │          │   │
│  │   │      Trigger: Check-out time > 12:00                  │          │   │
│  │   │      Charge: 50% of nightly rate                     │          │   │
│  │   │                                                      │          │   │
│  │   │   2. Extra Bed Charge                                 │          │   │
│  │   │      Trigger: On check-in, IF extra bed requested     │          │   │
│  │   │      Charge: $25.00/night                             │          │   │
│  │   │                                                      │          │   │
│  │   │   3. Welcome Amenity Package                           │          │   │
│  │   │      Trigger: On check-in, IF guest = VIP             │          │   │
│  │   │      Charge: $0.00 (complimentary, posted for tracking)│         │   │
│  │   │                                                      │          │   │
│  │   │   4. No-Show Penalty                                  │          │   │
│  │   │      Trigger: Night Audit, IF unarrived confirmed     │          │   │
│  │   │      Charge: 1 night room rate                        │          │   │
│  │   │                                                      │          │   │
│  │   │   5. Tourism/Resort Fee                                │          │   │
│  │   │      Trigger: Daily (Night Audit)                     │          │   │
│  │   │      Charge: $5.00/person/night                       │          │   │
│  │   │                                                      │          │   │
│  │   │   6. Pet Fee                                          │          │   │
│  │   │      Trigger: On check-in, IF booking has pet flag     │          │   │
│  │   │      Charge: $50.00/night                             │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE B: TRIGGER MATCHING & EXECUTION            │   │
│  │                                                                      │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Event      │                                                   │   │
│  │   │  Occurs     │                                                   │   │
│  │   │  (Check-in, │                                                   │   │
│  │   │   Night Audit│                                                   │   │
│  │   │   etc.)      │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Load All   │                                                   │   │
│  │   │  Active     │                                                   │   │
│  │   │  Posting    │                                                   │   │
│  │   │  Rules      │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Filter by  │                                                   │   │
│  │   │  Trigger    │                                                   │   │
│  │   │  Type       │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │          ▼                                                          │   │
│  │   ┌─────────────┐                                                   │   │
│  │   │  Evaluate   │                                                   │   │
│  │   │  Conditions │                                                   │   │
│  │   │  Against    │                                                   │   │
│  │   │  Booking    │                                                   │   │
│  │   │  Context    │                                                   │   │
│  │   └──────┬──────┘                                                   │   │
│  │          │                                                          │   │
│  │    ┌─────┴─────┐                                                   │   │
│  │    │           │                                                   │   │
│  │  Match     No Match                                               │   │
│  │    │           │                                                   │   │
│  │    ▼           ▼                                                   │   │
│  │ ┌──────────┐ ┌──────────────┐                                       │   │
│  │ │ Sort by  │ │ Skip Rule    │                                       │   │
│  │ │ Priority │ └──────────────┘                                       │   │
│  │ │ (1 first)│                                                       │   │
│  │ └────┬─────┘                                                       │   │
│  │      │                                                            │   │
│  │      ▼                                                            │   │
│  │ ┌─────────────────────────────────────────────────────┐          │   │
│  │ │              CHARGE POSTING                        │          │   │
│  │ │                                                      │          │   │
│  │ │  1. Calculate charge amount                         │          │   │
│  │ │  2. Apply tax code                                   │          │   │
│  │ │  3. Post to guest folio (or city ledger)             │          │   │
│  │ │  4. Update revenue account balance                  │          │   │
│  │ │  5. Trigger commission calculation (if applicable)  │          │   │
│  │ │                                                      │          │   │
│  │ │  ┌────────────────────────────────────────────┐      │          │   │
│  │ │  │  Duplicate Prevention (Idempotency)          │      │          │   │
│  │ │  │                                              │      │          │   │
│  │ │  │  Each posting rule execution generates a      │      │          │   │
│  │ │  │  unique reference: ruleId + bookingId +       │      │          │   │
│  │ │  │  date + triggerType. System checks for         │      │          │   │
│  │ │  │  existing entries before posting.              │      │          │   │
│  │ │  └────────────────────────────────────────────┘      │          │   │
│  │ │                                                      │          │   │
│  │ └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PHASE C: AUDIT LOGGING                           │   │
│  │                                                                      │   │
│  │   Every posting rule execution creates an audit record:              │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────┐          │   │
│  │   │                                                      │          │   │
│  │   │   Audit Log Entry:                                  │          │   │
│  │   │   ─────────────────────────────────────────────────   │          │   │
│  │   │   Timestamp:     2026-03-15T14:23:45Z                │          │   │
│  │   │   Rule ID:       post_rule_001                       │          │   │
│  │   │   Rule Name:     Early Check-In Fee                   │          │   │
│  │   │   Booking ID:    bk_20260315_001                      │          │   │
│  │   │   Guest ID:      guest_12345                          │          │   │
│  │   │   Trigger:       CHECK_IN                             │          │   │
│  │   │   Conditions:    {checkInTime: "13:30"}              │          │   │
│  │   │   Charge:        $50.00 + tax                         │          │   │
│  │   │   Revenue Acct:  Room Revenue                         │          │   │
│  │   │   Posted To:     Guest Folio #12345                   │          │   │
│  │   │   Executed By:   System (Auto)                        │          │   │
│  │   │   Reference:     rule_001_bk_001_20260315_checkin      │          │   │
│  │   │   Status:        SUCCESS                              │          │   │
│  │   │                                                      │          │   │
│  │   └─────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  │   Audit logs are:                                                    │   │
│  │   • Immutable (cannot be deleted or modified)                         │   │
│  │   • Queryable by date range, rule, booking, or guest                  │   │
│  │   • Available in reporting for charge reconciliation                  │   │
│  │   • Exportable for external audit purposes                             │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Posting Rules Priority Matrix:                                           │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  Priority  Rule                    Trigger        Condition              │
│  ─────────────────────────────────────────────────────────────────────     │
│  1         Early Check-In          Check-In       time < 14:00           │
│  2         Late Check-Out           Check-Out      time > 12:00           │
│  3         No-Show Penalty         Night Audit    unarrived confirmed     │
│  4         Tourism Fee              Night Audit    always                 │
│  5         Welcome Amenity (VIP)    Check-In       guest = VIP             │
│  6         Extra Person             Check-In       guests > room capacity  │
│  7         Pet Fee                 Check-In       booking has pet flag    │
│  8         Mini-Bar Restock         Night Audit    always                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reservation Processes

### 5.1 Booking Modification Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BOOKING MODIFICATION PROCESS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Modification Request Received                                       │
│                                                                              │
│           ┌─────────────┐                                                   │
│           │  Request    │                                                   │
│           │  to Modify  │                                                   │
│           │  Booking    │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Retrieve   │                                                   │
│           │  Booking    │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│                  ▼                                                           │
│           ┌─────────────┐                                                   │
│           │  Check      │                                                   │
│           │  Status     │                                                   │
│           └──────┬──────┘                                                   │
│                  │                                                           │
│       ┌──────────┼──────────┐                                               │
│       │          │          │                                               │
│  CONFIRMED   CHECKED_IN  CANCELLED                                          │
│       │          │          │                                               │
│       │          │          └────▶ Cannot modify                            │
│       │          │                   cancelled bookings                      │
│       │          │                                                          │
│       │          ▼                                                          │
│       │    ┌─────────────────────────────┐                                  │
│       │    │  Limited modifications      │                                  │
│       │    │  allowed during stay:       │                                  │
│       │    │  • Extend stay (if avail.)  │                                  │
│       │    │  • Add services             │                                  │
│       │    │  • Update guest info        │                                  │
│       │    └─────────────────────────────┘                                  │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────┐                                                           │
│  │  Determine  │                                                           │
│  │  Change Type│                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│    ┌────┼────────────────┬────────────────┬─────────────┐                 │
│    │    │                │                │             │                 │
│ Dates Room           Guest Info      Rate Plan      Cancel                           │
│    │    │                │                │             │                 │
│    ▼    ▼                ▼                ▼             ▼                 │
│ ┌──────┴──────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│ │ Check       │   │ Update    │   │ Change    │   │ Process   │         │
│ │ Availability│   │ Details   │   │ Rate      │   │ Cancel    │         │
│ │             │   │           │   │           │   │ (Separate │         │
│ │ If new dates│   │ No        │   │ Recalc    │   │  flow)    │         │
│ │ available:  │   │ inventory │   │ charges   │   └───────────┘         │
│ │ • Lock new  │   │ impact    │   │           │                          │
│ │ • Release   │   │           │   │           │                          │
│ │   old       │   │           │   │           │                          │
│ └──────┬──────┘   └─────┬─────┘   └─────┬─────┘                          │
│        │                │               │                                  │
│        └────────────────┴───────────────┘                                  │
│                         │                                                   │
│                         ▼                                                   │
│                  ┌─────────────┐                                            │
│                  │  Calculate  │                                            │
│                  │  Price Diff │                                            │
│                  └──────┬──────┘                                            │
│                         │                                                   │
│              ┌──────────┼──────────┐                                       │
│              │          │          │                                       │
│         No Change   Guest Owes   Guest Due                                  │
│              │          │          │                                       │
│              │          ▼          ▼                                       │
│              │    ┌─────────┐ ┌─────────┐                                  │
│              │    │ Collect │ │ Process │                                  │
│              │    │ Payment │ │ Refund  │                                  │
│              │    └────┬────┘ └────┬────┘                                  │
│              │         │           │                                        │
│              └─────────┴───────────┘                                        │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Update     │                                             │
│                 │  Booking    │                                             │
│                 │  Record     │                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Log Audit  │                                             │
│                 │  Entry      │                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  Send       │                                             │
│                 │  Confirmation│                                            │
│                 │  (Email/SMS)│                                             │
│                 └──────┬──────┘                                             │
│                        │                                                    │
│                        ▼                                                    │
│                 ┌─────────────┐                                             │
│                 │  END:       │                                             │
│                 │  Modified   │                                             │
│                 │  Successfully                                             │
│                 └─────────────┘                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Guest Service Processes

### 6.1 Service Request Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVICE REQUEST PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Guest Submits Request                                               │
│                                                                              │
│           ┌─────────────────────────────────────────────────────────────┐  │
│           │                    REQUEST CHANNELS                          │  │
│           │                                                              │  │
│           │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │  │
│           │  │ In-Room │  │ Guest   │  │ Phone   │  │ Front   │       │  │
│           │  │ Portal  │  │ App     │  │ Call    │  │ Desk    │       │  │
│           │  │ (QR)    │  │         │  │         │  │         │       │  │
│           │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │  │
│           │       │            │            │            │              │  │
│           │       └────────────┴────────────┴────────────┘              │  │
│           │                            │                                 │  │
│           │                            ▼                                 │  │
│           │                    ┌─────────────┐                           │  │
│           │                    │  Request    │                           │  │
│           │                    │  Received   │                           │  │
│           │                    └─────────────┘                           │  │
│           │                                                              │  │
│           └──────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                               │
│                              │  Categorize │                               │
│                              │  Request    │                               │
│                              └──────┬──────┘                               │
│                                     │                                       │
│          ┌──────────────┬───────────┼───────────┬──────────────┐          │
│          │              │           │           │              │          │
│     Housekeeping  Room Service  Maintenance  Concierge   Other            │
│          │              │           │           │              │          │
│          ▼              ▼           ▼           ▼              ▼          │
│    ┌───────────┐  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐  │
│    │ • Clean   │  │ • Food    │ │ • Repair  │ │ • Transport│ │Custom │  │
│    │ • Towels  │  │ • Drinks  │ │ • AC      │ │ • Booking  │ │Task   │  │
│    │ • Amenities│ │ • Special │ │ • Plumbing│ │ • Info     │ │       │  │
│    └─────┬─────┘  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───┬────┘  │
│          │              │             │             │           │        │
│          └──────────────┴──────┬──────┴─────────────┴───────────┘        │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Assign     │                                    │
│                         │  Priority   │                                    │
│                         │  (1-5)      │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Route to   │                                    │
│                         │  Department │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Notify     │                                    │
│                         │  Staff      │                                    │
│                         │  (Push/SMS) │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Staff      │                                    │
│                         │  Accepts    │───────▶ Timeout? ─────▶ Reassign   │
│                         │  Task       │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  In         │                                    │
│                         │  Progress   │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Complete   │                                    │
│                         │  Task       │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Update     │                                    │
│                         │  Status     │                                    │
│                         │  → Done     │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Notify     │                                    │
│                         │  Guest      │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  Request    │                                    │
│                         │  Rating     │                                    │
│                         └──────┬──────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                         ┌─────────────┐                                    │
│                         │  END:       │                                    │
│                         │  Request    │                                    │
│                         │  Closed     │                                    │
│                         └─────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Reporting Processes

### 7.1 Daily Operations Report Generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DAILY OPERATIONS REPORT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REPORT SCHEDULE                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Time        Report                    Recipients                  │   │
│  │   ─────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │   06:00       Night Audit Summary     GM, Accounting               │   │
│  │   07:00       Arrivals Preview        Front Desk, HK               │   │
│  │   08:00       Housekeeping Status     HK Manager                   │   │
│  │   12:00       Occupancy Update        GM, Sales                    │   │
│  │   15:00       Revenue Flash           GM, Finance                  │   │
│  │   18:00       Departures Summary      Front Desk, HK               │   │
│  │   23:00       Night Audit Begin       Night Auditor                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  REPORT CONTENTS                                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MORNING ARRIVALS REPORT                           │   │
│  │                                                                      │   │
│  │   Property: Grand Hotel Downtown     Date: March 15, 2026           │   │
│  │                                                                      │   │
│  │   ════════════════════════════════════════════════════════════════  │   │
│  │                                                                      │   │
│  │   SUMMARY                                                            │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Total Arrivals:        15                                          │   │
│  │   VIP Guests:            2                                           │   │
│  │   Early Check-in Req:    3                                           │   │
│  │   Special Requests:      5                                           │   │
│  │                                                                      │   │
│  │   ROOM STATUS                                                         │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Ready:                 12                                          │   │
│  │   Not Ready:             3 (Estimated ready: 11:00 AM)              │   │
│  │                                                                      │   │
│  │   ARRIVALS DETAIL                                                     │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Time     Guest          Room  Type      Requests      Status      │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   14:00    John Smith     305   Deluxe    High floor    Ready      │   │
│  │   15:00    Sarah Jones    410   Suite     ⭐ VIP         Ready      │   │
│  │   15:30    Mike Brown     302   Deluxe    Late arrival  Ready      │   │
│  │   ...                                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NIGHT AUDIT REPORT                                │   │
│  │                                                                      │   │
│  │   Date: March 14, 2026    Audit Period: 00:00 - 23:59               │   │
│  │                                                                      │   │
│  │   ════════════════════════════════════════════════════════════════  │   │
│  │                                                                      │   │
│  │   OCCUPANCY                                                           │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Rooms Available:       100                                         │   │
│  │   Rooms Sold:            78                                          │   │
│  │   Occupancy:             78%                                         │   │
│  │   Average Guests/Room:   1.4                                         │   │
│  │                                                                      │   │
│  │   REVENUE                                                             │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Room Revenue:          $9,750.00                                   │   │
│  │   F&B Revenue:           $1,250.00                                   │   │
│  │   Other Revenue:         $350.00                                     │   │
│  │   Tax Collected:         $1,362.00                                   │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   TOTAL REVENUE:         $12,712.00                                  │   │
│  │                                                                      │   │
│  │   KEY METRICS                                                         │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   ADR (Avg Daily Rate):  $125.00                                     │   │
│  │   RevPAR:                $97.50                                      │   │
│  │   Total Arrivals:        12                                          │   │
│  │   Total Departures:      8                                           │   │
│  │   Reservations:          5 (Online: 4, Phone: 1)                    │   │
│  │   Cancellations:         1                                           │   │
│  │                                                                      │   │
│  │   PAYMENTS                                                            │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   Credit Card:           $8,500.00                                   │   │
│  │   Cash:                  $1,200.00                                   │   │
│  │   UPI/Digital:           $3,012.00                                   │   │
│  │   ─────────────────────────────────────────────────────────────    │   │
│  │   TOTAL PAYMENTS:        $12,712.00                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Automation Workflows

### 8.1 Pre-Defined Automation Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTOMATION WORKFLOW EXAMPLES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PRE-ARRIVAL AUTOMATION                            │   │
│  │                                                                      │   │
│  │   Trigger: 72 hours before check-in                                 │   │
│  │   Condition: Booking status = CONFIRMED                             │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send pre-arrival email with check-in link                │   │   │
│  │   │ 2. Create pre-arrival task for front desk                   │   │   │
│  │   │ 3. IF VIP guest → Alert manager                              │   │   │
│  │   │ 4. IF special requests → Alert relevant departments         │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CHECK-IN AUTOMATION                               │   │
│  │                                                                      │   │
│  │   Trigger: Booking status → CHECKED_IN                              │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Enable WiFi access for guest                              │   │   │
│  │   │ 2. Generate digital key (if configured)                      │   │   │
│  │   │ 3. Send welcome SMS                                          │   │   │
│  │   │ 4. Update room status → OCCUPIED                             │   │   │
│  │   │ 5. Add loyalty points (if member)                            │   │   │
│  │   │ 6. Create housekeeping check-in record                       │   │   │
│  │   │ 7. Update CRS/inventory                                      │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CHECK-OUT AUTOMATION                              │   │
│  │                                                                      │   │
│  │   Trigger: Booking status → CHECKED_OUT                             │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Disable WiFi access                                       │   │   │
│  │   │ 2. Revoke digital key                                        │   │   │
│  │   │ 3. Update room status → VACANT_DIRTY                         │   │   │
│  │   │ 4. Create housekeeping task                                  │   │   │
│  │   │ 5. Send feedback request email                               │   │   │
│  │   │ 6. Update guest profile (stay count, LTV)                    │   │   │
│  │   │ 7. Credit loyalty points for stay                            │   │   │
│  │   │ 8. Update CRS/inventory                                      │   │   │
│  │   │ 9. Sync to OTAs                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BIRTHDAY AUTOMATION                               │   │
│  │                                                                      │   │
│  │   Trigger: Daily at 08:00                                           │   │
│  │   Condition: Guest birthday = today                                 │   │
│  │                AND guest is currently staying                       │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send birthday greeting to guest                          │   │   │
│  │   │ 2. Create task for housekeeping (special amenities)          │   │   │
│  │   │ 3. Alert front desk for personal greeting                    │   │   │
│  │   │ 4. IF loyalty member → add bonus points                      │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LOW INVENTORY ALERT                               │   │
│  │                                                                      │   │
│  │   Trigger: Inventory update                                         │   │
│  │   Condition: Available rooms < 5 for any date in next 7 days        │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Send alert to revenue manager                             │   │   │
│  │   │ 2. Suggest rate increase (AI recommendation)                 │   │   │
│  │   │ 3. Close inventory on low-demand OTAs                        │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENT FAILURE AUTOMATION                        │   │
│  │                                                                      │   │
│  │   Trigger: Payment status → FAILED                                  │   │
│  │                                                                      │   │
│  │   Actions:                                                           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ 1. Retry payment (automatic, 3 attempts)                     │   │   │
│  │   │ 2. IF all retries fail:                                      │   │   │
│  │   │    - Alert front desk                                        │   │   │
│  │   │    - Send payment reminder to guest                          │   │   │
│  │   │    - Create follow-up task                                   │   │   │
│  │   │ 3. IF booking guaranteed by card:                            │   │   │
│  │   │    - Attempt card on file                                    │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. New Billing & Operations Workflows (v2.1)

### 9.1 Billing Module Expansion Summary

Version 2.1 introduces comprehensive billing operations workflows that extend StaySuite's financial management capabilities beyond basic folio handling. The new processes cover the complete end-of-day financial cycle, automated charge management, accounts receivable, partner commissions, and rule-based posting.

| Process | Section | Key Capability |
|---------|---------|----------------|
| Night Audit | 4.2 | End-of-day financial close, room revenue posting, reconciliation |
| Scheduled Charges | 4.3 | Recurring/one-time automated charges with pause/resume |
| City Ledger | 4.4 | Accounts receivable for corporate/travel agent billing |
| Commissions | 4.5 | OTA/TA commission rules, calculation, settlement |
| Posting Rules | 4.6 | Event-triggered automated charge posting with audit trail |

### 9.2 Process Interconnections

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BILLING PROCESS INTERCONNECTIONS (v2.1)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     triggers      ┌──────────────┐                       │
│   │  Night Audit │──────────────────▶│ Posting Rules │                       │
│   │  (Daily)     │                   │ (Auto-post)  │                       │
│   └──────┬───────┘                   └──────┬───────┘                       │
│          │                                  │                                │
│          │ also triggers                     │ posts charges to             │
│          │                                  ▼                                │
│          │                          ┌──────────────┐                       │
│          │                          │  Guest Folio │                       │
│          │                          │  or City     │                       │
│          │                          │  Ledger      │                       │
│          │                          └──────┬───────┘                       │
│          │                                 │                                │
│          ▼                                 │                                │
│   ┌──────────────┐                          │                                │
│   │  Scheduled   │───────────┐              │                                │
│   │  Charges     │           │              │                                │
│   │  (Recurring) │           ▼              │                                │
│   └──────────────┘   ┌──────────────┐      │                                │
│                       │  Guest Folio │      │                                │
│                       │              │      │                                │
│                       └──────┬───────┘      │                                │
│                              │              │                                │
│                              │ on check-out │                                │
│                              │ with CL ref  │                                │
│                              ▼              │                                │
│                       ┌──────────────┐      │                                │
│                       │  City Ledger │◀─────┘                                │
│                       │  (Transfer)  │                                       │
│                       └──────┬───────┘                                       │
│                              │                                                │
│                              │ generates invoices                             │
│                              │                                                │
│                              ▼                                                │
│                       ┌──────────────┐                                       │
│                       │  Accounts    │                                       │
│                       │  Receivable  │                                       │
│                       └──────┬───────┘                                       │
│                              │                                                │
│                              │ on check-out                                   │
│                              │ (OTA/TA bookings)                              │
│                              ▼                                                │
│                       ┌──────────────┐                                       │
│                       │  Commission  │                                       │
│                       │  Calculation│                                       │
│                       │  & Settlement│                                       │
│                       └──────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Revenue Account Integration

All new billing processes post charges to designated revenue accounts for financial reporting and export integration:

| Revenue Account Category | Examples |
|------------------------|----------|
| Room Revenue | Nightly room charges, early check-in, late check-out |
| F&B Revenue | Restaurant, room service, mini-bar |
| Service Revenue | Laundry, spa, business center, transportation |
| Banquet Revenue | Event space, catering, AV equipment |
| City Ledger Revenue | Transferred guest charges, direct corporate billing |
| Commission Expense | OTA commissions, travel agent fees |
| Tax Liability | Collected taxes pending remittance |
| Adjustment Revenue | Discounts, comps, write-offs, corrections |

---

## Appendix: Process Quick Reference

### A.1 Check-In Checklist

- [ ] Verify reservation exists
- [ ] Check guest ID
- [ ] Collect/review payment
- [ ] Assign room
- [ ] Hand over key card
- [ ] Provide WiFi credentials
- [ ] Explain amenities
- [ ] Offer assistance with luggage

### A.2 Check-Out Checklist

- [ ] Review folio charges
- [ ] Process payment
- [ ] Generate invoice
- [ ] Transfer balance to city ledger (if applicable)
- [ ] Collect key card
- [ ] Ask about stay experience
- [ ] Process loyalty points
- [ ] Thank guest

### A.3 Night Audit Checklist (v2.1)

- [ ] Verify no other night audit in progress
- [ ] Review and resolve room status discrepancies
- [ ] Confirm all room charges posted correctly
- [ ] Review all daily posted charges (F&B, services, minibar)
- [ ] Execute scheduled charges for the day
- [ ] Process posting rule triggers
- [ ] Calculate commissions for completed bookings
- [ ] Perform cashier reconciliation (balanced?)
- [ ] Verify tax calculations
- [ ] Process no-shows (deposit retention, room release)
- [ ] Process auto check-outs (folio close, invoice generate)
- [ ] Transfer outstanding balances to city ledger
- [ ] Advance business date
- [ ] Generate and review night audit report
- [ ] Distribute reports to management

### A.4 City Ledger Checklist (v2.1)

- [ ] Verify all guest-to-city-ledger transfers completed
- [ ] Review aging report for overdue accounts
- [ ] Send payment reminders (30/60/90 day buckets)
- [ ] Check credit limit utilization
- [ ] Generate invoice cycle for accounts at billing period
- [ ] Record received payments against invoices
- [ ] Review suspended accounts for reactivation

### A.5 Emergency Contacts

| Situation | Contact |
|-----------|---------|
| System down | IT Support |
| Payment failure | Finance |
| Guest complaint | Manager on Duty |
| Security issue | Security Team |

---

**Contact**

**Cryptsk Pvt Ltd**
- **Website**: www.staysuite.io
- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd. All rights reserved.*

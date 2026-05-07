# StaySuite Glossary
## Terms and Definitions

**Version**: 2.1  
**Last Updated**: May 2026

---

## A

### ADR (Average Daily Rate)
The average price at which rooms are sold. Calculated as total room revenue divided by total rooms sold.

### API (Application Programming Interface)
A set of protocols allowing different software applications to communicate with StaySuite. The platform exposes 617 API routes across 134 directories.

### Audit Log
A chronological record of system activities tracked via the `AuditLog` model, recording who did what and when across all 294 database models.

### Authentication
The process of verifying a user's identity before granting access. StaySuite uses custom session-based auth with bcrypt password hashing.

### Authorization
The process of determining what actions an authenticated user can perform. Implemented via RBAC (9 roles) and ABAC.

### Automation Rule
A defined trigger-condition-action rule that executes automatically. Managed via the `AutomationRule` model.

---

## B

### Back-to-Back Bookings
Consecutive bookings where one guest checks out and another checks in on the same day.

### BAR (Best Available Rate)
The lowest available rate for a room on a given day, unrestricted by conditions.

### Booking
A reservation made by a guest for a specific room and date range. States: Draft → Confirmed → Checked In → Checked Out → Cancelled.

### Booking Engine
The system component that handles availability searching, rate calculation, and booking creation.

### Bandwidth Policy
A QoS configuration defining speed limits, data caps, and session timeouts for WiFi users. 6 plans: Free through Enterprise.

### Bun
The JavaScript runtime and package manager used by StaySuite for development and production.

---

## C

### Cancellation Policy
Rules determining refund amounts based on when a booking is cancelled. Managed via `CancellationPolicy` and `CancellationPenalty` models.

### Captive Portal
A web page that guests must view before accessing WiFi. StaySuite runs a redirect service on port 8888.

### Channel Manager
A system that distributes inventory and rates across multiple booking channels (46+ OTAs). Includes CRS (Central Reservation System).

### City Ledger
Account-based billing system for corporate accounts and travel agents that allows credit terms and invoice-based payments.

### Check-in
The process of registering a guest's arrival and assigning a room. Auto-triggers WiFi provisioning and digital key generation.

### Check-out
The process of finalizing a guest's stay, settling charges, and releasing the room. Auto-triggers WiFi revocation and housekeeping task creation.

### CoA (Change of Authorization)
A RADIUS protocol extension allowing dynamic policy changes during an active session.

### Commission Rule
Configurable rule defining how commissions are calculated for travel agents (percentage, fixed amount, or tiered).

### CRS (Central Reservation System)
The single source of truth for inventory and rates, synchronizing with all 46+ channels.

### CRM (Customer Relationship Management)
The module for managing guest segments, campaigns, loyalty programs, and retention analytics.

### Cron Job
Automated background task that runs on a schedule (e.g., auto room posting, channel sync, session monitoring).

---

## D

### Day Use
A booking where the guest uses the room only during daytime hours, typically without overnight stay.

### Direct Booking
A reservation made directly with the hotel, not through a third-party channel.

### Dynamic Pricing
Adjusting room rates in real-time based on demand, competition, and other factors using the `PricingRule` model.

---

## E

### Early Check-in
Allowing guests to check in before the standard check-in time.

### Early Departure
When a guest checks out before their scheduled check-out date.

### Experience
Activities and services available to guests. Managed via `Experience`, `ExperienceBooking`, `ExperiencePricing`, and `ExperienceVendor` models.

---

## F

### Feature Flag
A toggle that enables/disables addon modules per subscription plan. 8 base modules always on, 22 addon modules toggleable.

### Folio
An account record for a booking containing all charges and payments. Managed via `Folio` and `FolioLineItem` models.

### Floor Plan
A visual representation of hotel floors with room placement. Managed via `FloorPlan` and `FloorPlanRoom` models.

### FreeRADIUS
Open-source RADIUS server (v3.2.7) compiled from source with native PostgreSQL SQL module for WiFi AAA.

### Front Desk
The reception area and staff responsible for guest check-in/check-out, room assignment, and walk-in bookings.

### FUP (Fair Usage Policy)
Bandwidth management policy that applies speed limits after data threshold is reached.

---

## G

### GDS (Global Distribution System)
Networks used by travel agents to book hotels (Amadeus, Sabre, Travelport).

### GDPR (General Data Protection Regulation)
EU regulation for data protection. StaySuite implements consent management, data export, and right to erasure via `GDPRRequest` and `ConsentRecord` models.

### Group Booking
A reservation for multiple rooms under a single booking, typically for events or tours.

### Guest Profile
A record containing guest information, preferences, stay history, and loyalty data.

### Guest Journey
The complete lifecycle of a guest from discovery to retention. Tracked via `GuestJourney` model.

---

## H

### High Season
Period of peak demand when rates are typically highest.

### Housekeeping
Department responsible for cleaning and maintaining rooms and public areas. 11 sub-features including tasks, kanban, maintenance, assets, inspections, minibar, and laundry.

---

## I

### Idempotency
A property ensuring that an operation can be repeated multiple times without different results. Used for OTA booking imports via `IdempotencyKey` model.

### Inventory
The total number of rooms available for sale. Managed via `InventoryLock` for DB-level locking.

### Invoice
A document itemizing charges and payments for a guest's stay. Managed via `Invoice` and `InvoiceTemplate` models.

### IoT (Internet of Things)
Smart devices for room automation. Managed via `IoTDevice`, `IoTCommand`, `IoTReading`, and `EnergyMetric` models.

---

## K

### KDS (Kitchen Display System)
Real-time display of restaurant orders for kitchen staff.

### KYC (Know Your Customer)
Identity verification via document upload and management. Managed via `GuestDocument` model.

---

## L

### Late Check-out
Allowing guests to check out after the standard check-out time.

### Lead Time
The number of days between booking date and check-in date.

### Length of Stay (LOS)
The number of nights in a booking.

### Laundry Order
Housekeeping service request for guest laundry with item-level tracking.

### Lost & Found
System for tracking items lost or found on property with guest notification.

### Loyalty Program
A system rewarding repeat guests with points, tiers, and benefits. Managed via `LoyaltyTier`, `LoyaltyReward`, and `LoyaltyPointTransaction` models.

---

## M

### MICE (Meetings, Incentives, Conferences, Events)
The segment of hospitality focused on group events and conferences. Managed via `Event`, `EventSpace`, and `EventResource` models.

### Mini-Service
Independent Bun-based microservice that handles specific infrastructure tasks (DHCP, DNS, RADIUS, etc.).

### Minibar
In-room refreshment service with consumption tracking and automatic billing.

### Minimum Stay
The shortest booking length accepted for specific dates or rate plans.

### Multi-Tenant
Architecture supporting multiple hotel groups/brands on a single platform with complete data isolation via `tenantId` on all models.

---

## N

### NAS (Network Access Server)
The network gateway device (router/AP) that communicates with the RADIUS server for WiFi authentication.

### Next.js
The React framework (v16.1) used for StaySuite's frontend and API layer with App Router.

### Night Audit
Daily end-of-day reconciliation process that verifies all financial transactions, posts charges, and closes the business day. Managed via `NightAudit`, `NightAuditLog`, and `NightAuditStep` models.

### No-Show
A guest with a confirmed booking who doesn't arrive and doesn't cancel. Managed via `NoShowAutomation` (in bookings module).

---

## O

### Occupancy Rate
The percentage of available rooms that are occupied.

### OTA (Online Travel Agency)
Third-party websites where guests can book rooms (Booking.com, Expedia, Airbnb, etc.).

### Overbooking
Accepting more bookings than available rooms, typically to offset expected cancellations.

---

## P

### Package Plan
Bundled offering combining room accommodation with additional services (meals, spa, transfers, etc.).

### Payment Gateway
A service that processes credit card and other electronic payments (Stripe, Razorpay, PayPal, etc.).

### PMS (Property Management System)
Software for managing hotel operations including reservations, check-in/out, and billing.

### POS (Point of Sale)
The Restaurant & POS module with 15 sub-features for food & beverage operations.

### Posting Rule
Automated rule that posts charges to guest folios based on triggers (daily, check-in, check-out, etc.).

### PostgreSQL
The relational database (v17) used exclusively by StaySuite. 294 models managed via Prisma 6 ORM.

### Prisma
The ORM (v6.19+) used for database schema definition and type-safe queries.

### Pre-Authorization
A temporary hold on a guest's credit card to guarantee payment.

---

## R

### RADIUS (Remote Authentication Dial-In User Service)
Protocol for authenticating and authorizing network access. StaySuite uses FreeRADIUS v3.2.7 with PostgreSQL SQL module.

### Rate Parity
Maintaining consistent rates across all booking channels.

### Rate Plan
A pricing configuration including base rate, inclusions, and conditions.

### RevPAR (Revenue Per Available Room)
Total room revenue divided by total available rooms. A key hotel performance metric.

### Revenue Account
Chart of accounts code used to categorize revenue transactions.

### RBAC (Role-Based Access Control)
Access control system with 9 default roles and granular module.action permissions.

---

## S

### Scheduled Charge
Recurring charge that automatically posts to guest folios on a configurable schedule.

### Seasonality
Variations in demand and rates based on time of year.

### SSO (Single Sign-On)
Allowing users to access multiple systems with one login. Supports SAML 2.0, OIDC, and LDAP.

### StaySuite
The All-in-One Hospitality Operating System by Cryptsk Pvt Ltd.

---

## T

### Tenant
A hotel group or brand on the multi-tenant platform. Each tenant has complete data isolation.

### Throughput
The number of transactions processed per time period.

### Travel Agent
Third-party booking agent with configurable commission rates and credit terms.

### Two-Factor Authentication (2FA)
A security method requiring two forms of identification (TOTP, SMS, Email).

---

## U

### Upselling
Encouraging guests to purchase room upgrades or additional services.

### UPS (Uninterruptible Power Supply)
Not directly related to StaySuite but recommended for FreeRADIUS and database servers.

---

## V

### VLAN (Virtual LAN)
Network segmentation for isolating guest traffic per room or floor. Managed via `VlanConfig` and `RoomVlan` models.

### Voucher
A prepaid code for WiFi access, meals, or services. Managed via `WiFiVoucher` model.

---

## W

### Walk-in
A guest who arrives without a prior reservation.

### Webhook
An automated message sent from one application to another when an event occurs. Managed via `WebhookEndpoint` and `WebhookDeliveryLog` models.

### WiFi AAA
Authentication, Authorization, and Accounting for WiFi network access via FreeRADIUS v3.2.7.

---

## Z

### Zustand
The state management library (v5.0+) used for client-side state with 5 stores.

---

## Contact

For questions about terminology, contact:
- **Support**: support@cryptsk.com

---

*© 2026 Cryptsk Pvt Ltd*

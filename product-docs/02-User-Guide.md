# StaySuite User Guide
## Complete Operations Manual

**Version**: 2.1  
**Last Updated**: July 2025

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Property Management](#3-property-management)
4. [Bookings](#4-bookings)
5. [Guest Management](#5-guest-management)
6. [Front Desk Operations](#6-front-desk-operations)
7. [Guest Experience](#7-guest-experience)
8. [WiFi Management](#8-wifi-management)
9. [Billing & Payments](#9-billing--payments)
10. [Restaurant & POS](#10-restaurant--pos)
11. [Housekeeping](#11-housekeeping)
12. [Inventory Management](#12-inventory-management)
13. [Channel Manager](#13-channel-manager)
14. [Reports](#14-reports)
15. [Settings](#15-settings)

---

## 1. Getting Started

### 1.1 System Requirements

| Requirement | Specification |
|-------------|---------------|
| Browser | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Internet | 5 Mbps minimum |
| Screen | 1366x768 minimum resolution |

### 1.2 Login

1. Navigate to your StaySuite URL (e.g., `http://localhost:3000` for development)
2. Enter your email address (e.g., `admin@royalstay.in`)
3. Enter your password (e.g., `admin123`)
4. If 2FA is enabled, enter the code from your authenticator app
5. Click "Sign In"

### 1.3 Navigation

The sidebar provides access to all 30 modules organized into base and addon categories:

```
Dashboard          — Overview, Command Center, Alerts, KPI Cards
PMS                — Properties, Room Types, Rooms, Inventory, Rates, Floor Plans,
                     Package Plans, Travel Agents
Bookings           — Calendar, Groups, Waitlist, Conflicts, No-Show, Audit
Front Desk         — Check-in/out, Walk-in, Room Grid, Kiosk, Room Move
Guests             — List, KYC, Preferences, History, Loyalty, Profile
Housekeeping       — Tasks, Kanban, Room Status, Maintenance, Assets, Minibar,
                     Laundry, Lost & Found
Billing            — Folios, Invoices, Payments, Night Audit, City Ledger,
                     Commissions, Posting Rules, Scheduled Charges, Revenue Accounts
Experience         — Service Requests, Chat, Portal, Digital Keys, Activities
Restaurant & POS   — Orders, Tables, Kitchen, Menu, Billing, Recipes, Modifiers
Inventory          — Stock, Consumption, Alerts, Vendors, POs
WiFi               — Access, RADIUS, Network, DHCP, DNS, Portal, Firewall, Reports
Channel Manager    — OTA Connections, Sync, Mapping, Restrictions, CRS
Revenue            — Dynamic Pricing, Forecasting, Competitor, AI
CRM & Marketing    — Segments, Campaigns, Loyalty, Reputation, Promotions
Ads                — Campaigns, Google Hotel Ads, ROI Analytics
Reports & BI       — Revenue, Occupancy, ADR/RevPAR, Guest Analytics, Staff
Events / MICE      — Spaces, Calendar, Bookings, Resources
Staff Management   — Shifts, Attendance, Tasks, Communication, Skills
Security Center    — Overview, Audit Logs, 2FA, Sessions, SSO
Automation         — Workflows, Rules, Templates, Logs
AI Assistant       — Copilot, Insights, Provider Settings
Admin              — Tenants, Roles, Users, Usage, Health
Chain Management   — Brands, Dashboard, Cross-Property Analytics
SaaS Billing       — Plans, Subscriptions, Usage
Notifications      — Templates, Delivery Logs, Settings
Webhooks           — Events, Delivery, Retry
Settings           — General, Tax, Localization, Features, GDPR, Security
Help & Support     — Help Center, Articles, Tutorials
```

### 1.4 Global Search

Use the search bar (or press `Ctrl+K`) to quickly find:
- Bookings
- Guests
- Rooms
- Invoices
- Any entity across all modules

### 1.5 Feature Flags

Some modules are addon features that can be toggled in **Settings → Feature Flags**. Base modules (Dashboard, PMS, Bookings, Front Desk, Guests, Housekeeping, Billing, Settings, Help) are always enabled.

---

## 2. Dashboard

### 2.1 Overview Dashboard

The main dashboard displays customizable widgets:

| Widget | Description |
|--------|-------------|
| **KPI Cards** | Today's revenue, occupancy, arrivals, departures |
| **Revenue Breakdown** | Revenue by source and category |
| **Arrivals & Departures** | Today's check-ins and check-outs |
| **Room Status** | Occupied/vacant/maintenance breakdown |
| **Recent Activity** | Latest system events |
| **Staff On Duty** | Current shift staff list |
| **Weather Forecast** | Local weather information |
| **Quick Notes** | Staff notes and reminders |
| **Task Reminders** | Pending task count by category |
| **System Health** | Service status indicators |

### 2.2 Command Center

Real-time operations view:
- Live booking events
- Check-in/check-out status
- Service request alerts
- System notifications
- WiFi session alerts
- Maintenance alerts

### 2.3 Alerts Panel

| Alert Type | Description |
|------------|-------------|
| Overbooking | Inventory exceeds capacity |
| Payment Failed | Transaction declined |
| Sync Error | OTA sync failed |
| Low Stock | Inventory below threshold |
| Maintenance | Overdue tasks |
| Security | Suspicious activity detected |

---

## 3. Property Management

### 3.1 Creating a Property

1. Navigate to **PMS → Properties**
2. Click **Add Property**
3. Fill in property details:
   - Name, Address, City, Timezone
   - Currency, Contact information
   - Total rooms
4. Configure tax settings
5. Click **Save**

### 3.2 Managing Room Types

1. Navigate to **PMS → Room Types**
2. Click **Add Room Type**
3. Configure:
   - Name (e.g., "Deluxe Room"), Code
   - Base/max occupancy and size
   - Base price, Currency
   - Amenities, Images
4. Click **Save**

### 3.3 Managing Rooms

1. Navigate to **PMS → Rooms**
2. Click **Add Room**
3. Configure: Room number, Room type, Floor, Features
4. Click **Save**

### 3.4 Room Status Types

| Status | Description |
|--------|-------------|
| Vacant Clean | Ready for check-in |
| Vacant Dirty | Needs cleaning |
| Occupied Clean | Guest checked in, room clean |
| Occupied Dirty | Guest checked in, room dirty |
| Out of Order | Maintenance required |
| Out of Service | Long-term unavailable |

### 3.5 Inventory Calendar

1. Navigate to **PMS → Inventory Calendar**
2. Select date range
3. View availability by room type
4. Click on a date to close inventory, set restrictions, or adjust pricing

### 3.6 Rate Plans

1. Navigate to **PMS → Rate Plans & Pricing**
2. Click **Add Rate Plan**
3. Configure: Name, Room type, Base rate, Inclusions, Cancellation policy
4. Click **Save**

### 3.7 Pricing Rules

1. Navigate to **PMS → Rate Plans & Pricing**
2. Click **Add Rule**
3. Set conditions: Date range, Day of week, Occupancy threshold, Lead time
4. Set adjustment: Percentage or fixed amount
5. Click **Save**

### 3.8 Package Plans

Create bundled offerings that combine rooms with services (e.g., room + breakfast + spa).

1. Navigate to **PMS → Package Plans**
2. Click **Add Package Plan**
3. Configure the package:
   - **Name & Description**: e.g., "Honeymoon Package", "Business Retreat"
   - **Validity**: Date range or seasonal availability
   - **Room Type**: Select the room type included in the package
   - **Components**: Add individual services and items included:
     - Meals (breakfast, lunch, dinner — select restaurant and menu items)
     - Spa treatments (select from experience catalog)
     - Airport transfer (shuttle or private)
     - Activities (sightseeing tours, water sports, etc.)
     - Minibar credits (daily allowance amount)
     - Late check-out (set departure time)
   - **Pricing**: 
     - Set total package price (overrides individual component pricing)
     - Or configure as a markup/discount on component totals
   - **Occupancy**: Min/max guests the package supports
   - **Selling Rules**: Minimum stay, advance booking window, blackout dates
4. Click **Save**

**Viewing Package Bookings:**
- Packages appear as rate plan options during booking creation
- Component usage is tracked per booking
- Individual component charges can be viewed on the guest folio

### 3.9 Floor Plans

1. Navigate to **PMS → Floor Plans**
2. Use the visual drag-drop editor to create floor layouts
3. Place rooms with their types and numbers

### 3.10 Travel Agents

Manage travel agent profiles, commission structures, and corporate account relationships.

1. Navigate to **PMS → Travel Agents**
2. Click **Add Travel Agent**
3. Configure the travel agent profile:
   - **Basic Information**: Agency name, Contact person, Email, Phone, Address
   - **Commission Setup**:
     - Default commission rate (percentage of room revenue)
     - Per-room-type commission overrides
     - Commission on extras (F&B, services) — optional
     - Minimum booking amount threshold
   - **Billing Terms**: Payment terms (Net 15, Net 30, Net 45), Credit limit
   - **Market Segment**: Assign to segment (e.g., "Travel Agent", "Tour Operator", "Corporate")
   - **Notes**: Special agreements, B2B contract references
4. Click **Save**

**Managing Travel Agent Profiles:**
- View all travel agents in a searchable, filterable list
- Edit commission rates at any time (new rate applies to future bookings)
- View booking history per travel agent
- Track outstanding balances and payment status
- Enable/disable travel agent account

**Commission Rate Hierarchy:**
1. **Per-room-type override** — highest priority (if set)
2. **Default agency rate** — used if no room-type override exists
3. **Global default** — fallback rate configured in Settings

---

## 4. Bookings

### 4.1 Creating a Booking

1. Navigate to **Bookings → Calendar View** or **All Bookings**
2. Click **New Booking**
3. Enter guest details: Name, Email, Phone, Address
4. Select room type and room
5. Set check-in and check-out dates
6. Select rate plan
7. Add any extras
8. Click **Confirm Booking**

### 4.2 Booking States

| State | Description |
|-------|-------------|
| Draft | Unconfirmed reservation |
| Confirmed | Confirmed reservation |
| Checked In | Guest has arrived |
| Checked Out | Guest has departed |
| Cancelled | Booking cancelled |

### 4.3 Modifying a Booking

1. Find the booking (search or calendar)
2. Click on the booking → **Edit**
3. Make changes: Dates, Room, Guest details, Rate plan
4. Click **Save**
5. All changes are tracked in audit logs

### 4.4 Cancelling a Booking

1. Open the booking
2. Click **Cancel**
3. Select cancellation reason
4. Cancellation penalty is applied per policy
5. Confirm cancellation

### 4.5 Group Bookings

1. Navigate to **Bookings → Group Bookings**
2. Click **New Group Booking**
3. Enter group details, contact person
4. Add rooms: Room type, Quantity, Dates
5. Set group rate and deposit requirements
6. Click **Save**

### 4.6 Waitlist Management

1. Navigate to **Bookings → Waitlist**
2. View waitlisted requests
3. When rooms become available: Select entry → **Convert to Booking**

### 4.7 Conflict Detection

1. Navigate to **Bookings → Conflicts**
2. View detected booking overlaps
3. Resolve by reallocating rooms or adjusting dates

### 4.8 No-Show Automation

1. Navigate to **Bookings → No-Show Automation**
2. Configure auto-cancellation rules for no-shows
3. Set grace period and penalty application

---

## 5. Guest Management

### 5.1 Guest Profiles

1. Navigate to **Guests → Guest List**
2. Search for existing guest or click **Add Guest**
3. Enter guest information: Personal details, Contact, Preferences, Notes
4. Click **Save**

### 5.2 Guest Preferences

Record guest preferences for future visits:
- Room preference (floor, view)
- Pillow type
- Dietary restrictions
- Newspaper preference
- Early check-in / late check-out
- Minibar preferences

### 5.3 KYC Documents

1. Open guest profile
2. Navigate to **KYC/Documents** tab
3. Click **Upload Document**
4. Select document type: ID Card, Passport, Driver's License
5. Upload scanned copy
6. Set expiration date

### 5.4 Stay History

View complete guest history:
- All previous stays
- Room types booked
- Total spend
- Services used
- Feedback given

### 5.5 Loyalty Program

1. Navigate to **Guests → Loyalty & Points**
2. Configure tier levels (e.g., Silver, Gold, Platinum)
3. Set earning rules (points per currency spent)
4. Set redemption rules
5. View member status and point balances

### 5.6 Guest Merge

1. Open a guest profile
2. Click **Merge**
3. Select the duplicate profile
4. Confirm merge to combine all history and data

---

## 6. Front Desk Operations

### 6.1 Check-In Process

1. Navigate to **Front Desk → Check-In**
2. Find the booking (today's arrivals shown)
3. Verify guest identity (KYC documents)
4. Collect/check payment method
5. Assign room (if not pre-assigned) — use auto-assign for suggestions
6. Review special requests
7. Click **Check In**

**Automatic triggers on check-in:**
- WiFi account provisioned (FreeRADIUS user created)
- Digital key generated (if enabled)
- Welcome notification sent
- Room status updated to occupied
- Housekeeping task created for departure prep

### 6.2 Check-Out Process

1. Navigate to **Front Desk → Check-Out**
2. Find the booking
3. Review folio charges
4. Process payment for outstanding balance
5. Print/email invoice
6. Click **Check Out**

**Automatic triggers on check-out:**
- WiFi access revoked
- Digital key deactivated
- Housekeeping task created for room cleaning
- Feedback request sent
- Loyalty points awarded

### 6.3 Walk-In Bookings

1. Navigate to **Front Desk → Walk-In**
2. Check availability for dates
3. Create new guest profile or find existing
4. Create booking
5. Process payment
6. Check in immediately

### 6.4 Room Grid

Live room status view:
- Color-coded status indicators
- Guest names for occupied rooms
- Quick actions per room
- Filter by floor, type, status

### 6.5 Room Assignment

1. Open booking
2. Click **Assign Room** or use **Auto-Assign**
3. View available rooms filtered by type, floor, features
4. Select room
5. Click **Assign**

### 6.6 Registration Card

1. Navigate to **Front Desk → Registration Card**
2. Digital registration form with e-signature
3. Guest data auto-populated from booking
4. KYC document capture
5. Digital signature collection

### 6.7 Express Kiosk

1. Navigate to **Front Desk → Express Kiosk** (separate display)
2. Self-service check-in/out
3. ID scanning, e-signature, room key printing
4. Configure in **Kiosk Settings**

### 6.8 Room Move

1. Navigate to **Front Desk → Room Move**
2. Select current booking
3. Choose new room
4. Process room transfer
5. Update room status automatically

---

## 7. Guest Experience

### 7.1 Service Requests

1. Navigate to **Experience → Service Requests**
2. View incoming requests
3. Filter by status/type
4. Assign to staff
5. Update status as completed

### 7.2 Guest Chat

1. Navigate to **Experience → Guest Chat**
2. View active conversations
3. Select conversation → type message → send
4. Transfer to other staff if needed
5. Attach files to messages

### 7.3 In-Room Portal

Guest accesses via QR code in room:
- View booking details
- Order room service
- Request housekeeping
- View bill
- Submit feedback
- Check out

### 7.4 Digital Keys

1. Navigate to **Experience → Digital Keys**
2. View active keys with QR codes
3. Generate new key for guest
4. Set validity period
5. Revoke keys on check-out

### 7.5 Experience Catalog

1. Navigate to **Experience → Experience Catalog**
2. Browse available activities and services
3. Manage pricing and availability
4. Track vendor performance

### 7.6 Guest App Controls

Guests can manage their stay via mobile:
- Room controls (IoT)
- Service requests
- Restaurant ordering
- Digital key access
- Notifications

---

## 8. WiFi Management

StaySuite includes a fully integrated WiFi AAA system powered by **FreeRADIUS v3.2.7** compiled from source with native PostgreSQL SQL module.

### 8.1 WiFi Sessions

1. Navigate to **WiFi → WiFi Access**
2. View connected users: Guest name, Room, Device MAC, IP, Data usage, Duration
3. Actions: Disconnect user, Limit bandwidth, View usage history

### 8.2 RADIUS & Gateway Configuration

1. Navigate to **WiFi → RADIUS & Gateway**
2. Add RADIUS client: Gateway IP, Shared secret, Vendor type
3. Configure NAS (Network Access Server) settings
4. Test connection
5. View NAS health logs and reload status

### 8.3 Network Management

1. Navigate to **WiFi → Network**
2. Configure VLANs, interfaces, multi-WAN
3. Set up static routes
4. Configure port forwarding
5. Monitor network health

### 8.4 DHCP Server

1. Navigate to **WiFi → DHCP Server**
2. Configure subnets, options, reservations
3. Set hostname filters and blacklists
4. Monitor leases

### 8.5 Voucher Management

1. Navigate to **WiFi → WiFi Access** → Vouchers tab
2. Click **Generate Vouchers**
3. Configure: Quantity, Validity period, Data limit, Speed limit
4. Click **Generate**
5. Print or send vouchers

### 8.6 WiFi Plans

6 bandwidth tiers configured in the system:

| Plan | Speed | Data Limit | Price |
|------|-------|------------|-------|
| Free | 2 Mbps | 500 MB/day | Complimentary |
| Basic | 5 Mbps | 1 GB/day | Complimentary |
| Standard | 10 Mbps | 3 GB/day | ₹99/day |
| Premium | 25 Mbps | 10 GB/day | ₹199/day |
| Business | 50 Mbps | Unlimited | ₹399/day |
| Enterprise | 100 Mbps | Unlimited | ₹699/day |

### 8.7 Captive Portal

1. Navigate to **WiFi → Captive Portal**
2. Configure portal templates, pages, and mappings
3. Set whitelist for portal-exempt URLs
4. Customize branding

### 8.8 Firewall & Bandwidth

1. Navigate to **WiFi → Firewall & Bandwidth**
2. Configure firewall rules and zones
3. Set bandwidth policies and pools
4. Configure content filtering
5. Set rate limiting rules

### 8.9 Reports

1. Navigate to **WiFi → Reports**
2. View: Total sessions, Data consumed, Peak usage, Top users
3. Export reports for analysis

---

## 9. Billing & Payments

### 9.1 Folios

A folio is a container for charges linked to a booking.

1. Navigate to **Billing → Folios**
2. Open booking folio
3. View all charges: Room, F&B, Services, Taxes
4. Add manual charges
5. Post charges from POS

### 9.2 Processing Payments

1. Open folio → **Add Payment**
2. Select payment method: Credit card, Debit card, Cash, UPI, Bank transfer
3. Enter amount
4. Process payment

### 9.3 Invoices

1. Navigate to **Billing → Invoices**
2. Generate invoice from folio
3. Configure: Invoice template, Tax breakdown, Payment terms
4. Print or email to guest

### 9.4 Refunds

1. Navigate to **Billing → Refunds**
2. Select payment to refund
3. Enter refund amount and reason
4. Process refund

### 9.5 Discounts

1. Open folio → **Add Discount**
2. Configure: Discount type (percentage/fixed), Amount, Reason
3. Apply to line items

### 9.6 Multi-Currency

1. Navigate to **Billing → Multi-Currency**
2. Configure exchange rates
3. Process payments in guest's preferred currency

### 9.7 Night Audit

The night audit is a critical end-of-day reconciliation process that verifies all financial transactions, posts automated charges, and closes the business day.

**Starting Night Audit:**

1. Navigate to **Billing → Night Audit**
2. Review the pre-audit checklist:
   - All check-ins processed
   - All check-outs completed and folios settled
   - Pending postings reviewed
   - Room charges pending review
3. Click **Start Night Audit**

**Executing Audit Steps:**

The night audit runs through the following automated and manual steps:

| Step | Action | Description |
|------|--------|-------------|
| 1 | Room Charge Posting | Automatically posts daily room charges to all active folios based on configured posting rules |
| 2 | Tax Recalculation | Recalculates taxes on all posted charges for the day |
| 3 | Scheduled Charge Execution | Processes any recurring/scheduled charges due for the day |
| 4 | Commission Calculation | Calculates travel agent and OTA commissions for the day's bookings |
| 5 | Revenue Posting | Posts revenues to their respective revenue account codes |
| 6 | Transaction Verification | Cross-checks all postings, payments, and adjustments for the day |
| 7 | Discrepancy Report | Flags any out-of-balance folios or missing postings |

**Reviewing Completion:**

1. After all steps execute, review the **Night Audit Summary**:
   - Total room revenue posted
   - Total F&B revenue posted
   - Total other revenue posted
   - Total payments received
   - Net change in outstanding balances
   - Discrepancies (if any)
2. Investigate and resolve any flagged discrepancies
3. Click **Close Day** to finalize
4. The system date rolls over and a new business day begins

**Important Notes:**
- Only one night audit can be in progress at a time
- Night audit can only be run once per business day
- A running audit can be cancelled if errors are found before closing
- Full audit trail is maintained for compliance

### 9.8 City Ledger

City Ledger manages account-based billing for corporate accounts, travel agents, and other business entities that have credit arrangements with the property.

**Creating a City Ledger Account:**

1. Navigate to **Billing → City Ledger**
2. Click **Add Account**
3. Configure the account:
   - **Account Name**: e.g., "Acme Corporation", "Sunset Tours"
   - **Account Type**: Corporate, Travel Agent, Government, Wholesale, Other
   - **Contact Details**: Primary contact, Billing contact, Email, Phone
   - **Billing Address**: For invoice generation
   - **Credit Terms**: Net 15, Net 30, Net 45, Net 60, Due on Receipt
   - **Credit Limit**: Maximum outstanding balance allowed
   - **Tax Exemption**: GST/VAT exemption number (if applicable)
   - **Linked Travel Agent**: Optionally link to a travel agent profile for commission tracking
4. Click **Save**

**Creating City Ledger Invoices:**

1. Navigate to **Billing → City Ledger**
2. Open the desired account
3. Click **Create Invoice** (or charges can be auto-generated from folio transfers)
4. **Adding Line Items:**
   - Click **Add Line Item**
   - Select **Revenue Account** (room revenue, F&B, laundry, etc.)
   - Enter **Description**: e.g., "Room charges — 3 nights Deluxe"
   - Enter **Quantity** and **Unit Price**
   - Select **Tax Category**: Tax is auto-calculated based on the selected category
   - Add additional line items as needed
5. Review the invoice summary: Subtotal, Tax breakdown, Total
6. Click **Issue Invoice**
7. Optionally print or email the invoice to the account contact

**Recording Payments:**

1. Open the city ledger account or invoice
2. Click **Record Payment**
3. Enter payment details:
   - **Payment Date**
   - **Payment Method**: Bank transfer, Cheque, Credit card, Cash, Adjustment
   - **Amount**
   - **Reference Number**: Cheque number, transaction ID, etc.
   - **Notes**: Optional memo
4. Click **Save**
5. The account balance and invoice status update automatically

**Managing Credit Notes:**

1. Open the invoice to adjust
2. Click **Create Credit Note**
3. Enter reason and amount
4. Apply to invoice or keep as account credit

**Account Statements:**
- Generate account statements for any date range
- View aging reports (Current, 1-30 days, 31-60 days, 61-90 days, 90+ days)
- Send statements to account contacts

### 9.9 Commissions

The Commissions module tracks, calculates, and manages payments owed to travel agents and other booking sources.

**Setting Up Commission Rules:**

1. Navigate to **Billing → Commissions**
2. Click **Commission Rules** tab
3. Click **Add Rule**
4. Configure the commission rule:
   - **Rule Name**: e.g., "Standard TA Commission", "High-Volume Agent Rate"
   - **Applicable To**: Select travel agents, market segments, or booking sources
   - **Commission Basis**:
     - Room revenue only
     - Room revenue + F&B
     - Total booking value
   - **Commission Type**:
     - **Percentage**: e.g., 10% of room revenue
     - **Fixed Amount**: e.g., ₹500 per room night
     - **Tiered**: Different rates for different volume brackets
   - **Conditions** (optional):
     - Minimum booking amount
     - Specific room types only
     - Seasonal date ranges
     - Minimum length of stay
5. Click **Save**

Rules are evaluated in order; the first matching rule applies. You can reorder rules by priority.

**Viewing Commission Records:**

1. Navigate to **Billing → Commissions**
2. Click **Commission Records** tab
3. View all earned commissions in a filterable table:
   - **Booking Reference**: Link to the source booking
   - **Travel Agent / Source**: Who earned the commission
   - **Booking Revenue**: Total value of the booking
   - **Commission Amount**: Calculated commission
   - **Commission Rate**: Applied rate or rule
   - **Status**: Pending, Approved, Paid, Void
   - **Booking Date**: When the booking was made
   - **Check-out Date**: When guest departed (commission becomes payable)
4. Filter by: Date range, Travel agent, Status, Booking source

**Processing Commission Payments:**

1. Navigate to **Billing → Commissions**
2. Select pending commission records to pay
3. Click **Process Payment** (or batch-select multiple records)
4. Enter payment details:
   - **Payment Date**
   - **Payment Method**: Bank transfer, Cheque, Adjustment
   - **Reference Number**
   - **Notes**
5. Click **Confirm**
6. Status updates to "Paid" and a payment record is created

**Commission Reports:**
- Monthly commission summary by travel agent
- Commission trends over time
- Outstanding commission liability report

### 9.10 Scheduled Charges

Create and manage recurring charges that are automatically posted to guest folios on a configurable schedule.

**Creating a Recurring Charge:**

1. Navigate to **Billing → Scheduled Charges**
2. Click **Add Scheduled Charge**
3. Configure the charge:
   - **Name**: e.g., "Daily Breakfast Buffet", "Weekly Laundry Service", "Mini-fridge Rental"
   - **Charge Type**: 
     - Per-booking (applies to all active bookings matching criteria)
     - Per-room (applies to all occupied rooms matching criteria)
   - **Amount**: Fixed charge amount per occurrence
   - **Frequency**:
     - Daily
     - Weekly (select day of week)
     - Monthly (select day of month)
     - Custom interval (every N days)
   - **Revenue Account**: Select the appropriate revenue code
   - **Tax Category**: Tax treatment for the charge
   - **Applicable Conditions** (optional):
     - Room type filter
     - Rate plan filter
     - Market segment filter
     - Minimum/maximum stay length
   - **Start Date / End Date**: When the schedule is active
4. Click **Save**

**Pausing and Resuming Scheduled Charges:**

1. Navigate to **Billing → Scheduled Charges**
2. Find the scheduled charge in the list
3. Toggle the **Active** switch to **Pause**
   - The charge will not execute on its next scheduled date
   - Already-posted charges remain on folios
4. Toggle back to **Resume** to reactivate
5. Optionally set a **Pause Until** date for automatic resumption

**Viewing Execution History:**

1. Open the scheduled charge record
2. Click **Execution History** tab
3. View a log of all past executions:
   - **Execution Date**: When the charge was posted
   - **Bookings/Rooms Affected**: Count of folios charged
   - **Total Amount Posted**: Sum of all charges in that execution
   - **Status**: Success, Partial (some folios skipped), Failed
   - **Error Details**: Reason for any failures (e.g., folio closed, booking cancelled)
4. Use filters to narrow by date range or status
5. Export execution history for auditing

### 9.11 Posting Rules

Posting rules automate the posting of charges to guest folios based on configurable conditions and triggers (e.g., daily room charges, arrival deposits, late check-out fees).

**Creating an Auto-Posting Rule:**

1. Navigate to **Billing → Posting Rules**
2. Click **Add Posting Rule**
3. Configure the rule:
   - **Rule Name**: e.g., "Daily Room Charge — Deluxe", "Welcome Amenity Posting", "No-Show Penalty"
   - **Trigger Event**:
     - **Daily Room Charge**: Posts once per night for each occupied room
     - **On Check-In**: Posts immediately when guest checks in
     - **On Check-Out**: Posts on departure
     - **On Booking Creation**: Posts when reservation is confirmed
     - **Custom Schedule**: Cron-style expression for custom timing
   - **Conditions** (all must match):
     - Room type = "Deluxe Room"
     - Rate plan contains "Corporate"
     - Market segment = "Corporate"
     - Minimum stay ≥ 3 nights
     - Property = specific property (for multi-property setups)
   - **Charge Details**:
     - **Description**: Text that appears on the folio (e.g., "Room charge — Deluxe Room — Night 3")
     - **Amount**: Fixed amount or dynamic (use room rate, percentage of rate, etc.)
     - **Revenue Account**: Select the revenue code (e.g., "Room Revenue", "Miscellaneous Income")
     - **Tax Category**: Tax treatment
   - **Priority**: Order of execution when multiple rules match (lower number = higher priority)
   - **Active**: Toggle on/off
4. Click **Save**

**Managing Posting Rules:**
- View all rules in a prioritized list
- Edit, duplicate, or delete rules
- Toggle rules on/off without deleting
- Test a rule against sample bookings before activating
- View a log of recent posting rule executions

**Examples of Common Posting Rules:**

| Rule | Trigger | Description |
|------|---------|-------------|
| Daily Room Charge | Daily (per occupied room) | Posts the room's nightly rate to the folio |
| Welcome Amenity | On Check-In | Posts a fruit basket or welcome drink charge |
| Tourism Fee | Daily | Posts a per-night tourism levy |
| Late Check-Out Fee | On Check-Out (if after noon) | Posts a half-day rate when check-out is late |
| No-Show Charge | On No-Show detection | Posts penalty charge per cancellation policy |

### 9.12 Revenue Accounts

Revenue accounts (chart of accounts) categorize all financial transactions for accurate reporting and financial analysis.

**Viewing Revenue Accounts:**

1. Navigate to **Billing → Revenue Accounts**
2. View the complete list of revenue account codes organized by category:
   - **Room Revenue**: 1000-series (e.g., 1001 — Standard Room, 1002 — Deluxe Room)
   - **Food & Beverage**: 2000-series (e.g., 2001 — Restaurant, 2002 — Room Service, 2003 — Minibar)
   - **Event & Conference**: 3000-series
   - **Laundry & Services**: 4000-series
   - **Miscellaneous**: 5000-series (e.g., 5001 — Late Check-Out Fee, 5002 — Tourism Levy)
   - **Discount & Adjustments**: 6000-series

**Creating a New Revenue Account:**

1. Navigate to **Billing → Revenue Accounts**
2. Click **Add Account**
3. Configure:
   - **Account Code**: Unique identifier (e.g., "2004", "4002")
   - **Account Name**: Descriptive name (e.g., "Spa Revenue", "Parking Charges")
   - **Category**: Group the account under a revenue category
   - **Type**: Income, Expense, Tax, Discount, Adjustment
   - **Description**: Detailed explanation of what this account tracks
   - **Active**: Toggle on/off
4. Click **Save**

**Managing Revenue Accounts:**
- Edit account details at any time
- Deactivate unused accounts (cannot delete if transactions reference the account)
- View transaction history for each account
- Revenue accounts are used by posting rules, invoices, and night audit for categorization
- Accounts feed into revenue reports for financial analysis

---

## 10. Restaurant & POS

### 10.1 Order Management

1. Navigate to **Restaurant & POS → Orders**
2. Create new order: Select table, Add items, Special instructions
3. Send to kitchen
4. Mark items as served
5. Close order and post to folio

### 10.2 Table Management

1. Navigate to **Restaurant & POS → Tables**
2. View table layout (visual floor plan)
3. Click table to start order, view active order, or mark available

### 10.3 Kitchen Display System (KDS)

1. Navigate to **Restaurant & POS → Kitchen (KDS)**
2. View pending orders by time, priority, station
3. Mark items: In Progress → Ready → Served

### 10.4 Menu Management

1. Navigate to **Restaurant & POS → Menu Management**
2. Create categories, add items with pricing and images
3. Configure modifiers (size, extras, dietary options)
4. Set up variants (presentation options)
5. Manage recipes with ingredients

### 10.5 Room Service

1. Navigate to **Restaurant & POS → Room Service**
2. Select guest/room
3. Add items from menu
4. Order is delivered to room
5. Charges posted to guest folio

### 10.6 Restaurant Billing

1. Navigate to **Restaurant & POS → Restaurant Billing**
2. Configure receipt templates
3. Process payments
4. Split bills across guests
5. Apply discounts

---

## 11. Housekeeping

### 11.1 Task Management

1. Navigate to **Housekeeping → Tasks**
2. View today's tasks
3. Filter by: Status, Room, Attendant
4. Update status: Pending → In Progress → Completed

### 11.2 Kanban Board

Visual task management:

| Column | Description |
|--------|-------------|
| To Do | Pending tasks |
| In Progress | Active cleaning |
| Completed | Finished tasks |
| Inspection | Needs inspection |

### 11.3 Room Status Update

1. Navigate to **Housekeeping → Room Status**
2. Select room
3. Update status: Clean, Dirty, Touch-up, Inspected
4. Add notes if needed

### 11.4 Maintenance Requests

1. Navigate to **Housekeeping → Maintenance Requests**
2. Click **New Request**
3. Enter: Room, Issue description, Priority, Category
4. Assign to staff
5. Track resolution

### 11.5 Preventive Maintenance

1. Navigate to **Housekeeping → Preventive Maintenance**
2. Schedule recurring maintenance tasks
3. Track equipment service history

### 11.6 Asset Management

1. Navigate to **Housekeeping → Assets**
2. Add assets: Equipment name, Location, Purchase date, Warranty
3. Schedule maintenance
4. Track service history

### 11.7 Inspection Checklists

1. Navigate to **Housekeeping → Inspection Checklists**
2. Create templates with checklist items
3. Perform room inspections
4. Track compliance scores

### 11.8 Lost & Found

Report, track, and return items left behind by guests.

**Reporting a Found Item:**

1. Navigate to **Housekeeping → Lost & Found**
2. Click **Report Found Item**
3. Enter item details:
   - **Item Description**: What was found (e.g., "Black leather wallet", "Samsung phone charger")
   - **Category**: Electronics, Clothing, Documents, Accessories, Jewelry, Other
   - **Location Found**: Room number, public area, restaurant, gym, etc.
   - **Date Found**: Date the item was discovered
   - **Found By**: Staff member who found the item
   - **Storage Location**: Where the item is being kept (e.g., "HK Office Shelf B-3")
   - **Condition**: Good, Fair, Damaged
   - **Photos**: Upload images of the item
   - **Identifying Marks**: Serial numbers, brand, distinguishing features
4. Click **Save**
5. Item status is set to **In Storage**

**Reporting a Lost Item (from Guest):**

1. A guest reports a lost item (via front desk, guest chat, or phone)
2. Navigate to **Housekeeping → Lost & Found**
3. Click **Report Lost Item**
4. Enter details:
   - **Guest Name / Booking**: Link to the guest's current or past stay
   - **Item Description**: Description of the missing item
   - **Last Known Location**: Where the guest last had the item
   - **Date Lost**: Approximate date
   - **Contact Information**: Guest's email and phone for follow-up
5. Click **Save**

**Notifying Guests:**

1. When a found item is matched to a guest report (or a match is suspected):
   - Open the found item record
   - Click **Match to Guest Report** → select the corresponding lost item report
   - Or click **Notify Guest** to proactively reach out
2. Select notification method:
   - **Email**: Send an automated email with item details and pickup/return instructions
   - **SMS**: Send a text message notification
   - **Guest Chat**: Send an in-app message
3. Configure return logistics:
   - **Guest Pickup**: Guest will collect from front desk
   - **Shipping**: Arrange courier delivery (enter shipping address, tracking number)
   - **Hotel Absorbs Cost**: Hotel covers shipping cost
   - **Guest Pays Shipping**: Shipping charged to guest
4. Update status to **Pending Return**

**Tracking Status:**

| Status | Description |
|--------|-------------|
| In Storage | Item found, awaiting claim |
| Reported Lost | Guest has reported an item as missing |
| Matched | Found item matched to a guest report |
| Pending Return | Arrangements being made for return |
| Returned to Guest | Item successfully returned |
| Disposed | Item disposed after retention period |
| Handed to Authority | Item handed over to police/authorities |

**Retention Policy:**
- Configure auto-disposal reminders (e.g., 90 days for low-value items, 1 year for high-value items)
- Valuable items (jewelry, electronics, documents) require witness notation during storage

### 11.9 Minibar

Set up, monitor, and manage room minibars including item consumption and restocking.

**Setting Up Room Minibars:**

1. Navigate to **Housekeeping → Minibar**
2. Click **Minibar Setup** tab
3. Configure minibar templates per room type:
   - **Template Name**: e.g., "Standard Minibar", "Premium Minibar", "Suite Minibar"
   - **Room Type**: Assign to one or more room types
   - **Default Items**: Add items with quantities:
     - Item name (e.g., "Coca-Cola Can", "Mineral Water 500ml", "Beer 330ml")
     - Quantity per minibar (e.g., 2 × Coca-Cola, 4 × Water)
     - Unit price (sale price charged to guest)
     - Cost price (for inventory/loss tracking)
   - **Auto-Post to Folio**: Enable/disable automatic folio posting on consumption recording
   - **Revenue Account**: Select the appropriate revenue code for minibar charges
4. Click **Save**
5. Apply the template to individual rooms or all rooms of a type

**Recording Consumption:**

1. Navigate to **Housekeeping → Minibar**
2. Click **Record Consumption**
3. Select the **Room Number**
4. The system loads the minibar item list for that room
5. For each consumed item:
   - Enter the quantity consumed
   - Or mark items as consumed from the visual checklist
6. Click **Post Charges**
7. If auto-post is enabled, charges are immediately added to the guest's folio with the minibar revenue account code
8. If manual, charges are staged for review before posting

**Tracking Restocking:**

1. Navigate to **Housekeeping → Minibar**
2. Click **Restocking Queue** tab
3. View rooms that need restocking (rooms where consumption has been recorded but items not yet replenished)
4. Generate a **Restocking List** (printable) for attendants
5. Attendant performs restocking in the room
6. After restocking:
   - Select the room → Click **Mark Restocked**
   - Enter any discrepancies (items delivered vs. items placed)
   - Record breakage/spoilage if applicable
7. Room status updates and is removed from the restocking queue

**Minibar Reports:**
- Daily consumption summary
- Revenue by minibar item
- Restocking completion rate
- Shrinkage/breakage report (expected vs. actual inventory)

### 11.10 Laundry

Manage laundry services including item catalogs, order creation, and status tracking.

**Managing Laundry Items:**

1. Navigate to **Housekeeping → Laundry**
2. Click **Item Catalog** tab
3. View and manage the laundry item list:
   - **Item Name**: e.g., "Shirt", "Trousers", "Bed Sheet", "Towel"
   - **Category**: Guest laundry, Hotel linen, Uniform
   - **Service Type**: Wash, Dry Clean, Iron Only, Wash & Iron
   - **Regular Price**: Standard turnaround price
   - **Express Price**: Same-day/express service surcharge
   - **Turnaround Time**: Hours for regular service (e.g., "24 hours")
4. Click **Add Item** to create new catalog entries
5. Edit pricing and details as needed

**Creating Laundry Orders:**

1. Navigate to **Housekeeping → Laundry**
2. Click **New Order**
3. Fill in order details:
   - **Source**: Guest laundry, Room linen change, Hotel uniform, Restaurant linens
   - **Room / Guest**: Select the guest room (for guest laundry) — auto-links to booking
   - **Priority**: Regular or Express
   - **Pickup Date/Time**: When items will be collected
   - **Delivery Date/Time**: When items will be returned
   - **Special Instructions**: e.g., "Delicate fabric — cold wash only"
4. **Add Items** to the order:
   - Select item from catalog
   - Enter quantity
   - Select service type (wash, dry clean, iron)
   - Unit price auto-populates based on service type and priority
   - System calculates line total
5. Review order summary: Total items, Total cost
6. Click **Create Order**
7. For guest laundry, charges can be posted to the guest's folio automatically

**Tracking Laundry Status:**

1. Navigate to **Housekeeping → Laundry** → **Orders List**
2. View all orders in a filterable table (by status, date, room, priority)
3. Each order progresses through these stages:

| Status | Description |
|--------|-------------|
| Created | Order placed, awaiting pickup |
| Picked Up | Items collected from room/department |
| In Progress | Items being cleaned/processed |
| Ready | Cleaning complete, awaiting delivery |
| Delivered | Items returned to guest/department |
| Cancelled | Order cancelled |

4. Click on an order to view details and update status
5. **Bulk Status Update**: Select multiple orders → Update status in bulk
6. **Print Slips**: Generate pickup slips and delivery receipts

**Laundry Billing:**
- Guest laundry charges posted to folio with laundry revenue account code
- Departmental laundry (hotel linens, uniforms) tracked as internal cost
- Monthly laundry cost reports by department

---

## 12. Inventory Management

### 12.1 Stock Items

1. Navigate to **Inventory → Stock Items**
2. Add items: Name, Category, Unit, Current stock, Reorder level, Unit cost
3. Update stock counts

### 12.2 Consumption Tracking

1. Navigate to **Inventory → Consumption Logs**
2. Record usage: Select item, Quantity, Department
3. Stock automatically updated

### 12.3 Low Stock Alerts

1. Navigate to **Inventory → Low Stock Alerts**
2. View items below reorder level
3. Generate purchase orders directly

### 12.4 Purchase Orders

1. Navigate to **Inventory → Purchase Orders**
2. Create PO: Select vendor, Add items, Set quantities
3. Submit for approval
4. Receive goods and update stock

### 12.5 Inter-Property Transfer

1. Transfer stock between properties
2. Track transfer status and quantities

---

## 13. Channel Manager

### 13.1 Connecting Channels

1. Navigate to **Channel Manager → OTA Connections**
2. Click **Add Connection**
3. Select channel (e.g., Booking.com)
4. Enter API credentials
5. Test connection
6. Enable connection

### 13.2 Channel Mapping

1. Navigate to **Channel Manager → Mapping**
2. Map room types: Internal ↔ OTA
3. Map rate plans: Internal ↔ OTA
4. Save mappings

### 13.3 Inventory Sync

1. Navigate to **Channel Manager → Inventory Sync**
2. View sync status per channel
3. Manual sync: Select date range, channels → **Sync Now**

### 13.4 Rate Sync

1. Navigate to **Channel Manager → Rate Sync**
2. View rate status
3. Update rates across channels
4. Set restrictions: Minimum stay, Maximum stay, Closed to arrival

### 13.5 Booking Import

1. Navigate to **Channel Manager → Booking Sync**
2. View imported bookings
3. Handle conflicts: View mismatches, Resolve mapping issues

### 13.6 Sync Logs

1. Navigate to **Channel Manager → Sync Logs**
2. View all sync operations
3. Filter by: Channel, Status, Date range
4. Retry failed syncs

---

## 14. Reports

### 14.1 Revenue Reports

1. Navigate to **Reports → Revenue Reports**
2. Configure: Date range, Property, Room type
3. View: Total revenue, Room revenue, F&B revenue, Other revenue
4. Export to PDF/Excel

### 14.2 Occupancy Reports

1. Navigate to **Reports → Occupancy Reports**
2. View: Occupancy %, Room nights, Available rooms, Segmentation by source

### 14.3 ADR & RevPAR

- **ADR** = Room Revenue ÷ Room Nights Sold
- **RevPAR** = ADR × Occupancy Rate

### 14.4 Guest Analytics

1. Navigate to **Reports → Guest Analytics**
2. View: Demographics, Booking patterns, Repeat guest ratio, Lifetime value

### 14.5 Staff Performance

1. Navigate to **Reports → Staff Performance**
2. View: Tasks completed, Average response time, Customer ratings

### 14.6 Scheduled Reports

1. Navigate to **Reports → Scheduled Reports**
2. Create: Report type, Frequency, Recipients, Format
3. Enable schedule for automatic delivery

---

## 15. Settings

### 15.1 General Settings

1. Navigate to **Settings → General**
2. Configure: Property name, Contact, Operational settings, Check-in/out times

### 15.2 Tax & Currency

1. Navigate to **Settings → Tax & Currency**
2. Configure: Default currency, Tax rates, Tax rules by rate plan

### 15.3 Localization

1. Navigate to **Settings → Localization**
2. Configure: Default language (15+ supported), Timezone, Date/Number format

### 15.4 Feature Flags

1. Navigate to **Settings → Feature Flags**
2. Enable/disable addon modules per subscription plan

### 15.5 GDPR Compliance

1. Navigate to **Settings → GDPR**
2. Configure consent types, data export, right to erasure

### 15.6 Security Settings

1. Navigate to **Settings → Security**
2. Configure: Password policy, 2FA, Session timeout, IP whitelist

### 15.7 License Keys

1. Navigate to **Settings → License Keys**
2. Manage subscription license keys

### 15.8 System Integrations

1. Navigate to **Settings → System Integrations**
2. Configure API keys, webhooks, third-party connections

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search / Command palette |
| `Ctrl+N` | New booking |
| `Ctrl+S` | Save current form |
| `Esc` | Close modal |
| `?` | Show help |

---

## Support

**Email**: support@cryptsk.com  
**Help Center**: Click `?` icon in the app  
**Documentation**: docs.staysuite.io

---

*© 2025 Cryptsk Pvt Ltd*

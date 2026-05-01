// ─── Help Center Seed Data ─────────────────────────────────────────────────────
// Comprehensive articles covering all StaySuite HospitalityOS modules
// Content is based on actual codebase architecture and workflows

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
}

export interface SeedArticle {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string;
  viewCount: number;
  helpfulCount: number;
}

// ─── Categories ────────────────────────────────────────────────────────────────

export const seedCategories: SeedCategory[] = [
  { name: 'Getting Started', slug: 'getting-started', description: 'Initial setup, onboarding, and platform overview guides', icon: 'Rocket', sortOrder: 0 },
  { name: 'Property Management', slug: 'pms', description: 'Rooms, room types, rate plans, floor plans, and inventory', icon: 'Building2', sortOrder: 1 },
  { name: 'Booking Management', slug: 'bookings', description: 'Reservations, group bookings, waitlist, and booking lifecycle', icon: 'Calendar', sortOrder: 2 },
  { name: 'Front Desk Operations', slug: 'frontdesk', description: 'Check-in, check-out, walk-ins, kiosk, and registration', icon: 'ConciergeBell', sortOrder: 3 },
  { name: 'Guest Management', slug: 'guests', description: 'Guest profiles, KYC, loyalty programs, and guest journey', icon: 'Users', sortOrder: 4 },
  { name: 'Housekeeping', slug: 'housekeeping', description: 'Cleaning tasks, inspections, maintenance, and automation', icon: 'SprayCan', sortOrder: 5 },
  { name: 'Billing & Finance', slug: 'billing', description: 'Folios, invoices, payments, refunds, and multi-currency', icon: 'Receipt', sortOrder: 6 },
  { name: 'Revenue Management', slug: 'revenue', description: 'Dynamic pricing, demand forecasting, and competitor analysis', icon: 'TrendingUp', sortOrder: 7 },
  { name: 'Channel Manager', slug: 'channels', description: 'OTA connections, rate sync, inventory sync, and mapping', icon: 'Globe', sortOrder: 8 },
  { name: 'WiFi & Networking', slug: 'wifi', description: 'WiFi access, RADIUS, captive portal, DHCP, DNS, and firewall', icon: 'Wifi', sortOrder: 9 },
  { name: 'Restaurant & POS', slug: 'pos', description: 'Orders, kitchen display, menus, room service, and billing', icon: 'UtensilsCrossed', sortOrder: 10 },
  { name: 'Guest Experience', slug: 'experience', description: 'Communication, digital keys, in-room portal, and service requests', icon: 'Sparkles', sortOrder: 11 },
  { name: 'Reports & Analytics', slug: 'reports', description: 'Revenue reports, occupancy analytics, and custom reports', icon: 'BarChart3', sortOrder: 12 },
  { name: 'CRM & Marketing', slug: 'crm', description: 'Guest segmentation, campaigns, loyalty, and feedback', icon: 'Megaphone', sortOrder: 13 },
  { name: 'Events & MICE', slug: 'events', description: 'Event spaces, booking, calendar, and resource management', icon: 'PartyPopper', sortOrder: 14 },
  { name: 'Staff Management', slug: 'staff', description: 'Shift scheduling, attendance, performance, and leave', icon: 'HardHat', sortOrder: 15 },
  { name: 'Security & Surveillance', slug: 'security', description: 'Cameras, security events, incidents, and device sessions', icon: 'Shield', sortOrder: 16 },
  { name: 'Smart Hotel / IoT', slug: 'iot', description: 'IoT devices, room controls, and energy management', icon: 'Cpu', sortOrder: 17 },
  { name: 'Automation', slug: 'automation', description: 'Workflow builder, rules engine, and execution logs', icon: 'Workflow', sortOrder: 18 },
  { name: 'Integrations', slug: 'integrations', description: 'Payment gateways, POS systems, and third-party APIs', icon: 'Plug', sortOrder: 19 },
  { name: 'System Settings', slug: 'settings', description: 'General settings, tax, localization, security, and GDPR', icon: 'Settings', sortOrder: 20 },
  { name: 'Administration', slug: 'admin', description: 'Tenant management, roles, users, and system health', icon: 'Building', sortOrder: 21 },
];

// ─── Articles ──────────────────────────────────────────────────────────────────

export const seedArticles: SeedArticle[] = [
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    title: 'Getting Started with StaySuite HospitalityOS',
    slug: 'getting-started-with-staysuite',
    excerpt: 'Complete onboarding guide covering the platform overview, navigation, and your first steps with StaySuite.',
    category: 'getting-started',
    tags: '["onboarding","overview","dashboard","quick-start"]',
    viewCount: 487,
    helpfulCount: 42,
    content: `# Getting Started with StaySuite HospitalityOS

Welcome to **StaySuite HospitalityOS** — a comprehensive, all-in-one hotel management platform designed to streamline every aspect of your hospitality operations. This guide walks you through your first steps.

## Platform Overview

StaySuite is built on a modern architecture with **170+ database models**, **280+ API endpoints**, and **35 module directories** covering every aspect of hotel management:

- **Base Modules**: Dashboard, PMS, Bookings, Front Desk, Guests, Housekeeping, Billing, Settings
- **Addon Modules**: WiFi, POS, Revenue, Channels, CRM, Events, IoT, Security, AI, and more

## Navigating the Interface

### The Sidebar
The sidebar on the left organizes all modules into logical groups. Click any section to expand its sub-items. The sidebar supports collapse/expand for more workspace.

### The Dashboard
The main dashboard provides an at-a-glance view of your hotel operations:

1. **KPI Cards** — Today's occupancy, revenue, check-ins/check-outs, available rooms
2. **Command Center** — Quick actions for common tasks
3. **Charts** — Revenue trends, occupancy heatmap, forecast widget
4. **Activity Feed** — Recent bookings, payments, housekeeping updates
5. **Alerts Panel** — Overbookings, maintenance due, expiring vouchers

### The Header
The top header contains:
- **Global Search** (Ctrl+K) — Search across bookings, guests, rooms
- **Command Palette** — Quick navigation to any section
- **Notification Panel** — Real-time alerts and reminders
- **Language Switcher** — 18 supported languages
- **User Menu** — Profile, settings, logout

## Your First Setup Steps

### Step 1: Configure Your Property
Navigate to **PMS > Properties** and ensure your property details are complete:
- Property name, address, contact information
- Check-in/check-out times
- Currency and tax settings
- Amenities and facilities

### Step 2: Set Up Room Types
Go to **PMS > Room Types** and create your room categories:
- Standard, Deluxe, Suite, etc.
- Set base occupancy limits
- Configure amenities per room type
- Upload room photos

### Step 3: Add Your Rooms
In **PMS > Rooms**, add individual rooms:
- Assign room numbers to room types
- Set floor/wing locations
- Mark initial room status

### Step 4: Configure Rate Plans
Under **PMS > Rate Plans**, create your pricing structure:
- BAR (Best Available Rate)
- Corporate rates
- Package rates
- Seasonal pricing rules

### Step 5: Enable Notifications
Go to **Settings > Notifications** to set up:
- Email templates for booking confirmations
- SMS reminders for check-in
- Internal alerts for staff

## Keyboard Shortcuts

- **Ctrl+K** — Open command palette
- **Ctrl+B** — Toggle sidebar
- **Escape** — Close modals/dialogs

## Need More Help?

Check out the other articles in this Help Center, or use the Tutorial Progress tracker to follow guided learning paths for each module.`,
  },
  {
    title: 'Understanding the Dashboard & KPI Cards',
    slug: 'dashboard-and-kpi-cards',
    excerpt: 'Learn how to read and customize your main dashboard including KPI metrics, charts, and the command center.',
    category: 'getting-started',
    tags: '["dashboard","kpi","charts","metrics","command-center"]',
    viewCount: 356,
    helpfulCount: 31,
    content: `# Understanding the Dashboard & KPI Cards

The StaySuite dashboard is your operational command center. It provides real-time visibility into every aspect of your property.

## Dashboard Components

### KPI Cards
The top row displays key performance indicators:

- **Occupancy Rate** — Current rooms occupied vs. total available rooms
- **Today's Revenue** — Total revenue from check-ins, POS, and services
- **Expected Arrivals** — Number of guests checking in today
- **Expected Departures** — Number of guests checking out today
- **Available Rooms** — Rooms ready for new guests
- **Average Daily Rate (ADR)** — Revenue per occupied room

### Command Center
Quick actions panel for common operations:
- New booking
- Check-in guest
- Create housekeeping task
- Generate report
- Quick room status update

### Charts & Widgets
- **Revenue Trend Widget** — Daily/weekly/monthly revenue line chart
- **Occupancy Heatmap** — Color-coded room status grid (vacant/occupied/maintenance)
- **Occupancy Forecast** — AI-powered future occupancy prediction
- **Weather Widget** — Local weather conditions affecting demand
- **Property Status Widget** — Multi-property comparison (chain properties)
- **Staff On Duty** — Current shift staff with their assignments

### Recent Activity Feed
Real-time stream of operations:
- New bookings and modifications
- Payment transactions
- Housekeeping task completions
- Guest check-ins and check-outs
- System alerts and notifications

## Customizing Your Dashboard

The dashboard uses a widget-based architecture. You can:

1. **Reorder widgets** by drag-and-drop
2. **Toggle widget visibility** from the dashboard settings
3. **Set date ranges** for chart data
4. **Choose properties** (for multi-property setups)

## Alerts Panel

The alerts system monitors your operations and surfaces important notifications:

- **Overbooking alerts** — When booking count exceeds room count
- **Maintenance due** — Preventive maintenance tasks approaching deadline
- **Payment failures** — Declined transactions requiring attention
- **Rate parity issues** — When channel rates don't match your configured rates
- **Guest feedback** — Negative reviews requiring response

## State Management

The dashboard uses Zustand stores for real-time data:
- \`useDashboardStore\` — Dashboard stats and loading states
- \`useUIStore\` — Active section, sidebar state
- \`useAuthStore\` — Current user, tenant, and property context

Data is refreshed automatically via Socket.io real-time connections, ensuring your dashboard always reflects the current state of operations.`,
  },
  {
    title: 'User Roles, Permissions & SSO Configuration',
    slug: 'user-roles-and-permissions',
    excerpt: 'Complete guide to managing user access, role-based permissions, SSO setup, and multi-factor authentication.',
    category: 'getting-started',
    tags: '["roles","permissions","sso","security","2fa","admin"]',
    viewCount: 298,
    helpfulCount: 27,
    content: `# User Roles, Permissions & SSO Configuration

StaySuite provides a robust role-based access control (RBAC) system that ensures each team member has the right level of access.

## Understanding Roles & Permissions

### Role Hierarchy
StaySuite supports a flexible role system defined in \`src/lib/rbac.ts\`:

1. **Platform Admin** — Full access across all tenants and properties
2. **Property Admin** — Full access within their tenant/property
3. **Manager** — Access to operational modules (bookings, front desk, etc.)
4. **Front Desk** — Check-in/out, booking creation, guest lookup
5. **Housekeeping** — Task management and room status updates
6. **Accounting** — Folios, invoices, payments, and reports
7. **Viewer** — Read-only access to dashboards and reports

### Permission Format
Permissions follow the pattern \`module:action\`:
- \`bookings:create\` — Create new bookings
- \`bookings:read\` — View booking details
- \`bookings:update\` — Modify bookings
- \`bookings:delete\` — Cancel bookings
- \`billing:manage\` — Full billing access
- \`help:manage\` — Manage help center articles

### Managing Roles
Navigate to **Admin > Roles & Permissions** to:
- Create custom roles with specific permission sets
- Assign roles to users
- Set property-level access restrictions

## Single Sign-On (SSO)

StaySuite supports SAML 2.0, OpenID Connect (OIDC), and LDAP authentication:

### Setting Up SSO
1. Go to **Security Center > SSO Configuration**
2. Choose your identity provider (IdP):
   - **SAML** — For enterprise IdPs (Okta, Azure AD, OneLogin)
   - **OIDC** — For modern OAuth-based providers
   - **LDAP** — For Active Directory integration
3. Enter your IdP metadata URL or upload the XML file
4. Map IdP attributes to StaySuite user fields
5. Enable SSO and test the connection

### SSO Session Management
Sessions are managed via the \`SSOSession\` model with automatic expiration. Users are redirected to your IdP for authentication and returned with a valid session.

## Two-Factor Authentication (2FA)

Configure 2FA in **Security Center > Two-Factor Auth**:
- **TOTP-based** — Using authenticator apps (Google Authenticator, Authy)
- **SMS-based** — One-time codes via SMS
- **Email-based** — One-time codes via email

## Device Session Management

Track and manage active sessions in **Security Center > Device Sessions**:
- View all active login sessions
- Revoke sessions remotely
- Set session timeout policies
- Monitor login history via audit logs

## Multi-Tenancy

StaySuite uses tenant isolation for data security:
- Every database record has a \`tenantId\` field
- The \`db-tenant-middleware.ts\` enforces tenant isolation at the API layer
- Platform admins can switch tenants using the \`useActiveTenantStore\`

This ensures complete data separation between different hotel properties or chains.`,
  },

  // ── PMS ────────────────────────────────────────────────────────────────────
  {
    title: 'Managing Room Types & Room Inventory',
    slug: 'room-types-and-inventory',
    excerpt: 'Guide to creating room types, configuring rooms, managing floor plans, and controlling inventory.',
    category: 'pms',
    tags: '["rooms","room-types","inventory","floor-plans","pms"]',
    viewCount: 412,
    helpfulCount: 38,
    content: `# Managing Room Types & Room Inventory

The Property Management System (PMS) module is the backbone of StaySuite. This guide covers room type configuration, room management, and inventory control.

## Room Types

### Creating Room Types
Navigate to **PMS > Room Types** to define your room categories.

Each room type includes:
- **Name** — e.g., "Deluxe King", "Standard Twin"
- **Base Occupancy** — Default maximum guests
- **Max Occupancy** — Maximum with extra beds
- **Bed Configuration** — Bed types and counts
- **Amenities** — Associated amenities (TV, minibar, balcony, etc.)
- **Description** — Detailed description for booking channels
- **Images** — Photo gallery for online display

### Room Type Rate Tiers
Room types support multiple rate tiers:
- **Rack Rate** — Maximum published rate
- **BAR** — Best Available Rate
- **Corporate** — Negotiated corporate rates
- **Package** — Bundled rates with meals/services
- **Promotional** — Discounted rates for campaigns

## Room Management

### Adding Rooms
In **PMS > Rooms**, each physical room is created with:
- **Room Number** — Unique identifier (e.g., "301")
- **Room Type** — Link to room type definition
- **Floor** — Floor location
- **Wing/Section** — Building section
- **Status** — Vacant, Occupied, Out-of-Order, Maintenance

### Room Status Lifecycle
Rooms follow a defined status workflow:
1. **Vacant / Dirty** — Guest departed, needs cleaning
2. **Vacant / Clean** — Ready for new guest
3. **Occupied** — Currently in use
4. **Out-of-Order (OOO)** — Temporarily unavailable (maintenance)
5. **Out-of-Service (OOS)** — Permanently removed from inventory

### Bulk Operations
- **Bulk Rate Update** — Apply rate changes across multiple room types
- **Room Status Update** — Batch update room statuses

## Floor Plan Editor

StaySuite includes a visual floor plan editor (**PMS > Floor Plans**):
- Drag-and-drop room placement
- Color-coded status indicators
- Room type grouping
- Floor-by-floor views
- Interactive room detail popups

The floor plan uses \`floor-plan-editor.tsx\` for drag interactions and \`floor-plan-viewer.tsx\` for read-only display.

## Inventory Management

### Availability Calendar
The **Inventory Calendar** shows room availability across dates:
- Color-coded: green (available), amber (limited), red (sold out)
- Filter by room type
- Click to drill into specific date details

### Inventory Control
- **Inventory Locking** — Reserve specific rooms for group bookings or maintenance
- **Availability Control** — Set minimum/maximum stay requirements
- **Overbooking Settings** — Configure overbooking thresholds per room type

### Inventory Locking
The \`inventory-locking.tsx\` component allows you to:
- Lock specific rooms for date ranges
- Set lock reasons (maintenance, group block, renovation)
- Automatically release locks after the specified period

## Room Out-of-Order

Manage temporarily unavailable rooms in **PMS > Room Out-of-Order**:
- Set start and end dates for the OOO period
- Assign reason codes (maintenance, deep cleaning, renovation)
- The system automatically excludes OOO rooms from availability calculations
- OOO rooms generate automatic maintenance work orders

## Related Database Models
- \`Room\`, \`RoomType\`, \`Amenity\`, \`FloorPlan\`
- \`FloorPlanRoom\`, \`RatePlan\`, \`PricingRule\`
- \`InventoryLock\`, \`MaintenanceBlock\``,
  },

  {
    title: 'Rate Plans & Pricing Configuration',
    slug: 'rate-plans-and-pricing',
    excerpt: 'Configure rate plans, pricing rules, seasonal rates, and bulk price updates across room types.',
    category: 'pms',
    tags: '["rate-plans","pricing","rates","seasonal","bulk-update"]',
    viewCount: 345,
    helpfulCount: 29,
    content: `# Rate Plans & Pricing Configuration

StaySuite provides a powerful pricing engine that supports complex rate structures, seasonal adjustments, and automated pricing rules.

## Rate Plan Architecture

### Understanding Rate Plans
Rate plans define **how rooms are priced** and **what is included**:

1. **BAR (Best Available Rate)** — Your standard flexible rate
2. **Corporate Rate** — Special rates for corporate clients
3. **Package Rate** — Room + meals/services bundled together
4. **Long Stay Rate** — Discounted rates for extended stays
5. **Promotional Rate** — Time-limited special offers
6. **Group Rate** — Negotiated rates for group bookings

### Creating a Rate Plan
Navigate to **PMS > Rate Plans**:

1. Click "New Rate Plan"
2. Enter rate plan name and description
3. Select applicable room types
4. Set base rate per room type per night
5. Configure inclusions (breakfast, WiFi, parking, etc.)
6. Set cancellation policy
7. Define minimum/maximum stay requirements
8. Set validity period

## Pricing Rules Engine

The pricing engine (\`lib/pricing/engine.ts\`) evaluates rules in priority order:

### Rule Types
- **Base Rate** — Default price per room type
- **Seasonal Adjustment** — Percentage or fixed amount for date ranges
- **Length-of-Stay Discount** — Discount for stays of N+ nights
- **Occupancy-Based** — Dynamic pricing based on current occupancy
- **Competitor Matching** — Auto-adjust based on competitor rates
- **Day-of-Week** — Different rates for weekdays vs weekends

### Pricing Priority Chain
\`\`\`
Base Rate → Seasonal Rule → LOS Discount → Occupancy Rule → Channel Markup → Final Price
\`\`\`

## Room Rate Calendar

The **Room Rate Calendar** (\`room-rate-calendar.tsx\`) provides:
- Visual calendar view of rates across all room types
- Color-coded rate tiers
- Click-to-edit individual date rates
- Bulk rate application for date ranges

## Bulk Price Updates

Use **PMS > Bulk Price Update** to:
- Apply percentage increase/decrease across room types
- Set flat-rate adjustments
- Target specific date ranges
- Preview changes before applying

## Overbooking Configuration

Configure overbooking thresholds in **PMS > Overbooking Settings**:
- Set percentage limits per room type
- Based on historical no-show and cancellation rates
- Automatic alerts when approaching limits

## Related Components
- \`rate-plans-manager.tsx\` — Rate plan CRUD interface
- \`rate-plans-pricing-rules.tsx\` — Pricing rules configuration
- \`pricing-manager.tsx\` — Central pricing management
- \`bulk-price-update.tsx\` — Bulk rate adjustment tool`,
  },

  // ── Bookings ───────────────────────────────────────────────────────────────
  {
    title: 'Creating & Managing Reservations',
    slug: 'creating-and-managing-reservations',
    excerpt: 'Complete guide to the booking lifecycle: creation, modification, cancellation, and status tracking.',
    category: 'bookings',
    tags: '["bookings","reservations","calendar","lifecycle","modification"]',
    viewCount: 523,
    helpfulCount: 45,
    content: `# Creating & Managing Reservations

The Bookings module handles the complete reservation lifecycle from initial inquiry to post-stay follow-up.

## Creating a New Booking

### From the Bookings List
1. Navigate to **Bookings > Bookings List**
2. Click **"New Booking"** button
3. Fill in the booking form:
   - **Guest Details** — Search existing guest or create new profile
   - **Stay Dates** — Check-in and check-out dates
   - **Room Selection** — Choose room type and specific room
   - **Rate Plan** — Select applicable rate plan
   - **Special Requests** — Notes and preferences
   - **Source** — Booking channel (direct, OTA, walk-in, etc.)
4. Review the booking summary with total cost
5. Click **"Confirm Booking"**

### From the Calendar View
The **Booking Calendar** (\`bookings-calendar.tsx\`) provides:
- Visual timeline of all bookings
- Drag to create new bookings on available dates
- Drag to resize/modify existing bookings
- Color-coded by booking status
- Filter by room type, status, or source

## Booking Status Lifecycle

\`\`\`
Draft → Confirmed → Checked-In → Checked-Out → Completed
                ↘ Cancelled
                ↘ No-Show
\`\`\`

### Status Descriptions
- **Draft** — Booking being created, not yet confirmed
- **Confirmed** — Reservation is active and guaranteed
- **Checked-In** — Guest has arrived and room is occupied
- **Checked-Out** — Guest has departed, folio pending
- **Completed** — Folio closed and balance settled
- **Cancelled** — Reservation cancelled (policy applies)
- **No-Show** — Guest did not arrive (automated detection)

## Modifying Reservations

### Changes You Can Make
- **Date Changes** — Extend or shorten stay (subject to availability)
- **Room Changes** — Switch room type or specific room
- **Guest Updates** — Add/modify guest information
- **Rate Changes** — Apply different rate plan
- **Add Services** — Add meals, transfers, experiences

### Modification Workflow
1. Open the booking from the list or calendar
2. Click "Modify" 
3. Make the required changes
4. System recalculates the total
5. If rates increase, collect additional payment
6. Confirmation notification sent to guest

## Cancellation Management

### Cancellation Process
1. Navigate to the booking and click "Cancel"
2. Select cancellation reason
3. The **cancellation policy engine** (\`lib/cancellation-policy-engine.ts\`) automatically calculates:
   - Whether the booking is within the free cancellation window
   - Applicable penalty charges
   - Refund amount if pre-paid

### Cancellation Policies
Configure in **Settings > Cancellation Policies**:
- **Flexible** — Free cancellation up to 24h before check-in
- **Moderate** — Free cancellation up to 7 days before
- **Strict** — Non-refundable or 50% charge
- **Custom** — Fully configurable rules per rate plan

## No-Show Automation

The **no-show engine** (\`lib/no-show-engine.ts\`) automatically:
1. Detects guests who haven't checked in by the configured time
2. Changes booking status to "No-Show"
3. Applies cancellation penalty charges
4. Releases the room back to available inventory
5. Sends notification to guest
6. Creates an audit log entry

Configure detection time in **Bookings > No-Show Automation**.

## Booking Sources & Channel Tracking

StaySuite tracks where each booking originated:
- **Direct** — Website, phone, walk-in
- **OTA** — Booking.com, Expedia, Airbnb (via Channel Manager)
- **Corporate** — Direct corporate bookings
- **Group** — Part of a group booking block
- **Travel Agent** — Via agency partners

## Audit Trail

Every booking action is logged in **Booking Audit Logs**:
- Who made the change
- What was changed (old value → new value)
- Timestamp
- IP address
- This data feeds the audit system in \`lib/audit/\``,
  },

  {
    title: 'Group Bookings & Block Management',
    slug: 'group-bookings-guide',
    excerpt: 'How to create, manage, and track group bookings including room blocks, cut-off dates, and attrition.',
    category: 'bookings',
    tags: '["group-bookings","blocks","corporate","events","conventions"]',
    viewCount: 234,
    helpfulCount: 22,
    content: `# Group Bookings & Block Management

Group bookings are essential for handling corporate events, conventions, weddings, and tour groups. StaySuite provides comprehensive tools for managing room blocks and group reservations.

## Creating a Group Booking

### Step-by-Step Process
1. Navigate to **Bookings > Group Bookings**
2. Click "New Group Booking"
3. Enter group details:
   - **Group Name** — e.g., "TechCorp Annual Conference 2025"
   - **Company/Organization** — Associated organization
   - **Contact Person** — Group coordinator details
   - **Event Dates** — Start and end dates
4. Configure the **Room Block**:
   - Select room types needed
   - Set number of rooms per type per night
   - Define block release date (cut-off date)
   - Set attrition clause percentage
5. Configure **Group Rates**:
   - Negotiated rate per room type
   - Comp rooms ratio (e.g., 1 comp per 20 paid)
   - Special inclusions
6. Set **Payment Terms**:
   - Deposit amount and due date
   - Payment schedule milestones
   - Cancellation terms

## Room Block Management

### Block Inventory
Room blocks are allocated from your available inventory:
- **Blocked Rooms** — Reserved for the group
- **Picked Up** — Individual bookings made from the block
- **Released** — Rooms returned to general inventory after cut-off
- **Attrition** — Rooms not picked up, subject to attrition charges

### Cut-Off Dates
Set a cut-off date when unpicked rooms in the block are released back to general inventory. This ensures unsold group rooms can still be booked by other guests.

### Sub-Block Management
For large groups, you can create sub-blocks:
- VIP block with upgraded rooms
- Speaker block with specific amenities
- Staff/organizer block

## Individual Room List

### Rooming List
Group coordinators can submit a rooming list:
- Guest names and room preferences
- Room sharing assignments
- Special requests per room
- Import from CSV/Excel

### Booking Individual Rooms
StaySuite allows two approaches:
1. **Central Booking** — Staff books all rooms from the block
2. **Self-Service Link** — Guests book their own room via a unique group link

## Financial Tracking

### Group Folio
Each group booking has a master folio tracking:
- Total room revenue
- F&B charges
- Event space charges
- Deposits received
- Outstanding balance

### Invoice Generation
Generate invoices for:
- Initial deposit
- Progress payments
- Final settlement
- Attrition charges

## Related Components
- \`group-bookings.tsx\` — Group booking management UI
- \`waitlist.tsx\` — Waitlist for sold-out periods
- \`conflicts.tsx\` — Booking conflict detection`,
  },

  // ── Front Desk ─────────────────────────────────────────────────────────────
  {
    title: 'Complete Guest Check-In Process',
    slug: 'guest-check-in-process',
    excerpt: 'Step-by-step guide to the check-in workflow including KYC verification, room assignment, and key generation.',
    category: 'frontdesk',
    tags: '["check-in","front-desk","kyc","registration","room-assignment"]',
    viewCount: 567,
    helpfulCount: 48,
    content: `# Complete Guest Check-In Process

The check-in process is one of the most critical touchpoints in the guest journey. StaySuite streamlines this with an efficient, guided workflow.

## Check-In Workflow Overview

\`\`\`
Guest Arrival → Search/Verify Booking → KYC Verification → Room Assignment 
→ Key Card Generation → Folio Creation → Welcome Notification → Check-In Complete
\`\`\`

## Step-by-Step Check-In

### 1. Guest Arrival & Booking Lookup
Navigate to **Front Desk > Check-In**:
- Search by booking ID, guest name, or confirmation number
- The system shows all confirmed bookings with today's check-in date
- Click on the booking to begin the process

### 2. Verify Guest Identity (KYC)
The **KYC Management** module (\`kyc-management.tsx\`) handles identity verification:

1. **Document Capture** — Scan or photograph government ID
   - Passport, national ID, driver's license
   - Upload via \`kyc-document-upload.tsx\`
2. **Data Extraction** — Auto-fill guest details from document
3. **Verification Status** — Mark as Verified, Pending, or Rejected
4. **GDPR Compliance** — Documents stored securely per GDPR settings

### 3. Room Assignment
Assign a specific room to the guest:

**Manual Assignment:**
- View available rooms filtered by the booked room type
- Consider guest preferences (floor, view, smoking/non-smoking)
- Check room status (must be "Vacant/Clean")
- Click "Assign Room"

**Auto-Assignment:**
- Click the "Auto-Assign" button (\`auto-assign-button.tsx\`)
- The system selects the best available room based on:
  - Room type match
  - Guest preferences
  - Room condition score
  - Floor optimization (spread across floors)

### 4. Registration Card
Complete the digital registration card (\`registration-card.tsx\`):
- Confirm guest details
- Emergency contact information
- Accept terms and conditions
- Digital signature capture (\`signature-pad.tsx\`)
- Special requests and preferences

### 5. Key Card Generation
Generate a room key using the **Key Card Manager** (\`key-card-manager.tsx\`):
- Encode room number and access dates
- Set floor/building access level
- Generate duplicate keys if needed
- Integration with electronic door lock systems

### 6. Folio Creation
A guest folio is automatically created during check-in:
- Pre-populated with room charges for the reservation duration
- Ready for posting additional charges during the stay
- Linked to the guest's payment method

### 7. Welcome Notification
If configured, the system automatically sends:
- **Email** — Welcome message with WiFi credentials, hotel info
- **SMS** — Room number and check-in confirmation
- **Push Notification** — If guest has the mobile app

## Express Check-In (Kiosk)

For self-service, configure the **Express Kiosk** (\`express-kiosk.tsx\`):
- Touchscreen interface at self-service stations
- Guest scans booking QR code or enters confirmation number
- ID verification via document scanner
- Digital registration card with e-signature
- Automatic key card dispensing
- Kiosk settings configurable in \`kiosk-settings.tsx\`

## Room Move Process

If the guest needs to change rooms during their stay:
1. Go to **Front Desk > Room Move**
2. Search for the guest's current booking
3. Select the new room
4. System updates:
   - Room status (old room → dirty, new room → occupied)
   - Folio (if rate changes)
   - Key card (new room encoded)
   - Room move log entry (\`RoomMoveLog\`)

## Related Components
- \`check-in.tsx\` — Main check-in interface
- \`room-assignment.tsx\` — Room assignment panel
- \`walk-in.tsx\` — Walk-in booking creation
- \`registration-card.tsx\` — Digital registration
- \`signature-pad.tsx\` — Signature capture
- \`key-card-manager.tsx\` — Key card encoding`,
  },

  {
    title: 'Guest Check-Out & Folio Settlement',
    slug: 'guest-check-out-process',
    excerpt: 'Process check-out, review folio charges, collect payments, and handle folio transfers.',
    category: 'frontdesk',
    tags: '["check-out","folio","settlement","payment","front-desk"]',
    viewCount: 398,
    helpfulCount: 35,
    content: `# Guest Check-Out & Folio Settlement

The check-out process ensures all charges are reviewed, payments are collected, and the room is released back to inventory.

## Check-Out Process

### Step 1: Open the Check-Out Screen
Navigate to **Front Desk > Check-Out**:
- The system lists all guests checking out today
- Search for a specific guest by name or room number
- Click on the guest to view their folio

### Step 2: Review the Folio
The guest folio (\`folios.tsx\`) displays all charges:
- **Room Charges** — Nightly room rate × number of nights
- **F&B Charges** — Restaurant, room service, minibar
- **Service Charges** — Laundry, spa, experiences
- **Taxes** — Applicable tax amounts
- **Payments** — Pre-payments, deposits, adjustments
- **Balance Due** — Remaining amount to collect

### Step 3: Verify Charges
- Review each line item with the guest
- Remove any disputed charges (creates credit note)
- Add any missing charges (late minibar consumption, etc.)
- Apply discounts or complimentary adjustments

### Step 4: Collect Payment
Multiple payment methods supported:
- **Credit/Debit Card** — Via integrated payment terminals (Stripe/PayPal)
- **Cash** — Manual entry with cashier verification
- **Split Payment** — Divide between multiple methods (\`split-payment-dialog.tsx\`)
- **Room Transfer** — Charge to another guest's folio (\`folio-transfer.tsx\`)
- **Corporate Billing** — Send to company account
- **Pre-paid** — Already settled (zero balance)

### Step 5: Generate Invoice
- Create a final invoice (\`invoices.tsx\`)
- Email PDF to guest
- Print physical copy if requested
- Mark invoice as paid

### Step 6: Room Release
The system automatically:
1. Updates booking status to "Checked-Out"
2. Changes room status to "Vacant/Dirty"
3. Generates a housekeeping cleaning task
4. Cancels the guest's digital key access
5. Updates inventory (room available for next booking)
6. Sends thank-you email and review request

## Folio Management

### Folio Features
- **Line Items** — Individual charges with date, description, amount
- **Tax Calculation** — Automatic tax based on configured rates
- **Multi-Currency** — Display and charge in guest's preferred currency
- **Folio Transfer** — Move charges between folios
- **Credit Notes** — Issue refunds or adjustments

### Audit Trail
Every folio action is logged:
- Who posted the charge
- Original and new amounts
- Timestamp
- Payment reference

## Related Components
- \`check-out.tsx\` — Main check-out interface
- \`folios.tsx\` — Folio management
- \`split-payment-dialog.tsx\` — Split payment handling
- \`folio-transfer.tsx\` — Transfer between folios
- \`invoices.tsx\` — Invoice generation
- \`credit-notes.tsx\` — Credit note management`,
  },

  // ── Guests ──────────────────────────────────────────────────────────────────
  {
    title: 'Guest Profile & Preference Management',
    slug: 'guest-profile-preferences',
    excerpt: 'How to create, manage, and enrich guest profiles with preferences, stay history, and communication preferences.',
    category: 'guests',
    tags: '["guests","profiles","preferences","kyc","stay-history"]',
    viewCount: 289,
    helpfulCount: 26,
    content: `# Guest Profile & Preference Management

The Guest module provides a 360-degree view of every guest, enabling personalized service and building lasting relationships.

## Guest Profile Overview

### Profile Components
Navigate to **Guests > Guest Profile** (\`guest-profile.tsx\`) to view:

1. **Personal Information** — Name, email, phone, date of birth, nationality
2. **Identification** — KYC documents, passport details, visa info
3. **Preferences** — Room type, floor, pillow type, dietary needs, etc.
4. **Stay History** — Complete log of past and upcoming stays
5. **Loyalty Status** — Current tier, points balance, rewards
6. **Communication Preferences** — Email, SMS, WhatsApp opt-ins
7. **Guest Segments** — CRM segment memberships
8. **Special Notes** — VIP flags, allergy alerts, do-not-disturb

## Creating Guest Profiles

### Automatic Creation
Guest profiles are automatically created when:
- A new booking is made with a new guest
- A walk-in registration is completed
- A guest registers via the booking engine

### Manual Creation
1. Go to **Guests > Guest List**
2. Click "Add Guest"
3. Fill in the profile form
4. Save — the profile is immediately available for bookings

## Guest Preferences

### Managing Preferences
The **Preferences** module (\`guest-preferences.tsx\`) allows staff to record:

**Room Preferences:**
- Preferred room type and floor
- Smoking/non-smoking
- Bed type (king, twin)
- View preference (garden, city, sea)
- Pillow type (soft, firm, hypoallergenic)

**Dining Preferences:**
- Dietary restrictions (vegetarian, vegan, gluten-free, allergies)
- Preferred cuisine
- Room service preferences

**Service Preferences:**
- Newspaper/magazine delivery
- Minibar preferences
- Temperature preference
- Turndown service

### Auto-Preferences Engine
The auto-preferences engine (\`lib/guest/auto-preferences.ts\`) automatically:
- Infers preferences from booking patterns
- Suggests preferences based on similar guest profiles
- Pre-fills preferences for returning guests

## Guest Journey Tracking

The **Guest Journey** module (\`guest-journey.tsx\`) tracks the complete lifecycle:

\`\`\`
Pre-Arrival → Arrival → In-House → Pre-Departure → Post-Stay
\`\`\`

### Pre-Arrival Phase
- Booking confirmation sent
- Pre-arrival email with hotel info
- Room upgrade offers
- Special request confirmation

### Arrival Phase
- Check-in completion
- Room assignment
- Welcome amenities delivered

### In-House Phase
- Service requests tracked
- F&B consumption
- Issue/complaint resolution
- Experience bookings

### Pre-Departure Phase
- Express check-out offer
- Folio preview sent
- Late check-out request handling

### Post-Stay Phase
- Thank you email
- Review request
- Loyalty points credited
- Re-engagement campaign enrollment

## Guest Merge
If duplicate profiles exist (\`guest-merge.tsx\`):
- Merge guest profiles while preserving all data
- Combine stay histories
- Transfer loyalty points
- Consolidate preferences

## Related Database Models
- \`Guest\`, \`GuestDocument\`, \`GuestStay\`, \`GuestJourney\`
- \`GuestBehavior\`, \`GuestRecommendation\`, \`GuestSegment\`
- \`SegmentMembership\`, \`GuestFeedback\`, \`GuestReview\``,
  },

  {
    title: 'Loyalty Program Management',
    slug: 'loyalty-program-management',
    excerpt: 'Set up and manage loyalty tiers, point earning rules, reward redemption, and VIP benefits.',
    category: 'guests',
    tags: '["loyalty","points","tiers","vip","rewards","crm"]',
    viewCount: 198,
    helpfulCount: 18,
    content: `# Loyalty Program Management

StaySuite includes a comprehensive loyalty program system that helps drive repeat bookings and guest satisfaction.

## Loyalty Program Structure

### Tier System
Define loyalty tiers in **Guests > Loyalty Management**:

1. **Bronze** — Entry level (0-999 points)
2. **Silver** — Regular guest (1,000-4,999 points)
3. **Gold** — Frequent guest (5,000-19,999 points)
4. **Platinum** — VIP guest (20,000+ points)

### Tier Configuration
Each tier can have:
- **Qualifying Threshold** — Points needed to reach the tier
- **Validity Period** — How long tier status lasts (12 months rolling)
- **Benefits** — Upgrade eligibility, late checkout, welcome amenities
- **Point Multiplier** — Bonus earning rate (Gold = 1.5x, Platinum = 2x)
- **Status Match** — Auto-match from competitor loyalty programs

## Point Earning Rules

### Earning Points
Guests earn points through:
- **Room Revenue** — Base earning (e.g., 10 points per $1 spent)
- **F&B Spending** — Restaurant, room service, minibar
- **Experience Bookings** — Spa, tours, activities
- **Review Submissions** — Bonus for leaving reviews
- **Referrals** — Bonus for referring new guests
- **Campaign Bonuses** — Special promotional point events

### Point Tracking
The \`LoyaltyPointTransaction\` model records every movement:
- Earned (booking, spend, bonus)
- Redeemed (rewards, upgrades)
- Adjusted (corrections, expired)
- Transferred (between guests in same account)

## Rewards & Redemption

### Setting Up Rewards
Configure in **CRM > Loyalty Programs**:
- **Free Night** — Redeem points for a free room night
- **Room Upgrade** — Redeem for next room category
- **Late Checkout** — Complimentary late departure
- **F&B Credit** — Restaurant or minibar credit
- **Spa Voucher** — Discount on spa services
- **Partner Rewards** — Third-party vouchers and offers

### Redemption Process
1. Guest views available rewards in their profile or app
2. Selects reward and confirms redemption
3. Points deducted from balance
4. Reward issued (voucher code, automatic upgrade, etc.)
5. Transaction recorded in point history

## VIP Management

### VIP Flags
Mark guests as VIP with:
- **VIP Level** (VIP 1-3)
- **Auto VIP** — Based on spending thresholds or booking frequency
- **VIP Perks** — Configurable per level
  - Welcome amenity (fruit basket, wine)
  - Guaranteed late checkout
  - Room upgrade priority
  - Personal concierge assignment

### VIP Service Workflow
VIP guests trigger special workflows:
- Priority room assignment
- Pre-arrival room inspection
- Manager welcome
- Enhanced communication tracking
- Post-stay follow-up by management

## Integration with CRM
Loyalty data feeds into the CRM module:
- Segment guests by loyalty tier
- Target campaigns by tier
- Personalize communications based on preferences
- Track lifetime value per loyalty tier`,
  },

  // ── Housekeeping ───────────────────────────────────────────────────────────
  {
    title: 'Housekeeping Task Management & Kanban Board',
    slug: 'housekeeping-task-management',
    excerpt: 'Complete guide to managing cleaning tasks, kanban board workflows, and room status tracking.',
    category: 'housekeeping',
    tags: '["housekeeping","tasks","kanban","room-status","cleaning"]',
    viewCount: 312,
    helpfulCount: 28,
    content: `# Housekeeping Task Management & Kanban Board

The Housekeeping module ensures rooms are always guest-ready through efficient task management and automation.

## Task Management Overview

### Task Types
StaySuite supports multiple housekeeping task types:
- **Room Cleaning** — Standard turnover cleaning after check-out
- **Deep Clean** — Thorough cleaning on a schedule
- **Stay-Over Service** — Refresh cleaning for continuing guests
- **Public Area** — Lobby, corridors, common areas
- **Laundry** — Linen and towel management
- **Maintenance** — Repair and maintenance tasks

### Creating Tasks

**Manual Creation:**
1. Go to **Housekeeping > Tasks**
2. Click "New Task"
3. Select task type, room, and priority
4. Assign to staff member
5. Set estimated duration

**Auto-Generation:**
The housekeeping automation engine (\`lib/housekeeping-automation.ts\`) automatically creates tasks when:
- A guest checks out (turnover cleaning)
- A guest has a stay-over (refresh service)
- A room inspection fails (rectification task)
- Preventive maintenance is due

## Kanban Board

The **Kanban Board** (\`kanban-board.tsx\`) provides a visual task workflow:

\`\`\`
New → Assigned → In Progress → Quality Check → Completed
\`\`\`

### Board Features
- **Drag & Drop** — Move tasks between columns
- **Color Coding** — By priority (urgent/red, high/amber, normal/green)
- **Staff Avatars** — See who is assigned to each task
- **Time Tracking** — See how long each task has been in progress
- **Filters** — By floor, room type, staff member, priority

## Room Status Board

The **Room Status** view (\`room-status.tsx\`) shows:
- Color-coded room status across all floors
- Quick status update buttons
- Real-time status sync with PMS

### Status Definitions
- **Vacant / Clean** — Ready for check-in (green)
- **Vacant / Dirty** — Needs cleaning after check-out (yellow)
- **Occupied / Clean** — Guest in room, recently serviced (blue)
- **Occupied / Dirty** — Guest in room, needs service (orange)
- **Out of Order** — Maintenance required (red)
- **Inspection** — Pending quality inspection (purple)

## Automation Rules

Configure in **Housekeeping > Automation Rules** (\`housekeeping-automation.tsx\`):
- Auto-create cleaning tasks on check-out
- Auto-assign based on staff workload
- Escalate overdue tasks
- Generate recurring tasks for public areas
- Trigger maintenance requests from failed inspections

## Staff Workload Management

### Task Assignment
- **Manual** — Manager assigns tasks to specific staff
- **Auto-Balance** — System distributes tasks evenly based on workload
- **Zone-Based** — Staff assigned to specific floors/wings

### Performance Tracking
Track individual staff performance:
- Tasks completed per shift
- Average completion time
- Quality inspection pass rate
- Guest satisfaction scores

## Related Components
- \`tasks-list.tsx\` — Task list view
- \`kanban-board.tsx\` — Visual kanban board
- \`room-status.tsx\` — Room status dashboard
- \`housekeeping-automation.tsx\` — Automation rules
- \`maintenance.tsx\` — Maintenance request management`,
  },

  {
    title: 'Room Inspection Checklists & Quality Control',
    slug: 'inspection-checklists',
    excerpt: 'Create custom inspection templates, conduct quality checks, and auto-generate maintenance work orders.',
    category: 'housekeeping',
    tags: '["inspection","quality","checklist","maintenance","templates"]',
    viewCount: 178,
    helpfulCount: 16,
    content: `# Room Inspection Checklists & Quality Control

The inspection system ensures consistent quality standards across all rooms and public areas.

## Inspection Templates

### Creating Templates
Navigate to **Housekeeping > Inspection Checklists**:

1. Click "New Template"
2. Name the template (e.g., "Standard Room Inspection", "Deep Clean Checklist")
3. Add inspection items organized by area:
   - **Bathroom** — Cleanliness, fixtures, amenities, towels
   - **Bedroom** — Bed making, furniture, windows, TV
   - **Minibar** — Stock levels, expiry dates, pricing
   - **Safety** — Smoke detector, fire extinguisher, exit map
   - **HVAC** — Temperature, noise, air quality
   - **General** — Odor, lighting, overall cleanliness

4. For each item, set:
   - **Item name** — e.g., "Pillows are clean and firm"
   - **Rating type** — Pass/Fail or 1-5 scale
   - **Photo required** — Whether photographic evidence is needed
   - **Critical flag** — Failure triggers immediate action

### Template Assignment
- Assign templates to room types
- Set inspection frequency (every turn, daily, weekly)
- Assign to specific inspector roles

## Conducting Inspections

### Mobile Inspection Flow
1. Open the inspection task on mobile device
2. Walk through the room following the checklist
3. For each item:
   - Mark Pass/Fail or rate
   - Add notes if needed
   - Take photo if required
4. Submit inspection

### Auto-Generated Actions
When items fail inspection:
- **Maintenance Items** → Auto-create work order in maintenance module
- **Cleaning Items** → Re-assign cleaning task to housekeeping
- **Critical Failures** → Immediate alert to manager
- **All Failures** → Track in quality dashboard

## Inspection Reports

### Quality Dashboard
The inspection module generates reports:
- **Pass Rate by Area** — Which areas have most failures
- **Trend Analysis** — Quality improving or declining over time
- **Staff Performance** — Inspector consistency
- **Room Type Comparison** — Quality by room category
- **Common Issues** — Most frequently failed items

### Inspection Engine
The inspection engine (\`lib/inspection-engine.ts\`) provides:
- Workflow management for inspection lifecycle
- Auto-routing failed items to appropriate teams
- SLA tracking for rectification
- Escalation for overdue rectifications

## Preventive Maintenance

### PM Schedules
Set up in **Housekeeping > Preventive Maintenance**:
- Schedule recurring maintenance per room/equipment
- Set maintenance frequency (daily, weekly, monthly, quarterly)
- Assign to maintenance staff
- Track compliance rates

### Asset Management
Track hotel assets in **Housekeeping > Assets**:
- Asset registry (furniture, equipment, appliances)
- Maintenance history per asset
- Replacement scheduling
- Depreciation tracking

## Related Components
- \`inspection-checklists.tsx\` — Template management
- \`assets.tsx\` — Asset registry
- \`work-orders.tsx\` — Maintenance work orders
- \`maintenance.tsx\` — Maintenance request management`,
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  {
    title: 'Folio Management & Payment Processing Guide',
    slug: 'folio-and-payment-processing',
    excerpt: 'Complete guide to creating folios, posting charges, processing payments with Stripe/PayPal/Razorpay/UPI.',
    category: 'billing',
    tags: '["folio","payments","stripe","paypal","billing","invoices"]',
    viewCount: 456,
    helpfulCount: 41,
    content: `# Folio Management & Payment Processing Guide

The Billing module handles all financial transactions from room charges to payments, refunds, and multi-currency support.

## Folio System

### What is a Folio?
A folio is a running account of all charges and payments for a guest stay. Every checked-in guest has an active folio.

### Folio Structure
- **Header** — Guest name, room number, stay dates
- **Line Items** — Individual charges (room, F&B, services)
- **Payments** — All payments received
- **Tax Summary** — Tax breakdown
- **Balance** — Outstanding amount due

### Posting Charges
Staff can post charges to a folio from:
- **Front Desk** — Manual charge entry
- **POS** — Restaurant and room service charges auto-posted
- **Experiences** — Activity/service bookings auto-posted
- **Mini-Bar** — Consumption tracking
- **Laundry** — Service charges

### Folio Transfer
Transfer charges between folios (\`folio-transfer.tsx\`):
- Move charges to another guest's folio
- Split charges across multiple folios
- Transfer to corporate master account
- Audit trail for all transfers

## Payment Processing

### Supported Payment Gateways
StaySuite integrates with multiple payment providers via \`lib/payments/\`:

1. **Stripe** — Credit/debit cards, Apple Pay, Google Pay
2. **PayPal** — PayPal balance, linked cards
3. **Razorpay** — Indian payment methods, UPI
4. **UPI** — Direct UPI payment
5. **Manual/Cash** — Cash payments tracked manually

### Payment Flow
1. Select payment method at check-out or during stay
2. Enter amount (full or partial payment)
3. Process payment via gateway
4. Receive confirmation/receipt
5. Update folio balance

### Split Payments
The \`split-payment-dialog.tsx\` allows:
- Divide total across multiple payment methods
- Partial payments for deposits
- Corporate + personal card combination
- Multiple currencies

### Refunds
Process refunds in **Billing > Refunds**:
- Full or partial refund
- Original payment method refund
- Credit note issuance
- Refund approval workflow

## Invoice Management

### Creating Invoices
Navigate to **Billing > Invoices** (\`invoices.tsx\`):
- Auto-generate from closed folios
- Custom invoice creation
- Invoice templates with branding
- PDF export and email delivery

### Invoice Features
- Line item details
- Tax breakdown
- Payment terms
- Payment status tracking
- Proforma invoice generation

## Multi-Currency Support

### Currency Setup
Configure in **Settings > Tax & Currency**:
- Base currency for the property
- Supported foreign currencies
- Exchange rate sources (manual or auto-fetch)
- Exchange rate markup percentage

### Multi-Currency Transactions
- Guest charged in their preferred currency
- Exchange rate applied at time of charge
- Reconciliation in base currency
- Exchange rate history tracking (\`ExchangeRate\` model)

## Cancellation Policies

The cancellation policy engine (\`lib/cancellation-policy-engine.ts\`):
- Evaluates applicable policy at cancellation time
- Calculates penalty charges based on:
  - Days before check-in
  - Rate plan policy type
  - Amount already paid
- Generates cancellation invoice if charges apply

## Related Components
- \`folios.tsx\` — Folio management
- \`invoices.tsx\` — Invoice generation
- \`payments.tsx\` — Payment processing
- \`refunds.tsx\` — Refund management
- \`split-payment-dialog.tsx\` — Split payment
- \`multi-currency.tsx\` — Currency management
- \`credit-notes.tsx\` — Credit notes`,
  },

  // ── Revenue ────────────────────────────────────────────────────────────────
  {
    title: 'Dynamic Pricing & Demand Forecasting',
    slug: 'dynamic-pricing-and-forecasting',
    excerpt: 'Configure AI-powered dynamic pricing rules, demand forecasting, and competitor rate analysis.',
    category: 'revenue',
    tags: '["pricing","dynamic","forecasting","demand","competitor","ai"]',
    viewCount: 267,
    helpfulCount: 24,
    content: `# Dynamic Pricing & Demand Forecasting

The Revenue Management module leverages AI and data analytics to optimize room pricing and maximize revenue.

## Pricing Rules Engine

### Dynamic Pricing Overview
The pricing engine (\`lib/pricing/engine.ts\`) automatically adjusts rates based on:
- **Demand signals** — Booking pace, search volume, occupancy trends
- **Supply constraints** — Room availability, competitor availability
- **Time-based factors** — Day of week, season, holidays, events
- **Guest segments** — Corporate, leisure, group, OTA

### Creating Pricing Rules
Navigate to **Revenue > Pricing Rules** (\`pricing-rules.tsx\`):

1. **Rule Name** — Descriptive name
2. **Applicable Room Types** — Which room types are affected
3. **Trigger Conditions**:
   - Occupancy threshold (e.g., "when occupancy > 80%")
   - Date range (e.g., "Dec 20 - Jan 5")
   - Booking pace (e.g., "if bookings < expected by 30%")
4. **Price Action**:
   - Increase by percentage (e.g., +15%)
   - Set minimum rate
   - Apply fixed markup

### Rule Priority
Rules are evaluated in priority order:
1. Channel-specific overrides
2. Event-based rules
3. Occupancy-based rules
4. Seasonal rules
5. Day-of-week rules
6. Base rate

## Demand Forecasting

### AI-Powered Forecasts
The demand forecasting module (\`demand-forecasting.tsx\`) uses:
- Historical booking data
- Seasonal patterns
- Local events calendar
- Market demand indicators
- Weather data

### Forecast Outputs
- **Occupancy Forecast** — Predicted occupancy % per date
- **Revenue Forecast** — Expected revenue per date
- **Booking Pace** — How fast bookings are coming in vs. historical
- **Recommendation** — Suggested rate adjustments

### Forecast Dashboard
- Visual chart of historical vs. predicted
- Confidence intervals
- Key drivers identified
- Alert when forecast deviates significantly

## Competitor Pricing

### Competitor Rate Monitoring
Navigate to **Revenue > Competitor Pricing** (\`competitor-pricing.tsx\`):

The system tracks competitor rates via:
- **OTA scraping** — Booking.com, Expedia public rates
- **Manual entry** — Direct competitor surveys
- **Channel data** — Rates visible on connected channels

### Rate Parity Analysis
- Compare your rates vs. competitors per room type
- Identify under/over-priced positions
- Alerts when competitors change rates significantly
- **Rate Index** — Your rate as % of competitive set average

### Rate Positioning
Set your strategy:
- **Premium** — Price above competitive set
- **Match** — Price at competitive set average
- **Penetration** — Price below to gain market share

## AI Suggestions

The **AI Suggestions** module (\`ai-insights.tsx\`) provides:
- Rate adjustment recommendations
- Demand-based upsell suggestions
- Length-of-stay optimization
- Package recommendations
- Revenue opportunity alerts

## Related Components
- \`pricing-rules.tsx\` — Pricing rules management
- \`demand-forecasting.tsx\` — Demand prediction
- \`demand-forecasting-page.tsx\` — Forecast dashboard
- \`competitor-pricing.tsx\` — Market analysis
- \`ai-suggestions.tsx\` — AI recommendations`,
  },

  // ── Channels ───────────────────────────────────────────────────────────────
  {
    title: 'Channel Manager Setup & OTA Integration',
    slug: 'channel-manager-setup',
    excerpt: 'Connect to OTAs, configure inventory sync, rate parity, and booking synchronization.',
    category: 'channels',
    tags: '["channels","ota","booking.com","expedia","sync","inventory"]',
    viewCount: 345,
    helpfulCount: 32,
    content: `# Channel Manager Setup & OTA Integration

The Channel Manager connects your property to Online Travel Agencies (OTAs) for automated inventory and rate distribution.

## Supported Channels

### Direct Integrations
- **Booking.com** — Full two-way sync
- **Expedia** — Full two-way sync
- **Airbnb** — Full two-way sync
- **Google Hotels** — Metasearch listing
- **Direct Booking Engine** — Commission-free direct bookings

### Connection Architecture
The channel system uses \`lib/channel-manager/\`:
- **Client Factory** — Creates adapters per channel
- **Sync Scheduler** — Runs periodic sync jobs
- **Retry Queue** — Handles failed syncs
- **Dead Letter Queue** — Manual review for persistent failures

## Setting Up OTA Connections

### Step-by-Step Setup
1. Navigate to **Channel Manager > OTA Connections**
2. Click "Add Channel"
3. Select the OTA (e.g., Booking.com)
4. Enter credentials:
   - Hotel ID
   - API key/username/password
5. Test connection
6. Configure sync settings:
   - Sync interval (e.g., every 15 minutes)
   - Rate sync enabled
   - Inventory sync enabled
   - Booking sync enabled

## Inventory Sync

### How It Works
- When a room is booked locally → Deduct from OTA availability
- When a room is booked on OTA → Deduct from local availability
- Inventory lock → Excluded from all channels
- Out-of-order → Excluded from all channels

### Inventory Sync Settings
Configure in **Channel Manager > Inventory Sync**:
- **Buffer Rooms** — Hold back N rooms for direct bookings
- **Overbooking Protection** — Allow N% overbooking per channel
- **Closed to Arrival/Departure** — Restriction settings

## Rate Sync

### Rate Parity
Maintain consistent rates across channels in **Channel Manager > Rate Sync**:
- **Percentage markup** — Add % on top of BAR for OTAs
- **Fixed markup** — Add fixed amount per night
- **Channel-specific rates** — Custom rates per OTA
- **Currency conversion** — Auto-convert for different currencies

### Rate Restrictions
Set in **Channel Manager > Restrictions**:
- Minimum/maximum stay length
- Closed to arrival
- Closed to departure
- Release window (how far in advance bookable)

## Booking Sync

### Inbound Bookings
When a booking comes from an OTA:
1. Channel adapter receives the booking
2. System searches for matching room
3. Booking created in StaySuite
4. Guest profile created/updated
5. Confirmation sent back to OTA

### Outbound Bookings
When a direct booking is made:
1. Inventory updated across all channels
2. OTA listings updated
3. Booking pushed to connected OTAs

## Channel Mapping

Map your room types to OTA room types in **Channel Manager > Mapping**:
- Your "Deluxe King" → Booking.com "Deluxe Double Room"
- Your "Standard Twin" → Expedia "Standard Twin Room"

This ensures proper rate and inventory matching.

## Sync Logs & Monitoring

### Sync Dashboard
Track all synchronization activity:
- Last sync time per channel
- Sync success/failure rates
- Bookings pulled/pushed
- Error logs with retry status

### Manual Sync
Force an immediate sync if needed:
- Sync all channels
- Sync specific channel
- Sync specific date range

## Related Components
- \`ota-connections.tsx\` — OTA setup
- \`inventory-sync.tsx\` — Availability sync
- \`rate-sync.tsx\` — Rate synchronization
- \`booking-sync.tsx\` — Booking import/export
- \`sync-logs.tsx\` — Sync monitoring`,
  },

  // ── WiFi ───────────────────────────────────────────────────────────────────
  {
    title: 'WiFi Access Plans & Guest Connectivity',
    slug: 'wifi-access-plans',
    excerpt: 'Configure WiFi plans, vouchers, user sessions, and guest internet access management.',
    category: 'wifi',
    tags: '["wifi","plans","vouchers","sessions","guest-access"]',
    viewCount: 389,
    helpfulCount: 34,
    content: `# WiFi Access Plans & Guest Connectivity

The WiFi module provides enterprise-grade wireless network management with guest access control, bandwidth management, and network monitoring.

## WiFi Plans

### Creating WiFi Plans
Navigate to **WiFi > WiFi Access > Plans** (\`plans.tsx\`):

1. Click "New Plan"
2. Configure:
   - **Plan Name** — e.g., "Free 1 Hour", "Premium Day Pass", "Conference WiFi"
   - **Bandwidth Limit** — Download/upload speeds (e.g., 10 Mbps / 5 Mbps)
   - **Data Limit** — Total data allowance (e.g., 500 MB)
   - **Time Limit** — Duration (e.g., 1 hour, 24 hours, unlimited)
   - **Concurrent Devices** — Max devices per user
   - **Cost** — Free or paid (for POS integration)
   - **Validity** — When the plan can be used

### Plan Types
- **Complimentary** — Free for all hotel guests
- **Premium** — Paid upgrade with higher speeds
- **Conference/Event** — Bulk access for events
- **Staff** — Internal staff access
- **Management** — Admin-level access

## Voucher System

### Generating Vouchers
In **WiFi > WiFi Access > Vouchers** (\`vouchers.tsx\`):
- **Single Voucher** — Generate individual access codes
- **Bulk Generation** — Create batches of vouchers for events
- **Print Cards** — Print voucher cards for front desk (\`print-card.tsx\`)
- **QR Codes** — Generate QR codes for self-service activation

### Voucher Properties
- Unique access code
- Associated WiFi plan
- Validity period
- Usage status (active, used, expired)
- Maximum device limit

## Guest Session Management

### Live Sessions
Monitor active connections in **WiFi > Sessions > Live Sessions** (\`live-sessions.tsx\`):
- Connected users with IP/MAC addresses
- Current bandwidth usage
- Session duration
- Plan assignment
- Real-time disconnect capability

### Session History
View past sessions in **WiFi > Sessions > History** (\`session-history.tsx\`):
- Complete login/logout history
- Bandwidth consumption per session
- Authentication method used
- NAS/gateway that handled the session

## User Quotas & Bandwidth

### Fair Usage Policies
Configure in **WiFi > Firewall & Bandwidth > FUP Policies** (\`fup-policy.tsx\`):
- Daily data limits per plan
- Speed throttling after limit reached
- Reset schedule (daily/weekly)
- Notification thresholds

### Bandwidth Scheduler
Set different bandwidth limits by time of day (\`bandwidth-scheduler.tsx\`):
- Peak hours: Reduced speed for free plans
- Off-peak: Higher speed for all plans
- Custom schedules per plan

## Authentication Methods

### Captive Portal
Configure guest login via **WiFi > Captive Portal** (\`portal-page.tsx\`):
- Room number + name verification
- Voucher code entry
- Social login (Google, Facebook)
- Email OTP verification
- PMS auto-authentication (seamless)

### RADIUS Integration
Enterprise authentication via **WiFi > RADIUS & Gateway**:
- FreeRADIUS v3.2.7 integration
- 15+ vendor adapters (UniFi, Ruckus, Aruba, Cisco, etc.)
- CoA (Change of Authorization) for real-time bandwidth control
- Accounting sync for usage tracking

## Related Components
- \`plans.tsx\` — WiFi plan management
- \`vouchers.tsx\` — Voucher generation
- \`sessions.tsx\` / \`live-sessions.tsx\` — Session monitoring
- \`portal-page.tsx\` — Captive portal configuration
- \`user-quotas.tsx\` — Usage quota management`,
  },

  {
    title: 'Network Configuration: DHCP, DNS, Firewall & Bandwidth',
    slug: 'network-configuration-guide',
    excerpt: 'Complete network infrastructure setup including DHCP server, DNS, firewall rules, and bandwidth policies.',
    category: 'wifi',
    tags: '["network","dhcp","dns","firewall","bandwidth","nftables"]',
    viewCount: 223,
    helpfulCount: 20,
    content: `# Network Configuration: DHCP, DNS, Firewall & Bandwidth

StaySuite provides comprehensive network infrastructure management through direct integration with NetworkManager, nftables, and e2guardian.

## DHCP Server

### DHCP Configuration
Navigate to **WiFi > DHCP Server** (\`dhcp-page.tsx\`):

**Subnet Management:**
- Define DHCP subnets (e.g., 10.0.1.0/24 for guests)
- Set IP address ranges
- Configure lease duration
- Gateway and DNS server assignment

**DHCP Options:**
- Custom DHCP options per subnet
- Option 82 (Relay Agent Information) support
- Hostname filtering rules
- MAC-based reservations

**Advanced Features:**
- DHCP blacklist (\`dhcp-advanced-tabs.tsx\`)
- Lease script execution (\`dhcplease-script.tsx\`)
- Tag-based rules for dynamic assignment
- VLAN-aware DHCP relay

## DNS Server

### DNS Configuration
Navigate to **WiFi > DNS Server** (\`dns-page.tsx\`):
- **DNS Zones** — Manage forward and reverse zones
- **DNS Records** — A, AAAA, CNAME, MX, TXT records
- **DNS Redirect** — Captive portal redirect rules
- **Conditional Forwarding** — Forward specific domains to upstream DNS

### Captive Portal DNS Redirect
When a guest connects and opens any URL:
1. DNS intercepts the request
2. Redirects to the captive portal login page
3. After authentication, DNS returns to normal resolution

## Firewall Configuration

### Firewall Rules
Navigate to **WiFi > Firewall & Bandwidth > Firewall** (\`firewall-page.tsx\`):

The system uses **nftables** (\`lib/nftables-helper.ts\`) for rule management:

**Rule Types:**
- **Allow** — Permit traffic matching criteria
- **Deny** — Block traffic matching criteria
- **Rate Limit** — Limit connection rate
- **NAT** — Network address translation

**Rule Properties:**
- Source/destination IP, port, protocol
- Time-based schedules (\`firewall-schedule.tsx\`)
- Zone assignments (\`firewall-zone.tsx\`)
- MAC filtering rules

**Firewall Zones:**
- Guest network (isolated)
- Staff network (internal access)
- Management network (admin only)
- IoT network (device communication)

## Bandwidth Management

### Bandwidth Policies
Configure in **WiFi > Firewall & Bandwidth**:
- **Per-Plan Limits** — Download/upload speed per WiFi plan
- **Per-User Limits** — Individual user quotas
- **Pool Management** — Shared bandwidth pools
- **Smart Bandwidth** — AI-optimized bandwidth allocation

### Bandwidth Policies Detail
Navigate to **WiFi > Firewall & Bandwidth > BW Policies** (\`bw-policy-details.tsx\`):
- Download/upload rate limits
- Burst allowance
- Priority queuing
- Application-aware shaping (video, streaming, VoIP)

### Fair Access Policy (FUP)
Configure daily/monthly data allowances (\`fup-policy.tsx\`):
- Data threshold per plan
- Action when exceeded (throttle, block, charge)
- Reset schedule
- Dashboard monitoring (\`fup-dashboard.tsx\`)

## Network Interfaces

### Interface Management
The network module (\`lib/network/\`) manages interfaces via NetworkManager (nmcli):
- Physical Ethernet interfaces
- VLAN interfaces
- Bridge interfaces
- Bond interfaces (link aggregation)
- Aliases (multiple IPs per interface)

### Multi-WAN Configuration
Configure multiple internet uplinks (\`multi-wan-config.tsx\`):
- Primary and backup WAN
- Automatic failover on link failure
- Load balancing across WAN links
- WAN health monitoring

## Related Components
- \`dhcp-page.tsx\` — DHCP server configuration
- \`dns-page.tsx\` — DNS management
- \`firewall-page.tsx\` — Firewall rules
- \`network-page.tsx\` — Interface management
- \`bw-policy-details.tsx\` — Bandwidth policies
- \`fup-dashboard.tsx\` — Fair usage monitoring`,
  },

  // ── POS ────────────────────────────────────────────────────────────────────
  {
    title: 'Restaurant POS & Kitchen Display System',
    slug: 'restaurant-pos-guide',
    excerpt: 'Manage restaurant orders, kitchen display (KDS), menu management, and room service integration.',
    category: 'pos',
    tags: '["pos","restaurant","orders","kds","kitchen","menu"]',
    viewCount: 298,
    helpfulCount: 27,
    content: `# Restaurant POS & Kitchen Display System

The Restaurant & POS module provides a complete food and beverage management system integrated with the hotel's guest billing.

## Order Management

### Creating Orders
Navigate to **Restaurant & POS > Orders** (\`orders.tsx\`):

**Order Types:**
- **Dine-In** — Restaurant table orders
- **Room Service** — Guest room delivery (auto-posts to folio)
- **Takeaway** — Pickup orders
- **Bar** — Bar orders

**Order Flow:**
\`\`\`
Create Order → Add Items → Send to Kitchen → Kitchen Prep → Ready → Served → Paid
\`\`\`

### Order Features
- **Table Assignment** — Link order to restaurant table
- **Guest Link** — Link to guest folio for room charges
- **Order Splitting** — Split items across multiple bills (\`order-split.tsx\`)
- **Item Notes** — Special preparation instructions
- **Order Discounts** — Apply percentage or fixed discounts

## Kitchen Display System (KDS)

### Real-Time Kitchen View
Navigate to **Restaurant & POS > Kitchen** (\`kitchen-display.tsx\`):
- **Order Queue** — New orders appear in real-time
- **Preparation Timer** — Time since order was placed
- **Priority Indicators** — Rush orders highlighted
- **Item Status** — Pending → Preparing → Ready → Served
- **Sound/Visual Alerts** — New order notifications

### KDS Features
- Bump button to dismiss completed items
- Item-level status tracking
- Course grouping (starters, mains, desserts)
- Allergen alerts
- Special instruction display

## Menu Management

### Menu Structure
Navigate to **Restaurant & POS > Menu Management** (\`menu-management.tsx\`):

**Menu Categories** (\`order-category.tsx\`):
- Starters, Mains, Desserts, Beverages, etc.
- Custom categories per restaurant/outlet

**Menu Items** (\`menu-items/\`):
- Item name, description, price
- Category assignment
- Availability toggle (86'd items)
- Image upload (\`menu-image-upload.tsx\`)
- Recipe link for cost tracking

**Menu Modifiers** (\`menu-modifiers.tsx\`):
- Size options (small, regular, large)
- Temperature (hot, cold, ice)
- Extra/minus ingredients
- Each modifier can have price impact

**Menu Variants** (\`menu-variants.tsx\`):
- Combo meals
- Set menus
- Prix fixe options

## Table Management

### Table Layout
Navigate to **Restaurant & POS > Tables > Table Layout** (\`table-layout.tsx\`):
- Visual restaurant floor plan
- Drag-and-drop table placement
- Table capacity (covers)
- Table status (available, occupied, reserved)
- Table merge support (\`table-merge.tsx\`)

### Reservations
Manage table reservations in **Restaurant & POS > Reservations**:
- Date/time, party size
- Table assignment
- Special requests
- Confirmation and reminders

## Room Service Integration

### Auto-Folio Posting
When a room service order is created:
1. Items selected from room service menu
2. Order sent to kitchen via KDS
3. After delivery confirmation, charges auto-posted to guest folio
4. Guest sees charges on their in-room TV/portal

### Room Service Workflow
\`\`\`
Guest Orders → Kitchen Prep → Delivery → Confirm → Auto-Post to Folio
\`\`\`

## Restaurant Reports

Navigate to **Restaurant & POS > Reports** (\`restaurant-reports.tsx\`):
- Sales by period, category, item
- Average check size
- Table turnover rate
- Popular items ranking
- Staff performance

## Related Components
- \`orders.tsx\` — Order management
- \`kitchen-display.tsx\` — Kitchen display system
- \`menu-management.tsx\` — Menu configuration
- \`table-layout.tsx\` — Table management
- \`room-service.tsx\` — Room service integration
- \`billing.tsx\` — Restaurant billing`,
  },

  // ── Experience ─────────────────────────────────────────────────────────────
  {
    title: 'Guest Communication & Digital Keys',
    slug: 'guest-communication-digital-keys',
    excerpt: 'Set up guest chat, unified inbox, digital key QR codes, and in-room portal.',
    category: 'experience',
    tags: '["communication","chat","digital-keys","in-room-portal","experience"]',
    viewCount: 267,
    helpfulCount: 23,
    content: `# Guest Communication & Digital Keys

The Guest Experience module enhances the guest journey with communication tools, digital access, and self-service capabilities.

## Guest Chat System

### Guest-Facing Chat
The chat system (\`guest-chat.tsx\`) enables:
- **Real-time messaging** — Between guests and hotel staff
- **Multi-channel** — In-app, web portal, SMS bridge
- **File Sharing** — Photos and documents via \`chat-attachment-button.tsx\`
- **Chat Transfer** — Transfer to specialized departments (\`chat-transfer.tsx\`)

### Unified Inbox (Staff Side)
Navigate to **Guest Experience > Unified Inbox** (\`unified-inbox.tsx\`):
- All guest conversations in one place
- Assign to staff members
- Set priority and status
- Quick reply templates
- Auto-assignment based on conversation topic

### Communication Infrastructure
Built on Socket.io for real-time messaging:
- \`ChatConversation\` — Conversation metadata
- \`ChatMessage\` — Individual messages
- \`ChatAttachment\` — File attachments
- \`ChatTransfer\` — Transfer history

## Digital Keys

### QR Code Keys
Navigate to **Guest Experience > Digital Keys** (\`digital-keys.tsx\`):
- Generate unique QR code per guest per stay
- QR code sent via email or in-app
- Scan at electronic door lock to enter
- Auto-expire at check-out time

### Key Management Features (\`digital-key-qr.tsx\`):
- **Access Levels** — Room only, room + gym, full access
- **Time Windows** — Valid during stay dates
- **Multiple Devices** — Allow guest to register multiple phones
- **Revocation** — Instantly revoke lost device access
- **Access Logs** — Track all key usages (\`DigitalKeyAccessLog\`)

## In-Room Portal

### Guest Self-Service Portal
Navigate to **Guest Experience > In-Room Portal** (\`in-room-portal.tsx\`):

The portal accessible via guest's device or in-room tablet provides:
- **View Folio** — Current charges and balance
- **Order Room Service** — F&B ordering
- **Request Services** — Housekeeping, maintenance, amenities
- **Hotel Information** — Facilities, hours, local attractions
- **Checkout** — Express checkout request
- **Feedback** — In-stay survey

### Portal Configuration
- Branding and theme customization
- Feature toggle per property
- Language support (18+ languages)
- API integration with booking engine

## Service Requests

### Request Management
Navigate to **Guest Experience > Service Requests** (\`service-requests.tsx\`):
- **Request Types** — Housekeeping, maintenance, F&B, transport, other
- **Priority Levels** — Low, medium, high, urgent
- **Assignment** — Auto or manual staff assignment
- **Status Tracking** — New → Assigned → In Progress → Completed
- **SLA Tracking** — Response and resolution time targets
- **Guest Notification** — Auto-update when status changes

## Related Components
- \`guest-chat.tsx\` — Guest-facing chat
- \`unified-inbox.tsx\` — Staff inbox
- \`digital-keys.tsx\` — Key management
- \`in-room-portal.tsx\` — In-room portal config
- \`service-requests.tsx\` — Service request tracking`,
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  {
    title: 'Reports & Business Analytics Guide',
    slug: 'reports-and-analytics-guide',
    excerpt: 'Master StaySuite reporting: revenue reports, occupancy analytics, custom reports, and scheduled delivery.',
    category: 'reports',
    tags: '["reports","analytics","revenue","occupancy","adr","revpar"]',
    viewCount: 378,
    helpfulCount: 33,
    content: `# Reports & Business Analytics Guide

The Reports module provides comprehensive business intelligence with 15+ report types, custom report builder, and automated delivery.

## Key Performance Metrics

### Understanding Hotel KPIs
- **ADR (Average Daily Rate)** — Total room revenue / number of rooms sold
- **RevPAR (Revenue Per Available Room)** — ADR × Occupancy Rate
- **GOPPAR (Gross Operating Profit Per Available Room)** — GOP / available rooms
- **TRevPAR (Total Revenue Per Available Room)** — Total revenue / available rooms

## Available Report Types

### Revenue Reports (\`revenue-reports.tsx\`)
- Daily/weekly/monthly revenue summary
- Revenue by source (direct, OTA, corporate, group)
- Revenue by room type
- Revenue vs. forecast comparison
- Revenue trend analysis

### Occupancy Reports (\`occupancy-reports.tsx\`)
- Occupancy rate by period
- Occupancy by room type
- Occupancy forecast vs. actual
- Pick-up analysis (bookings by arrival date)
- Denial and turnaway tracking

### ADR & RevPAR Analysis (\`adr-revpar.tsx\`)
- ADR by market segment
- RevPAR index vs. competitive set
- Rate variance analysis
- Yield management metrics

### Guest Analytics (\`guest-analytics-reports.tsx\`)
- Guest demographics
- Geographic origin analysis
- Booking lead time distribution
- Length of stay distribution
- Guest lifetime value ranking

### Staff Performance (\`staff-performance.tsx\`)
- Tasks completed per staff member
- Response time analysis
- Guest satisfaction scores by staff
- Attendance and shift compliance

## Custom Report Builder

### Building Custom Reports
Navigate to **Reports & BI > Custom Reports**:
1. Select data sources (bookings, revenue, guests, etc.)
2. Choose dimensions (date, room type, channel, etc.)
3. Select metrics (count, sum, average, percentage)
4. Apply filters (date range, status, etc.)
5. Choose visualization type (table, chart, graph)
6. Save and name your custom report

## Report Export

### Export Formats
All reports support export to:
- **PDF** — Formatted for printing
- **Excel (XLSX)** — For further analysis
- **CSV** — Universal format

### Export Features
- Date range selection
- Column customization
- Branding header/footer
- Automated export via API

## Scheduled Reports

### Automated Delivery
Navigate to **Reports & BI > Scheduled Reports** (\`scheduled-reports.tsx\`):
- Create delivery schedules (daily, weekly, monthly)
- Select recipients (email addresses)
- Choose report type and parameters
- Format selection (PDF/Excel/CSV)
- Delivery time and timezone

### Report Caching
Reports are cached (\`ReportCache\` model) for performance:
- Pre-generated for frequently accessed reports
- Auto-refresh on schedule
- Manual cache clear option

## Report History
All generated reports are tracked (\`ReportHistory\` model):
- Who generated and when
- Parameters used
- Export format
- Delivery status

## API Access
Reports can be accessed programmatically via the API:
- \`/api/reports/*\` — All report endpoints
- \`/api/dashboard/*\` — Dashboard data
- Versioned API at \`/api/v1/reports/*\`

This enables integration with external BI tools like Power BI, Tableau, or Google Data Studio.

## Related Components
- \`revenue-reports.tsx\` — Revenue analysis
- \`occupancy-reports.tsx\` — Occupancy metrics
- \`adr-revpar.tsx\` — ADR/RevPAR analysis
- \`guest-analytics-reports.tsx\` — Guest demographics
- \`scheduled-reports.tsx\` — Automated delivery
- \`report-export-button.tsx\` — Export utility`,
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    title: 'CRM Campaigns & Guest Segmentation',
    slug: 'crm-campaigns-segmentation',
    excerpt: 'Create guest segments, run targeted campaigns, AB test, and manage loyalty programs.',
    category: 'crm',
    tags: '["crm","campaigns","segments","marketing","ab-test","loyalty"]',
    viewCount: 189,
    helpfulCount: 17,
    content: `# CRM Campaigns & Guest Segmentation

The CRM module enables data-driven guest relationship management through segmentation, targeted campaigns, and loyalty tracking.

## Guest Segmentation

### Creating Segments
Navigate to **CRM & Marketing > Guest Segments** (\`guest-segments.tsx\`):

**Segment Criteria:**
- **Demographic** — Country, age group, language
- **Behavioral** — Booking frequency, spending level, length of stay
- **Preferences** — Room type preference, dietary needs
- **Loyalty** — Tier level, points balance
- **Status** — Active, inactive, VIP, corporate

### Segment Evaluation Engine
The segment evaluator (\`lib/crm/segment-evaluator.ts\`) automatically:
- Evaluates guest membership in real-time
- Adds/removes guests as criteria change
- Supports AND/OR/NOT logic combinations
- Updates segment counts

### Pre-built Segments
- High-value guests (top 10% spending)
- Frequent travelers (5+ stays per year)
- At-risk guests (no booking in 6+ months)
- New guests (first visit)
- Corporate accounts

## Campaign Management

### Creating Campaigns
Navigate to **CRM & Marketing > Campaigns** (\`campaigns.tsx\`):

1. **Campaign Name** — Descriptive identifier
2. **Target Segment** — Select from guest segments
3. **Channel** — Email, SMS, or both
4. **Template** — Select or create message template
5. **Schedule** — One-time or recurring
6. **Content** — Personalized with dynamic variables:
   - \`{{guest_name}}\` — Guest first name
   - \`{{room_number}}\` — Assigned room
   - \`{{check_in_date}}\` — Arrival date
   - \`{{wifi_password}}\` — WiFi credentials
   - \`{{booking_id}}\` — Confirmation number

### AB Testing
The AB test manager (\`ab-test-manager.tsx\`) enables:
- Create test variants (subject, content, timing)
- Split audience randomly (50/50 or custom)
- Track open rates, click rates, conversions
- Auto-promote winning variant
- Statistical significance calculation

### Campaign Analytics
- Delivery rate
- Open rate
- Click-through rate
- Conversion rate (bookings attributed)
- Revenue generated
- Unsubscribe rate

## Loyalty Program Integration

### Segment by Loyalty Tier
Create segments based on loyalty data:
- Platinum members for exclusive offers
- Silver members for upgrade promotions
- Non-members for enrollment campaigns

### Retention Analytics
Navigate to **CRM & Marketing > Retention Analytics** (\`retention-analytics.tsx\`):
- Repeat booking rate by segment
- Average time between stays
- Churn prediction model
- Win-back campaign effectiveness

## Feedback & Reviews
Navigate to **CRM & Marketing > Feedback & Reviews** (\`feedback-reviews.tsx\`):
- Aggregate guest satisfaction scores
- Trend analysis over time
- Response rate tracking
- Negative review alert system
- Integration with reputation management module

## Related Components
- \`guest-segments.tsx\` — Segment management
- \`campaigns.tsx\` — Campaign creation
- \`ab-test-manager.tsx\` — AB testing
- \`loyalty-programs.tsx\` — Loyalty configuration
- \`retention-analytics.tsx\` — Retention metrics`,
  },

  // ── Automation ────────────────────────────────────────────────────────────
  {
    title: 'Workflow Builder & Automation Rules',
    slug: 'workflow-builder-guide',
    excerpt: 'Create automated workflows with the visual workflow builder, rules engine, and execution logging.',
    category: 'automation',
    tags: '["automation","workflow","rules","triggers","actions"]',
    viewCount: 201,
    helpfulCount: 19,
    content: `# Workflow Builder & Automation Rules

The Automation module allows you to create intelligent workflows that reduce manual work and improve operational consistency.

## Workflow Builder

### Creating a Workflow
Navigate to **Automation > Workflow Builder** (\`workflow-builder.tsx\`):

**Step 1: Choose a Trigger**
Events that start the workflow:
- **Booking Created** — New reservation made
- **Booking Modified** — Existing booking changed
- **Check-In** — Guest arrives
- **Check-Out** — Guest departs
- **Payment Received** — Payment processed
- **Housekeeping Complete** — Room cleaned
- **Scheduled Time** — Cron-based trigger
- **Custom Event** — Any system event via webhook

**Step 2: Define Conditions**
Filter when the workflow should run:
- Room type equals "Suite"
- Booking source is "Direct"
- Booking amount > $500
- Guest is VIP
- Date is within specific range

**Step 3: Add Actions**
What happens when conditions are met:
- **Send Email** — To guest or staff
- **Send SMS** — Text notification
- **Create Task** — Assign housekeeping/maintenance
- **Update Status** — Change booking or room status
- **Post Charge** — Add folio line item
- **Call Webhook** — External system notification
- **Wait** — Delay before next action
- **Branch** — Conditional logic paths

**Step 4: Configure & Activate**
- Name and describe the workflow
- Set to active/inactive
- Test with sample data
- Monitor execution logs

## Rules Engine

### Rule Configuration
Navigate to **Automation > Rules Engine** (\`rules-engine.tsx\`):
- **Rule Name** — Descriptive identifier
- **Event Type** — Which event triggers evaluation
- **Conditions** — Boolean logic (AND/OR/NOT)
- **Priority** — Evaluation order
- **Actions** — One or more actions to execute

### Pre-Built Automation Templates
Navigate to **Automation > Templates** (\`templates.tsx\`):
- "Welcome Email on Booking" — Auto-send confirmation
- "Pre-Arrival Reminder" — 24h before check-in
- "Post-Checkout Thank You" — After departure
- "Housekeeping Auto-Assign" — On check-out
- "No-Show Detection" — After check-in deadline
- "Rate Adjustment" — Based on occupancy thresholds

## Execution Monitoring

### Execution Logs
Navigate to **Automation > Execution Logs** (\`execution-logs.tsx\`):
- Every workflow execution is logged (\`AutomationExecutionLog\`)
- Status: Success, Failed, Pending
- Execution time and duration
- Input data and output results
- Error details for failed executions

### Performance Metrics
- Workflow execution count
- Success/failure rate
- Average execution time
- Most triggered workflows

## Cross-Module Integration

Automation connects to all StaySuite modules:
- **Bookings** — Status changes, reminders, follow-ups
- **Housekeeping** — Task creation, status updates
- **Billing** — Auto-charges, invoice generation
- **Notifications** — Email, SMS, push notifications
- **CRM** — Segment updates, campaign triggers
- **Channels** — Rate/inventory sync triggers

## Related Components
- \`workflow-builder.tsx\` — Visual workflow editor
- \`rules-engine.tsx\` — Rule configuration
- \`templates.tsx\` — Pre-built templates
- \`execution-logs.tsx\` — Execution monitoring`,
  },

  // ── Integrations ───────────────────────────────────────────────────────────
  {
    title: 'Payment Gateway Integration Guide',
    slug: 'payment-gateway-integration',
    excerpt: 'Set up Stripe, PayPal, Razorpay, and UPI payment gateways for processing guest payments.',
    category: 'integrations',
    tags: '["payments","stripe","paypal","razorpay","upi","gateway"]',
    viewCount: 334,
    helpfulCount: 30,
    content: `# Payment Gateway Integration Guide

StaySuite provides a unified payment interface that connects to multiple payment gateways through a provider registry pattern.

## Supported Gateways

### 1. Stripe
- Credit and debit cards (Visa, Mastercard, Amex)
- Apple Pay, Google Pay
- Stripe Terminal for in-person payments
- Automatic PCI compliance handling

### 2. PayPal
- PayPal account payments
- Linked credit/debit cards
- PayPal Pay Later
- International payment support

### 3. Razorpay
- Indian payment methods
- UPI, net banking, wallets
- Razorpay recurring subscriptions
- International card support

### 4. UPI (Unified Payments Interface)
- Direct UPI payment
- QR code scanning
- Intent-based flow
- Instant settlement

### 5. Manual/Cash
- Track cash payments
- Bank transfer tracking
- Offline payment recording

## Configuration

### Setting Up a Gateway
Navigate to **Settings > Integrations > Payment Gateways**:

1. Click "Add Gateway"
2. Select provider (Stripe/PayPal/Razorpay)
3. Enter credentials:
   - **Stripe**: Publishable key, Secret key, Webhook secret
   - **PayPal**: Client ID, Client Secret, Sandbox toggle
   - **Razorpay**: Key ID, Key Secret
4. Configure settings:
   - Currency support
   - Auto-capture vs. manual capture
   - Webhook URL for async notifications
   - Refund policy
5. Test with a small transaction
6. Enable for production

## Payment Flow Architecture

### Provider Registry Pattern
The payment system (\`lib/payments/\`) uses a registry pattern:
- \`PaymentGateway\` interface defines standard methods
- Each provider implements the interface
- Gateway selection based on booking/payment configuration

### Transaction Flow
\`\`\`
1. Initiate payment → 2. Create payment intent → 3. Redirect/authenticate 
→ 4. Process payment → 5. Receive webhook → 6. Update folio/balance
\`\`\`

### Payment Tokens
Sensitive payment data is stored as tokens (\`PaymentToken\` model):
- Card tokenization for repeat payments
- Secure storage, PCI DSS compliant
- One-click payment for returning guests

## Multi-Currency

### Currency Support
Each gateway supports different currencies:
- **Stripe**: 135+ currencies
- **PayPal**: 200+ countries
- **Razorpay**: INR and international

### Exchange Rate Handling
When guest pays in foreign currency:
1. Base rate in property currency
2. Exchange rate applied (\`ExchangeRate\` model)
3. Guest charged in their currency
4. Folio tracks both amounts
5. Reconciliation in base currency

## Webhooks & Async Processing

### Payment Webhooks
Each gateway sends async notifications:
- Payment success/failure
- Refund processed
- Subscription renewal
- Dispute/chargeback

Webhooks are received at \`/api/payments/webhook/[provider]\` and update:
- Payment status
- Folio balance
- Booking status
- Notification to guest

## Security & Compliance

- **PCI DSS Level 1** — Handled by Stripe
- **Encryption** — All sensitive data encrypted at rest (\`lib/encryption.ts\`)
- **Audit Trail** — Every payment action logged
- **Tokenization** — No raw card data stored

## Related Components
- \`payment-gateways.tsx\` — Gateway management
- \`payment-gateways-page.tsx\` — Gateway configuration UI
- \`payment-gateways-enhanced.tsx\` — Advanced settings
- \`payments.tsx\` — Payment processing
- \`payment-plans.tsx\` — Payment plan management`,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    title: 'System Settings & GDPR Compliance',
    slug: 'system-settings-and-gdpr',
    excerpt: 'Configure tax rates, currency, localization, feature flags, security settings, and GDPR data protection.',
    category: 'settings',
    tags: '["settings","tax","currency","gdpr","security","localization"]',
    viewCount: 245,
    helpfulCount: 22,
    content: `# System Settings & GDPR Compliance

The Settings module controls the core configuration of your StaySuite instance, from tax and currency to GDPR compliance and security.

## General Settings

### Property Configuration
Navigate to **Settings > General** (\`general.tsx\`):
- Property name and contact details
- Check-in/check-out times
- Timezone configuration
- Logo and branding
- Communication preferences

## Tax & Currency

### Tax Configuration
Navigate to **Settings > Tax & Currency** (\`tax-currency.tsx\`):

**Tax Rates:**
- Create tax rates (VAT, GST, city tax, etc.)
- Set default tax rate
- Configure compound tax rules
- Tax-inclusive vs. tax-exclusive pricing
- Tax exemption rules per rate plan

**Currency Setup:**
- Base currency selection
- Decimal precision
- Currency symbol and format
- Exchange rate configuration

## Localization

### Language & Locale
Navigate to **Settings > Localization** (\`localization.tsx\`):
- **Supported Languages** — 18 languages available via next-intl
- **Default Language** — Fallback language
- **Date Format** — MM/DD/YYYY vs DD/MM/YYYY
- **Time Format** — 12h vs 24h
- **Number Format** — Thousand separators, decimal symbols

### Translation Management
StaySuite uses \`messages/*.json\` files for translations:
- Add/modify translations per language
- Fallback to English for missing translations
- RTL (Right-to-Left) language support

## Feature Flags

### Feature Toggle System
Navigate to **Settings > Feature Flags** (\`feature-flags.tsx\`):

Control which modules are active:
- **Base Modules** — Always enabled (Dashboard, PMS, Bookings, etc.)
- **Addon Modules** — Toggled per tenant/property
  - WiFi, POS, Revenue, Channels, CRM, Events, IoT, etc.

Feature flags are evaluated via \`lib/feature-flags.ts\`:
- Server-side evaluation in API routes
- Client-side evaluation via \`FeatureGuard\` component
- Per-tenant configuration

## Security Settings

### Security Configuration
Navigate to **Settings > Security** (\`security.tsx\`):
- **Password Policy** — Minimum length, complexity requirements
- **Session Timeout** — Auto-logout after inactivity
- **IP Whitelist** — Restrict admin access to specific IPs
- **Audit Logging** — Enable/disable activity logging
- **Encryption Settings** — Data encryption configuration

### Device Sessions
Monitor and manage active sessions:
- View all logged-in devices
- Force logout remote sessions
- Session history and geo-location

## GDPR Compliance

### Data Protection Setup
Navigate to **Settings > GDPR Compliance** (\`gdpr-manager.tsx\`):

**Consent Management:**
- Configure consent types (marketing, analytics, essential)
- Consent collection points (booking form, check-in)
- Consent withdrawal workflow
- Consent records stored in \`ConsentRecord\` model

**Data Subject Rights:**
- **Right to Access** — Export all guest data
- **Right to Rectification** — Correct inaccurate data
- **Right to Erasure** — Delete guest data ("right to be forgotten")
- **Right to Portability** — Export in machine-readable format

**GDPR Service** (\`lib/gdpr/gdpr-service.ts\`):
- Handles data export requests
- Performs data anonymization
- Manages data deletion workflows
- Ensures compliance audit trail

**GDPR Requests** tracked in \`GDPRRequest\` model:
- Request type (access, deletion, correction)
- Status (pending, processing, completed)
- Requested data scope
- Completion timestamp

## License Management

Navigate to **Settings > License Keys** (\`license-keys.tsx\`):
- Manage software license keys
- Track license validity and usage
- Seat-based licensing

## Related Components
- \`general.tsx\` — General settings
- \`tax-currency.tsx\` — Tax and currency
- \`localization.tsx\` — Language settings
- \`feature-flags.tsx\` — Module toggles
- \`security.tsx\` — Security configuration
- \`gdpr-manager.tsx\` — GDPR compliance`,
  },

  // ── Additional Articles ───────────────────────────────────────────────────
  {
    title: 'Multi-Property Chain Management',
    slug: 'chain-management-guide',
    excerpt: 'Manage multiple properties, brand standards, cross-property analytics, and centralized operations.',
    category: 'admin',
    tags: '["chain","multi-property","brand","analytics","centralized"]',
    viewCount: 156,
    helpfulCount: 14,
    content: `# Multi-Property Chain Management

StaySuite supports multi-property and hotel chain operations with centralized management and cross-property analytics.

## Chain Dashboard

### Overview
Navigate to **Chain Management > Chain Dashboard** (\`chain-dashboard.tsx\`):
- **Portfolio Overview** — All properties at a glance
- **Consolidated KPIs** — Total occupancy, revenue, ADR across properties
- **Property Comparison** — Side-by-side performance comparison
- **Brand Standards** — Compliance tracking per property

## Brand Management

### Brand Configuration
Navigate to **Chain Management > Brand Management** (\`brand-management.tsx\`):
- Create brands with visual identity (logo, colors, fonts)
- Define brand standards (service levels, amenity requirements)
- Assign properties to brands
- Brand-specific rate plans and packages

## Cross-Property Analytics

### Consolidated Reporting
Navigate to **Chain Management > Cross-Property Analytics** (\`cross-property-analytics.tsx\`):
- **Revenue Comparison** — Revenue by property, trend analysis
- **Occupancy Benchmarking** — Property vs. chain average
- **Guest Flow Analysis** — Guest movement between properties
- **Market Share** — Chain performance vs. market

## Tenant Architecture

### Multi-Tenancy Model
StaySuite uses tenant isolation:
- **Tenant** — Represents a company/chain
- **Property** — Individual hotel within a tenant
- **User** — Staff member with tenant and property access

### Data Isolation
Every database record includes \`tenantId\`:
- Complete data separation between tenants
- Shared infrastructure, isolated data
- Platform admin can view all tenants
- Property-level access restriction

## Platform Administration

### Admin Module
Navigate to **Admin > Tenant Management** (\`tenant-management.tsx\`):
- Create and manage tenants
- Configure tenant settings
- Monitor tenant health
- Usage tracking and billing

### User Management
- Cross-property user management
- Role assignment per property
- Permission inheritance from tenant to property
- Activity audit trail`,
  },

  {
    title: 'Staff Scheduling & Attendance Tracking',
    slug: 'staff-scheduling-attendance',
    excerpt: 'Create shift schedules, track attendance, manage leave, and monitor staff performance.',
    category: 'staff',
    tags: '["staff","scheduling","attendance","shifts","leave","performance"]',
    viewCount: 198,
    helpfulCount: 18,
    content: `# Staff Scheduling & Attendance Tracking

The Staff Management module handles workforce planning, time tracking, and performance monitoring.

## Shift Scheduling

### Creating Schedules
Navigate to **Staff Management > Shift Scheduling** (\`shift-scheduling.tsx\`):

**Schedule Types:**
- **Fixed Schedule** — Regular weekly pattern
- **Rotating Schedule** — Cycling shift patterns
- **On-Call** — Available but not scheduled
- **Split Shift** — Two work periods in one day

**Features:**
- Visual calendar drag-and-drop scheduling
- Shift templates for quick creation
- Conflict detection (double booking)
- Minimum staffing level alerts
- Overtime tracking
- Shift swap requests

## Attendance Tracking

### Clock In/Out
Navigate to **Staff Management > Attendance** (\`attendance-tracking.tsx\`):
- **Manual Clock** — Staff clock in/out via app
- **Geo-fencing** — Clock in only at property location
- **Biometric** — Fingerprint/face recognition integration
- **Auto-clock** — Based on shift schedule

### Attendance Reports
- Daily attendance summary
- Late arrivals and early departures
- Absence tracking
- Overtime hours
- Attendance trend analysis

## Leave Management

### Leave Requests
Navigate to **Staff Management > Leave** (\`leave-management.tsx\`):
- Submit leave requests with date range and reason
- Approval workflow (manager → HR)
- Leave balance tracking
- Holiday calendar integration
- Leave types (vacation, sick, personal, maternity)

## Performance Metrics

### Staff Performance Dashboard
Navigate to **Staff Management > Performance** (\`performance/\`):
- **Task Completion Rate** — Tasks completed vs. assigned
- **Response Time** — Average time to accept/complete tasks
- **Guest Satisfaction** — Ratings from guest feedback
- **Attendance Score** — Based on punctuality and presence
- **Skills & Certifications** — Track certifications and training

### Skills Management
Navigate to **Staff Management > Skills** (\`skills-management.tsx\`):
- Define required skills per role
- Track staff certifications
- Expiry alerts for certifications
- Training assignment

## Internal Communication

### Staff Channels
Navigate to **Staff Management > Communication** (\`staff/channels/\`):
- Create communication channels (department, project, shift)
- Real-time messaging via Socket.io
- File and media sharing
- Message history and search

## Related Database Models
- \`StaffSchedule\`, \`StaffShift\`, \`StaffAttendance\`
- \`StaffPerformance\`, \`StaffSkill\`, \`StaffWorkload\`
- \`StaffLeave\`, \`StaffChannel\`, \`Task\``,
  },
];

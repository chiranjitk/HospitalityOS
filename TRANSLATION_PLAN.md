# StaySuite HospitalityOS — Full i18n Translation Plan

> **Status**: Rate limit was active (429). This file is a complete reference so any agent can resume and finish the work.
> **Last Updated**: 2025-04-29
> **Project**: `/home/z/my-project/StaySuite-HospitalityOS/`
> **Locale Files**: `src/messages/{en,ar,bn,de,es,fr,gu,hi,ja,ml,mr,pt,ta,te,zh}.json`
> **Source of Truth**: `src/messages/en.json` (338 flattened keys)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current Coverage Summary](#2-current-coverage-summary)
3. [Work Breakdown Per Language](#3-work-breakdown-per-language)
4. [All 338 English Keys (Source of Truth)](#4-all-338-english-keys-source-of-truth)
5. [Extra Keys in Locales (Not in en.json)](#5-extra-keys-in-locales-not-in-enjson)
6. [Known Issues & Patterns](#6-known-issues--patterns)
7. [Step-by-Step Execution Plan](#7-step-by-step-execution-plan)
8. [Translation Quality Checklist](#8-translation-quality-checklist)

---

## 1. Architecture Overview

- **i18n Library**: `next-intl`
- **Locale Routing**: Middleware handles `[locale]` prefix (e.g., `/en/dashboard`, `/hi/dashboard`)
- **Message Resolution**: `next-intl` resolves keys via `useTranslations()` hook
- **Key Format**: Nested dot-notation (e.g., `navigation.dashboard`, `common.save`)
- **Dynamic Keys**: Some components construct keys at runtime:
  - `t((key + 'Tooltip') as string)` — room status tooltips
  - `t(labelMap[variant])` — dynamic status labels (e.g., `inProgress` → `'active'`)

---

## 2. Current Coverage Summary

### Overall Status

| # | Language | Code | Total Keys | Translated | Missing from en | Extra (locale-only) | Still English | Coverage | Work Remaining |
|---|----------|------|------------|------------|-----------------|---------------------|---------------|----------|----------------|
| 1 | English | `en` | 338 | 338 | 0 | 0 | 0 | **100%** | 0 |
| 2 | Arabic | `ar` | 94 | 94 | 247 | 3 | 0 | **100%** of existing | 247 |
| 3 | Bengali | `bn` | 385 | 385 | 115 | 162 | 0 | **100%** of existing | 115 |
| 4 | German | `de` | 94 | 89 | 247 | 3 | 5 | **94.7%** | 252 |
| 5 | Spanish | `es` | 338 | 327 | 0 | 0 | 11 | **96.7%** | 11 |
| 6 | French | `fr` | 338 | 319 | 0 | 0 | 19 | **94.4%** | 19 |
| 7 | Gujarati | `gu` | 91 | 91 | 250 | 3 | 0 | **100%** of existing | 250 |
| 8 | Hindi | `hi` | 338 | 336 | 0 | 0 | 2 | **99.4%** | 2 |
| 9 | Japanese | `ja` | 94 | 94 | 247 | 3 | 0 | **100%** of existing | 247 |
| 10 | Malayalam | `ml` | 91 | 91 | 250 | 3 | 0 | **100%** of existing | 250 |
| 11 | Marathi | `mr` | 91 | 91 | 250 | 3 | 0 | **100%** of existing | 250 |
| 12 | Portuguese | `pt` | 94 | 93 | 247 | 3 | 1 | **98.9%** | 248 |
| 13 | Tamil | `ta` | 338 | 336 | 0 | 0 | 2 | **99.4%** | 2 |
| 14 | Telugu | `te` | 338 | 336 | 0 | 0 | 2 | **99.4%** | 2 |
| 15 | Chinese | `zh` | 94 | 94 | 247 | 3 | 0 | **100%** of existing | 247 |

### Key Metrics

- **Total translations needed**: ~2,343 key-language pairs
- **Languages with zero work needed**: 0 (all need something)
- **Languages nearly done** (≤5 keys): `hi` (2), `ta` (2), `te` (2), `es` (11)
- **Languages with major gaps** (≥200 keys): `ar` (247), `de` (252), `gu` (250), `ja` (247), `ml` (250), `mr` (250), `pt` (248), `zh` (247), `bn` (115)
- **Category A — Only need translation** (keys exist, values are English): `de` (5), `es` (11), `fr` (19), `pt` (1), `hi` (2), `ta` (2), `te` (2)
- **Category B — Need to add missing keys from en.json**: `ar` (247), `bn` (115), `de` (247), `gu` (250), `ja` (247), `ml` (250), `mr` (250), `pt` (247), `zh` (247)

### Priority Order (Recommended)

1. **Tier 1 — Quick Wins** (~37 total translations): `hi` (2), `ta` (2), `te` (2), `pt` (1), `de` (5), `es` (11), `fr` (19)
2. **Tier 2 — Bengali** (115 missing keys — already has the most locale-only keys at 162)
3. **Tier 3 — Major Gaps** (~2,192 total): `ar`, `de` (remaining 247), `gu`, `ja`, `ml`, `mr`, `pt` (remaining 247), `zh`

---

## 3. Work Breakdown Per Language

### 3.1 Hindi (`hi`) — 2 keys remaining

**Type**: Only need translation (keys exist, value is English)

| Key | English Value | Needed Hindi Translation |
|-----|---------------|-------------------------|
| `navigation.crs` | "CRS" | "सीआरएस" or "केंद्रीय आरक्षण प्रणाली" |
| `navigation.webhooks` | "Webhooks" | "वेबहुक" |

### 3.2 Tamil (`ta`) — 2 keys remaining

**Type**: Only need translation

| Key | English Value | Needed Tamil Translation |
|-----|---------------|--------------------------|
| `navigation.adrRevpar` | "ADR & RevPAR" | Need translation |
| `navigation.crs` | "CRS" | Need translation |

### 3.3 Telugu (`te`) — 2 keys remaining

**Type**: Only need translation

| Key | English Value | Needed Telugu Translation |
|-----|---------------|---------------------------|
| `navigation.adrRevpar` | "ADR & RevPAR" | Need translation |
| `navigation.crs` | "CRS" | Need translation |

### 3.4 Portuguese (`pt`) — 248 keys remaining

**Type A — Need translation** (1 key):

| Key | English Value |
|-----|---------------|
| `common.status` | "Status" |

**Type B — Missing from en.json** (247 keys): See [Section 4](#4-all-338-english-keys-source-of-truth) for full list. All keys listed in Section 4 that are not already in pt.json must be added with Portuguese translations.

### 3.5 German (`de`) — 252 keys remaining

**Type A — Need translation** (5 keys):

| Key | English Value |
|-----|---------------|
| `common.status` | "Status" |
| `common.details` | "Details" |
| `navigation.dashboard` | "Dashboard" |
| `navigation.housekeeping` | "Housekeeping" |
| `dashboard.title` | "Dashboard" |

**Type B — Missing from en.json** (247 keys): Same as pt — all 247 keys from Section 4.

### 3.6 Spanish (`es`) — 11 keys remaining

**Type**: Only need translation

| Key | English Value |
|-----|---------------|
| `common.error` | "Error" |
| `common.no` | "No" |
| `navigation.checkIn` | "Check-In" |
| `navigation.checkOut` | "Check-Out" |
| `navigation.vouchers` | "Vouchers" |
| `navigation.folios` | "Folios" |
| `navigation.crs` | "CRS" |
| `navigation.webhooks` | "Webhooks" |
| `navigation.generalSettings` | "General" |
| `forms.total` | "Total" |
| `forms.subtotal` | "Subtotal" |

### 3.7 French (`fr`) — 19 keys remaining

**Type**: Only need translation

| Key | English Value |
|-----|---------------|
| `common.actions` | "Actions" |
| `common.info` | "Info" |
| `navigation.sessions` | "Sessions" |
| `navigation.folios` | "Folios" |
| `navigation.maintenance` | "Maintenance" |
| `navigation.tables` | "Tables" |
| `navigation.incidents` | "Incidents" |
| `navigation.restrictions` | "Restrictions" |
| `navigation.crs` | "CRS" |
| `navigation.notifications` | "Notifications" |
| `navigation.webhooks` | "Webhooks" |
| `navigation.admin` | "Administration" |
| `status.maintenance` | "Maintenance" |
| `forms.email` | "Email" |
| `forms.notes` | "Notes" |
| `forms.description` | "Description" |
| `forms.code` | "Code" |
| `forms.total` | "Total" |
| `auth.email` | "Email" |

### 3.8 Bengali (`bn`) — 115 keys remaining

**Type**: All are missing from en.json (bn has no English values — 100% of its 385 keys are translated)

**Missing keys** (115 from en.json not in bn.json): These are the 338 en.json keys minus the 223 that bn already has. BN also has 162 extra locale-only keys (kebab-case format) that should be kept.

### 3.9 Arabic (`ar`) — 247 keys remaining

**Type**: All are missing from en.json (ar has 0 English values — 100% of its 94 keys are translated)

**Missing keys** (247 from en.json not in ar.json): Nearly the entire en.json needs to be added. AR also has 3 extra keys that should be kept.

### 3.10 Gujarati (`gu`) — 250 keys remaining

**Type**: All are missing from en.json (gu has 0 English values — 100% of its 91 keys are translated)

**Missing keys** (250 from en.json not in gu.json): Same pattern as ar.

### 3.11 Japanese (`ja`) — 247 keys remaining

**Type**: All are missing from en.json (ja has 0 English values — 100% of its 94 keys are translated)

### 3.12 Malayalam (`ml`) — 250 keys remaining

**Type**: All are missing from en.json (ml has 0 English values — 100% of its 91 keys are translated)

### 3.13 Marathi (`mr`) — 250 keys remaining

**Type**: All are missing from en.json (mr has 0 English values — 100% of its 91 keys are translated)

### 3.14 Chinese (`zh`) — 247 keys remaining

**Type**: All are missing from en.json (zh has 0 English values — 100% of its 94 keys are translated)

---

## 4. All 338 English Keys (Source of Truth)

Every non-English locale MUST have all of these keys. If a locale is missing any, they must be added with proper translations.

### `auth` (14 keys)

```
auth.changePassword: "Change Password"
auth.confirmPassword: "Confirm Password"
auth.email: "Email"
auth.forgotPassword: "Forgot password?"
auth.login: "Login"
auth.loginError: "Invalid email or password"
auth.logout: "Logout"
auth.logoutSuccess: "Logged out successfully"
auth.newPassword: "New Password"
auth.password: "Password"
auth.rememberMe: "Remember me"
auth.resetPassword: "Reset Password"
auth.sessionExpired: "Session expired"
auth.unauthorized: "Unauthorized access"
```

### `common` (47 keys)

```
common.actions: "Actions"
common.active: "Active"
common.add: "Add"
common.all: "All"
common.back: "Back"
common.cancel: "Cancel"
common.clear: "Clear"
common.close: "Close"
common.confirm: "Confirm"
common.copied: "Copied!"
common.copy: "Copy"
common.create: "Create"
common.delete: "Delete"
common.deselectAll: "Deselect All"
common.details: "Details"
common.disabled: "Disabled"
common.download: "Download"
common.edit: "Edit"
common.enabled: "Enabled"
common.error: "Error"
common.export: "Export"
common.filter: "Filter"
common.help: "Help"
common.import: "Import"
common.inactive: "Inactive"
common.info: "Info"
common.loading: "Loading..."
common.next: "Next"
common.no: "No"
common.noData: "No data available"
common.none: "None"
common.previous: "Previous"
common.refresh: "Refresh"
common.reset: "Reset"
common.save: "Save"
common.search: "Search"
common.select: "Select"
common.selectAll: "Select All"
common.settings: "Settings"
common.status: "Status"
common.submit: "Submit"
common.success: "Success"
common.update: "Update"
common.upload: "Upload"
common.view: "View"
common.warning: "Warning"
common.yes: "Yes"
```

### `dashboard` (22 keys)

```
dashboard.activeBookings: "Active Bookings"
dashboard.alerts: "Alerts"
dashboard.availableRooms: "Available Rooms"
dashboard.criticalAlerts: "Critical Alerts"
dashboard.informational: "Informational"
dashboard.newBooking: "New Booking"
dashboard.newCheckIn: "New Check-In"
dashboard.newCheckOut: "New Check-Out"
dashboard.newGuest: "New Guest"
dashboard.occupancyRate: "Occupancy Rate"
dashboard.pendingTasks: "Pending Tasks"
dashboard.quickActions: "Quick Actions"
dashboard.recentActivity: "Recent Activity"
dashboard.runReport: "Run Report"
dashboard.title: "Dashboard"
dashboard.todaysStats: "Today's Statistics"
dashboard.totalGuests: "Total Guests"
dashboard.totalRevenue: "Total Revenue"
dashboard.upcomingArrivals: "Upcoming Arrivals"
dashboard.upcomingDepartures: "Upcoming Departures"
dashboard.warnings: "Warnings"
dashboard.welcome: "Welcome back! Here's an overview of your property performance today."
```

### `forms` (46 keys)

```
forms.address: "Address"
forms.adults: "Adults"
forms.amount: "Amount"
forms.assignedTo: "Assigned To"
forms.checkInDate: "Check-In Date"
forms.checkOutDate: "Check-Out Date"
forms.children: "Children"
forms.city: "City"
forms.code: "Code"
forms.country: "Country"
forms.createdAt: "Created At"
forms.createdBy: "Created By"
forms.currency: "Currency"
forms.dateOfBirth: "Date of Birth"
forms.description: "Description"
forms.discount: "Discount"
forms.email: "Email"
forms.endDate: "End Date"
forms.firstName: "First Name"
forms.idNumber: "ID Number"
forms.idType: "ID Type"
forms.infants: "Infants"
forms.lastName: "Last Name"
forms.name: "Name"
forms.nationality: "Nationality"
forms.notes: "Notes"
forms.numberOfGuests: "Number of Guests"
forms.optional: "Optional"
forms.paymentMethod: "Payment Method"
forms.phone: "Phone"
forms.postalCode: "Postal Code"
forms.price: "Price"
forms.priority: "Priority"
forms.quantity: "Quantity"
forms.reference: "Reference"
forms.required: "Required"
forms.roomNumber: "Room Number"
forms.roomType: "Room Type"
forms.specialRequests: "Special Requests"
forms.startDate: "Start Date"
forms.status: "Status"
forms.subtotal: "Subtotal"
forms.tax: "Tax"
forms.total: "Total"
forms.updatedAt: "Updated At"
forms.updatedBy: "Updated By"
```

### `language` (8 keys)

```
language.changeLanguage: "Change Language"
language.currentLanguage: "Current Language"
language.english: "English"
language.french: "French"
language.languageChanged: "Language changed successfully"
language.selectLanguage: "Select Language"
language.spanish: "Spanish"
language.title: "Language"
```

### `messages` (21 keys)

```
messages.copyError: "Failed to copy to clipboard"
messages.copySuccess: "Copied to clipboard"
messages.createError: "Failed to create item"
messages.createSuccess: "Item created successfully"
messages.deleteConfirm: "Are you sure you want to delete this item?"
messages.deleteError: "Failed to delete item"
messages.deleteSuccess: "Item deleted successfully"
messages.exportError: "Failed to export data"
messages.exportSuccess: "Data exported successfully"
messages.importError: "Failed to import data"
messages.importSuccess: "Data imported successfully"
messages.networkError: "Network error. Please try again."
messages.saveError: "Failed to save changes"
messages.saveSuccess: "Changes saved successfully"
messages.sessionExpired: "Your session has expired. Please log in again."
messages.unauthorized: "You are not authorized to perform this action"
messages.updateError: "Failed to update item"
messages.updateSuccess: "Item updated successfully"
messages.uploadError: "Failed to upload file"
messages.uploadSuccess: "File uploaded successfully"
messages.validationError: "Please check your input and try again"
```

### `navigation` (135 keys)

```
navigation.admin: "Administration"
navigation.adrRevpar: "ADR & RevPAR"
navigation.ai: "AI Features"
navigation.aiCopilot: "AI Copilot"
navigation.aiInsights: "AI Insights"
navigation.aiProviderSettings: "Provider Settings"
navigation.aiSuggestions: "AI Suggestions"
navigation.alerts: "Alerts"
navigation.allBookings: "All Bookings"
navigation.assets: "Assets"
navigation.auditLogs: "Audit Logs"
navigation.automation: "Automation"
navigation.availability: "Availability Control"
navigation.billing: "Billing"
navigation.bookingSync: "Booking Sync"
navigation.bookings: "Bookings"
navigation.campaigns: "Campaigns"
navigation.channelMapping: "Channel Mapping"
navigation.channels: "Channel Manager"
navigation.checkIn: "Check-In"
navigation.checkOut: "Check-Out"
navigation.commandCenter: "Command Center"
navigation.competitorPricing: "Competitor Pricing"
navigation.conflicts: "Conflicts"
navigation.consumptionLogs: "Consumption Logs"
navigation.crm: "CRM & Marketing"
navigation.crs: "CRS"
navigation.dashboard: "Dashboard"
navigation.deliveryLogs: "Delivery Logs"
navigation.demandForecasting: "Demand Forecasting"
navigation.digitalKeys: "Digital Keys"
navigation.discounts: "Discounts"
navigation.executionLogs: "Execution Logs"
navigation.experience: "Guest Experience"
navigation.featureFlags: "Feature Flags"
navigation.feedbackReviews: "Feedback & Reviews"
navigation.folios: "Folios"
navigation.frontDesk: "Front Desk"
navigation.gateway: "WiFi Controller"
navigation.generalSettings: "General"
navigation.groupBookings: "Group Bookings"
navigation.guestAnalytics: "Guest Analytics"
navigation.guestApp: "Guest App Controls"
navigation.guestChat: "Guest Chat"
navigation.guestProfiles: "Guest Profiles"
navigation.guests: "Guests"
navigation.housekeeping: "Housekeeping"
navigation.inRoomPortal: "In-Room Portal"
navigation.incidents: "Incidents"
navigation.integrations: "Integrations"
navigation.inventory: "Inventory"
navigation.inventoryCalendar: "Inventory Calendar"
navigation.inventorySync: "Inventory Sync"
navigation.invoices: "Invoices"
navigation.kanbanBoard: "Kanban Board"
navigation.kitchenDisplay: "Kitchen Display"
navigation.kycManagement: "KYC Management"
navigation.liveCamera: "Live Camera"
navigation.localization: "Localization"
navigation.locking: "Inventory Locking"
navigation.lowStockAlerts: "Low Stock Alerts"
navigation.loyalty: "Loyalty Program"
navigation.loyaltyPrograms: "Loyalty Programs"
navigation.maintenance: "Maintenance"
navigation.menuManagement: "Menu Management"
navigation.notificationSettings: "Settings"
navigation.notificationTemplates: "Templates"
navigation.notifications: "Notifications"
navigation.occupancyReports: "Occupancy Reports"
navigation.orders: "Orders"
navigation.otaConnections: "OTA Connections"
navigation.overbooking: "Overbooking Settings"
navigation.overview: "Overview"
navigation.parking: "Parking"
navigation.parkingSlots: "Parking Slots"
navigation.paymentGateways: "Payment Gateways"
navigation.payments: "Payments"
navigation.plans: "Plans"
navigation.pms: "Property Management"
navigation.pos: "Restaurant & POS"
navigation.posSystems: "POS Systems"
navigation.preferences: "Preferences"
navigation.pricing: "Pricing"
navigation.pricingRules: "Pricing Rules"
navigation.properties: "Properties"
navigation.purchaseOrders: "Purchase Orders"
navigation.rateSync: "Rate Sync"
navigation.refunds: "Refunds"
navigation.reports: "Reports & BI"
navigation.restrictions: "Restrictions"
navigation.retentionAnalytics: "Retention Analytics"
navigation.retryQueue: "Retry Queue"
navigation.revenue: "Revenue Management"
navigation.revenueAnalytics: "Revenue Analytics"
navigation.revenueReports: "Revenue Reports"
navigation.roomAssignment: "Room Assignment"
navigation.roomGrid: "Room Grid"
navigation.roomStatus: "Room Status"
navigation.roomTypes: "Room Types"
navigation.rooms: "Rooms"
navigation.rulesEngine: "Rules Engine"
navigation.saasPlans: "SaaS Plans"
navigation.scheduledReports: "Scheduled Reports"
navigation.security: "Security"
navigation.securitySettings: "Security"
navigation.segments: "Guest Segments"
navigation.serviceRequests: "Service Requests"
navigation.sessions: "Sessions"
navigation.staffPerformance: "Staff Performance"
navigation.stayHistory: "Stay History"
navigation.stockItems: "Stock Items"
navigation.subscriptions: "Subscriptions"
navigation.syncLogs: "Sync Logs"
navigation.systemHealth: "System Health"
navigation.tables: "Tables"
navigation.tasks: "Tasks"
navigation.taxCurrency: "Tax & Currency"
navigation.templates: "Templates"
navigation.tenantManagement: "Tenant Management"
navigation.thirdPartyApis: "Third-Party APIs"
navigation.usageBilling: "Usage Billing"
navigation.usageLogs: "Usage Logs"
navigation.usageTracking: "Usage Tracking"
navigation.userManagement: "User Management"
navigation.vehicleTracking: "Vehicle Tracking"
navigation.vendors: "Vendors"
navigation.vouchers: "Vouchers"
navigation.waitlist: "Waitlist"
navigation.walkIn: "Walk-In"
navigation.webhookDelivery: "Delivery"
navigation.webhookEvents: "Events"
navigation.webhooks: "Webhooks"
navigation.wifi: "WiFi Management"
navigation.wifiGateways: "WiFi Gateways"
navigation.workflowBuilder: "Workflow Builder"
```

### `settings` (20 keys)

```
settings.auditLogging: "Audit Logging"
settings.autoTranslate: "Auto-translate communications"
settings.businessInfo: "Business Information"
settings.contactDetails: "Contact Details"
settings.currencySettings: "Currency Settings"
settings.dateFormat: "Date Format"
settings.defaultLanguage: "Default Language"
settings.featureSettings: "Feature Settings"
settings.general: "General Settings"
settings.guestFacingLanguage: "Guest-Facing Language"
settings.languageSettings: "Language Settings"
settings.operationalSettings: "Operational Settings"
settings.passwordPolicy: "Password Policy"
settings.propertyInfo: "Property Information"
settings.securitySettings: "Security Settings"
settings.sessionTimeout: "Session Timeout"
settings.taxSettings: "Tax Settings"
settings.timeFormat: "Time Format"
settings.timezoneSettings: "Timezone Settings"
settings.twoFactorAuth: "Two-Factor Authentication"
```

### `status` (25 keys)

```
status.active: "Active"
status.available: "Available"
status.cancelled: "Cancelled"
status.checkedIn: "Checked In"
status.checkedOut: "Checked Out"
status.clean: "Clean"
status.completed: "Completed"
status.confirmed: "Confirmed"
status.dirty: "Dirty"
status.draft: "Draft"
status.expired: "Expired"
status.failed: "Failed"
status.inactive: "Inactive"
status.inspected: "Inspected"
status.maintenance: "Maintenance"
status.noShow: "No Show"
status.occupied: "Occupied"
status.outOfOrder: "Out of Order"
status.pending: "Pending"
status.processing: "Processing"
status.published: "Published"
status.rejected: "Rejected"
status.suspended: "Suspended"
status.trial: "Trial"
status.verified: "Verified"
```

---

## 5. Extra Keys in Locales (Not in en.json)

These keys exist in locale files but NOT in `en.json`. **DO NOT DELETE** — they are used by components with different key patterns (e.g., kebab-case navigation keys).

### Shared extra keys (present in ar, de, gu, ja, ml, mr, pt, zh)

```
language.globalLanguages
language.indianLanguages
navigation.settings
```

### Bengali (`bn`) — 162 extra kebab-case keys

Bengali has a completely different navigation key format (kebab-case like `navigation.housekeeping-tasks` instead of `navigation.housekeeping`). These are likely from an older version of the code. **Keep them** — they don't hurt, and some may still be referenced.

Full list of bn-only extra keys:
```
navigation.admin-health, navigation.admin-lifecycle, navigation.admin-revenue, navigation.admin-tenants, navigation.admin-usage, navigation.admin-users, navigation.ai-copilot, navigation.ai-insights, navigation.ai-settings, navigation.aiAssistant, navigation.automation-logs, navigation.automation-rules, navigation.automation-templates, navigation.automation-workflows, navigation.billing-discounts, navigation.billing-folios, navigation.billing-invoices, navigation.billing-payments, navigation.billing-refunds, navigation.bookings-all, navigation.bookings-audit, navigation.bookings-calendar, navigation.bookings-conflicts, navigation.bookings-groups, navigation.bookings-waitlist, navigation.chain-analytics, navigation.chain-brands, navigation.chain-dashboard, navigation.chainManagement, navigation.channel-booking, navigation.channel-crs, navigation.channel-inventory, navigation.channel-logs, navigation.channel-mapping, navigation.channel-ota, navigation.channel-rate, navigation.channel-restrictions, navigation.crm-campaigns, navigation.crm-feedback, navigation.crm-loyalty, navigation.crm-retention, navigation.crm-segments, navigation.crmMarketing, navigation.dashboard-alerts, navigation.dashboard-command-center, navigation.dashboard-kpi, navigation.dashboard-overview, navigation.events, navigation.events-booking, navigation.events-calendar, navigation.events-resources, navigation.events-spaces, navigation.experience-app-controls, navigation.experience-chat, navigation.experience-inbox, navigation.experience-keys, navigation.experience-portal, navigation.experience-requests, navigation.frontdesk-assignment, navigation.frontdesk-checkin, navigation.frontdesk-checkout, navigation.frontdesk-room-grid, navigation.frontdesk-walkin, navigation.guests-history, navigation.guests-kyc, navigation.guests-list, navigation.guests-loyalty, navigation.guests-preferences, navigation.guests-profiles, navigation.help-articles, navigation.help-center, navigation.help-tutorials, navigation.helpSupport, navigation.housekeeping-assets, navigation.housekeeping-kanban, navigation.housekeeping-maintenance, navigation.housekeeping-preventive, navigation.housekeeping-status, navigation.housekeeping-tasks, navigation.integrations-apis, navigation.integrations-payments, navigation.integrations-pos, navigation.integrations-wifi, navigation.inventory-alerts, navigation.inventory-consumption, navigation.inventory-po, navigation.inventory-stock, navigation.inventory-vendors, navigation.iot, navigation.iot-controls, navigation.iot-devices, navigation.iot-energy, navigation.marketing, navigation.marketing-booking-engine, navigation.marketing-promotions, navigation.marketing-reputation, navigation.marketing-sources, navigation.notifications-logs, navigation.notifications-settings, navigation.notifications-templates, navigation.parking-billing, navigation.parking-mapping, navigation.parking-slots, navigation.parking-tracking, navigation.pms-availability, navigation.pms-inventory-calendar, navigation.pms-locking, navigation.pms-overbooking, navigation.pms-properties, navigation.pms-rate-plans-pricing, navigation.pms-room-types, navigation.pms-rooms, navigation.pos-billing, navigation.pos-kitchen, navigation.pos-menu, navigation.pos-orders, navigation.pos-tables, navigation.reports-adr, navigation.reports-guests, navigation.reports-occupancy, navigation.reports-revenue, navigation.reports-scheduled, navigation.reports-staff, navigation.revenue-ai, navigation.revenue-competitor, navigation.revenue-forecasting, navigation.revenue-pricing, navigation.saas-plans, navigation.saas-subscriptions, navigation.saas-usage, navigation.saasBilling, navigation.security-2fa, navigation.security-alerts, navigation.security-incidents, navigation.security-live, navigation.security-overview, navigation.security-playback, navigation.security-sessions, navigation.security-sso, navigation.securityCenter, navigation.settings, navigation.settings-features, navigation.settings-general, navigation.settings-localization, navigation.settings-tax, navigation.staff-attendance, navigation.staff-communication, navigation.staff-performance, navigation.staff-shifts, navigation.staff-tasks, navigation.staffManagement, navigation.surveillance, navigation.webhooks-delivery, navigation.webhooks-events, navigation.webhooks-retry, navigation.wifi-aaa, navigation.wifi-gateway, navigation.wifi-logs, navigation.wifi-plans, navigation.wifi-sessions, navigation.wifi-users, navigation.wifi-vouchers
```

---

## 6. Known Issues & Patterns

### 6.1 Dynamic Key Patterns

Components that construct translation keys at runtime (these won't show up in a simple `t('...')` grep):

1. **Room Status Tooltips** (`src/components/dashboard/widgets/room-status-widget.tsx`):
   ```ts
   // Generates keys like: "availableTooltip", "occupiedTooltip", "dirtyTooltip", "maintenanceTooltip", "outOfOrderTooltip"
   t((key + 'Tooltip') as string)
   ```
   → These tooltip keys must exist under the `dashboard` namespace in en.json.

2. **Status Label Mapping** (`src/components/dashboard/widgets/maintenance-tracker.tsx`):
   ```ts
   const labelMap = { inProgress: 'active', pending: 'pending', ... };
   t(labelMap[variant])
   ```
   → Resolves to keys like `status.active`, `status.pending` via `t()`.

3. **Config-driven labels**: Some components use `configs.labelKey` to resolve keys dynamically. Always check component source for `t(variable)` patterns.

### 6.2 Key Format Consistency

- **Primary format**: camelCase dot-notation (`navigation.dashboard`, `common.save`)
- **Legacy format (bn only)**: kebab-case (`navigation.housekeeping-tasks`)
- **Snake_case**: Rare but exists for computed keys (`dashboard.out_of_order`, `dashboard.new_booking_tip`)

### 6.3 CRITICAL RULES

- **NEVER** run `bun run db:push`
- **NEVER** delete extra locale-only keys
- **ALWAYS** preserve existing translations when adding missing keys
- **ALWAYS** keep the nested JSON structure matching en.json's structure
- **Industry terms** (CRS, ADR, RevPAR, POS, OTA, KDS, API, KYC, SaaS, IoT, SSO, AAA) can be kept as-is in RTL/Indic languages or transliterated
- **RTL support**: Arabic (`ar`) values should be in Arabic script (the layout handles RTL)

---

## 7. Step-by-Step Execution Plan

### Phase 1: Quick Wins (37 translations — ~5 min)

Process these files that only need value replacements (keys already exist):

```
Step 1a: hi.json — Translate 2 keys (navigation.crs, navigation.webhooks) to Hindi
Step 1b: ta.json — Translate 2 keys (navigation.adrRevpar, navigation.crs) to Tamil
Step 1c: te.json — Translate 2 keys (navigation.adrRevpar, navigation.crs) to Telugu
Step 1d: pt.json — Translate 1 key (common.status) + add 247 missing keys with Portuguese translations
Step 1e: de.json — Translate 5 keys + add 247 missing keys with German translations
Step 1f: es.json — Translate 11 keys
Step 1g: fr.json — Translate 19 keys
```

### Phase 2: Bengali Gap Fill (115 missing keys)

```
Step 2: bn.json — Add 115 missing keys from en.json with Bengali translations
        Keep all 162 existing kebab-case keys intact
```

### Phase 3: Major Gaps (8 languages × ~247 keys each)

Process in parallel batches (2-3 languages at a time to avoid rate limits):

```
Step 3a: ar.json — Add 247 missing keys with Arabic translations
Step 3b: ja.json — Add 247 missing keys with Japanese translations
Step 3c: zh.json — Add 247 missing keys with Chinese translations

Step 3d: gu.json — Add 250 missing keys with Gujarati translations
Step 3e: ml.json — Add 250 missing keys with Malayalam translations
Step 3f: mr.json — Add 250 missing keys with Marathi translations
```

### Phase 4: Verification

```
Step 4a: Run the analysis script to verify 100% coverage
Step 4b: Check dev.log for any MISSING_MESSAGE errors
Step 4c: Test language switching in the browser
```

### How to Execute Translations (Agent Instructions)

#### Method A: LLM CLI Batch Translation

For each language, generate translations via `z-ai chat`:

```bash
# Build a prompt with all keys needing translation
z-ai chat --prompt "Translate the following JSON key-value pairs to [LANGUAGE]. Return valid JSON only, no markdown fences. Keep keys as-is, translate only values. For industry terms (CRS, ADR, RevPAR, POS, OTA, API, KYC, SaaS, IoT, SSO), keep as-is or transliterate naturally.

[KEYS_JSON]" --system "You are a professional translator for a hotel management system. Provide natural, industry-appropriate translations." -o /tmp/[lang]_translations.json
```

Then merge the translations into the locale file using Python:

```python
import json

# Load existing locale
with open('src/messages/[lang].json') as f:
    locale = json.load(f)

# Load translations from LLM
with open('/tmp/[lang]_translations.json') as f:
    translations = json.load(f)

# Deep merge: add missing keys without overwriting existing
def deep_merge(base, additions):
    for key, value in additions.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value
    return base

locale = deep_merge(locale, translations)

# Write back
with open('src/messages/[lang].json', 'w', encoding='utf-8') as f:
    json.dump(locale, f, ensure_ascii=False, indent=2)
```

#### Method B: Direct LLM SDK (for large batches)

Create a temporary script `scripts/translate-locale.ts`:

```typescript
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const TARGET_LANG = process.argv[2]; // e.g., 'ar', 'ja'
const TARGET_LANG_NAME = process.argv[3]; // e.g., 'Arabic', 'Japanese'

async function translate() {
  const zai = await ZAI.create();
  
  const en = JSON.parse(fs.readFileSync('src/messages/en.json', 'utf-8'));
  const locale = JSON.parse(fs.readFileSync(`src/messages/${TARGET_LANG}.json`, 'utf-8'));
  
  // Find missing keys
  function flatten(d: any, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(d)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') result[key] = v;
      else if (typeof v === 'object') Object.assign(result, flatten(v, key));
    }
    return result;
  }
  
  const enFlat = flatten(en);
  const locFlat = flatten(locale);
  const missing = Object.fromEntries(
    Object.entries(enFlat).filter(([k]) => !(k in locFlat))
  );
  
  // Translate in batches of 50 keys
  const keys = Object.keys(missing);
  const batchSize = 50;
  
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const batchObj = Object.fromEntries(batch.map(k => [k, missing[k]]));
    
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: `You are a professional ${TARGET_LANG_NAME} translator for a hotel management system. Translate JSON values to ${TARGET_LANG_NAME}. Keep keys as-is. For industry terms (CRS, ADR, RevPAR, POS, OTA, API, KYC, SaaS, IoT, SSO), keep as-is or transliterate. Return valid JSON only.` },
        { role: 'user', content: JSON.stringify(batchObj, null, 2) }
      ],
      thinking: { type: 'disabled' }
    });
    
    // Parse and merge...
    await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
  }
}

translate();
```

#### Method C: For Category A languages (only need value changes)

For languages that already have all keys but some values are still English, use a simple find-and-replace approach:

```bash
# Example: fix French
z-ai chat --prompt 'Translate these English strings to French for a hotel management system context. Return JSON only:
{"common.actions": "...", "common.info": "...", "navigation.sessions": "...", ...}' -o /tmp/fr_fixes.json
```

### Analysis Script (to re-run after translations)

```bash
python3 -c "
import json

def flatten(d, parent='', sep='.'):
    items = {}
    for k, v in d.items():
        new_key = f'{parent}{sep}{k}' if parent else k
        if isinstance(v, dict):
            items.update(flatten(v, new_key, sep))
        elif isinstance(v, str):
            items[new_key] = v
    return items

en = flatten(json.load(open('src/messages/en.json')))
print(f'English total keys: {len(en)}')

all_done = True
for lang in ['ar','bn','de','es','fr','gu','hi','ja','ml','mr','pt','ta','te','zh']:
    loc = flatten(json.load(open(f'src/messages/{lang}.json')))
    missing = [k for k in en if k not in loc]
    same = [k for k in loc if k in en and loc[k] == en[k]]
    total_work = len(missing) + len(same)
    if total_work > 0:
        all_done = False
    print(f'{lang}: {len(loc)} keys, {len(loc)-len(same)} translated, {len(missing)} missing, {len(same)} English, work={total_work}')

print(f'\nAll done: {all_done}')
"
```

---

## 8. Translation Quality Checklist

After translating, verify each language passes these checks:

- [ ] No `MISSING_MESSAGE` errors in `dev.log` after switching to that language
- [ ] All 338 en.json keys exist in the locale file (plus any locale-only extras)
- [ ] No values match the English value exactly (unless it's an industry term like "CRS")
- [ ] JSON is valid (run `python3 -c "import json; json.load(open('src/messages/xx.json'))"`)
- [ ] Special characters are properly escaped
- [ ] RTL languages (ar) have proper Arabic text
- [ ] Indic languages (hi, bn, gu, ml, mr, ta, te) use native scripts
- [ ] CJK languages (ja, zh) use native characters
- [ ] European languages (de, es, fr, pt) use proper diacritics and terminology
- [ ] UI strings use appropriate formality level (formal/polite in most languages)
- [ ] Technical terms are handled consistently (keep as-is or transliterate)
- [ ] No English text leaked into non-English values (except acronyms)
- [ ] `bun run lint` passes without new errors
- [ ] Dev server starts without errors: check `dev.log`

---

*End of Translation Plan. When rate limits clear, start with Phase 1 (Quick Wins) and work through each phase sequentially.*

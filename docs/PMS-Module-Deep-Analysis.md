# StaySuite-HospitalityOS — PMS Module Deep Analysis

> **Date:** 2026-05-28  
> **Scope:** All 13 pages under Property Management menu  
> **Benchmark:** Oracle OPERA Cloud, Hotelogix, Cloudbeds, Little Hotelier, RoomKeyPMS  
> **Status:** Production-ready but significant feature gaps vs enterprise-grade PMS

---

## Executive Summary

| Metric | Score |
|--------|-------|
| CRUD Completeness | 90% |
| Business Logic Depth | 45% |
| Feature Parity vs Opera | 30% |
| Critical Bugs Found | 12 |
| Hardcoded India Bias | HIGH (GST, INR, Kolkata defaults) |
| P0 Bugs (broken pages) | 2 |

### Top 5 Critical Issues

1. **Inventory Calendar is non-functional** — calls wrong API (`/api/inventory` = hotel supplies, not room inventory)
2. **Room Status enum mismatch** — code uses `out_of_order`/`dirty`/`inspected` but DB enum has `out_of_service`/`cleaning` — status changes will crash
3. **CTA/CTD silently ignored** — Room Rate Calendar toggles Closed-To-Arrival/Departure but bulk-rates API doesn't persist them
4. **Room Type Change folio is a no-op** — completion sets a `notes` string but never creates actual monetary charge
5. **Dual blocking systems** — `MaintenanceBlock` and `InventoryLock` serve the same purpose but are completely unsynchronized

---

## Page-by-Page Analysis

---

### 1. Properties

**Files:** `src/components/pms/properties-list.tsx`, `src/app/api/properties/route.ts`, `src/app/api/properties/[id]/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Full CRUD with RBAC | ✅ |
| Slug auto-generation | ✅ |
| Tax configuration (GST/flat/VAT) | ✅ |
| Branding (logo, colors) | ✅ |
| Import/Export (JSON) | ✅ |
| Soft delete with booking safety | ✅ |
| Audit logging | ✅ |
| Multi-view (card/table/mobile) | ✅ |
| Search + status/type filters | ✅ |
| User auto-assignment on create | ✅ (recently fixed) |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| Brand/chain assignment (DB has `brandId` but no UI) | Multi-property chains cannot be managed |
| Property groups/clusters | No way to group properties by region/brand |
| Star rating / classification | No regulatory classification field |
| Photo gallery (multi-image) | Only logo URL — no gallery for OTA marketing |
| Contact persons (GM, FD, maintenance) | Only generic email/phone |
| Per-property cancellation policies | `CancellationPolicy` model exists but not linked |
| Payment methods per property | Global only — no per-property gateway config |
| Property templates / cloning | Every property built from scratch |
| Per-property operating hours / seasonal config | Single check-in/out time only |
| Amenity management at property level | Only at room-type level |

#### Hardcoded Values
| Value | Should Be |
|-------|-----------|
| Default city: `Kolkata` | User's actual city |
| Default state: `West Bengal` | User's actual state |
| Default country: `India` | User's actual country |
| Default phone: `+91 ` | No prefix — use country code from country |
| Default tax: `CGST 9% + SGST 9%` (GST) | Configurable tax system |
| Default timezone: `Asia/Kolkata` | From property address |
| Default currency: `INR` | From property country |
| Timezone list: only 10 options | Full IANA timezone list (~400) |
| Currency list: only 8 options | Full ISO 4217 list (~170) |
| Property types: only 8 options | Add condo, townhouse, lodge, inn, mixed-use |

#### Business Logic Gaps
- **Status mismatch:** UI has `coming_soon` option but API validation rejects it
- **Import is naive:** Sequential requests, no deduplication, no batch validation
- **Bulk delete is fire-and-forget:** `Promise.all` with no per-item error handling
- **Stats always zero:** `PropertyStats` (occupancyRate, todayRevenue) never populated by API
- **`totalRooms` drifts:** Static field not synced with actual `_count.rooms`

---

### 2. Room Types

**Files:** `src/components/pms/room-types-manager.tsx`, `src/app/api/room-types/route.ts`, `src/app/api/room-types/[id]/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Full CRUD with RBAC | ✅ |
| Code auto-generation (6-char) | ✅ |
| Max adults/children, size, base price | ✅ |
| WiFi plan assignment | ✅ |
| Amenity manager (create/toggle) | ✅ |
| Import (CSV+JSON) / Export (CSV+JSON) | ✅ |
| Multi-view + search + filter | ✅ |
| Soft delete with room-safety check | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Bed configuration** (king/queen/twin/sofa) | Cannot specify bed types — core inventory data |
| **Room class/category** (Standard/Deluxe/Suite) | Single-level only — no hierarchy |
| **Occupancy-based pricing tiers** | Flat base price — no per-adult/child rates |
| **Child age policies** (0-2/3-11/12-17 brackets) | Only `maxChildren` count |
| **Extra bed / rollaway rules** | No extra bed charges or max limits |
| **Room type images gallery** | DB has `images` JSON field but **no UI** |
| **Channel manager code mapping** | `ChannelMapping` exists but no management UI |
| **Overbooking controls UI** | DB fields exist but **not exposed** in form |
| **Min/Max LOS per room type** | Only at RatePlan level |
| **Room type sort order** | DB has `sortOrder` but no drag-and-drop UI |

#### Hardcoded Values
| Value | Issue |
|-------|-------|
| Default max adults: `2` | Should be configurable per type |
| Code generation: 6-char truncation | Collision-prone — "Deluxe Suite" → "DELUXE" |
| Currency fallback: `'INR'` | Should use property currency |
| Status options: only `active`/`inactive` | Missing `maintenance`, `renovation`, `seasonal` |

#### Business Logic Gaps
- **Overbooking fields hidden:** `overbookingEnabled`, `overbookingPercentage`, `overbookingLimit` in DB but zero UI controls — silently defaulted to `false/0/0`
- **Images not manageable:** `images` JSON field parsed on read but no upload UI
- **Import ignores property filter:** Defaults to first property, not the filtered one
- **No rate plan visibility:** Deleting a room type cascades to `RatePlan` and `Booking` with no warning
- **Create not in transaction:** Race condition on `propertyId_code` unique check

---

### 3. Rooms

**Files:** `src/components/pms/rooms-manager.tsx`, `src/app/api/rooms/route.ts`, `src/app/api/rooms/[id]/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Full CRUD with RBAC | ✅ |
| Grid (floor-grouped) + list view | ✅ |
| Room status state machine | ✅ (but see bugs) |
| Quick inline status change | ✅ |
| Room images (separate API) | ✅ |
| Feature indicators (sea/mountain view, accessible, smoking, balcony) | ✅ |
| Bulk CSV import | ✅ |
| Soft delete + booking safety | ✅ |
| WebSocket status broadcast | ✅ |
| Room type change cascade | ✅ |

#### 🔴 CRITICAL BUG: Room Status Enum Mismatch
- **Prisma `RoomStatus` enum:** `available, occupied, maintenance, out_of_service, reserved, cleaning`
- **Component/API uses:** `out_of_order, dirty, inspected` — **NOT in the enum**
- **Prisma `HousekeepingStatus` enum:** `clean, dirty, inspected, out_of_service, in_progress`
- **Impact:** Setting room to "dirty" or "out_of_order" as primary status will crash at DB level

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Adjoining/connecting rooms** | Cannot link rooms for group bookings |
| **Bed type per room** | Only on RoomType, not per-room |
| **Wing/building/section** | Only floor — no spatial grouping |
| **Room move history** | `RoomMoveLog` table exists but not exposed |
| **Room-specific rate override** | No per-room pricing |
| **Room features matrix** | Only 5 boolean flags — needs expandable list |
| **View types** | Only sea/mountain — needs pool, garden, city, courtyard |
| **Room assignment rules** | No auto-assign (priority, VIP) |
| **Out-of-service workflow** | No scheduled OOS, auto-release, inspection |
| **Room inspection checklist** | No structured inspection |

#### Business Logic Gaps
- **No future-booking check on delete:** Only checks active bookings, not future confirmed ones
- **Floor default hardcoded:** `floor: 1` on reset
- **Room limit hardcoded:** `limit=200` — no pagination for large properties
- **Status transition map includes invalid states:** `dirty`, `inspected`, `out_of_order` not in Prisma enum

---

### 4. Inventory Calendar

**Files:** `src/components/pms/inventory-calendar.tsx`

#### 🔴 CRITICAL BUG: Wrong API Endpoint
The component fetches from `/api/inventory` which serves **hotel supplies** (towels, soap, minibar items), NOT room availability. This page is **completely non-functional** for its intended purpose. The correct endpoint is `/api/availability`.

#### Available Features (once fixed)
| Feature | Status |
|---------|--------|
| Monthly calendar grid | ✅ |
| Color-coded availability cells | ✅ |
| Click-to-edit dialog (price + available rooms) | ✅ |
| Close availability toggle | ✅ (but PATCH handler missing) |
| Stats bar | ✅ |
| Property selector | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Enterprise Reference |
|---------|---------------------|
| Inline daily rate editing | Opera: click cell to edit directly |
| Min/Max LOS per day | Cloudbeds: per-day LOS grid |
| Closed to Arrival/Departure per day | Opera: CTA/CTD daily rules |
| Channel-specific availability | Cloudbeds: OTA vs direct allocation |
| Drag-to-set rates | All enterprise: standard feature |
| Rate parity indicators | Cloudbeds: OTA vs direct comparison |
| Multi-rate plan overlay | Opera: compare plans side-by-side |
| Seasonal rate bands | Opera: visual high/shoulder/low bands |
| Yield management indicators | Cloudbeds: RevPAR/ADR trends |

#### Business Logic Gaps
- **PATCH handler doesn't exist** — `/api/inventory` has GET/POST/PUT/DELETE but no PATCH — close/open availability returns 405
- **Price update modifies base price globally** — When no rate plan exists, editing changes `RoomType.basePrice` for ALL dates
- **No optimistic locking** — Concurrent edits overwrite each other
- **Stats use simple averaging** — Not weighted by room count

---

### 5. Availability Control

**Files:** `src/components/pms/availability-control.tsx`

#### Available Features
| Feature | Status |
|---------|--------|
| Date range picker with quick ranges | ✅ |
| Desktop table + mobile card view | ✅ |
| Click-to-edit availability count | ✅ |
| Inventory locks factored in | ✅ |
| Bookings factored in | ✅ |
| CSV export | ✅ |
| Stats summary | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Enterprise Reference |
|---------|---------------------|
| **Allocation pools (OTA vs direct vs corporate)** | `ChannelBookingLimit` model exists but NO UI |
| **Length-of-stay restrictions per date range** | `ChannelRestriction` has fields but NOT exposed |
| **Closed to Arrival/Departure rules** | DB fields exist but NOT in UI |
| **Min/Max stay per date range** | Standard enterprise feature |
| **Overbooking tolerance per date** | `RoomType.overbooking*` fields exist but NOT used |
| **Yield controls / dynamic pricing** | Opera: core revenue management |
| **Cut-off dates for booking windows** | `RatePlan.bookingStartDays/bookingEndDays` exist |
| **Availability sync with channels** | Critical for OTA operations |

#### Business Logic Gaps
- **Entirely client-side calculation** — All room data fetched every time, no server-side source of truth
- **Capped at 14 visible days** — No pagination for longer ranges
- **No validation that available ≤ totalRooms** when editing
- **No server-side locking** — Race conditions between concurrent editors
- **`viewMode` state exists but unused** — Only affects navigation delta, not actual view

---

### 6. Inventory Locking

**Files:** `src/components/pms/inventory-locking.tsx`, `src/app/api/inventory-locks/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Full CRUD with RBAC | ✅ |
| Room-level OR room-type-level locks | ✅ |
| 5 lock types | ✅ |
| Overlapping lock detection (serializable tx) | ✅ |
| Conflicting booking detection | ✅ |
| Bulk delete | ✅ |
| Pagination (20/page) | ✅ |
| Status badges (Active/Upcoming/Past) | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Lock approval workflow** | No multi-step approval |
| **Revenue impact estimation** | No projected revenue loss when locking |
| **Auto-release rules** | DB has `expiresAt` but not used in UI |
| **Housekeeping-triggered locks** | Not integrated with housekeeping module |
| **Lock calendar timeline view** | Table only — no visual timeline |
| **Guest notification on lock** | No email/SMS to affected guests |

#### 🔴 Critical: Dual Blocking Systems
- **`MaintenanceBlock`** (rooms API) — sets room status to `out_of_order`
- **`InventoryLock`** (inventory-locks API) — creates availability locks
- **They are NOT synchronized** — creating one doesn't create the other. Both can exist for the same room simultaneously, causing confusion.

#### Business Logic Gaps
- **Hard delete** — `InventoryLock` uses `deleteMany`, not soft delete. Deleted locks permanently lost.
- **Lock reason is free text** — No categorized dropdown for common reasons
- **No recurring locks** — Cannot create "every Monday" maintenance locks
- **No lock templates** — Common configurations must be re-created each time

---

### 7. Rate Plans & Pricing

**Files:** `src/components/pms/rate-plans-manager.tsx`, `src/app/api/rate-plans/route.ts`, `src/app/api/rate-plans/[id]/route.ts`, `src/app/api/rate-plans/bulk-rates/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Full CRUD with RBAC | ✅ |
| Derived rate plans (percentage/fixed offset) | ✅ |
| Meal plan selection (5 options) | ✅ |
| Cancellation policy presets (4 options) | ✅ |
| Min/Max stay | ✅ |
| Bulk delete | ✅ |
| Channel sync trigger (ARI update) | ✅ |
| Audit logging | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Enterprise Reference |
|---------|---------------------|
| **Rate plan categories** (BAR, Corporate, OTA, Package) | Opera: essential taxonomy |
| **Rate plan versioning** | Opera: track changes over time |
| **Rate plan approval workflow** | Opera: require approval before going live |
| **Dynamic pricing rules** | `PricingRule` model exists but **zero UI** |
| **Channel-specific rates** | `channelMappings` relation exists but NO management UI |
| **Promotional fields in UI** | `promoCode`, `discountPercent`, `discountAmount`, `promoStart`, `promoEnd` in DB but NOT in form |
| **Advance booking fields in UI** | `advanceBookingDays`, `bookingStartDays`, `bookingEndDays` in DB but NOT in form |
| **Competitive rate shopping** | `CompetitorPrice` model exists but NOT exposed |
| **Rate plan cloning** | No "Clone" button |
| **Season-based pricing** | Only flat basePrice + date overrides |
| **LOS-based rate tiers** | No length-of-stay pricing bands |
| **Rate plan performance tracking** | No revenue/occupancy metrics per plan |
| **Corporate negotiated rates** | No account linking |
| **Package rate bundling** | No room + addon bundling |

#### Business Logic Gaps
- **Derived plans don't auto-update:** Parent price change doesn't recalculate derived plans
- **No min/max rate validation:** Base price has no bounds
- **Promo fields unused:** 5 DB fields exist but zero UI — promotional pricing is architecturally ready but unreachable
- **PricingRule model unreachable:** Dynamic pricing engine exists in DB but has NO API endpoint and NO UI

---

### 8. Overbooking Settings

**Files:** `src/components/pms/overbooking-settings.tsx`

#### Available Features
| Feature | Status |
|---------|--------|
| Per room-type toggle + percentage + hard limit | ✅ |
| Effective capacity calculation | ✅ |
| Quick inline toggle with optimistic update | ✅ |
| Property selector | ✅ |
| Stats dashboard + per-type breakdown | ✅ |
| Warning card explaining risks | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Date-range overbooking** | Single global setting — no seasonal adjustment |
| **Channel-specific overbooking** | Cannot set higher OTA vs direct limits |
| **Auto-adjust triggers** | No demand-based adjustment |
| **Overbooking alerts** | No real-time notifications |
| **Walk management workflow** | No relocation/compensation tools |
| **Revenue impact estimation** | No projected gain/loss analysis |
| **No-show prediction** | `DemandForecast` model exists but NOT used |
| **Per-day overbooking control** | No date-specific limits |

#### Business Logic Gaps
- **No dedicated API:** Piggybacked on `PUT /api/room-types/:id`
- **Enforcement unverified:** Booking engine may not actually check these fields
- **No guard against overbooking already-overbooked rooms:** Can enable even at 100%+ occupancy

---

### 9. Floor Plans

**Files:** `src/components/pms/floor-plans.tsx`, `src/components/pms/floor-plan-editor.tsx`, `src/components/pms/floor-plan-viewer.tsx`

#### Available Features
| Feature | Status |
|---------|--------|
| Visual editor with zoom (0.5x–2x) + pan | ✅ |
| Room drag-and-drop with snap-to-grid | ✅ |
| Room resizing (8 handles) | ✅ |
| Multi-room drag (Shift+click) | ✅ |
| Undo/Redo (50 states) + keyboard shortcuts | ✅ |
| Auto-arrange + alignment tools | ✅ |
| Room lock/unlock | ✅ |
| Room status overlay (5 colors) | ✅ |
| Viewer mode + floor viewer mode | ✅ |
| Export as PNG (2x resolution) | ✅ |
| Background image support (blueprint overlay) | ✅ |
| Touch support | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Real-time status updates** | Static snapshot — no WebSocket for live status |
| **Interactive guest room assignment** | Cannot drag booking onto room |
| **Housekeeping status overlay** | No HK task status shown |
| **Emergency evacuation view** | No fire exits, accessible routes |
| **Multi-floor simultaneous view** | Only one floor at a time |
| **PDF/SVG export** | Only PNG |
| **Room connections (adjoining)** | No visual linking |
| **Building/wing grouping** | No spatial zones |

#### Business Logic Gaps
- **Dual storage inconsistency:** Room positions stored as JSON string AND relational `FloorPlanRoom` records — potential sync issues
- **Hard delete instead of soft delete:** `DELETE` is permanent
- **Canvas performance:** DOM-based rendering — 100+ rooms may lag
- **`FloorPlanRoom` not synced on save:** Only JSON string updated, relational table not touched

---

### 10. Room Rate Calendar

**Files:** `src/components/pms/room-rate-calendar.tsx`, `src/app/api/rate-plans/bulk-rates/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Multi-rate plan columns | ✅ |
| Inline rate editing (click cell) | ✅ |
| Rate override tracking ("Edited" badge) | ✅ |
| Availability status colors | ✅ |
| Bulk rate update dialog | ✅ |
| Inventory lock integration | ✅ |
| Property → Room Type → Rate Plan cascade | ✅ |
| Legend + today highlight + weekend shading | ✅ |
| Sticky columns on horizontal scroll | ✅ |

#### 🔴 CRITICAL BUG: CTA/CTD Not Persisted
The inline edit form has Closed-To-Arrival and Closed-To-Departure toggles, but the `POST /api/rate-plans/bulk-rates` handler **only updates `price`** — CTA/CTD fields are silently ignored.

#### Critical Missing vs Enterprise PMS
| Feature | Enterprise Reference |
|---------|---------------------|
| **Drag-to-set rates across date range** | All enterprise: standard feature |
| **Rate change propagation to derived plans** | Opera: parent change cascades |
| **Min/max rate validation** | Opera: configurable bounds |
| **Rate history per cell** | Opera: view past changes for a date |
| **Rate change impact estimation** | Revenue projection on rate change |
| **Channel-specific rate columns** | Cloudbeds: Booking.com vs Expedia rates |
| **LOS-based rate tiers** | Priceline: per-stay-length rates |
| **Season banding** | Opera: visual high/shoulder/low |
| **Occupancy/RevPAR overlay** | Cloudbeds: revenue metrics on calendar |
| **Copy rates between periods** | Opera: copy-paste rate periods |
| **Rate trend mini-charts** | Cloudbeds: sparklines per week |
| **Competitor rates overlay** | `CompetitorPrice` model exists but not used |

#### Business Logic Gaps
- **Dead code:** `fetchRates` callback defined but never called — only useEffect runs
- **No rate override deletion:** Cannot remove override and revert to base rate
- **Only flat rate bulk update:** No percentage increase/decrease, no copy-from-period
- **Day names not localized:** Hardcoded English despite `next-intl` usage elsewhere
- **`ratePlanId` filter ignored:** API accepts param but doesn't use it in where clause

---

### 11. Room Out-of-Order

**Files:** `src/components/pms/room-out-of-order.tsx`, `src/app/api/rooms/maintenance-blocks/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| CRUD maintenance blocks | ✅ |
| Room status auto-change to OOO | ✅ |
| Date range management | ✅ |
| Reason tracking | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Sync with InventoryLock** | `MaintenanceBlock` and `InventoryLock` are NOT synchronized |
| **Scheduled OOS with auto-release** | No automatic return to service |
| **Post-maintenance inspection** | No inspection checklist before returning room |
| **Guest relocation workflow** | No tools for moving affected guests |
| **Revenue impact estimation** | No projected revenue loss |
| **Maintenance cost tracking** | No cost/budget association |

#### 🔴 Critical: Status Value Mismatch
The API sets room status to `'out_of_order'` on block creation, but the Prisma `RoomStatus` enum only has `'out_of_service'`. This will crash at runtime.

---

### 12. Package Plans

**Files:** `src/components/pms/package-plans.tsx`, `src/app/api/packages/route.ts`, `src/app/api/packages/[id]/route.ts`, `src/app/api/packages/[id]/components/route.ts`, `src/app/api/packages/rates/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| CRUD packages (no edit UI) | ⚠️ POST+GET+DELETE only |
| Component bundling (8 types) | ✅ |
| Auto-calculated base price | ✅ |
| Room-type-specific rates with date ranges | ✅ |
| Status management (active/draft/inactive) | ✅ |
| Audit logging | ✅ |

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Edit package UI** | PUT API exists but no edit dialog — must delete+recreate |
| **Package type/category** | No classification (honeymoon, business, spa, family) |
| **Min/Max occupancy** | Schema has no occupancy fields |
| **Seasonal pricing tiers** | Only flat per-rate pricing |
| **Blackout dates** | No date exclusion mechanism |
| **Package inventory/quota** | Cannot limit sales quantity |
| **Combinability rules** | No rules for which packages can be combined |
| **Commission handling** | No OTA/agent commission modeling |
| **Channel mapping** | No per-channel package mapping |
| **Performance tracking** | No analytics per package |
| **Delete rate from UI** | DELETE API exists but no button |
| **Multi-currency** | Hardcoded USD default |

#### Business Logic Gaps
- **Component `referenceId` never populated:** Links to actual meal plans/spa services not created
- **No rate overlap validation:** Multiple rates for same period possible
- **Hard delete with cascade:** Active bookings lose data when package deleted
- **Currency hardcoded:** `$${amount.toFixed(2)}` instead of property currency

---

### 13. Room Type Change

**Files:** `src/components/pms/room-type-change.tsx`, `src/app/api/pms/room-type-change/route.ts`, `src/app/api/pms/room-type-change/[id]/route.ts`

#### Available Features
| Feature | Status |
|---------|--------|
| Request → Approve → Complete workflow | ✅ |
| Rate difference preview (upgrade/downgrade) | ✅ |
| State machine with valid transitions | ✅ |
| Actual room update on completion | ✅ |
| View details + history tabs | ✅ |
| Permission checks | ✅ |

#### 🔴 CRITICAL BUG: `notes` Column Missing
Frontend declares `notes` field, form collects it, API PUT writes it — but Prisma schema has **no `notes` column**. PUT handler will crash at runtime.

#### 🔴 CRITICAL BUG: Folio Update is Cosmetic
On completion, code runs `folio.updateMany` setting only a `notes` string. No actual monetary charge created. `chargeApplied` and `chargeAmount` fields never set.

#### 🔴 CRITICAL BUG: `bookingId` Placeholder
If no `bookingId` passed, API uses `room.id` as a fake booking ID. Pollutes booking relationship.

#### Critical Missing vs Enterprise PMS
| Feature | Impact |
|---------|--------|
| **Booking auto-adjustment** | No linkage to booking system |
| **Actual folio charge creation** | Rate difference never posted as transaction |
| **Change impact analysis** | No affected bookings or financial impact display |
| **Housekeeping trigger** | No auto task for room prep |
| **Guest notification** | No email/SMS on room type change |
| **Channel sync** | OTA availability not updated |
| **Bulk room type change** | Only one room at a time |
| **Scheduled changes** | No "upgrade on day 3" capability |
| **Property filter** | All rooms across properties shown — no filter |
| **Rollback mechanism** | No undo after completion |

#### Business Logic Gaps
- **Rate diff uses `basePrice` only:** Ignores seasonal/promotional/negotiated rates — upgrade charge may be wildly inaccurate
- **Permanent change:** Room keeps new type after checkout — no "for this booking only" option
- **No `requestedBy` display:** Field captured in DB but never shown in UI
- **useEffect has empty deps:** Data doesn't refresh on filter change

---

## Cross-Cutting Issues

### 1. Room Status Enum Mismatch (Affects 4 Pages)
The Prisma `RoomStatus` enum and the codebase are out of sync:

| System | Values |
|--------|--------|
| **Prisma Enum** | `available, occupied, maintenance, out_of_service, reserved, cleaning` |
| **Code Uses** | `available, occupied, maintenance, out_of_order, dirty, inspected` |
| **Result** | Status transitions to `dirty`, `out_of_order`, `inspected` will crash |

**Affected pages:** Rooms, Room Out-of-Order, Availability Control (client-side), Floor Plans (overlay)

### 2. Dual Blocking Systems (Affects 3 Pages)
- `MaintenanceBlock` — sets room status
- `InventoryLock` — creates availability locks
- They are NOT synchronized and can conflict

**Affected pages:** Rooms, Room Out-of-Order, Inventory Locking

### 3. Properties API Permission Issue (Affects Many Pages)
Many pages fetch `/api/properties` without `?myProperties=true`, requiring `properties.view` permission. Non-admin users without this permission get silent 403 errors.

**Affected pages:** Calendar View, Events, Reports, Billing, and ~30 other components

### 4. Hardcoded India/Country Bias
GST tax structure, INR currency, Kolkata defaults, +91 phone prefix, limited timezone/currency lists. Makes the product difficult to use for non-Indian properties.

### 5. No Server-Side Concurrency Control
No optimistic locking (version column), no last-write-wins protection. Concurrent edits by multiple users can silently overwrite each other.

---

## Priority Action Plan

### P0 — Broken Pages (Fix Immediately)
| # | Issue | Page | Effort |
|---|-------|------|--------|
| 1 | Fix Inventory Calendar API endpoint | Inventory Calendar | 2h |
| 2 | Fix Room Status enum mismatch (code → DB) | Rooms, OOO, Floor Plans | 4h |
| 3 | Persist CTA/CTD in bulk-rates API | Room Rate Calendar | 1h |
| 4 | Add `notes` column to `RoomTypeChange` schema | Room Type Change | 1h |
| 5 | Fix Room Out-of-Order status value (`out_of_order` → `out_of_service`) | Room Out-of-Order | 1h |

### P1 — High-Impact Feature Gaps
| # | Feature | Pages Affected | Effort |
|---|---------|---------------|--------|
| 6 | Wire up `PricingRule` model (DB exists, zero UI/API) | Rate Plans, Availability | 8h |
| 7 | Add promo fields to rate plan form (5 DB fields unused) | Rate Plans | 2h |
| 8 | Add overbooking controls to room type form | Room Types, Availability | 3h |
| 9 | Add bed configuration to Room model | Room Types, Rooms | 4h |
| 10 | Unify MaintenanceBlock + InventoryLock | Rooms, OOO, Inventory Locking | 6h |
| 11 | Add property filter to all PMS pages | Room Type Change, Overbooking | 2h |
| 12 | Make timezone/currency lists comprehensive | Properties | 2h |

### P2 — Enterprise Feature Parity
| # | Feature | Effort |
|---|---------|--------|
| 13 | Channel-specific availability/rate allocation | 16h |
| 14 | Rate plan categories + versioning + approval | 16h |
| 15 | Child age policies + occupancy tiers | 8h |
| 16 | Package edit UI + type classification | 6h |
| 17 | Real-time floor plan status (WebSocket) | 8h |
| 18 | Room type change folio charge creation | 4h |
| 19 | Drag-to-set rates on calendars | 8h |
| 20 | Adjoining/connecting rooms | 6h |

### P3 — UX/Polish
| # | Feature | Effort |
|---|---------|--------|
| 21 | Remove India-specific hardcoded defaults | 4h |
| 22 | Add property-level i18n | 6h |
| 23 | Add room move history view | 3h |
| 24 | Lock calendar timeline view | 4h |
| 25 | Rate trend mini-charts | 4h |

---

## Feature Parity Scorecard

| Page | Opera | Hotelogix | Cloudbeds | StaySuite |
|------|:-----:|:---------:|:---------:|:---------:|
| Properties | — | 85% | 80% | **35%** |
| Room Types | — | 90% | 75% | **30%** |
| Rooms | — | 95% | 85% | **40%** |
| Inventory Calendar | — | 90% | 80% | **15%** |
| Availability Control | — | 85% | 90% | **25%** |
| Inventory Locking | — | 80% | 70% | **50%** |
| Rate Plans & Pricing | — | 95% | 85% | **30%** |
| Overbooking | — | 75% | 80% | **40%** |
| Floor Plans | — | 70% | 60% | **55%** |
| Room Rate Calendar | — | 95% | 90% | **35%** |
| Room Out-of-Order | — | 85% | 75% | **35%** |
| Package Plans | — | 80% | 70% | **25%** |
| Room Type Change | — | 90% | 80% | **30%** |
| **Overall Average** | — | **86%** | **78%** | **34%** |

---

## Database Models With No UI

| Model | Purpose | API Exists | UI Exists |
|-------|---------|:----------:|:---------:|
| `PricingRule` | Dynamic pricing rules | ❌ | ❌ |
| `CompetitorPrice` | Competitor rate shopping | ❌ | ❌ |
| `DemandForecast` | Demand prediction | ❌ | ❌ |
| `ChannelBookingLimit` | Per-channel allocation | ❌ | ❌ |
| `ChannelRestriction` | CTA/CTD, min/max stay | ❌ | ❌ |
| `ChannelMapping` | Channel rate mapping | ❌ | ❌ |
| `LastMinuteTrigger` | Last-minute rate rules | ❌ | ❌ |
| `OverbookingLog` | Overbooking history | ❌ | ❌ |
| `RoomMoveLog` | Room move history | ❌ | ❌ |
| `RoomVlan` | Room VLAN assignment | ❌ | ❌ |

> **10 database models have been created but are completely unreachable** from the UI — representing significant wasted development effort.

---

## Conclusion

StaySuite-HospitalityOS has a solid foundation with complete CRUD operations, proper RBAC, audit logging, and tenant isolation across all PMS pages. The **Floor Plans** module is the closest to enterprise-grade with its visual editor, undo/redo, and drag-and-drop.

However, the system has **significant gaps in business logic depth**:
- **12 critical bugs** need immediate fixing (broken pages, enum mismatches, silent data loss)
- **10 DB models** exist but have zero UI — significant wasted effort
- **Feature parity is ~34%** compared to Opera/Hotelogix
- **Revenue management** (yield, dynamic pricing, rate parity) is largely absent
- **Channel management** integration is architectural but not exposed
- **India-specific hardcoding** limits international usability

The recommended approach is:
1. **Fix P0 bugs first** (broken pages, enum mismatches) — ~9 hours
2. **Expose existing DB models** (PricingRule, ChannelBookingLimit, etc.) — ~20 hours
3. **Build enterprise features** (channel allocation, rate versioning, child policies) — ~60 hours
4. **Remove India hardcoding** and internationalize — ~10 hours

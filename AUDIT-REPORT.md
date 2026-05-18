# StaySuite HospitalityOS — Full Lifecycle Audit Report
## As Tested By: Tenant Admin / Hotel Owner

---

## Executive Summary

I tested the entire StaySuite PMS as a hotel owner would use it — from dashboard to check-in, billing, housekeeping, WiFi, reports, and night audit. I found **8 CRITICAL**, **16 HIGH**, **18 MEDIUM**, and **10 LOW** severity issues across all modules.

The **most dangerous issues** would cause:
- 💰 **Revenue leakage** — WiFi fees posted to closed folios, invoices missing charges
- 🏨 **Room integrity failures** — Night audit releasing all occupied rooms, double-booking
- 🔐 **Broken guest flows** — Captive portal room-number login completely non-functional
- 📊 **Inaccurate KPIs** — Dashboard revenue includes cancelled bookings

---

## 🔴 CRITICAL (8 Issues) — Fix Immediately

### C-01: Night Audit Uses Wrong Booking Status — Releases ALL Occupied Rooms
- **Module**: Night Audit
- **Issue**: Night audit queries bookings with `status: 'in_house'` but the actual status is `'checked_in'`. Since no bookings match, Step 4 (room reconciliation) marks ALL occupied rooms as `'available'` — making them bookable while guests are still in-house.
- **Impact**: After running night audit, every occupied room gets released. New guests could be assigned to already-occupied rooms.
- **Evidence**: `src/app/api/night-audit/route.ts:250,429` vs `src/app/api/bookings/[id]/route.ts:295-302`

### C-02: WiFi Room-Number Login Completely Broken
- **Module**: WiFi Captive Portal
- **Issue**: Room-number auth method queries `status: 'in_house'` which doesn't exist in the booking state machine. Guests CANNOT log in via room number + last name on the captive portal. This is a fundamental broken flow.
- **Impact**: No guest can use WiFi via room authentication. MAC addresses never stored. Auto-reauth never works.
- **Evidence**: `src/app/api/v1/wifi/auth/route.ts:975`

### C-03: Kiosk Checkout Skips ALL Financial Processing
- **Module**: Front Desk / Express Kiosk
- **Issue**: Kiosk checkout only updates booking status + room status. It does NOT: close folio, generate invoice, post WiFi fees, award loyalty points, or trigger housekeeping automation.
- **Impact**: Guests self-checking out via kiosk leave with open folios, no invoice, and rooms may not get cleaned.
- **Evidence**: `src/app/api/frontdesk/kiosk-checkout/route.ts:78-129`

### C-04: WiFi Fees Posted to Already-Closed Folio
- **Module**: Check-Out / Billing
- **Issue**: In checkout flow, `autoCloseFolioAndGenerateInvoice()` is called FIRST (closes folio, generates invoice), THEN WiFi usage fees are posted to the now-closed folio. The invoice total doesn't include WiFi charges.
- **Impact**: Financial data corruption — invoice ≠ folio total. Revenue leakage on WiFi fees.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:630-698`

### C-05: Housekeeping Can Release Occupied Rooms
- **Module**: Housekeeping Automation
- **Issue**: `inspectAndReleaseRoom()` sets room to `'available'` without checking for active `checked_in` bookings. A supervisor can accidentally release a room while the guest is still in-house.
- **Impact**: Double-booking — released room could be assigned to a new guest.
- **Evidence**: `src/lib/housekeeping-automation.ts:125-144`

### C-06: Kiosk Checkout Sets Invalid Room Status
- **Module**: Front Desk / Housekeeping
- **Issue**: Kiosk checkout sets room `status: 'vacant'` which is NOT in the `VALID_TRANSITIONS` map. Housekeeping dashboard looks for `status: 'dirty'` to find rooms needing cleaning — kiosk rooms are missed.
- **Impact**: Rooms never get cleaned after kiosk checkout. Housekeeping dashboard underreports dirty rooms.
- **Evidence**: `src/app/api/frontdesk/kiosk-checkout/route.ts:108-114` vs `src/app/api/rooms/[id]/route.ts:10-18`

### C-07: PUT Cancellation Doesn't Release Room
- **Module**: Booking Lifecycle
- **Issue**: PUT `/api/bookings/[id]` with `status: 'cancelled'` emits events but never updates room status. The dedicated POST cancel endpoint does. Two different cancellation behaviors — PUT leaves room permanently stuck as `'occupied'`.
- **Impact**: Room blocked indefinitely after PUT cancellation. No other guest can be assigned.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:842-909` vs `src/app/api/bookings/[id]/cancel/route.ts:142-148`

### C-08: Discount Exceeds Base Price — Negative Room Rate
- **Module**: Rate Plans
- **Issue**: `discountAmount` validated only for `>= 0` but NOT capped against `basePrice`. Effective price = `basePrice - discountAmount` can go negative.
- **Impact**: Promotional pricing yields negative room rates — hotel pays guests.
- **Evidence**: `src/app/api/rate-plans/route.ts:88-93,237-242`

---

## 🟠 HIGH (16 Issues) — Fix This Sprint

### H-01: No Balance Check Before Checkout
- **Module**: Check-Out
- **Issue**: Neither admin nor kiosk checkout requires folio balance to be zero. Guests can check out with unpaid charges.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:625`

### H-02: Today's Revenue KPI Includes Cancelled Bookings
- **Module**: Dashboard
- **Issue**: `todaysRevenue` sums ALL bookings checking in today with no status filter. Cancelled and draft bookings inflate the revenue KPI.
- **Evidence**: `src/app/api/dashboard/route.ts:116-121`

### H-03: Room Status Inconsistency Across Checkout Paths
- **Module**: Room Sync
- **Issue**: Admin checkout → `'dirty'`, Kiosk checkout → `'vacant'` + `'housekeepingStatus: dirty'`. Housekeeping dashboard only checks `status: 'dirty'`.
- **Evidence**: Multiple files

### H-04: Room `occupied→available` Transition Allows Without Booking Check
- **Module**: Room Management
- **Issue**: PUT `/api/rooms/[id]` allows `occupied→available` without checking for active bookings.
- **Evidence**: `src/app/api/rooms/[id]/route.ts:10-18,199-207`

### H-05: Maintenance Rooms Included in Availability Total
- **Module**: Availability
- **Issue**: Availability endpoint excludes `out_of_order` rooms but includes `maintenance` rooms. Available rooms endpoint correctly excludes both.
- **Evidence**: `src/app/api/availability/route.ts:117-119,173`

### H-06: Overbooking Config Not Integrated with Availability Engine
- **Module**: Revenue / Availability
- **Issue**: Overbooking module exists but availability/booking engines never query it. Guests rejected even when overbooking slots available.
- **Evidence**: `src/app/api/availability/route.ts` (no overbooking logic)

### H-07: $0 Rate Plan Can Be Created
- **Module**: Rate Plans
- **Issue**: `basePrice` validation allows `0`. No minimum price guard.
- **Evidence**: `src/app/api/rate-plans/route.ts:194-199`

### H-08: Room Nights Not Updated on Early Checkout
- **Module**: Guest Stay Report
- **Issue**: `roomNights` calculated at check-in, never recalculated on early checkout. Report shows inflated room nights.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:499-517` vs `src/app/api/reports/guest-stay-report/route.ts:644`

### H-09: Checkout Transaction Can Leave Half-Completed State
- **Module**: Check-Out
- **Issue**: Booking status updated BEFORE the transaction. If transaction fails, booking is `checked_out` but folio open, room still `occupied`.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:374,629-754`

### H-10: Captive Portal Voucher Missing `validFrom` Check
- **Module**: WiFi Vouchers
- **Issue**: Portal auth checks `validUntil` but NOT `validFrom`. Future-dated vouchers can be redeemed early.
- **Evidence**: `src/app/api/v1/wifi/auth/route.ts:834`

### H-11: Admin Voucher "Use" Has Race Condition
- **Module**: WiFi Vouchers
- **Issue**: Admin voucher redemption reads then writes without transaction. Two concurrent requests could both succeed.
- **Evidence**: `src/app/api/wifi/vouchers/route.ts:360-554`

### H-12: Dual Status Fields Create Housekeeping Confusion
- **Module**: Housekeeping
- **Issue**: Room has both `status` and `housekeepingStatus`. Different checkout paths set different combinations. Dashboard queries only one field.
- **Evidence**: `src/app/api/housekeeping/dashboard/route.ts:62-83`

### H-13: Suggest-Room Route Missing Permission Check
- **Module**: Front Desk
- **Issue**: Any authenticated user can view room suggestions with guest preference data.
- **Evidence**: `src/app/api/frontdesk/suggest-room/route.ts:9-11`

### H-14: Voucher Plan Lookup Missing Tenant Filter
- **Module**: WiFi Vouchers
- **Issue**: Plan lookup doesn't verify plan belongs to same tenant. Cross-tenant voucher creation possible.
- **Evidence**: `src/app/api/wifi/vouchers/route.ts:175`

### H-15: Bookings Without Room Assignment Inflate Availability Count
- **Module**: Availability
- **Issue**: Daily availability counts unassigned bookings against room type total.
- **Evidence**: `src/app/api/availability/route.ts:200-204`

### H-16: Check-In Race Condition — Two Admins, Same Room
- **Module**: Front Desk
- **Issue**: Check-in updates room to `occupied` without first checking if already occupied. No locking mechanism.
- **Evidence**: `src/app/api/bookings/[id]/route.ts:492-496`

---

## 🟡 MEDIUM (18 Issues)

| # | Module | Issue |
|---|--------|-------|
| M-01 | Revenue | No unified dynamic pricing route |
| M-02 | Revenue | Pricing rule allows negative values for non-discount types |
| M-03 | WiFi | Voucher session timeout uses portal default, ignores plan validity |
| M-04 | WiFi | WiFiUser provisioned before session limit check (orphan on error) |
| M-05 | WiFi | Voucher max devices not enforced in admin "use" route |
| M-06 | Billing | Room-move doesn't post rate difference charge to folio |
| M-07 | Housekeeping | Kiosk checkout doesn't trigger housekeeping automation |
| M-08 | Front Desk | Auto-assign sets room 'occupied' before physical check-in |
| M-09 | Check-Out | Kiosk checkout skips loyalty point awarding |
| M-10 | Guest Stay Report | Revenue uses booking total, not folio total |
| M-11 | Guest Stay Report | Date boundary excludes partial stays |
| M-12 | Guest Stay Report | Late checkout fees excluded from revenue |
| M-13 | Availability | Inventory locks double-counted per room per day |
| M-14 | Night Audit | No handling for in-progress check-ins/outs |
| M-15 | Night Audit | No-show room release bypasses housekeeping |
| M-16 | Front Desk | Kiosk checkout has no authentication |
| M-17 | Check-Out | Checkout status write outside transaction (same as H-09 root cause) |
| M-18 | WiFi | Voucher cross-tenant lookup in auth route |

---

## 🟢 LOW (10 Issues)

| # | Module | Issue |
|---|--------|-------|
| L-01 | Availability | Cache declared but never used (dead code) |
| L-02 | Availability | No startDate < endDate validation |
| L-03 | Dashboard | Arrivals count excludes already checked-in guests |
| L-04 | Dashboard | Room-based vs booking-based occupancy calc divergence |
| L-05 | Dashboard | In-memory cache doesn't work in multi-instance |
| L-06 | WiFi | In-memory OTP store (acknowledged with warning) |
| L-07 | Permissions | Different auth helpers across modules |
| L-08 | Permissions | Wildcard `'*'` grants full system access |
| L-09 | WiFi | Captive portal auth has no auth (by design, rate-limited) |
| L-10 | Night Audit | No-show room release skips HK (same as M-15 root cause) |

---

## Priority Fix Order

### Phase 1 — Emergency (This Week)
1. **C-01**: Fix `'in_house'` → `'checked_in'` in night audit — prevents releasing all rooms
2. **C-02**: Fix `'in_house'` → `'checked_in'` in WiFi auth — unblocks room-number login
3. **C-05**: Add active-booking guard to `inspectAndReleaseRoom()` — prevents double-booking
4. **C-06**: Fix kiosk checkout room status to `'dirty'` — aligns with HK flow
5. **C-03**: Add folio/invoice/loyalty/HK trigger to kiosk checkout
6. **C-04**: Reorder checkout: post WiFi fees BEFORE closing folio

### Phase 2 — High Priority (Next Sprint)
7. **C-07**: Add room release to PUT cancellation handler
8. **C-08**: Cap discount to basePrice, add minimum price guard
9. **H-01-H-16**: Fix remaining HIGH issues (see table above)

### Phase 3 — Medium Priority (Following Sprint)
10. **M-01 to M-18**: Fix all medium issues

---

## Positive Findings ✅

Despite the issues above, several things are well-implemented:

- ✅ **Double-booking prevention** in booking creation uses `Serializable` transaction isolation
- ✅ **Folio auto-creation** on booking with initial room charge
- ✅ **Closed folio protection** blocks line item creation/deletion on closed folios
- ✅ **Server-side folio recalculation** ignores client-sent financial values
- ✅ **Room move** properly updates both old and new rooms in transaction
- ✅ **WiFi MAC address storage** correctly normalizes and stores for auto-reauth
- ✅ **Admin WiFi routes** properly protected with `wifi.manage` permission
- ✅ **WebSocket events** emitted for real-time room grid updates
- ✅ **Booking idempotency** key prevents duplicate creation
- ✅ **Captive portal voucher atomic redemption** uses `updateMany` with `where: { isUsed: false }`

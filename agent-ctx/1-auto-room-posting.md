# Task 1: Auto Room Charge Posting - Complete

## Summary
Implemented automatic room charge posting for StaySuite Billing module with three deliverables:

### Files Created:
1. **`src/lib/billing/room-charge.ts`** - Rate Calculation Helper
   - `calculateRoomCharge(booking, property, date)` - Core function
   - Priority: price_override → rate_plan → booking_rate → fallback_zero
   - Applies active pricing rules (seasonal, weekend, occupancy, dynamic, etc.)
   - Calculates tax using property's `taxComponents` JSON or `defaultTaxRate`
   - Returns `{ baseRate, taxAmount, totalAmount, rateSource, taxComponents, currency }`

2. **`src/app/api/cron/auto-room-posting/route.ts`** - API Route
   - **GET** with `?cron=true` + Bearer token: Processes all active properties (cron scheduler)
   - **GET** without cron flag: Returns last execution status + pending charge count (authenticated)
   - **POST** `{ propertyId }`: Manual trigger for a specific property (RBAC protected)
   - Uses `db.$transaction` per booking for atomic line item creation + folio total update
   - Checks for duplicate charges (same date + category "room_charge")
   - In-memory execution tracking for last run status

3. **`src/components/billing/folios.tsx`** - Modified (Billing Page Integration)
   - Added Auto Room Posting status card between stats and filter sections
   - Shows: last run timestamp, charges posted count, pending today count
   - "Post Room Charges Now" button with loading state
   - Visual indicators: green checkmark (no errors), amber alert (errors present)

### Key Design Decisions:
- Category `"room_charge"` used to distinguish auto-posted charges from manual ones
- `postedBy: 'system:auto_room_posting'` for audit trail
- Property tax settings (`taxComponents` JSON) properly parsed and applied
- Pricing rules evaluated in priority order with property + room type filtering
- Date comparisons use UTC normalization for consistency

### Lint/TypeScript:
- No new lint errors introduced (367 pre-existing errors unrelated to changes)
- No TypeScript compilation errors in new files

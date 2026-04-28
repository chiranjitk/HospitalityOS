# Task 2 — Promotions & Offers Page

## Summary
Created a full-featured "Promotions & Offers" page for managing hotel pricing promotions (promo codes, discount deals, seasonal packages). This is NOT about email campaigns — it's about pricing promotions with promo codes, discount types, usage tracking, and scheduling.

## Files Created

### 1. `src/app/api/marketing/promotions/route.ts` (275 lines)
Full CRUD API route with tenant isolation:
- **GET**: Lists promotions with server-side filters (status, tab, search, discountType). Also returns computed stats (total, active, totalSavings, expiringSoon).
- **POST**: Creates a new promotion with validation (required fields, duplicate code check). Parses all numeric fields, auto-uppercases promo code.
- **PUT**: Updates promotion by ID. Checks tenant ownership. Handles partial updates. Validates duplicate code on change.
- **DELETE**: Deletes promotion by ID with tenant ownership check.

### 2. `src/components/marketing/promotions.tsx` (1014 lines)
Comprehensive React client component with:

**Header**: Title "Promotions & Offers" with subtitle and Create/Refresh buttons.

**4 Stats Cards**:
1. Total Promotions (count)
2. Active Promotions (count, green)
3. Total Savings Offered (formatCurrency sum, teal)
4. Expiring Soon (count, amber)

**Tabs**: All Promotions, Active, Scheduled, Expired — server-side filtering.

**Filters Bar**:
- Search input (by name or code) with clear button
- Discount Type select (All / Percentage / Fixed Amount / Free Night)

**Promotion Cards Grid** (responsive: 1/2/3 cols):
- Name + status badge (active=green, paused=amber, expired=gray, depleted=red)
- Promo code in monospace badge with copy-to-clipboard
- Discount display with icon (Percent/DollarSign/Moon)
- Date range with CalendarClock icon
- Usage progress bar (when maxUses set) or unlimited indicator
- Restrictions: min booking value, min nights, max per user badges
- Applicable room types as badges
- Action buttons: Edit, Pause/Activate toggle, Delete
- Amber top stripe for promotions expiring within 7 days

**Create/Edit Dialog** (max-w-2xl):
- Basic Info: Name, Promo Code with auto-generate button, Description textarea
- Discount: Type selector, Value input with contextual suffix (%/₹/nights), Max Discount cap for percentage
- Restrictions: Min Booking Value, Min Nights, Applicable Room Types multi-checkbox
- Schedule: Start/End datetime-local inputs
- Usage Limits: Max Total Uses, Max Per User
- Status toggle (active/paused)

**Delete Confirmation**: AlertDialog with descriptive warning text.

**Empty State**: Custom EmptyState component with contextual messaging.

**Loading States**: Skeleton cards (6 grid placeholders) and skeleton stats.

**Technical Details**:
- `'use client'` directive
- `toast` from 'sonner' for notifications
- `useCurrency()` from `@/contexts/CurrencyContext` for currency formatting
- `date-fns` (format, parseISO, isWithinInterval, addDays) for date handling
- All shadcn/ui components: Card, Button, Dialog, Input, Select, Badge, Tabs, Skeleton, Progress, Switch, AlertDialog, Textarea, Label
- No indigo/blue colors
- Responsive mobile-first design
- Proper TypeScript interfaces for all data structures
- Room types fetched from `/api/room-types` for the multi-select
- Server returns 401 (unauthorized) without auth — API verified working

## API Endpoint
`/api/marketing/promotions` — GET/POST/PUT/DELETE, verified responding (401 without auth token as expected).

## Design Consistency
Followed patterns from existing marketing components (`review-sources.tsx`, `direct-booking-engine.tsx`):
- Same import style and component organization
- Same stat card layout pattern
- Same toast/error handling patterns
- Same dialog structure and button sizing

# Task 3 — Promotions CRUD API

## Agent: promotions-api
## Status: Completed

### Work Log:
- Read worklog.md to understand project context and conventions
- Studied existing API patterns in `src/app/api/campaigns/route.ts` and `src/app/api/marketing/seo-analytics/route.ts`
- Studied auth helpers in `src/lib/auth-helpers.ts` — confirmed `getUserFromRequest` + `hasPermission` pattern
- Confirmed `db` import from `@/lib/db` and Promotion model exists in `prisma/schema.prisma`
- Created `src/app/api/marketing/promotions/route.ts` with full CRUD (GET, POST, PUT, DELETE)

### Implementation Details:

#### GET /api/marketing/promotions
- Query params: `?status=active&search=holiday&type=percentage`
- Filters by status (active/paused/expired/depleted/all), discountType, search (name/code case-insensitive)
- Auto-expires promotions where `endsAt < now()` and status is still 'active'
- Auto-depletes promotions where `usedCount >= maxUses` and maxUses is set
- Returns stats: total, active, scheduled (startsAt > now), expired, expiringSoon (within 7 days), totalSavings (sum of usedCount * discountValue)

#### POST /api/marketing/promotions
- Validates: name, code (unique check with toUpperCase), discountType enum, discountValue > 0
- Type-specific validation: percentage (1-100, optional maxDiscount), fixed_amount (>0), free_night (integer >= 1)
- Validates startsAt < endsAt
- Auto-resolves propertyId from first property of tenant if not provided
- Stores applicableRoomTypes as JSON string
- Code stored in uppercase

#### PUT /api/marketing/promotions
- Validates tenant ownership
- Only allows editing active or paused promotions (expired/depleted cannot be edited except to archive)
- Validates status transitions: active↔paused, any→expired, expired/depleted→archived
- Re-validates code uniqueness on change
- Re-validates date range, discount type/value constraints
- Handles applicableRoomTypes array→JSON conversion

#### DELETE /api/marketing/promotions?id=xxx
- Validates tenant ownership
- Only allows deleting active, paused, or expired promotions
- Hard delete from database

### Patterns Followed:
- Auth: `getUserFromRequest(request)` + `hasPermission(user, 'marketing.manage') || hasPermission(user, 'marketing.*')`
- Response format: `{ success: true, data: ... }` / `{ success: false, error: { code, message } }`
- Error codes: UNAUTHORIZED (401), FORBIDDEN (403), VALIDATION_ERROR (400), NOT_FOUND (404), INTERNAL_ERROR (500)
- Tenant isolation: all queries filtered by `tenantId`
- Imports: `NextRequest`/`NextResponse` from `next/server`, `db` from `@/lib/db`

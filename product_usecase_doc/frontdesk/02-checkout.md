# Check-Out

> **Section ID**: `frontdesk-checkout`

## Purpose

The Check-Out page handles guest departure and account settlement. It provides front desk agents with a complete overview of the guest's folio (room charges, incidentals, payments), enables payment processing for outstanding balances, manages key card return, and transitions the room back to dirty status for housekeeping. The page is optimized for speed during peak check-out hours (typically 8:00–11:00 AM) when multiple guests depart simultaneously.

The page solves the business problem of ensuring every guest leaves with a settled account, all charges are captured, and rooms are released quickly for the next arrival cycle — directly impacting guest satisfaction and room turnover revenue.

## Key Features

- **Folio Review**: Complete breakdown of all charges (room, F&B, spa, minibar, laundry) and payments (prepaid, deposits, incidental payments) with running balance
- **Payment Settlement**: Process outstanding balance via cash, credit card, or apply to corporate account; support for split payments across multiple methods
- **Key Card Return**: Record return of physical key cards; auto-deactivate encoded cards in the system; flag unreturned cards
- **Room Status Update**: Automatically transition room from `occupied` to `dirty` on check-out confirmation; trigger housekeeping task creation
- **Late Check-Out Request**: Process late check-out requests past the standard check-out time with fee calculation and manager approval
- **Express Check-Out**: Pre-authorized guests can check out without visiting the front desk; folio auto-settled and room released
- **Balance Alert**: Highlight when folio balance is negative (credit owed to guest) or positive (outstanding charges)
- **Invoice Generation**: Auto-generate final invoice/receipt PDF with itemized charges and payment history
- **Departure Survey**: Optional prompt to send guest satisfaction survey via email or SMS

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/bookings/[id]` | Get booking details with folio summary |
| `PUT` | `/api/bookings/[id]` | Update booking status to `checked_out`, record actual check-out time |
| `POST` | `/api/bookings/late-checkout` | Request or approve late check-out with fee calculation |
| `PUT` | `/api/key-cards` | Return/deactivate key cards |
| `GET` | `/api/folio/[id]` | Get complete folio with all line items and payments |
| `POST` | `/api/folio/[id]/settle` | Process payment and settle outstanding balance |

### Request Body (PUT /api/bookings/[id] — Check-Out)

```json
{
  "status": "checked_out",
  "actualCheckOut": "2025-01-18T11:15:00Z",
  "checkedOutBy": "uuid-of-staff-member",
  "keyCardsReturned": 2,
  "folioSettled": true,
  "settlementMethod": "credit_card",
  "lateCheckoutApplied": false,
  "invoiceGenerated": true
}
```

### Request Body (POST /api/bookings/late-checkout)

```json
{
  "bookingId": "uuid",
  "requestedTime": "2025-01-18T14:00:00Z",
  "reason": "late_flight",
  "approvedBy": "uuid-of-manager",
  "feeWaived": false
}
```

### Late Check-Out Fee Tiers

| Checkout Time | Fee | Approval Required |
|---------------|-----|-------------------|
| Standard (before 11:00 AM) | Free | None |
| 11:00 AM – 1:00 PM | 50% of nightly rate | Front desk agent |
| 1:00 PM – 3:00 PM | 100% of nightly rate | Manager |
| After 3:00 PM | Full additional night | Manager + Revenue |

## Business Logic

### Check-Out Validation

1. **Booking must be `checked_in`**: Only checked-in bookings can be checked out. Cannot check out a confirmed or draft booking.
2. **Balance settlement**: The folio balance must be zero (settled) or have an approved credit before check-out is allowed. If outstanding charges exist, the agent must process payment first.
3. **Key card tracking**: The system records how many key cards were issued vs. returned. Unreturned cards are flagged for follow-up and may incur a replacement fee.
4. **Room status transition**: On check-out confirmation, the room status changes from `occupied` to `dirty`, and a housekeeping task is auto-created with `priority` based on next booking's check-in time.

### Late Check-Out Processing

- Late checkout requests check the room's next booking — if another guest is checking in the same day, late checkout may be denied or limited
- Fees are calculated based on the property's configured tiers (see table above)
- VIP guests (Platinum/Gold) receive complimentary late checkout up to 2:00 PM
- Late checkout fees are posted to the folio as a separate line item before final settlement

### Express Check-Out

Guests who have pre-authorized their credit card at check-in can use express check-out:
- No front desk visit required
- Room key can be dropped in the express drop box
- Folio is auto-settled using the pre-authorized card
- Invoice emailed to guest
- Room status updated and housekeeping notified via automation

## Cross-Module Dependencies

| Module | Trigger | Effect |
|--------|---------|--------|
| **PMS — Rooms** | Check-out confirmed | `Room.status` changes from `occupied` to `dirty` |
| **Billing — Folio** | Check-out confirmed | Folio locked (no new charges); final invoice generated |
| **Housekeeping** | Room set to `dirty` | Cleaning task auto-created; priority based on next arrival |
| **Guests** | Check-out completed | `Guest.totalStays` incremented; loyalty points calculated |
| **Dashboard** | Check-out completed | Live departure counter incremented; occupancy updated |
| **Revenue** | Check-out completed | Actual revenue recorded vs. projected |

## User Flow

1. **Search Booking** — Enter room number, guest name, or confirmation code; filter by `checked_in` status
2. **Review Folio** — Display itemized charges and payments; highlight outstanding balance
3. **Process Payments** — If balance > 0, collect payment via cash, card, or corporate account
4. **Review Late Check-Out** — If guest requests late departure, calculate fee and request approval if needed
5. **Collect Key Cards** — Record returned key cards; flag any missing cards
6. **Settle Folio** — Confirm zero balance; lock folio from further charges
7. **Generate Invoice** — Auto-generate PDF invoice with full breakdown
8. **Confirm Check-Out** — Click "Check Out" — room released, housekeeping notified, departure logged

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full check-out operations, waive fees |
| Manager | `frontdesk.manage` | All check-out operations, approve late check-out fees, waive fees |
| Front Desk Agent | `frontdesk.manage` | Standard check-out; late check-out beyond 1hr requires manager approval |
| Night Auditor | `frontdesk.manage` | End-of-day batch check-out processing; can close all due check-outs |
| Cashier | `billing.payments` | Process payments only; cannot change booking status |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Booking not checked in | `NOT_CHECKED_IN` | Cannot check out a booking that isn't checked in |
| Outstanding balance | `FOLIO_NOT_SETTLED` | Process payment to settle balance before check-out |
| Payment declined | `PAYMENT_DECLINED` | Retry with different payment method or contact guest |
| Late checkout conflict | `LATE_CHECKOUT_CONFLICT` | Next guest arriving same day; deny or limit late checkout |
| Key card not returned | `KEY_CARD_MISSING` | Flag in system; apply replacement fee; notify security |
| Folio already locked | `FOLIO_LOCKED` | Check-out already processed; booking is in checked_out status |
| Room already released | `ROOM_ALREADY_DIRTY` | Check-out was already processed by another agent or system |

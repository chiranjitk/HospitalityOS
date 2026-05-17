# Express Kiosk

> **Section ID**: `frontdesk-kiosk`

## Purpose

The Express Kiosk page enables self-service check-in and check-out for guests without requiring a visit to the front desk. Deployed as a standalone touchscreen terminal in the hotel lobby, the kiosk provides a streamlined guest experience — reducing wait times, enabling 24/7 arrivals, and allowing front desk staff to focus on complex requests. The kiosk is designed to be intuitive for guests of all technical skill levels, with a simple step-by-step flow and large, touch-friendly interface elements.

The page solves the business problem of balancing guest demand for fast, autonomous service with the hotel's need for complete data capture (ID verification, registration, payment). The kiosk operates as a public endpoint — no user authentication is required — using a booking code or room number for guest identification.

## Key Features

- **Booking Code Lookup**: Guests enter their booking confirmation code (`SS-XXXXXX`) or scan a QR code from their booking confirmation email
- **Identity Verification**: Guest reviews their pre-registered details and confirms their identity via a checkbox declaration (no document scan at kiosk — pre-arrival KYC required)
- **Self Check-In**: Complete check-in without front desk interaction — room assignment (pre-assigned or auto-assigned), key card dispensing, welcome information
- **Self Check-Out**: Complete check-out without front desk interaction — folio review, payment processing, key card return
- **WiFi Credentials**: Display WiFi network name and password after check-in; optionally print WiFi card
- **Payment Processing**: Accept credit/debit card payments for folio settlement at check-out or deposit at check-in
- **Welcome Information**: Display room number, floor, directions to room, breakfast times, facility hours, and emergency contact
- **Multi-Language Support**: Kiosk interface available in multiple languages (configurable per property)
- **Accessibility Mode**: High-contrast mode, larger text, and screen reader support for guests with disabilities

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/frontdesk/kiosk-session?code=SS-XXXXXX` | Retrieve or create kiosk session for a booking code |
| `POST` | `/api/frontdesk/kiosk-checkin` | Process self-service check-in via kiosk |
| `POST` | `/api/frontdesk/kiosk-checkout` | Process self-service check-out via kiosk |
| `GET` | `/api/frontdesk/kiosk-payment?sessionId=uuid` | Get payment status and folio summary for kiosk |
| `POST` | `/api/frontdesk/kiosk-payment` | Process payment via kiosk terminal |

### Response (GET /api/frontdesk/kiosk-session)

```json
{
  "sessionId": "uuid",
  "bookingId": "uuid",
  "bookingCode": "SS-123456",
  "guestName": "John Doe",
  "status": "confirmed",
  "checkIn": "2025-01-15T15:00:00Z",
  "checkOut": "2025-01-18T11:00:00Z",
  "roomTypeId": "uuid",
  "roomTypeName": "Deluxe King",
  "roomId": null,
  "property": {
    "name": "Grand Hotel",
    "wifiNetwork": "GrandHotel-Guest",
    "wifiPassword": "Welcome2025"
  },
  "canCheckIn": true,
  "canCheckOut": false,
  "kycCompleted": true,
  "termsRequired": true
}
```

### Request Body (POST /api/frontdesk/kiosk-checkin)

```json
{
  "sessionId": "uuid",
  "identityConfirmed": true,
  "termsAccepted": true,
  "termsVersion": "2025-01-01",
  "keyCardsRequested": 1,
  "paymentMethod": "credit_card",
  "depositAmount": 200.00
}
```

### Request Body (POST /api/frontdesk/kiosk-checkout)

```json
{
  "sessionId": "uuid",
  "keyCardsReturned": true,
  "paymentMethod": "credit_card",
  "surveyOptIn": true
}
```

## Business Logic

### Kiosk Session Management

| Rule | Description |
|------|-------------|
| **No authentication required** | Kiosk endpoints are public — identified by booking code, not user login |
| **Session timeout** | Kiosk session expires after 5 minutes of inactivity; guest must re-enter code |
| **Session scope** | One session per booking code; concurrent sessions invalidate the previous one |
| **Rate limiting** | Maximum 10 failed code attempts per IP address per hour to prevent brute force |

### Check-In Rules

| Rule | Description |
|------|-------------|
| **Pre-arrival KYC required** | Guest must have completed online check-in (KYC verified) before using kiosk check-in |
| **ID verification checkbox** | Guest must confirm "I confirm I am [Guest Name] and my ID matches this reservation" |
| **Terms acceptance** | Guest must accept hotel terms and conditions (latest version) before proceeding |
| **Room pre-assignment** | If room was pre-assigned during online check-in, kiosk uses that room; otherwise auto-assigns |
| **Deposit collection** | If deposit not pre-authorized, kiosk prompts for card payment before key dispensing |
| **Key card dispensing** | Kiosk hardware dispenses encoded key card(s); if hardware unavailable, directs to front desk |

### Check-Out Rules

| Rule | Description |
|------|-------------|
| **Folio must be settled** | Outstanding balance must be paid before check-out is allowed |
| **Key card return** | Guest confirms key card return (deposit into kiosk slot if hardware available) |
| **Express checkout** | If guest pre-authorized card at check-in, auto-settle without additional card entry |
| **Invoice delivery** | Final invoice emailed to guest's registered email address |

### Payment Processing

- Kiosk supports EMV chip card and contactless (NFC) payments
- No cash handling at kiosk — cash payments require front desk visit
- Payment failures are handled gracefully with retry prompts
- Large transactions (>property threshold) may require manager PIN override

## Cross-Module Dependencies

| Module | Trigger | Effect |
|--------|---------|--------|
| **Bookings** | Kiosk check-in/out | Booking status updated; `actualCheckIn`/`actualCheckOut` recorded |
| **PMS — Rooms** | Kiosk check-in | Room assigned and status changed to `occupied` |
| **Billing — Folio** | Kiosk check-in | Folio activated; deposit posted |
| **Billing — Payments** | Kiosk check-out | Payment processed; folio settled |
| **Guests** | KYC verification | Pre-arrival KYC status checked; guest profile accessed |
| **WiFi** | Check-in completed | WiFi credentials displayed to guest |
| **Housekeeping** | Check-in/out | Room status transitions trigger housekeeping tasks |
| **Email** | Check-out completed | Invoice and thank-you email sent to guest |
| **Kiosk Settings** | Session start | Kiosk branding, terms, language loaded |

## User Flow (Check-In)

1. **Welcome Screen** — Kiosk displays "Welcome" in property-configured language; "Check-In" and "Check-Out" buttons
2. **Enter Booking Code** — Guest types or scans confirmation code (SS-XXXXXX)
3. **Verify Identity** — Kiosk displays guest name and booking details; guest confirms identity
4. **Accept Terms** — Guest reads and accepts hotel terms and conditions
5. **Review Stay** — Display room type, dates, special requests; guest confirms
6. **Process Deposit** — If required, guest inserts credit card for deposit authorization
7. **Assign Room** — System assigns room (pre-assigned or auto); room number displayed
8. **Dispense Key** — Key card dispensed from kiosk hardware; if unavailable, direct to front desk
9. **Display Info** — Show room number, floor map, WiFi credentials, breakfast times, welcome message
10. **Complete** — "You're all set!" screen with option to print receipt or directions

## User Flow (Check-Out)

1. **Welcome Screen** — Guest selects "Check-Out"
2. **Enter Booking Code** — Guest types or scans confirmation code
3. **Review Folio** — Display itemized charges and payments with outstanding balance
4. **Process Payment** — If balance > 0, guest inserts credit card for payment
5. **Return Key** — Guest inserts key card into kiosk return slot
6. **Confirm Check-Out** — Guest confirms; "Thank you for staying" screen displayed
7. **Email Invoice** — Final invoice emailed to registered address

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Guest (Public) | No auth required | Use kiosk for self check-in/check-out |
| Admin | `admin.frontdesk` | View kiosk sessions, configure kiosk settings, monitor usage |
| Manager | `frontdesk.manage` | View kiosk sessions, override kiosk decisions, disable kiosk |
| Front Desk Agent | `frontdesk.manage` | View kiosk sessions, assist guests at kiosk |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Invalid booking code | `INVALID_BOOKING_CODE` | Display error; suggest entering code again or visiting front desk |
| Booking not found | `BOOKING_NOT_FOUND` | Direct guest to front desk for assistance |
| KYC not completed | `KYC_REQUIRED` | Display message; guest must complete online check-in first or visit front desk |
| Too early for check-in | `EARLY_CHECKIN` | Show standard check-in time; offer to notify front desk |
| Already checked in | `ALREADY_CHECKED_IN` | Display room number and welcome info |
| Payment declined | `PAYMENT_DECLINED` | Retry prompt; if repeated, direct to front desk |
| Kiosk hardware error | `HARDWARE_ERROR` | Display room info; direct to front desk for key card |
| Session expired | `SESSION_EXPIRED` | Return to welcome screen; guest must re-enter code |

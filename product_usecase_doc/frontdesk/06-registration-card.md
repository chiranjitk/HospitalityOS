# Registration Card

> **Section ID**: `frontdesk-reg-card`

## Purpose

The Registration Card page manages the generation and storage of guest registration cards — a legally required document in many jurisdictions that captures comprehensive guest information during check-in. The page allows front desk agents to generate, preview, download, and email PDF registration cards containing guest personal details, travel companions, vehicle information, purpose of visit, and digital signature. Registration cards serve both compliance purposes (government regulations, police reporting) and operational purposes (guest contact information, emergency contacts, billing reference).

The page solves the business problem of collecting and storing complete guest registration data in a standardized, legally compliant format while minimizing manual data entry by pre-populating fields from the guest profile and booking information.

## Key Features

- **PDF Generation**: Server-side PDF generation with hotel branding, guest photo (if captured), and all required fields in a standardized layout
- **Guest Details**: Auto-populated from guest profile — full name, nationality, date of birth, ID document type and number, address, phone, email
- **Companion Registration**: Register additional guests sharing the room — name, ID type, ID number, nationality, relationship to primary guest
- **Vehicle Information**: Capture vehicle license plate, make, model, color, and country of registration for parking management
- **Purpose of Visit**: Categorize the guest's visit (business, leisure, transit, medical, other) with free-text notes
- **Digital Signature**: Capture guest signature on a touchscreen or upload a scanned signature image; embedded in the PDF
- **Hotel Information**: Auto-populated — hotel name, address, license number, check-in/check-out dates, room number, rate
- **Email Delivery**: Send the completed registration card PDF to the guest's email address
- **Historical Access**: View and download previously generated registration cards for any past or current booking

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/folio/registration-card?bookingId=uuid` | Generate and download registration card PDF |
| `POST` | `/api/folio/registration-card` | Generate registration card with custom data and return PDF buffer |

### Request Body (POST /api/folio/registration-card)

```json
{
  "bookingId": "uuid",
  "propertyId": "uuid",
  "guestDetails": {
    "firstName": "John",
    "lastName": "Doe",
    "nationality": "US",
    "dateOfBirth": "1985-03-15",
    "idType": "passport",
    "idNumber": "AB1234567",
    "idExpiry": "2030-06-15",
    "address": "123 Main St, New York, NY 10001",
    "phone": "+1-234-567-8900",
    "email": "john.doe@email.com"
  },
  "companions": [
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "nationality": "US",
      "idType": "passport",
      "idNumber": "CD7654321",
      "relationship": "spouse"
    }
  ],
  "vehicle": {
    "licensePlate": "NY-ABC-1234",
    "make": "Toyota",
    "model": "Camry",
    "color": "Silver",
    "country": "US"
  },
  "purposeOfVisit": "leisure",
  "visitNotes": "Anniversary trip",
  "signatureData": "data:image/png;base64,...",
  "sendEmail": true
}
```

### Response

```json
{
  "registrationCardId": "uuid",
  "bookingId": "uuid",
  "pdfUrl": "/api/folio/registration-card/uuid/download",
  "generatedAt": "2025-01-15T15:30:00Z",
  "emailed": true,
  "guestCount": 2,
  "companionCount": 1
}
```

## PDF Layout Structure

| Section | Content |
|---------|---------|
| **Header** | Hotel name, logo, address, license number, registration card title |
| **Stay Details** | Booking confirmation code, room number, check-in date, check-out date, rate per night |
| **Primary Guest** | Full name, nationality, DOB, ID type/number/expiry, permanent address, phone, email |
| **Companions** | Table of additional guests: name, nationality, ID type/number, relationship |
| **Vehicle** | License plate, make, model, color, registration country (optional section) |
| **Visit Details** | Purpose of visit, arrival/departure method, visit notes |
| **Terms & Conditions** | Hotel policies, liability disclaimer, privacy notice |
| **Signature** | Guest signature image, date, witness (front desk agent name) |
| **Footer** | Barcode/QR code linking to booking, generation timestamp |

## Business Logic

### Mandatory vs. Optional Fields

| Field | Required | Notes |
|-------|----------|-------|
| Primary guest name | Yes | Auto-populated from guest profile |
| Nationality | Yes | Required for police reporting in many jurisdictions |
| ID type and number | Yes | Must match the document presented at check-in |
| ID expiry date | Yes | Must be valid (not expired) |
| Permanent address | Yes | Full residential address |
| Phone number | Yes | At least one contact number |
| Email address | Recommended | Used for PDF delivery and communication |
| Date of birth | Yes | Required for age-restricted services |
| Companions | Optional | Required if additional guests are staying |
| Vehicle details | Optional | Only if guest is using hotel parking |
| Purpose of visit | Recommended | Helpful for services and marketing |
| Digital signature | Yes | Guest must sign (or acknowledge electronic terms) |
| Send email | Optional | Toggle to email PDF to guest |

### Data Source Priority

When generating a registration card, data is sourced in the following priority order:

1. **User input on the form** — Latest edits take precedence
2. **Guest profile** — Auto-populated fields from the guest record
3. **Booking data** — Check-in/out dates, room number, rate from the booking
4. **Property data** — Hotel name, address, license from the property record

### Legal Compliance

- Registration cards are stored for the minimum retention period required by local law (typically 1–5 years)
- Data is encrypted at rest and accessible only to authorized staff
- Guests can request a copy of their registration card under data protection regulations
- PDF includes a hash for tamper detection

## Cross-Module Dependencies

| Module | Dependency | Direction |
|--------|------------|-----------|
| **Bookings** | Booking details (dates, room, rate, confirmation code) | Read |
| **Guests** | Guest profile (name, ID, address, contact) | Read |
| **Billing — Folio** | Registration card stored as folio attachment | Write |
| **PMS — Property** | Hotel branding, name, address, license | Read |
| **Email Service** | PDF delivery to guest email | Write |
| **Storage** | PDF file storage and retrieval | Read/Write |

## User Flow

1. **Navigate to Registration Card** — From the check-in flow or booking detail, click "Generate Registration Card"
2. **Review Pre-Populated Data** — System auto-fills guest details, stay info, and hotel details from existing records
3. **Add Companions** — Enter details for additional guests sharing the room
4. **Enter Vehicle Info** — If guest has a vehicle, enter license plate and details
5. **Select Purpose of Visit** — Choose category and add any notes
6. **Capture Signature** — Guest signs on the touchscreen device or agent uploads scanned signature
7. **Preview PDF** — Review the generated registration card before finalizing
8. **Generate & Send** — Click "Generate" to create the PDF; optionally email to guest
9. **Download** — PDF is available for download and stored in the booking's folio attachments

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Generate, view, download, email all registration cards |
| Manager | `frontdesk.manage` | Generate, view, download, email registration cards |
| Front Desk Agent | `frontdesk.manage` | Generate, view, download registration cards; email requires manager approval |
| Compliance Officer | `compliance.view` | View and download all registration cards for audits |
| Guest | `portal.self` | View and download own registration card via guest portal |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Booking not found | `BOOKING_NOT_FOUND` | Verify booking ID; registration card requires a valid booking |
| Missing mandatory fields | `MISSING_REQUIRED_FIELDS` | Complete all required fields before generating |
| ID document expired | `ID_EXPIRED` | Guest must present a valid (non-expired) ID document |
| PDF generation failed | `PDF_GENERATION_ERROR` | Retry generation; check server logs for template issues |
| Email delivery failed | `EMAIL_FAILED` | PDF is still generated; retry email or download manually |
| Signature capture failed | `SIGNATURE_ERROR` | Retry signature capture; check touchscreen device |
| Storage quota exceeded | `STORAGE_FULL` | Contact admin to free up storage; registration card saved temporarily |

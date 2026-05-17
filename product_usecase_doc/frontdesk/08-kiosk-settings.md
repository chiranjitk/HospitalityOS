# Kiosk Settings

> **Section ID**: `frontdesk-kiosk-settings`

## Purpose

The Kiosk Settings page allows hotel administrators to configure the appearance, behavior, and functionality of the express self-service kiosks. This page controls everything a guest sees and interacts with at the kiosk — from branding elements (hotel logo, colors, welcome message) to operational settings (idle timeout, feature toggles, payment requirements, terms and conditions content). Proper kiosk configuration ensures a consistent brand experience and compliance with property-specific policies.

The page solves the business problem of needing per-property kiosk customization without code changes. Each hotel in a multi-property portfolio may have different branding, policies, languages, and operational requirements. The settings page provides a centralized, form-based interface for non-technical staff to manage all kiosk behavior.

## Key Features

- **Hotel Branding**: Upload hotel logo, set brand colors (primary, secondary, accent), and customize the welcome screen background
- **Color Theme**: Configure the kiosk color scheme — primary color, button colors, text colors, background — with a live preview
- **Welcome Message**: Set a custom welcome greeting displayed on the kiosk home screen (supports multi-language)
- **Idle Timeout**: Configure how long the kiosk waits before returning to the welcome screen after inactivity (30–300 seconds)
- **Feature Toggles**: Enable/disable specific kiosk features independently — check-in, check-out, early check-in, late check-out, WiFi display, receipt printing
- **Terms Content**: Edit the terms and conditions text that guests must accept before check-in; manage version control
- **Payment Requirements**: Configure whether deposit is required at kiosk check-in, maximum transaction amount, and supported payment methods
- **Language Selection**: Enable and prioritize available languages for the kiosk interface
- **Public Settings API**: Separate read-only endpoint for kiosk terminals to fetch settings without authentication
- **Live Preview**: Real-time preview of kiosk screens as settings are changed

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/frontdesk/kiosk-settings?propertyId=uuid` | Get full kiosk configuration (admin, authenticated) |
| `PUT` | `/api/frontdesk/kiosk-settings` | Update kiosk configuration (admin, authenticated) |
| `GET` | `/api/kiosk/public-settings?propertyId=uuid` | Get public kiosk configuration (no auth required) |

### Request Body (PUT /api/frontdesk/kiosk-settings)

```json
{
  "propertyId": "uuid",
  "branding": {
    "logoUrl": "/uploads/property-logo.png",
    "welcomeBackgroundUrl": "/uploads/kiosk-bg.jpg",
    "primaryColor": "#1B4332",
    "secondaryColor": "#2D6A4F",
    "accentColor": "#40916C",
    "textColor": "#FFFFFF",
    "welcomeMessage": "Welcome to Grand Hotel"
  },
  "behavior": {
    "idleTimeoutSeconds": 60,
    "maxFailedAttempts": 10,
    "sessionDurationMinutes": 5,
    "autoReturnHome": true
  },
  "features": {
    "checkInEnabled": true,
    "checkOutEnabled": true,
    "earlyCheckInEnabled": false,
    "lateCheckOutEnabled": false,
    "wifiDisplayEnabled": true,
    "receiptPrintingEnabled": true,
    "accessibilityModeEnabled": true,
    "multilingualEnabled": true
  },
  "terms": {
    "content": "By using this kiosk, you agree to the hotel's terms of service...",
    "version": "2025-01-01",
    "lastUpdated": "2025-01-01T00:00:00Z",
    "requireAcceptance": true
  },
  "payment": {
    "depositRequired": true,
    "depositAmount": 200.00,
    "maxTransactionAmount": 5000.00,
    "acceptedMethods": ["credit_card", "debit_card", "contactless"]
  },
  "languages": {
    "enabled": ["en", "es", "fr", "de", "zh", "ja"],
    "default": "en"
  }
}
```

### Response (GET /api/kiosk/public-settings — No Auth)

```json
{
  "propertyId": "uuid",
  "propertyName": "Grand Hotel",
  "branding": {
    "logoUrl": "/uploads/property-logo.png",
    "welcomeBackgroundUrl": "/uploads/kiosk-bg.jpg",
    "primaryColor": "#1B4332",
    "secondaryColor": "#2D6A4F",
    "accentColor": "#40916C",
    "textColor": "#FFFFFF",
    "welcomeMessage": "Welcome to Grand Hotel"
  },
  "features": {
    "checkInEnabled": true,
    "checkOutEnabled": true,
    "wifiDisplayEnabled": true,
    "accessibilityModeEnabled": true,
    "multilingualEnabled": true
  },
  "terms": {
    "content": "By using this kiosk, you agree to the hotel's terms of service...",
    "version": "2025-01-01"
  },
  "languages": {
    "enabled": ["en", "es", "fr", "de", "zh", "ja"],
    "default": "en"
  }
}
```

## Business Logic

### Color Validation

| Rule | Description |
|------|-------------|
| **Hex format** | All colors must be valid 6-character hex codes (e.g., `#1B4332`) |
| **Contrast ratio** | Text color must have a minimum contrast ratio of 4.5:1 against background color (WCAG AA) |
| **Primary color required** | Primary color is mandatory; secondary and accent colors default to primary if not set |

### Idle Timeout Configuration

| Setting | Min | Max | Default | Description |
|---------|-----|-----|---------|-------------|
| `idleTimeoutSeconds` | 30 | 300 | 60 | Seconds of inactivity before returning to welcome screen |
| `sessionDurationMinutes` | 3 | 15 | 5 | Maximum session duration before forced reset |
| `maxFailedAttempts` | 3 | 20 | 10 | Failed booking code attempts before temporary lockout |

### Feature Toggles

| Feature | Default | Effect When Disabled |
|---------|---------|---------------------|
| `checkInEnabled` | `true` | Hide "Check-In" button on kiosk welcome screen |
| `checkOutEnabled` | `true` | Hide "Check-Out" button on kiosk welcome screen |
| `earlyCheckInEnabled` | `false` | Kiosk rejects check-in attempts before standard time |
| `lateCheckOutEnabled` | `false` | Kiosk rejects check-out attempts after standard time |
| `wifiDisplayEnabled` | `true` | WiFi credentials not shown after check-in |
| `receiptPrintingEnabled` | `true` | No receipt print option after check-in/check-out |
| `accessibilityModeEnabled` | `true` | Accessibility mode toggle hidden from welcome screen |
| `multilingualEnabled` | `true` | Language selector hidden; default language only |

### Public vs. Admin Settings

The public settings endpoint (`/api/kiosk/public-settings`) returns a subset of the full configuration — sensitive operational settings (payment details, max failed attempts, session duration) are excluded. This allows kiosk terminals to fetch branding and display settings without exposing internal configuration.

| Setting | Public | Admin |
|---------|--------|-------|
| Branding (logo, colors, welcome) | Yes | Yes |
| Feature toggles | Yes | Yes |
| Terms content | Yes | Yes |
| Languages | Yes | Yes |
| Payment requirements | No | Yes |
| Idle timeout | No | Yes |
| Max failed attempts | No | Yes |
| Session duration | No | Yes |

## Cross-Module Dependencies

| Module | Dependency | Direction |
|--------|------------|-----------|
| **PMS — Property** | Property ID, name, branding assets | Read |
| **Settings** | Global settings (default values, feature flags) | Read |
| **Front Desk — Kiosk** | Kiosk terminals fetch settings for display | Read |
| **Storage** | Logo and background image upload/retrieval | Read/Write |
| **i18n** | Language translations for kiosk UI text | Read |
| **Audit Log** | Settings changes logged for compliance | Write |

## User Flow

1. **Navigate to Kiosk Settings** — Admin → Front Desk → Kiosk Settings
2. **Select Property** — Choose property to configure (multi-property) or view current property
3. **Configure Branding** — Upload logo/background, set colors, write welcome message
4. **Preview Appearance** — Live preview panel shows kiosk welcome screen with current settings
5. **Set Behavior** — Configure idle timeout, session duration, and failed attempt limits
6. **Toggle Features** — Enable/disable kiosk features using toggle switches
7. **Edit Terms** — Update terms and conditions text; set version number
8. **Configure Payments** — Set deposit requirements, max amounts, accepted methods
9. **Manage Languages** — Enable/disable languages and set default
10. **Save Settings** — Click "Save" — settings applied immediately to all active kiosks

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Full read/write access to all kiosk settings |
| Manager | `frontdesk.manage` | Read/write access to kiosk settings for their properties |
| IT Support | `admin.frontdesk` | Read/write access; manages kiosk hardware integration |
| Front Desk Agent | `frontdesk.view` | Read-only access to view current settings |
| Kiosk Terminal | No auth | Public endpoint — read-only subset of settings |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Invalid color format | `INVALID_COLOR` | Must be valid hex code (#RRGGBB) |
| Contrast ratio too low | `LOW_CONTRAST` | Text color must be more readable against background |
| Timeout out of range | `INVALID_TIMEOUT` | Must be between 30 and 300 seconds |
| Logo upload failed | `UPLOAD_FAILED` | File too large or unsupported format; max 5MB, PNG/JPG only |
| Terms version conflict | `VERSION_CONFLICT` | Another admin updated terms; reload and retry |
| Property not found | `PROPERTY_NOT_FOUND` | Verify property selection |
| No auth for public endpoint | N/A | Public endpoint; no auth needed |

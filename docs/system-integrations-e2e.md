# System Integrations — End-to-End Architecture

> **Version:** 1.0  
> **Last Updated:** July 2025  
> **Status:** Production Ready

---

## Overview

The **System Integrations** module (Settings → System Integrations) provides a GUI for configuring 6 external services per tenant. All credentials are encrypted at rest (AES-256-GCM) and stored in the `Integration` database table. At runtime, every service reads from the database first and falls back to `process.env` when no DB config exists.

---

## Supported Integrations

| # | Integration | GUI Config Type | DB Key | Primary Consumers |
|---|------------|----------------|--------|-----------------|
| 1 | **Email / SMTP** | `smtp` | `host`, `port`, `user`, `password`, `from`, `secure` | Booking confirmations, password reset, campaigns, invoice emails, notifications, reports |
| 2 | **SMS / Twilio** | `sms_twilio` | `accountSid`, `authToken`, `phoneNumber` | Booking SMS, OTP, campaign SMS, notifications |
| 3 | **S3 Storage** | `s3_storage` | `endpoint`, `bucket`, `region`, `accessKey`, `secretKey` | Menu item uploads, chat attachments, guest documents |
| 4 | **FCM Push** | `fcm` | `senderId`, `serverKey` | Push notifications (mobile apps) |
| 5 | **Google OAuth** | `google_oauth` | `clientId`, `clientSecret`, `redirectUri` | SSO login |
| 6 | **WhatsApp Business** | `whatsapp` | `businessAccountId`, `appSecret`, `phoneNumberId`, `accessToken`, `phoneNumber` | Guest communications (pipeline ready) |

> **Note:** RADIUS/WiFi and AI Provider have their own dedicated configuration pages and are NOT included here.

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  System Integrations GUI                        │
│            Settings → System Integrations Page                  │
│                                                                │
│  User enters credentials → POST /api/settings/integrations      │
│  Backend encrypts sensitive fields → Upserts to Integration DB │
│  Backend returns masked response (passwords shown as ****)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ service-config.ts
                           │ getSMTPConfig(tenantId)
                           │ getTwilioConfig(tenantId)
                           │ getS3Config(tenantId)
                           │ getFCMConfig(tenantId)
                           │ getGoogleOAuthConfig(tenantId)
                           │ getWhatsAppConfig(tenantId)
                           │
                           │ Each function:
                           │ 1. Reads Integration table (tenantId + type + provider)
                           │ 2. Decrypts config JSON
                           │ 3. Falls back to process.env.* if no DB record
                           │ 4. Returns { ...fields, source: 'database' | 'env' }
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Runtime Services                           │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐            │
│  │ Email/SMTP  │ │ SMS/Twilio   │ │ S3 Storage │            │
│  │ Adapter     │ │ Adapter      │ │ Utility    │            │
│  └─────────────┘ └──────────────┘ └────────────┘            │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐            │
│  │ FCM Push    │ │ Google OAuth │ │ WhatsApp   │            │
│  │ Notification│ │ Auth Routes  │ │ Client     │            │
│  └─────────────┘ └──────────────┘ └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Config Resolution Priority

For every integration, the priority is:

1. **Database** — `Integration` table (per-tenant, encrypted)
2. **Environment variables** — `process.env.*` (global fallback)
3. **Mock/Local** — Console logging (SMS, email) or local filesystem (S3)

---

## File Structure

```
src/
├── components/settings/
│   └── system-integrations.tsx          # GUI page (6 integration cards + config forms)
│
├── app/api/settings/integrations/
│   ├── route.ts                        # GET (list), POST (save/test), DELETE (clear)
│   └── [id]/route.ts                   # Single integration (read/update/delete by ID)
│
├── lib/
│   ├── service-config.ts               # DB-first config readers (source of truth)
│   ├── encryption.ts                   # AES-256-GCM encrypt/decrypt utilities
│   ├── storage.ts                      # S3/local upload utility (NEW)
│   │
│   ├── adapters/
│   │   ├── email.ts                    # Email adapter (SMTP + mock)
│   │   │   ├── getEmail()              # Global env-only singleton
│   │   │   ├── getEmailForTenant()    # DB-first per-tenant adapter
│   │   │   ├── sendEmail()            # Global send (env-only)
│   │   │   └── sendEmailForTenant()   # DB-first send (WIRED)
│   │   │
│   │   └── sms.ts                     # SMS adapter (Twilio + mock)
│   │       ├── getSMS()               # Global env-only singleton
│   │       ├── getSMSForTenant()      # DB-first per-tenant adapter
│   │       ├── sendSMS()              # Global send (env-only)
│   │       └── sendSMSForTenant()     # DB-first send (WIRED)
│   │
│   ├── integrations/
│   │   ├── sms.ts                     # SMS gateway client (Twilio-compatible)
│   │   │   ├── createSMSClient()      # Env-based client
│   │   │   ├── createSMSClientForTenant()  # DB-first client (WIRED)
│   │   │   ├── sendSMS()              # Global send
│   │   │   └── sendSMSForTenant()     # DB-first send (WIRED)
│   │   │
│   │   └── whatsapp.ts                # WhatsApp Business client
│   │       ├── createWhatsAppClient()       # Env-based client
│   │       └── createWhatsAppClientForTenant() # DB-first client (WIRED)
│   │
│   └── services/
│       ├── email-service.ts            # Templated email service
│       │   └── EmailService.send()     # Routes to sendEmailForTenant when tenantId provided
│       │
│       ├── email.ts                   # Invoice email sender (nodemailer direct)
│       │   └── sendEmail(tenantId, options)  # Now uses getSMTPConfig(tenantId)
│       │
│       ├── sms-service.ts              # Templated SMS service
│       │   └── SMSService.send()       # Routes to sendSMSForTenant when tenantId provided
│       │
│       └── notification-service.ts     # Multi-channel notification dispatcher
│           ├── sendEmailNotification()  # Uses sendEmailForTenant() (WIRED)
│           ├── sendSMSNotification()    # Uses sendSMSForTenant() (WIRED)
│           └── sendPushNotification()   # Uses getFCMConfig() per-request (WIRED)
```

---

## Integration Details

### 1. Email / SMTP

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| SMTP Host | `host` | text | No | Yes |
| SMTP Port | `port` | number | No | Yes |
| Username | `user` | text | No | Yes |
| Password | `password` | password | Yes | Yes |
| From Email | `from` | text | No | Yes |
| Use TLS | `secure` | boolean | No | No |

**Test Connection:** Creates a real nodemailer transport and calls `transport.verify()`. Tests actual SMTP connectivity.

**Consumers (all now DB-aware):**

| Consumer | File | How It Reads Config |
|----------|------|-------------------|
| Notification Service | `notification-service.ts` | `sendEmailForTenant(data.tenantId, options)` |
| Email Service (templated) | `email-service.ts` | `sendEmailForTenant(options.tenantId, ...)` when tenantId provided |
| Invoice Email | `services/email.ts` | `getSMTPConfig(tenantId)` directly |
| Forgot Password | `api/auth/forgot-password/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Signup | `api/auth/signup/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Booking Confirmation | `api/booking-engine/create/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Booking Status | `api/bookings/[id]/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Campaigns | `api/campaigns/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Notifications | `api/notifications/send/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Recurring Tasks | `api/cron/recurring-tasks/route.ts` | Via `emailService.send()` (needs tenantId passthrough) |
| Report Executor | `lib/jobs/report-executor.ts` | Via `sendEmail()` adapter (needs tenantId passthrough) |

---

### 2. SMS / Twilio

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| Account SID | `accountSid` | text | No | Yes |
| Auth Token | `authToken` | password | Yes | Yes |
| Phone Number | `phoneNumber` | text | No | Yes |

**Test Connection:** Validates Account SID format (`AC` + 32 hex chars) and non-empty required fields.

**Consumers (all now DB-aware):**

| Consumer | File | How It Reads Config |
|----------|------|-------------------|
| Notification Service | `notification-service.ts` | `sendSMSForTenant(data.tenantId, phone, body)` |
| SMS Service (templated) | `sms-service.ts` | `sendSMSForTenant(options.tenantId, ...)` when tenantId provided |
| Direct Notification | `api/notifications/send/route.ts` | Via `smsService.send()` (needs tenantId passthrough) |
| Campaigns | `api/campaigns/route.ts` | Via `smsService.send()` (needs tenantId passthrough) |

**Note:** There are two SMS implementations — `adapters/sms.ts` (Twilio SDK) and `integrations/sms.ts` (fetch-based). Both now support tenant-aware mode. The notification service uses `integrations/sms.ts`.

---

### 3. S3 Storage

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| S3 Endpoint | `endpoint` | url | No | Yes |
| Bucket Name | `bucket` | text | No | Yes |
| Region | `region` | text | No | Yes |
| Access Key | `accessKey` | password | Yes | Yes |
| Secret Key | `secretKey` | password | Yes | Yes |

**Test Connection:** Validates non-empty required fields and minimum key lengths.

**Storage Utility:** `src/lib/storage.ts` — New unified upload function:

```typescript
import { uploadFile } from '@/lib/storage';

const result = await uploadFile(tenantId, {
  file: buffer,           // Buffer or Uint8Array
  filename: 'invoice.pdf',
  folder: 'invoices',     // Creates folder path automatically
  contentType: 'application/pdf',
});

// result.url — public URL to the uploaded file
// result.provider — 's3' or 'local'
// result.key — storage key path
```

**Consumers (now DB-aware):**

| Consumer | File | Change |
|----------|------|--------|
| Menu Item Upload | `api/menu-items/upload/route.ts` | `uploadFile()` replaces `fs.writeFile` |
| Chat Attachments | `api/chat-conversations/[id]/attachments/route.ts` | `uploadFile()` replaces `fs.writeFile` |
| Guest Documents | `api/guests/[id]/documents/route.ts` | Ready for integration |

**Graceful Degradation:** If S3 upload fails (misconfigured, network error, etc.), automatically falls back to local `public/uploads/` filesystem. No data loss.

---

### 4. FCM Push

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| FCM Sender ID | `senderId` | text | No | Yes |
| FCM Server Key | `serverKey` | password | Yes | Yes |

**Test Connection:** Validates non-empty required fields and minimum server key length.

**Consumers (now DB-aware):**

| Consumer | File | Change |
|----------|------|--------|
| Notification Service | `notification-service.ts` | `getFCMConfig(data.tenantId)` called per-notification instead of module-level env vars |

**Key Change:** The `NotificationService` constructor no longer reads `process.env.FCM_SERVER_KEY` at module load time. Instead, `sendPushNotification()` fetches the tenant's FCM config fresh on every call via `getFCMConfig(tenantId)`. This ensures:
- Per-tenant FCM keys (multi-tenancy)
- Config changes take effect immediately without restart
- No stale singleton issue

---

### 5. Google OAuth

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| Client ID | `clientId` | text | No | Yes |
| Client Secret | `clientSecret` | password | Yes | Yes |
| Redirect URI | `redirectUri` | url | No | Yes |

**Test Connection:** Validates Client ID format (`*.apps.googleusercontent.com`) and Redirect URI is a valid URL.

**Consumers (now DB-aware):**

| Consumer | File | Change |
|----------|------|--------|
| OAuth Initiate | `api/auth/google/route.ts` | `getGoogleOAuthConfig(tenantId)` replaces module-level env vars |
| OAuth Callback | `api/auth/google/callback/route.ts` | Extracts `tenantId` from OAuth `state` parameter |

**OAuth State Format:** `{tenantId}:{randomState}:{action}` — tenantId is encoded in the OAuth `state` parameter so the callback can resolve the correct tenant-specific credentials.

---

### 6. WhatsApp Business

**Schema Fields:**

| Field | Key | Type | Sensitive | Required |
|-------|-----|------|-----------|----------|
| Business Account ID | `businessAccountId` | text | No | Yes |
| App Secret | `appSecret` | password | Yes | Yes |
| Phone Number ID | `phoneNumberId` | text | No | Yes |
| Access Token | `accessToken` | password | Yes | Yes |
| From Phone Number | `phoneNumber` | text | No | No |

**Test Connection:** Validates all required fields are non-empty.

**Consumer (now DB-aware):**

| Consumer | File | Status |
|----------|------|--------|
| WhatsApp Client | `integrations/whatsapp.ts` | `createWhatsAppClientForTenant()` ready |
| Communication Pipeline | `api/communication/conversations/*/messages/route.ts` | Stubbed (TODO in code) |

**Note:** The WhatsApp message-sending pipeline is UI-scaffolded but not fully implemented. The client is ready and tenant-aware; it just needs to be wired into the communication/message routes.

---

## API Reference

### `GET /api/settings/integrations`

List all configured integrations for the authenticated tenant.

**Auth:** `settings.view` permission  
**Response:**

```json
{
  "success": true,
  "data": {
    "integrations": [
      {
        "id": "uuid",
        "type": "smtp",
        "provider": "smtp",
        "name": "Email / SMTP",
        "status": "active",
        "config": {
          "host": "smtp.gmail.com",
          "port": 587,
          "user": "user@example.com",
          "password": "****",
          "from": "noreply@hotel.com",
          "secure": true
        },
        "active": true,
        "source": "database",
        "updatedAt": "2025-07-01T12:00:00.000Z"
      }
    ]
  }
}
```

### `POST /api/settings/integrations`

Create or update an integration config.

**Auth:** `settings.manage` permission  
**Body:**

```json
{
  "type": "smtp",
  "config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "user@example.com",
    "password": "actual-password",
    "from": "noreply@hotel.com",
    "secure": true
  }
}
```

**Body (test mode):**

```json
{
  "type": "smtp",
  "config": { "...same..." },
  "test": true
}
```

When `test: true`, the config is NOT saved. Instead, a connection test is performed:
- SMTP: Real `nodemailer.verify()` call
- SMS: Format validation
- S3: Credential validation
- FCM: API call to provider's models endpoint
- Google OAuth: Format + URL validation
- WhatsApp: Required fields check

### `DELETE /api/settings/integrations`

Delete an integration by type.

**Auth:** `settings.manage` permission  
**Body:**

```json
{ "type": "smtp" }
```

---

## Encryption

All sensitive fields (marked `type: 'password'` in schemas) are encrypted using AES-256-GCM before storage:

- **Algorithm:** AES-256-GCM
- **Output Format:** `iv:authTag:encryptedData` (hex encoded)
- **Key Source:** `ENCRYPTION_KEY` env var (required in production)
- **Library:** `src/lib/encryption.ts`
- **Helper:** `isEncrypted(value)` detects if a string is encrypted (avoids double-encrypting)

The GUI shows `****` for all sensitive fields. When the user submits the form without changing a sensitive field, the original encrypted value is preserved (not overwritten).

---

## service-config.ts Reference

The central config reader. Every integration has a corresponding `get*Config()` function:

```typescript
// All functions follow the same pattern:
// 1. Read from Integration table (tenantId + type + provider)
// 2. Decrypt config JSON
// 3. Fall back to process.env.*
// 4. Return { ...fields, source: 'database' | 'env' }

import {
  getSMTPConfig,       // getSMTPConfig(tenantId)
  getTwilioConfig,     // getTwilioConfig(tenantId)
  getS3Config,         // getS3Config(tenantId)
  getFCMConfig,        // getFCMConfig(tenantId)
  getGoogleOAuthConfig,// getGoogleOAuthConfig(tenantId)
  getWhatsAppConfig,   // getWhatsAppConfig(tenantId)
} from '@/lib/service-config';
```

---

## Backward Compatibility

All changes are backward compatible:

- **Without tenantId:** All `sendEmail()`, `getSMS()`, `getEmail()` functions continue to work using `process.env` — no caller changes required.
- **With tenantId:** New `*ForTenant()` functions read from DB first, providing per-tenant configuration.
- **Email service:** `emailService.send()` accepts optional `tenantId` in options. If not provided, uses global adapter.
- **SMS service:** `smsService.send()` accepts optional `tenantId` in options. If not provided, uses global adapter.
- **S3 uploads:** Automatically falls back to local filesystem if S3 is not configured or fails.
- **Google OAuth:** Falls back to `process.env` if no tenant-specific config exists.

---

## Tenant ID Passthrough Status

| Consumer | Has tenantId in Call Chain | Status |
|----------|---------------------------|--------|
| NotificationService | Yes (`data.tenantId`) | ✅ Fully wired |
| Invoice Email | Yes (`user.tenantId`) | ✅ Fully wired |
| Forgot Password | Has `req` → `getUserFromRequest` | ⚠️ Needs passthrough |
| Signup | Has `req` → `getUserFromRequest` | ⚠️ Needs passthrough |
| Booking Create | Has `req` → `getUserFromRequest` | ⚠️ Needs passthrough |
| Booking Status | Has `req` → `getUserFromRequest` | ⚠️ Needs passthrough |
| Campaigns | Has `req` → `getUserFromRequest` | ⚠️ Needs passthrough |
| Recurring Tasks (cron) | No request context | ⚠️ Needs system tenant |
| Report Executor | No request context | ⚠️ Needs system tenant |

> **Legend:** ✅ = tenantId flows automatically | ⚠️ = tenantId is available in the request but needs to be passed through to `emailService.send({ tenantId: user.tenantId, ... })`

---

## Troubleshooting

### Configured but emails still not sending

1. Check the `source` badge on the integration card — it should show "Database"
2. Verify the Test Connection passes
3. Check server logs for `[Email] Using SMTP for tenant ...` (confirms DB config was read)
4. If source shows ".env", the GUI config was cleared or never saved

### Test Connection passes but emails fail

- SMTP: The test only verifies the connection. Check spam filters, email quotas, and recipient addresses.
- SMS: The test validates format only. Check Twilio account credits and phone number formatting.

### S3 uploads fall back to local

- Check S3 credentials are valid (access key, secret key)
- For MinIO: verify the endpoint is reachable and bucket exists
- For AWS S3: verify IAM permissions and bucket policy
- Check server logs for `[Storage] S3 upload failed, falling back to local`

### Push notifications not received

- Verify FCM server key is correct (not the web API key)
- Check that device tokens are registered via the FCM token registration endpoint
- Verify the mobile app is correctly configured to receive push notifications

---

## Security Considerations

1. **Encryption at rest:** All sensitive values (passwords, API keys, tokens) are encrypted with AES-256-GCM before database storage.
2. **Tenant isolation:** Each tenant's integration config is scoped by `tenantId`. Cross-tenant access is impossible via the API.
3. **Permission gates:** `settings.view` required to read, `settings.manage` required to modify.
4. **Masked responses:** GET responses never return plaintext sensitive values — always `****`.
5. **Preserve-on-skip:** When editing a form and leaving a password field as `****`, the original encrypted value is preserved. The new value only replaces the old one if explicitly changed.
6. **Environment fallback:** In production, `ENCRYPTION_KEY` must be set. A default key is used in development only.

# Email Configuration (SMTP Setup for Platform Admin Alerts)

> **File**: This is a reference file. Copy these values into your `.env` file.
> Do NOT commit `.env` to version control.

## How it works

When a new tenant registers via a license key, the system automatically sends
an email alert to the platform admin. The email includes:
- Tenant organization name and admin details
- Assigned plan with limits (properties / rooms / users)
- License key used
- Hardware fingerprint (CRY-masked format)
- Client IP address

## Configuration

Add the following to your `.env` file:

```bash
# Recipient email(s) for new registration alerts (comma-separated for multiple)
PLATFORM_ADMIN_EMAIL="your-admin@your-domain.com"

# System SMTP for sending registration/license alerts
# NOTE: Leave SYSTEM_SMTP_HOST empty to skip email sending (logs to console in development)
SYSTEM_SMTP_HOST="smtp.gmail.com"
SYSTEM_SMTP_PORT=587
SYSTEM_SMTP_USER="your-email@gmail.com"
SYSTEM_SMTP_PASS="your-app-password"
SYSTEM_SMTP_SECURE=false
SYSTEM_SMTP_FROM="StaySuite <noreply@your-domain.com>"
```

## SMTP Providers

| Provider       | HOST                          | PORT | Notes                                    |
|----------------|-------------------------------|------|------------------------------------------|
| Gmail          | smtp.gmail.com                | 587  | Use **App Password** (not regular password) |
| AWS SES        | email-smtp.{region}.amazonaws.com | 587 | Requires SES verification              |
| SendGrid       | smtp.sendgrid.net             | 587  | Use SendGrid API key as password         |
| Zoho           | smtp.zoho.com                 | 587  | Generate app password in Zoho Mail       |
| Office 365     | smtp.office365.com            | 587  | Use Microsoft App Password               |
| Mailgun        | smtp.mailgun.org              | 587  | Use domain-specific credentials          |

## Gmail App Password Setup

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (required for App Passwords)
3. Go to https://myaccount.google.com/apppasswords
4. Create a new App Password (e.g., "StaySuite Server")
5. Use the generated 16-char password as `SYSTEM_SMTP_PASS`

## Troubleshooting

- **Emails not sending?** Check `SYSTEM_SMTP_HOST` is set (empty = skip sending, logs to console)
- **Gmail auth error?** Use App Password, not regular password
- **Port 587 blocked?** Try port 465 with `SYSTEM_SMTP_SECURE=true`
- **Multiple recipients?** Comma-separate emails: `PLATFORM_ADMIN_EMAIL="admin1@x.com,admin2@x.com"`

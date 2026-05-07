# Platform Admin Setup Guide

This guide explains how to set up and manage platform administrators in StaySuite.

**Last Updated**: May 2026

---

## Overview

Platform administrators have special privileges that allow them to:
- Access Tenant Management (create, edit, delete tenants)
- View all tenants across the platform
- Manage tenant subscriptions and limits
- Access system-wide analytics
- Manage FreeRADIUS and system health

## Requirements

A user must have `isPlatformAdmin: true` in the database to access platform-level features.

---

## Setup Methods

### Method 1: Using the ensure-platform-admin API (Recommended)

This is the easiest way to create or fix platform admin users.

#### Step 1: Check if user exists and has platform admin access

```bash
curl -X GET "https://your-domain.com/api/admin/ensure-platform-admin?email=platform@staysuite.com"
```

#### Step 2: Create or update platform admin

```bash
curl -X POST "https://your-domain.com/api/admin/ensure-platform-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "setup-platform-admin-2024",
    "email": "platform@staysuite.com",
    "password": "admin123"
  }'
```

#### Step 3: Logout and Login Again

After creating/updating the platform admin:
1. Logout from the application
2. Login again with the credentials
3. The session will now include `isPlatformAdmin: true`

### Method 2: Direct Database Update (PostgreSQL)

If you have direct database access:

```sql
-- Update existing user to be platform admin
UPDATE "User" SET "isPlatformAdmin" = true WHERE email = 'platform@staysuite.com';

-- Verify the update
SELECT id, email, "firstName", "lastName", "isPlatformAdmin" 
FROM "User" WHERE email = 'platform@staysuite.com';
```

### Method 3: Using Seed Data (Development Only)

For development environments, run the seed script:

```bash
bun run db:seed
```

This creates platform admin and tenant admin users:

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | platform@staysuite.com | admin123 |
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |

**Warning:** Running seed will clear and re-seed all data. Do not use in production.

---

## Security Configuration

### Environment Variable

Set the `PLATFORM_ADMIN_SECRET` environment variable in production:

```env
PLATFORM_ADMIN_SECRET=your-very-secure-random-string-here
```

This secret is required to use the ensure-platform-admin API and prevents unauthorized access.

### Production Recommendations

1. **Use strong passwords** — At least 12 characters with mixed case, numbers, and symbols
2. **Change the default secret key** — Use a cryptographically secure random string
3. **Enable Two-Factor Authentication** — After login, enable 2FA in Security Center
4. **Limit platform admins** — Only grant platform admin to trusted users
5. **Monitor audit logs** — Review admin actions in Security Center → Audit Logs

---

## Troubleshooting

### Issue: "Platform admin access required" error when accessing Tenant Management

**Cause:** Your user account doesn't have `isPlatformAdmin: true`

**Solution:** Use the ensure-platform-admin API or direct database update to set the flag

### Issue: After updating isPlatformAdmin, still can't access

**Cause:** Your session still has the old user data cached

**Solution:**
1. Clear browser cookies
2. Logout and login again
3. Or use a private/incognito window

### Issue: Menu items not showing after login

**Cause:** Permission context not properly initialized

**Solution:**
1. Refresh the page (F5)
2. Clear browser cache
3. Logout and login again

---

## API Reference

### GET /api/admin/ensure-platform-admin

Check if a user exists and has platform admin access.

**Parameters:**
- `email` (query, optional): Email to check. Default: `platform@staysuite.com`

**Response:**
```json
{
  "exists": boolean,
  "user": { ... } | null,
  "canAccessTenantManagement": boolean,
  "hint": string
}
```

### POST /api/admin/ensure-platform-admin

Create or update a platform admin user.

**Request Body:**
```json
{
  "secretKey": string,
  "email": string,
  "password": string
}
```

**Response:**
```json
{
  "success": boolean,
  "message": string,
  "user": {
    "id": string,
    "email": string,
    "firstName": string,
    "lastName": string,
    "isPlatformAdmin": boolean
  }
}
```

---

## Demo Tenants

The seed script creates these tenants:

| Tenant | Admin Email | Properties |
|--------|-----------|------------|
| Royal Stay Hotels | admin@royalstay.in | Royal Stay Kolkata (120 rooms), Royal Stay Darjeeling (50 rooms) |
| Ocean View Resorts | admin@oceanview.com | - |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)

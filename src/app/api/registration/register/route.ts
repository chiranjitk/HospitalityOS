/**
 * POST /api/registration/register
 * Registers a new tenant and admin user using a validated license key.
 * This is a PUBLIC endpoint (no auth required).
 *
 * Flow:
 * 1. Validate required fields
 * 2. Rate limit check (3 per IP per 15 min)
 * 3. Look up the license key (must be active, not expired)
 * 4. Check email uniqueness
 * 5. Create Tenant with plan from the key
 * 6. Create admin Role for the tenant
 * 7. Create admin User (verified, active)
 * 8. Mark the license key as activated
 * 9. Create session and set cookie
 * 10. Return user data (same format as login)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// In-memory rate limiting (3 registrations per IP per 15 minutes)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000).unref();

function checkRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(clientIp, 3, 15 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { key, organizationName, email, password, firstName, lastName, phone } = body;

    // Validate required fields
    if (!key || !organizationName || !email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: key, organizationName, email, password, firstName, lastName' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Name length validation
    if (firstName && (firstName.length > 100 || firstName.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'First name must be 1-100 characters' },
        { status: 400 }
      );
    }
    if (lastName && (lastName.length > 100 || lastName.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Last name must be 1-100 characters' },
        { status: 400 }
      );
    }

    // Organization name length validation
    if (organizationName.length < 2 || organizationName.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Organization name must be 2-200 characters' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Look up the license key
    const licenseKey = await db.licenseKey.findUnique({
      where: { key: key.trim().toUpperCase() },
      include: { plan: true },
    });

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid license key' },
        { status: 404 }
      );
    }

    if (licenseKey.status !== 'active') {
      const statusMessages: Record<string, string> = {
        activated: 'This license key has already been used',
        expired: 'This license key has expired',
        revoked: 'This license key has been revoked',
      };
      return NextResponse.json(
        { success: false, error: statusMessages[licenseKey.status] || 'This license key is no longer active' },
        { status: 410 }
      );
    }

    // Check expiration date
    if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      await db.licenseKey.update({
        where: { id: licenseKey.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { success: false, error: 'This license key has expired' },
        { status: 410 }
      );
    }

    // Check for duplicate email
    const existingUser = await db.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique slug for tenant
    const baseSlug = organizationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    let slug = baseSlug;
    let slugExists = await db.tenant.findUnique({ where: { slug } });
    let suffix = 1;
    while (slugExists) {
      slug = `${baseSlug}-${suffix}`;
      slugExists = await db.tenant.findUnique({ where: { slug } });
      suffix++;
    }

    // Create session token outside transaction (crypto is independent)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const maxAge = 24 * 60 * 60; // 24 hours
    const expiresAt = new Date(Date.now() + maxAge * 1000);

    // Execute all DB operations in a single transaction to prevent race conditions
    const result = await db.$transaction(async (tx) => {
      // Pessimistic check: re-verify license key is still active inside the transaction
      const freshLicenseKey = await tx.licenseKey.findUnique({
        where: { key: key.trim().toUpperCase() },
      });

      if (!freshLicenseKey || freshLicenseKey.status !== 'active') {
        throw new Error('LICENSE_KEY_ALREADY_ACTIVATED');
      }

      // Create the Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: organizationName.trim(),
          slug,
          plan: licenseKey.plan.name, // 'trial', 'starter', 'professional', 'enterprise'
          status: 'active',
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          maxProperties: licenseKey.plan.maxProperties,
          maxUsers: licenseKey.plan.maxUsers,
          maxRooms: licenseKey.plan.maxRoomsPerProperty,
          trialEndsAt: licenseKey.plan.trialDays
            ? new Date(Date.now() + licenseKey.plan.trialDays * 24 * 60 * 60 * 1000)
            : null,
          features: licenseKey.plan.features,
          settings: JSON.stringify({
            registeredVia: 'license_key',
            licenseKeyId: licenseKey.id,
            activatedAt: new Date().toISOString(),
          }),
        },
      });

      // Create default module entitlements based on plan limits
      await tx.licenseModuleEntitlement.createMany({
        data: [
          {
            tenantId: tenant.id,
            moduleKey: 'pms',
            moduleName: 'Property Management',
            limitType: 'properties',
            limitValue: licenseKey.plan.maxProperties,
            isValid: true,
            hardLimit: true,
          },
          {
            tenantId: tenant.id,
            moduleKey: 'admin',
            moduleName: 'Admin / Users',
            limitType: 'users',
            limitValue: licenseKey.plan.maxUsers,
            isValid: true,
            hardLimit: true,
          },
          {
            tenantId: tenant.id,
            moduleKey: 'properties',
            moduleName: 'Properties',
            limitType: 'rooms',
            limitValue: licenseKey.plan.maxRoomsPerProperty,
            isValid: true,
            hardLimit: true,
          },
        ],
      });

      // Create admin Role for the tenant
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full access administrator',
          permissions: '["*"]',
          isSystem: false,
        },
      });

      // Create the admin User
      const user = await tx.user.create({
        data: {
          email: email.trim().toLowerCase(),
          passwordHash: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          tenantId: tenant.id,
          roleId: role.id,
          isVerified: true,
          isPlatformAdmin: false,
          status: 'active',
          passwordChangedAt: new Date(),
        },
      });

      // Mark the license key as activated
      await tx.licenseKey.update({
        where: { id: freshLicenseKey.id },
        data: {
          status: 'activated',
          activatedBy: user.id,
          activatedAt: new Date(),
          tenantId: tenant.id,
        },
      });

      // Create session
      await tx.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          refreshToken,
          expiresAt,
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: clientIp,
        },
      });

      return { tenant, role, user };
    });

    // Build response with user data (same format as login)
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: `${result.user.firstName} ${result.user.lastName}`,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatar: result.user.avatar,
        phone: result.user.phone,
        jobTitle: result.user.jobTitle,
        department: result.user.department,
        twoFactorEnabled: result.user.twoFactorEnabled,
        roleId: result.user.roleId,
        roleName: 'admin',
        permissions: ['*'],
        tenantId: result.user.tenantId,
        isPlatformAdmin: false,
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
          status: result.tenant.status,
        },
      },
    });

    // Set session cookie
    const isSecure = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://');
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      expires: expiresAt,
      maxAge,
      path: '/',
    });

    console.log(`[REGISTRATION] New tenant registered: ${result.tenant.name} (${result.tenant.plan}) by ${result.user.email}`);

    // Send platform admin email notification (non-blocking)
    try {
      const { sendSystemEmail, generateRegistrationAlertHtml } = await import('@/lib/services/system-email');
      const { getServerFingerprint } = await import('@/lib/license/server-fingerprint');

      const fingerprint = getServerFingerprint();
      const alertHtml = generateRegistrationAlertHtml({
        tenantName: result.tenant.name,
        tenantEmail: result.user.email,
        planName: licenseKey.plan.name,
        planDisplayName: licenseKey.plan.displayName || licenseKey.plan.name,
        maxProperties: licenseKey.plan.maxProperties,
        maxRooms: licenseKey.plan.maxRoomsPerProperty,
        maxUsers: licenseKey.plan.maxUsers,
        licenseKey: licenseKey.key,
        adminName: `${result.user.firstName} ${result.user.lastName}`,
        adminEmail: result.user.email,
        phone: result.user.phone,
        serverFingerprint: fingerprint,
        generatedFor: licenseKey.generatedFor,
        ipAddress: clientIp,
        registeredAt: new Date().toLocaleString(),
      });

      // Fire and forget — don't block the registration response
      sendSystemEmail({
        subject: `🔔 New Tenant: ${result.tenant.name} registered (${licenseKey.plan.displayName || licenseKey.plan.name})`,
        html: alertHtml,
        text: `New tenant registration: ${result.tenant.name} (${result.tenant.plan}) by ${result.user.email}. Plan: ${licenseKey.plan.displayName} (${licenseKey.plan.maxProperties}P/${licenseKey.plan.maxRoomsPerProperty}R/${licenseKey.plan.maxUsers}U. Fingerprint: ${fingerprint.slice(0, 8)}...${fingerprint.slice(-4)}. IP: ${clientIp}`,
      }).then((res) => {
        if (res.success) {
          console.log(`[REGISTRATION] 📧 Platform admin notified successfully`);
        } else {
          console.warn(`[REGISTRATION] ⚠️ Failed to notify platform admin: ${res.error}`);
        }
      });
    } catch (err) {
      console.warn('[REGISTRATION] ⚠️ Email notification error (non-blocking):', err);
    }

    return response;
  } catch (error) {
    console.error('[Registration] Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'LICENSE_KEY_ALREADY_ACTIVATED') {
      return NextResponse.json(
        { success: false, error: 'This license key has already been activated by another request' },
        { status: 409 }
      );
    }

    if (errorMessage.includes('Unique constraint') || errorMessage.includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

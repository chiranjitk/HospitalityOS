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

    // Create the Tenant
    const tenant = await db.tenant.create({
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

    // Create admin Role for the tenant
    const role = await db.role.create({
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
    const user = await db.user.create({
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
    await db.licenseKey.update({
      where: { id: licenseKey.id },
      data: {
        status: 'activated',
        activatedBy: user.id,
        activatedAt: new Date(),
        tenantId: tenant.id,
      },
    });

    // Create session (same pattern as login route)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const maxAge = 24 * 60 * 60; // 24 hours
    const expiresAt = new Date(Date.now() + maxAge * 1000);

    await db.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: clientIp,
      },
    });

    // Build response with user data (same format as login)
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        twoFactorEnabled: user.twoFactorEnabled,
        roleId: user.roleId,
        roleName: 'admin',
        permissions: ['*'],
        tenantId: user.tenantId,
        isPlatformAdmin: false,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
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

    console.log(`[REGISTRATION] New tenant registered: ${tenant.name} (${tenant.plan}) by ${user.email}`);

    return response;
  } catch (error) {
    console.error('[Registration] Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

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

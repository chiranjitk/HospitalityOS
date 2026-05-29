/**
 * L-38: Tenant Email Verification Endpoint
 *
 * GET /api/admin/tenants/verify-email?token=<token>
 *
 * Verifies a tenant's email address when the admin clicks the verification link.
 * The token is stored in the tenantEmailVerificationTokenCache (24h TTL).
 * On success, sets tenant.emailVerified = true in the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tenantEmailVerificationTokenCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Look up token in cache
    const tokenData = tenantEmailVerificationTokenCache.get(token);

    if (!tokenData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired verification token. Please request a new verification email.',
        },
        { status: 400 }
      );
    }

    const { tenantId, email } = tokenData;

    // Find the tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Already verified
    if (tenant.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified.',
        data: { tenantId: tenant.id, email: tenant.email, emailVerified: true },
      });
    }

    // Verify the email matches (prevent token reuse across tenants)
    if (tenant.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Token email does not match tenant email' },
        { status: 400 }
      );
    }

    // Mark tenant email as verified
    await db.tenant.update({
      where: { id: tenantId },
      data: { emailVerified: true },
    });

    // Invalidate the token (single-use)
    tenantEmailVerificationTokenCache.delete(token);

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'admin',
          action: 'tenant.email_verified',
          entityType: 'Tenant',
          entityId: tenantId,
          newValue: JSON.stringify({ email, verifiedAt: new Date().toISOString() }),
        },
      });
    } catch {
      // Non-blocking
    }

    console.log(`[Tenant] Email verified for tenant ${tenantId} (${email})`);

    // Return HTML response for browser-based verification
    // Also return JSON for API-based verification
    const acceptHeader = request.headers.get('accept') || '';

    if (acceptHeader.includes('text/html')) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Verified - StaySuite</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #059669; font-size: 24px; margin: 0 0 8px; }
    p { color: #6b7280; font-size: 14px; line-height: 1.6; }
    .tenant-name { font-weight: 600; color: #111; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Email Verified</h1>
    <p>Your organization <span class="tenant-name">${tenant.name}</span> has been verified on StaySuite HospitalityOS.</p>
    <p>You can now close this window.</p>
  </div>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully.',
      data: {
        tenantId: tenant.id,
        name: tenant.name,
        email: tenant.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('[Tenant] Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Email verification failed' },
      { status: 500 }
    );
  }
}

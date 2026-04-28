import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getGoogleOAuthConfig } from '@/lib/service-config';
import crypto from 'crypto';
import { encrypt } from '@/lib/encryption';

// GET /api/auth/google - Initiate Google OAuth flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'login'; // login or connect
    const tenantId = searchParams.get('tenantId') || ''; // optional tenant context from login page

    // Try to get tenant-specific Google OAuth config
    let clientId = process.env.GOOGLE_CLIENT_ID || '';
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    let redirectUri = process.env.GOOGLE_REDIRECT_URI ||
      (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/auth/google/callback';

    if (tenantId) {
      try {
        const cfg = await getGoogleOAuthConfig(tenantId);
        if (cfg.clientId) clientId = cfg.clientId;
        if (cfg.clientSecret) clientSecret = cfg.clientSecret;
        if (cfg.redirectUri) redirectUri = cfg.redirectUri;
      } catch {
        // Fall back to env defaults
      }
    }

    if (!clientId) {
      return NextResponse.redirect(
        new URL('/login?error=google_not_configured', request.url)
      );
    }

    // Generate state for CSRF protection, encoding tenantId and action
    const stateValue = crypto.randomBytes(16).toString('hex');
    // State format: tenantId:randomState:action
    const state = `${tenantId}:${stateValue}:${action}`;

    // Store state in a cookie for verification
    const stateCookie = `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const response = NextResponse.redirect(googleAuthUrl);
    response.headers.set('Set-Cookie', stateCookie);

    return response;
  } catch (error) {
    console.error('Google OAuth initiate error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', request.url)
    );
  }
}

// POST /api/auth/google - Configure Google SSO settings
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { enabled, clientId, clientSecret, domain } = body;

    // Update tenant settings with SSO configuration
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Parse existing settings
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(tenant.settings);
    } catch {
      settings = {};
    }

    // Update SSO settings
    settings = {
      ...settings,
      sso: {
        ...(settings.sso as Record<string, unknown> || {}),
        google: {
          enabled: enabled || false,
          clientId: clientId || '',
          // Encrypt clientSecret before storing
          clientSecret: clientSecret ? encrypt(clientSecret) : '',
          domain: domain || '',
          configuredAt: new Date().toISOString(),
        },
      },
    };

    // Save settings
    await db.tenant.update({
      where: { id: user.tenantId },
      data: {
        settings: JSON.stringify(settings),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'SSO settings updated successfully',
    });
  } catch (error) {
    console.error('SSO settings update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SSO settings' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/google - Get current SSO settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get tenant settings
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Parse settings
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(tenant.settings);
    } catch {
      settings = {};
    }

    const ssoSettings = (settings.sso as Record<string, unknown>)?.google as Record<string, unknown> || {
      enabled: false,
      clientId: '',
      domain: '',
    };

    return NextResponse.json({
      success: true,
      settings: {
        enabled: ssoSettings.enabled || false,
        clientId: ssoSettings.clientId || '',
        domain: ssoSettings.domain || '',
        configured: !!(ssoSettings.clientId && ssoSettings.clientSecret),
      },
    });
  } catch (error) {
    console.error('SSO settings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SSO settings' },
      { status: 500 }
    );
  }
}

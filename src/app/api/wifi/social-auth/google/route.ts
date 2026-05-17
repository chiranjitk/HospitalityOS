import { NextRequest, NextResponse } from 'next/server';
import { generateStateToken, verifyStateToken, createWiFiSocialSession } from '@/lib/wifi/social-auth';
import { db } from '@/lib/db';

/**
 * GET /api/wifi/social-auth/google
 * Initiate Google OAuth flow for WiFi captive portal.
 * Query params: tenantId, propertyId, macAddress?, redirectUrl?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // If 'code' and 'state' are present, this is the OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      return handleGoogleCallback(code, state);
    }

    // Otherwise, initiate the OAuth flow
    const tenantId = searchParams.get('tenantId');
    const propertyId = searchParams.get('propertyId');
    const macAddress = searchParams.get('macAddress') || undefined;
    const redirectUrl = searchParams.get('redirectUrl') || undefined;

    if (!tenantId || !propertyId) {
      return NextResponse.json({ error: 'tenantId and propertyId are required' }, { status: 400 });
    }

    // Get Google OAuth credentials from WiFiSettings
    const settings = await db.wiFiSettings.findMany({
      where: {
        tenantId,
        propertyId,
        key: { in: ['social_google_client_id', 'social_google_client_secret', 'social_google_redirect_uri'] },
      },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const clientId = settingsMap['social_google_client_id'];
    const redirectUri = settingsMap['social_google_redirect_uri'] || `${new URL(request.url).origin}/api/wifi/social-auth/google`;

    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured for this property' }, { status: 400 });
    }

    // Generate state token
    const stateToken = await generateStateToken(tenantId, propertyId, 'google', macAddress);

    // Build Google OAuth consent URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', stateToken);
    if (redirectUrl) {
      googleAuthUrl.searchParams.set('access_type', 'offline');
    }

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('[Google OAuth] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle Google OAuth callback: exchange code for tokens, create WiFi session.
 */
async function handleGoogleCallback(code: string, state: string) {
  // Verify state token
  const stateData = await verifyStateToken(state);
  if (!stateData) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=invalid_state`
    );
  }

  const { tenantId, propertyId, macAddress } = stateData;

  try {
    // Get Google credentials
    const settings = await db.wiFiSettings.findMany({
      where: {
        tenantId,
        propertyId,
        key: { in: ['social_google_client_id', 'social_google_client_secret', 'social_google_redirect_uri'] },
      },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const clientId = settingsMap['social_google_client_id'];
    const clientSecret = settingsMap['social_google_client_secret'];
    const redirectUri = settingsMap['social_google_redirect_uri'];

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=config_missing`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.id_token) {
      console.error('[Google OAuth] No id_token in response:', tokens);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=token_exchange_failed`
      );
    }

    // Decode ID token (JWT) to get user info
    const idToken = tokens.id_token as string;
    const payloadB64 = idToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

    const email: string = payload.email || '';
    const name: string = payload.name || email.split('@')[0] || 'Guest';

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=no_email`
      );
    }

    // Create WiFi session
    await createWiFiSocialSession({
      tenantId,
      propertyId,
      provider: 'google',
      email,
      name,
      macAddress,
    });

    // Redirect to WiFi success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?status=success&method=google`
    );
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=auth_failed`
    );
  }
}

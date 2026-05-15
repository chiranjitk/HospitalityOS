import { NextRequest, NextResponse } from 'next/server';
import { generateStateToken, verifyStateToken, createWiFiSocialSession } from '@/lib/wifi/social-auth';
import { db } from '@/lib/db';

/**
 * GET /api/wifi/social-auth/facebook
 * Initiate Facebook OAuth flow for WiFi captive portal.
 * Query params: tenantId, propertyId, macAddress?, redirectUrl?
 *
 * Facebook OAuth uses a slightly different flow — the callback includes
 * a signed_request or code + state, and we exchange for an access token
 * then fetch the user profile from the Graph API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // If 'code' and 'state' are present, this is the OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      return handleFacebookCallback(code, state);
    }

    // Otherwise, initiate the OAuth flow
    const tenantId = searchParams.get('tenantId');
    const propertyId = searchParams.get('propertyId');
    const macAddress = searchParams.get('macAddress') || undefined;

    if (!tenantId || !propertyId) {
      return NextResponse.json({ error: 'tenantId and propertyId are required' }, { status: 400 });
    }

    // Get Facebook OAuth credentials from WiFiSettings
    const settings = await db.wiFiSettings.findMany({
      where: {
        tenantId,
        propertyId,
        key: { in: ['social_facebook_client_id', 'social_facebook_client_secret', 'social_facebook_redirect_uri'] },
      },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const clientId = settingsMap['social_facebook_client_id'];
    const redirectUri = settingsMap['social_facebook_redirect_uri'] || `${new URL(request.url).origin}/api/wifi/social-auth/facebook`;

    if (!clientId) {
      return NextResponse.json({ error: 'Facebook OAuth not configured for this property' }, { status: 400 });
    }

    // Generate state token
    const stateToken = await generateStateToken(tenantId, propertyId, 'facebook', macAddress);

    // Build Facebook OAuth dialog URL
    const facebookAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    facebookAuthUrl.searchParams.set('client_id', clientId);
    facebookAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookAuthUrl.searchParams.set('response_type', 'code');
    facebookAuthUrl.searchParams.set('scope', 'email,public_profile');
    facebookAuthUrl.searchParams.set('state', stateToken);

    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error) {
    console.error('[Facebook OAuth] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle Facebook OAuth callback: exchange code for token, fetch user profile, create WiFi session.
 */
async function handleFacebookCallback(code: string, state: string) {
  // Verify state token
  const stateData = await verifyStateToken(state);
  if (!stateData) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=invalid_state`
    );
  }

  const { tenantId, propertyId, macAddress } = stateData;

  try {
    // Get Facebook credentials
    const settings = await db.wiFiSettings.findMany({
      where: {
        tenantId,
        propertyId,
        key: { in: ['social_facebook_client_id', 'social_facebook_client_secret', 'social_facebook_redirect_uri'] },
      },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const clientId = settingsMap['social_facebook_client_id'];
    const clientSecret = settingsMap['social_facebook_client_secret'];
    const redirectUri = settingsMap['social_facebook_redirect_uri'];

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=config_missing`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      })}`
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('[Facebook OAuth] No access_token in response:', tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=token_exchange_failed`
      );
    }

    // Fetch user profile from Graph API
    const profileResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );

    const profile = await profileResponse.json();

    const email: string = profile.email || '';
    const name: string = profile.name || 'Guest';

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=no_email`
      );
    }

    // Create WiFi session
    await createWiFiSocialSession({
      tenantId,
      propertyId,
      provider: 'facebook',
      email,
      name,
      macAddress,
    });

    // Redirect to WiFi success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?status=success&method=facebook`
    );
  } catch (error) {
    console.error('[Facebook OAuth] Callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/captive?error=auth_failed`
    );
  }
}

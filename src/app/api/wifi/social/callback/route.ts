// GET /api/wifi/social/callback?provider=google&code=xxx&state=xxx
//
// Handles the OAuth callback from the social provider.
// In production, it exchanges the authorization code for an access token and ID token,
// then redirects the guest back to the captive portal with the social token for WiFi authentication.
//
// Flow:
// 1. Validates the provider
// 2. Validates the authorization code is present
// 3. Looks up the portal's OAuth credentials from PortalAuthentication.config
// 4. Exchanges the code for tokens at the provider's token endpoint
// 5. For Facebook: fetches user info from Graph API (no native ID token)
// 6. For Google / Apple: extracts user info from the ID token (JWT)
// 7. Redirects to /connect with social_provider and social_token query params
//    The frontend then calls /api/v1/wifi/auth with method=social to complete WiFi auth
//
// Error handling:
// - On any failure, redirects to /connect with a descriptive social_error param
// - Logs full error details server-side for debugging

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

const VALID_PROVIDERS = ['google', 'facebook', 'apple'] as const;
type SocialProvider = (typeof VALID_PROVIDERS)[number];

const TOKEN_ENDPOINTS: Record<SocialProvider, string> = {
  google: 'https://oauth2.googleapis.com/token',
  facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
  apple: 'https://appleid.apple.com/auth/token',
};

/** Base URL to redirect users to after OAuth flow completes or fails */
const DEFAULT_REDIRECT_BASE = '/connect';

/**
 * Generate Apple Sign-In client_secret JWT.
 * Apple requires the client_secret to be a signed JWT using the ES256 algorithm,
 * containing the team ID, key ID, and service ID (client ID).
 */
async function generateAppleClientSecret(
  privateKeyPem: string,
  teamId: string,
  keyId: string,
  clientId: string,
): Promise<string> {
  // Use dynamic import to avoid bundling issues with crypto
  const { createSign } = await import('crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 15777000, // ~6 months
    aud: 'https://appleid.apple.com',
    sub: clientId,
  })).toString('base64url');

  const sign = createSign('SHA256');
  sign.update(`${header}.${payload}`);

  // Handle both PEM with newlines and raw key
  const key = privateKeyPem.includes('-----')
    ? privateKeyPem
    : `-----BEGIN PRIVATE KEY-----\n${privateKeyPem}\n-----END PRIVATE KEY-----`;

  sign.end(key);
  const signature = sign.sign(key).toString('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Decode a JWT id_token without verifying the signature.
 * For WiFi captive portal auth, we trust the token was obtained via
 * a direct server-to-server code exchange (not client-supplied), so
 * signature verification is optional. The token is only used to
 * extract claims (email, name, sub) for session creation.
 */
function decodeJwtPayload(idToken: string): Record<string, unknown> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: expected 3 parts');
    }
    // JWT payload is base64url-encoded
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch (err) {
    throw new Error(`Failed to decode JWT: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') as SocialProvider | null;
  const code = searchParams.get('code') as string | null;
  const state = searchParams.get('state') as string | null;

  // ── Validate provider ──
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
    redirectUrl.searchParams.set('social_error', 'invalid_provider');
    return NextResponse.redirect(redirectUrl);
  }

  // ── Validate authorization code ──
  if (!code) {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    console.error(
      `[Social Callback] No authorization code received from ${provider}.`,
      error ? `Error: ${error} — ${errorDescription}` : 'No error param either.',
    );
    const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
    redirectUrl.searchParams.set('social_error', 'no_code');
    if (error) redirectUrl.searchParams.set('social_error_detail', error);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // ── Find portal's social auth config ──
    // We look up the first active social auth method. In a more sophisticated setup,
    // the state parameter would encode the portalSlug/portalId for direct lookup.
    const authMethod = await db.portalAuthentication.findFirst({
      where: { method: 'social', enabled: true },
      include: { captivePortal: true },
    });

    if (!authMethod) {
      console.error('[Social Callback] No enabled social auth method found in database');
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'no_config');
      return NextResponse.redirect(redirectUrl);
    }

    // ── Parse OAuth config JSON ──
    let oauthConfig: Record<string, unknown> = {};
    try {
      const rawConfig = authMethod.config || '{}';
      oauthConfig = JSON.parse(
        typeof rawConfig === 'string' ? rawConfig : JSON.stringify(rawConfig),
      );
    } catch {
      // Malformed config
    }

    const providerConfig = oauthConfig[provider] as Record<string, unknown> | undefined;

    // Check if provider is disabled
    if (providerConfig && providerConfig.enabled === false) {
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'provider_disabled');
      return NextResponse.redirect(redirectUrl);
    }

    const clientId = (providerConfig?.clientId as string) || (oauthConfig.clientId as string);
    const clientSecret = (providerConfig?.clientSecret as string) || (oauthConfig.clientSecret as string);

    if (!clientId || !clientSecret) {
      console.error(
        `[Social Callback] Missing OAuth credentials for ${provider} (portal: ${authMethod.captivePortal.slug})`,
      );
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'no_credentials');
      return NextResponse.redirect(redirectUrl);
    }

    const tokenEndpoint = TOKEN_ENDPOINTS[provider];
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/wifi/social/callback`;

    // ── Exchange authorization code for tokens ──
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Apple requires client_secret to be a JWT signed with the private key.
    // Generate it if privateKey, teamId, and keyId are configured.
    if (provider === 'apple' && providerConfig) {
      const applePrivateKey = providerConfig.privateKey as string | undefined;
      const appleTeamId = providerConfig.teamId as string | undefined;
      const appleKeyId = providerConfig.keyId as string | undefined;

      if (applePrivateKey && appleTeamId && appleKeyId) {
        try {
          const jwtSecret = await generateAppleClientSecret(applePrivateKey, appleTeamId, appleKeyId, clientId);
          tokenBody.set('client_secret', jwtSecret);
        } catch (jwtErr) {
          console.error('[Social Callback] Apple JWT generation failed:', jwtErr);
          const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
          redirectUrl.searchParams.set('social_error', 'apple_jwt_failed');
          return NextResponse.redirect(redirectUrl);
        }
      }
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });
    } catch (fetchError) {
      console.error(`[Social Callback] Network error calling ${provider} token endpoint:`, fetchError);
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'token_endpoint_unreachable');
      return NextResponse.redirect(redirectUrl);
    }

    let tokenData: Record<string, unknown>;
    try {
      tokenData = await tokenRes.json();
    } catch {
      console.error(`[Social Callback] Failed to parse ${provider} token response`);
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'token_parse_error');
      return NextResponse.redirect(redirectUrl);
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error(
        `[Social Callback] Token exchange failed for ${provider}:`,
        tokenRes.status,
        tokenRes.statusText,
        JSON.stringify(tokenData),
      );
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'token_exchange_failed');
      if (tokenData.error) redirectUrl.searchParams.set('social_error_detail', String(tokenData.error));
      return NextResponse.redirect(redirectUrl);
    }

    // ── Extract user identity ──
    let idToken: string | null = (tokenData.id_token as string) || null;
    let email = '';
    let name = '';
    let providerUserId = '';

    if (provider === 'facebook') {
      // Facebook doesn't return ID tokens — fetch user info from Graph API
      try {
        const graphRes = await fetch(
          `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`,
        );
        const graphData = await graphRes.json();

        if (!graphRes.ok) {
          console.error('[Social Callback] Facebook Graph API error:', graphData);
          const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
          redirectUrl.searchParams.set('social_error', 'graph_api_failed');
          return NextResponse.redirect(redirectUrl);
        }

        email = graphData.email || '';
        name = graphData.name || '';
        providerUserId = `facebook_${graphData.id || randomUUID()}`;

        // Construct a synthetic ID token for uniform handling downstream
        idToken = Buffer.from(
          JSON.stringify({
            sub: providerUserId,
            email,
            name,
            iss: 'https://graph.facebook.com',
            aud: clientId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString('base64url');
      } catch (graphError) {
        console.error('[Social Callback] Facebook Graph API fetch error:', graphError);
        const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
        redirectUrl.searchParams.set('social_error', 'graph_api_error');
        return NextResponse.redirect(redirectUrl);
      }
    } else if (provider === 'google') {
      // Google returns a standard JWT id_token
      try {
        const claims = decodeJwtPayload(idToken!);
        email = (claims.email as string) || '';
        name = (claims.name as string) || (claims.given_name as string) || email.split('@')[0] || '';
        providerUserId = (claims.sub as string) || '';
      } catch (decodeErr) {
        console.error('[Social Callback] Google ID token decode error:', decodeErr);
        const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
        redirectUrl.searchParams.set('social_error', 'id_token_decode_failed');
        return NextResponse.redirect(redirectUrl);
      }
    } else if (provider === 'apple') {
      // Apple returns a JWT id_token, but email/name may require the user object
      try {
        const claims = decodeJwtPayload(idToken!);
        email = (claims.email as string) || '';
        // Apple may not return name in the id_token; it comes in the user form_post param
        name = (claims.name as string) || email.split('@')[0] || '';
        providerUserId = (claims.sub as string) || '';
      } catch (decodeErr) {
        console.error('[Social Callback] Apple ID token decode error:', decodeErr);
        const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
        redirectUrl.searchParams.set('social_error', 'id_token_decode_failed');
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (!idToken) {
      console.error(`[Social Callback] No ID token available for ${provider}`);
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'no_id_token');
      return NextResponse.redirect(redirectUrl);
    }

    if (!email && !providerUserId) {
      console.error(
        `[Social Callback] No email or user ID from ${provider}. Cannot create WiFi session.`,
      );
      const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
      redirectUrl.searchParams.set('social_error', 'no_user_identity');
      return NextResponse.redirect(redirectUrl);
    }

    // ── Redirect to /connect with social auth data ──
    // The captive portal frontend will read these params and call
    // POST /api/v1/wifi/auth with method=social, socialToken, etc.
    console.log(
      `[Social Callback] Success: provider=${provider} email=${email || '(none)'} userId=${providerUserId || '(none)'}`,
    );

    const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
    redirectUrl.searchParams.set('social_provider', provider);
    redirectUrl.searchParams.set('social_token', idToken);
    if (email) redirectUrl.searchParams.set('social_email', email);
    if (name) redirectUrl.searchParams.set('social_name', name);
    if (state) redirectUrl.searchParams.set('social_state', state);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[Social Callback] Unhandled error:', error);
    const redirectUrl = new URL(DEFAULT_REDIRECT_BASE, request.url);
    redirectUrl.searchParams.set('social_error', 'internal');
    return NextResponse.redirect(redirectUrl);
  }
}

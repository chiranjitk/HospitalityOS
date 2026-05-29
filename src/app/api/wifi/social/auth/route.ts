// GET /api/wifi/social/auth?provider=google&portalSlug=xxx
//
// Initiates the OAuth social login flow for the WiFi captive portal.
// When a guest clicks "Login with Google/Facebook/Apple", this API is called.
//
// - Validates the provider (google, facebook, apple)
// - Reads OAuth config from PortalAuthentication.config JSON for this portal
// - If no OAuth config found, returns error
// - If OAuth config exists, returns the provider authorization URL
// - Includes redirect_uri pointing to /api/wifi/social/callback?provider=xxx
// - Includes state parameter (random nonce for CSRF protection)
// - Includes scopes appropriate for each provider
//
// If no real OAuth config exists, supports a DEMO mode:
// - Returns { mode: 'demo', demoToken: '...', provider: '...' }
// - The demo token is a base64url-encoded JSON that the auth API can decode

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

const VALID_PROVIDERS = ['google', 'facebook', 'apple'] as const;
type SocialProvider = (typeof VALID_PROVIDERS)[number];

const PROVIDERS: Record<
  SocialProvider,
  {
    authUrl: string;
    scope: string;
    responseType: string;
    extraParams?: Record<string, string>;
  }
> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    responseType: 'code',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scope: 'email public_profile',
    responseType: 'code',
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    scope: 'email name',
    responseType: 'code',
    extraParams: { response_mode: 'form_post' },
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') as SocialProvider | null;
  const portalSlug = searchParams.get('portalSlug') as string | null;

  // ── Validate provider ──
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PROVIDER',
          message: `Invalid social login provider. Supported: ${VALID_PROVIDERS.join(', ')}`,
        },
      },
      { status: 400 },
    );
  }

  // ── Validate portalSlug ──
  if (!portalSlug) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_PORTAL_SLUG',
          message: 'portalSlug query parameter is required',
        },
      },
      { status: 400 },
    );
  }

  try {
    // ── Find portal and its social auth config ──
    const portal = await db.captivePortal.findFirst({
      where: { slug: portalSlug, enabled: true },
      include: {
        authMethods: {
          where: { method: 'social', enabled: true },
          take: 1,
        },
      },
    });

    if (!portal) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PORTAL_NOT_FOUND',
            message: `No active captive portal found with slug "${portalSlug}"`,
          },
        },
        { status: 404 },
      );
    }

    // ── Extract OAuth config from PortalAuthentication.config JSON ──
    let oauthConfig: Record<string, unknown> = {};
    if (portal.authMethods[0]) {
      try {
        const rawConfig = portal.authMethods[0].config || '{}';
        oauthConfig = JSON.parse(
          typeof rawConfig === 'string' ? rawConfig : JSON.stringify(rawConfig),
        );
      } catch {
        // Config is malformed — continue with empty config (will fall into demo mode)
      }
    }

    // Resolve provider-specific config, then fall back to a top-level clientId
    const providerConfig = oauthConfig[provider] as Record<string, unknown> | undefined;

    // Check if this specific provider is enabled in the config
    if (providerConfig && providerConfig.enabled === false) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_DISABLED',
            message: `${provider} login is currently disabled for this portal.`,
          },
        },
        { status: 403 },
      );
    }

    const clientId = (providerConfig?.clientId as string) || (oauthConfig.clientId as string);

    if (!clientId) {
      // ── DEMO MODE — no real OAuth credentials configured ──
      // Return a demo token that the auth API can validate
      const providerDisplayName =
        provider.charAt(0).toUpperCase() + provider.slice(1);

      const demoClaims = {
        sub: `demo_${randomUUID()}`,
        email: `demo.user@${provider}.com`,
        name: `Demo ${providerDisplayName} User`,
        given_name: 'Demo',
        family_name: `${providerDisplayName} User`,
        picture: null,
        iss: `https://demo.${provider}.com`,
        aud: 'wifi-portal-demo',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: randomUUID(),
      };

      const demoToken = Buffer.from(JSON.stringify(demoClaims)).toString('base64url');

      console.log(
        `[Social Auth] Demo mode activated for provider=${provider} portal=${portalSlug}`,
      );

      return NextResponse.json({
        success: true,
        data: {
          mode: 'demo',
          provider,
          demoToken,
          message: `Demo mode: ${provider} OAuth is not configured. Using simulated authentication.`,
        },
      });
    }

    // ── REAL OAUTH FLOW ──
    const providerInfo = PROVIDERS[provider];
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/wifi/social/callback`;
    const state = randomUUID();

    const authUrl = new URL(providerInfo.authUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', providerInfo.responseType);
    authUrl.searchParams.set('scope', providerInfo.scope);
    authUrl.searchParams.set('state', state);

    // Provider-specific extra params
    if (providerInfo.extraParams) {
      for (const [key, value] of Object.entries(providerInfo.extraParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    // Apple requires response_mode=form_post (already set via extraParams)
    // Google: optionally request access_type=offline for refresh tokens
    if (provider === 'google') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'select_account');
    }

    // Facebook: optionally include auth_type=rerequest to re-ask for declined permissions
    if (provider === 'facebook') {
      authUrl.searchParams.set('auth_type', 'rerequest');
    }

    console.log(
      `[Social Auth] OAuth flow initiated: provider=${provider} portal=${portalSlug} state=${state.substring(0, 8)}...`,
    );

    return NextResponse.json({
      success: true,
      data: {
        mode: 'oauth',
        provider,
        redirectUrl: authUrl.toString(),
        state,
      },
    });
  } catch (error) {
    console.error('[Social Auth] Error initiating OAuth flow:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to initiate social login. Please try again.',
        },
      },
      { status: 500 },
    );
  }
}

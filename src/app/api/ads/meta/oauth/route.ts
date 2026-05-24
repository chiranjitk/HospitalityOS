import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * Meta OAuth flow for Meta (Facebook) Marketing API integration.
 *
 * GET  — Initiate OAuth redirect to Meta's consent screen
 * POST — Handle OAuth callback (exchange code for long-lived token)
 */

const META_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const META_SCOPES = 'ads_management,ads_read,business_management';

// ─── GET: Initiate OAuth flow ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXTAUTH_URL || ''}/api/ads/meta/oauth`;
    const scope = META_SCOPES;

    if (!appId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Meta app_id is required' } },
        { status: 400 }
      );
    }

    // Generate server-side state and store in response for session validation
    const state = `${user.tenantId}:${user.id}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;

    const authUrl = new URL(META_AUTH_URL);
    authUrl.set('client_id', appId);
    authUrl.set('redirect_uri', redirectUri);
    authUrl.set('scope', scope);
    authUrl.set('state', state);
    authUrl.set('response_type', 'code');

    return NextResponse.json({
      success: true,
      data: { authUrl: authUrl.toString(), state },
    });
  } catch (error) {
    console.error('[MetaAdsOAuth] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate OAuth' } },
      { status: 500 }
    );
  }
}

// ─── POST: Handle OAuth callback ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, appId, appSecret, redirectUri, accountId, pixelId, propertyId } = body;

    if (!code || !appId || !appSecret) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required OAuth parameters' } },
        { status: 400 }
      );
    }

    // Step 1: Exchange code for short-lived access token
    const shortLivedTokenUrl = `${META_TOKEN_URL}?` + new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri || `${process.env.NEXTAUTH_URL || ''}/api/ads/meta/oauth`,
      code,
    });

    const shortLivedResponse = await fetch(shortLivedTokenUrl);
    const shortLivedData = await shortLivedResponse.json();

    if (shortLivedData.error) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXCHANGE_FAILED', message: shortLivedData.error?.message || 'Failed to exchange code for token' } },
        { status: 400 }
      );
    }

    const shortLivedToken = shortLivedData.access_token;

    // Step 2: Exchange short-lived token for long-lived token
    const longLivedTokenUrl = `${META_TOKEN_URL}?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const longLivedResponse = await fetch(longLivedTokenUrl);
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      return NextResponse.json(
        { success: false, error: { code: 'LONG_LIVED_TOKEN_FAILED', message: longLivedData.error?.message || 'Failed to get long-lived token' } },
        { status: 400 }
      );
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in;

    // Step 3: Store encrypted credentials
    if (accountId) {
      const encryptedAppSecret = encrypt(appSecret);
      const encryptedAccessToken = encrypt(accessToken);

      const existing = await db.metaAdsConnection.findFirst({
        where: {
          tenantId: user.tenantId,
          accountId,
          ...(propertyId ? { propertyId } : {}),
        },
      });

      if (existing) {
        await db.metaAdsConnection.update({
          where: { id: existing.id },
          data: {
            appSecret: encryptedAppSecret,
            accessToken: encryptedAccessToken,
            pixelId: pixelId || null,
            credentials: {
              appId,
              appSecret: encryptedAppSecret,
              accessToken: encryptedAccessToken,
              accountId,
              pixelId: pixelId || null,
            },
            status: 'connected',
            lastError: null,
          },
        });
      } else {
        await db.metaAdsConnection.create({
          data: {
            tenantId: user.tenantId,
            propertyId: propertyId || null,
            appId,
            appSecret: encryptedAppSecret,
            accessToken: encryptedAccessToken,
            accountId,
            pixelId: pixelId || null,
            credentials: {
              appId,
              appSecret: encryptedAppSecret,
              accessToken: encryptedAccessToken,
              accountId,
              pixelId: pixelId || null,
            },
            status: 'connected',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Meta OAuth completed successfully',
        expiresIn,
        stored: !!accountId,
      },
    });
  } catch (error) {
    console.error('[MetaAdsOAuth] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'OAuth callback failed' } },
      { status: 500 }
    );
  }
}

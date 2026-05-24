import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * Google OAuth flow for Google Ads API integration.
 *
 * GET  — Initiate OAuth redirect to Google's consent screen
 * POST — Handle OAuth callback (exchange authorization code for tokens)
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXTAUTH_URL || ''}/api/ads/google/oauth`;
    const scope = searchParams.get('scope') || 'https://www.googleapis.com/auth/adwords';
    // Always use server-generated state to prevent CSRF
    const state = `${user.tenantId}:${user.id}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
    const accessType = 'offline';
    const prompt = 'consent';

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Google OAuth client_id is required' } },
        { status: 400 }
      );
    }

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.set('client_id', clientId);
    authUrl.set('redirect_uri', redirectUri);
    authUrl.set('response_type', 'code');
    authUrl.set('scope', scope);
    authUrl.set('state', state);
    authUrl.set('access_type', accessType);
    authUrl.set('prompt', prompt);

    return NextResponse.json({
      success: true,
      data: { authUrl: authUrl.toString(), state },
    });
  } catch (error) {
    console.error('[GoogleAdsOAuth] GET error:', error);
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
    const { code, clientId, clientSecret, redirectUri, propertyId, developerToken, customerId } = body;

    if (!code || !clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required OAuth parameters' } },
        { status: 400 }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || `${process.env.NEXTAUTH_URL || ''}/api/ads/google/oauth`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json();
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXCHANGE_FAILED', message: err.error_description || err.error || 'Failed to exchange code for tokens' } },
        { status: 400 }
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token returned. Ensure prompt=consent in auth URL.' } },
        { status: 400 }
      );
    }

    // Store encrypted credentials
    if (propertyId) {
      const encryptedCredentials = {
        developerToken: encrypt(developerToken || ''),
        clientId: encrypt(clientId),
        clientSecret: encrypt(clientSecret),
        refreshToken: encrypt(refreshToken),
        customerId: encrypt(customerId || ''),
        accountId: encrypt(customerId || ''),
      };

      const existing = await db.googleHotelAdsConnection.findUnique({
        where: { tenantId_propertyId: { tenantId: user.tenantId, propertyId } },
      });

      if (existing) {
        await db.googleHotelAdsConnection.update({
          where: { id: existing.id },
          data: {
            credentials: encryptedCredentials,
            accountId: customerId || '',
            status: 'connected',
            lastError: null,
          },
        });
      } else {
        await db.googleHotelAdsConnection.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            credentials: encryptedCredentials,
            accountId: customerId || '',
            status: 'connected',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Google OAuth completed successfully',
        hasRefreshToken: !!refreshToken,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
        stored: !!propertyId,
      },
    });
  } catch (error) {
    console.error('[GoogleAdsOAuth] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'OAuth callback failed' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import {
  GoogleAdsClient,
  encryptGoogleAdsCredentials,
  decryptGoogleAdsCredentials,
} from '@/lib/ads/google-ads-client';
import {
  MetaAdsClient,
  encryptMetaAdsCredentials,
  decryptMetaAdsCredentials,
} from '@/lib/ads/meta-ads-client';

// ─── GET: List all ad platform connections ────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform'); // 'google' | 'meta'

    const connections: Array<{ platform: string; connection: Record<string, unknown> }> = [];

    if (!platform || platform === 'google') {
      const googleConns = await db.googleHotelAdsConnection.findMany({
        where: { tenantId },
        take: 10,
      });

      for (const conn of googleConns) {
        const creds = (conn.credentials as Record<string, string | null>) || {};
        connections.push({
          platform: 'google',
          connection: {
            id: conn.id,
            tenantId: conn.tenantId,
            propertyId: conn.propertyId,
            status: conn.status,
            accountId: conn.accountId,
            lastPriceFeedAt: conn.lastPriceFeedAt,
            totalBookings: conn.totalBookings,
            totalRevenue: conn.totalRevenue,
            hasCredentials: !!creds.developerToken,
            connectionMode: conn.connectionMode,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
          },
        });
      }
    }

    if (!platform || platform === 'meta') {
      const metaConns = await db.metaAdsConnection.findMany({
        where: { tenantId },
        take: 10,
      });

      for (const conn of metaConns) {
        const creds = (conn.credentials as Record<string, string | null>) || {};
        connections.push({
          platform: 'meta',
          connection: {
            id: conn.id,
            tenantId: conn.tenantId,
            propertyId: conn.propertyId,
            status: conn.status,
            accountId: conn.accountId,
            pixelId: conn.pixelId,
            lastSyncedAt: conn.lastSyncedAt,
            lastError: conn.lastError,
            hasCredentials: !!creds.accessToken,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { connections },
    });
  } catch (error) {
    console.error('[AdsConnections] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch connections' } },
      { status: 500 }
    );
  }
}

// ─── POST: Save connection credentials ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { platform, propertyId } = body;

    if (!platform || !['google', 'meta'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Platform must be "google" or "meta"' } },
        { status: 400 }
      );
    }

    // ─── Google Ads Connection ─────────────────────────────────────────────
    if (platform === 'google') {
      const {
        developerToken,
        clientId,
        clientSecret,
        refreshToken,
        customerId,
        accountId,
      } = body;

      if (!propertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required for Google Ads' } },
          { status: 400 }
        );
      }

      if (!developerToken || !clientSecret || !refreshToken || !customerId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required Google Ads fields' } },
          { status: 400 }
        );
      }

      const encryptedCreds = encryptGoogleAdsCredentials({
        developerToken,
        clientId: clientId || '',
        clientSecret,
        refreshToken,
        customerId,
        accountId: accountId || customerId,
      });

      const existing = await db.googleHotelAdsConnection.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
      });

      if (existing) {
        const updated = await db.googleHotelAdsConnection.update({
          where: { id: existing.id },
          data: {
            credentials: encryptedCreds,
            accountId: accountId || customerId,
            status: 'connected',
            lastError: null,
          },
        });

        return NextResponse.json({ success: true, data: { platform: 'google', connection: updated } });
      }

      const created = await db.googleHotelAdsConnection.create({
        data: {
          tenantId,
          propertyId,
          credentials: encryptedCreds,
          accountId: accountId || customerId,
          status: 'connected',
        },
      });

      return NextResponse.json({ success: true, data: { platform: 'google', connection: created } });
    }

    // ─── Meta Ads Connection ───────────────────────────────────────────────
    if (platform === 'meta') {
      const { appId, appSecret, accessToken, accountId, pixelId } = body;

      if (!appId || !appSecret || !accessToken || !accountId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required Meta Ads fields' } },
          { status: 400 }
        );
      }

      const encryptedCreds = encryptMetaAdsCredentials({
        appId,
        appSecret,
        accessToken,
        accountId,
        pixelId,
      });

      const existing = await db.metaAdsConnection.findFirst({
        where: {
          tenantId,
          propertyId: propertyId || null,
          accountId,
        },
      });

      if (existing) {
        const updated = await db.metaAdsConnection.update({
          where: { id: existing.id },
          data: {
            appId,
            appSecret: encryptedCreds.appSecret,
            accessToken: encryptedCreds.accessToken,
            accountId,
            pixelId: pixelId || null,
            credentials: encryptedCreds,
            status: 'connected',
            lastError: null,
          },
        });

        return NextResponse.json({ success: true, data: { platform: 'meta', connection: updated } });
      }

      const created = await db.metaAdsConnection.create({
        data: {
          tenantId,
          propertyId: propertyId || null,
          appId,
          appSecret: encryptedCreds.appSecret,
          accessToken: encryptedCreds.accessToken,
          accountId,
          pixelId: pixelId || null,
          credentials: encryptedCreds,
          status: 'connected',
        },
      });

      return NextResponse.json({ success: true, data: { platform: 'meta', connection: created } });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[AdsConnections] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save connection' } },
      { status: 500 }
    );
  }
}

// ─── PUT: Update credentials ─────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { platform, id, ...updateData } = body;

    if (!platform || !id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Platform and connection ID are required' } },
        { status: 400 }
      );
    }

    if (platform === 'google') {
      const conn = await db.googleHotelAdsConnection.findUnique({ where: { id } });
      if (!conn || conn.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      const data: Record<string, unknown> = {};
      if (updateData.status) data.status = updateData.status;
      if (updateData.accountId) data.accountId = updateData.accountId;
      if (updateData.connectionMode) data.connectionMode = updateData.connectionMode;

      if (updateData.developerToken || updateData.clientSecret || updateData.refreshToken) {
        const existingCreds = (conn.credentials as Record<string, string | null>) || {};
        const newCreds = encryptGoogleAdsCredentials({
          developerToken: updateData.developerToken || decrypt(existingCreds.developerToken || '') || '',
          clientId: updateData.clientId || decrypt(existingCreds.clientSecret || '') || '',
          clientSecret: updateData.clientSecret || decrypt(existingCreds.clientSecret || '') || '',
          refreshToken: updateData.refreshToken || decrypt(existingCreds.refreshToken || '') || '',
          customerId: updateData.customerId || conn.accountId || '',
          accountId: conn.accountId || '',
        });
        data.credentials = newCreds;
      }

      const updated = await db.googleHotelAdsConnection.update({
        where: { id },
        data,
      });

      return NextResponse.json({ success: true, data: { platform: 'google', connection: updated } });
    }

    if (platform === 'meta') {
      const conn = await db.metaAdsConnection.findUnique({ where: { id } });
      if (!conn || conn.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      const data: Record<string, unknown> = {};
      if (updateData.status) data.status = updateData.status;
      if (updateData.pixelId !== undefined) data.pixelId = updateData.pixelId;

      if (updateData.appSecret || updateData.accessToken) {
        const newCreds = encryptMetaAdsCredentials({
          appId: conn.appId,
          appSecret: updateData.appSecret || '',
          accessToken: updateData.accessToken || '',
          accountId: conn.accountId,
          pixelId: conn.pixelId || undefined,
        });
        data.appSecret = newCreds.appSecret;
        data.accessToken = newCreds.accessToken;
        data.credentials = newCreds;
      }

      const updated = await db.metaAdsConnection.update({
        where: { id },
        data,
      });

      return NextResponse.json({ success: true, data: { platform: 'meta', connection: updated } });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[AdsConnections] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update connection' } },
      { status: 500 }
    );
  }
}

// ─── DELETE: Revoke and remove connection ────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const platform = searchParams.get('platform');

    if (!id || !platform) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID and platform are required' } },
        { status: 400 }
      );
    }

    if (platform === 'google') {
      const conn = await db.googleHotelAdsConnection.findUnique({ where: { id } });
      if (!conn || conn.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      await db.googleHotelAdsConnection.update({
        where: { id },
        data: { status: 'disconnected', credentials: {} },
      });

      return NextResponse.json({ success: true, data: { message: 'Google Ads connection revoked' } });
    }

    if (platform === 'meta') {
      const conn = await db.metaAdsConnection.findUnique({ where: { id } });
      if (!conn || conn.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      await db.metaAdsConnection.delete({ where: { id } });

      return NextResponse.json({ success: true, data: { message: 'Meta Ads connection removed' } });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[AdsConnections] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete connection' } },
      { status: 500 }
    );
  }
}

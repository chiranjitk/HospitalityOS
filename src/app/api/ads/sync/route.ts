import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { decryptGoogleAdsCredentials, GoogleAdsClient } from '@/lib/ads/google-ads-client';
import { decryptMetaAdsCredentials, MetaAdsClient } from '@/lib/ads/meta-ads-client';

// In-memory idempotency tracking for sync operations
const syncInProgress = new Map<string, number>(); // tenantId:platform -> timestamp
const SYNC_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/ads/sync — Trigger sync of campaigns and performance data
 * from Google Ads and Meta Ads into local AdCampaign / AdPerformance tables.
 */

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { platform, startDate, endDate } = body;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const results: Array<{ platform: string; synced: number; errors: string[] }> = [];

    // Idempotency: prevent concurrent syncs for same tenant
    const idempKey = `${tenantId}:${platform || 'all'}`;
    const lastSync = syncInProgress.get(idempKey);
    if (lastSync && Date.now() - lastSync < SYNC_TIMEOUT) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A sync is already in progress for this tenant' } },
        { status: 409 }
      );
    }
    syncInProgress.set(idempKey, Date.now());
    try {
    // ─── Sync Google Ads ──────────────────────────────────────────────────
    if (!platform || platform === 'google') {
      const googleResult = await syncGoogleAds(tenantId, startStr, endStr);
      results.push(googleResult);
    }

    // ─── Sync Meta Ads ────────────────────────────────────────────────────
    if (!platform || platform === 'meta') {
      const metaResult = await syncMetaAds(tenantId, startStr, endStr);
      results.push(metaResult);
    }

    return NextResponse.json({
      success: true,
      data: { results, syncedAt: new Date().toISOString() },
    });
  } finally {
    syncInProgress.delete(idempKey);
  }
  } catch (error) {
    console.error('[AdsSync] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Sync failed' } },
      { status: 500 }
    );
  }
}

// ─── Google Ads Sync ────────────────────────────────────────────────────────

async function syncGoogleAds(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{ platform: string; synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const connections = await db.googleHotelAdsConnection.findMany({
      where: { tenantId, status: 'connected' },
    });

    for (const conn of connections) {
      try {
        const creds = (conn.credentials as Record<string, string | null>) || {};
        const config = decryptGoogleAdsCredentials(creds);

        if (!config) {
          errors.push(`Google connection ${conn.id}: failed to decrypt credentials`);
          continue;
        }

        const client = new GoogleAdsClient(config);
        const campaignsResult = await client.listCampaigns();

        if (!campaignsResult.success || !campaignsResult.data) {
          errors.push(`Google: failed to list campaigns - ${campaignsResult.error?.message}`);
          continue;
        }

        for (const gc of campaignsResult.data) {
          // Upsert local campaign
          const localCampaign = await db.adCampaign.upsert({
            where: { id: gc.id },
            update: {
              name: gc.name,
              status: mapGoogleStatus(gc.status),
              platform: 'google',
              budget: Math.round(gc.budgetMicros / 1000000),
              startDate: gc.startDate ? new Date(gc.startDate) : undefined,
              endDate: gc.endDate ? new Date(gc.endDate) : undefined,
              lastSyncAt: new Date(),
            },
            create: {
              id: gc.id,
              tenantId,
              propertyId: conn.propertyId,
              name: gc.name,
              type: 'search',
              platform: 'google',
              status: mapGoogleStatus(gc.status),
              budget: Math.round(gc.budgetMicros / 1000000),
              startDate: gc.startDate ? new Date(gc.startDate) : undefined,
              endDate: gc.endDate ? new Date(gc.endDate) : undefined,
              externalId: gc.id,
              lastSyncAt: new Date(),
            },
          });

          synced++;

          // Pull daily performance
          const perfResult = await client.getPerformanceMetrics(startDate, endDate, `customers/${config.customerId}/campaigns/${gc.id}`);

          if (perfResult.success && perfResult.data) {
            for (const gm of perfResult.data) {
              await db.adPerformance.upsert({
                where: {
                  campaignId_date: {
                    campaignId: localCampaign.id,
                    date: new Date(gm.date),
                  },
                },
                update: {
                  impressions: gm.impressions,
                  clicks: gm.clicks,
                  conversions: gm.conversions,
                  cost: Math.round(gm.costMicros / 1000000),
                  revenue: Math.round(gm.conversionValueMicros / 1000000),
                  ctr: gm.ctr * 100,
                  cpc: gm.cpcMicros / 1000000,
                  roas: gm.conversionsValuePerCost,
                  qualityScore: gm.averagePosition ? 10 - Math.min(gm.averagePosition, 10) : null,
                },
                create: {
                  campaignId: localCampaign.id,
                  date: new Date(gm.date),
                  impressions: gm.impressions,
                  clicks: gm.clicks,
                  conversions: gm.conversions,
                  cost: Math.round(gm.costMicros / 1000000),
                  revenue: Math.round(gm.conversionValueMicros / 1000000),
                  ctr: gm.ctr * 100,
                  cpc: gm.cpcMicros / 1000000,
                  roas: gm.conversionsValuePerCost,
                  qualityScore: gm.averagePosition ? 10 - Math.min(gm.averagePosition, 10) : null,
                },
              });
            }
          }
        }

        await db.googleHotelAdsConnection.update({
          where: { id: conn.id },
          data: { lastPriceFeedAt: new Date() },
        });
      } catch (err) {
        errors.push(`Google connection ${conn.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (err) {
    errors.push(`Google sync: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return { platform: 'google', synced, errors };
}

// ─── Meta Ads Sync ──────────────────────────────────────────────────────────

async function syncMetaAds(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{ platform: string; synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const connections = await db.metaAdsConnection.findMany({
      where: { tenantId, status: 'connected' },
    });

    for (const conn of connections) {
      try {
        const config = decryptMetaAdsCredentials({
          appSecret: conn.appSecret,
          accessToken: conn.accessToken,
          appId: conn.appId,
          accountId: conn.accountId,
          pixelId: conn.pixelId,
        });

        if (!config) {
          errors.push(`Meta connection ${conn.id}: failed to decrypt credentials`);
          continue;
        }

        const client = new MetaAdsClient(config);
        const campaignsResult = await client.listCampaigns();

        if (!campaignsResult.success || !campaignsResult.data) {
          errors.push(`Meta: failed to list campaigns - ${campaignsResult.error?.message}`);
          continue;
        }

        for (const mc of campaignsResult.data) {
          // Upsert local campaign
          const localCampaign = await db.adCampaign.upsert({
            where: { id: mc.id },
            update: {
              name: mc.name,
              status: mapMetaStatus(mc.status),
              platform: 'meta',
              budget: mc.dailyBudget || mc.budget || 0,
              startDate: mc.createdAt ? new Date(mc.createdAt) : undefined,
              lastSyncAt: new Date(),
            },
            create: {
              id: mc.id,
              tenantId,
              propertyId: conn.propertyId || undefined,
              name: mc.name,
              type: mapMetaObjective(mc.objective),
              platform: 'meta',
              status: mapMetaStatus(mc.status),
              budget: mc.dailyBudget || mc.budget || 0,
              startDate: mc.createdAt ? new Date(mc.createdAt) : undefined,
              externalId: mc.id,
              lastSyncAt: new Date(),
            },
          });

          synced++;

          // Pull daily performance
          const perfResult = await client.getCampaignPerformance(mc.id, startDate, endDate);

          if (perfResult.success && perfResult.data) {
            for (const mp of perfResult.data) {
              await db.adPerformance.upsert({
                where: {
                  campaignId_date: {
                    campaignId: localCampaign.id,
                    date: new Date(mp.date),
                  },
                },
                update: {
                  impressions: mp.impressions,
                  clicks: mp.clicks,
                  conversions: mp.conversions,
                  cost: mp.spend,
                  revenue: mp.conversionValue,
                  ctr: mp.ctr * 100,
                  cpc: mp.cpc,
                  roas: mp.roas,
                  deviceBreakdown: JSON.stringify({}),
                  sourceBreakdown: JSON.stringify({ meta_reach: mp.reach, meta_frequency: mp.frequency }),
                },
                create: {
                  campaignId: localCampaign.id,
                  date: new Date(mp.date),
                  impressions: mp.impressions,
                  clicks: mp.clicks,
                  conversions: mp.conversions,
                  cost: mp.spend,
                  revenue: mp.conversionValue,
                  ctr: mp.ctr * 100,
                  cpc: mp.cpc,
                  roas: mp.roas,
                  deviceBreakdown: JSON.stringify({}),
                  sourceBreakdown: JSON.stringify({ meta_reach: mp.reach, meta_frequency: mp.frequency }),
                },
              });
            }
          }
        }

        await db.metaAdsConnection.update({
          where: { id: conn.id },
          data: { lastSyncedAt: new Date(), lastError: null },
        });
      } catch (err) {
        errors.push(`Meta connection ${conn.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (err) {
    errors.push(`Meta sync: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return { platform: 'meta', synced, errors };
}

// ─── Status Mappers ──────────────────────────────────────────────────────────

function mapGoogleStatus(status: string): string {
  switch (status) {
    case 'ENABLED': return 'active';
    case 'PAUSED': return 'paused';
    case 'REMOVED': return 'archived';
    default: return 'draft';
  }
}

function mapMetaStatus(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'paused';
    case 'DELETED': return 'archived';
    case 'ARCHIVED': return 'archived';
    default: return 'draft';
  }
}

function mapMetaObjective(objective: string): string {
  switch (objective) {
    case 'OUTCOME_AWARENESS': return 'display';
    case 'OUTCOME_TRAFFIC': return 'search';
    case 'OUTCOME_APP_PROMOTION': return 'social';
    case 'OUTCOME_LEADS': return 'social';
    case 'OUTCOME_SALES': return 'social';
    default: return 'social';
  }
}

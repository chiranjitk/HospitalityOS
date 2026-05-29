/**
 * Rate Shopping Automation Cron Job
 *
 * GET /api/cron/rate-shopping-automation?cron=true
 *
 * Automatically fetches competitor rates for all properties with configured competitors.
 * Uses the unified rate-fetcher service to attempt real OTA data, falling back to
 * third-party APIs or synthetic data when configured.
 *
 * Auth: Bearer token with CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  fetchCompetitorRates,
  storeFetchedRates,
  getActiveCompetitors,
  getCompSetMembers,
} from '@/lib/revenue/rate-fetcher';

const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cronMode = searchParams.get('cron') === 'true';

  if (!cronMode) {
    return NextResponse.json({
      success: false,
      error: 'This endpoint is for cron automation only. Use ?cron=true with proper auth.',
    }, { status: 400 });
  }

  // Verify cron secret — fail if missing in production
  if (!CRON_SECRET) {
    console.error('[Cron] CRON_SECRET is not configured. Rate shopping automation disabled.');
    return NextResponse.json({
      success: false,
      error: 'CRON_SECRET not configured. Cannot run automation.',
    }, { status: 500 });
  }

  // Accept secret via x-cron-secret header (set by proxy.ts) or Authorization: Bearer
  const providedSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let totalPropertiesChecked = 0;
  let totalRatesFetched = 0;
  let totalRealRates = 0;
  let totalSyntheticRates = 0;
  let totalFailed = 0;

  try {
    // Find all active properties that have competitor configuration
    // Check both new (RateShoppingCompetitor) and legacy (CompetitorPrice) tables
    const propertiesWithNewCompetitors = await db.rateShoppingCompetitor.findMany({
      where: { isActive: true },
      distinct: ['tenantId', 'propertyId'],
      select: { tenantId: true, propertyId: true },
    });

    const propertiesWithLegacyCompetitors = await db.competitorPrice.findMany({
      where: { property: { status: 'active', deletedAt: null } },
      distinct: ['tenantId', 'propertyId'],
      select: { tenantId: true, propertyId: true },
    });

    // Also check for active competitive sets
    const propertiesWithCompSets = await db.competitiveSet.findMany({
      where: { isActive: true },
      distinct: ['tenantId', 'propertyId'],
      select: { tenantId: true, propertyId: true },
    });

    // Deduplicate property keys
    const propertyKeys = new Map<string, { tenantId: string; propertyId: string }>();
    for (const entry of [...propertiesWithNewCompetitors, ...propertiesWithLegacyCompetitors, ...propertiesWithCompSets]) {
      const key = `${entry.tenantId}:${entry.propertyId}`;
      if (entry.propertyId && !propertyKeys.has(key)) {
        propertyKeys.set(key, { tenantId: entry.tenantId, propertyId: entry.propertyId });
      }
    }

    if (propertyKeys.size === 0) {
      return NextResponse.json({
        success: true,
        propertiesChecked: 0,
        totalRatesFetched: 0,
        message: 'No properties with competitor configuration found.',
      });
    }

    // Default date range: next 30 days from today
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    const dateRange = { checkIn: today, checkOut: endDate };

    // Process each property
    for (const { tenantId, propertyId } of propertyKeys.values()) {
      try {
        // Gather all competitors for this property
        let competitors = await getActiveCompetitors(tenantId, propertyId);

        // Include compset members
        const compSetMembers = await getCompSetMembers(tenantId, propertyId);
        const existingNames = new Set(competitors.map(c => c.name));
        for (const member of compSetMembers) {
          if (!existingNames.has(member.name)) {
            competitors.push(member);
          }
        }

        // Include legacy competitors
        const legacyEntries = await db.competitorPrice.findMany({
          where: { tenantId, propertyId },
          distinct: ['competitorName'],
          select: { id: true, competitorName: true, competitorType: true, competitorUrl: true },
        });
        for (const lc of legacyEntries) {
          if (!existingNames.has(lc.competitorName)) {
            competitors.push({
              id: lc.id,
              tenantId,
              name: lc.competitorName,
              channel: lc.competitorType || 'direct',
              propertyId: null,
              url: lc.competitorUrl || null,
              isActive: true,
            });
          }
        }

        if (competitors.length === 0) continue;

        // Fetch rates using the unified rate-fetcher
        const fetchedRates = await fetchCompetitorRates(tenantId, propertyId, competitors, dateRange);

        // Store results in both tables
        const summary = await storeFetchedRates(tenantId, propertyId, fetchedRates);

        totalPropertiesChecked++;
        totalRatesFetched += summary.total;
        totalRealRates += summary.real;
        totalSyntheticRates += summary.synthetic;
        totalFailed += summary.failed;

        // Log completion
        await db.competitorSyncLog.create({
          data: {
            tenantId,
            propertyId,
            competitorName: `cron-batch-${competitors.length}-competitors`,
            syncType: 'auto',
            status: summary.failed === 0 ? 'success' : 'partial',
            pricesCollected: summary.total,
            errorMessage: summary.failed > 0 ? `${summary.failed} rates failed to store` : null,
            startedAt: new Date(startTime),
            completedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`[Cron] Error processing property ${propertyId}:`, error);
        totalFailed++;
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      propertiesChecked: totalPropertiesChecked,
      totalRatesFetched,
      realRates: totalRealRates,
      syntheticRates: totalSyntheticRates,
      failedRates: totalFailed,
      durationMs: duration,
      message: `Processed ${totalPropertiesChecked} propert${totalPropertiesChecked === 1 ? 'y' : 'ies'}: ` +
        `${totalRatesFetched} rates (${totalRealRates} real, ${totalSyntheticRates} synthetic) in ${duration}ms`,
      dataQuality: totalRatesFetched > 0
        ? `${Math.round((totalRealRates / totalRatesFetched) * 100)}% real data`
        : 'no data fetched',
    });
  } catch (error) {
    console.error('[Cron] Rate shopping automation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

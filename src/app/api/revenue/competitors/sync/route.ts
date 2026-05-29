import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  fetchCompetitorRates,
  storeFetchedRates,
  getActiveCompetitors,
  getCompSetMembers,
  getFetchStrategy,
} from '@/lib/revenue/rate-fetcher';
import { z } from 'zod';

/** Whether synthetic demo data is allowed */
const ALLOW_DEMO_DATA = process.env.COMPETITOR_PRICING_ALLOW_DEMO === 'true';

// Validation schema
const SyncRequestSchema = z.object({
  propertyId: z.string().uuid(),
  competitorNames: z.array(z.string()).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
});

// POST /api/revenue/competitors/sync - Trigger manual competitor price sync
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'revenue.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const parsed = SyncRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { propertyId, competitorNames, checkIn, checkOut } = parsed.data;

    // Validate the property belongs to the tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Default date range: today + 30 days
    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 30);

    const startDate = checkIn ? new Date(checkIn) : today;
    const endDate = checkOut ? new Date(checkOut) : defaultEnd;
    const dateRange = { checkIn: startDate, checkOut: endDate };

    // Gather competitors from all sources
    let competitors = await getActiveCompetitors(user.tenantId, propertyId);

    // Also include compset members
    const compSetMembers = await getCompSetMembers(user.tenantId, propertyId);
    const existingNames = new Set(competitors.map(c => c.name));
    for (const member of compSetMembers) {
      if (!existingNames.has(member.name)) {
        competitors.push(member);
      }
    }

    // Also check legacy CompetitorPrice entries for competitors not in new tables
    const legacyCompetitors = await db.competitorPrice.findMany({
      where: { tenantId: user.tenantId, propertyId },
      distinct: ['competitorName'],
      select: {
        id: true,
        competitorName: true,
        competitorType: true,
        competitorUrl: true,
        roomTypeId: true,
        roomTypeName: true,
        rating: true,
      },
    });
    for (const lc of legacyCompetitors) {
      if (!existingNames.has(lc.competitorName)) {
        competitors.push({
          id: lc.id,
          tenantId: user.tenantId,
          name: lc.competitorName,
          channel: lc.competitorType || 'direct',
          propertyId: null,
          url: lc.competitorUrl || null,
          isActive: true,
        });
      }
    }

    // Filter to specific competitors if requested
    if (competitorNames && competitorNames.length > 0) {
      competitors = competitors.filter(c => competitorNames.includes(c.name));
    }

    if (competitors.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        failed: 0,
        results: [],
        date: today.toISOString().split('T')[0],
        message: 'No competitors configured for this property',
      });
    }

    // Get active channel connections for strategy reporting
    const connections = await db.channelConnection.findMany({
      where: { tenantId: user.tenantId, status: 'active' },
    });

    // Fetch rates using the unified rate-fetcher service
    const fetchedRates = await fetchCompetitorRates(
      user.tenantId,
      propertyId,
      competitors,
      dateRange,
    );

    // Store results in both RateShoppingResult and CompetitorPrice
    const summary = await storeFetchedRates(user.tenantId, propertyId, fetchedRates);

    // Log the sync
    await db.competitorSyncLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        competitorName: `batch-sync-${competitors.length}-competitors`,
        syncType: 'manual',
        status: summary.failed === 0 ? 'success' : 'partial',
        pricesCollected: summary.total,
        errorMessage: summary.failed > 0 ? `${summary.failed} rates failed` : null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Build per-competitor sync results
    const perCompetitorResults = competitors.map((c) => {
      const compRates = fetchedRates.filter(r => r.competitorId === c.id);
      const strategy = getFetchStrategy(c, connections);

      return {
        competitorName: c.name,
        channel: c.channel,
        ratesFetched: compRates.length,
        strategy,
        hasRealData: compRates.some(r => r.source === 'real'),
        hasDemoData: compRates.some(r => r.isDemo),
        status: compRates.length > 0 ? 'success' : 'no_data',
      };
    });

    return NextResponse.json({
      success: true,
      synced: summary.total,
      failed: summary.failed,
      realRates: summary.real,
      syntheticRates: summary.synthetic,
      importedRates: summary.imported,
      results: perCompetitorResults,
      strategies: summary.strategies,
      date: today.toISOString().split('T')[0],
      dateRange: {
        checkIn: startDate.toISOString().split('T')[0],
        checkOut: endDate.toISOString().split('T')[0],
      },
      allowDemoData: ALLOW_DEMO_DATA,
    });
  } catch (error) {
    console.error('Error syncing competitor prices:', error);
    return NextResponse.json({ error: 'Failed to sync competitor prices' }, { status: 500 });
  }
}

// GET /api/revenue/competitors/sync - Get sync history and status
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'revenue.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const competitorName = searchParams.get('competitorName');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (competitorName) where.competitorName = competitorName;

    const logs = await db.competitorSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    // Get latest sync per competitor
    const latestSyncs = await db.competitorSyncLog.findMany({
      where: { tenantId: user.tenantId, ...(propertyId ? { propertyId } : {}) },
      orderBy: { startedAt: 'desc' },
      distinct: ['competitorName'],
    });

    const lastSyncMap: Record<string, { lastSync: string; status: string; pricesCollected: number }> = {};
    for (const log of latestSyncs) {
      lastSyncMap[log.competitorName] = {
        lastSync: log.startedAt.toISOString(),
        status: log.status,
        pricesCollected: log.pricesCollected,
      };
    }

    return NextResponse.json({
      success: true,
      data: logs,
      lastSyncs: lastSyncMap,
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json({ error: 'Failed to fetch sync history' }, { status: 500 });
  }
}

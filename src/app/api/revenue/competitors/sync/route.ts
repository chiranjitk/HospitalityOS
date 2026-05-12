import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/revenue/competitors/sync - Trigger manual competitor price sync
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'revenue.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { propertyId, competitorNames } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Get all tracked competitors for this property
    const competitors = await db.competitorPrice.findMany({
      where: {
        tenantId: user.tenantId,
        propertyId,
      },
      select: {
        competitorName: true,
        competitorType: true,
        competitorUrl: true,
        roomTypeId: true,
        roomTypeName: true,
        rating: true,
      },
      distinct: ['competitorName'],
    });

    // If specific competitors requested, filter
    const targets = competitorNames && competitorNames.length > 0
      ? competitors.filter(c => competitorNames.includes(c.competitorName))
      : competitors;

    const today = new Date().toISOString().split('T')[0];
    const syncResults = [];

    for (const competitor of targets) {
      try {
        // Simulate competitor price collection
        // In production, this would call external APIs/scrapers
        const basePrice = 100 + Math.random() * 200; // Simulated base price
        const variation = (Math.random() - 0.5) * 40; // +/- 20% variation
        const collectedPrice = parseFloat((basePrice + variation).toFixed(2));

        // Upsert the competitor price for today
        await db.competitorPrice.upsert({
          where: {
            propertyId_competitorName_date: {
              propertyId,
              competitorName: competitor.competitorName,
              date: new Date(today),
            },
          },
          create: {
            tenantId: user.tenantId,
            propertyId,
            competitorName: competitor.competitorName,
            competitorType: competitor.competitorType,
            competitorUrl: competitor.competitorUrl,
            rating: competitor.rating,
            date: new Date(today),
            price: collectedPrice,
            currency: 'USD',
            roomTypeId: competitor.roomTypeId,
            roomTypeName: competitor.roomTypeName,
            source: 'auto',
          },
          update: {
            price: collectedPrice,
            source: 'auto',
          },
        });

        syncResults.push({
          competitorName: competitor.competitorName,
          price: collectedPrice,
          status: 'success',
        });

        // Log sync
        await db.competitorSyncLog.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            competitorName: competitor.competitorName,
            syncType: 'manual',
            status: 'success',
            pricesCollected: 1,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });
      } catch (err) {
        await db.competitorSyncLog.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            competitorName: competitor.competitorName,
            syncType: 'manual',
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            startedAt: new Date(),
          },
        });

        syncResults.push({
          competitorName: competitor.competitorName,
          status: 'failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncResults.filter(r => r.status === 'success').length,
      failed: syncResults.filter(r => r.status === 'failed').length,
      results: syncResults,
      date: today,
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

/**
 * WiFi Consent Logs Statistics API
 *
 * GET — Consent statistics: total consents, opt-in marketing rate, consent by type, daily trend
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

const TENANT_ID = 'tenant_01';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Date range for trend
    const since = startDate ? new Date(startDate) : new Date(Date.now() - days * 86400000);
    const until = endDate ? new Date(endDate) : new Date();

    const baseWhere = {
      tenantId: TENANT_ID,
      createdAt: { gte: since, lte: until },
    };

    // Fetch aggregate stats in parallel
    const [
      totalConsents,
      marketingOptIn,
      totalRecords,
      consentByType,
      dailyTrend,
    ] = await Promise.all([
      // Total consents in period
      db.wiFiConsentLog.count({ where: baseWhere }),
      // Marketing opt-in count
      db.wiFiConsentLog.count({ where: { ...baseWhere, optInMarketing: true } }),
      // Total ever (for consent rate)
      db.wiFiConsentLog.count({ where: { tenantId: TENANT_ID } }),
      // Consent by type
      db.wiFiConsentLog.groupBy({
        by: ['consentType'],
        where: baseWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Daily trend — raw data
      db.wiFiConsentLog.findMany({
        where: baseWhere,
        select: { createdAt: true, consentType: true, optInMarketing: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Active consents (non-expired)
    const activeConsents = await db.wiFiConsentLog.count({
      where: { tenantId: TENANT_ID, expiresAt: { gt: new Date() } },
    });

    // Build daily trend grouped by date
    const trendMap = new Map<string, { date: string; total: number; marketing: number; wifi_access: number; data_processing: number }>();
    for (const log of dailyTrend) {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, { date: dateKey, total: 0, marketing: 0, wifi_access: 0, data_processing: 0 });
      }
      const entry = trendMap.get(dateKey)!;
      entry.total++;
      if (log.optInMarketing) entry.marketing++;
      if (log.consentType in entry) {
        (entry as Record<string, unknown>)[log.consentType] = ((entry as Record<string, unknown>)[log.consentType] as number) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalConsents,
        marketingOptInRate: totalConsents > 0 ? Math.round((marketingOptIn / totalConsents) * 100) : 0,
        marketingOptInCount: marketingOptIn,
        activeConsents,
        totalRecords,
        consentByType: consentByType.map((c) => ({
          type: c.consentType,
          count: c._count.id,
        })),
        dailyTrend: Array.from(trendMap.values()),
      },
    });
  } catch (error) {
    console.error('Error fetching consent stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch consent statistics' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// ────────────────────────────────────────────────────────────────
// POST /api/cron/sla-metrics
//
// Cron-triggered endpoint for the SLA Metric Collector.
// Runs on a schedule (typically every 1 minute — the collector itself
// aligns data to each property's measurementInterval internally).
// Protected by CRON_SECRET header.
//
// Also supports GET for retrieving the last collected metrics summary
// per property.
// ────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// POST — Trigger SLA metric collection cycle
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Dynamic import to avoid startup issues
    const { collectSlaMetrics } = await import('@/lib/wifi/services/sla-metric-collector');
    const result = await collectSlaMetrics();

    return NextResponse.json({
      success: true,
      data: result,
      message: 'SLA metric collection cycle completed',
    });
  } catch (error) {
    console.error('[Cron:SlaMetrics] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'SLA metric collection failed' },
      { status: 500 }
    );
  }
}

// GET — Return summary of last collected metrics per property
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Dynamic import for db access (server-side only)
    const { db } = await import('@/lib/db');

    // Use DISTINCT ON to fetch the most recent metric per (tenantId, propertyId)
    const metrics = await db.$queryRawUnsafe<
      Array<{
        tenantId: string;
        propertyId: string;
        periodStart: Date;
        periodEnd: Date;
        actualUptime: number | null;
        avgSpeedDown: number | null;
        avgSpeedUp: number | null;
        avgLatency: number | null;
        totalSessions: number;
        totalBandwidth: number;
        breached: boolean;
        breachTypes: string | null;
        createdAt: Date;
        propertyName: string | null;
      }>
    >(
      `
      SELECT DISTINCT ON (m."tenantId", m."propertyId")
        m."tenantId",
        m."propertyId",
        m."periodStart",
        m."periodEnd",
        m."actualUptime",
        m."avgSpeedDown",
        m."avgSpeedUp",
        m."avgLatency",
        m."totalSessions",
        m."totalBandwidth",
        m."breached",
        m."breachTypes",
        m."createdAt",
        p.name AS "propertyName"
      FROM "WiFiSLAMetric" m
      LEFT JOIN "Property" p ON p.id = m."propertyId"
      ORDER BY m."tenantId", m."propertyId", m."periodStart" DESC
      `
    );

    return NextResponse.json({
      success: true,
      data: {
        totalProperties: metrics.length,
        breached: metrics.filter((m) => m.breached).length,
        metrics,
      },
    });
  } catch (error) {
    console.error('[Cron:SlaMetrics] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA metrics summary' },
      { status: 500 }
    );
  }
}

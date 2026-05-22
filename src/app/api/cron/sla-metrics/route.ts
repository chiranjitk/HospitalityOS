import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[sla-metrics] CRON_SECRET environment variable is required');
}

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// POST — Trigger SLA metric collection cycle
export async function POST(request: NextRequest) {
  // Verify cron secret is configured
  if (!CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Server configuration error: CRON_SECRET not set' },
      { status: 500 }
    );
  }
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
  if (!CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Server configuration error: CRON_SECRET not set' },
      { status: 500 }
    );
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Use Prisma's built-in findMany instead of $queryRawUnsafe
    // to avoid datasource URL re-validation issues in sandbox environments.
    // We fetch all metrics and deduplicate in JavaScript to simulate DISTINCT ON.
    const allMetrics = await db.wiFiSLAMetric.findMany({
      orderBy: { periodStart: 'desc' },
      select: {
        tenantId: true,
        propertyId: true,
        periodStart: true,
        periodEnd: true,
        actualUptime: true,
        avgSpeedDown: true,
        avgSpeedUp: true,
        avgLatency: true,
        totalSessions: true,
        totalBandwidth: true,
        breached: true,
        breachTypes: true,
        createdAt: true,
        slaConfig: {
          select: {
            property: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Deduplicate: keep only the most recent metric per (tenantId, propertyId)
    const seen = new Set<string>();
    const latestMetrics: typeof allMetrics = [];
    for (const m of allMetrics) {
      const key = `${m.tenantId}::${m.propertyId}`;
      if (!seen.has(key)) {
        seen.add(key);
        latestMetrics.push(m);
      }
    }

    const metrics = latestMetrics.map((m) => ({
      tenantId: m.tenantId,
      propertyId: m.propertyId,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      actualUptime: m.actualUptime,
      avgSpeedDown: m.avgSpeedDown,
      avgSpeedUp: m.avgSpeedUp,
      avgLatency: m.avgLatency,
      totalSessions: m.totalSessions,
      totalBandwidth: m.totalBandwidth,
      breached: m.breached,
      breachTypes: m.breachTypes,
      createdAt: m.createdAt,
      propertyName: m.slaConfig?.property?.name ?? null,
    }));

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

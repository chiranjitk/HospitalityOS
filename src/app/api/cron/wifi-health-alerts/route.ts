import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────────────────────
// POST /api/cron/wifi-health-alerts
//
// Cron-triggered endpoint for the WiFi Health Alert Generator.
// Runs after each NAS health check cycle (every 60 seconds).
// Protected by CRON_SECRET header.
//
// Responsibilities:
//   1. Reads last NAS health check results
//   2. Creates WiFiAlert records for offline / high-latency NAS devices
//   3. Auto-resolves alerts when conditions improve
//
// GET /api/cron/wifi-health-alerts
//
// Returns count of active alerts grouped by type.
// ────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[wifi-health-alerts] CRON_SECRET environment variable is required');
}

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// POST — Trigger health alert generation
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
    const { generateHealthAlerts } = await import('@/lib/wifi/services/wifi-health-alert-generator');
    const result = await generateHealthAlerts();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Health alert generation complete: ${result.created} created, ${result.resolved} resolved, ${result.skipped} skipped`,
    });
  } catch (error) {
    console.error('[Cron:WiFiHealthAlerts] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Health alert generation failed' },
      { status: 500 }
    );
  }
}

// GET — Return count of active alerts grouped by type and severity
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
    // Use Prisma's built-in methods instead of $queryRawUnsafe
    // to avoid datasource URL re-validation issues in sandbox environments.
    const [totalActive, activeAlerts] = await Promise.all([
      db.wiFiAlert.count({ where: { status: 'active' } }),
      db.wiFiAlert.findMany({
        where: { status: 'active' },
        select: { type: true, severity: true, id: true },
      }),
    ]);

    // Group by (type, severity) in JavaScript
    const grouped = new Map<string, number>();
    for (const alert of activeAlerts) {
      const key = `${alert.type}::${alert.severity}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    // Sort: critical first, then warning, then info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const byTypeAndSeverity = Array.from(grouped.entries())
      .map(([key, count]) => {
        const [type, severity] = key.split('::');
        return { type, severity, count };
      })
      .sort((a, b) => {
        const sDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        if (sDiff !== 0) return sDiff;
        return a.type.localeCompare(b.type);
      });

    return NextResponse.json({
      success: true,
      data: {
        totalActive,
        byTypeAndSeverity,
      },
    });
  } catch (error) {
    console.error('[Cron:WiFiHealthAlerts] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get active alert counts' },
      { status: 500 }
    );
  }
}

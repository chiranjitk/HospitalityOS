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

// GET — Return count of active alerts grouped by type
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
    const alerts = await db.$queryRawUnsafe<Array<{ type: string; severity: string; count: bigint }>>(
      `SELECT type, severity, COUNT(*)::bigint as count
       FROM "WiFiAlert"
       WHERE status = 'active'
       GROUP BY type, severity
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 0
           WHEN 'warning' THEN 1
           WHEN 'info' THEN 2
           ELSE 3
         END,
         type`
    );

    // Also get total active count
    const totalRows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM "WiFiAlert" WHERE status = 'active'`
    );

    return NextResponse.json({
      success: true,
      data: {
        totalActive: Number(totalRows[0]?.count ?? 0n),
        byTypeAndSeverity: alerts.map((a) => ({
          type: a.type,
          severity: a.severity,
          count: Number(a.count),
        })),
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

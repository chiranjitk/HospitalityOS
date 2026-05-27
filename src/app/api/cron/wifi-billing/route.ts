/**
 * Cron: WiFi Daily Billing
 *
 * POST /api/cron/wifi-billing — Run daily WiFi billing for all tenants
 *
 * Should be called by the external cron scheduler (e.g., cron-job.org).
 * Recommended schedule: Once per day (e.g., 02:00 UTC)
 *
 * Secured via CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyWiFiBilling } from '@/lib/wifi/services/wifi-billing-engine';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON/WiFiBilling] CRON_SECRET environment variable is required');
}

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: CRON_SECRET not set' },
        { status: 500 },
      );
    }

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { tenantId } = body;

    // Run billing for all tenants (or specific tenant if provided)
    const result = await runDailyWiFiBilling(tenantId);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      message: `WiFi billing completed: ${result.processed} processed, ${result.postedToFolio} posted, $${result.totalCharged.toFixed(2)} charged`,
    });
  } catch (error) {
    console.error('[CRON/WiFiBilling] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run WiFi billing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

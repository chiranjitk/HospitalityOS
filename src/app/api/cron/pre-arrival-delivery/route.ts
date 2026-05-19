/**
 * Cron Job #5: Pre-Arrival WiFi Delivery Scheduler
 *
 * POST /api/cron/pre-arrival-delivery
 *   Triggers the pre-arrival delivery scheduler. Scans all enabled properties
 *   for upcoming confirmed bookings within the delivery window, generates WiFi
 *   credentials, queues pending notifications, and marks bookings as sent.
 *
 *   Auth: x-cron-secret header matching CRON_SECRET env var.
 *
 * GET /api/cron/pre-arrival-delivery
 *   Returns the count of upcoming deliveries — bookings currently in the
 *   delivery window that have not yet been processed. Useful for monitoring
 *   and dashboards.
 *
 * Recommended schedule: Every 15-30 minutes (e.g., every 15 min)
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Cron Secret Configuration ──────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

/**
 * Verify the x-cron-secret header matches the configured secret.
 */
function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// ─── POST — Trigger Pre-Arrival Delivery ────────────────────────────

export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — invalid or missing x-cron-secret header' },
      { status: 401 },
    );
  }

  try {
    // Dynamic import to avoid loading the full scheduler module at startup
    const { processPreArrivalDelivery } = await import(
      '@/lib/wifi/services/pre-arrival-scheduler'
    );

    const result = await processPreArrivalDelivery();

    return NextResponse.json({
      success: true,
      message: `Pre-arrival delivery completed: ${result.processed} booking(s) processed, ${result.credentialsGenerated} credential(s) generated, ${result.notificationsQueued} notification(s) queued.`,
      data: result,
    });
  } catch (error) {
    console.error('[Cron:PreArrivalDelivery] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Pre-arrival delivery scheduler failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ─── GET — Count Upcoming Deliveries ────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — invalid or missing x-cron-secret header' },
      { status: 401 },
    );
  }

  try {
    // Dynamic import
    const { countUpcomingDeliveries } = await import(
      '@/lib/wifi/services/pre-arrival-scheduler'
    );

    const counts = await countUpcomingDeliveries();

    return NextResponse.json({
      success: true,
      message: `${counts.total} upcoming delivery(ies) in the queue.`,
      data: counts,
    });
  } catch (error) {
    console.error('[Cron:PreArrivalDelivery] Error fetching upcoming counts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch upcoming delivery counts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

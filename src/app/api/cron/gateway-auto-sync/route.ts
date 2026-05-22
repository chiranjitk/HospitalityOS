import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// POST /api/cron/gateway-auto-sync — Trigger gateway auto-sync
export async function POST(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIGURATION_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 }
    );
  }

  try {
    const { processGatewayAutoSync } = await import('@/lib/jobs/scheduler');
    const result = await processGatewayAutoSync();
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Cron] Gateway Auto-Sync failed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SYNC_ERROR', message: error.message || 'Gateway sync failed' } },
      { status: 500 }
    );
  }
}

// GET /api/cron/gateway-auto-sync — Dry-run / status check
export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIGURATION_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Gateway Auto-Sync cron endpoint is active',
    scheduler: 'runs every minute via in-process cron (Job 2)',
    trigger: 'POST with x-cron-secret header to trigger manual sync',
  });
}

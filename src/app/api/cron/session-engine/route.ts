import { NextRequest, NextResponse } from 'next/server';

// ────────────────────────────────────────────────────────────────
// POST /api/cron/session-engine
//
// Cron-triggered endpoint for the Session Engine.
// Runs every 60 seconds via node-cron scheduler.
// Can also be triggered manually (protected by CRON_SECRET header).
//
// Also supports GET for status checks.
//
// The Session Engine is the core of StaySuite's gateway accounting:
//   1. Reads per-IP byte counters from nftables
//   2. Updates radacct with interim data (byte counts, session time)
//   3. Enforces session timeout → disconnect
//   4. Enforces idle timeout → disconnect
//   5. Enforces data limits → disconnect
//   6. Cleans up stale sessions
// ────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET || 'staysuite-cron-secret-2024';

function verifyCronSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// POST — Trigger session engine cycle
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
    const { runSessionEngine } = await import('@/lib/wifi/services/session-engine');
    const result = await runSessionEngine();

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Session engine cycle completed',
    });
  } catch (error) {
    console.error('[Cron:SessionEngine] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Session engine failed' },
      { status: 500 }
    );
  }
}

// GET — Get session engine status
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { getSessionEngineStatus } = await import('@/lib/wifi/services/session-engine');
    const status = await getSessionEngineStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get session engine status' },
      { status: 500 }
    );
  }
}

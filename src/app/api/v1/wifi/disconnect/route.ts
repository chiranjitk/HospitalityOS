import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────────────────────
// POST /api/v1/wifi/disconnect
//
// Guest-facing disconnect endpoint (no auth required).
// Called from the captive portal when the user clicks "Disconnect & Logout".
//
// Sets acctstoptime on active radacct sessions for the given username,
// which removes the user from the v_active_sessions view → Active Users tab.
//
// The DeviceProfile is NOT deleted — it persists so that auto-auth can
// match this device by fingerprintHash on the next visit.
// ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body as { username?: string };

    if (!username) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_USERNAME', message: 'Username is required' } },
        { status: 400 }
      );
    }

    // Close all active radacct sessions for this user
    let closedCount = 0;
    try {
      const result = await db.$executeRawUnsafe(`
        UPDATE radacct
        SET acctstoptime = NOW(),
            acctterminatecause = 'User-Request',
            acctsessiontime = COALESCE(
              EXTRACT(EPOCH FROM (NOW() - acctstarttime))::bigint,
              acctsessiontime
            ),
            acctupdatetime = NOW()
        WHERE acctstoptime IS NULL
          AND username = $1
      `, username);

      // Verify rows were affected
      const check = await db.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) as cnt FROM radacct WHERE acctterminatecause = 'User-Request' AND username = $1 AND acctstoptime > NOW() - INTERVAL '5 seconds'`,
        username
      );
      closedCount = Number(check[0]?.cnt || 0);
    } catch (err) {
      console.error('[Guest Disconnect] radacct update error:', err);
    }

    // Also close any matching WiFiSession records
    try {
      await db.$executeRawUnsafe(`
        UPDATE "WiFiSession"
        SET status = 'completed', "endTime" = NOW(), "updatedAt" = NOW()
        WHERE status = 'active'
          AND username = $1
      `, username);
    } catch {
      // WiFiSession may not exist or have no matching rows — non-fatal
    }

    console.log(`[Guest Disconnect] User ${username} disconnected, ${closedCount} radacct session(s) closed`);

    return NextResponse.json({
      success: true,
      data: {
        disconnected: true,
        closedSessions: closedCount,
        message: 'Disconnected successfully',
      },
    });
  } catch (error) {
    console.error('[Guest Disconnect] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Disconnect failed' } },
      { status: 500 }
    );
  }
}

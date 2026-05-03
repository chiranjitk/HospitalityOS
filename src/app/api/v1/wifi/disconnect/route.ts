import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runLogoutScript } from '@/lib/network/script-runner';
import { removeUserCounter, deauthIP } from '@/lib/wifi/utils/nftables-counters';

// ────────────────────────────────────────────────────────────────
// POST /api/v1/wifi/disconnect
//
// Guest-facing disconnect endpoint (no auth required).
// Called from the captive portal when the user clicks "Disconnect & Logout".
//
// 1. Closes active radacct sessions (removes from Active Users tab)
// 2. Closes WiFiSession records
// 3. Calls staysuite_logout.sh to remove nft rules + TC classes
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

    // ── Get the client IP from the most recent active radacct session ──
    // This is needed by staysuite_logout.sh to remove the correct firewall rules.
    let clientIp = '';
    try {
      const session = await db.$queryRawUnsafe<Array<{ framedipaddress: string | null; acctsessionid: string }>[]>(
        `SELECT framedipaddress, acctsessionid
         FROM radacct
         WHERE acctstoptime IS NULL AND username = $1
         ORDER BY acctstarttime DESC
         LIMIT 1`,
        username,
      );
      if (session.length > 0) {
        clientIp = session[0].framedipaddress || '';
      }
    } catch {
      // Non-fatal
    }

    // ── Close all active radacct sessions for this user ──
    let closedCount = 0;
    try {
      await db.$executeRawUnsafe(`
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

    // ── Close any matching WiFiSession records ──
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

    // ── Remove per-IP byte counter rules (session engine tracking) ──
    if (clientIp && clientIp !== '0.0.0.0') {
      try {
        removeUserCounter(clientIp);
      } catch {
        // Non-fatal
      }
    }

    // ── Call staysuite_logout.sh to remove firewall + bandwidth rules ──
    // The logout script will:
    //   - Remove IP from nft loggedinusers set (blocks traffic)
    //   - Delete fwmark rules from prerouting (by comment tag)
    //   - Delete NAT masquerade/SNAT rules
    //   - Delete TC HTB classes + fw filters on ifb0/ifb1
    //   - Remove session state files
    // If clientIp is unknown, the script will still scan all chains for
    // orphaned rules matching the username tag pattern.
    if (clientIp && clientIp !== '0.0.0.0') {
      try {
        const result = runLogoutScript({ ip: clientIp });
        if (result.success) {
          console.log(`[Guest Disconnect] Firewall OK: ${username} ip=${clientIp} (${result.durationMs}ms)`);
        } else {
          console.error(
            `[Guest Disconnect] Firewall FAIL: ${username} ip=${clientIp} exit=${result.exitCode} stderr=${result.stderr || '(none)'} (${result.durationMs}ms)`
          );
        }
      } catch (err) {
        // Non-fatal — firewall cleanup failure should not block disconnect
        console.error('[Guest Disconnect] Exception calling logout script:', err);
      }

      // ── Deauth IP from nftables authenticated_users set ──
      // This immediately blocks internet access even if the logout script failed
      deauthIP(clientIp);
    } else {
      console.warn(`[Guest Disconnect] No client IP found for ${username} — skipping firewall cleanup`);
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

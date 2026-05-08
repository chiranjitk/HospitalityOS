export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { runLogoutScript } from '@/lib/network/script-runner';
import { removeUserCounter, deauthIP } from '@/lib/wifi/utils/nftables-counters';

// ────────────────────────────────────────────────────────────────
// POST /api/v1/wifi/disconnect
//
// Guest-facing disconnect endpoint (no auth required).
// Called from the captive portal when the user clicks "Disconnect & Logout".
// Also called from admin Active Users tab to force-disconnect a user.
//
// 1. Closes active radacct sessions (removes from Active Users tab)
// 2. Closes WiFiSession records
// 3. Calls staysuite_logout.sh to remove nft rules + TC classes
// 4. Deactivates DeviceProfile on admin disconnect (prevents auto-reconnect)
//
// Source parameter:
//   - 'admin' (or absent): Admin-initiated — DeviceProfile deactivated, auto-auth blocked
//   - 'portal': Guest self-logout — DeviceProfile kept active for future auto-auth
//
// IP Resolution Strategy (in order):
//   1. Request body `clientIp` field (frontend can pass it)
//   2. Request headers `x-forwarded-for` / `x-real-ip`
//   3. Active radacct record for the username
//   4. Active WiFiSession record for the username
//   5. nftables loggedinusers set (last resort — shell command)
// ────────────────────────────────────────────────────────────────

function getClientIpFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    ''
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, clientIp: bodyIp, source } = body as { username?: string; clientIp?: string; source?: string };

    if (!username) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_USERNAME', message: 'Username is required' } },
        { status: 400 }
      );
    }

    // ── Multi-strategy IP resolution ──
    let clientIp = '';
    let ipSource = 'none';

    // Strategy 1: From request body (frontend can pass it)
    if (bodyIp && bodyIp !== '0.0.0.0') {
      clientIp = bodyIp;
      ipSource = 'body';
    }

    // Strategy 2: From request headers (reverse proxy sets this)
    if (!clientIp) {
      const headerIp = getClientIpFromRequest(request);
      if (headerIp && headerIp !== '0.0.0.0' && headerIp !== '127.0.0.1') {
        clientIp = headerIp;
        ipSource = 'header';
      }
    }

    // Strategy 3: From active radacct session
    if (!clientIp) {
      try {
        const session = await db.$queryRawUnsafe<Array<{ framedipaddress: string | null }>[]>(
          `SELECT framedipaddress
           FROM radacct
           WHERE acctstoptime IS NULL AND username = $1
             AND framedipaddress IS NOT NULL
             AND framedipaddress != '' AND framedipaddress != '0.0.0.0'
           ORDER BY acctstarttime DESC
           LIMIT 1`,
          username,
        );
        if (session.length > 0 && session[0].framedipaddress) {
          clientIp = session[0].framedipaddress;
          ipSource = 'radacct';
        }
      } catch {
        // Non-fatal — DB may be unavailable
      }
    }

    // Strategy 4: From active WiFiSession
    if (!clientIp) {
      try {
        const wifiSession = await db.wiFiSession.findFirst({
          where: { username, status: 'active', ipAddress: { not: '' } },
          select: { ipAddress: true },
          orderBy: { startTime: 'desc' },
        });
        if (wifiSession?.ipAddress && wifiSession.ipAddress !== '0.0.0.0') {
          clientIp = wifiSession.ipAddress;
          ipSource = 'wifisession';
        }
      } catch {
        // Non-fatal
      }
    }

    // Strategy 5: From nftables loggedinusers set (last resort — shell command)
    if (!clientIp) {
      try {
        // Dynamic table name detection (same as session engine)
        const nftSets = execSync('nft list sets 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
        const mangleLine = nftSets.split('\n').find(l => l.includes('loggedinusers'));
        const tableName = mangleLine ? mangleLine.split(/\s+/)[1] : 'mangle';
        const nftOutput = execSync(
          `nft list elements ${tableName} loggedinusers 2>/dev/null`,
          { encoding: 'utf-8', timeout: 3000 }
        );
        // Parse IPs from nft output: { 192.168.100.35, 10.0.0.1, ... }
        const ipMatch = nftOutput.match(/\{([^}]+)\}/);
        if (ipMatch) {
          const ips = ipMatch[1].split(',').map((s: string) => s.trim());
          if (ips.length === 1) {
            // Only one IP in loggedinusers — must be this user
            clientIp = ips[0];
            ipSource = 'nftables (sole IP)';
          } else if (ips.length > 1) {
            console.warn(`[Guest Disconnect] nftables has ${ips.length} IPs in loggedinusers, can't determine which belongs to ${username}`);
          }
        }
      } catch {
        // nft not available or not running as root — non-fatal
      }
    }

    if (clientIp) {
      console.log(`[Guest Disconnect] Resolved IP for ${username}: ${clientIp} (source: ${ipSource})`);
    } else {
      console.warn(`[Guest Disconnect] No client IP found for ${username} after all strategies`);
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
        const counterOk = removeUserCounter(clientIp);
        console.log(`[Guest Disconnect] Counter cleanup ${counterOk ? 'OK' : 'FAILED'} for ${clientIp}`);
      } catch (err) {
        console.error('[Guest Disconnect] Counter cleanup exception:', err instanceof Error ? err.message : String(err));
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

    // NOTE: Admin disconnect does NOT deactivate DeviceProfile — auto-auth
    // is controlled solely by the portal panel toggle (CaptivePortal.autoAuthEnabled).
    // If autoAuthEnabled is ON, devices will auto-reauth regardless of admin disconnect.

    return NextResponse.json({
      success: true,
      data: {
        disconnected: true,
        closedSessions: closedCount,
        clientIp: clientIp || undefined,
        ipSource: clientIp ? ipSource : undefined,
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

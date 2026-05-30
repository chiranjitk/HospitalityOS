export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────────────────────
// GET /api/v1/wifi/session-check
//
// Guest-facing session detection endpoint (no auth required).
// Called from the captive portal on page load to detect an existing
// active session for the client IP.
//
// If an active session is found, the portal shows the post-login
// "Connected" page with a logout button, instead of the login form.
//
// IP Resolution:
//   1. Query param `clientIp` (frontend passes it from resolve-zone)
//   2. Request header `x-forwarded-for` / `x-real-ip`
//
// Lookup:
//   1. radacct table — active RADIUS accounting session (acctstoptime IS NULL)
//   2. WiFiSession table — active local session (status = 'active')
//
// Returns session data needed to populate the SuccessScreen:
//   username, method, bandwidth, sessionTimeout, etc.
// ────────────────────────────────────────────────────────────────

function getClientIpFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    ''
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paramIp = searchParams.get('clientIp') || '';
    const headerIp = getClientIpFromRequest(request);
    const clientIp = paramIp || headerIp;

    if (!clientIp || clientIp === '0.0.0.0' || clientIp === '127.0.0.1') {
      return NextResponse.json({ success: false, hasSession: false });
    }

    console.log(`[SessionCheck] Checking for active session, client IP: ${clientIp}`);

    // Strategy 1: Look up active radacct session by framedipaddress
    const radacctRows = await db.$queryRawUnsafe<Array<{
      username: string;
      framedipaddress: string;
      acctstarttime: Date;
      acctsessiontime: number | null;
      callingstationid: string | null;
    }>>(`
      SELECT r.username, r.framedipaddress, r.acctstarttime, r.acctsessiontime, r.callingstationid
      FROM radacct r
      WHERE r.acctstoptime IS NULL
        AND r.framedipaddress IS NOT NULL
        AND r.framedipaddress = $1::text
      ORDER BY r.acctstarttime DESC
      LIMIT 1
    `, clientIp.replace(/\/\d+$/, '')); // Strip CIDR if present

    if (radacctRows.length > 0) {
      const row = radacctRows[0];
      const username = row.username;

      // Get WiFiUser details for session info (plan, bandwidth, etc.)
      const userRows = await db.$queryRawUnsafe<Array<{
        status: string;
        "planId": string | null;
        "maxSessions": number | null;
        "validUntil": Date | null;
        "guestId": string | null;
        "tenantId": string | null;
        "propertyId": string | null;
        plan_name: string | null;
        plan_download: number | null;
        plan_upload: number | null;
        "sessionTimeoutSec": number | null;
        guest_first_name: string | null;
        guest_last_name: string | null;
      }>>(`
        SELECT u.status, u."planId", u."maxSessions", u."validUntil", u."guestId", u."tenantId", u."propertyId",
               wp.name AS plan_name,
               wp."downloadSpeed" AS plan_download,
               wp."uploadSpeed" AS plan_upload,
               wp."sessionTimeoutSec",
               g."firstName" AS guest_first_name,
               g."lastName" AS guest_last_name
        FROM "WiFiUser" u
        LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
        LEFT JOIN "Guest" g ON u."guestId" = g.id
        WHERE u.username = $1
        LIMIT 1
      `, username);

      const user = userRows[0];

      // Validate session: user must be active and not expired
      if (user && user.status === 'active') {
        const now = new Date();
        if (user.validUntil && new Date(user.validUntil) < now) {
          console.log(`[SessionCheck] User ${username} session expired (validUntil: ${user.validUntil})`);
          return NextResponse.json({ success: false, hasSession: false, reason: 'expired' });
        }

        // Calculate remaining session time
        const sessionTimeoutSec = user.sessionTimeoutSec || 0;
        const sessionTimeElapsed = (row.acctsessiontime || 0);
        const remainingSec = sessionTimeoutSec > 0 ? Math.max(0, sessionTimeoutSec - sessionTimeElapsed) : 0;
        const remainingMinutes = Math.ceil(remainingSec / 60);

        console.log(`[SessionCheck] ✅ Active session found for ${username} (IP: ${clientIp})`);

        return NextResponse.json({
          success: true,
          hasSession: true,
          session: {
            authenticated: true,
            username,
            method: 'auto_detect',
            sessionTimeout: sessionTimeoutSec > 0 ? remainingMinutes : 1440, // Default 24h
            remainingMinutes: sessionTimeoutSec > 0 ? remainingMinutes : undefined,
            bandwidthDown: Math.round((user.plan_download || 0) / 1000000) || 0,
            bandwidthUp: Math.round((user.plan_upload || 0) / 1000000) || 0,
            message: `Welcome back, ${[user.guest_first_name, user.guest_last_name].filter(Boolean).join(' ') || username}`,
            sessionId: username,
            guestId: user.guestId || undefined,
            tenantId: user.tenantId || undefined,
            propertyId: user.propertyId || undefined,
            mac: row.callingstationid || undefined,
            startTime: row.acctstarttime,
          },
        });
      }
    }

    // Strategy 2: Look up active WiFiSession by ipAddress
    const wifiSessionRows = await db.$queryRawUnsafe<Array<{
      username: string;
      "ipAddress": string;
      "startTime": Date;
      "planId": string | null;
      "guestId": string | null;
      "tenantId": string | null;
      "propertyId": string | null;
      "macAddress": string | null;
    }>>(`
      SELECT s.username, s."ipAddress", s."startTime", s."planId", s."guestId", s."tenantId", s."propertyId", s."macAddress"
      FROM "WiFiSession" s
      WHERE s.status = 'active'
        AND s."ipAddress" IS NOT NULL
        AND s."ipAddress" = $1::text
      ORDER BY s."startTime" DESC
      LIMIT 1
    `, clientIp.replace(/\/\d+$/, ''));

    if (wifiSessionRows.length > 0) {
      const row = wifiSessionRows[0];
      const username = row.username;

      // Get user plan details
      const userRows = await db.$queryRawUnsafe<Array<{
        status: string;
        "validUntil": Date | null;
        "guestId": string | null;
        plan_name: string | null;
        plan_download: number | null;
        plan_upload: number | null;
        "sessionTimeoutSec": number | null;
        guest_first_name: string | null;
        guest_last_name: string | null;
      }>>(`
        SELECT u.status, u."validUntil", u."guestId",
               wp.name AS plan_name,
               wp."downloadSpeed" AS plan_download,
               wp."uploadSpeed" AS plan_upload,
               wp."sessionTimeoutSec",
               g."firstName" AS guest_first_name,
               g."lastName" AS guest_last_name
        FROM "WiFiUser" u
        LEFT JOIN "WiFiPlan" wp ON u."planId" = wp.id
        LEFT JOIN "Guest" g ON u."guestId" = g.id
        WHERE u.username = $1
        LIMIT 1
      `, username);

      const user = userRows[0];

      if (user && user.status === 'active') {
        const now = new Date();
        if (user.validUntil && new Date(user.validUntil) < now) {
          return NextResponse.json({ success: false, hasSession: false, reason: 'expired' });
        }

        console.log(`[SessionCheck] ✅ Active WiFiSession found for ${username} (IP: ${clientIp})`);

        return NextResponse.json({
          success: true,
          hasSession: true,
          session: {
            authenticated: true,
            username,
            method: 'auto_detect',
            sessionTimeout: user.sessionTimeoutSec ? Math.ceil(user.sessionTimeoutSec / 60) : 1440,
            remainingMinutes: user.sessionTimeoutSec ? Math.ceil(user.sessionTimeoutSec / 60) : undefined,
            bandwidthDown: Math.round((user.plan_download || 0) / 1000000) || 0,
            bandwidthUp: Math.round((user.plan_upload || 0) / 1000000) || 0,
            message: `Welcome back, ${[user.guest_first_name, user.guest_last_name].filter(Boolean).join(' ') || username}`,
            sessionId: username,
            guestId: user.guestId || undefined,
            tenantId: row.tenantId || undefined,
            propertyId: row.propertyId || undefined,
            mac: row.macAddress || undefined,
            startTime: row.startTime,
          },
        });
      }
    }

    console.log(`[SessionCheck] No active session found for IP: ${clientIp}`);
    return NextResponse.json({ success: false, hasSession: false });
  } catch (error) {
    console.error('[SessionCheck] Error:', error);
    return NextResponse.json({ success: false, hasSession: false, error: 'Session check failed' });
  }
}

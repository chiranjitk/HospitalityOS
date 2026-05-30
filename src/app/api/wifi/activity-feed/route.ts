import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// ─── GET /api/wifi/activity-feed ─────────────────────────────────────────────
// Returns a unified activity feed of recent WiFi events.
// Combines data from RadAcct (sessions), RadPostAuth (auth failures),
// WiFiSession (session starts/ends), and NasHealthLog (bandwidth warnings).
// Maximum 50 events, ordered by most recent first.

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '50', 10));
    const since = searchParams.get('since'); // ISO timestamp for incremental fetch

    const tenantId = user.tenantId;
    const sinceDate = since ? new Date(since) : null;

    // Build parallel queries for different event sources
    const [sessionStarts, sessionEnds, authFailures, postAuthRejects, nasHealthEvents] = await Promise.all([
      // Recent session starts from WiFiSession
      db.wiFiSession.findMany({
        where: {
          tenantId,
          ...(sinceDate && { createdAt: { gte: sinceDate } }),
        },
        select: {
          id: true,
          username: true,
          macAddress: true,
          ipAddress: true,
          deviceName: true,
          startTime: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Recent session ends from WiFiSession
      db.wiFiSession.findMany({
        where: {
          tenantId,
          status: { in: ['ended', 'terminated'] },
          endTime: { not: null },
          ...(sinceDate && { updatedAt: { gte: sinceDate } }),
        },
        select: {
          id: true,
          username: true,
          macAddress: true,
          ipAddress: true,
          deviceName: true,
          startTime: true,
          endTime: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Recent auth failures from RadPostAuth
      db.$queryRawUnsafe<Array<{
        id: number;
        username: string;
        nasipaddress: string | null;
        callingstationid: string | null;
        authdate: Date;
        reply: string | null;
      }>>(`
        SELECT id, username, "nasIpAddress" as nasipaddress,
               "callingStationId" as callingstationid,
               authdate, reply
        FROM radpostauth
        WHERE reply = 'Reject'
          ${sinceDate ? `AND authdate >= $1::timestamptz` : ''}
        ORDER BY authdate DESC
        LIMIT ${Math.ceil(limit / 4)}
      `, ...(sinceDate ? [sinceDate] : [])),

      // Recent disconnects from radacct (acctstoptime set recently)
      db.$queryRawUnsafe<Array<{
        acctuniqueid: string;
        username: string | null;
        nasipaddress: string;
        callingstationid: string | null;
        acctstoptime: Date;
        acctsessiontime: number | bigint | null;
      }>>(`
        SELECT acctuniqueid, username, nasipaddress,
               callingstationid, acctstoptime, acctsessiontime
        FROM radacct
        WHERE acctstoptime IS NOT NULL
          ${sinceDate ? `AND acctstoptime >= $1::timestamptz` : ''}
        ORDER BY acctstoptime DESC
        LIMIT ${Math.ceil(limit / 4)}
      `, ...(sinceDate ? [sinceDate] : [])),

      // NAS health events from NasHealthLog (for bandwidth/status warnings)
      db.$queryRawUnsafe<Array<{
        id: string;
        nasIpAddress: string;
        isOnline: boolean;
        avgLatencyMs: number | null;
        createdAt: Date;
      }>>(`
        SELECT id, "nasIpAddress", "isOnline", "avgLatencyMs", "createdAt"
        FROM "NasHealthLog"
        WHERE "tenantId" = $1::uuid
          AND ("isOnline" = false OR "avgLatencyMs" > 150)
          ${sinceDate ? `AND "createdAt" >= $2::timestamptz` : ''}
        ORDER BY "createdAt" DESC
        LIMIT ${Math.ceil(limit / 8)}
      `, tenantId, ...(sinceDate ? [sinceDate] : [])),
    ]);

    // Normalize all events into a unified format
    const events: Array<{
      type: 'session_start' | 'session_end' | 'disconnect' | 'auth_failure' | 'bandwidth_warning' | 'nas_offline';
      timestamp: Date;
      username: string | null;
      macAddress: string | null;
      ipAddress: string | null;
      nasIpAddress: string | null;
      deviceName: string | null;
      details: string;
    }> = [];

    // Session starts
    for (const s of sessionStarts) {
      events.push({
        type: 'session_start',
        timestamp: s.createdAt,
        username: s.username,
        macAddress: s.macAddress,
        ipAddress: s.ipAddress,
        nasIpAddress: null,
        deviceName: s.deviceName,
        details: `Session started for ${s.username || s.macAddress}`,
      });
    }

    // Session ends from WiFiSession
    for (const s of sessionEnds) {
      events.push({
        type: 'session_end',
        timestamp: s.endTime || s.updatedAt,
        username: s.username,
        macAddress: s.macAddress,
        ipAddress: s.ipAddress,
        nasIpAddress: null,
        deviceName: s.deviceName,
        details: `Session ${s.status === 'terminated' ? 'terminated' : 'ended'} for ${s.username || s.macAddress}`,
      });
    }

    // Disconnects from radacct
    for (const r of postAuthRejects) {
      events.push({
        type: 'disconnect',
        timestamp: r.acctstoptime,
        username: r.username,
        macAddress: r.callingstationid,
        ipAddress: null,
        nasIpAddress: r.nasipaddress,
        deviceName: null,
        details: `User ${r.username || 'unknown'} disconnected from ${r.nasipaddress || 'unknown NAS'}`,
      });
    }

    // Auth failures
    for (const a of authFailures) {
      events.push({
        type: 'auth_failure',
        timestamp: a.authdate,
        username: a.username,
        macAddress: a.callingstationid,
        ipAddress: null,
        nasIpAddress: a.nasipaddress,
        deviceName: null,
        details: `Auth rejected for ${a.username || 'unknown'} from ${a.nasipaddress || 'unknown NAS'}`,
      });
    }

    // NAS health / bandwidth warnings
    for (const h of nasHealthEvents) {
      if (!h.isOnline) {
        events.push({
          type: 'nas_offline',
          timestamp: h.createdAt,
          username: null,
          macAddress: null,
          ipAddress: null,
          nasIpAddress: h.nasIpAddress,
          deviceName: null,
          details: `NAS ${h.nasIpAddress} went offline`,
        });
      } else {
        events.push({
          type: 'bandwidth_warning',
          timestamp: h.createdAt,
          username: null,
          macAddress: null,
          ipAddress: null,
          nasIpAddress: h.nasIpAddress,
          deviceName: null,
          details: `High latency on NAS ${h.nasIpAddress} (${h.avgLatencyMs}ms)`,
        });
      }
    }

    // Sort by timestamp descending, take top N
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const trimmed = events.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: trimmed,
      count: trimmed.length,
      totalAvailable: events.length,
    });
  } catch (error) {
    console.error('[Activity Feed API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity feed' } },
      { status: 500 }
    );
  }
}

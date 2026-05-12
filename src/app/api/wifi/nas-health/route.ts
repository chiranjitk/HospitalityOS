import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// ─── GET /api/wifi/nas-health ──────────────────────────────────────────────
// Reads NAS status from RadiusNAS + radacct + radpostauth + NasHealthLog
//
// ─── POST /api/wifi/nas-health ─────────────────────────────────────────────
// Triggers a live NAS health check (ICMP ping + UDP port probe).
// Requires wifi.manage permission.

// ─── GET: Read status ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;

  if (!hasPermission(context, 'wifi.manage') && !hasPermission(context, 'reports.view')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: requires wifi.manage or reports.view' },
      { status: 403 }
    );
  }

  try {
    const tenantId = context.tenantId;

    // Fetch NAS clients for this tenant
    const nasClients = await db.$queryRawUnsafe(`
      SELECT id, "tenantId", "propertyId", name, shortname, "ipAddress" as "nasIp",
             type, ports, secret, description, status,
             "coaEnabled", "coaPort", "authPort", "acctPort",
             "createdAt", "updatedAt",
             "lastSeenAt", "lastWentOnlineAt", "lastWentOfflineAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
      ORDER BY "createdAt" DESC
    `, tenantId) as any[];

    // Collect all NAS IPs for batch queries
    const nasIps = nasClients.map(n => n.nasIp).filter(Boolean);

    // ── 1. Active sessions from radacct (acctstoptime IS NULL) ──
    // This is the real data source — radacct is populated by auth flow + session engine
    let liveSessionMap: Record<string, number> = {};
    let totalSessionMap: Record<string, number> = {};
    if (nasIps.length > 0) {
      // Active sessions
      const activeSessions = await db.$queryRawUnsafe(`
        SELECT nasipaddress, COUNT(*)::int as cnt
        FROM radacct
        WHERE acctstoptime IS NULL
          AND nasipaddress = ANY($1::text[])
        GROUP BY nasipaddress
      `, nasIps) as any[];
      for (const row of activeSessions) {
        liveSessionMap[row.nasipaddress] = row.cnt;
      }

      // Total sessions (all-time)
      const totalSessions = await db.$queryRawUnsafe(`
        SELECT nasipaddress, COUNT(*)::int as cnt
        FROM radacct
        WHERE nasipaddress = ANY($1::text[])
        GROUP BY nasipaddress
      `, nasIps) as any[];
      for (const row of totalSessions) {
        totalSessionMap[row.nasipaddress] = row.cnt;
      }
    }

    // ── 2. Failed auths from radpostauth ──
    let failedAuthMap: Record<string, number> = {};
    if (nasIps.length > 0) {
      const failedAuths = await db.$queryRawUnsafe(`
        SELECT "nasIpAddress", COUNT(*)::int as cnt
        FROM radpostauth
        WHERE "nasIpAddress" = ANY($1::text[])
          AND reply = 'Reject'
        GROUP BY "nasIpAddress"
      `, nasIps) as any[];
      for (const row of failedAuths) {
        failedAuthMap[row.nasIpAddress] = row.cnt;
      }
    }

    // ── 3. Latest health probe from NasHealthLog ──
    let healthMap: Record<string, any> = {};
    if (nasIps.length > 0) {
      const healthLogs = await db.$queryRawUnsafe(`
        SELECT DISTINCT ON ("nasIpAddress")
               "nasIpAddress", "isOnline", "avgLatencyMs", "lastSeenAt"
        FROM "NasHealthLog"
        WHERE "nasIpAddress" = ANY($1::text[])
          AND "tenantId" = $2::uuid
        ORDER BY "nasIpAddress", "createdAt" DESC
      `, nasIps, tenantId) as any[];
      for (const row of healthLogs) {
        healthMap[row.nasIpAddress] = row;
      }
    }

    // ── 4. Calculate uptime ──
    // Uptime = time since NAS last went online (down→up transition).
    // If currently online and lastWentOnlineAt exists → uptime = now - lastWentOnlineAt
    // If currently offline → no uptime (null)
    // If no health check data yet → fallback to registration time only if online
    const nowMs = Date.now();

    // Build response
    const entries = nasClients.map(nas => {
      const ip = nas.nasIp;
      const live = liveSessionMap[ip] || 0;
      const total = totalSessionMap[ip] || 0;
      const failed = failedAuthMap[ip] || 0;
      const health = healthMap[ip];

      // Determine status from health check data
      let status: 'online' | 'offline' | 'degraded' | 'unknown' = 'offline';
      if (health) {
        if (health.isOnline) {
          status = (health.avgLatencyMs != null && health.avgLatencyMs > 200) ? 'degraded' : 'online';
        } else {
          status = 'offline';
        }
      } else if (nas.status === 'active') {
        // No health check data yet — use live sessions as a signal
        status = live > 0 ? 'online' : 'unknown';
      }

      // Uptime: seconds since last down→up transition
      // Only meaningful when currently online
      let uptimeSeconds: number | null = null;
      if (status === 'online' || status === 'degraded') {
        if (nas.lastWentOnlineAt) {
          uptimeSeconds = Math.floor((nowMs - new Date(nas.lastWentOnlineAt).getTime()) / 1000);
        } else {
          // No transition recorded yet but currently online — use registration time as fallback
          uptimeSeconds = nas.createdAt
            ? Math.floor((nowMs - new Date(nas.createdAt).getTime()) / 1000)
            : 0;
        }
      }

      return {
        id: nas.id,
        nasIp: ip,
        nasIdentifier: nas.shortname || nas.name,
        name: nas.name,
        type: nas.type,
        description: nas.description,
        status,
        liveUserCount: live,
        totalSessions: total,
        failedAuths: failed,
        latency: health?.avgLatencyMs ?? null,
        uptime: uptimeSeconds,
        lastSeenAt: health?.lastSeenAt || nas.lastSeenAt || nas.updatedAt || nas.createdAt,
        lastWentOfflineAt: nas.lastWentOfflineAt || null,
      };
    });

    // Stats
    const totalNas = entries.length;
    const onlineCount = entries.filter(e => e.status === 'online' || e.status === 'degraded').length;
    const offlineCount = entries.filter(e => e.status === 'offline').length;
    const unknownCount = entries.filter(e => e.status === 'unknown').length;
    const totalLiveUsers = entries.reduce((sum, e) => sum + e.liveUserCount, 0);
    const latencies = entries.filter(e => e.latency != null).map(e => e.latency);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
      : 0;

    const stats = { totalNas, onlineCount, offlineCount, unknownCount, totalLiveUsers, avgLatency };

    return NextResponse.json({ success: true, data: entries, stats });
  } catch (error: any) {
    console.error('Error fetching NAS health:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch NAS health data', details: error.message } },
      { status: 500 }
    );
  }
}

// ─── POST: Trigger live health check ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;

  if (!hasPermission(context, 'wifi.manage')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: requires wifi.manage' },
      { status: 403 }
    );
  }

  try {
    const { runNasHealthCheck } = await import('@/lib/wifi/services/nas-health-check');
    const result = await runNasHealthCheck();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Health check complete: ${result.online} online, ${result.offline} offline (${result.durationMs}ms)`,
    });
  } catch (error: any) {
    console.error('Error running NAS health check:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Health check failed', details: error.message } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// ─── GET /api/wifi/nas-health ──────────────────────────────────────────────
// Reads NAS status directly from RadiusNAS + LiveSession + RadiusAuthLog + NasHealthLog
// (no dependency on freeradius-service microservice)
export async function GET(request: NextRequest) {
  // Auth: require wifi.manage OR reports.view (view-only action, same as radius route)
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
             "createdAt", "updatedAt"
      FROM "RadiusNAS"
      WHERE "tenantId" = $1::uuid
      ORDER BY "createdAt" DESC
    `, tenantId) as any[];

    // Collect all NAS IPs for batch queries
    const nasIps = nasClients.map(n => n.nasIp).filter(Boolean);

    // Count live (active) sessions per NAS IP
    let liveSessionMap: Record<string, number> = {};
    if (nasIps.length > 0) {
      const liveSessions = await db.$queryRawUnsafe(`
        SELECT "nasIpAddress", COUNT(*)::int as cnt
        FROM "LiveSession"
        WHERE "nasIpAddress" IS NOT NULL
          AND "nasIpAddress" = ANY($1::text[])
          AND status = 'active'
        GROUP BY "nasIpAddress"
      `, nasIps) as any[];
      for (const row of liveSessions) {
        liveSessionMap[row.nasIpAddress] = row.cnt;
      }
    }

    // Count total auths and failed auths per NAS IP
    let authMap: Record<string, { totalAuths: number; failedAuths: number }> = {};
    if (nasIps.length > 0) {
      const authStats = await db.$queryRawUnsafe(`
        SELECT "nasIpAddress",
               COUNT(*)::int as "totalAuths",
               COUNT(*) FILTER (WHERE "authResult" = 'Reject')::int as "failedAuths"
        FROM "RadiusAuthLog"
        WHERE "nasIpAddress" IS NOT NULL
          AND "nasIpAddress" = ANY($1::text[])
        GROUP BY "nasIpAddress"
      `, nasIps) as any[];
      for (const row of authStats) {
        authMap[row.nasIpAddress] = { totalAuths: row.totalAuths, failedAuths: row.failedAuths };
      }
    }

    // Get latest health log per NAS (if any health checks have been recorded)
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

    // Build response
    const entries = nasClients.map(nas => {
      const ip = nas.nasIp;
      const live = liveSessionMap[ip] || 0;
      const auth = authMap[ip] || { totalAuths: 0, failedAuths: 0 };
      const health = healthMap[ip];

      // Determine status
      let status: 'online' | 'offline' | 'degraded' = 'offline';
      if (health) {
        if (health.isOnline) {
          status = (health.avgLatencyMs != null && health.avgLatencyMs > 200) ? 'degraded' : 'online';
        } else {
          status = 'offline';
        }
      } else if (nas.status === 'active') {
        // No health check data yet — use live sessions as a signal
        status = live > 0 ? 'online' : 'offline';
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
        totalSessions: auth.totalAuths,
        failedAuths: auth.failedAuths,
        latency: health?.avgLatencyMs || null,
        lastSeenAt: health?.lastSeenAt || nas.updatedAt || nas.createdAt,
      };
    });

    // Stats
    const totalNas = entries.length;
    const onlineCount = entries.filter(e => e.status === 'online').length;
    const offlineCount = entries.filter(e => e.status === 'offline').length;
    const totalLiveUsers = entries.reduce((sum, e) => sum + e.liveUserCount, 0);
    const latencies = entries.filter(e => e.latency != null).map(e => e.latency);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
      : 0;

    const stats = { totalNas, onlineCount, offlineCount, totalLiveUsers, avgLatency };

    return NextResponse.json({ success: true, data: entries, stats });
  } catch (error: any) {
    console.error('Error fetching NAS health:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch NAS health data', details: error.message } },
      { status: 500 }
    );
  }
}

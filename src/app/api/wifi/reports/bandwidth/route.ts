import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/bandwidth - Daily bandwidth usage
// Priority: radacct (live RADIUS accounting) → v_session_history (Prisma sessions) → empty
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date conditions with proper parameterized queries
    const params: string[] = [];
    const conditions: string[] = [];

    if (startDate) {
      const sd = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(sd);
      conditions.push(`acctstarttime >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      const ed = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(ed);
      conditions.push(`acctstarttime <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // ── Query 1: Try radacct (real RADIUS accounting) ──
    // Tenant isolation: radacct has no tenantId column, so JOIN WiFiUser to scope by tenant
    params.push(user.tenantId);
    const dailyQuery = `
      SELECT
        DATE(r.acctstarttime) AS date,
        COALESCE(SUM(r.acctoutputoctets), 0)::bigint AS download_bytes,
        COALESCE(SUM(r.acctinputoctets), 0)::bigint AS upload_bytes,
        COUNT(DISTINCT r.username) AS unique_users
      FROM radacct r
      JOIN "WiFiUser" wu ON r.username = wu.username
      WHERE wu."tenantId" = $${params.length}::uuid ${whereClause}
      GROUP BY DATE(r.acctstarttime)
      ORDER BY date ASC
    `;
    let dailyRows = await db.$queryRawUnsafe(dailyQuery, ...params) as Array<Record<string, unknown>>;

    // ── Fallback: If radacct is empty, use v_session_history (Prisma WiFiSession) ──
    let isFallback = false;
    if (!dailyRows || dailyRows.length === 0) {
      isFallback = true;
      const viewDateConditions: string[] = [];
      const viewParams: string[] = [];
      if (startDate) {
        const sd = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
        viewParams.push(sd);
        viewDateConditions.push(`acctstarttime >= $${viewParams.length}::timestamptz`);
      }
      if (endDate) {
        const ed = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
        viewParams.push(ed);
        viewDateConditions.push(`acctstarttime <= $${viewParams.length}::timestamptz`);
      }
      const viewWhere = viewDateConditions.length > 0 ? `AND ${viewDateConditions.join(' AND ')}` : '';

      // Tenant isolation: v_session_history exposes tenantId from WiFiSession/WiFiUser
      viewParams.push(user.tenantId);
      dailyRows = await db.$queryRawUnsafe(`
        SELECT
          DATE(acctstarttime) AS date,
          COALESCE(SUM(acctoutputoctets), 0)::bigint AS download_bytes,
          COALESCE(SUM(acctinputoctets), 0)::bigint AS upload_bytes,
          COUNT(DISTINCT username) AS unique_users
        FROM v_session_history
        WHERE "tenantId" = $${viewParams.length}::uuid ${viewWhere}
        GROUP BY DATE(acctstarttime)
        ORDER BY date ASC
      `, ...viewParams) as Array<Record<string, unknown>>;
    }

    // ── Active sessions count ──
    // Tenant isolation: v_active_sessions exposes tenantId
    const activeRows: Array<{ active_count: string }> = await db.$queryRawUnsafe(`
      SELECT COUNT(*)::text AS active_count FROM v_active_sessions WHERE "tenantId" = $1::uuid
    `, user.tenantId);
    const activeSessions = parseInt(activeRows[0]?.active_count || '0', 10);

    // ── Peak time from hour distribution ──
    let peakHour = '20:00';
    if (dailyRows && dailyRows.length > 0) {
      const peakSource = isFallback ? 'v_session_history' : 'radacct';
      // Tenant isolation: build peak query with tenant filter
      const peakParams: string[] = [];
      const peakConds: string[] = [];

      if (peakSource === 'radacct') {
        peakParams.push(user.tenantId);
        peakConds.push(`wu."tenantId" = $${peakParams.length}::uuid`);
      } else {
        peakParams.push(user.tenantId);
        peakConds.push(`"tenantId" = $${peakParams.length}::uuid`);
      }
      if (startDate) {
        const sd = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
        peakParams.push(sd);
        peakConds.push(`acctstarttime >= $${peakParams.length}::timestamptz`);
      }
      if (endDate) {
        const ed = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
        peakParams.push(ed);
        peakConds.push(`acctstarttime <= $${peakParams.length}::timestamptz`);
      }
      const peakWhere = peakConds.join(' AND ');

      let peakQuery: string;
      if (peakSource === 'radacct') {
        peakQuery = `
          SELECT
            EXTRACT(HOUR FROM r.acctstarttime)::text AS hour,
            COUNT(DISTINCT r.username)::text AS user_count
          FROM radacct r
          JOIN "WiFiUser" wu ON r.username = wu.username
          WHERE ${peakWhere}
          GROUP BY EXTRACT(HOUR FROM r.acctstarttime)
          ORDER BY COUNT(DISTINCT r.username) DESC
          LIMIT 1
        `;
      } else {
        peakQuery = `
          SELECT
            EXTRACT(HOUR FROM acctstarttime)::text AS hour,
            COUNT(DISTINCT username)::text AS user_count
          FROM v_session_history
          WHERE ${peakWhere}
          GROUP BY EXTRACT(HOUR FROM acctstarttime)
          ORDER BY COUNT(DISTINCT username) DESC
          LIMIT 1
        `;
      }
      const hourRows = await db.$queryRawUnsafe(peakQuery, ...peakParams) as Array<Record<string, unknown>>;
      if (hourRows && hourRows.length > 0) {
        peakHour = `${String(hourRows[0].hour).padStart(2, '0')}:00`;
      }
    }

    // ── Format response ──
    const data = (dailyRows || []).map((row) => {
      const dl = Number(row.download_bytes) || 0;
      const ul = Number(row.upload_bytes) || 0;
      return {
        date: String(row.date),
        download: Math.round((dl / (1024 * 1024)) * 100) / 100,
        upload: Math.round((ul / (1024 * 1024)) * 100) / 100,
        total: Math.round(((dl + ul) / (1024 * 1024)) * 100) / 100,
        users: Number(row.unique_users) || 0,
        peakUsers: Number(row.unique_users) || 0,
        peakTime: peakHour,
        activeSessions,
        source: isFallback ? 'session' : 'radius',
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching bandwidth report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth report' } },
      { status: 500 }
    );
  }
}

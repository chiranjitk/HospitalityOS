import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/bandwidth - Daily bandwidth usage
// Priority: radacct (live RADIUS accounting) → v_session_history (Prisma sessions) → empty
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
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
    const dailyQuery = `
      SELECT
        DATE(acctstarttime) AS date,
        COALESCE(SUM(acctoutputoctets), 0)::bigint AS download_bytes,
        COALESCE(SUM(acctinputoctets), 0)::bigint AS upload_bytes,
        COUNT(DISTINCT username) AS unique_users
      FROM radacct
      WHERE 1=1 ${whereClause}
      GROUP BY DATE(acctstarttime)
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

      dailyRows = await db.$queryRawUnsafe(`
        SELECT
          DATE(acctstarttime) AS date,
          COALESCE(SUM(acctoutputoctets), 0)::bigint AS download_bytes,
          COALESCE(SUM(acctinputoctets), 0)::bigint AS upload_bytes,
          COUNT(DISTINCT username) AS unique_users
        FROM v_session_history
        WHERE 1=1 ${viewWhere}
        GROUP BY DATE(acctstarttime)
        ORDER BY date ASC
      `, ...viewParams) as Array<Record<string, unknown>>;
    }

    // ── Active sessions count ──
    const activeRows: Array<{ active_count: string }> = await db.$queryRawUnsafe(`
      SELECT COUNT(*)::text AS active_count FROM v_active_sessions
    `);
    const activeSessions = parseInt(activeRows[0]?.active_count || '0', 10);

    // ── Peak time from hour distribution ──
    let peakHour = '20:00';
    if (dailyRows && dailyRows.length > 0) {
      const peakSource = isFallback ? 'v_session_history' : 'radacct';
      const peakParams = [...params];
      const peakQuery = `
        SELECT
          EXTRACT(HOUR FROM acctstarttime)::text AS hour,
          COUNT(DISTINCT username)::text AS user_count
        FROM ${peakSource}
        WHERE 1=1 ${whereClause}
        GROUP BY EXTRACT(HOUR FROM acctstarttime)
        ORDER BY COUNT(DISTINCT username) DESC
        LIMIT 1
      `;
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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/bandwidth - Daily bandwidth usage from radacct
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
      conditions.push(`r.acctstarttime >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      const ed = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(ed);
      conditions.push(`r.acctstarttime <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Query radacct for daily aggregation
    const dailyQuery = `
      SELECT
        DATE(r.acctstarttime) AS date,
        COALESCE(SUM(r.acctinputoctets), 0)::bigint AS download_bytes,
        COALESCE(SUM(r.acctoutputoctets), 0)::bigint AS upload_bytes,
        COUNT(DISTINCT r.username) AS unique_users
      FROM radacct r
      WHERE 1=1 ${whereClause}
      GROUP BY DATE(r.acctstarttime)
      ORDER BY date ASC
    `;

    const dailyRows = await db.$queryRawUnsafe(dailyQuery, ...params);

    // Count active sessions
    const activeRows: Array<{ active_count: string }> = await db.$queryRawUnsafe(`
      SELECT COUNT(*)::text AS active_count FROM radacct WHERE acctstoptime IS NULL
    `);
    const activeSessions = parseInt(activeRows[0]?.active_count || '0', 10);

    // Find peak time from hour distribution (reuse same params)
    const hourQuery = `
      SELECT
        EXTRACT(HOUR FROM r.acctstarttime)::text AS hour,
        COUNT(DISTINCT r.username)::text AS user_count
      FROM radacct r
      WHERE 1=1 ${whereClause}
      GROUP BY EXTRACT(HOUR FROM r.acctstarttime)
      ORDER BY COUNT(DISTINCT r.username) DESC
      LIMIT 1
    `;
    const hourRows = await db.$queryRawUnsafe(hourQuery, ...params);
    const peakHour = hourRows.length > 0
      ? `${String(hourRows[0].hour).padStart(2, '0')}:00`
      : '20:00';

    // Format response — all values converted safely
    const data = (dailyRows as Array<Record<string, unknown>>).map((row) => {
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

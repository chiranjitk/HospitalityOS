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

    // Build date conditions
    let dateCondition = '';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (startDate) {
      const sd = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      dateCondition += `AND r.acctstarttime >= $${paramIdx}::timestamptz `;
      params.push(sd);
      paramIdx++;
    }
    if (endDate) {
      const ed = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      dateCondition += `AND r.acctstarttime <= $${paramIdx}::timestamptz `;
      params.push(ed);
      paramIdx++;
    }

    // Query radacct for daily aggregation
    const dailyQuery = `
      SELECT
        DATE(r.acctstarttime) AS date,
        COALESCE(SUM(r.acctinputoctets), 0)::bigint AS download_bytes,
        COALESCE(SUM(r.acctoutputoctets), 0)::bigint AS upload_bytes,
        COUNT(DISTINCT r.username) AS unique_users
      FROM radacct r
      WHERE 1=1 ${dateCondition}
      GROUP BY DATE(r.acctstarttime)
      ORDER BY date ASC
    `;

    const dailyRows: Array<{
      date: string;
      download_bytes: bigint | number;
      upload_bytes: bigint | number;
      unique_users: number;
    }> = await db.$queryRawUnsafe(dailyQuery, ...params);

    // Count active sessions for current period
    const activeQuery = `
      SELECT COUNT(*)::int AS active_count
      FROM radacct
      WHERE acctstoptime IS NULL
    `;
    const activeRows: Array<{ active_count: number }> = await db.$queryRawUnsafe(activeQuery);
    const activeSessions = activeRows[0]?.active_count || 0;

    // Find peak users per day (max concurrent sessions)
    const peakQuery = `
      SELECT
        DATE(r.acctstarttime) AS date,
        MAX(sub.daily_peak) AS peak_users
      FROM (
        SELECT
          DATE(r.acctstarttime) AS date,
          COUNT(DISTINCT r.username) AS daily_peak
        FROM radacct r
        WHERE 1=1 ${dateCondition}
        GROUP BY DATE(r.acctstarttime)
      ) sub
      GROUP BY sub.date
      ORDER BY sub.date ASC
    `;
    const peakRows: Array<{ date: string; peak_users: number }> = await db.$queryRawUnsafe(peakQuery, ...params);

    // Build peak users map
    const peakMap = new Map<string, number>();
    for (const row of peakRows) {
      peakMap.set(row.date, row.peak_users);
    }

    // Find peak time from hour distribution
    const hourQuery = `
      SELECT
        EXTRACT(HOUR FROM r.acctstarttime)::int AS hour,
        COUNT(DISTINCT r.username) AS user_count
      FROM radacct r
      WHERE 1=1 ${dateCondition}
      GROUP BY EXTRACT(HOUR FROM r.acctstarttime)
      ORDER BY user_count DESC
      LIMIT 1
    `;
    const hourRows: Array<{ hour: number; user_count: number }> = await db.$queryRawUnsafe(hourQuery, ...params);
    const peakHour = hourRows.length > 0 ? `${String(hourRows[0].hour).padStart(2, '0')}:00` : '20:00';

    // Format response
    const data = dailyRows.map((row) => {
      const dl = Number(row.download_bytes);
      const ul = Number(row.upload_bytes);
      return {
        date: row.date,
        download: Math.round(dl / (1024 * 1024) * 100) / 100,   // bytes → MB
        upload: Math.round(ul / (1024 * 1024) * 100) / 100,
        total: Math.round((dl + ul) / (1024 * 1024) * 100) / 100,
        users: row.unique_users,
        peakUsers: peakMap.get(row.date) || row.unique_users,
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

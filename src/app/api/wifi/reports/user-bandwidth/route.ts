import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/user-bandwidth - Per-user bandwidth from radacct + WiFiUser + WiFiPlan
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Main query: aggregate per user from radacct, join WiFiUser + WiFiPlan
    // Cast all bigints to text in SQL to avoid BigInt serialization issues in JS
    const userQuery = `
      SELECT
        r.username::text AS username,
        MAX(r.framedipaddress)::text AS ip,
        MAX(r.callingstationid)::text AS mac,
        COALESCE(wu."planId", '00000000-0000-0000-0000-000000000000') AS "planId",
        COALESCE(wp.name, 'Unknown') AS plan,
        COALESCE(wp."downloadSpeed", 0) AS "downloadSpeed",
        COALESCE(wp."uploadSpeed", 0) AS "uploadSpeed",
        COALESCE(wp."dataLimit", 0) AS "dataLimit",
        COUNT(*)::text AS sessions,
        COALESCE(SUM(r.acctoutputoctets), 0)::text AS total_down,
        COALESCE(SUM(r.acctinputoctets), 0)::text AS total_up,
        COALESCE(SUM(r.acctsessiontime), 0)::text AS total_duration,
        MAX(r.acctstarttime)::text AS last_seen
      FROM radacct r
      LEFT JOIN "WiFiUser" wu ON wu.username = r.username
      LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
      WHERE 1=1
      ${search ? `AND (r.username ILIKE '%${search.replace(/'/g, "''")}%' OR r.framedipaddress ILIKE '%${search.replace(/'/g, "''")}%' OR r.callingstationid ILIKE '%${search.replace(/'/g, "''")}%')` : ''}
      GROUP BY r.username, wu."planId", wp.name, wp."downloadSpeed", wp."uploadSpeed", wp."dataLimit"
      ORDER BY SUM(r.acctoutputoctets) DESC NULLS LAST
      LIMIT ${limit}
    `;

    const userRows = await db.$queryRawUnsafe(userQuery);

    // For each user, fetch last 5 session history from radacct
    const usersWithHistory = [];
    for (const row of userRows as Array<Record<string, unknown>>) {
      const username = String(row.username || '');
      const sessionQuery = `
        SELECT
          r."acctuniqueid"::text AS id,
          r.acctstarttime::text AS start,
          r.acctstoptime::text AS "end",
          COALESCE(r.acctoutputoctets, 0)::text AS download,
          COALESCE(r.acctinputoctets, 0)::text AS upload,
          COALESCE(r.acctsessiontime, 0)::text AS duration,
          r.nasipaddress::text AS nas
        FROM radacct r
        WHERE r.username = '${username.replace(/'/g, "''")}'
        ORDER BY r.acctstarttime DESC
        LIMIT 5
      `;
      const sessions = await db.$queryRawUnsafe(sessionQuery);

      const dl = parseFloat(String(row.total_down)) || 0;
      const ul = parseFloat(String(row.total_up)) || 0;
      const dur = parseInt(String(row.total_duration), 10) || 0;
      const sessCount = parseInt(String(row.sessions), 10) || 0;

      usersWithHistory.push({
        username,
        ip: String(row.ip || 'unknown'),
        mac: String(row.mac || 'unknown'),
        plan: String(row.plan || 'Unknown'),
        downloadSpeed: Number(row.downloadSpeed) || 0,
        uploadSpeed: Number(row.uploadSpeed) || 0,
        dataLimit: row.dataLimit ? Number(row.dataLimit) : null,
        sessions: sessCount,
        totalDown: Math.round((dl / (1024 * 1024)) * 100) / 100,
        totalUp: Math.round((ul / (1024 * 1024)) * 100) / 100,
        avgDuration: sessCount > 0 ? Math.round(dur / sessCount) : 0,
        lastSeen: String(row.last_seen || ''),
        sessionHistory: (sessions as Array<Record<string, unknown>>).map((s) => ({
          id: String(s.id || ''),
          start: String(s.start || ''),
          end: s.end ? String(s.end) : null,
          download: Math.round((parseFloat(String(s.download)) / (1024 * 1024)) * 100) / 100,
          upload: Math.round((parseFloat(String(s.upload)) / (1024 * 1024)) * 100) / 100,
          duration: parseInt(String(s.duration), 10) || 0,
          nas: String(s.nas || ''),
        })),
      });
    }

    return NextResponse.json({ success: true, data: usersWithHistory });
  } catch (error) {
    console.error('Error fetching user bandwidth report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user bandwidth report' } },
      { status: 500 }
    );
  }
}

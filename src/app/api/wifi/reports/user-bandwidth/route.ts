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
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build search condition
    let searchCondition = '';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      searchCondition = `AND (r.username ILIKE $${paramIdx} OR r.framedipaddress ILIKE $${paramIdx} OR r.callingstationid ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Main query: aggregate per user from radacct, join WiFiUser + WiFiPlan
    const userQuery = `
      SELECT
        r.username,
        MAX(r.framedipaddress) AS ip,
        MAX(r.callingstationid) AS mac,
        COALESCE(wu."planId", '00000000-0000-0000-0000-000000000000') AS "planId",
        COALESCE(wp.name, 'Unknown') AS plan,
        COALESCE(wp."downloadSpeed", 0) AS "downloadSpeed",
        COALESCE(wp."uploadSpeed", 0) AS "uploadSpeed",
        COALESCE(wp."dataLimit", 0) AS "dataLimit",
        COUNT(*) AS sessions,
        COALESCE(SUM(r.acctinputoctets), 0)::bigint AS total_down,
        COALESCE(SUM(r.acctoutputoctets), 0)::bigint AS total_up,
        COALESCE(SUM(r.acctsessiontime), 0)::bigint AS total_duration,
        MAX(r.acctstarttime) AS last_seen
      FROM radacct r
      LEFT JOIN "WiFiUser" wu ON wu.username = r.username
      LEFT JOIN "WiFiPlan" wp ON wp.id = wu."planId"
      WHERE 1=1 ${searchCondition}
      GROUP BY r.username, wu."planId", wp.name, wp."downloadSpeed", wp."uploadSpeed", wp."dataLimit"
      ORDER BY total_down DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);
    paramIdx += 2;

    const userRows: Array<{
      username: string;
      ip: string | null;
      mac: string | null;
      planId: string;
      plan: string;
      downloadSpeed: number;
      uploadSpeed: number;
      dataLimit: number | null;
      sessions: number;
      total_down: bigint | number;
      total_up: bigint | number;
      total_duration: bigint | number;
      last_seen: Date;
    }> = await db.$queryRawUnsafe(userQuery, ...params);

    // For each user, fetch last 5 session history from radacct
    const usersWithHistory = [];
    for (const row of userRows) {
      const sessionQuery = `
        SELECT
          r."acctuniqueid" AS id,
          r.acctstarttime AS start,
          r.acctstoptime AS end,
          COALESCE(r.acctinputoctets, 0)::bigint AS download,
          COALESCE(r.acctoutputoctets, 0)::bigint AS upload,
          COALESCE(r.acctsessiontime, 0)::bigint AS duration,
          r.nasipaddress AS nas
        FROM radacct r
        WHERE r.username = $1
        ORDER BY r.acctstarttime DESC
        LIMIT 5
      `;
      const sessions: Array<{
        id: string;
        start: Date;
        end: Date | null;
        download: bigint | number;
        upload: bigint | number;
        duration: bigint | number;
        nas: string | null;
      }> = await db.$queryRawUnsafe(sessionQuery, row.username);

      const dl = Number(row.total_down);
      const ul = Number(row.total_up);
      const dur = Number(row.total_duration);

      usersWithHistory.push({
        username: row.username,
        ip: row.ip || 'unknown',
        mac: row.mac || 'unknown',
        plan: row.plan,
        downloadSpeed: row.downloadSpeed,
        uploadSpeed: row.uploadSpeed,
        dataLimit: row.dataLimit,
        sessions: row.sessions,
        totalDown: Math.round(dl / (1024 * 1024) * 100) / 100,  // bytes → MB
        totalUp: Math.round(ul / (1024 * 1024) * 100) / 100,
        avgDuration: row.sessions > 0 ? Math.round(dur / row.sessions) : 0,
        lastSeen: row.last_seen instanceof Date ? row.last_seen.toISOString() : String(row.last_seen),
        sessionHistory: sessions.map((s) => ({
          id: s.id,
          start: s.start instanceof Date ? s.start.toISOString() : String(s.start),
          end: s.end instanceof Date ? s.end.toISOString() : null,
          download: Math.round(Number(s.download) / (1024 * 1024) * 100) / 100,
          upload: Math.round(Number(s.upload) / (1024 * 1024) * 100) / 100,
          duration: Number(s.duration),
          nas: s.nas,
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

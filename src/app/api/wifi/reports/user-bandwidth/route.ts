import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/user-bandwidth - Per-user bandwidth
// Primary: v_user_usage (WiFiUser + WiFiSession) → v_session_history for IP/MAC/session detail
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // ── Step 1: Get per-user aggregated bandwidth from v_user_usage ──
    // This view uses WiFiUser.totalBytesIn/Out (synced from Prisma sessions)
    // which always has data, unlike radacct which is only populated by live NAS.
    // Tenant isolation: v_user_usage exposes tenantId from WiFiUser
    const viewParams: string[] = [];
    const viewConditions: string[] = [];

    // Always filter by tenant
    viewParams.push(user.tenantId);
    viewConditions.push(`u."tenantId" = $${viewParams.length}::uuid`);

    if (search) {
      viewParams.push(`%${search}%`);
      viewConditions.push(`(u.username ILIKE $${viewParams.length} OR u.guest_first_name ILIKE $${viewParams.length} OR u.guest_last_name ILIKE $${viewParams.length} OR u.room_number ILIKE $${viewParams.length})`);
    }
    const viewWhere = viewConditions.length > 0 ? `WHERE ${viewConditions.join(' AND ')}` : '';

    // Left-join v_session_history to get latest IP/MAC per user
    const userQuery = `
      SELECT
        u.username::text,
        u.status::text,
        u.guest_first_name::text AS first_name,
        u.guest_last_name::text AS last_name,
        u.room_number::text,
        u.room_name::text,
        u.property_name::text,
        u.plan_name::text AS plan,
        u.plan_download_speed AS "downloadSpeed",
        u.plan_upload_speed AS "uploadSpeed",
        u.plan_data_limit AS "dataLimit",
        u.total_download_bytes::bigint AS total_down,
        u.total_upload_bytes::bigint AS total_up,
        u.total_sessions AS sessions,
        u.active_sessions AS "activeSessions",
        u.total_session_time::bigint AS total_duration,
        u."lastSeenAt"::text AS last_seen,
        u."createdAt"::text AS created_at,
        s_latest."ipAddress"::text AS ip,
        s_latest.wifi_mac::text AS mac
      FROM v_user_usage u
      LEFT JOIN LATERAL (
        SELECT "ipAddress", wifi_mac
        FROM v_session_history sh
        WHERE sh.username = u.username
        ORDER BY sh.acctstarttime DESC
        LIMIT 1
      ) s_latest ON true
      ${viewWhere}
      ORDER BY u.total_download_bytes DESC NULLS LAST
      LIMIT ${limit}
    `;

    const userRows = await db.$queryRawUnsafe(userQuery, ...viewParams) as Array<Record<string, unknown>>;

    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // ── Step 2: For each user, fetch last 5 sessions from v_session_history ──
    const usersWithHistory = [];
    for (const row of userRows) {
      const username = String(row.username || '');

      // Tenant isolation: v_session_history exposes tenantId
      const sessions = await db.$queryRawUnsafe(`
        SELECT
          session_id::text AS id,
          acctstarttime::text AS start,
          acctstoptime::text AS "end",
          COALESCE(acctoutputoctets, 0)::bigint AS download,
          COALESCE(acctinputoctets, 0)::bigint AS upload,
          COALESCE(acctsessiontime, 0)::bigint AS duration,
          nasipaddress::text AS nas,
          session_status::text AS status
        FROM v_session_history
        WHERE "tenantId" = $2::uuid AND username = $1
        ORDER BY acctstarttime DESC
        LIMIT 5
      `, username, user.tenantId) as Array<Record<string, unknown>>;

      const dl = Number(row.total_down) || 0;
      const ul = Number(row.total_up) || 0;
      const dur = Number(row.total_duration) || 0;
      const sessCount = Number(row.sessions) || 0;

      usersWithHistory.push({
        username,
        ip: String(row.ip || 'unknown'),
        mac: String(row.mac || 'unknown'),
        firstName: String(row.first_name || ''),
        lastName: String(row.last_name || ''),
        room: String(row.room_number || ''),
        roomName: String(row.room_name || ''),
        property: String(row.property_name || ''),
        plan: String(row.plan || 'Unknown'),
        downloadSpeed: Number(row.downloadSpeed) || 0,
        uploadSpeed: Number(row.uploadSpeed) || 0,
        dataLimit: row.dataLimit ? Number(row.dataLimit) : null,
        status: String(row.status || 'unknown'),
        sessions: sessCount,
        activeSessions: Number(row.activeSessions) || 0,
        totalDown: Math.round((dl / (1024 * 1024)) * 100) / 100,
        totalUp: Math.round((ul / (1024 * 1024)) * 100) / 100,
        totalData: Math.round(((dl + ul) / (1024 * 1024)) * 100) / 100,
        avgDuration: sessCount > 0 ? Math.round(dur / sessCount) : 0,
        lastSeen: String(row.last_seen || ''),
        sessionHistory: (sessions || []).map((s) => ({
          id: String(s.id || ''),
          start: String(s.start || ''),
          end: s.end ? String(s.end) : null,
          download: Math.round((Number(s.download) / (1024 * 1024)) * 100) / 100,
          upload: Math.round((Number(s.upload) / (1024 * 1024)) * 100) / 100,
          duration: Number(s.duration) || 0,
          nas: String(s.nas || ''),
          status: String(s.status || 'completed'),
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

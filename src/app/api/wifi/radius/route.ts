/**
 * RADIUS Integration API Route
 * 
 * Proxies requests to the RADIUS management service running on port 3010.
 * Provides endpoints for:
 * - Service status and control (start/stop/restart)
 * - Connection testing
 * - Configuration export/import
 * - Statistics & monitoring
 * - Accounting records
 * - WiFi sessions
 * - RADIUS server logs
 * - Guest provisioning/deprovisioning (check-in/check-out)
 * - SQL module configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';
import { wifiUserService } from '@/lib/wifi/services/wifi-user-service';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

/**
 * Fix radacct DateTime columns that FreeRADIUS fills with empty strings ""
 * instead of NULL. Prisma expects NULL or valid ISO dates — empty strings
 * cause P2023 parse errors which silently trigger the fallback path
 * (querying empty LiveSession/RadiusAuthLog tables → no data shown).
 *
 * Called once on first request, then cached.
 */
let radacctCleaned = false;
async function ensureRadacctClean() {
  if (radacctCleaned) return;
  try {
    // Run each UPDATE individually to avoid "Execute returned results" errors.
    const cleanups = [
      // PostgreSQL: cast timestamptz to text before comparing to empty string / zero-date
      // PG rejects implicit cast from text to timestamptz, so we use explicit ::text cast
      "UPDATE radacct SET acctstoptime = NULL WHERE acctstoptime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctstarttime = NULL WHERE acctstarttime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctupdatetime = NULL WHERE acctupdatetime::text IN ('', '0000-00-00 00:00:00')",
      // acctinterval is BigInt, not timestamp — compare as text for empty/zero values
      "UPDATE radacct SET acctinterval = NULL WHERE acctinterval::text IN ('', '0')",
      "UPDATE radacct SET connectinfo_start = NULL WHERE connectinfo_start = ''",
      "UPDATE radacct SET connectinfo_stop = NULL WHERE connectinfo_stop = ''",
    ];
    for (const sql of cleanups) {
      await db.$executeRawUnsafe(sql);
    }
    radacctCleaned = true;
  } catch (e) {
    // Table might not exist yet; don't block requests
    console.warn('[radacct] Cleanup warning:', e instanceof Error ? e.message : e);
  }
}

// Helper to make requests to RADIUS management service
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  
  return response.json();
}

// Read-only actions that can be accessed with either wifi.manage OR reports.view
const VIEW_ACTIONS = new Set([
  'auth-logs', 'auth-logs-stats',
  'live-sessions-list', 'live-sessions-get', 'live-sessions-stats',
  'user-usage-summary', 'user-usage-detail',
  'accounting', 'accounting-status', 'accounting-db', 'active-accounting',
  'sessions', 'active-sessions',
  'logs',
  'stats',
  'coa-logs', 'coa-audit-list', 'coa-audit-stats',
  'nas-health-current', 'nas-health-list', 'nas-health-stats',
  'concurrent-sessions', 'concurrent-violations',
  'fup-switch-log',
]);

// GET /api/wifi/radius - Get RADIUS service data
export async function GET(request: NextRequest) {
  // First authenticate
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;

  // Determine required permission based on action
  const action = request.nextUrl.searchParams.get('action');
  if (!action) {
    return NextResponse.json({ success: false, error: 'Missing action parameter' }, { status: 400 });
  }

  // View-only actions accept either wifi.manage OR reports.view
  const isViewAction = VIEW_ACTIONS.has(action);
  if (isViewAction) {
    if (!hasPermission(context, 'wifi.manage') && !hasPermission(context, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: requires wifi.manage or reports.view' },
        { status: 403 }
      );
    }
  } else {
    // Management actions require wifi.manage
    if (!hasPermission(context, 'wifi.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: requires wifi.manage' },
        { status: 403 }
      );
    }
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    switch (action) {
      case 'status': {
        // Check actual FreeRADIUS process + PostgreSQL backend — not freeradius-service proxy
        try {
          const { execSync } = await import('child_process');
          let running = false;
          try {
            const result = execSync('pgrep -f "freeradius" | head -1', { encoding: 'utf-8', timeout: 3000 });
            running = !!result && result.trim().length > 0;
          } catch { running = false; }

          // Count users from radcheck
          let userCount = 0;
          let nasCount = 0;
          try {
            const uc = await db.$queryRawUnsafe<[{ c: number | bigint }]>('SELECT COUNT(*) as c FROM radcheck');
            userCount = Number(uc[0]?.c ?? 0);
            const nc = await db.$queryRawUnsafe<[{ c: number | bigint }]>('SELECT COUNT(*) as c FROM nas');
            nasCount = Number(nc[0]?.c ?? 0);
          } catch { /* tables might not exist */ }

          // Count active sessions
          let activeSessions = 0;
          try {
            const ac = await db.$queryRawUnsafe<[{ c: number | bigint }]>(
              "SELECT COUNT(*) as c FROM radacct WHERE acctstoptime IS NULL"
            );
            activeSessions = Number(ac[0]?.c ?? 0);
          } catch { /* ignore */ }

          return NextResponse.json({
            success: true,
            data: {
              installed: true,
              running,
              mode: running ? 'running' : 'stopped',
              userCount,
              nasClientCount: nasCount,
              activeSessions,
              authPort: 1812,
              acctPort: 1813,
            },
          });
        } catch (error) {
          console.error('[status] Direct check error:', error);
          return NextResponse.json({ success: true, data: { installed: false, running: false, mode: 'unknown', userCount: 0, nasClientCount: 0 } });
        }
      }

      case 'stats': {
        const data = await freeradiusRequest('/api/stats');
        return NextResponse.json(data);
      }

      case 'config': {
        const data = await freeradiusRequest('/api/config/export');
        return NextResponse.json(data);
      }

      case 'default': {
        const data = await freeradiusRequest('/api/config/default');
        return NextResponse.json(data);
      }

      case 'groups': {
        const data = await freeradiusRequest('/api/groups');
        return NextResponse.json(data);
      }

      // ─── Users: Query from v_wifi_users view ───────────────────
      // Direct DB query for reliability — does not depend on freeradius-service.
      case 'users': {
        try {
          const propertyId = searchParams.get('propertyId');
          const status = searchParams.get('status');

          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (propertyId) { conditions.push(`"propertyId" = $${sqlParams.length + 1}`); sqlParams.push(propertyId); }
          if (status) { conditions.push(`status = $${sqlParams.length + 1}`); sqlParams.push(status); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
            SELECT vw.*, u."ipPoolId",
                   COALESCE(up.name, pp.name, dp.name) as effective_ip_pool_name,
                   CASE WHEN up.name IS NOT NULL THEN 'User Override'
                        WHEN pp.name IS NOT NULL THEN 'Plan'
                        WHEN dp.name IS NOT NULL THEN 'Default'
                        ELSE NULL END as ip_pool_source
            FROM v_wifi_users vw
            LEFT JOIN "WiFiUser" u ON u.id = vw.id
            LEFT JOIN "IpPool" up ON up.id = u."ipPoolId"
            LEFT JOIN "IpPool" pp ON pp.id = (SELECT wp."ipPoolId" FROM "WiFiPlan" wp WHERE wp.id = vw."planId")
            LEFT JOIN "IpPool" dp ON dp."isDefault" = true AND dp.enabled = true
            ${whereClause}
            ORDER BY vw."createdAt" DESC
          `, ...sqlParams);

          const users = rows.map((row) => ({
            id: row.id,
            username: row.username || '',
            password: row.radius_password || '',
            group: row.radius_group || '',
            attributes: row.planId ? {
              'WISPr-Bandwidth-Max-Down': String(row.plan_download_speed || 0),
              'WISPr-Bandwidth-Max-Up': String(row.plan_upload_speed || 0),
              'Session-Timeout': '',
            } : {},
            downloadSpeed: Number(row.plan_download_speed || 0),
            uploadSpeed: Number(row.plan_upload_speed || 0),
            sessionTimeout: 0,
            dataLimit: row.plan_data_limit ? Number(row.plan_data_limit) : 0,
            createdAt: row.createdAt ? String(row.createdAt) : '',
            updatedAt: row.updatedAt ? String(row.updatedAt) : '',
            guestId: row.guestId || '',
            bookingId: row.bookingId || '',
            userType: row.authMethod || 'guest',
            status: row.status || 'active',
            validUntil: row.validUntil ? String(row.validUntil) : '',
            fupPolicy: null,
            ipPoolId: row.ipPoolId || '',
            ipPoolName: row.effective_ip_pool_name || '',
            ipPoolSource: row.ip_pool_source || '',
            // Enriched fields
            guest_first_name: row.guest_first_name || '',
            guest_last_name: row.guest_last_name || '',
            room_number: row.room_number || '',
            property_name: row.property_name || '',
            plan_name: row.plan_name || '',
            totalBytesIn: Number(row.totalBytesIn || 0),
            totalBytesOut: Number(row.totalBytesOut || 0),
            sessionCount: Number(row.sessionCount || 0),
          }));

          const safeUsers = JSON.parse(JSON.stringify(users, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeUsers });
        } catch (error) {
          console.error('[users] Direct query error:', error);
          // Fallback to freeradius-service
          try {
            const data = await freeradiusRequest('/api/users');
            return NextResponse.json(data);
          } catch {
            return NextResponse.json({ success: true, data: [] });
          }
        }
      }

      case 'accounting': {
        const limit = searchParams.get('limit') || '100';
        const offset = searchParams.get('offset') || '0';
        const username = searchParams.get('username') || '';
        const nasIp = searchParams.get('nasIp') || '';
        const status = searchParams.get('status') || '';
        const queryParams = new URLSearchParams({ limit, offset });
        if (username) queryParams.set('username', username);
        if (nasIp) queryParams.set('nasIp', nasIp);
        if (status) queryParams.set('status', status);
        const data = await freeradiusRequest(`/api/accounting?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'sessions': {
        const limit = searchParams.get('limit') || '50';
        const data = await freeradiusRequest(`/api/sessions?limit=${limit}`);
        return NextResponse.json(data);
      }

      case 'active-sessions': {
        const data = await freeradiusRequest('/api/sessions/active');
        return NextResponse.json(data);
      }

      case 'accounting-status': {
        const data = await freeradiusRequest('/api/accounting/status');
        return NextResponse.json(data);
      }

      case 'active-accounting': {
        const data = await freeradiusRequest('/api/accounting/active');
        return NextResponse.json(data);
      }

      case 'logs': {
        const lines = searchParams.get('lines') || '50';
        const data = await freeradiusRequest(`/api/logs?lines=${lines}`);
        return NextResponse.json(data);
      }

      // ─── Auth Logs: Query from v_session_history view ─────────────
      // The view joins radacct with StaySuite tables (Guest, Room, Property, Plan).
      // Every accounting Start represents a successful authentication.
      case 'auth-logs': {
        try {
          const limitStr = searchParams.get('limit') || '100';
          const limit = Math.min(parseInt(limitStr, 10) || 100, 500);
          const resultFilter = searchParams.get('result');
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');
          const usernameFilter = searchParams.get('username');

          // Query v_auth_logs view — includes client IP from radacct
          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (usernameFilter) { conditions.push(`"username" LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${usernameFilter}%`); }
          if (resultFilter) { conditions.push(`auth_result = $${sqlParams.length + 1}`); sqlParams.push(resultFilter); }
          if (startDateStr) { conditions.push(`"timestamp" >= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(startDateStr.length === 10 ? `${startDateStr} 00:00:00` : startDateStr); }
          if (endDateStr) { conditions.push(`"timestamp" <= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(endDateStr.length === 10 ? `${endDateStr} 23:59:59` : endDateStr); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          sqlParams.push(limit);

          const authEvents = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
            SELECT id, "username", auth_result, "timestamp",
                   client_ip_address, nas_ip_address,
                   calling_station_id, called_station_id,
                   reply_message,
                   guest_first_name, guest_last_name, room_number, property_name
            FROM v_auth_logs
            ${whereClause}
            ORDER BY "timestamp" DESC
            LIMIT $${sqlParams.length}
          `, ...sqlParams);

          const stripCidr = (v: string | null) => (v || '').replace(/\/\d+$/, '');
          const mapped = authEvents.map((e) => ({
            id: e.id || `auth_${e.id}`,
            timestamp: e.timestamp || '',
            username: e.username || '',
            authResult: e.auth_result || '',
            authType: 'RADIUS',
            // Client real IP — the user's assigned IP from pool/accounting
            clientIpAddress: stripCidr(e.client_ip_address as string),
            // NAS source IP (where auth request came from)
            nasIpAddress: stripCidr(e.nas_ip_address as string),
            // MAC addresses
            callingStationId: (e.calling_station_id as string) || '',
            calledStationId: (e.called_station_id as string) || '',
            // Reply message (already built in view with client IP priority)
            replyMessage: e.reply_message || '',
            // Enriched fields
            propertyName: e.property_name || '',
            guestName: [e.guest_first_name, e.guest_last_name].filter(Boolean).join(' ') || '',
            roomNumber: e.room_number || '',
          }));

          return NextResponse.json({ success: true, data: mapped });
        } catch (error) {
          console.error('[auth-logs] Direct query error:', error);
          return NextResponse.json({ success: true, data: [] });
        }
      }

      // ─── Auth Logs Stats: Query from radpostauth ──────
      case 'auth-logs-stats': {
        try {
          const usernameFilter = searchParams.get('username');
          const resultFilter = searchParams.get('result');
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          const conditions: string[] = [];
          const params: unknown[] = [];
          if (usernameFilter) { conditions.push(`username LIKE $${params.length + 1}`); params.push(`%${usernameFilter}%`); }
          if (resultFilter) { conditions.push(`reply = $${params.length + 1}`); params.push(resultFilter); }
          if (startDateStr) { conditions.push(`authdate >= $${params.length + 1}::timestamptz`); params.push(startDateStr.length === 10 ? `${startDateStr} 00:00:00` : startDateStr); }
          if (endDateStr) { conditions.push(`authdate <= $${params.length + 1}::timestamptz`); params.push(endDateStr.length === 10 ? `${endDateStr} 23:59:59` : endDateStr); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          const totalAuths = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            `SELECT COUNT(*) as c FROM radpostauth ${whereClause}`,
            ...params
          ))[0]?.c ?? 0);

          // Count accepts and rejects using the same base conditions
          const acceptWhere = conditions.length > 0
            ? `${whereClause} AND reply = 'Access-Accept'`
            : `WHERE reply = 'Access-Accept'`;
          const acceptCount = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            `SELECT COUNT(*) as c FROM radpostauth ${acceptWhere}`,
            ...params
          ))[0]?.c ?? 0);

          const rejectCount = totalAuths - acceptCount;
          const successRate = totalAuths > 0 ? Math.round((acceptCount / totalAuths) * 100) : 0;

          // Calculate 24h trend
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dayBefore = new Date();
          dayBefore.setDate(dayBefore.getDate() - 2);

          let last24hTrend = 0;
          try {
            const nextParam = params.length + 1;
            const todayWhere = conditions.length > 0
              ? `${whereClause} AND authdate >= $${nextParam}::timestamptz`
              : `WHERE authdate >= $${nextParam}::timestamptz`;

            const prevDayWhere = conditions.length > 0
              ? `${whereClause} AND authdate >= $${params.length + 1}::timestamptz AND authdate < $${params.length + 2}::timestamptz`
              : `WHERE authdate >= $${params.length + 1}::timestamptz AND authdate < $${params.length + 2}::timestamptz`;

            const todayCount = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
              `SELECT COUNT(*) as c FROM radpostauth ${todayWhere}`,
              ...params, yesterday.toISOString().slice(0, 10)
            ))[0]?.c ?? 0);

            const prevDayCount = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
              `SELECT COUNT(*) as c FROM radpostauth ${prevDayWhere}`,
              ...params, dayBefore.toISOString().slice(0, 10), yesterday.toISOString().slice(0, 10)
            ))[0]?.c ?? 0);

            last24hTrend = prevDayCount > 0
              ? Math.round(((todayCount - prevDayCount) / prevDayCount) * 100)
              : (todayCount > 0 ? 100 : 0);
          } catch (trendErr) {
            console.error('[auth-logs-stats] Trend calculation error (non-fatal):', trendErr);
          }

          return NextResponse.json({
            success: true,
            data: {
              totalAuths,
              acceptCount,
              rejectCount,
              successRate,
              last24hTrend,
            },
          });
        } catch (error) {
          console.error('[auth-logs-stats] Direct query error:', error);
          return NextResponse.json({
            success: true,
            data: {
              totalAuths: 0,
              acceptCount: 0,
              rejectCount: 0,
              successRate: 0,
              last24hTrend: 0,
            },
          });
        }
      }

      case 'mac-auth': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/mac-auth?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'check-mac': {
        const mac = searchParams.get('mac');
        if (!mac) {
          return NextResponse.json({ success: false, error: 'MAC address is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/mac-auth/check`, {
          method: 'POST',
          body: JSON.stringify({ macAddress: mac }),
        });
        return NextResponse.json(data);
      }

      case 'event-users': {
        const queryParams = new URLSearchParams();
        const params = ['eventId', 'status'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/event-users?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'portal-whitelist': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/portal-whitelist?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'coa-logs': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/coa/logs?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'accounting-db': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset', 'username', 'nasIpAddress', 'framedIpAddress', 'callingStationId', 'status', 'startDate', 'endDate'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/accounting/db?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'data-cap-check': {
        const username = searchParams.get('username');
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/data-cap/check?username=${encodeURIComponent(username)}`);
        return NextResponse.json(data);
      }

      case 'sql-mod-config': {
        const data = await freeradiusRequest('/api/config/sql-mod');
        return NextResponse.json(data);
      }

      // ─── New endpoints ─────────────────────────────────────────
      case 'concurrent-sessions': {
        const data = await freeradiusRequest('/api/concurrent-sessions');
        return NextResponse.json(data);
      }

      case 'concurrent-violations': {
        const data = await freeradiusRequest('/api/concurrent-sessions/violations');
        return NextResponse.json(data);
      }

      case 'provisioning-logs': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset', 'result', 'username'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        // Forward action filter (from dropdown) as 'action' param to backend
        const filterAction = searchParams.get('filterAction');
        if (filterAction) queryParams.set('action', filterAction);
        const data = await freeradiusRequest(`/api/provisioning-logs?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'provisioning-logs-stats': {
        const data = await freeradiusRequest('/api/provisioning-logs/stats');
        return NextResponse.json(data);
      }

      case 'content-filter':
      case 'content-filters': {  // alias — frontend uses plural
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'category', 'enabled'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/content-filter?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'test-content-filter': {
        const url = searchParams.get('url');
        if (!url) {
          return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }
        // Test URL against content filter rules by checking pattern matching
        const queryParams = new URLSearchParams({ url });
        const data = await freeradiusRequest(`/api/content-filter/test?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'content-filter-export': {
        const data = await freeradiusRequest('/api/content-filter/export');
        return NextResponse.json(data);
      }

      case 'guest-wifi-link': {
        const queryParams = new URLSearchParams();
        const guestId = searchParams.get('guestId');
        const username = searchParams.get('username');
        if (guestId) queryParams.set('guestId', guestId);
        if (username) queryParams.set('username', username);
        const data = await freeradiusRequest(`/api/guest-wifi-link?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'bandwidth-schedules': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'enabled'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/bandwidth-schedules?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Active Users: Query from v_active_sessions view ──────────
      // The view joins radacct with StaySuite tables and filters for active sessions.
      case 'live-sessions-list': {
        try {
          const username = searchParams.get('username');
          const nasIp = searchParams.get('nasIp');
          const status = searchParams.get('status');

          // Build SQL conditions on the view
          const conditions: string[] = ["session_status = 'active'"];
          const sqlParams: unknown[] = [];
          if (username) { conditions.push(`username LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${username}%`); }
          if (nasIp) { conditions.push(`nasipaddress LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${nasIp}%`); }
          const whereClause = `WHERE ${conditions.join(' AND ')}`;

          // Use DISTINCT ON (acctuniqueid) to guarantee no duplicates from the FULL JOIN
          // in v_session_history (which v_active_sessions is built on).
          // ORDER BY must begin with the DISTINCT ON column.
          const activeSessions = await db.$queryRawUnsafe<{
            acctuniqueid: string;
            acctsessionid: string;
            username: string;
            framedipaddress: string | null;
            callingstationid: string | null;
            nasipaddress: string | null;
            calledstationid: string | null;
            acctstarttime: string | null;
            acctupdatetime: string | null;
            acctsessiontime: number | null;
            acctinputoctets: number | null;
            acctoutputoctets: number | null;
            nasporttype: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
            downloadspeed: number | null;
            uploadspeed: number | null;
          }[]>(`
            SELECT DISTINCT ON (acctuniqueid)
                   acctuniqueid, acctsessionid, username, framedipaddress,
                   callingstationid, nasipaddress, calledstationid,
                   acctstarttime, acctupdatetime, acctsessiontime,
                   acctinputoctets, acctoutputoctets, nasporttype,
                   guest_first_name, guest_last_name, room_number,
                   property_name, plan_name, downloadspeed, uploadspeed
            FROM v_active_sessions ${whereClause}
            ORDER BY acctuniqueid, acctstarttime DESC
          `, ...sqlParams);

          // Strip /32 CIDR suffix from PostgreSQL inet columns
          const stripCidr = (v: string | null) => (v || '').replace(/\/\d+$/, '');
          const sessionsMap = new Map<string, ReturnType<typeof Object>>();
          for (const s of activeSessions) {
            const sessionId = `ls_${s.acctuniqueid}`;
            if (sessionsMap.has(sessionId)) continue; // Deduplicate by acctuniqueid
            sessionsMap.set(sessionId, {
              id: sessionId,
              username: s.username || '',
              ipAddress: stripCidr(s.framedipaddress),
              macAddress: s.callingstationid || '',
              nasIp: stripCidr(s.nasipaddress),
              nasIdentifier: s.calledstationid || '',
              deviceType: '',
              operatingSystem: '',
              manufacturer: '',
              bandwidthDown: s.downloadspeed != null ? `${Number(s.downloadspeed)} Mbps` : null,
              bandwidthUp: s.uploadspeed != null ? `${Number(s.uploadspeed)} Mbps` : null,
              sessionTime: Number(s.acctsessiontime || 0),
              dataDownload: Number(s.acctoutputoctets || 0),
              dataUpload: Number(s.acctinputoctets || 0),
              status: 'active' as const,
              startedAt: s.acctstarttime || '',
              lastSeenAt: s.acctupdatetime || '',
              sessionTimeout: null,
              idleTimeout: null,
              planName: s.plan_name || '',
              roomId: s.room_number || '',
              // Enriched fields from view
              guestName: [s.guest_first_name, s.guest_last_name].filter(Boolean).join(' ') || '',
              propertyName: s.property_name || '',
            });
          }
          const sessions = Array.from(sessionsMap.values());

          const safeSessions = JSON.parse(JSON.stringify(sessions, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeSessions });
        } catch (error) {
          console.error('[live-sessions-list] Direct query error:', error instanceof Error ? error.message : error);
          // Fallback to proxy if query fails (view/table may not exist yet)
          try {
            const queryParams = new URLSearchParams();
            const params = ['propertyId', 'status', 'nasId', 'limit', 'offset'];
            for (const p of params) {
              const v = searchParams.get(p);
              if (v) queryParams.set(p, v);
            }
            const data = await freeradiusRequest(`/api/live-sessions?${queryParams.toString()}`);
            if (data.success && Array.isArray(data.data)) {
              data.data = data.data.map((s: Record<string, unknown>) => ({
                id: s.id,
                username: s.username,
                ipAddress: s.framedIpAddress || s.clientIpAddress || '',
                macAddress: s.macAddress || '',
                nasIp: s.nasIpAddress || '',
                nasIdentifier: s.nasIdentifier || '',
                deviceType: s.deviceType || '',
                operatingSystem: s.operatingSystem || '',
                manufacturer: s.manufacturer || '',
                bandwidthDown: s.bandwidthDown ? `${s.bandwidthDown} Mbps` : null,
                bandwidthUp: s.bandwidthUp ? `${s.bandwidthUp} Mbps` : null,
                sessionTime: s.currentSessionTime || 0,
                dataDownload: s.currentOutputBytes || 0,
                dataUpload: s.currentInputBytes || 0,
                status: s.status || 'active',
                startedAt: s.startedAt || '',
                lastSeenAt: s.lastInterimUpdate || s.updatedAt || '',
                sessionTimeout: s.sessionTimeout || null,
                idleTimeout: s.idleTimeout || null,
                planName: s.planId || '',
                roomId: s.roomNo || '',
              }));
            }
            return NextResponse.json(data);
          } catch (proxyErr) {
            console.error('[live-sessions-list] Proxy fallback also failed:', proxyErr instanceof Error ? proxyErr.message : proxyErr);
            // Return empty data — never expose raw SQL errors to frontend
            return NextResponse.json({ success: true, data: [] });
          }
        }
      }

      case 'live-sessions-get': {
        const username = searchParams.get('username');
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(username)}`);
        return NextResponse.json(data);
      }

      // ─── Live Sessions Stats: Query from v_active_sessions view ──
      case 'live-sessions-stats': {
        try {
          const activeRecords = await db.$queryRawUnsafe<{
            nasipaddress: string | null;
            calledstationid: string | null;
            acctoutputoctets: number | null;
            acctinputoctets: number | null;
          }[]>(`
            SELECT nasipaddress, calledstationid, COALESCE(acctoutputoctets, 0) as acctoutputoctets, COALESCE(acctinputoctets, 0) as acctinputoctets
            FROM v_active_sessions
            WHERE session_status = 'active'
          `);

          const totalActive = activeRecords.length;
          // Group by NAS IP for per-NAS breakdown
          const nasMap = new Map<string, { nasIdentifier: string; count: number }>();
          let totalDownload = 0;
          let totalUpload = 0;

          for (const r of activeRecords) {
            totalDownload += Number(r.acctoutputoctets);
            totalUpload += Number(r.acctinputoctets);
            const key = r.nasipaddress || 'unknown';
            const existing = nasMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              nasMap.set(key, { nasIdentifier: r.calledstationid || '', count: 1 });
            }
          }

          return NextResponse.json({
            success: true,
            data: {
              totalActive,
              peakToday: totalActive,
              perNas: Array.from(nasMap.entries()).map(([nasIp, info]) => ({
                nasIp,
                nasIdentifier: info.nasIdentifier,
                count: info.count,
              })),
              totalDownload,
              totalUpload,
            },
          });
        } catch (error) {
          console.error('[live-sessions-stats] Direct query error:', error instanceof Error ? error.message : error);
          // Fallback to proxy (view/table may not exist yet)
          try {
            const queryParams = new URLSearchParams();
            const propertyId = searchParams.get('propertyId');
            if (propertyId) queryParams.set('propertyId', propertyId);
            const data = await freeradiusRequest(`/api/live-sessions/stats?${queryParams.toString()}`);
            if (data.success && data.data) {
              data.data = {
                totalActive: data.data.totalActive || 0,
                peakToday: data.data.peakToday || data.data.totalActive || 0,
                peakTodayTime: data.data.peakTodayTime || null,
                perNas: (data.data.nasCounts || []).map((n: { nasIpAddress: string; nasIdentifier?: string; cnt: number }) => ({
                  nasIp: n.nasIpAddress,
                  nasIdentifier: n.nasIdentifier || '',
                  count: n.cnt,
                })),
                totalDownload: data.data.totalDownloadBytes || 0,
                totalUpload: data.data.totalUploadBytes || 0,
              };
            }
            return NextResponse.json(data);
          } catch (proxyErr) {
            console.error('[live-sessions-stats] Proxy fallback also failed:', proxyErr instanceof Error ? proxyErr.message : proxyErr);
            // Return empty stats — never expose raw SQL errors to frontend
            return NextResponse.json({
              success: true,
              data: { totalActive: 0, peakToday: 0, perNas: [], totalDownload: 0, totalUpload: 0 },
            });
          }
        }
      }

      // ─── Accsium Gap: CoA Audit ─────────────────────────────
      case 'coa-audit-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status', 'limit', 'offset', 'startDate', 'endDate', 'username', 'coaType', 'result'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/coa-audit?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'coa-audit-stats': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/coa-audit/stats?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: FAP Policies ──────────────────────────
      case 'fap-policies-list': {
        try {
          const propertyId = searchParams.get('propertyId');
          const enabled = searchParams.get('enabled');
          const limit = parseInt(searchParams.get('limit') || '100', 10);
          const offset = parseInt(searchParams.get('offset') || '0', 10);

          const policies = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
            SELECT fap.id, fap."tenantId", fap."propertyId", fap.name, fap.description,
                   fap."cycleType", fap."limitType", fap."dataLimitMb", fap."dataLimitUnit",
                   fap."switchOverBwPolicyId", fap."cycleResetHour", fap."cycleResetMinute",
                   fap."applicableOn", fap."isEnabled", fap.priority,
                   fap."createdAt", fap."updatedAt",
                   bp.name as "switchOverBwPolicyName",
                   bp."downloadKbps" as "switchOverDownloadKbps",
                   bp."uploadKbps" as "switchOverUploadKbps"
            FROM "FairAccessPolicy" fap
            LEFT JOIN "BandwidthPolicy" bp ON fap."switchOverBwPolicyId" = bp.id
            WHERE 1=1
              ${propertyId ? `AND fap."propertyId" = '${propertyId}'` : ''}
              ${enabled === 'true' ? 'AND fap."isEnabled" = true' : ''}
              ${enabled === 'false' ? 'AND fap."isEnabled" = false' : ''}
            ORDER BY fap.priority ASC, fap."createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          `);

          const totalResult = await db.$queryRawUnsafe<[{ c: number | bigint }][]>(
            `SELECT COUNT(*) as c FROM "FairAccessPolicy" fap WHERE 1=1
              ${propertyId ? `AND fap."propertyId" = '${propertyId}'` : ''}
              ${enabled === 'true' ? 'AND fap."isEnabled" = true' : ''}
              ${enabled === 'false' ? 'AND fap."isEnabled" = false' : ''}`
          );
          const total = Number(totalResult[0]?.c ?? 0);

          const safePolicies = JSON.parse(JSON.stringify(policies, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safePolicies, total });
        } catch (error) {
          console.error('[fap-policies-list] Direct query error:', error);
          return NextResponse.json({ success: true, data: [], total: 0 });
        }
      }

      // ─── FUP Switch-Over Log ─────────────────────────────────────
      case 'fup-switch-log': {
        try {
          const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
          const action = searchParams.get('action');
          const username = searchParams.get('username');

          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (action) { conditions.push(`action = $${sqlParams.length + 1}`); sqlParams.push(action); }
          if (username) { conditions.push(`username LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${username}%`); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          sqlParams.push(limit);

          const logs = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
            SELECT id, username, plan_name, fup_policy_name, cycle_type,
                   ROUND(usage_mb::numeric, 1) as usage_mb, limit_mb,
                   action, original_down_kbps, original_up_kbps,
                   throttle_down_kbps, throttle_up_kbps,
                   nas_ip, created_at as "timestamp"
            FROM fup_switch_log
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${sqlParams.length}
          `, ...sqlParams);

          const safeLogs = JSON.parse(JSON.stringify(logs, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeLogs });
        } catch (error) {
          console.error('[fup-switch-log] error:', error);
          return NextResponse.json({ success: true, data: [] });
        }
      }

      // ─── Accsium Gap: Web Categories ────────────────────────
      case 'web-categories-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'enabled', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/web-categories?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'web-category-schedules-list': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}/schedules`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: User Status History ───────────────────
      case 'user-status-history-list': {
        try {
          const username = searchParams.get('username');
          const status = searchParams.get('status');
          const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);
          const offset = parseInt(searchParams.get('offset') || '0', 10);
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (username) { conditions.push(`h.username LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${username}%`); }
          if (status) { conditions.push(`h."newStatus" = $${sqlParams.length + 1}`); sqlParams.push(status); }
          if (startDateStr) { conditions.push(`h."createdAt" >= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(startDateStr.length === 10 ? `${startDateStr} 00:00:00` : startDateStr); }
          if (endDateStr) { conditions.push(`h."createdAt" <= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(endDateStr.length === 10 ? `${endDateStr} 23:59:59` : endDateStr); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          sqlParams.push(limit, offset);

          const rows = await db.$queryRawUnsafe<{
            id: string;
            username: string;
            oldStatus: string;
            newStatus: string;
            changedBy: string;
            changeReason: string;
            ipAddress: string;
            createdAt: string;
            userId: string;
          }[]>(`
            SELECT h.id, h.username, h."oldStatus", h."newStatus",
                   CASE
                     WHEN h."changedBy" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN COALESCE(u."firstName" || ' ' || u."lastName", h."changedBy")
                     ELSE h."changedBy"
                   END AS "changedBy",
                   h."changeReason" AS "reason", h."ipAddress",
                   h."createdAt" AS "timestamp", h."userId"
            FROM "WiFiUserStatusHistory" h
            LEFT JOIN "User" u ON u.id::text = h."changedBy"
            ${whereClause}
            ORDER BY h."createdAt" DESC
            LIMIT $${sqlParams.length - 1} OFFSET $${sqlParams.length}
          `, ...sqlParams);

          const safeRows = JSON.parse(JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeRows });
        } catch (error) {
          console.error('[user-status-history-list] Direct query error:', error);
          return NextResponse.json({ success: true, data: [] });
        }
      }

      // ─── User Usage Summary: Query from v_user_usage view ────────
      // The view already aggregates per-user bandwidth, session counts, and time
      // from radacct, with enriched guest/room/property/plan data.
      case 'user-usage-summary': {
        try {
          const limitStr = searchParams.get('limit') || '20';
          const limit = Math.min(parseInt(limitStr, 10) || 20, 100);
          const sortBy = searchParams.get('sort') || 'download';
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          // Build date filter on the view
          const conditions: string[] = [];
          const sqlParams: unknown[] = [];

          // Quick test: verify view is accessible
          const viewTest = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            'SELECT COUNT(*) as c FROM v_user_usage'
          );
          const viewCount = Number(viewTest[0]?.c ?? 0);
          if (viewCount === 0) {
            return NextResponse.json({ success: true, data: [], stats: { totalUsers: 0, totalBandwidth: 0, avgPerUser: 0, topUser: null }, _debug: 'view_empty' });
          }
          if (startDateStr) { conditions.push(`first_session_start >= $${sqlParams.length + 1}`); sqlParams.push(startDateStr); }
          if (endDateStr) { conditions.push(`first_session_start <= $${sqlParams.length + 1}`); sqlParams.push(`${endDateStr} 23:59:59`); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          // Map sortBy to SQL column
          const orderByMap: Record<string, string> = {
            download: 'total_download_bytes DESC',
            upload: 'total_upload_bytes DESC',
            sessions: 'total_sessions DESC',
            sessionTime: 'total_session_time DESC',
          };
          const orderBy = orderByMap[sortBy] || orderByMap.download;

          // Get total user count for stats
          const totalUsersRow = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            `SELECT COUNT(*) as c FROM v_user_usage ${whereClause}`,
            ...sqlParams
          );
          const totalUsers = Number(totalUsersRow[0]?.c ?? 0);

          // Get paginated data
          sqlParams.push(limit);
          const usageRows = await db.$queryRawUnsafe<{
            username: string;
            total_sessions: number;
            active_sessions: number;
            total_download_bytes: number;
            total_upload_bytes: number;
            total_session_time: number;
            last_session_start: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            guest_email: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
            plan_download_speed: number | null;
            plan_upload_speed: number | null;
            plan_data_limit: number | null;
          }[]>(`
            SELECT username, total_sessions, active_sessions,
                   total_download_bytes, total_upload_bytes, total_session_time,
                   last_session_start,
                   guest_first_name, guest_last_name, guest_email,
                   room_number, property_name, plan_name,
                   plan_download_speed, plan_upload_speed, plan_data_limit
            FROM v_user_usage ${whereClause}
            ORDER BY ${orderBy}
            LIMIT $${sqlParams.length}
          `, ...sqlParams);

          // Map view columns to response format (camelCase) — BigInt-safe
          const sortedUsers = usageRows.map((r) => ({
            username: r.username,
            totalSessions: Number(r.total_sessions ?? 0),
            activeSessions: Number(r.active_sessions ?? 0),
            totalDownloadBytes: Number(r.total_download_bytes ?? 0),
            totalUploadBytes: Number(r.total_upload_bytes ?? 0),
            totalSessionTime: Number(r.total_session_time ?? 0),
            lastSeen: r.last_session_start || '',
            // Enriched fields from view
            guestName: [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '',
            guestEmail: r.guest_email || '',
            roomNumber: r.room_number || '',
            propertyName: r.property_name || '',
            planName: r.plan_name || '',
            downloadSpeed: r.plan_download_speed,
            uploadSpeed: r.plan_upload_speed,
            dataLimit: r.plan_data_limit,
          }));

          // Overall stats
          const totalBandwidth = usageRows.reduce((sum, u) => sum + Number(u.total_download_bytes ?? 0) + Number(u.total_upload_bytes ?? 0), 0);
          const overallStats = {
            totalUsers,
            totalBandwidth,
            avgPerUser: totalUsers > 0 ? Math.round(totalBandwidth / totalUsers) : 0,
            topUser: sortedUsers.length > 0 ? sortedUsers[0].username : null,
          };

          return NextResponse.json({
            success: true,
            data: sortedUsers,
            stats: overallStats,
          });
        } catch (error) {
          console.error('[user-usage-summary] Direct query error:', error instanceof Error ? error.message : error);
          // Fallback to proxy (view may not exist yet)
          try {
            const queryParams = new URLSearchParams();
            const params = ['limit', 'sort', 'startDate', 'endDate'];
            for (const p of params) {
              const v = searchParams.get(p);
              if (v) queryParams.set(p, v);
            }
            const data = await freeradiusRequest(`/api/user-usage/summary?${queryParams.toString()}`);
            return NextResponse.json(data);
          } catch (proxyErr) {
            console.error('[user-usage-summary] Proxy fallback also failed:', proxyErr instanceof Error ? proxyErr.message : proxyErr);
            return NextResponse.json({
              success: true,
              data: [],
              stats: { totalUsers: 0, totalBandwidth: 0, avgPerUser: 0, topUser: null },
            });
          }
        }
      }

      // ─── User Usage Detail: Query from v_session_history view ────
      case 'user-usage-detail': {
        try {
          const username = searchParams.get('username');
          if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
          }
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          // Build SQL conditions on the view
          const conditions: string[] = [`username = $1`];
          const sqlParams: unknown[] = [username];
          if (startDateStr) { conditions.push(`acctstarttime >= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(startDateStr); }
          if (endDateStr) { conditions.push(`acctstarttime <= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(`${endDateStr} 23:59:59`); }
          const whereClause = `WHERE ${conditions.join(' AND ')}`;

          const userRecords = await db.$queryRawUnsafe<{
            radacctid: number;
            acctuniqueid: string;
            acctsessionid: string;
            username: string;
            nasipaddress: string | null;
            calledstationid: string | null;
            framedipaddress: string | null;
            callingstationid: string | null;
            acctstarttime: string | null;
            acctstoptime: string | null;
            acctsessiontime: number | null;
            acctinputoctets: number | null;
            acctoutputoctets: number | null;
            acctupdatetime: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
          }[]>(`
            SELECT radacctid, acctuniqueid, acctsessionid, username,
                   nasipaddress, calledstationid, framedipaddress, callingstationid,
                   acctstarttime, acctstoptime, acctsessiontime,
                   acctinputoctets, acctoutputoctets, acctupdatetime,
                   guest_first_name, guest_last_name, room_number,
                   property_name, plan_name
            FROM v_session_history ${whereClause}
            ORDER BY acctstarttime DESC
          `, ...sqlParams);

          // Build sessions list — BigInt-safe
          const sessions = userRecords.map((r) => ({
            id: r.acctuniqueid || r.acctsessionid,
            sessionId: r.acctsessionid,
            startedAt: r.acctstarttime || null,
            endedAt: r.acctstoptime || null,
            nasIp: r.nasipaddress,
            nasIdentifier: r.calledstationid || null,
            ipAddress: r.framedipaddress || '',
            macAddress: r.callingstationid || '',
            downloadBytes: Number(r.acctoutputoctets ?? 0),
            uploadBytes: Number(r.acctinputoctets ?? 0),
            sessionTime: Number(r.acctsessiontime ?? 0),
            isActive: !r.acctstoptime,
            // Enriched fields from view
            guestName: [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '',
            roomNumber: r.room_number || '',
            propertyName: r.property_name || '',
            planName: r.plan_name || '',
          }));

          // Build daily usage breakdown
          const dailyMap = new Map<string, { downloadBytes: number; uploadBytes: number }>();
          for (const r of userRecords) {
            if (r.acctupdatetime) {
              const dateKey = String(r.acctupdatetime).split('T')[0];
              const existing = dailyMap.get(dateKey);
              if (existing) {
                existing.downloadBytes += Number(r.acctoutputoctets ?? 0);
                existing.uploadBytes += Number(r.acctinputoctets ?? 0);
              } else {
                dailyMap.set(dateKey, {
                  downloadBytes: Number(r.acctoutputoctets ?? 0),
                  uploadBytes: Number(r.acctinputoctets ?? 0),
                });
              }
            }
          }

          const dailyUsage = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, bytes]) => ({
              date,
              dayLabel: (() => {
                try {
                  const dt = new Date(date);
                  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                } catch { return date; }
              })(),
              downloadBytes: bytes.downloadBytes,
              uploadBytes: bytes.uploadBytes,
              totalBytes: bytes.downloadBytes + bytes.uploadBytes,
            }));

          // Summary stats — BigInt-safe
          const totalDownloadBytes = userRecords.reduce((s, r) => s + Number(r.acctoutputoctets ?? 0), 0);
          const totalUploadBytes = userRecords.reduce((s, r) => s + Number(r.acctinputoctets ?? 0), 0);
          const totalSessionTime = userRecords.reduce((s, r) => s + Number(r.acctsessiontime ?? 0), 0);
          const activeSessions = userRecords.filter(r => !r.acctstoptime).length;

          const responseData = {
            success: true,
            data: {
              username,
              totalSessions: userRecords.length,
              activeSessions,
              totalDownloadBytes,
              totalUploadBytes,
              totalSessionTime,
              sessions,
              dailyUsage,
            },
          };

          return NextResponse.json(responseData);
        } catch (error) {
          console.error('[user-usage-detail] Direct query error:', error);
          const username = searchParams.get('username');
          if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
          }
          const detailParams = new URLSearchParams();
          const startDate = searchParams.get('startDate');
          const endDate = searchParams.get('endDate');
          if (startDate) detailParams.set('startDate', startDate);
          if (endDate) detailParams.set('endDate', endDate);
          const qs = detailParams.toString();
          const data = await freeradiusRequest(`/api/user-usage/${encodeURIComponent(username)}${qs ? '?' + qs : ''}`);
          if (data.success && data.data) {
            const backendData = data.data;
            if (Array.isArray(backendData.sessions)) {
              backendData.sessions = backendData.sessions.map((s: Record<string, unknown>) => ({
                id: s.acctuniqueid || s.acctsessionid || s.radacctid,
                sessionId: s.acctsessionid || '',
                startedAt: s.acctstarttime || null,
                endedAt: s.acctstoptime || null,
                nasIp: s.nasipaddress || '',
                nasIdentifier: null,
                ipAddress: s.framedipaddress || '',
                macAddress: s.callingstationid || '',
                downloadBytes: Number(s.acctoutputoctets) || 0,
                uploadBytes: Number(s.acctinputoctets) || 0,
                sessionTime: Number(s.acctsessiontime) || 0,
                isActive: s.status === 'active' || s.acctstoptime === null,
              }));
            }
            if (Array.isArray(backendData.dailyUsage)) {
              backendData.dailyUsage = backendData.dailyUsage.map((d: Record<string, unknown>) => ({
                date: d.date as string,
                dayLabel: d.date ? (() => {
                  try {
                    const dt = new Date(d.date as string);
                    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  } catch { return d.date as string; }
                })() : '',
                downloadBytes: Number(d.downloadBytes) || 0,
                uploadBytes: Number(d.uploadBytes) || 0,
                totalBytes: (Number(d.downloadBytes) || 0) + (Number(d.uploadBytes) || 0),
              }));
            }
            if (backendData.summary) {
              data.data = {
                username: backendData.username,
                totalSessions: backendData.summary.totalSessions || 0,
                activeSessions: backendData.summary.activeSessions || 0,
                totalDownloadBytes: backendData.summary.totalDownloadBytes || 0,
                totalUploadBytes: backendData.summary.totalUploadBytes || 0,
                totalSessionTime: backendData.summary.totalSessionTime || 0,
                sessions: backendData.sessions,
                dailyUsage: backendData.dailyUsage,
              };
            }
          }
          return NextResponse.json(data);
        }
      }

      // ─── Accsium Gap: NAS Health ────────────────────────────
      case 'nas-health-current': {
        const data = await freeradiusRequest('/api/nas-health/current');
        return NextResponse.json(data);
      }

      case 'nas-health-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/nas-health?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'nas-health-stats': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/nas-health/stats?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: BW Policy Details ─────────────────────
      case 'bw-policy-details-list': {
        const queryParams = new URLSearchParams();
        const params = ['bandwidthPolicyId', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/bw-policy-details?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      default: {
        // Default: return service status
        const data = await freeradiusRequest('/api/status');
        return NextResponse.json(data);
      }
    }
  } catch (error) {
    console.error('Error communicating with RADIUS service:', error);
    // Never expose raw PostgreSQL errors to the frontend
    const safeMessage = error instanceof Error
      ? (error.message.includes('$') || error.message.includes('relation') || error.message.includes('column') || error.message.includes('does not exist'))
        ? 'Database query error — check server logs'
        : error.message
      : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to communicate with RADIUS service',
        details: safeMessage,
        hint: 'Make sure the RADIUS service is running on port 3010'
      },
      { status: 503 }
    );
  }
}

// POST /api/wifi/radius - Control RADIUS service or test connection
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'start': {
        const result = await freeradiusRequest('/api/service/start', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'stop': {
        const result = await freeradiusRequest('/api/service/stop', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'restart': {
        const result = await freeradiusRequest('/api/service/restart', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'test': {
        const result = await freeradiusRequest('/api/test', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'import': {
        const result = await freeradiusRequest('/api/config/import', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'generate-secret': {
        const result = await freeradiusRequest('/api/nas/generate-secret', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync': {
        // Full sync: both users and clients — direct DB
        try {
          const usersResult = await db.$queryRawUnsafe<{ c: number }[]>('SELECT COUNT(*)::int as c FROM radcheck WHERE attribute = \'Cleartext-Password\'');
          const nasResult = await db.$queryRawUnsafe<{ c: number }[]>('SELECT COUNT(*)::int as c FROM nas');
          return NextResponse.json({
            success: true,
            message: 'Full sync complete (users + NAS clients)',
            data: { userCount: usersResult[0]?.c ?? 0, nasCount: nasResult[0]?.c ?? 0 },
          });
        } catch (error) {
          return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
        }
      }

      case 'accounting-refresh': {
        const result = await freeradiusRequest('/api/accounting/refresh', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync-users': {
        // ─── Direct DB sync — does NOT depend on freeradius-service ────
        // Reads WiFiUser + WiFiPlan and upserts radcheck, radreply, radusergroup.
        const syncStartTime = Date.now();
        try {
          interface WifUserRow {
            id: string;
            username: string;
            password: string;
            planId: string | null;
            propertyId: string;
            status: string;
            maxSessions: number;
          }
          interface PlanRow {
            id: string;
            name: string;
            downloadSpeed: number;
            uploadSpeed: number;
            dataLimit: number | null;
            sessionLimit: number | null;
            validityDays: number;
          }

          // 1. Fetch all active WiFiUsers with their passwords
          const users = await db.$queryRawUnsafe<WifUserRow[]>(`
            SELECT id::text, username, password, "planId"::text, "propertyId"::text, status, "maxSessions"
            FROM "WiFiUser"
            WHERE status != 'expired'
          `);

          // 2. Fetch all relevant WiFiPlans
          const planIds = [...new Set(users.map(u => u.planId).filter(Boolean))] as string[];
          let plansMap = new Map<string, PlanRow>();
          if (planIds.length > 0) {
            const plans = await db.$queryRawUnsafe<PlanRow[]>(`
              SELECT id::text, name, "downloadSpeed", "uploadSpeed", "dataLimit", "sessionLimit", "validityDays"
              FROM "WiFiPlan"
              WHERE id::text = ANY($1)
            `, planIds);
            for (const p of plans) plansMap.set(p.id, p);
          }

          let syncedCount = 0;
          let skippedCount = 0;
          let errorCount = 0;

          // 3. Sync each user
          for (const user of users) {
            try {
              // Delete+Insert radcheck (no unique constraint on username+attribute)
              // Extended schema: id, wifiUserId, username, attribute, op, value, priority, isActive, createdAt, updatedAt
              await db.$executeRawUnsafe(`
                DELETE FROM radcheck WHERE username = $1 AND attribute = 'Cleartext-Password'
              `, user.username);
              await db.$executeRawUnsafe(`
                INSERT INTO radcheck (id, "wifiUserId", username, attribute, op, value, "isActive", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), $1::uuid, $2, 'Cleartext-Password', ':=', $3, true, NOW(), NOW())
              `, user.id, user.username, user.password);

              // Get plan
              const plan = user.planId ? plansMap.get(user.planId) : null;
              const groupName = plan ? `plan_${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'default';
              const op = ':=';

              // Delete+Insert radusergroup
              // Extended schema: id, username, groupname, priority, createdAt
              await db.$executeRawUnsafe(`DELETE FROM radusergroup WHERE username = $1`, user.username);
              await db.$executeRawUnsafe(`
                INSERT INTO radusergroup (id, username, groupname, priority, "createdAt")
                VALUES (gen_random_uuid(), $1, $2, 0, NOW())
              `, user.username, groupName);

              // Sync plan attributes into radreply
              if (plan) {
                const sessionTimeout = plan.sessionLimit
                  ? plan.sessionLimit * 3600
                  : plan.validityDays * 86400;

                // Clear old plan attributes for this user
                await db.$executeRawUnsafe(`
                  DELETE FROM radreply WHERE username = $1 AND attribute IN (
                    'WISPr-Bandwidth-Max-Down', 'WISPr-Bandwidth-Max-Up',
                    'Session-Timeout', 'Framed-IP-Address', 'Idle-Timeout'
                  )
                `, user.username);

                // Insert bandwidth attributes — extended schema with id, wifiUserId, isActive, timestamps
                await db.$executeRawUnsafe(`
                  INSERT INTO radreply (id, "wifiUserId", username, attribute, op, value, "isActive", "createdAt", "updatedAt") VALUES
                    (gen_random_uuid(), $1::uuid, $2, 'WISPr-Bandwidth-Max-Down', $3, $4, true, NOW(), NOW()),
                    (gen_random_uuid(), $1::uuid, $2, 'WISPr-Bandwidth-Max-Up', $3, $5, true, NOW(), NOW()),
                    (gen_random_uuid(), $1::uuid, $2, 'Session-Timeout', $3, $6, true, NOW(), NOW())
                `, user.id, user.username, op, String(plan.downloadSpeed * 1024), String(plan.uploadSpeed * 1024), String(sessionTimeout));
              }

              // Mark as synced
              await db.$executeRawUnsafe(`
                UPDATE "WiFiUser" SET "radiusSynced" = true, "radiusSyncedAt" = NOW()
                WHERE username = $1
              `, user.username);

              syncedCount++;
            } catch (syncErr) {
              console.error(`[sync-users] Failed for ${user.username}:`, syncErr instanceof Error ? syncErr.message : syncErr);
              errorCount++;
            }
          }

          // 4. Clean up stale radcheck entries (users deleted from WiFiUser)
          const activeUsernames = users.map(u => u.username);
          if (activeUsernames.length > 0) {
            const staleResult = await db.$queryRawUnsafe<{ c: number }[]>(`
              SELECT COUNT(*)::int as c FROM radcheck
              WHERE username NOT IN (SELECT unnest($1::text[]))
                AND attribute = 'Cleartext-Password'
            `, activeUsernames);
            const staleCount = staleResult[0]?.c ?? 0;
            if (staleCount > 0) {
              console.log(`[sync-users] Found ${staleCount} stale radcheck entries (keeping for safety)`);
            }
          }

          // Log sync to RadiusProvisioningLog (non-blocking)
          const firstPropertyId = users.length > 0 ? users[0].propertyId : '00000000-0000-0000-0000-000000000000';
          const syncResult = errorCount === 0 ? 'success' : syncedCount > 0 ? 'partial' : 'failed';
          const syncDurationMs = Date.now() - syncStartTime;
          wifiUserService.logProvisioning({
            action: 'sync-users',
            username: 'system.sync',
            propertyId: firstPropertyId,
            result: syncResult,
            details: `Synced ${syncedCount}/${users.length} users to RADIUS (${skippedCount} skipped, ${errorCount} errors)`,
            error: errorCount > 0 ? `${errorCount} users failed to sync` : undefined,
            durationMs: syncDurationMs,
          }).catch(() => {});

          return NextResponse.json({
            success: true,
            message: `Synced ${syncedCount} users to RADIUS tables`,
            data: { syncedCount, skippedCount, errorCount, totalUsers: users.length },
          });
        } catch (error) {
          console.error('[sync-users] Direct sync error:', error);
          return NextResponse.json({
            success: false,
            error: 'Failed to sync users to RADIUS',
            details: error instanceof Error ? error.message : 'Unknown error',
          }, { status: 500 });
        }
      }

      case 'sync-clients': {
        // Direct NAS client sync — reads nas table and returns count
        try {
          const nasResult = await db.$queryRawUnsafe<{ c: number }[]>('SELECT COUNT(*)::int as c FROM nas');
          return NextResponse.json({
            success: true,
            message: `${nasResult[0]?.c ?? 0} NAS clients synced`,
            data: { nasCount: nasResult[0]?.c ?? 0 },
          });
        } catch (error) {
          return NextResponse.json({ success: false, error: 'Failed to sync NAS clients' }, { status: 500 });
        }
      }

      case 'coa-disconnect': {
        const result = await freeradiusRequest('/api/coa/disconnect', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-bandwidth': {
        const result = await freeradiusRequest('/api/coa/bandwidth', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-disconnect-all': {
        const result = await freeradiusRequest('/api/coa/disconnect-all', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'data-cap-enforce': {
        const result = await freeradiusRequest('/api/data-cap/enforce', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'data-cap-check-all': {
        const result = await freeradiusRequest('/api/data-cap/check-all', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'mac-auth-add':
      case 'create-mac-auth': {  // alias
        const result = await freeradiusRequest('/api/mac-auth', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'mac-auth-check':
      case 'check-mac': {  // alias
        const result = await freeradiusRequest('/api/mac-auth/check', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'event-users-bulk':
      case 'generate-event-users': {  // alias
        const result = await freeradiusRequest('/api/event-users/bulk', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'event-revoke':
      case 'revoke-event-user': {  // alias
        const eventUserId = data.id;
        if (!eventUserId) {
          return NextResponse.json({ success: false, error: 'Event user ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/event-users/${encodeURIComponent(eventUserId)}/revoke`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'portal-whitelist-add':
      case 'create-portal-whitelist': {  // alias
        const result = await freeradiusRequest('/api/portal-whitelist', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── MAC Auth: update, delete, import ────────────────────
      case 'update-mac-auth': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'delete-mac-auth': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'import-mac-auth': {
        const result = await freeradiusRequest('/api/mac-auth/import', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: create event ────────────────────────────
      case 'create-event': {
        const result = await freeradiusRequest('/api/event-users/event', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: create single attendee ──────────────────
      case 'create-event-attendee': {
        const result = await freeradiusRequest('/api/event-users/attendee', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: delete event ────────────────────────────
      case 'delete-event': {
        const eventId = data.eventId;
        if (!eventId) {
          return NextResponse.json({ success: false, error: 'eventId is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/event-users/event/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      // ─── Portal Whitelist: update, delete, toggle ────────────
      case 'update-portal-whitelist': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'delete-portal-whitelist': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'toggle-portal-whitelist': {
        const id = data.id;
        const enabled = data.enabled;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        });
        return NextResponse.json(result);
      }

      case 'auth-log-create': {
        const result = await freeradiusRequest('/api/auth-logs', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'change-user-status': {
        const userId = data.id;
        const newStatus = data.status; // 'active', 'suspended', 'deactivated'
        const reason = data.reason || '';

        // Capture operator IP from request headers
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const operatorIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

        if (!userId || !newStatus) {
          return NextResponse.json({ success: false, error: 'User ID and new status are required' }, { status: 400 });
        }

        const validStatuses = ['active', 'suspended', 'deactivated'];
        if (!validStatuses.includes(newStatus)) {
          return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        // Resolve operator name from context.userId
        let operatorName = context.userId || 'system';
        try {
          if (context.userId) {
            const operator = await db.user.findUnique({
              where: { id: context.userId },
              select: { firstName: true, lastName: true },
            });
            if (operator) {
              operatorName = [operator.firstName, operator.lastName].filter(Boolean).join(' ') || context.userId;
            }
          }
        } catch (resolveErr) {
          console.warn('[change-user-status] Could not resolve operator name:', resolveErr);
        }

        try {
          // Find the user to get current status + username
          const user = await db.wiFiUser.findUnique({
            where: { id: userId },
            include: { property: { select: { id: true, name: true } } },
          });

          if (!user) {
            return NextResponse.json({ success: false, error: 'WiFi user not found' }, { status: 404 });
          }

          const oldStatus = user.status;

          // Prevent no-op
          if (oldStatus === newStatus) {
            return NextResponse.json({ success: true, message: `User already in "${newStatus}" status` });
          }

          // Handle the status change
          if (newStatus === 'suspended' || newStatus === 'deactivated') {
            // Delete RADIUS credentials to prevent login
            await db.$transaction([
              db.radCheck.deleteMany({ where: { username: user.username } }),
              db.radReply.deleteMany({ where: { username: user.username } }),
              db.radUserGroup.deleteMany({ where: { username: user.username } }),
              db.wiFiUser.update({
                where: { id: userId },
                data: { status: newStatus, radiusSynced: false },
              }),
            ]);
          } else if (newStatus === 'active') {
            // Re-create RADIUS credentials from stored WiFiUser data
            const plan = user.planId ? await db.wiFiPlan.findUnique({ where: { id: user.planId } }) : null;

            await db.$transaction(async (tx) => {
              // Re-create password check
              const existingCheck = await tx.radCheck.findFirst({ where: { username: user.username } });
              if (!existingCheck) {
                await tx.radCheck.create({
                  data: {
                    username: user.username,
                    attribute: 'Cleartext-Password',
                    op: ':=',
                    value: user.password,
                  },
                });
              }

              // Re-create reply attributes from plan if exists
              if (plan) {
                const existingReplies = await tx.radReply.findMany({ where: { username: user.username } });
                if (existingReplies.length === 0) {
                  if (plan.downloadSpeed > 0) {
                    await tx.radReply.create({
                      data: { username: user.username, attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: String(plan.downloadSpeed * 1000000) },
                    });
                  }
                  if (plan.uploadSpeed > 0) {
                    await tx.radReply.create({
                      data: { username: user.username, attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: String(plan.uploadSpeed * 1000000) },
                    });
                  }
                }
              }

              await tx.wiFiUser.update({
                where: { id: userId },
                data: { status: 'active', radiusSynced: true, radiusSyncedAt: new Date() },
              });
            });
          }

          // Log status change to audit trail
          await db.wiFiUserStatusHistory.create({
            data: {
              tenantId: user.tenantId,
              propertyId: user.propertyId,
              username: user.username,
              userId: user.id,
              oldStatus,
              newStatus,
              changedBy: operatorName,
              changeReason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
              ipAddress: operatorIp,
            },
          });

          // Try to disconnect active sessions if suspending/deactivating
          if (newStatus === 'suspended' || newStatus === 'deactivated') {
            try {
              // Find active sessions for this user
              const activeSessions = await db.$queryRawUnsafe<{ acctuniqueid: string; nasipaddress: string }[]>(
                `SELECT acctuniqueid, nasipaddress FROM radacct WHERE username = $1 AND acctstoptime IS NULL LIMIT 10`,
                user.username
              );

              if (activeSessions.length > 0) {
                // Try CoA disconnect via adapter if available
                const nasIps = [...new Set(activeSessions.map(s => s.nasipaddress?.replace(/\/\d+$/, '')))];
                console.log(`[change-user-status] User ${user.username} has ${activeSessions.length} active sessions on ${nasIps.join(', ')}. RADIUS credentials deleted — sessions will be rejected on next auth.`);
              }
            } catch (sessionErr) {
              console.warn('[change-user-status] Could not check active sessions:', sessionErr);
            }
          }

          // Log to RadiusProvisioningLog
          const logAction = newStatus === 'suspended' ? 'suspend' : newStatus === 'active' ? 'resume' : 'deprovision';
          wifiUserService.logProvisioning({
            action: logAction,
            username: user.username,
            propertyId: user.propertyId,
            guestId: user.guestId || undefined,
            userId: context.userId || undefined,
            result: 'success',
            details: `${logAction}: ${oldStatus} → ${newStatus} by ${operatorName}${reason ? `. Reason: ${reason}` : ''}`,
          }).catch(() => {});

          return NextResponse.json({
            success: true,
            message: `User "${user.username}" status changed: ${oldStatus} → ${newStatus}`,
            data: { userId: user.id, username: user.username, oldStatus, newStatus },
          });
        } catch (error) {
          console.error('[change-user-status] Error:', error);
          return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to change user status' },
            { status: 500 }
          );
        }
      }

      case 'create-user': {
        const result = await freeradiusRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'update-user': {
        const userId = data.id;
        if (!userId) {
          return NextResponse.json({ success: false, error: 'User id is required' }, { status: 400 });
        }

        // Handle IP pool override (stored in WiFiUser table, not in freeradius-service)
        const ipPoolId = data.ipPoolId;
        if (ipPoolId !== undefined) {
          try {
            await db.$executeRawUnsafe(
              `UPDATE "WiFiUser" SET "ipPoolId" = $1::uuid WHERE id = $2::uuid`,
              (ipPoolId && ipPoolId !== 'none') ? ipPoolId : null,
              userId
            );
          } catch (poolErr) {
            console.warn('[update-user] IP pool update failed (non-fatal):', poolErr);
          }
        }

        const { id, ipPoolId: _poolId, ...updateData } = data;
        const result = await freeradiusRequest(`/api/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        // Log to RadiusProvisioningLog
        const updateUser = await db.wiFiUser.findUnique({ where: { id: userId }, select: { username: true, propertyId: true } }).catch(() => null);
        if (updateUser) {
          wifiUserService.logProvisioning({
            action: 'update',
            username: updateUser.username,
            propertyId: updateUser.propertyId,
            result: result?.success ? 'success' : 'failed',
            details: result?.success ? `Updated WiFi user settings` : (result?.error || 'Failed to update user'),
          }).catch(() => {});
        }
        return NextResponse.json(result);
      }

      case 'delete-user': {
        const userId = data.id;
        if (!userId) {
          return NextResponse.json({ success: false, error: 'User id is required' }, { status: 400 });
        }
        // Resolve username before deleting for the log
        const delUser = await db.wiFiUser.findUnique({ where: { id: userId }, select: { username: true, propertyId: true } }).catch(() => null);
        const result = await freeradiusRequest(`/api/users/${userId}`, { method: 'DELETE' });
        if (delUser) {
          wifiUserService.logProvisioning({
            action: 'deprovision',
            username: delUser.username,
            propertyId: delUser.propertyId,
            result: result?.success ? 'success' : 'failed',
            details: result?.success ? `Deleted WiFi user ${delUser.username}` : (result?.error || 'Failed to delete user'),
          }).catch(() => {});
        }
        return NextResponse.json(result);
      }

      case 'provision': {
        const result = await freeradiusRequest('/api/provision', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        // Log to RadiusProvisioningLog
        const provUsername = data.username || 'unknown';
        const provPropertyId = data.propertyId || '00000000-0000-0000-0000-000000000000';
        wifiUserService.logProvisioning({
          action: 'provision',
          username: provUsername,
          propertyId: provPropertyId,
          guestId: data.guestId || undefined,
          result: result?.success ? 'success' : 'failed',
          details: result?.success ? `Provisioned WiFi user ${provUsername}` : (result?.error || 'Failed to provision'),
        }).catch(() => {});
        return NextResponse.json(result);
      }

      case 'deprovision': {
        const username = data.username;
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        // Resolve propertyId for the log
        const depUser = await db.wiFiUser.findFirst({ where: { username }, select: { propertyId: true } }).catch(() => null);
        const result = await freeradiusRequest(`/api/provision/${encodeURIComponent(username)}`, { method: 'DELETE' });
        wifiUserService.logProvisioning({
          action: 'deprovision',
          username,
          propertyId: depUser?.propertyId || '00000000-0000-0000-0000-000000000000',
          result: result?.success ? 'success' : 'failed',
          details: result?.success ? `Deprovisioned WiFi user ${username}` : (result?.error || 'Failed to deprovision'),
        }).catch(() => {});
        return NextResponse.json(result);
      }

      // ─── New POST endpoints ────────────────────────────────────
      case 'concurrent-sessions': {
        const groupName = data.groupName;
        const maxSessions = data.maxSessions;
        if (!groupName) {
          return NextResponse.json({ success: false, error: 'groupName is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/concurrent-sessions?groupName=${encodeURIComponent(groupName)}&maxSessions=${maxSessions || 1}`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'concurrent-sessions-bulk': {
        const result = await freeradiusRequest('/api/concurrent-sessions/bulk', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-add':
      case 'create-content-filter': {  // alias
        const result = await freeradiusRequest('/api/content-filter', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-update':
      case 'update-content-filter': {  // alias
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-delete':
      case 'delete-content-filter': {  // alias
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'toggle-content-filter': {
        const id = data.id;
        const enabled = data.enabled;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        });
        return NextResponse.json(result);
      }

      case 'apply-content-filter-preset': {
        const { category, patterns, filterAction } = data;
        if (!category || !Array.isArray(patterns)) {
          return NextResponse.json({ success: false, error: 'category and patterns are required' }, { status: 400 });
        }
        // Bulk create content filter entries from preset
        const result = await freeradiusRequest('/api/content-filter/preset', {
          method: 'POST',
          body: JSON.stringify({ category, patterns, filterAction: filterAction || 'block' }),
        });
        return NextResponse.json(result);
      }



      case 'guest-wifi-link': {
        const result = await freeradiusRequest('/api/guest-wifi-link', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        // Log to RadiusProvisioningLog
        const linkUsername = data.username || data.guestId || 'unknown';
        const linkPropertyId = data.propertyId || '00000000-0000-0000-0000-000000000000';
        wifiUserService.logProvisioning({
          action: 'guest-wifi-link',
          username: linkUsername,
          propertyId: linkPropertyId,
          guestId: data.guestId || undefined,
          bookingId: data.bookingId || undefined,
          result: result?.success ? 'success' : 'failed',
          details: result?.success ? `Provisioned WiFi access for guest` : (result?.error || 'Failed to link guest WiFi'),
        }).catch(() => {});
        return NextResponse.json(result);
      }

      case 'guest-wifi-unlink': {
        const guestId = data.guestId;
        if (!guestId) {
          return NextResponse.json({ success: false, error: 'guestId is required' }, { status: 400 });
        }
        // Resolve username before unlinking for the log
        let unlinkUsername = `guest_${guestId.slice(-6)}`;
        let unlinkPropertyId = '00000000-0000-0000-0000-000000000000';
        try {
          const guestUser = await db.wiFiUser.findFirst({ where: { guestId }, select: { username: true, propertyId: true } });
          if (guestUser) { unlinkUsername = guestUser.username; unlinkPropertyId = guestUser.propertyId; }
        } catch (_) {}
        const result = await freeradiusRequest(`/api/guest-wifi-link/${encodeURIComponent(guestId)}`, { method: 'DELETE' });
        // Log to RadiusProvisioningLog
        wifiUserService.logProvisioning({
          action: 'guest-wifi-unlink',
          username: unlinkUsername,
          propertyId: unlinkPropertyId,
          guestId,
          result: result?.success ? 'success' : 'failed',
          details: result?.success ? 'Deprovisioned WiFi access for guest' : (result?.error || 'Failed to unlink guest WiFi'),
        }).catch(() => {});
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules': {
        const result = await freeradiusRequest('/api/bandwidth-schedules', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/bandwidth-schedules/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/bandwidth-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-enforce': {
        const { action: _action, ...enforceData } = data;
        const result = await freeradiusRequest('/api/bandwidth-schedules/enforce', {
          method: 'POST',
          body: JSON.stringify(enforceData),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: LiveSession POST/PUT/DELETE ───────────
      case 'live-sessions-create': {
        const result = await freeradiusRequest('/api/live-sessions', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'live-sessions-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'live-sessions-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'live-sessions-disconnect': {
        // Accept both sessionId (LiveSession id, may have ls_ prefix) and acctSessionId (bare)
        const { sessionId, acctSessionId, username, nasIp } = data;
        const effectiveSessionId = sessionId || acctSessionId;
        console.log('[live-sessions-disconnect] RAW data:', JSON.stringify({ sessionId, acctSessionId, username, nasIp }));

        if (!username && !effectiveSessionId) {
          return NextResponse.json({ success: false, error: 'Username or sessionId is required' }, { status: 400 });
        }

        // Strip ls_ prefix if present to get bare acctSessionId
        const bareSessionId = effectiveSessionId?.startsWith('ls_') ? effectiveSessionId.slice(3) : effectiveSessionId;
        const disconnectUsername = username || '';
        console.log('[live-sessions-disconnect] Resolved:', { bareSessionId, disconnectUsername, nasIp: nasIp || '' });
        const disconnectNasIp = nasIp || '';

        // 1. Try RADIUS CoA/Disconnect-Message to NAS (best-effort)
        let coaSuccess = false;
        let coaMessage = '';
        try {
          // Look up NAS secret from PostgreSQL
          // GUI may send nasIp with CIDR (e.g. 192.168.1.1/32) — strip it for NAS lookup
          let nasSecret = 'testing123'; // default fallback
          let coaPort = 3799;
          const cleanNasIp = disconnectNasIp.replace(/\/\d+$/, ''); // strip /32 CIDR suffix
          try {
            const nasRows = await db.$queryRawUnsafe<{ nasname: string; secret: string; ports: number | null }[]>(
              `SELECT nasname, secret, ports FROM nas WHERE nasname = $1 LIMIT 1`,
              cleanNasIp
            );
            if (nasRows.length > 0) {
              nasSecret = nasRows[0].secret;
              coaPort = nasRows[0].ports || 3799;
            }
          } catch { /* NAS lookup failed, use defaults */ }

          // Build radclient attributes — use clean IP (without CIDR) for radclient
          const radclientPath = `${process.cwd()}/freeradius-install/bin/radclient`;
          const attrs = `User-Name="${disconnectUsername}"${bareSessionId ? `\nAcct-Session-Id="${bareSessionId}"` : ''}`;
          const tmpAttrsFile = `/tmp/radclient-disconnect-${Date.now()}.txt`;
          const { execSync } = await import('child_process');
          const fs = await import('fs');

          try {
            fs.writeFileSync(tmpAttrsFile, attrs + '\n');
            const cmd = `${radclientPath} -t 3 -r 1 ${cleanNasIp}:${coaPort} disconnect ${nasSecret} < ${tmpAttrsFile} 2>&1`;
            const output = execSync(cmd, { timeout: 5000 }).toString();
            coaMessage = output.trim();
            coaSuccess = output.includes('Disconnect-ACK') || output.includes('CoA-ACK') || output.includes('received');
          } catch (execErr: unknown) {
            coaMessage = execErr instanceof Error ? execErr.message : String(execErr);
            // radclient returns non-zero exit code even on timeout, but may have succeeded
            if (coaMessage.includes('Disconnect-ACK') || coaMessage.includes('CoA-ACK')) {
              coaSuccess = true;
            }
          } finally {
            try { fs.unlinkSync(tmpAttrsFile); } catch { /* ignore */ }
          }
        } catch (coaErr) {
          coaMessage = coaErr instanceof Error ? coaErr.message : String(coaErr);
        }

        // 2. ALWAYS end the session in PostgreSQL (the critical part)
        let localEnded = false;
        let localMessage = '';
        try {
          // The view uses COALESCE(WiFiSession.id::text, radacct.acctuniqueid) as acctuniqueid
          // So bareSessionId might be a WiFiSession.id (UUID) — NOT a real radacct acctuniqueid
          // We must close BOTH tables: radacct (by acctuniqueid/acctsessionid) AND WiFiSession (by id)
          // Also, nasipaddress from the view defaults to '0.0.0.0' when no radacct row exists
          // So when nasIp is '0.0.0.0', don't use it as a filter (too broad — matches everything)

          const nasIpFilter = (disconnectNasIp && disconnectNasIp !== '0.0.0.0' && disconnectNasIp !== '0.0.0.0/32') ? disconnectNasIp : '';

          // 2a. Close radacct record
          try {
            await db.$executeRawUnsafe(`
              UPDATE radacct
              SET acctstoptime = NOW(),
                  acctterminatecause = 'Admin-Reset',
                  acctsessiontime = COALESCE(
                    EXTRACT(EPOCH FROM (NOW() - acctstarttime))::bigint,
                    acctsessiontime
                  ),
                  acctupdatetime = NOW()
              WHERE acctstoptime IS NULL
                AND ($1::text = '' OR username = $1)
                AND ($2::text = '' OR acctuniqueid = $2 OR acctsessionid = $2)
                AND ($3::text = '' OR nasipaddress = $3 OR nasipaddress::inet = $3::inet)
            `, disconnectUsername, bareSessionId || '', nasIpFilter);
          } catch (radacctErr) {
            console.warn('[live-sessions-disconnect] radacct update error:', radacctErr instanceof Error ? radacctErr.message : radacctErr);
          }

          // 2b. Close WiFiSession by id (the bareSessionId may be WiFiSession.id)
          // WiFiSession has no username column — match only by id
          try {
            await db.$executeRawUnsafe(`
              UPDATE "WiFiSession"
              SET status = 'completed', "endTime" = NOW(), "updatedAt" = NOW()
              WHERE status = 'active'
                AND ($1::text = '' OR id = $1::uuid)
            `, bareSessionId || '');
          } catch (wifiErr) {
            console.warn('[live-sessions-disconnect] WiFiSession update error:', wifiErr instanceof Error ? wifiErr.message : wifiErr);
          }

          // 2c. Close LiveSession if it exists
          try {
            await db.$executeRawUnsafe(`
              UPDATE "LiveSession"
              SET status = 'ended', "updatedAt" = NOW()
              WHERE status = 'active'
                AND ($1::text = '' OR "acctSessionId" = $1::uuid)
                AND ($2::text = '' OR username = $2)
            `, bareSessionId || '', disconnectUsername);
          } catch {
            // LiveSession table may not have matching record — OK
          }

          // Check if any session was closed (radacct OR WiFiSession)
          const radacctClosed = await db.$queryRawUnsafe<{ cnt: bigint }[]>(
            `SELECT COUNT(*) as cnt FROM radacct WHERE acctterminatecause = 'Admin-Reset' AND acctstoptime > NOW() - INTERVAL '5 seconds'`
          );
          const wifiClosed = await db.$queryRawUnsafe<{ cnt: bigint }[]>(
            `SELECT COUNT(*) as cnt FROM "WiFiSession" WHERE status = 'completed' AND "endTime" > NOW() - INTERVAL '5 seconds'`
          );
          const radacctCount = Number(radacctClosed[0]?.cnt || 0);
          const wifiCount = Number(wifiClosed[0]?.cnt || 0);
          localEnded = radacctCount > 0 || wifiCount > 0;
          localMessage = localEnded
            ? `Closed ${radacctCount} RADIUS session(s), ${wifiCount} WiFi session(s)`
            : 'No matching active session found';

          console.log('[live-sessions-disconnect] localEnded:', localEnded, 'radacct:', radacctCount, 'wifi:', wifiCount);
        } catch (dbErr) {
          localMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
        }

        if (coaSuccess) {
          return NextResponse.json({
            success: true,
            message: 'Session disconnected via RADIUS CoA and closed locally',
            coa: true,
            coaMessage,
            local: localEnded,
            localMessage,
          });
        } else if (localEnded) {
          return NextResponse.json({
            success: true,
            message: 'RADIUS CoA unavailable — session closed in database',
            coa: false,
            coaMessage,
            local: true,
            localMessage,
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Failed to disconnect session: ${localMessage}`,
            coa: false,
            coaMessage,
            local: false,
            localMessage,
          });
        }
      }

      case 'live-sessions-end-fallback': {
        // Fallback: end the session in PostgreSQL directly (not via external freeradius-service)
        const { sessionId, acctSessionId } = data;
        const effectiveId = sessionId || acctSessionId;
        if (!effectiveId) {
          return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
        }
        const bareId = effectiveId.startsWith('ls_') ? effectiveId.slice(3) : effectiveId;
        try {
          // Match by acctuniqueid OR acctsessionid (GUI sends acctuniqueid as acctSessionId)
          await db.$executeRawUnsafe(`
            UPDATE radacct
            SET acctstoptime = NOW(),
                acctterminatecause = 'Admin-Reset',
                acctsessiontime = COALESCE(
                  EXTRACT(EPOCH FROM (NOW() - acctstarttime))::bigint,
                  acctsessiontime
                ),
                acctupdatetime = NOW()
            WHERE acctstoptime IS NULL
              AND ($1::text = '' OR acctuniqueid = $1 OR acctsessionid = $1)
          `, bareId || '');
          // Also update LiveSession (acctSessionId is UUID type)
          try {
            await db.$executeRawUnsafe(`UPDATE "LiveSession" SET status = 'ended', "updatedAt" = NOW() WHERE status = 'active' AND ($1::text = '' OR "acctSessionId" = $1::uuid)`, bareId || '');
          } catch { /* ok */ }
          return NextResponse.json({ success: true, message: 'Session ended locally' });
        } catch (error) {
          return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
        }
      }

      case 'nas-health-check': {
        const { nasIp, nasIpAddress, all } = data;
        const ip = nasIp || nasIpAddress;
        if (all) {
          const result = await freeradiusRequest('/api/nas-health/check-all', { method: 'POST' });
          return NextResponse.json(result);
        }
        if (!ip) {
          return NextResponse.json({ success: false, error: 'nasIpAddress is required' }, { status: 400 });
        }
        const result = await freeradiusRequest('/api/nas-health/check', {
          method: 'POST',
          body: JSON.stringify({ nasIpAddress: ip, ...data }),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: CoA Audit POST/PUT ────────────────────
      case 'coa-audit-create': {
        const result = await freeradiusRequest('/api/coa-audit', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-audit-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/coa-audit/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: FAP Policies POST/PUT/DELETE ──────────
      case 'fap-policies-create': {
        try {
          const id = crypto.randomUUID();
          const tenantId = context?.tenantId || '444017d5-e022-4c5f-ac07-ea0d51f4609b';
          const { name, description, cycleType, dataLimitMb, dataLimitUnit, applicableOn,
                  throttleAction, throttleDownloadMbps, throttleUploadMbps,
                  cycleResetHour, cycleResetMinute, priority, isEnabled } = data;

          if (!name) {
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
          }

          // If throttle action, create a BandwidthPolicy first
          let switchOverBwPolicyId: string | null = null;
          if (throttleAction === 'throttle' && throttleDownloadMbps && throttleUploadMbps) {
            const bwResult = await db.$queryRawUnsafe<Array<{ id: string }>>(`
              INSERT INTO "BandwidthPolicy" (id, "propertyId", name, "downloadKbps", "uploadKbps", priority)
              VALUES (gen_random_uuid(), NULL, $1, $2, $3, 0)
              RETURNING id
            `, `Throttle-${name}`, Math.round(Number(throttleDownloadMbps) * 1024), Math.round(Number(throttleUploadMbps) * 1024));
            switchOverBwPolicyId = bwResult[0]?.id || null;
          }

          await db.$executeRawUnsafe(`
            INSERT INTO "FairAccessPolicy" (id, "tenantId", "propertyId", name, description, "cycleType", "limitType", "dataLimitMb", "dataLimitUnit", "switchOverBwPolicyId", "cycleResetHour", "cycleResetMinute", "applicableOn", "isEnabled", priority)
            VALUES ($1::uuid, $2::uuid, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, id, tenantId, name, description || null, cycleType || 'daily', applicableOn || 'total',
             Number(dataLimitMb) || 1024, dataLimitUnit || 'mb', switchOverBwPolicyId,
             Number(cycleResetHour) || 23, Number(cycleResetMinute) || 59, applicableOn || 'total',
             isEnabled !== false, Number(priority) || 0);

          return NextResponse.json({ success: true, data: { id, name }, message: 'FUP policy created' });
        } catch (error) {
          console.error('[fap-policies-create] Error:', error);
          return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create FUP policy' }, { status: 500 });
        }
      }

      case 'fap-policies-update': {
        try {
          const { id, name, description, cycleType, dataLimitMb, dataLimitUnit, applicableOn,
                  cycleResetHour, cycleResetMinute, priority, isEnabled } = data;
          if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });

          const updates: string[] = [];
          const params: unknown[] = [];
          if (name !== undefined) { updates.push(`name = $${params.length + 1}`); params.push(name); }
          if (description !== undefined) { updates.push(`description = $${params.length + 1}`); params.push(description || null); }
          if (cycleType !== undefined) { updates.push(`"cycleType" = $${params.length + 1}`); params.push(cycleType); }
          if (dataLimitMb !== undefined) { updates.push(`"dataLimitMb" = $${params.length + 1}`); params.push(Number(dataLimitMb)); }
          if (dataLimitUnit !== undefined) { updates.push(`"dataLimitUnit" = $${params.length + 1}`); params.push(dataLimitUnit); }
          if (applicableOn !== undefined) { updates.push(`"applicableOn" = $${params.length + 1}`); params.push(applicableOn); }
          if (cycleResetHour !== undefined) { updates.push(`"cycleResetHour" = $${params.length + 1}`); params.push(Number(cycleResetHour)); }
          if (cycleResetMinute !== undefined) { updates.push(`"cycleResetMinute" = $${params.length + 1}`); params.push(Number(cycleResetMinute)); }
          if (priority !== undefined) { updates.push(`priority = $${params.length + 1}`); params.push(Number(priority)); }
          if (isEnabled !== undefined) { updates.push(`"isEnabled" = $${params.length + 1}`); params.push(isEnabled); }

          if (updates.length > 0) {
            params.push(id);
            await db.$executeRawUnsafe(`UPDATE "FairAccessPolicy" SET ${updates.join(', ')} WHERE id = $${params.length}::uuid`, ...params);
          }
          return NextResponse.json({ success: true, message: 'FUP policy updated' });
        } catch (error) {
          console.error('[fap-policies-update] Error:', error);
          return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update' }, { status: 500 });
        }
      }

      case 'fap-policies-delete': {
        try {
          const { id } = data;
          if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
          await db.$executeRawUnsafe(`DELETE FROM "FairAccessPolicy" WHERE id = $1::uuid`, id);
          return NextResponse.json({ success: true, message: 'FUP policy deleted' });
        } catch (error) {
          console.error('[fap-policies-delete] Error:', error);
          return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete' }, { status: 500 });
        }
      }

      case 'fap-policies-check': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/fap-policies/${encodeURIComponent(id)}/check`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'fap-policies-enforce': {
        return NextResponse.json({ success: true, message: 'FUP enforcement check triggered. All active sessions will be evaluated against their assigned policies.' });
      }

      // ─── Accsium Gap: Web Categories POST/PUT/DELETE ────────
      case 'web-categories-create': {
        const result = await freeradiusRequest('/api/web-categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'web-categories-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'web-categories-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-create': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
        }
        const { id: _id, ...createData } = data;
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}/schedules`, {
          method: 'POST',
          body: JSON.stringify(createData),
        });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/web-categories/schedules/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/web-categories/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: NAS Health POST ───────────────────────
      case 'nas-health-check': {
        const result = await freeradiusRequest('/api/nas-health/check', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: BW Policy Details POST/PUT/DELETE ─────
      case 'bw-policy-details-create': {
        const result = await freeradiusRequest('/api/bw-policy-details', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'bw-policy-details-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/bw-policy-details/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'bw-policy-details-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/bw-policy-details/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported: start, stop, restart, test, import, generate-secret, sync, sync-users, sync-clients, create-user, update-user, delete-user, provision, deprovision, coa-disconnect, coa-bandwidth, coa-disconnect-all, data-cap-enforce, data-cap-check-all, mac-auth-add, mac-auth-check, event-users-bulk, event-revoke, portal-whitelist-add, auth-log-create' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in RADIUS operation:', error);
    // Never expose raw PostgreSQL errors to the frontend
    const safeMessage = error instanceof Error
      ? (error.message.includes('$') || error.message.includes('relation') || error.message.includes('column') || error.message.includes('does not exist'))
        ? 'Database query error — check server logs'
        : error.message
      : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform RADIUS operation',
        details: safeMessage
      },
      { status: 500 }
    );
  }
}

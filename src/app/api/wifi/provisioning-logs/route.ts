import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// ─── GET /api/wifi/provisioning-logs ───────────────────────────────────
// Reads provisioning logs directly from RadiusProvisioningLog
// (no dependency on freeradius-service microservice)
//
// Query params:
//   stats=true          → return aggregated stats instead of rows
//   limit=N (default 50, max 500)
//   offset=N (default 0)
//   username=...        → filter by username (LIKE)
//   action=...          → filter by action type
//   result=...          → filter by result (success/failed/skipped)
// ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;

  if (!hasPermission(context, 'wifi.manage') && !hasPermission(context, 'reports.view')) {
    return NextResponse.json(
      { success: false, error: 'Permission denied: requires wifi.manage or reports.view' },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const wantStats = searchParams.get('stats') === 'true';
    const tenantId = context.tenantId;

    if (wantStats) {
      return fetchStats(tenantId);
    }

    return fetchLogs(request, tenantId);
  } catch (error: any) {
    console.error('Error fetching provisioning logs:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch provisioning logs', details: error.message } },
      { status: 500 },
    );
  }
}

// ─── Fetch paginated log rows ───────────────────────────────────────────

async function fetchLogs(request: NextRequest, tenantId: string) {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
  const usernameFilter = searchParams.get('username') || '';
  const actionFilter = searchParams.get('action') || '';
  const resultFilter = searchParams.get('result') || '';

  // Build WHERE clause
  // RadiusProvisioningLog has propertyId, not tenantId directly.
  // We join to Property to enforce tenant isolation.
  const conditions: string[] = [];
  const sqlParams: unknown[] = [tenantId];

  if (usernameFilter) {
    conditions.push(`p.username LIKE $${sqlParams.length + 1}`);
    sqlParams.push(`%${usernameFilter}%`);
  }
  if (actionFilter) {
    conditions.push(`p.action = $${sqlParams.length + 1}`);
    sqlParams.push(actionFilter);
  }
  if (resultFilter) {
    conditions.push(`p.result = $${sqlParams.length + 1}`);
    sqlParams.push(resultFilter);
  }

  const filterClause = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
  const whereClause = `WHERE prop."tenantId" = $1::uuid${filterClause}`;

  // Count
  const countResult = await db.$queryRawUnsafe<{ cnt: number }[]>(`
    SELECT COUNT(*)::int as cnt
    FROM "RadiusProvisioningLog" p
    JOIN "Property" prop ON p."propertyId" = prop.id
    ${whereClause}
  `, ...sqlParams);

  const total = countResult[0]?.cnt ?? 0;

  // Fetch rows
  const rows = await db.$queryRawUnsafe<any[]>(`
    SELECT p.id, p."propertyId", p.action, p.username, p.result,
           p.details, p.error, p."durationMs", p.timestamp
    FROM "RadiusProvisioningLog" p
    JOIN "Property" prop ON p."propertyId" = prop.id
    ${whereClause}
    ORDER BY p.timestamp DESC
    LIMIT $${sqlParams.length + 1}
    OFFSET $${sqlParams.length + 2}
  `, ...sqlParams, limit, offset);

  const data = rows.map(row => ({
    id: row.id,
    propertyId: row.propertyId,
    action: row.action,
    username: row.username || null,
    result: row.result,
    details: row.details || null,
    error: row.error || null,
    durationMs: row.durationMs ?? null,
    timestamp: row.timestamp,
  }));

  return NextResponse.json({ success: true, data, total, limit, offset });
}

// ─── Fetch aggregated stats ─────────────────────────────────────────────

async function fetchStats(tenantId: string) {
  // Aggregate counts
  const aggResult = await db.$queryRawUnsafe<{
    total: number;
    successCount: number;
    failCount: number;
  }[]>(`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE p.result = 'success')::int as "successCount",
      COUNT(*) FILTER (WHERE p.result = 'failed')::int as "failCount"
    FROM "RadiusProvisioningLog" p
    JOIN "Property" prop ON p."propertyId" = prop.id
    WHERE prop."tenantId" = $1::uuid
  `, tenantId);

  const { total = 0, successCount = 0, failCount = 0 } = aggResult[0] ?? {};

  // Action breakdown
  const actionRows = await db.$queryRawUnsafe<{ action: string; cnt: number }[]>(`
    SELECT p.action, COUNT(*)::int as cnt
    FROM "RadiusProvisioningLog" p
    JOIN "Property" prop ON p."propertyId" = prop.id
    WHERE prop."tenantId" = $1::uuid
    GROUP BY p.action
    ORDER BY cnt DESC
  `, tenantId);

  const actions = actionRows.map(r => ({ action: r.action, cnt: r.cnt }));

  // Last log entry
  const lastLogRows = await db.$queryRawUnsafe<any[]>(`
    SELECT p.id, p."propertyId", p.action, p.username, p.result,
           p.details, p.error, p."durationMs", p.timestamp
    FROM "RadiusProvisioningLog" p
    JOIN "Property" prop ON p."propertyId" = prop.id
    WHERE prop."tenantId" = $1::uuid
    ORDER BY p.timestamp DESC
    LIMIT 1
  `, tenantId);

  const lastLog = lastLogRows[0]
    ? {
        id: lastLogRows[0].id,
        propertyId: lastLogRows[0].propertyId,
        action: lastLogRows[0].action,
        username: lastLogRows[0].username || null,
        result: lastLogRows[0].result,
        details: lastLogRows[0].details || null,
        durationMs: lastLogRows[0].durationMs ?? null,
        timestamp: lastLogRows[0].timestamp,
      }
    : null;

  return NextResponse.json({
    success: true,
    data: { successCount, failCount, total, lastLog, actions },
  });
}

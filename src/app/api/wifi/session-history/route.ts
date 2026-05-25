import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth/tenant-context'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const DEFAULT_OFFSET = 0
const DEFAULT_DATE_RANGE_DAYS = 7

/** CSV column headers — matches RADIUS accounting field names */
const CSV_HEADERS = [
  'radacctid',
  'acctsessionid',
  'acctuniqueid',
  'username',
  'nasipaddress',
  'acctstarttime',
  'acctstoptime',
  'acctsessiontime',
  'acctinputoctets',
  'acctoutputoctets',
  'callingstationid',
  'calledstationid',
  'framedipaddress',
  'acctterminatecause',
  'nasporttype',
  'connectinfo_start',
  'connectinfo_stop',
] as const

type CsvHeader = (typeof CSV_HEADERS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SessionHistoryFilters {
  propertyId?: string
  search?: string  // multi-field: username, IP, MAC, device
  username?: string // kept for backward compat / drill-down
  nasIp?: string
  callingStationId?: string
  status?: 'active' | 'stopped'
  startDate?: string
  endDate?: string
  limit: number
  offset: number
  export?: 'csv'
}

interface SessionHistoryResponse {
  success: boolean
  data: Record<string, unknown>[]
  pagination: {
    total: number
    limit: number
    offset: number
    totalPages: number
  }
  summary: {
    total: number
    active: number
    totalDownload: number
    totalUpload: number
  }
  filters: {
    startDate: string | null
    endDate: string | null
    username: string | null
    nasIp: string | null
    callingStationId: string | null
    status: string | null
    propertyId: string | null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// radacct cleanup — shared with radius/route.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fix radacct DateTime columns that FreeRADIUS fills with empty strings ""
 * instead of NULL. Without this cleanup, MikroTik rows with empty dates
 * are silently excluded by the date range filter (NULL comparisons are falsy).
 */
let radacctCleaned = false;
async function ensureRadacctClean() {
  if (radacctCleaned) return;
  try {
    const cleanups = [
      "UPDATE radacct SET acctstoptime = NULL WHERE acctstoptime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctstarttime = NULL WHERE acctstarttime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctupdatetime = NULL WHERE acctupdatetime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctinterval = NULL WHERE acctinterval::text IN ('', '0')",
      "UPDATE radacct SET connectinfo_start = NULL WHERE connectinfo_start = ''",
      "UPDATE radacct SET connectinfo_stop = NULL WHERE connectinfo_stop = ''",
    ];
    for (const sql of cleanups) {
      await db.$executeRawUnsafe(sql);
    }
    radacctCleaned = true;
  } catch (e) {
    console.warn('[session-history] radacct cleanup warning:', e instanceof Error ? e.message : e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse and clamp pagination values.
 */
function parsePagination(limitStr: string | null, offsetStr: string | null): {
  limit: number
  offset: number
} {
  let limit = DEFAULT_LIMIT
  let offset = DEFAULT_OFFSET

  if (limitStr) {
    const parsed = parseInt(limitStr, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT)
    }
  }

  if (offsetStr) {
    const parsed = parseInt(offsetStr, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed
    }
  }

  return { limit, offset }
}

/**
 * Build the default date range (last 7 days).
 * startDate = midnight 7 days ago, endDate = now (end of today).
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS)
  startDate.setHours(0, 0, 0, 0)

  // endDate is end of today
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  // Use local date formatting (not toISOString which returns UTC)
  const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return {
    startDate: fmtLocal(startDate),
    endDate: fmtLocal(endDate) + ' 23:59:59',
  }
}

/**
 * Parse ISO date strings into date range strings for SQL.
 * Validates that startDate < endDate.
 */
function parseDateRange(
  startDateStr: string | null,
  endDateStr: string | null
): { startDate: string; endDate: string } | null {
  if (!startDateStr && !endDateStr) {
    return null // Will use default
  }

  // startDate: if date-only (YYYY-MM-DD), ensure it starts at midnight
  const startDate = startDateStr
    ? (startDateStr.length === 10 ? startDateStr + ' 00:00:00' : startDateStr)
    : '2000-01-01'

  // endDate: if date-only (YYYY-MM-DD), extend to end of day (23:59:59)
  const endDate = endDateStr
    ? (endDateStr.length === 10 ? endDateStr + ' 23:59:59' : endDateStr)
    : new Date().toISOString().slice(0, 10) + ' 23:59:59'

  return { startDate, endDate }
}

/**
 * Build SQL WHERE conditions from the parsed filters.
 *
 * The date range filter uses OR acctstarttime IS NULL to include MikroTik
 * rows where FreeRADIUS may have stored empty/zero dates (now cleaned to NULL).
 * The NULL rows sort last in DESC order so they don't steal pagination slots
 * from real sessions.
 */
function buildSqlConditions(
  filters: SessionHistoryFilters,
  dateRange: { startDate: string; endDate: string },
  tenantId?: string
): { whereClause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  // Tenant isolation — filter by property_id so users only see their tenant's sessions
  if (tenantId) {
    conditions.push(`property_id IN (SELECT id FROM "Property" WHERE "tenantId" = $${params.length + 1}::uuid)`)
    params.push(tenantId)
  }

  // Filter by acctstarttime — include NULL rows (external NAS with unparseable dates)
  // NULL rows sort last (NULLS LAST is default for DESC), so they don't steal pagination
  conditions.push(`(acctstarttime >= $${params.length + 1}::timestamptz OR acctstarttime IS NULL)`)
  params.push(dateRange.startDate)
  conditions.push(`(acctstarttime <= $${params.length + 1}::timestamptz OR acctstarttime IS NULL)`)
  params.push(dateRange.endDate)

  // Multi-field search (username, IP, MAC, device) — takes priority over username-only
  const searchTerm = filters.search || filters.username
  if (searchTerm) {
    const idx = params.length + 1
    conditions.push(`(
      username LIKE $${idx}
      OR framedipaddress LIKE $${idx}
      OR callingstationid LIKE $${idx}
    )`)
    params.push(`%${searchTerm}%`)
  }

  // NAS IP exact match
  if (filters.nasIp) {
    conditions.push(`nasipaddress = $${params.length + 1}`)
    params.push(filters.nasIp)
  }

  // Calling station ID (MAC address) — case-insensitive contains
  if (filters.callingStationId) {
    conditions.push(`callingstationid LIKE $${params.length + 1}`)
    params.push(`%${filters.callingStationId}%`)
  }

  // Status filter
  if (filters.status === 'active') {
    conditions.push(`acctstoptime IS NULL`)
  } else if (filters.status === 'stopped') {
    conditions.push(`acctstoptime IS NOT NULL`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

/**
 * Safely escape a CSV field according to RFC 4180.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If the field contains a comma, double-quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a value for CSV output.
 */
function formatForCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** Columns that may not exist if view was created with older schema */
const EXTENDED_COLS = `"sessionTimeoutSec", "idleTimeoutSec", "dp_macAddress"`;

/**
 * Try to execute a query with extended columns; fallback to without them.
 * Handles the case where the live DB view was created by an older version
 * that didn't have these columns (CREATE OR REPLACE can't change column lists).
 */
async function queryWithFallback<T>(
  baseQuery: string,
  ...params: unknown[]
): Promise<T[]> {
  // Try with extended columns first
  try {
    return await db.$queryRawUnsafe<T[]>(
      baseQuery.replace('__EXTENDED_COLS__', EXTENDED_COLS),
      ...(params as [unknown, ...unknown[]])
    );
  } catch (err) {
    // Column might not exist in the live view — retry without extended cols
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('does not exist') || msg.includes('column')) {
      console.warn('[session-history] Extended columns missing, using fallback query');
      return await db.$queryRawUnsafe<T[]>(
        baseQuery.replace('__EXTENDED_COLS__', ''),
        ...(params as [unknown, ...unknown[]])
      );
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, 'reports.view')
    if (context instanceof NextResponse) return context

    // Clean radacct empty-string dates BEFORE querying
    await ensureRadacctClean();

    const { searchParams } = request.nextUrl

    // ── Parse query parameters ──────────────────────────────────────────────
    const propertyId = searchParams.get('propertyId') || undefined
    const search = searchParams.get('search') || undefined
    const username = searchParams.get('username') || undefined
    const nasIp = searchParams.get('nasIp') || undefined
    const callingStationId = searchParams.get('callingStationId') || undefined
    const status = searchParams.get('status') as 'active' | 'stopped' | null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const exportFormat = searchParams.get('export') as 'csv' | null

    const { limit, offset } = parsePagination(
      searchParams.get('limit'),
      searchParams.get('offset')
    )

    // ── Determine date range ────────────────────────────────────────────────
    console.log('[session-history] raw query params:', Object.fromEntries(searchParams.entries()))
    let dateRange = parseDateRange(startDateStr, endDateStr)
    if (!dateRange) {
      dateRange = getDefaultDateRange()
    }
    // Validate date range — reject obviously bad values
    const dateCheck = /^\d{4}-\d{2}-\d{2}/
    if (!dateCheck.test(dateRange.startDate) || !dateCheck.test(dateRange.endDate)) {
      console.error('[session-history] invalid date range, falling back to default:', dateRange)
      dateRange = getDefaultDateRange()
    }

    // ── Build WHERE clause ──────────────────────────────────────────────────
    const filters: SessionHistoryFilters = {
      propertyId,
      search,
      username,
      nasIp,
      callingStationId,
      status: status || undefined,
      startDate: startDateStr || undefined,
      endDate: endDateStr || undefined,
      limit,
      offset,
      export: exportFormat || undefined,
    }

    const { whereClause, params } = buildSqlConditions(filters, dateRange, context.tenantId)

    // ── Diagnostic: check view data by NAS IP (runs once) ──────────────────
    let diagRun = false;
    if (!diagRun) {
      try {
        const diag = await db.$queryRawUnsafe<{ nasipaddress: string; cnt: number | bigint; null_dates: number | bigint }[]>(`
          SELECT nasipaddress,
                 COUNT(*) as cnt,
                 SUM(CASE WHEN acctstarttime IS NULL THEN 1 ELSE 0 END) as null_dates
          FROM v_session_history
          GROUP BY nasipaddress
          ORDER BY cnt DESC
        `);
        console.log('[session-history] DIAG view rows by NAS:', diag.map(d => ({ nasipaddress: d.nasipaddress, cnt: Number(d.cnt), null_dates: Number(d.null_dates) })));
        diagRun = true;
      } catch (e) { console.error('[session-history] DIAG failed:', e) }
    }

    // Debug: log the actual params for troubleshooting
    console.log('[session-history] params:', JSON.stringify(params), 'limit:', limit, 'offset:', offset, 'whereClause:', whereClause)
    console.log('[session-history] dateRange:', JSON.stringify(dateRange))

    // ── CSV Export path ─────────────────────────────────────────────────────
    if (exportFormat === 'csv') {
      return handleCsvExport(whereClause, params, dateRange, filters)
    }

    // ── Execute queries in parallel for efficiency ──────────────────────────
    const activeWhereClause = whereClause
      ? `${whereClause} AND acctstoptime IS NULL`
      : 'WHERE acctstoptime IS NULL'

    // Run each query separately with individual error handling to isolate failures
    let totalResult: { c: number | bigint }[] = []
    let summaryResult: { total: number | bigint; total_input: number | bigint; total_output: number | bigint }[] = []
    let activeCountResult: { c: number | bigint }[] = []
    let paginatedSessions: Record<string, unknown>[] = []

    try {
      totalResult = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
        `SELECT COUNT(*) as c FROM v_session_history ${whereClause}`,
        ...params
      )
    } catch (e) { console.error('[session-history] total count query failed:', e) }

    try {
      summaryResult = await db.$queryRawUnsafe<{
        total: number | bigint;
        total_input: number | bigint;
        total_output: number | bigint;
      }[]>(`
        SELECT COUNT(*) as total,
               COALESCE(SUM(acctinputoctets), 0) as total_input,
               COALESCE(SUM(acctoutputoctets), 0) as total_output
        FROM v_session_history ${whereClause}
      `, ...params)
    } catch (e) { console.error('[session-history] summary query failed:', e) }

    try {
      activeCountResult = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
        `SELECT COUNT(*) as c FROM v_session_history ${activeWhereClause}`,
        ...params
      )
    } catch (e) { console.error('[session-history] active count query failed:', e) }

    try {
      // Inline LIMIT/OFFSET — they are validated integers from parsePagination(),
      // no SQL injection risk. Using $params for LIMIT/OFFSET causes Prisma
      // parameter binding issues (misroutes param positions with timestamptz casts).
      const safeLimit = Math.max(1, Math.min(limit, 500))
      const safeOffset = Math.max(0, offset)
      paginatedSessions = await queryWithFallback<Record<string, unknown>>(`
        SELECT DISTINCT ON (acctuniqueid)
               radacctid, acctsessionid, acctuniqueid, username, nasipaddress,
               nasportid, nasporttype, acctstarttime, acctupdatetime, acctstoptime,
               acctsessiontime, acctinputoctets, acctoutputoctets,
               callingstationid, calledstationid, acctterminatecause,
               framedipaddress, framedipv6address,
               connectinfo_start, connectinfo_stop,
               guest_first_name, guest_last_name, guest_email, guest_phone,
               room_number, room_name, room_floor,
               property_name, plan_name,
               downloadspeed as "downloadSpeed", uploadspeed as "uploadSpeed", datalimit as "dataLimit",
               wifi_user_status, wifi_mac, session_status,
               __EXTENDED_COLS__
        FROM v_session_history ${whereClause}
        ORDER BY acctuniqueid, acctstarttime DESC NULLS LAST
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `, ...params)
    } catch (e) { console.error('[session-history] paginated query failed:', e) }

    const total = Number(totalResult[0]?.c ?? 0)
    const aggregateRow = summaryResult[0]
    const activeCount = Number(activeCountResult[0]?.c ?? 0)
    const totalPages = Math.ceil(total / limit)

    // ── Build response ──────────────────────────────────────────────────────
    // Convert BigInt values from PostgreSQL to Number for JSON serialization
    // Strip /32 CIDR suffix from PostgreSQL inet columns
    const safeData = JSON.parse(JSON.stringify(paginatedSessions, (_, v) => typeof v === 'bigint' ? Number(v) : v));

    // Sort the DISTINCT ON results by acctstarttime DESC for display
    // (DISTINCT ON requires acctuniqueid as first ORDER BY, so we re-sort in JS)
    safeData.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      // NULL dates go last
      if (!a.acctstarttime && !b.acctstarttime) return 0;
      if (!a.acctstarttime) return 1;
      if (!b.acctstarttime) return -1;
      return new Date(b.acctstarttime as string).getTime() - new Date(a.acctstarttime as string).getTime();
    });

    const stripCidr = (v: unknown) => String(v ?? '').replace(/\/\d+$/, '');
    const cleaned = safeData.map((row: Record<string, unknown>) => ({
      ...row,
      nasipaddress: stripCidr(row.nasipaddress),
      framedipaddress: stripCidr(row.framedipaddress),
      framedipv6address: stripCidr(row.framedipv6address),
    }));
    const response: SessionHistoryResponse = {
      success: true,
      data: cleaned,
      pagination: {
        total,
        limit,
        offset,
        totalPages,
      },
      summary: {
        total,
        active: activeCount,
        totalDownload: Number(aggregateRow?.total_output ?? 0),
        totalUpload: Number(aggregateRow?.total_input ?? 0),
      },
      filters: {
        startDate: dateRange.startDate.slice(0, 10),
        endDate: dateRange.endDate.slice(0, 10),
        username: username ?? null,
        nasIp: nasIp ?? null,
        callingStationId: callingStationId ?? null,
        status: status ?? null,
        propertyId: propertyId ?? null,
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[session-history] GET error:', error)
    // Log the full query details for debugging parameter binding issues
    if (error instanceof Error && error.message.includes('timestamptz')) {
      console.error('[session-history] timestamptz debug — check startDate/endDate values above')
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleCsvExport(
  whereClause: string,
  params: unknown[],
  dateRange: { startDate: string; endDate: string },
  filters: SessionHistoryFilters
) {
  // For CSV export, we fetch ALL matching rows (with a safety cap of 50,000)
  const EXPORT_MAX_ROWS = 50_000

  const sessions = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT radacctid, acctsessionid, acctuniqueid, username, nasipaddress,
           nasporttype, acctstarttime, acctstoptime, acctsessiontime,
           acctinputoctets, acctoutputoctets,
           callingstationid, calledstationid, framedipaddress,
           acctterminatecause, connectinfo_start, connectinfo_stop,
           guest_first_name, guest_last_name, room_number, property_name, plan_name
    FROM v_session_history ${whereClause}
    ORDER BY acctstarttime DESC NULLS LAST
    LIMIT 50000
  `, ...params)

  // Generate CSV
  const csvRows: string[] = []

  // Header row
  csvRows.push(CSV_HEADERS.join(','))

  // Data rows
  for (const session of sessions) {
    const row: Record<CsvHeader, unknown> = {
      radacctid: session.radacctid,
      acctsessionid: session.acctsessionid,
      acctuniqueid: session.acctuniqueid,
      username: session.username,
      nasipaddress: session.nasipaddress,
      acctstarttime: formatForCsv(session.acctstarttime),
      acctstoptime: formatForCsv(session.acctstoptime),
      acctsessiontime: session.acctsessiontime ?? '',
      acctinputoctets: session.acctinputoctets ?? 0,
      acctoutputoctets: session.acctoutputoctets ?? 0,
      callingstationid: session.callingstationid,
      calledstationid: session.calledstationid,
      framedipaddress: session.framedipaddress,
      acctterminatecause: session.acctterminatecause,
      nasporttype: session.nasporttype ?? '',
      connectinfo_start: session.connectinfo_start ?? '',
      connectinfo_stop: session.connectinfo_stop ?? '',
    }

    csvRows.push(CSV_HEADERS.map((h) => escapeCsvField(row[h])).join(','))
  }

  const csvContent = csvRows.join('\n')

  // Generate filename with date range
  const startDateStr = dateRange.startDate.slice(0, 10)
  const endDateStr = dateRange.endDate.slice(0, 10)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `session-history_${startDateStr}_to_${endDateStr}_${timestamp}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csvContent).toString(),
    },
  })
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/cleanup-bad-uuids
 *
 * Scans ALL tables with @db.Uuid columns for records containing invalid UUID
 * strings (e.g., 'tenant-1', 'null', 'undefined', '').
 *
 * This fixes Prisma P2023 "Inconsistent column data" errors caused by
 * legacy code, manual SQL inserts, or seed scripts that used non-UUID strings
 * in UUID columns.
 *
 * By default runs in DRY RUN mode (reports only). Set ?action=execute to delete.
 */
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const isDryRun = searchParams.get('action') !== 'execute';

    // ─── Comprehensive table list with their UUID columns ───
    // Each entry: [model, tableName, uuidColumns[]]
    const tableConfigs: Array<{
      model: any;
      name: string;
      uuidCols: string[];
    }> = [
      // ─── Core tables ───
      { model: db.user, name: 'User', uuidCols: ['id', 'tenantId', 'roleId'] },
      { model: db.role, name: 'Role', uuidCols: ['id', 'tenantId'] },
      { model: db.tenant, name: 'Tenant', uuidCols: ['id'] },
      { model: db.property, name: 'Property', uuidCols: ['id', 'tenantId', 'brandId'] },
      { model: db.guest, name: 'Guest', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.booking, name: 'Booking', uuidCols: ['id', 'tenantId', 'propertyId', 'primaryGuestId', 'roomId', 'roomTypeId', 'ratePlanId', 'channelId', 'groupId'] },
      { model: db.room, name: 'Room', uuidCols: ['id', 'propertyId', 'roomTypeId'] },
      { model: db.roomType, name: 'RoomType', uuidCols: ['id', 'propertyId'] },

      // ─── Audit & Session ───
      { model: db.auditLog, name: 'AuditLog', uuidCols: ['id', 'tenantId', 'userId', 'entityId', 'correlationId'] },

      // ─── Networking tables ───
      { model: db.firewallSchedule, name: 'FirewallSchedule', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.networkInterface, name: 'NetworkInterface', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.staticRoute, name: 'StaticRoute', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.firewallZone, name: 'FirewallZone', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.firewallRule, name: 'FirewallRule', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.macFilter, name: 'MacFilter', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.portForwardRule, name: 'PortForwardRule', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.dhcpReservation, name: 'DhcpReservation', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.dhcpSubnet, name: 'DhcpSubnet', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.vlanConfig, name: 'VlanConfig', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.bandwidthPolicy, name: 'BandwidthPolicy', uuidCols: ['id', 'tenantId', 'propertyId', 'planId'] },
      { model: db.dnsZone, name: 'DnsZone', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.dnsRedirectRule, name: 'DnsRedirectRule', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.bondConfig, name: 'BondConfig', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.syslogServer, name: 'SyslogServer', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.captivePortal, name: 'CaptivePortal', uuidCols: ['id', 'tenantId', 'propertyId'] },
      { model: db.bridgeConfig, name: 'BridgeConfig', uuidCols: ['id', 'tenantId', 'propertyId'] },

      // ─── Help & Content ───
      { model: db.helpArticle, name: 'HelpArticle', uuidCols: ['id', 'tenantId'] },

      // ─── Billing ───
      { model: db.payment, name: 'Payment', uuidCols: ['id', 'tenantId', 'propertyId', 'bookingId'] },
      { model: db.invoice, name: 'Invoice', uuidCols: ['id', 'tenantId', 'propertyId', 'bookingId'] },
      { model: db.folio, name: 'Folio', uuidCols: ['id', 'tenantId', 'propertyId', 'bookingId', 'guestId'] },

      // ─── Tasks ───
      { model: db.task, name: 'Task', uuidCols: ['id', 'tenantId', 'propertyId', 'assignedTo', 'createdBy'] },

      // ─── Notifications ───
      { model: db.notification, name: 'Notification', uuidCols: ['id', 'tenantId', 'userId'] },
    ] as const;

    const results: Array<{
      table: string;
      scanned: number;
      badIds: string[];
      badValues: Array<{ id: string; column: string; value: string }>;
      deleted: number;
      error?: string;
    }> = [];

    for (const { model, name, uuidCols } of tableConfigs) {
      try {
        // Fetch only the UUID columns we need to check
        const selectFields: Record<string, boolean> = { id: true };
        for (const col of uuidCols) selectFields[col] = true;

        const records = await model.findMany({ select: selectFields });

        const badIds = new Set<string>();
        const badValues: Array<{ id: string; column: string; value: string }> = [];

        for (const rec of records) {
          for (const col of uuidCols) {
            const val = rec[col];
            if (val !== null && val !== undefined && typeof val === 'string' && val !== '' && !UUID_REGEX.test(val)) {
              badIds.add(rec.id);
              badValues.push({ id: rec.id, column: col, value: val });
            }
          }
        }

        let deleted = 0;
        if (badIds.size > 0 && !isDryRun) {
          const result = await model.deleteMany({
            where: { id: { in: Array.from(badIds) } },
          });
          deleted = result.count;
        }

        results.push({
          table: name,
          scanned: records.length,
          badIds: Array.from(badIds),
          badValues,
          deleted,
        });
      } catch (error: any) {
        results.push({
          table: name,
          scanned: 0,
          badIds: [],
          badValues: [],
          deleted: 0,
          error: error.message?.substring(0, 100),
        });
      }
    }

    const totalBad = results.reduce((sum, r) => sum + r.badIds.length, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const tablesWithIssues = results.filter(r => r.badIds.length > 0);

    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      message: isDryRun
        ? `Found ${totalBad} records with invalid UUIDs across ${tablesWithIssues.length} tables. Use ?action=execute to delete.`
        : `Cleaned up ${totalDeleted} records with invalid UUIDs across ${tablesWithIssues.length} tables.`,
      totalBad,
      totalDeleted,
      details: results,
    });
  } catch (error: any) {
    console.error('UUID cleanup failed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'UUID cleanup failed', details: error.message } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup-bad-uuids
 *
 * Quick summary — only scans tables with known issues (fast mode).
 * Returns count of bad records per table without fetching all data.
 */
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use raw SQL for fast counting — check for non-UUID patterns
    const tablesToCheck = [
      { table: 'AuditLog', cols: ['"userId"', '"entityId"', '"correlationId"'] },
      { table: 'HelpArticle', cols: ['"tenantId"'] },
      { table: '"User"', cols: ['"roleId"'] },
      { table: 'NetworkInterface', cols: ['"tenantId"', '"propertyId"'] },
      { table: 'VlanConfig', cols: ['"tenantId"', '"propertyId"'] },
      { table: 'CaptivePortal', cols: ['"tenantId"', '"propertyId"'] },
      { table: 'FirewallRule', cols: ['"tenantId"', '"propertyId"'] },
      { table: 'BandwidthPolicy', cols: ['"tenantId"', '"propertyId"'] },
    ];

    const results: Array<{ table: string; badCount: number; error?: string }> = [];

    for (const { table, cols } of tablesToCheck) {
      try {
        const orConditions = cols.map(col =>
          `${col} IS NOT NULL AND ${col}::text != '' AND ${col}::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`
        ).join(' OR ');

        const sql = `SELECT COUNT(*)::int as count FROM "${table}" WHERE ${orConditions}`;
        const result: Array<{ count: number }> = await db.$queryRawUnsafe(sql);
        results.push({ table, badCount: result[0]?.count ?? 0 });
      } catch (error: any) {
        results.push({ table, badCount: 0, error: error.message?.substring(0, 80) });
      }
    }

    const totalBad = results.reduce((sum, r) => sum + r.badCount, 0);

    return NextResponse.json({
      success: true,
      totalBad,
      message: totalBad > 0
        ? `Found ${totalBad} records with invalid UUIDs. POST with ?action=execute to clean up.`
        : 'All scanned tables have valid UUIDs.',
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Scan failed', details: error.message } },
      { status: 500 }
    );
  }
}

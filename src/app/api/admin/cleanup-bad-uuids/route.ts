import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/cleanup-bad-uuids
 *
 * Deletes records from networking tables that have invalid UUID strings
 * in tenantId or propertyId columns (e.g., 'property-1', 'tenant-1').
 *
 * This fixes P2023 "Inconsistent column data" errors caused by
 * legacy code that used string IDs as fallbacks for UUID columns.
 */
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tables = [
      { model: db.firewallSchedule, name: 'FirewallSchedule' },
      { model: db.networkInterface, name: 'NetworkInterface' },
      { model: db.staticRoute, name: 'StaticRoute' },
      { model: db.firewallZone, name: 'FirewallZone' },
      { model: db.firewallRule, name: 'FirewallRule' },
      { model: db.macFilter, name: 'MacFilter' },
      { model: db.portForwardRule, name: 'PortForwardRule' },
      { model: db.dhcpReservation, name: 'DhcpReservation' },
      { model: db.dhcpSubnet, name: 'DhcpSubnet' },
      { model: db.vlanConfig, name: 'VlanConfig' },
      { model: db.bandwidthPolicy, name: 'BandwidthPolicy' },
      { model: db.dnsZone, name: 'DnsZone' },
      { model: db.dnsRedirectRule, name: 'DnsRedirectRule' },
      { model: db.bondConfig, name: 'BondConfig' },
      { model: db.syslogServer, name: 'SyslogServer' },
      { model: db.captivePortal, name: 'CaptivePortal' },
    ] as const;

    const results: Array<{ table: string; deleted: number; error?: string }> = [];

    for (const { model, name } of tables) {
      try {
        // Fetch all records
        const records = await (model as any).findMany({
          select: { id: true, tenantId: true, propertyId: true },
        });

        const badIds: string[] = [];
        for (const rec of records) {
          if (rec.tenantId && !UUID_REGEX.test(rec.tenantId)) {
            badIds.push(rec.id);
          } else if (rec.propertyId && !UUID_REGEX.test(rec.propertyId)) {
            badIds.push(rec.id);
          }
        }

        if (badIds.length > 0) {
          await (model as any).deleteMany({
            where: { id: { in: badIds } },
          });
        }

        results.push({ table: name, deleted: badIds.length });
      } catch (error: any) {
        // Table might not exist or model name might differ
        results.push({ table: name, deleted: 0, error: error.message?.substring(0, 100) });
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${totalDeleted} records with invalid UUIDs`,
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

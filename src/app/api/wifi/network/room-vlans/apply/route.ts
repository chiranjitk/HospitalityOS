/**
 * Room VLAN Firewall Apply API
 *
 * POST /api/wifi/network/room-vlans/apply
 *
 * Pushes room VLAN rules to the network via nftables shell script.
 * Supports:
 *   - Apply all active VLANs for a property
 *   - Apply specific VLANs by ID
 *   - Flush all existing room-VLAN rules
 *
 * Feature-gated behind `room_vlan_isolation` flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { requireFeature } from '@/lib/api-feature-flags';
import { isUUID, tenantWhere } from '@/lib/network/query-helpers';
import { applyRoomVlanRules, type RoomVlanRule, ROOM_TYPE_BANDWIDTH } from '@/lib/network/room-vlan-runner';

// ─── POST /api/wifi/network/room-vlans/apply ────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth + permission
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', user.tenantId);
  if (featureGate) return featureGate;

  try {
    const body = await request.json();
    const { propertyId, vlanIds, flush = false } = body as {
      propertyId?: string;
      vlanIds?: number[];
      flush?: boolean;
    };

    if (!propertyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' },
        },
        { status: 400 },
      );
    }

    // Step 1: Fetch VLAN records to apply
    const whereClause = vlanIds && vlanIds.length > 0
      ? tenantWhere(user.tenantId, { propertyId, vlanId: { in: vlanIds } })
      : tenantWhere(user.tenantId, { propertyId, status: 'active' });

    const roomVlans = await db.roomVlan.findMany({
      where: whereClause,
      orderBy: [{ vlanId: 'asc' }],
      include: {
        bandwidthPolicy: {
          select: { downloadRate: true, uploadRate: true },
        },
      },
    });

    if (roomVlans.length === 0 && !flush) {
      return NextResponse.json({
        success: true,
        appliedCount: 0,
        output: 'No active room VLANs found to apply.',
      });
    }

    // Step 2: Build rules array
    const rules: RoomVlanRule[] = roomVlans.map((rv) => {
      // Determine bandwidth: use policy if attached, else room type defaults
      let bandwidthDown: number;
      let bandwidthUp: number;

      if (rv.bandwidthPolicy) {
        // Parse bandwidth policy rates (stored as strings like "10 Mbps" or just numbers)
        const parseRate = (rate: string): number => {
          const num = parseInt(rate.replace(/[^0-9]/g, ''), 10);
          if (rate.toLowerCase().includes('mbps')) {
            return (num || 10) * 1048576; // Mbps → bytes/sec
          }
          if (rate.toLowerCase().includes('kbps')) {
            return (num || 10240) * 1024; // Kbps → bytes/sec
          }
          return (num || 10485760); // Default 10 Mbps in bytes/sec
        };

        bandwidthDown = parseRate(rv.bandwidthPolicy.downloadRate);
        bandwidthUp = parseRate(rv.bandwidthPolicy.uploadRate);
      } else {
        const defaults = ROOM_TYPE_BANDWIDTH[rv.roomType] || ROOM_TYPE_BANDWIDTH.standard;
        bandwidthDown = defaults.down;
        bandwidthUp = defaults.up;
      }

      return {
        vlanId: rv.vlanId,
        subnet: rv.subnet,
        gateway: rv.gateway,
        roomType: rv.roomType,
        action: 'create' as const,
        bandwidthDown,
        bandwidthUp,
      };
    });

    // Step 3: Call shell script
    const result = applyRoomVlanRules(rules, flush);

    // Step 4: Update firewallRulesGenerated on successfully applied VLANs
    if (result.success && result.appliedCount && result.appliedCount > 0) {
      await db.roomVlan.updateMany({
        where: tenantWhere(user.tenantId, {
          id: { in: roomVlans.map((rv) => rv.id) },
        }),
        data: {
          firewallRulesGenerated: true,
          lastProvisionedAt: new Date(),
        },
      });
    }

    // Step 5: Audit log
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
    try {
      await db.auditLog.create({
        data: {
          ...(isUUID(user.tenantId) && { tenant: { connect: { id: user.tenantId } } }),
          userId: user.userId || null,
          module: 'wifi',
          action: flush ? 'room_vlan_flush' : 'room_vlan_apply',
          entityType: 'RoomVlan',
          newValue: JSON.stringify({
            propertyId,
            vlanCount: rules.length,
            appliedCount: result.appliedCount || 0,
            flush,
            success: result.success,
          }),
          ipAddress,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    // Step 6: Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        appliedCount: result.appliedCount || 0,
        deletedCount: result.deletedCount || 0,
        errors: result.errors || 0,
        output: result.output,
        durationMs: result.durationMs,
      });
    } else {
      return NextResponse.json({
        success: false,
        appliedCount: result.appliedCount || 0,
        output: result.output,
        exitCode: result.exitCode,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[room-vlans/apply] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply room VLAN rules' } },
      { status: 500 },
    );
  }
}

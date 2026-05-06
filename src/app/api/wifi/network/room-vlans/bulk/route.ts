/**
 * Room-VLAN Bulk Operations API
 *
 * Feature-gated behind `room_vlan_isolation` flag.
 *
 * Supported actions:
 *   generate          – auto-create Room-VLAN entries for all rooms across floors
 *   delete            – bulk delete by IDs
 *   enable            – bulk enable by IDs
 *   disable           – bulk disable by IDs
 *   generate-firewall – preview nftables rules for all active room VLANs
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { requireFeature } from '@/lib/api-feature-flags';

// ─── POST /api/wifi/network/room-vlans/bulk ────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth + permission
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', user.tenantId);
  if (featureGate) return featureGate;

  try {
    const body = await request.json();
    const { action, propertyId } = body;

    if (!action || !propertyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: action, propertyId' },
        },
        { status: 400 },
      );
    }

    switch (action) {
      // ── Generate ────────────────────────────────────────────────────────────
      case 'generate': {
        return handleGenerate(user.tenantId, body);
      }

      // ── Delete ──────────────────────────────────────────────────────────────
      case 'delete': {
        return handleBulkDelete(user.tenantId, body);
      }

      // ── Enable ──────────────────────────────────────────────────────────────
      case 'enable': {
        return handleBulkStatus(user.tenantId, body, 'active');
      }

      // ── Disable ─────────────────────────────────────────────────────────────
      case 'disable': {
        return handleBulkStatus(user.tenantId, body, 'disabled');
      }

      // ── Generate Firewall ───────────────────────────────────────────────────
      case 'generate-firewall': {
        return handleGenerateFirewall(user.tenantId, body);
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${action}. Supported: generate, delete, enable, disable, generate-firewall`,
            },
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[room-vlans/bulk] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Bulk operation failed' } },
      { status: 500 },
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

interface GenerateBody {
  propertyId: string;
  vlanBase: number;
  subnetBase: string;
  floors: { floor: number; rooms: string[] }[];
  roomType?: string;
  parentInterfaceId?: string;
  role?: string;
  mtu?: number;
}

async function handleGenerate(tenantId: string, body: GenerateBody) {
  const { propertyId, vlanBase, subnetBase, floors, roomType = 'standard', parentInterfaceId, role = 'guest', mtu = 1500 } = body;

  if (!vlanBase || !subnetBase || !floors || !floors.length) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields for generate: vlanBase, subnetBase, floors' },
      },
      { status: 400 },
    );
  }

  // Parse subnet base (e.g. "10.1" → prefix)
  const subnetParts = subnetBase.split('.');
  if (subnetParts.length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subnetBase must be in x.y format (e.g. "10.1")' },
      },
      { status: 400 },
    );
  }

  // Build all room entries with auto-incrementing VLAN IDs and subnets
  const created: unknown[] = [];
  let vlanOffset = 0;

  for (const floorDef of floors) {
    for (const roomNumber of floorDef.rooms) {
      const vlanId = vlanBase + vlanOffset;
      const subnetThird = Math.floor(vlanOffset / 256);
      const subnetFourth = (vlanOffset % 256) * 16; // each room gets a /28 (16 IPs)
      const subnet = `${subnetParts[0]}.${subnetParts[1]}.${subnetThird}.${subnetFourth}/28`;
      const gateway = `${subnetParts[0]}.${subnetParts[1]}.${subnetThird}.${subnetFourth + 1}`;

      try {
        const record = await db.roomVlan.create({
          data: {
            tenant: { connect: { id: tenantId } },
            property: { connect: { id: propertyId } },
            roomNumber,
            vlanId,
            subnet,
            gateway,
            ...(parentInterfaceId && { parentInterface: { connect: { id: parentInterfaceId } } }),
            role,
            mtu,
            floor: floorDef.floor,
            roomType,
            status: 'active',
          },
        });
        created.push(record);
      } catch (err: unknown) {
        const prismaCode = (err as { code?: string })?.code;
        // Skip duplicates (P2002) silently
        if (prismaCode !== 'P2002') {
          console.warn(`[room-vlans/bulk] generate: error for room ${roomNumber}:`, err);
        }
      }

      vlanOffset++;
    }
  }

  return NextResponse.json({
    success: true,
    data: created,
    meta: { totalRequested: floors.reduce((s, f) => s + f.rooms.length, 0), totalCreated: created.length },
  });
}

async function handleBulkDelete(tenantId: string, body: { propertyId: string; ids: string[] }) {
  const { ids } = body;

  if (!ids || !ids.length) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } },
      { status: 400 },
    );
  }

  const result = await db.roomVlan.deleteMany({
    where: { id: { in: ids }, tenantId },
  });

  return NextResponse.json({
    success: true,
    data: { deleted: result.count },
  });
}

async function handleBulkStatus(tenantId: string, body: { propertyId: string; ids: string[] }, status: string) {
  const { ids } = body;

  if (!ids || !ids.length) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } },
      { status: 400 },
    );
  }

  const result = await db.roomVlan.updateMany({
    where: { id: { in: ids }, tenantId },
    data: { status },
  });

  return NextResponse.json({
    success: true,
    data: { updated: result.count, status },
  });
}

// ─── nftables firewall preview generator ──────────────────────────────────────

async function handleGenerateFirewall(tenantId: string, body: { propertyId: string }) {
  const { propertyId } = body;

  // Fetch all active room VLANs for the property
  const rooms = await db.roomVlan.findMany({
    where: { tenantId, propertyId, status: 'active' },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });

  if (!rooms.length) {
    return NextResponse.json({
      success: true,
      data: {
        config: '# No active room VLANs found for this property.',
        roomsProcessed: 0,
        warning: 'No active room VLAN configurations to generate rules for.',
      },
    });
  }

  // Build the nftables config
  const lines: string[] = [];
  lines.push('# Per-room VLAN chains — auto-generated by StaySuite');
  lines.push('# Property: ' + propertyId);
  lines.push('# Generated: ' + new Date().toISOString());
  lines.push('# Room count: ' + rooms.length);
  lines.push('');
  lines.push('table ip hotel_rooms {');
  lines.push('');

  // Build a subnet → roomNumber lookup for cross-VLAN blocking
  const subnetMap = rooms.map((r) => ({ roomNumber: r.roomNumber, subnet: r.subnet }));

  for (const room of rooms) {
    lines.push(`  chain room_${room.roomNumber} {`);
    lines.push(`    type filter hook forward priority 0; policy drop;`);
    lines.push(`    # Room ${room.roomNumber} — VLAN ${room.vlanId} — ${room.subnet}`);
    lines.push('');
    lines.push(`    # Allow DNS`);
    lines.push(`    udp dport 53 accept;`);
    lines.push(`    tcp dport 53 accept;`);
    lines.push('');
    lines.push(`    # Allow DHCP`);
    lines.push(`    udp dport 67 accept;`);
    lines.push(`    udp dport 68 accept;`);
    lines.push('');
    lines.push(`    # Allow HTTPS`);
    lines.push(`    tcp dport 443 accept;`);
    lines.push('');
    lines.push(`    # Allow HTTP`);
    lines.push(`    tcp dport 80 accept;`);
    lines.push('');

    // Block access to other room subnets
    lines.push(`    # Block access to other room VLANs`);
    for (const other of subnetMap) {
      if (other.roomNumber !== room.roomNumber) {
        lines.push(`    ip daddr ${other.subnet} drop;`);
      }
    }
    lines.push('');

    lines.push(`    # Allow NAT to internet`);
    lines.push(`    accept;`);
    lines.push(`  }`);
    lines.push('');
  }

  lines.push('}');

  const config = lines.join('\n');

  // Mark all rooms as having firewall rules generated
  await db.roomVlan.updateMany({
    where: { id: { in: rooms.map((r) => r.id) }, tenantId },
    data: { firewallRulesGenerated: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      config,
      roomsProcessed: rooms.length,
      rulesGeneratedAt: new Date().toISOString(),
    },
  });
}

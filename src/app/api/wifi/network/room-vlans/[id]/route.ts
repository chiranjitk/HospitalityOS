/**
 * Individual Room-VLAN API
 *
 * Feature-gated behind `room_vlan_isolation` flag.
 * GET    – fetch a single RoomVlan by ID
 * PUT    – update a single RoomVlan
 * DELETE – remove a single RoomVlan
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { requireFeature } from '@/lib/api-feature-flags';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/wifi/network/room-vlans/[id] ────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', tenantId);
  if (featureGate) return featureGate;

  try {
    const { id } = await params;

    const record = await db.roomVlan.findFirst({
      where: { id, tenantId },
      include: {
        bandwidthPolicy: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room VLAN not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[room-vlans/[id]] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room VLAN' } },
      { status: 500 },
    );
  }
}

// ─── PUT /api/wifi/network/room-vlans/[id] ────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', tenantId);
  if (featureGate) return featureGate;

  try {
    const { id } = await params;
    const body = await request.json();

    // Verify record exists
    const existing = await db.roomVlan.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room VLAN not found' } },
        { status: 404 },
      );
    }

    const {
      roomNumber,
      vlanId,
      subnet,
      gateway,
      floor,
      roomType,
      bandwidthPlanId,
      status,
      description,
      firewallRulesGenerated,
    } = body;

    // Check roomNumber uniqueness if changing
    if (roomNumber && roomNumber !== existing.roomNumber) {
      const dup = await db.roomVlan.findFirst({
        where: { propertyId: existing.propertyId, roomNumber, tenantId, id: { not: existing.id } },
      });
      if (dup) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'DUPLICATE_ROOM', message: `Room ${roomNumber} already has a VLAN mapping on this property` },
          },
          { status: 409 },
        );
      }
    }

    // Check vlanId uniqueness if changing
    if (vlanId !== undefined && vlanId !== existing.vlanId) {
      const dup = await db.roomVlan.findFirst({
        where: { propertyId: existing.propertyId, vlanId: parseInt(vlanId, 10), tenantId, id: { not: existing.id } },
      });
      if (dup) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'DUPLICATE_VLAN', message: `VLAN ID ${vlanId} is already assigned on this property` },
          },
          { status: 409 },
        );
      }
    }

    // Recompute subnet/gateway when vlanId changes and no explicit subnet/gateway given
    let computedSubnet = subnet;
    let computedGateway = gateway;
    if (vlanId !== undefined && vlanId !== existing.vlanId && !subnet && !gateway) {
      const vid = parseInt(vlanId, 10);
      computedSubnet = `10.${Math.floor(vid / 256)}.${vid % 256}.0/28`;
      computedGateway = `10.${Math.floor(vid / 256)}.${vid % 256}.1`;
    }

    const record = await db.roomVlan.update({
      where: { id: existing.id },
      data: {
        ...(roomNumber !== undefined && { roomNumber }),
        ...(vlanId !== undefined && { vlanId: parseInt(vlanId, 10) }),
        ...(computedSubnet !== undefined && { subnet: computedSubnet }),
        ...(computedGateway !== undefined && { gateway: computedGateway }),
        ...(floor !== undefined && { floor: parseInt(floor, 10) }),
        ...(roomType !== undefined && { roomType }),
        ...(status !== undefined && { status }),
        ...(description !== undefined && { description }),
        ...(firewallRulesGenerated !== undefined && { firewallRulesGenerated: Boolean(firewallRulesGenerated) }),
        // Handle bandwidthPlanId: set to new value, or disconnect if null
        ...(bandwidthPlanId !== undefined && {
          bandwidthPolicy: bandwidthPlanId
            ? { connect: { id: bandwidthPlanId } }
            : { disconnect: true },
        }),
      },
      include: {
        bandwidthPolicy: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[room-vlans/[id]] PUT error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const prismaCode = (error as { code?: string })?.code;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: prismaCode === 'P2002' ? 'DUPLICATE_ENTRY' : 'INTERNAL_ERROR',
          message: `Failed to update room VLAN: ${msg}`,
        },
      },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/wifi/network/room-vlans/[id] ─────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', tenantId);
  if (featureGate) return featureGate;

  try {
    const { id } = await params;

    const existing = await db.roomVlan.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room VLAN not found' } },
        { status: 404 },
      );
    }

    await db.roomVlan.delete({ where: { id: existing.id } });

    return NextResponse.json({
      success: true,
      message: `Room VLAN for room ${existing.roomNumber} (VLAN ${existing.vlanId}) deleted`,
    });
  } catch (error) {
    console.error('[room-vlans/[id]] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete room VLAN' } },
      { status: 500 },
    );
  }
}

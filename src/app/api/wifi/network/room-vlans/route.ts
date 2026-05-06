/**
 * Room-VLAN Management API
 *
 * Feature-gated behind `room_vlan_isolation` flag.
 * GET  – list RoomVlan records for a property (with optional filters)
 * POST – create a single Room-VLAN mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { requireFeature } from '@/lib/api-feature-flags';

// ─── GET /api/wifi/network/room-vlans ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth + permission
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', user.tenantId);
  if (featureGate) return featureGate;

  try {
    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId');
    const floor = sp.get('floor');
    const status = sp.get('status');
    const search = sp.get('search');
    const limit = sp.get('limit');
    const offset = sp.get('offset');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId query param is required' } },
        { status: 400 },
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId: user.tenantId, propertyId };

    if (floor) where.floor = parseInt(floor, 10);
    if (status) where.status = status;
    if (search) {
      where.roomNumber = { contains: search, mode: 'insensitive' };
    }

    const [records, total] = await Promise.all([
      db.roomVlan.findMany({
        where,
        include: {
          bandwidthPolicy: {
            select: { id: true, name: true },
          },
          parentInterface: {
            select: { id: true, name: true, type: true, status: true, description: true },
          },
          property: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.roomVlan.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('[room-vlans] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room VLANs' } },
      { status: 500 },
    );
  }
}

// ─── POST /api/wifi/network/room-vlans ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth + permission
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // Feature gate
  const featureGate = await requireFeature('room_vlan_isolation', user.tenantId);
  if (featureGate) return featureGate;

  try {
    const body = await request.json();
    const {
      propertyId,
      roomNumber,
      vlanId,
      subnet,
      gateway,
      parentInterfaceId,
      role = 'guest',
      mtu = 1500,
      floor = 1,
      roomType = 'standard',
      bandwidthPlanId,
      description,
    } = body;

    // Validate required fields
    if (!propertyId || !roomNumber || vlanId === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, roomNumber, vlanId',
          },
        },
        { status: 400 },
      );
    }

    // Auto-generate subnet and gateway from vlanId when not provided
    // Convention:  10.{vlanId / 256}.{vlanId % 256}.0/28  →  gateway .1
    const computedSubnet = subnet || `10.${Math.floor(vlanId / 256)}.${vlanId % 256}.0/28`;
    const computedGateway = gateway || `10.${Math.floor(vlanId / 256)}.${vlanId % 256}.1`;

    // Check uniqueness – propertyId + roomNumber
    const existingRoom = await db.roomVlan.findFirst({
      where: { propertyId, roomNumber, tenantId: user.tenantId },
    });
    if (existingRoom) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DUPLICATE_ROOM', message: `Room ${roomNumber} already has a VLAN mapping on this property` },
        },
        { status: 409 },
      );
    }

    // Check uniqueness – propertyId + vlanId
    const existingVlan = await db.roomVlan.findFirst({
      where: { propertyId, vlanId: parseInt(vlanId, 10), tenantId: user.tenantId },
    });
    if (existingVlan) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DUPLICATE_VLAN', message: `VLAN ID ${vlanId} is already assigned on this property` },
        },
        { status: 409 },
      );
    }

    const record = await db.roomVlan.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        property: { connect: { id: propertyId } },
        roomNumber,
        vlanId: parseInt(vlanId, 10),
        subnet: computedSubnet,
        gateway: computedGateway,
        ...(parentInterfaceId && { parentInterface: { connect: { id: parentInterfaceId } } }),
        role,
        mtu: parseInt(mtu, 10),
        floor: parseInt(floor, 10),
        roomType,
        status: 'active',
        ...(bandwidthPlanId && { bandwidthPolicy: { connect: { id: bandwidthPlanId } } }),
        ...(description && { description }),
      },
      include: {
        bandwidthPolicy: { select: { id: true, name: true } },
        parentInterface: { select: { id: true, name: true, type: true, status: true, description: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('[room-vlans] POST error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const prismaCode = (error as { code?: string })?.code;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: prismaCode === 'P2002' ? 'DUPLICATE_ENTRY' : 'INTERNAL_ERROR',
          message: `Failed to create room VLAN: ${msg}`,
        },
      },
      { status: 500 },
    );
  }
}

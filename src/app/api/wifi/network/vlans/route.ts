/**
 * VLANs API Route
 *
 * List and create VLAN configurations.
 * OS-level: this box is a single-tenant gateway. Text identifiers
 * (subInterface name) are the natural key for VLAN lookups.
 * No UUID validation needed — use interface names directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/vlans - List all VLANs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const parentInterfaceId = searchParams.get('parentInterfaceId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {};
    if (propertyId) where.propertyId = propertyId;
    if (parentInterfaceId) where.parentInterfaceId = parentInterfaceId;
    if (enabled !== null) where.enabled = enabled === 'true';

    const [vlans, total] = await Promise.all([
      db.vlanConfig.findMany({
        where,
        include: {
          parentInterface: {
            select: { id: true, name: true, type: true, status: true },
          },
          dhcpSubnets: {
            include: {
              _count: {
                select: {
                  reservations: true,
                  leases: true,
                },
              },
            },
          },
          _count: {
            select: {
              dhcpSubnets: true,
            },
          },
        },
        orderBy: [{ vlanId: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.vlanConfig.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: vlans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching VLANs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch VLANs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/vlans - Create VLAN
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      parentInterfaceId,
      parentInterfaceName,
      vlanId,
      subInterface,
      description,
      mtu = 1500,
      enabled = true,
    } = body;

    if (!propertyId || vlanId === undefined || !subInterface) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, vlanId, subInterface',
          },
        },
        { status: 400 },
      );
    }

    // Resolve parent interface by name — text identifier is the natural key
    // on a single-box gateway. Try: explicit parentInterfaceName → parentInterfaceId as name →
    // derive from subInterface (eth1.100 → eth1)
    let parentRecord: Awaited<ReturnType<typeof db.networkInterface.findFirst>> | null = null;

    // 1. Try explicit parentInterfaceName
    if (parentInterfaceName) {
      parentRecord = await db.networkInterface.findFirst({
        where: { name: parentInterfaceName },
      });
    }

    // 2. Try parentInterfaceId as a name (OS interface name, not UUID)
    if (!parentRecord && parentInterfaceId) {
      parentRecord = await db.networkInterface.findFirst({
        where: { name: parentInterfaceId },
      });
    }

    // 3. Derive from subInterface (eth1.100 → eth1)
    if (!parentRecord && subInterface.includes('.')) {
      const ifaceName = subInterface.split('.')[0];
      parentRecord = await db.networkInterface.findFirst({
        where: { name: ifaceName },
      });
    }

    const parentIfaceName = parentRecord?.name
      || parentInterfaceName
      || (subInterface.includes('.') ? subInterface.split('.')[0] : null)
      || parentInterfaceId;

    if (!parentIfaceName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot determine parent interface name' } },
        { status: 400 },
      );
    }

    // Check for duplicate VLAN ID within property
    const existingVlanId = await db.vlanConfig.findFirst({
      where: { propertyId, vlanId: parseInt(vlanId, 10) },
    });

    if (existingVlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_VLAN', message: 'A VLAN with this ID already exists on this property' } },
        { status: 400 },
      );
    }

    // Check for duplicate sub-interface name within property
    const existingSub = await db.vlanConfig.findFirst({
      where: { propertyId, subInterface },
    });

    if (existingSub) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DUPLICATE_SUBIF', message: 'A sub-interface with this name already exists on this property' },
        },
        { status: 400 },
      );
    }

    // OS-level VLAN creation is handled by the frontend calling /api/network/os/vlans first.
    // This route only persists the VLAN configuration to the database.

    const vlan = await db.vlanConfig.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        parentInterface: {
          connectOrCreate: {
            where: {
              propertyId_name: {
                propertyId,
                name: parentIfaceName,
              },
            },
            create: {
              tenant: { connect: { id: tenantId } },
              property: { connect: { id: propertyId } },
              name: parentIfaceName,
              type: 'ethernet',
              status: 'up',
              hwAddress: '',
              mtu: 1500,
            },
          },
        },
        vlanId: parseInt(vlanId, 10),
        subInterface,
        description,
        mtu: parseInt(mtu, 10),
        enabled,
      },
      include: {
        parentInterface: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: vlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating VLAN:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    const msg = error instanceof Error ? error.message : String(error);
    const prismaCode = (error as { code?: string })?.code;
    const prismaMeta = (error as { meta?: unknown })?.meta;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: prismaCode === 'P2002' ? 'DUPLICATE_ENTRY' : 'INTERNAL_ERROR',
          message: `Failed to create VLAN: ${msg}`,
          ...(prismaCode && { prismaCode }),
          ...(prismaMeta && { prismaMeta }),
        },
      },
      { status: 500 },
    );
  }
}

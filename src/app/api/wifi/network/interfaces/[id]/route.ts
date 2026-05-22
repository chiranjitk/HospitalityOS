/**
 * Network Interface by ID API Route
 *
 * GET, PUT, DELETE for individual network interfaces.
 * [id] can be a DB UUID or an interface name (e.g. eth0, eth1).
 *
 * On a single-box gateway, the interface name is the natural identifier.
 * Look up by name (text) first, UUID as fallback. No UUID validation needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: resolve [id] — look up by name (OS identifier) first, then UUID
async function resolveInterface(id: string, tenantId: string) {
  // Try name first (the natural OS identifier)
  const byName = await db.networkInterface.findFirst({
    where: { name: id, tenantId },
    include: {
      roles: true,
      vlans: true,
      bondMembers: { include: { bondConfig: true } },
    },
  });
  if (byName) return byName;

  // Fallback: try as UUID id
  return db.networkInterface.findFirst({
    where: { id, tenantId },
    include: {
      roles: true,
      vlans: true,
      bondMembers: { include: { bondConfig: true } },
    },
  });
}

// GET /api/wifi/network/interfaces/[id] - Get single interface
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const iface = await resolveInterface(id, ctx.tenantId);

    if (!iface) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: iface });
  } catch (error) {
    console.error('Error fetching network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch network interface' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/interfaces/[id] - Update interface
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await resolveInterface(id, ctx.tenantId);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    const { name, type, hwAddress, mtu, speed, status, carrier, isManagement, description } = body;

    // Check for duplicate name if renaming
    if (name && name !== existing.name) {
      const duplicate = await db.networkInterface.findFirst({
        where: { propertyId: existing.propertyId, name, id: { not: existing.id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'An interface with this name already exists on this property' } },
          { status: 400 },
        );
      }
    }

    const iface = await db.networkInterface.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(hwAddress !== undefined && { hwAddress }),
        ...(mtu !== undefined && { mtu: parseInt(mtu, 10) }),
        ...(speed !== undefined && { speed }),
        ...(status && { status }),
        ...(carrier !== undefined && { carrier }),
        ...(isManagement !== undefined && { isManagement }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json({ success: true, data: iface });
  } catch (error) {
    console.error('Error updating network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update network interface' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/interfaces/[id] - Delete interface
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const existing = await resolveInterface(id, ctx.tenantId);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    // Check for active dependencies
    if (existing._count?.vlans > 0 || existing._count?.bondMembers > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPENDENCY_ERROR',
            message: 'Cannot delete interface with active VLANs or bond memberships. Remove those first.',
          },
        },
        { status: 400 },
      );
    }

    // Delete associated roles
    await db.interfaceRole.deleteMany({ where: { interfaceId: existing.id } });

    await db.networkInterface.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true, message: 'Network interface deleted successfully' });
  } catch (error) {
    console.error('Error deleting network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete network interface' } },
      { status: 500 },
    );
  }
}

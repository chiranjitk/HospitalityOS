/**
 * DHCP Blacklist by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP blacklist entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/blacklist/[id] - Get single blacklist entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const entry = await db.dhcpBlacklist.findFirst({
      where: { id, tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP blacklist entry not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...entry, subnetName: entry.dhcpSubnet?.name ?? null },
    });
  } catch (error) {
    console.error('Error fetching DHCP blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP blacklist entry' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/blacklist/[id] - Update blacklist entry
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpBlacklist.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP blacklist entry not found' } },
        { status: 404 },
      );
    }

    const { macAddress, reason, subnetId, enabled } = body;

    const updated = await db.dhcpBlacklist.update({
      where: { id },
      data: {
        ...(macAddress !== undefined && { macAddress }),
        ...(reason !== undefined && { reason }),
        ...(subnetId !== undefined && { subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'DHCP blacklist entry updated successfully',
    });
  } catch (error) {
    console.error('Error updating DHCP blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP blacklist entry' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/blacklist/[id] - Delete blacklist entry
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.dhcpBlacklist.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP blacklist entry not found' } },
        { status: 404 },
      );
    }

    await db.dhcpBlacklist.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'DHCP blacklist entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP blacklist entry' } },
      { status: 500 },
    );
  }
}

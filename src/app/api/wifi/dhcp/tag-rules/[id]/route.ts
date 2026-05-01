/**
 * DHCP Tag Rules by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP tag rules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/tag-rules/[id] - Get single tag rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const rule = await db.dhcpTagRule.findFirst({
      where: { id, tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP tag rule not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...rule, subnetName: rule.dhcpSubnet?.name ?? null },
    });
  } catch (error) {
    console.error('Error fetching DHCP tag rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP tag rule' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/tag-rules/[id] - Update tag rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpTagRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP tag rule not found' } },
        { status: 404 },
      );
    }

    const { name, matchType, matchPattern, setTag, subnetId, enabled, description } = body;

    const updated = await db.dhcpTagRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(matchType !== undefined && { matchType }),
        ...(matchPattern !== undefined && { matchPattern }),
        ...(setTag !== undefined && { setTag }),
        ...(subnetId !== undefined && { subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId }),
        ...(enabled !== undefined && { enabled }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'DHCP tag rule updated successfully',
    });
  } catch (error) {
    console.error('Error updating DHCP tag rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP tag rule' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/tag-rules/[id] - Delete tag rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.dhcpTagRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP tag rule not found' } },
        { status: 404 },
      );
    }

    await db.dhcpTagRule.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'DHCP tag rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP tag rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP tag rule' } },
      { status: 500 },
    );
  }
}

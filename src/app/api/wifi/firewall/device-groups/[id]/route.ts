import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/device-groups/[id] - Get single device group
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const group = await db.deviceGroup.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        defaultPolicy: {
          select: { id: true, name: true, trustLevel: true, isActive: true, bandwidthDownKbps: true, bandwidthUpKbps: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device group not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error fetching device group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device group' } },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/device-groups/[id] - Update device group
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.deviceGroup.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device group not found' } },
        { status: 404 },
      );
    }

    const {
      name,
      description,
      matchType,
      matchCriteria,
      defaultPolicyId,
      enabled,
    } = body;

    // Validate matchType if provided
    if (matchType) {
      const validMatchTypes = ['manual', 'mac_oui', 'vlan', 'ssid', 'device_type'];
      if (!validMatchTypes.includes(matchType)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid matchType` } },
          { status: 400 },
        );
      }
    }

    // Validate matchCriteria if provided
    if (matchCriteria !== undefined) {
      try {
        JSON.parse(typeof matchCriteria === 'string' ? matchCriteria : JSON.stringify(matchCriteria));
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'matchCriteria must be valid JSON' } },
          { status: 400 },
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (matchType !== undefined) updateData.matchType = matchType;
    if (matchCriteria !== undefined) updateData.matchCriteria = typeof matchCriteria === 'string' ? matchCriteria : JSON.stringify(matchCriteria);
    if (defaultPolicyId !== undefined) updateData.defaultPolicyId = defaultPolicyId || null;
    if (enabled !== undefined) updateData.enabled = enabled;

    const group = await db.deviceGroup.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: existing.propertyId,
        action: 'policy_updated',
        entityType: 'device_group',
        entityId: id,
        details: JSON.stringify({ changes: updateData, oldName: existing.name }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error updating device group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update device group' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/device-groups/[id] - Delete device group
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.deviceGroup.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        _count: {
          select: { deviceGroupsAsDefault: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device group not found' } },
        { status: 404 },
      );
    }

    if (existing._count.deviceGroupsAsDefault > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_DEPENDENTS', message: 'Cannot delete device group that is set as default policy for policies. Update or remove the default policy reference first.' } },
        { status: 400 },
      );
    }

    await db.deviceGroup.delete({ where: { id } });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: existing.propertyId,
        action: 'policy_deleted',
        entityType: 'device_group',
        entityId: id,
        details: JSON.stringify({ name: existing.name, matchType: existing.matchType }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, message: 'Device group deleted successfully' });
  } catch (error) {
    console.error('Error deleting device group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete device group' } },
      { status: 500 },
    );
  }
}

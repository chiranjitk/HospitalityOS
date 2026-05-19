import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/device-policies/[id] - Get single policy with assignments
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const policy = await db.devicePolicy.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        assignments: {
          where: { isActive: true },
          orderBy: { appliedAt: 'desc' },
        },
        deviceGroup: true,
        firewallSchedule: {
          select: { id: true, name: true, enabled: true },
        },
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!policy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device policy not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error fetching device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device policy' } },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/device-policies/[id] - Update policy fields
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.devicePolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device policy not found' } },
        { status: 404 },
      );
    }

    const {
      name,
      description,
      trustLevel,
      bandwidthDownKbps,
      bandwidthUpKbps,
      allowedZones,
      deniedZones,
      contentFilterLevel,
      sessionTimeoutMins,
      maxDevices,
      autoApplyOnAuth,
      priority,
      scheduleId,
    } = body;

    // Validate trustLevel if provided
    if (trustLevel) {
      const validTrustLevels = ['trusted', 'standard', 'restricted', 'quarantine'];
      if (!validTrustLevels.includes(trustLevel)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid trustLevel` } },
          { status: 400 },
        );
      }
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (trustLevel !== undefined) updateData.trustLevel = trustLevel;
    if (bandwidthDownKbps !== undefined) updateData.bandwidthDownKbps = bandwidthDownKbps;
    if (bandwidthUpKbps !== undefined) updateData.bandwidthUpKbps = bandwidthUpKbps;
    if (allowedZones !== undefined) updateData.allowedZones = typeof allowedZones === 'string' ? allowedZones : JSON.stringify(allowedZones);
    if (deniedZones !== undefined) updateData.deniedZones = typeof deniedZones === 'string' ? deniedZones : JSON.stringify(deniedZones);
    if (contentFilterLevel !== undefined) updateData.contentFilterLevel = contentFilterLevel;
    if (sessionTimeoutMins !== undefined) updateData.sessionTimeoutMins = sessionTimeoutMins;
    if (maxDevices !== undefined) updateData.maxDevices = maxDevices;
    if (autoApplyOnAuth !== undefined) updateData.autoApplyOnAuth = autoApplyOnAuth;
    if (priority !== undefined) updateData.priority = priority;
    if (scheduleId !== undefined) updateData.scheduleId = scheduleId || null;

    const policy = await db.devicePolicy.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: existing.propertyId,
        action: 'policy_updated',
        entityType: 'device_policy',
        entityId: id,
        details: JSON.stringify({ changes: updateData, oldName: existing.name }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error updating device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update device policy' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/device-policies/[id] - Soft-delete and revoke assignments
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.devicePolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device policy not found' } },
        { status: 404 },
      );
    }

    // Soft-delete: set isActive=false
    await db.devicePolicy.update({
      where: { id },
      data: { isActive: false },
    });

    // Revoke all active assignments
    const revokedCount = await db.devicePolicyAssignment.updateMany({
      where: { policyId: id, isActive: true },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: 'policy_deactivated',
      },
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: existing.propertyId,
        action: 'policy_deleted',
        entityType: 'device_policy',
        entityId: id,
        details: JSON.stringify({ name: existing.name, revokedAssignments: revokedCount.count }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Policy deactivated and assignments revoked',
      data: { revokedAssignments: revokedCount.count },
    });
  } catch (error) {
    console.error('Error deleting device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete device policy' } },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/wifi/firewall/device-policies/revoke - Revoke a device's policy assignment
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { macAddress, reason, propertyId } = body;

    if (!macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: macAddress' } },
        { status: 400 },
      );
    }

    const normalizedMac = macAddress.toUpperCase().trim();

    // Find active assignment
    const whereClause: Record<string, unknown> = {
      tenantId: user.tenantId,
      macAddress: normalizedMac,
      isActive: true,
    };
    if (propertyId) whereClause.propertyId = propertyId;

    const assignment = await db.devicePolicyAssignment.findFirst({
      where: whereClause,
      include: {
        policy: {
          select: { id: true, name: true, trustLevel: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active policy assignment found for this device' } },
        { status: 404 },
      );
    }

    // Revoke the assignment
    const revoked = await db.devicePolicyAssignment.update({
      where: { id: assignment.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: reason || 'admin_revoke',
      },
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: assignment.propertyId,
        action: 'device_revoked',
        entityType: 'assignment',
        entityId: assignment.id,
        macAddress: normalizedMac,
        details: JSON.stringify({
          policyId: assignment.policyId,
          policyName: assignment.policy.name,
          trustLevel: assignment.policy.trustLevel,
          reason: reason || 'admin_revoke',
        }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: revoked,
      message: 'Policy assignment revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke device policy' } },
      { status: 500 },
    );
  }
}

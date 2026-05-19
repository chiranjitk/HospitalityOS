import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/wifi/firewall/device-policies/assign - Assign a policy to a MAC address
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { policyId, macAddress, source = 'manual', ipAddress } = body;

    if (!policyId || !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: policyId, macAddress' } },
        { status: 400 },
      );
    }

    // Normalize MAC address to uppercase
    const normalizedMac = macAddress.toUpperCase().trim();

    // Validate policy exists and belongs to tenant
    const policy = await db.devicePolicy.findFirst({
      where: { id: policyId, tenantId: user.tenantId },
    });

    if (!policy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device policy not found' } },
        { status: 404 },
      );
    }

    if (!policy.isActive) {
      return NextResponse.json(
        { success: false, error: { code: 'POLICY_INACTIVE', message: 'Cannot assign an inactive policy' } },
        { status: 400 },
      );
    }

    // Check if MAC already has an active assignment (unique constraint per property+mac)
    const existingAssignment = await db.devicePolicyAssignment.findFirst({
      where: {
        tenantId: user.tenantId,
        propertyId: policy.propertyId,
        macAddress: normalizedMac,
        isActive: true,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_ASSIGNED',
            message: 'Device already has an active policy assignment',
            data: { existingPolicyId: existingAssignment.policyId },
          },
        },
        { status: 409 },
      );
    }

    // Create the assignment
    const assignment = await db.devicePolicyAssignment.create({
      data: {
        tenantId: user.tenantId,
        propertyId: policy.propertyId,
        policyId,
        macAddress: normalizedMac,
        ipAddress: ipAddress || undefined,
        source,
        trustLevel: policy.trustLevel,
      },
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: policy.propertyId,
        action: 'device_assigned',
        entityType: 'assignment',
        entityId: assignment.id,
        macAddress: normalizedMac,
        details: JSON.stringify({ policyId, policyName: policy.name, trustLevel: policy.trustLevel, source }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    console.error('Error assigning device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to assign device policy' } },
      { status: 500 },
    );
  }
}

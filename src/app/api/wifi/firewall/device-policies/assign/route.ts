import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyZtnaRules, TRUST_CLASS_IDS } from '@/lib/network/ztna-script-runner';
import type { ZtnaApplyInput } from '@/lib/network/ztna-script-runner';

// POST /api/wifi/firewall/device-policies/assign - Assign a policy to a MAC address
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
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

    // Hard-delete any existing assignment for same property+mac (not just active ones)
    await db.devicePolicyAssignment.deleteMany({
      where: {
        tenantId: user.tenantId,
        propertyId: policy.propertyId,
        macAddress: normalizedMac,
      },
    });

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

    // Re-sync nftables with current DB state (best effort)
    try {
      const allAssignments = await db.devicePolicyAssignment.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
        },
        include: {
          policy: {
            select: { trustLevel: true },
          },
        },
      });

      const ztnaAssignments: ZtnaApplyInput['assignments'] = allAssignments.map((a) => ({
        macAddress: a.macAddress.toUpperCase().trim(),
        trustLevel: a.trustLevel || a.policy.trustLevel,
        classId: TRUST_CLASS_IDS[a.trustLevel || a.policy.trustLevel] ?? TRUST_CLASS_IDS.standard,
        isActive: true,
      }));

      const result = applyZtnaRules(ztnaAssignments);
      if (!result.success) {
        console.error(`[ZTNA Assign] Re-sync failed: ${result.stderr}`);
      }
    } catch (syncErr) {
      console.error('[ZTNA Assign] Best-effort re-sync error:', syncErr);
    }

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

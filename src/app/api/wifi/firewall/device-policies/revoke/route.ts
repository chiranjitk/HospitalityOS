import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyZtnaRules, TRUST_CLASS_IDS } from '@/lib/network/ztna-script-runner';
import type { ZtnaApplyInput } from '@/lib/network/ztna-script-runner';

// POST /api/wifi/firewall/device-policies/revoke - Revoke (hard-delete) a device's policy assignment
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
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

    // Hard-delete the assignment
    await db.devicePolicyAssignment.delete({
      where: { id: assignment.id },
    });

    // Re-sync nftables with current DB state (best effort)
    try {
      // Fetch all remaining active assignments for the same property
      const remainingAssignments = await db.devicePolicyAssignment.findMany({
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

      const ztnaAssignments: ZtnaApplyInput['assignments'] = remainingAssignments.map((a) => ({
        macAddress: a.macAddress.toUpperCase().trim(),
        trustLevel: a.trustLevel || a.policy.trustLevel,
        classId: TRUST_CLASS_IDS[a.trustLevel || a.policy.trustLevel] ?? TRUST_CLASS_IDS.standard,
        isActive: true,
      }));

      const result = applyZtnaRules(ztnaAssignments);
      if (!result.success) {
        console.error(`[ZTNA Revoke] Re-sync failed: ${result.stderr}`);
      }
    } catch (syncErr) {
      console.error('[ZTNA Revoke] Best-effort re-sync error:', syncErr);
    }

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
      data: { id: assignment.id, deleted: true },
      message: 'Policy assignment revoked and deleted successfully',
    });
  } catch (error) {
    console.error('Error revoking device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke device policy' } },
      { status: 500 },
    );
  }
}

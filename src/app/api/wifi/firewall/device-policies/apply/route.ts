import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// POST /api/wifi/firewall/device-policies/apply - Generate and apply nftables rules for all active policies
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const whereClause: Record<string, unknown> = {
      tenantId: user.tenantId,
      isActive: true,
    };
    if (propertyId) whereClause.propertyId = propertyId;

    // Fetch all active policies with their active assignments
    const policies = await db.devicePolicy.findMany({
      where: whereClause,
      include: {
        assignments: {
          where: { isActive: true },
          select: {
            id: true,
            macAddress: true,
            ipAddress: true,
            trustLevel: true,
            source: true,
          },
        },
      },
      orderBy: { priority: 'desc' },
    });

    // Build the ruleset for nftables
    const rules: Array<{
      policyId: string;
      policyName: string;
      trustLevel: string;
      bandwidthDownKbps: number;
      bandwidthUpKbps: number;
      devices: Array<{ macAddress: string; ipAddress?: string | null }>;
      allowedZones: string[];
      deniedZones: string[];
      contentFilterLevel: string;
    }> = [];

    for (const policy of policies) {
      const allowedZones: string[] = [];
      const deniedZones: string[] = [];
      try {
        allowedZones.push(...JSON.parse(policy.allowedZones));
      } catch { /* ignore parse errors */ }
      try {
        deniedZones.push(...JSON.parse(policy.deniedZones));
      } catch { /* ignore parse errors */ }

      rules.push({
        policyId: policy.id,
        policyName: policy.name,
        trustLevel: policy.trustLevel,
        bandwidthDownKbps: policy.bandwidthDownKbps,
        bandwidthUpKbps: policy.bandwidthUpKbps,
        devices: policy.assignments.map((a) => ({
          macAddress: a.macAddress,
          ipAddress: a.ipAddress,
        })),
        allowedZones,
        deniedZones,
        contentFilterLevel: policy.contentFilterLevel,
      });
    }

    // Apply to nftables service (best effort, non-blocking)
    await fullApplyToNftables(user.tenantId);

    // Audit log
    const auditPropertyId = propertyId || (policies[0]?.propertyId);
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId: auditPropertyId || '',
        action: 'rules_applied',
        entityType: 'device_policy',
        details: JSON.stringify({
          totalPolicies: policies.length,
          totalAssignments: policies.reduce((sum, p) => sum + p.assignments.length, 0),
          trustBreakdown: policies.reduce<Record<string, number>>((acc, p) => {
            acc[p.trustLevel] = (acc[p.trustLevel] || 0) + p.assignments.length;
            return acc;
          }, {}),
        }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalPolicies: policies.length,
        totalAssignments: policies.reduce((sum, p) => sum + p.assignments.length, 0),
        rules,
      },
      message: 'ZTNA rules generated and applied',
    });
  } catch (error) {
    console.error('Error applying ZTNA policies:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply ZTNA policies' } },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyZtnaRules, TRUST_CLASS_IDS } from '@/lib/network/ztna-script-runner';
import type { ZtnaApplyInput } from '@/lib/network/ztna-script-runner';

// POST /api/wifi/firewall/device-policies/apply - Generate and apply nftables rules for all active policies
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
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

    // Build the ruleset summary
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

    // Build assignments array for nftables script
    const ztnaAssignments: ZtnaApplyInput['assignments'] = [];

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

      // Build ZTNA assignment entries for the shell script
      for (const assignment of policy.assignments) {
        const trustLevel = assignment.trustLevel || policy.trustLevel;
        const classId = TRUST_CLASS_IDS[trustLevel] ?? TRUST_CLASS_IDS.standard;

        ztnaAssignments.push({
          macAddress: assignment.macAddress.toUpperCase().trim(),
          trustLevel,
          classId,
          isActive: true,
        });
      }
    }

    // Apply rules via shell script (best effort, non-blocking)
    let scriptResult;
    try {
      scriptResult = applyZtnaRules(ztnaAssignments);
      if (!scriptResult.success) {
        console.error(`[ZTNA Apply] Script failed: ${scriptResult.stderr}`, scriptResult.stdout);
      }
    } catch (err) {
      console.error('[ZTNA Apply] Script execution error:', err);
    }

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
          scriptResult: scriptResult ? {
            success: scriptResult.success,
            rulesApplied: scriptResult.parsed?.rulesApplied,
            errors: scriptResult.parsed?.errors,
            durationMs: scriptResult.durationMs,
          } : null,
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
        scriptResult: scriptResult ? {
          success: scriptResult.success,
          rulesApplied: scriptResult.parsed?.rulesApplied,
          errors: scriptResult.parsed?.errors,
        } : null,
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

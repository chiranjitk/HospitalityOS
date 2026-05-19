import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/device-policies/stats - ZTNA statistics
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const tenantFilter = { tenantId: user.tenantId };
    const propFilter = propertyId ? { ...tenantFilter, propertyId } : tenantFilter;

    // Total policies
    const totalPolicies = await db.devicePolicy.count({ where: propFilter });
    const activePolicies = await db.devicePolicy.count({ where: { ...propFilter, isActive: true } });

    // Assignments by trust level
    const assignmentsByTrust = await db.devicePolicyAssignment.groupBy({
      by: ['trustLevel'],
      where: { ...propFilter, isActive: true },
      _count: { id: true },
    });

    const totalActiveAssignments = await db.devicePolicyAssignment.count({
      where: { ...propFilter, isActive: true },
    });

    // Policies by trust level
    const policiesByTrust = await db.devicePolicy.groupBy({
      by: ['trustLevel'],
      where: propFilter,
      _count: { id: true },
    });

    // Total device groups
    const totalGroups = await db.deviceGroup.count({ where: propFilter });
    const activeGroups = await db.deviceGroup.count({ where: { ...propFilter, enabled: true } });

    // Recent audit events (last 50)
    const recentAudit = await db.ztnaAuditLog.findMany({
      where: propFilter,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        macAddress: true,
        performedBy: true,
        createdAt: true,
      },
    });

    // Assignments by source
    const assignmentsBySource = await db.devicePolicyAssignment.groupBy({
      by: ['source'],
      where: { ...propFilter, isActive: true },
      _count: { id: true },
    });

    // Quota usage per policy (top 10 by assignments)
    const topPolicies = await db.devicePolicy.findMany({
      where: { ...propFilter, isActive: true },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: {
        assignments: { _count: 'desc' },
      },
      take: 10,
      select: {
        id: true,
        name: true,
        trustLevel: true,
        maxDevices: true,
        _count: {
          select: { assignments: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalPolicies,
          activePolicies,
          totalActiveAssignments,
          totalGroups,
          activeGroups,
        },
        assignmentsByTrust: assignmentsByTrust.map((a) => ({
          trustLevel: a.trustLevel,
          count: a._count.id,
        })),
        policiesByTrust: policiesByTrust.map((p) => ({
          trustLevel: p.trustLevel,
          count: p._count.id,
        })),
        assignmentsBySource: assignmentsBySource.map((a) => ({
          source: a.source,
          count: a._count.id,
        })),
        topPolicies: topPolicies.map((p) => ({
          id: p.id,
          name: p.name,
          trustLevel: p.trustLevel,
          maxDevices: p.maxDevices,
          activeAssignments: p._count.assignments,
          usagePercent: p.maxDevices > 0 ? Math.round((p._count.assignments / p.maxDevices) * 100) : 0,
        })),
        recentAudit,
      },
    });
  } catch (error) {
    console.error('Error fetching ZTNA stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ZTNA statistics' } },
      { status: 500 },
    );
  }
}

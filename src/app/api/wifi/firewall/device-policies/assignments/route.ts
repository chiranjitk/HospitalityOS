import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/device-policies/assignments - List all device policy assignments
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const policyId = searchParams.get('policyId');
    const trustLevel = searchParams.get('trustLevel');
    const activeOnly = searchParams.get('active') !== 'false'; // default true
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const whereClause: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) whereClause.propertyId = propertyId;
    if (policyId) whereClause.policyId = policyId;
    if (trustLevel) whereClause.trustLevel = trustLevel;
    if (activeOnly) whereClause.isActive = true;

    const [assignments, total] = await Promise.all([
      db.devicePolicyAssignment.findMany({
        where: whereClause,
        include: {
          policy: { select: { id: true, name: true, trustLevel: true, isActive: true } },
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.devicePolicyAssignment.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      data: { assignments, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching ZTNA assignments:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assignments' } },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/device-policies/audit - List ZTNA audit log entries
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const macAddress = searchParams.get('macAddress');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const whereClause: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) whereClause.propertyId = propertyId;
    if (action) whereClause.action = action;
    if (entityType) whereClause.entityType = entityType;
    if (macAddress) whereClause.macAddress = macAddress.toUpperCase().trim();
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) (whereClause.createdAt as Record<string, unknown>).gte = new Date(fromDate);
      if (toDate) (whereClause.createdAt as Record<string, unknown>).lte = new Date(toDate);
    }

    const [entries, total] = await Promise.all([
      db.ztnaAuditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ztnaAuditLog.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      data: { entries, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching ZTNA audit log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit log' } },
      { status: 500 },
    );
  }
}

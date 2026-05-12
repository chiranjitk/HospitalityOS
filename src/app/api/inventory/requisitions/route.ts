import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

function generateReqNo(): string {
  const d = new Date();
  return `REQ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').slice(0, 4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const department = sp.get('department');
    const search = sp.get('search');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) where.OR = [
      { requisitionNo: { contains: search } },
      { notes: { contains: search } },
    ];

    const data = await db.purchaseRequisition.findMany({
      where,
      include: { items: true },
      orderBy: [{ createdAt: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.purchaseRequisition.count({ where });
    const statusCounts = await db.purchaseRequisition.groupBy({
      by: ['status'], where: { tenantId: user.tenantId },
      _count: true, _sum: { totalAmount: true },
    });

    return NextResponse.json({
      success: true, data, pagination: { total, limit, offset },
      stats: { statusDistribution: statusCounts },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch requisitions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { propertyId, department, requiredBy, priority, vendorId, notes, items = [] } = body;
    if (!department || !requiredBy) return NextResponse.json({ success: false, error: 'Department and required by date are required' }, { status: 400 });
    if (!items.length) return NextResponse.json({ success: false, error: 'At least one item is required' }, { status: 400 });

    const totalAmount = items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + (i.unitPrice || 0) * (i.quantity || 0), 0);

    const req = await db.purchaseRequisition.create({
      data: {
        tenantId: user.tenantId, propertyId: propertyId || null,
        requisitionNo: generateReqNo(), department,
        requiredBy: new Date(requiredBy),
        priority: priority || 'normal', vendorId: vendorId || null,
        notes, totalAmount, status: 'draft',
      },
      include: { items: true },
    });

    if (items.length > 0) {
      await db.purchaseRequisitionItem.createMany({
        data: items.map((i: { stockItemId?: string; itemName: string; description?: string; quantity: number; unit: string; unitPrice: number; notes?: string }) => ({
          requisitionId: req.id,
          stockItemId: i.stockItemId || null,
          itemName: i.itemName, description: i.description,
          quantity: i.quantity, unit: i.unit || 'pcs',
          unitPrice: i.unitPrice || 0,
          totalPrice: (i.unitPrice || 0) * (i.quantity || 0),
          notes: i.notes,
        })),
      });
    }

    return NextResponse.json({ success: true, data: req }, { status: 201 });
  } catch (error) {
    console.error('POST /api/inventory/requisitions:', error);
    return NextResponse.json({ success: false, error: 'Failed to create requisition' }, { status: 500 });
  }
}

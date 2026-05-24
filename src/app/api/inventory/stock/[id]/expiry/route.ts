import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/inventory/stock/[id]/expiry - Get expiry info for a stock item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'inventory.view');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const threshold = parseInt(searchParams.get('threshold') || '30');

    // If id is 'stats', return overall expiry stats
    if (id === 'stats') {
      const now = new Date();
      const warningDate = new Date(now);
      warningDate.setDate(warningDate.getDate() + threshold);

      const items = await db.stockItem.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'active',
          deletedAt: null,
          expiryDate: { not: null },
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          expiryDate: true,
        },
      });

      const fresh = items.filter(i => i.expiryDate && i.expiryDate > warningDate);
      const warning = items.filter(i => i.expiryDate && i.expiryDate <= warningDate && i.expiryDate > now);
      const expired = items.filter(i => i.expiryDate && i.expiryDate <= now);

      return NextResponse.json({
        stats: {
          total: items.length,
          fresh: fresh.length,
          warning: warning.length,
          expired: expired.length,
          freshItems: fresh,
          warningItems: warning,
          expiredItems: expired,
        },
        threshold,
      });
    }

    // Return specific item expiry info
    const item = await db.stockItem.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        quantity: true,
        unit: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    const now = new Date();
    const daysUntilExpiry = item.expiryDate
      ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let expiryStatus = 'fresh';
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= 0) expiryStatus = 'expired';
      else if (daysUntilExpiry <= 7) expiryStatus = 'critical';
      else if (daysUntilExpiry <= 30) expiryStatus = 'warning';
    }

    return NextResponse.json({
      ...item,
      daysUntilExpiry,
      expiryStatus,
    });
  } catch (error) {
    console.error('Error fetching expiry data:', error);
    return NextResponse.json({ error: 'Failed to fetch expiry data' }, { status: 500 });
  }
}

// PUT /api/inventory/stock/[id]/expiry - Update expiry date
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'inventory.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const { expiryDate } = body;

    if (!expiryDate) {
      return NextResponse.json({ error: 'expiryDate is required' }, { status: 400 });
    }

    // Verify item belongs to user's tenant before update
    const existingItem = await db.stockItem.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!existingItem) {
      return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });
    }

    const item = await db.stockItem.update({
      where: { id },
      data: {
        expiryDate: new Date(expiryDate),
      },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating expiry date:', error);
    return NextResponse.json({ error: 'Failed to update expiry date' }, { status: 500 });
  }
}

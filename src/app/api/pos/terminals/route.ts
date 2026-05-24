import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/pos/terminals — list POS terminals
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.view', 'pos.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const syncStatus = searchParams.get('syncStatus');

    const where: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (propertyId) where.propertyId = propertyId;
    if (syncStatus) where.syncStatus = syncStatus;

    const terminals = await db.posTerminal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: terminals });
  } catch (error) {
    console.error('Error listing POS terminals:', error);
    return NextResponse.json({ success: false, error: 'Failed to list terminals' }, { status: 500 });
  }
}

// POST /api/pos/terminals — create a POS terminal
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['pos.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, terminalType, location, ipAddress, propertyId } = body;

    if (!name || !propertyId) {
      return NextResponse.json({ success: false, error: 'Name and propertyId are required' }, { status: 400 });
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found or access denied' }, { status: 400 });
    }

    const terminal = await db.posTerminal.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        terminalType: terminalType ?? 'restaurant',
        location: location ?? null,
        ipAddress: ipAddress ?? null,
      },
    });

    return NextResponse.json({ success: true, data: terminal }, { status: 201 });
  } catch (error) {
    console.error('Error creating POS terminal:', error);
    return NextResponse.json({ success: false, error: 'Failed to create terminal' }, { status: 500 });
  }
}

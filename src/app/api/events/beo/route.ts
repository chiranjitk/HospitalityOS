import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

function generateBeoNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const r = crypto.randomBytes(3).toString('hex').slice(0, 4);
  return `BEO-${y}${m}-${r}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.view', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const propertyId = sp.get('propertyId');
    const search = sp.get('search');
    const eventType = sp.get('eventType');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (eventType) where.eventType = eventType;
    if (search) where.OR = [
      { orderNumber: { contains: search } },
      { clientName: { contains: search } },
      { clientContact: { contains: search } },
    ];

    const data = await db.banquetEventOrder.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ functionDate: 'desc' }, { createdAt: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.banquetEventOrder.count({ where });
    const statusCounts = await db.banquetEventOrder.groupBy({ by: ['status'], where: { tenantId: user.tenantId }, _count: true });

    return NextResponse.json({
      success: true,
      data,
      pagination: { total, limit, offset },
      stats: { statusDistribution: statusCounts },
    });
  } catch (error) {
    console.error('GET /api/events/beo:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch BEOs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { propertyId, eventId, clientName, eventType, setupStyle, expectedPax,
      functionDate, startTime, endTime, venueId, menuNotes, beverageNotes,
      avRequirements, specialInstructions, items = [] } = body;

    if (!propertyId || !clientName || !functionDate || !expectedPax) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      return NextResponse.json({ success: false, error: 'startTime must be before endTime' }, { status: 400 });
    }

    const orderNumber = generateBeoNumber();
    const totalAmount = Math.round(items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + (i.unitPrice * i.quantity), 0));

    const beo = await db.banquetEventOrder.create({
      data: {
        tenantId: user.tenantId, propertyId, eventId: eventId || null,
        orderNumber, clientName, clientContact: body.clientContact,
        clientEmail: body.clientEmail, clientPhone: body.clientPhone,
        eventType: eventType || 'banquet', setupStyle: setupStyle || 'theater',
        expectedPax, functionDate: new Date(functionDate),
        startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : null,
        venueId: venueId || null, menuNotes, beverageNotes,
        avRequirements: avRequirements ? JSON.stringify(avRequirements) : '{}',
        specialInstructions, totalAmount, status: 'draft',
        items: {
          create: items.map((i: { category: string; description: string; quantity: number; unitPrice: number; notes?: string; sortOrder?: number }, idx: number) => ({
            category: i.category || 'food', description: i.description,
            quantity: i.quantity || 1, unitPrice: i.unitPrice || 0,
            totalPrice: Math.round((i.unitPrice || 0) * (i.quantity || 1)),
            notes: i.notes, sortOrder: i.sortOrder ?? idx,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: beo }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events/beo:', error);
    return NextResponse.json({ success: false, error: 'Failed to create BEO' }, { status: 500 });
  }
}

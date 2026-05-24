import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';

// GET /api/pos-reservations
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const guestName = searchParams.get('guestName');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
    }

    const where: Record<string, unknown> = { propertyId };

    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.date = { gte: start, lt: end };
    }
    if (status) where.status = status;
    if (guestName) where.guestName = { contains: guestName, mode: 'insensitive' };

    const reservations = await db.reservation.findMany({
      where,
      include: {
        table: { select: { id: true, number: true, name: true, capacity: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    return NextResponse.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reservations' } }, { status: 500 });
  }
}

// POST /api/pos-reservations
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const data = nullifyEmptyStrings(body);
    const { propertyId, tableId, guestName, guestPhone, guestEmail, date, time, partySize, duration = 90, specialRequests, occasion, source = 'manual' } = data;

    if (!propertyId || !guestName || !date || !time || !partySize) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId, guestName, date, time, and partySize are required' } }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });
    }

    // Validate table availability if tableId provided
    if (tableId) {
      const table = await db.restaurantTable.findFirst({
        where: { id: tableId, propertyId },
      });
      if (!table) {
        return NextResponse.json({ success: false, error: { code: 'INVALID_TABLE', message: 'Table not found' } }, { status: 400 });
      }
    }

    const reservation = await db.reservation.create({
      data: {
        propertyId,
        tableId: tableId || null,
        guestName,
        guestPhone,
        guestEmail,
        date: new Date(date),
        time,
        partySize,
        duration,
        specialRequests,
        occasion,
        source,
        status: 'pending',
      },
      include: { table: { select: { id: true, number: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create reservation' } }, { status: 500 });
  }
}

// PUT /api/pos-reservations
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, tableId, guestName, guestPhone, guestEmail, partySize, specialRequests, occasion, seatedAt, completedAt, cancelledAt } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.reservation.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (tableId !== undefined) data.tableId = tableId;
    if (guestName !== undefined) data.guestName = guestName;
    if (guestPhone !== undefined) data.guestPhone = guestPhone;
    if (guestEmail !== undefined) data.guestEmail = guestEmail;
    if (partySize !== undefined) data.partySize = partySize;
    if (specialRequests !== undefined) data.specialRequests = specialRequests;
    if (occasion !== undefined) data.occasion = occasion;
    if (seatedAt !== undefined) data.seatedAt = seatedAt ? new Date(seatedAt) : null;
    if (completedAt !== undefined) data.completedAt = completedAt ? new Date(completedAt) : null;
    if (cancelledAt !== undefined) data.cancelledAt = cancelledAt ? new Date(cancelledAt) : null;

    const reservation = await db.reservation.update({
      where: { id },
      data,
      include: { table: { select: { id: true, number: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update reservation' } }, { status: 500 });
  }
}

// DELETE /api/pos-reservations
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    const existing = await db.reservation.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });
    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 });
    }

    await db.reservation.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel reservation' } }, { status: 500 });
  }
}

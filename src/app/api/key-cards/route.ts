import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const VALID_TRANSITIONS: Record<string, string[]> = {
  issued: ['active', 'deactivated', 'lost'],
  active: ['deactivated', 'returned', 'lost'],
  deactivated: ['active'],
  returned: [],
  lost: [],
};

function generateCardNumber(): string {
  const prefix = 'KC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/key-cards - List key cards with filters and stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'rooms.view') && !hasPermission(user, 'rooms.*') && !hasPermission(user, 'bookings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const stats = searchParams.get('stats') === 'true';
    const status = searchParams.get('status');
    const roomId = searchParams.get('roomId');
    const guestId = searchParams.get('guestId');
    const propertyId = searchParams.get('propertyId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const bookingId = searchParams.get('bookingId');

    // Analytics endpoint
    if (stats) {
      const tenantWhere = { tenantId: user.tenantId };
      const propFilter = propertyId ? { ...tenantWhere, propertyId } : tenantWhere;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalCards,
        issuedToday,
        activeCards,
        deactivatedCards,
        returnedCards,
        lostCards,
        overdueCards,
      ] = await Promise.all([
        db.keyCard.count({ where: propFilter }),
        db.keyCard.count({
          where: { ...propFilter, issuedAt: { gte: today } },
        }),
        db.keyCard.count({ where: { ...propFilter, status: 'active' } }),
        db.keyCard.count({ where: { ...propFilter, status: 'deactivated' } }),
        db.keyCard.count({ where: { ...propFilter, status: 'returned' } }),
        db.keyCard.count({ where: { ...propFilter, status: 'lost' } }),
        db.keyCard.count({
          where: {
            ...propFilter,
            status: 'active',
            validTo: { lt: new Date() },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          total: totalCards,
          issuedToday,
          active: activeCards,
          deactivated: deactivatedCards,
          returned: returnedCards,
          lost: lostCards,
          overdue: overdueCards,
        },
      });
    }

    // List endpoint
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (roomId) where.roomId = roomId;
    if (guestId) where.guestId = guestId;
    if (bookingId) where.bookingId = bookingId;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.issuedAt = dateFilter;
    }

    const keyCards = await db.keyCard.findMany({
      where,
      include: {
        room: {
          select: { id: true, number: true, floor: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: keyCards,
    });
  } catch (error) {
    console.error('Error fetching key cards:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch key cards' } },
      { status: 500 }
    );
  }
}

// POST /api/key-cards - Issue a new key card
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'bookings.create') && !hasPermission(user, 'bookings.*') && !hasPermission(user, 'rooms.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      roomId,
      guestId,
      bookingId,
      cardType = 'physical',
      accessLevel = 'standard',
      validFrom,
      validTo,
      notes,
    } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomId is required' } },
        { status: 400 }
      );
    }

    // Validate room exists and belongs to tenant
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { property: { select: { id: true, tenantId: true } } },
    });

    if (!room || room.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    // Verify room has an active booking (checked-in) before issuing card
    const activeBooking = await db.booking.findFirst({
      where: {
        roomId,
        status: { in: ['confirmed', 'checked_in'] },
        tenantId: user.tenantId,
      },
    });
    if (!activeBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ACTIVE_BOOKING', message: 'Cannot issue key card: no active booking found for this room' } },
        { status: 400 }
      );
    }

    // Validate guest if provided
    if (guestId) {
      const guest = await db.guest.findUnique({
        where: { id: guestId },
        select: { tenantId: true },
      });
      if (!guest || guest.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
          { status: 404 }
        );
      }
    }

    // Generate unique card number
    let cardNumber = generateCardNumber();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.keyCard.findUnique({ where: { cardNumber } });
      if (!existing) break;
      cardNumber = generateCardNumber();
      attempts++;
    }

    const keyCard = await db.keyCard.create({
      data: {
        tenantId: user.tenantId,
        propertyId: room.property.id,
        roomId,
        guestId: guestId || null,
        bookingId: bookingId || null,
        cardNumber,
        cardType,
        issuerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'System',
        status: 'issued',
        accessLevel,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        notes: notes || null,
      },
      include: {
        room: {
          select: { id: true, number: true, floor: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: keyCard }, { status: 201 });
  } catch (error) {
    console.error('Error issuing key card:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to issue key card' } },
      { status: 500 }
    );
  }
}

// PUT /api/key-cards - Update key card status
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'bookings.update') && !hasPermission(user, 'bookings.*') && !hasPermission(user, 'rooms.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, notes } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and action are required' } },
        { status: 400 }
      );
    }

    const validActions = ['activate', 'deactivate', 'return', 'lose'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
        { status: 400 }
      );
    }

    // Fetch existing key card
    const existingCard = await db.keyCard.findUnique({
      where: { id },
    });

    if (!existingCard) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Key card not found' } },
        { status: 404 }
      );
    }

    if (existingCard.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Key card does not belong to your tenant' } },
        { status: 403 }
      );
    }

    // Validate status transition
    const newStatus = action === 'activate' ? 'active'
      : action === 'deactivate' ? 'deactivated'
      : action === 'return' ? 'returned'
      : 'lost';

    // Check for expired cards before activating
    if (newStatus === 'active' && existingCard.validTo && new Date(existingCard.validTo) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'CARD_EXPIRED', message: 'Cannot activate an expired key card' } },
        { status: 400 }
      );
    }

    const allowedTransitions = VALID_TRANSITIONS[existingCard.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TRANSITION', message: `Cannot transition from '${existingCard.status}' to '${newStatus}'. Allowed: ${allowedTransitions.join(', ') || 'none'}` } },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      notes: notes || existingCard.notes,
    };

    if (newStatus === 'active') {
      updateData.activatedAt = new Date();
    } else if (newStatus === 'deactivated') {
      updateData.deactivatedAt = new Date();
    } else if (newStatus === 'returned') {
      updateData.returnedAt = new Date();
      updateData.returnReason = notes || 'Guest returned card';
    }

    const updatedCard = await db.keyCard.update({
      where: { id },
      data: updateData,
      include: {
        room: {
          select: { id: true, number: true, floor: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedCard });
  } catch (error) {
    console.error('Error updating key card:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update key card' } },
      { status: 500 }
    );
  }
}

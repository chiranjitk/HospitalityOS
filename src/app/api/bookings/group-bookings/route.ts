import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  recalcGroupFolio,
  createGroupFolio,
  applyPaymentToGroupFolio,
  closeGroupFolio,
  getGroupFolioWithBreakdown,
} from '@/lib/billing/group-folio';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// GET /api/bookings/group-bookings
//   ?propertyId=... &status=...
//
// Lists group bookings. Optionally includes consolidated folio breakdown.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.view', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId');
    const status = sp.get('status');
    const includeFolio = sp.get('includeFolio') === 'true';
    const limit = sp.get('limit');
    const offset = sp.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;

    const take = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;
    const skip = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;

    const groupBookings = await db.groupBooking.findMany({
      where,
      include: {
        bookings: {
          where: { deletedAt: null },
          select: {
            id: true,
            confirmationCode: true,
            status: true,
            totalAmount: true,
            paymentStatus: true,
            primaryGuest: { select: { firstName: true, lastName: true, email: true } },
            room: { select: { number: true } },
          },
        },
        ...(includeFolio && {
          groupFolios: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              subtotal: true,
              taxes: true,
              totalAmount: true,
              paidAmount: true,
              balance: true,
              currency: true,
            },
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    const total = await db.groupBooking.count({ where });

    return NextResponse.json({
      success: true,
      data: groupBookings,
      pagination: { total, limit: take, offset: skip },
    });
  } catch (error) {
    console.error('[GroupBookings GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group bookings' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/bookings/group-bookings
//
// Body actions:
//   - { action: "create", ...groupBookingData }  — Create a group booking + GroupFolio
//   - { action: "create_folio", groupBookingId } — Create/recalc GroupFolio for existing group
//   - { action: "recalc", groupFolioId }       — Recalculate a GroupFolio
//   - { action: "payment", groupFolioId, amount, method, ... } — Apply payment
//   - { action: "close", groupFolioId }       — Close/settle a GroupFolio
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      // -----------------------------------------------------------------------
      // Create a new group booking and auto-create its GroupFolio
      // -----------------------------------------------------------------------
      case 'create': {
        const {
          propertyId,
          name,
          description,
          contactName,
          contactEmail,
          contactPhone,
          checkIn,
          checkOut,
          totalRooms = 1,
          totalAmount = 0,
          depositAmount = 0,
          currency,
        } = body;

        if (!propertyId || !name || !checkIn || !checkOut) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, checkIn, checkOut' } },
            { status: 400 },
          );
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (checkInDate >= checkOutDate) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
            { status: 400 },
          );
        }

        // Verify property exists
        const prop = await db.property.findFirst({
          where: { id: propertyId, tenantId: user.tenantId },
          select: { id: true, currency: true },
        });
        if (!prop) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property not found' } },
            { status: 400 },
          );
        }

        const groupBooking = await db.groupBooking.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            name,
            description: description || null,
            contactName: contactName || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalRooms,
            totalAmount,
            depositAmount,
            status: 'inquiry',
          },
        });

        // Auto-create the consolidated GroupFolio
        const groupFolio = await createGroupFolio({
          tenantId: user.tenantId,
          propertyId,
          groupBookingId: groupBooking.id,
          currency: currency || prop.currency,
        });

        return NextResponse.json(
          { success: true, data: { groupBooking, groupFolio } },
          { status: 201 },
        );
      }

      // -----------------------------------------------------------------------
      // Create or recalculate a GroupFolio for an existing group booking
      // -----------------------------------------------------------------------
      case 'create_folio': {
        const { groupBookingId, organizerGuestId } = body;

        if (!groupBookingId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupBookingId is required' } },
            { status: 400 },
          );
        }

        const gb = await db.groupBooking.findUnique({
          where: { id: groupBookingId, tenantId: user.tenantId },
          select: { id: true, propertyId: true },
        });
        if (!gb) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
            { status: 404 },
          );
        }

        const groupFolio = await createGroupFolio({
          tenantId: user.tenantId,
          propertyId: gb.propertyId,
          groupBookingId: gb.id,
          organizerGuestId,
        });

        return NextResponse.json({ success: true, data: groupFolio });
      }

      // -----------------------------------------------------------------------
      // Recalculate a GroupFolio
      // -----------------------------------------------------------------------
      case 'recalc': {
        const { groupFolioId } = body;

        if (!groupFolioId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupFolioId is required' } },
            { status: 400 },
          );
        }

        const folio = await db.groupFolio.findUnique({
          where: { id: groupFolioId, tenantId: user.tenantId },
        });
        if (!folio) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
            { status: 404 },
          );
        }

        const recalculated = await recalcGroupFolio(groupFolioId);
        return NextResponse.json({ success: true, data: recalculated });
      }

      // -----------------------------------------------------------------------
      // Apply a payment to the group folio and distribute to child folios
      // -----------------------------------------------------------------------
      case 'payment': {
        const {
          groupFolioId,
          amount,
          method = 'bank_transfer',
          reference,
          description,
          distributeToChildFolios = true,
        } = body;

        if (!groupFolioId || !amount || amount <= 0) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupFolioId and a positive amount are required' } },
            { status: 400 },
          );
        }

        const folio = await db.groupFolio.findUnique({
          where: { id: groupFolioId, tenantId: user.tenantId },
          select: { id: true, propertyId: true },
        });
        if (!folio) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
            { status: 404 },
          );
        }

        const result = await applyPaymentToGroupFolio({
          groupFolioId,
          tenantId: user.tenantId,
          propertyId: folio.propertyId,
          amount,
          method,
          reference,
          description,
          processedBy: user.id,
          distributeToChildFolios,
        });

        return NextResponse.json({ success: true, data: result });
      }

      // -----------------------------------------------------------------------
      // Close/settle the group folio
      // -----------------------------------------------------------------------
      case 'close': {
        const { groupFolioId } = body;

        if (!groupFolioId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupFolioId is required' } },
            { status: 400 },
          );
        }

        const folio = await db.groupFolio.findUnique({
          where: { id: groupFolioId, tenantId: user.tenantId },
        });
        if (!folio) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
            { status: 404 },
          );
        }

        const result = await closeGroupFolio(groupFolioId);
        return NextResponse.json({ success: true, data: result });
      }

      // -----------------------------------------------------------------------
      // Get full breakdown of a group folio
      // -----------------------------------------------------------------------
      case 'breakdown': {
        const { groupFolioId } = body;

        if (!groupFolioId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'groupFolioId is required' } },
            { status: 400 },
          );
        }

        const folio = await db.groupFolio.findUnique({
          where: { id: groupFolioId, tenantId: user.tenantId },
        });
        if (!folio) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
            { status: 404 },
          );
        }

        // Recalculate first
        await recalcGroupFolio(groupFolioId);

        const breakdown = await getGroupFolioWithBreakdown(groupFolioId);
        return NextResponse.json({ success: true, data: breakdown });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` } },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[GroupBookings POST] Error:', error);

    if (error instanceof Error) {
      const errorMap: Record<string, { code: string; message: string; status: number }> = {
        GROUP_FOLIO_NOT_FOUND: { code: 'NOT_FOUND', message: 'Group folio not found', status: 404 },
        FOLIO_CLOSED: { code: 'FOLIO_CLOSED', message: 'Group folio is already closed', status: 400 },
        FOLIO_ALREADY_CLOSED: { code: 'FOLIO_CLOSED', message: 'Group folio is already closed', status: 400 },
        INVALID_AMOUNT: { code: 'VALIDATION_ERROR', message: 'Payment amount must be positive', status: 400 },
      };

      const mapped = errorMap[error.message];
      if (mapped) {
        return NextResponse.json(
          { success: false, error: { code: mapped.code, message: mapped.message } },
          { status: mapped.status },
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process group booking request' } },
      { status: 500 },
    );
  }
}

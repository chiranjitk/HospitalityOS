import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// Late checkout fee tiers based on requested time after standard 11 AM checkout
function calculateLateCheckoutFee(requestedUntil: Date, nightlyRate: number): {
  feeAmount: number;
  feeTier: string;
  feePercentage: number;
} {
  // Standard checkout is 11 AM
  const hoursLate = (() => {
    const checkout = new Date(requestedUntil);
    checkout.setHours(11, 0, 0, 0);
    const diffMs = requestedUntil.getTime() - checkout.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  })();

  let feePercentage: number;
  let feeTier: string;

  if (hoursLate <= 3) {
    // Until 2 PM
    feePercentage = 0.25;
    feeTier = 'until_2pm';
  } else if (hoursLate <= 5) {
    // Until 4 PM
    feePercentage = 0.50;
    feeTier = 'until_4pm';
  } else if (hoursLate <= 7) {
    // Until 6 PM
    feePercentage = 0.75;
    feeTier = 'until_6pm';
  } else {
    // After 6 PM - full night charge
    feePercentage = 1.0;
    feeTier = 'after_6pm';
  }

  return {
    feeAmount: parseFloat((nightlyRate * feePercentage).toFixed(2)),
    feeTier,
    feePercentage,
  };
}

// GET /api/bookings/late-checkout - List late check-out requests with stats
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const bookingId = searchParams.get('bookingId');

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const entries = await db.lateCheckoutRequest.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
            roomRate: true,
            currency: true,
            checkOut: true,
            roomType: { select: { id: true, name: true, basePrice: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with guest info
    const guestIds = [...new Set(entries.map((e) => e.guestId))];
    const guests = await db.guest.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, firstName: true, lastName: true, loyaltyTier: true, isVip: true, totalStays: true },
    });
    const guestMap = new Map(guests.map((g) => [g.id, g]));

    const enriched = entries.map((entry) => ({
      ...entry,
      guest: guestMap.get(entry.guestId) || null,
    }));

    // Stats
    const baseWhere: Record<string, unknown> = { tenantId };
    if (propertyId) baseWhere.propertyId = propertyId;

    const stats = {
      total: await db.lateCheckoutRequest.count({ where: baseWhere }),
      pending: await db.lateCheckoutRequest.count({ where: { ...baseWhere, status: 'pending' } }),
      approved: await db.lateCheckoutRequest.count({ where: { ...baseWhere, status: 'approved' } }),
      rejected: await db.lateCheckoutRequest.count({ where: { ...baseWhere, status: 'rejected' } }),
      completed: await db.lateCheckoutRequest.count({ where: { ...baseWhere, status: 'completed' } }),
      totalFeesCollected: (
        await db.lateCheckoutRequest.aggregate({
          where: { ...baseWhere, feeStatus: 'paid' },
          _sum: { feeAmount: true },
        })
      )._sum.feeAmount || 0,
      totalFeesWaived: (
        await db.lateCheckoutRequest.aggregate({
          where: { ...baseWhere, feeStatus: 'waived' },
          _sum: { feeAmount: true },
        })
      )._sum.feeAmount || 0,
      loyaltyWaivedCount: await db.lateCheckoutRequest.count({
        where: { ...baseWhere, loyaltyWaived: true },
      }),
    };

    return NextResponse.json({ success: true, data: enriched, stats });
  } catch (error) {
    console.error('[LateCheckout] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch late check-out requests' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings/late-checkout - Create late checkout request with fee calculation
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { bookingId, requestedUntil, reason } = body;

    if (!bookingId || !requestedUntil) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId and requestedUntil are required' } },
        { status: 400 }
      );
    }

    // Fetch booking with room type and guest info
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        roomType: { select: { basePrice: true } },
        primaryGuest: { select: { id: true, loyaltyTier: true, isVip: true, totalStays: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Booking must be confirmed or checked in' } },
        { status: 400 }
      );
    }

    const requestedUntilDate = new Date(requestedUntil);
    const standardCheckout = new Date(booking.checkOut);

    // Read check-out time from property settings instead of hardcoding 11
    let checkOutHour = 11;
    try {
      const lateProp = await db.property.findUnique({
        where: { id: booking.propertyId },
        select: { settings: true },
      });
      if (lateProp?.settings) {
        const parsed = JSON.parse(lateProp.settings);
        if (parsed.checkOutTime !== undefined) {
          checkOutHour = parseInt(parsed.checkOutTime, 10) || 11;
        }
      }
    } catch { /* use default */ }

    standardCheckout.setHours(checkOutHour, 0, 0, 0);

    // Ensure requested time is after standard checkout
    if (requestedUntilDate <= standardCheckout) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Requested time must be after standard check-out (${checkOutHour}:00)` } },
        { status: 400 }
      );
    }

    // Check for existing pending/approved late checkout request for this booking
    const existingRequest = await db.lateCheckoutRequest.findFirst({
      where: {
        bookingId,
        status: { in: ['pending', 'approved'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_REQUEST', message: 'An active late check-out request already exists for this booking' } },
        { status: 409 }
      );
    }

    // Calculate fee
    const nightlyRate = booking.roomRate || booking.roomType.basePrice;
    const { feeAmount, feeTier, feePercentage } = calculateLateCheckoutFee(requestedUntilDate, nightlyRate);

    // Auto-waive for Gold+ loyalty tier
    const loyaltyTier = booking.primaryGuest.loyaltyTier || 'bronze';
    const loyaltyWaived = ['gold', 'platinum', 'diamond'].includes(loyaltyTier.toLowerCase());

    // Auto-approve for returning VIP guests (3+ stays)
    const isReturningVip = booking.primaryGuest.totalStays >= 3;
    const isAutoApproved = loyaltyWaived || isReturningVip;

    const effectiveFeeAmount = loyaltyWaived ? 0 : feeAmount;
    const entry = await db.lateCheckoutRequest.create({
      data: {
        bookingId,
        tenantId,
        propertyId: booking.propertyId,
        guestId: booking.primaryGuestId,
        requestedUntil: requestedUntilDate,
        feeAmount: effectiveFeeAmount,
        feeStatus: loyaltyWaived ? 'waived' : 'pending',
        loyaltyWaived,
        reason,
        status: isAutoApproved ? 'approved' : 'pending',
        approvedAt: isAutoApproved ? new Date() : null,
      },
    });

    // Post late checkout fee to folio when auto-approved with a fee
    if (isAutoApproved && effectiveFeeAmount > 0) {
      try {
        await postLateCheckoutFeeToFolio({
          bookingId,
          tenantId,
          feeAmount: effectiveFeeAmount,
          feeTier,
        });
      } catch (folioError) {
        console.error('[LateCheckout] Failed to post auto-approved fee to folio:', folioError);
        // Don't fail the approval if folio posting fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...entry,
          guest: booking.primaryGuest,
          loyaltyTier,
          loyaltyWaived,
          autoApproved: isAutoApproved,
          isReturningVip,
          feeTier,
          feePercentage,
          nightlyRate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[LateCheckout] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create late check-out request' } },
      { status: 500 }
    );
  }
}

// PUT /api/bookings/late-checkout - Approve/reject a late checkout request (manual)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  try {
    const body = await request.json();
    const { id, status, waiveFee } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and status are required' } },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be "approved" or "rejected"' } },
        { status: 400 }
      );
    }

    const existing = await db.lateCheckoutRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Late checkout request not found' } },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Can only approve/reject pending requests' } },
        { status: 400 }
      );
    }

    const effectiveFee = waiveFee ? 0 : existing.feeAmount;
    const updated = await db.lateCheckoutRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: userId,
        approvedAt: new Date(),
        feeAmount: effectiveFee,
        feeStatus: waiveFee ? 'waived' : (effectiveFee > 0 ? 'pending' : 'waived'),
      },
    });

    // Post late checkout fee to folio when approved with a fee
    if (status === 'approved' && effectiveFee > 0) {
      try {
        await postLateCheckoutFeeToFolio({
          bookingId: existing.bookingId,
          tenantId,
          feeAmount: effectiveFee,
          feeTier: 'manual',
        });
      } catch (folioError) {
        console.error('[LateCheckout] Failed to post fee to folio on approval:', folioError);
        // Don't fail the approval if folio posting fails
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[LateCheckout] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update late check-out request' } },
      { status: 500 }
    );
  }
}

// Helper: Post late checkout fee to the booking's open folio
async function postLateCheckoutFeeToFolio(params: {
  bookingId: string;
  tenantId: string;
  feeAmount: number;
  feeTier: string;
}) {
  const { bookingId, tenantId, feeAmount, feeTier } = params;

  const folio = await db.folio.findFirst({
    where: { bookingId, tenantId, status: { in: ['open', 'partially_paid'] } },
  });

  if (!folio) {
    console.warn(`[LateCheckout] No open folio found for booking ${bookingId} — cannot post late checkout fee`);
    return;
  }

  // Look up property tax rate
  let lateTaxRate = 0;
  try {
    const folioProp = await db.property.findUnique({
      where: { id: folio.propertyId },
      select: { defaultTaxRate: true, taxComponents: true },
    });
    if (folioProp) {
      if (folioProp.taxComponents) {
        const tc = JSON.parse(folioProp.taxComponents);
        if (Array.isArray(tc) && tc.length > 0) {
          lateTaxRate = tc.reduce((s: number, c: { rate: number }) => s + (c.rate || 0), 0) / 100;
        } else {
          lateTaxRate = (folioProp.defaultTaxRate || 0) / 100;
        }
      } else {
        lateTaxRate = (folioProp.defaultTaxRate || 0) / 100;
      }
    }
  } catch { /* use default 0 */ }

  const lateTaxAmount = Math.round(feeAmount * lateTaxRate * 100) / 100;
  const lateTotalWithTax = Math.round((feeAmount + lateTaxAmount) * 100) / 100;

  await db.$transaction(async (tx) => {
    await tx.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Late Checkout Fee (${feeTier})`,
        category: 'late_checkout',
        quantity: 1,
        unitPrice: feeAmount,
        totalAmount: lateTotalWithTax,
        taxRate: Math.round(lateTaxRate * 100) / 100,
        taxAmount: lateTaxAmount,
        serviceDate: new Date(),
      },
    });

    // Recalculate folio totals
    const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
    const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
    const newTaxes = allLineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    // BALANCE FIX: include discount in totalAmount calculation
    const newTotalAmount = Math.round((newSubtotal + newTaxes - (folio.discount || 0)) * 100) / 100;
    // BALANCE FIX: balance = totalAmount - paidAmount (was missing discount before)
    const newBalance = Math.max(0, Math.round((newTotalAmount - (folio.paidAmount || 0)) * 100) / 100);
    await tx.folio.update({
      where: { id: folio.id },
      data: {
        subtotal: Math.round(newSubtotal * 100) / 100,
        taxes: Math.round(newTaxes * 100) / 100,
        totalAmount: newTotalAmount,
        balance: newBalance,
      },
    });
  });

  console.log(`[LateCheckout] Posted late checkout fee of ${feeAmount} (+tax ${lateTaxAmount}) to folio ${folio.id} for booking ${bookingId}`);
}

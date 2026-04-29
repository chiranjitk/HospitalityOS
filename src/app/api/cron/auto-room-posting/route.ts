/**
 * Auto Room Charge Posting Cron Job
 *
 * GET /api/cron/auto-room-posting
 * Returns last execution status and pending count info. Called by cron/scheduler.
 *
 * POST /api/cron/auto-room-posting
 * Manual trigger endpoint for a specific propertyId (requires authentication).
 * Posts room charges for all checked-in bookings that don't have today's charge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { calculateRoomCharge, getTodayUTC, formatDateForDescription, type RoomChargeResult } from '@/lib/billing/room-charge';

// ─── Execution tracking (in-memory) ──────────────────────────────────────────

let lastExecution: {
  timestamp: Date;
  chargesPosted: number;
  bookingsProcessed: number;
  errors: string[];
  details: PostedChargeDetail[];
} | null = null;

interface PostedChargeDetail {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  roomNumber: string;
  folioId: string;
  folioNumber: string;
  lineItemDescription: string;
  baseRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  rateSource: string;
}

// ─── Cron Secret ──────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
const CRON_SECRET_VALUE = CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

// ─── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Process auto room charge posting for a specific property.
 * Uses db.$transaction for each booking to ensure atomicity.
 */
async function processAutoRoomPosting(propertyId: string) {
  const today = getTodayUTC();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const details: PostedChargeDetail[] = [];
  const errors: string[] = [];
  let chargesPosted = 0;
  let bookingsProcessed = 0;

  // Find all checked-in bookings for the property that are currently in-house
  const bookings = await db.booking.findMany({
    where: {
      propertyId,
      status: 'checked_in',
      deletedAt: null,
      checkIn: { lte: tomorrow },
      checkOut: { gt: today },
    },
    include: {
      primaryGuest: {
        select: { id: true, firstName: true, lastName: true },
      },
      room: {
        select: { id: true, number: true },
      },
      ratePlan: {
        select: { id: true, basePrice: true, name: true, code: true },
      },
      folios: {
        where: { status: 'open' },
        select: { id: true, folioNumber: true },
      },
      property: {
        select: {
          id: true,
          currency: true,
          taxType: true,
          defaultTaxRate: true,
          taxComponents: true,
          serviceChargePercent: true,
          includeTaxInPrice: true,
        },
      },
    },
  });

  for (const booking of bookings) {
    bookingsProcessed++;

    try {
      // Skip bookings without an open folio
      if (!booking.folios || booking.folios.length === 0) {
        errors.push(
          `Booking ${booking.confirmationCode}: No open folio found`
        );
        continue;
      }

      const folio = booking.folios[0];

      // Check if today's room charge has already been posted
      const existingCharge = await db.folioLineItem.findFirst({
        where: {
          folioId: folio.id,
          category: 'room_charge',
          serviceDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (existingCharge) {
        continue; // Already posted
      }

      // Calculate the room charge
      const charge = await calculateRoomCharge(
        {
          id: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          roomTypeId: booking.roomTypeId,
          ratePlanId: booking.ratePlanId,
          roomRate: booking.roomRate,
          currency: booking.currency,
        },
        booking.property,
        today
      );

      if (charge.baseRate <= 0) {
        errors.push(
          `Booking ${booking.confirmationCode}: Room rate is 0 or could not be determined`
        );
        continue;
      }

      // Post the charge within a transaction
      const description = `Room Charge - ${formatDateForDescription(today)}`;

      await db.$transaction(async (tx) => {
        // Create the line item
        await tx.folioLineItem.create({
          data: {
            folioId: folio.id,
            description,
            category: 'room_charge',
            quantity: 1,
            unitPrice: charge.baseRate,
            totalAmount: charge.baseRate,
            serviceDate: today,
            referenceType: 'booking',
            referenceId: booking.id,
            taxRate: charge.baseRate > 0 ? (charge.taxAmount / charge.baseRate) * 100 : 0,
            taxAmount: charge.taxAmount,
            postedBy: 'system:auto_room_posting',
          },
        });

        // Update folio totals
        await tx.folio.update({
          where: { id: folio.id },
          data: {
            subtotal: { increment: charge.baseRate },
            taxes: { increment: charge.taxAmount },
            totalAmount: { increment: charge.baseRate + charge.taxAmount },
            balance: { increment: charge.baseRate + charge.taxAmount },
          },
        });
      });

      details.push({
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        roomNumber: booking.room?.number || 'N/A',
        folioId: folio.id,
        folioNumber: folio.folioNumber,
        lineItemDescription: description,
        baseRate: charge.baseRate,
        taxAmount: charge.taxAmount,
        totalAmount: charge.totalAmount,
        currency: charge.currency,
        rateSource: charge.rateSource,
      });

      chargesPosted++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Booking ${booking.confirmationCode}: ${message}`);
    }
  }

  // Update last execution tracking
  lastExecution = {
    timestamp: new Date(),
    chargesPosted,
    bookingsProcessed,
    errors,
    details,
  };

  return {
    chargesPosted,
    bookingsProcessed,
    errors,
    details,
  };
}

/**
 * Count how many rooms are pending today's charge for a property.
 */
async function getPendingChargeCount(propertyId: string): Promise<number> {
  const today = getTodayUTC();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const checkedInBookings = await db.booking.findMany({
    where: {
      propertyId,
      status: 'checked_in',
      deletedAt: null,
      checkIn: { lte: tomorrow },
      checkOut: { gt: today },
      folios: { some: { status: 'open' } },
    },
    select: {
      id: true,
      folios: {
        where: { status: 'open' },
        select: { id: true },
      },
    },
  });

  let pending = 0;
  for (const booking of checkedInBookings) {
    const folioId = booking.folios[0]?.id;
    if (!folioId) continue;

    const existingCharge = await db.folioLineItem.findFirst({
      where: {
        folioId,
        category: 'room_charge',
        serviceDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!existingCharge) {
      pending++;
    }
  }

  return pending;
}

// ─── GET: Status & Cron trigger ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // For cron scheduler: verify secret
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  const searchParams = request.nextUrl.searchParams;
  const cronMode = searchParams.get('cron') === 'true';

  if (cronMode) {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
    }
    if (providedSecret !== CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Cron mode: process all properties
    try {
      const properties = await db.property.findMany({
        where: { status: 'active', deletedAt: null },
        select: { id: true, name: true },
      });

      let totalCharges = 0;
      let totalBookings = 0;
      const allErrors: string[] = [];
      const allDetails: PostedChargeDetail[] = [];

      for (const prop of properties) {
        const result = await processAutoRoomPosting(prop.id);
        totalCharges += result.chargesPosted;
        totalBookings += result.bookingsProcessed;
        allErrors.push(...result.errors);
        allDetails.push(...result.details);
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${totalBookings} bookings across ${properties.length} properties: ${totalCharges} charges posted`,
        data: {
          propertiesProcessed: properties.length,
          bookingsProcessed: totalBookings,
          chargesPosted: totalCharges,
          errors: allErrors,
          details: allDetails,
        },
      });
    } catch (error) {
      console.error('[Cron] Auto room posting error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  // Non-cron mode: authenticated user requesting status/pending info
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const propertyId = searchParams.get('propertyId');

  try {
    const pendingCount = propertyId
      ? await getPendingChargeCount(propertyId)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        endpoint: '/api/cron/auto-room-posting',
        lastExecution: lastExecution
          ? {
              timestamp: lastExecution.timestamp,
              chargesPosted: lastExecution.chargesPosted,
              bookingsProcessed: lastExecution.bookingsProcessed,
              errorCount: lastExecution.errors.length,
            }
          : null,
        pendingChargeCount: pendingCount,
      },
    });
  } catch (error) {
    console.error('Error fetching auto-posting status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

// ─── POST: Manual trigger ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // RBAC check
  if (
    !hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*', 'folios.create']) &&
    user.roleName !== 'admin'
  ) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to post room charges' } },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { propertyId } = body;

  if (!propertyId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
      { status: 400 }
    );
  }

  try {
    // Verify the property belongs to the user's tenant
    const property = await db.property.findFirst({
      where: {
        id: propertyId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    const result = await processAutoRoomPosting(propertyId);

    return NextResponse.json({
      success: true,
      message: `Processed ${result.bookingsProcessed} bookings: ${result.chargesPosted} room charges posted`,
      data: {
        propertyId,
        propertyName: property.name,
        bookingsProcessed: result.bookingsProcessed,
        chargesPosted: result.chargesPosted,
        errors: result.errors,
        details: result.details,
      },
    });
  } catch (error) {
    console.error('Error in manual auto room posting:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to post room charges' },
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

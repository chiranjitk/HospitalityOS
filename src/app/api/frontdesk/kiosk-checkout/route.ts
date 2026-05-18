import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { emitBookingCheckedOut } from '@/lib/events/booking-events';
import { markRoomDirtyAfterCheckout } from '@/lib/housekeeping-automation';

// POST /api/frontdesk/kiosk-checkout - Process express check-out from kiosk
export async function POST(request: NextRequest) {
  try {
    // Basic authentication — kiosk should present a valid token
    const { getUserFromRequest } = await import('@/lib/auth-helpers');
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Zod validation for request body
    const checkoutSchema = z.object({
      bookingId: z.string().uuid('bookingId must be a valid UUID'),
      forceCheckout: z.boolean().optional(),
    });

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    const { bookingId, forceCheckout } = parsed.data;

    // Fetch booking with all needed relations — must be checked_in and not soft-deleted
    const booking = await db.booking.findFirst({
      where: { id: bookingId, status: 'checked_in', deletedAt: null },
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        room: { select: { id: true, number: true, floor: true, status: true } },
        property: { select: { id: true, name: true, tenantId: true } },
        roomType: { select: { id: true, name: true } },
        folios: {
          select: { id: true, balance: true, totalAmount: true, paidAmount: true, status: true },
          where: { status: 'open' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No checked-in booking found with this ID',
          },
        },
        { status: 404 }
      );
    }

    if (!booking.room) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ROOM',
            message: 'No room assigned to this booking',
          },
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check for outstanding balance before checkout (matches admin checkout H-01 fix)
    const openFolio = await db.folio.findFirst({
      where: { bookingId: booking.id, status: { in: ['open', 'partially_paid'] } },
      select: { balance: true, totalAmount: true, paidAmount: true },
    });
    if (openFolio && openFolio.balance > 0) {
      if (!forceCheckout) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'OUTSTANDING_BALANCE',
              message: 'Cannot check out while the booking has an outstanding balance. Please settle the balance or use force checkout.',
              details: {
                balance: openFolio.balance,
                totalAmount: openFolio.totalAmount,
                paidAmount: openFolio.paidAmount,
                confirmationCode: booking.confirmationCode,
              },
            },
          },
          { status: 400 }
        );
      }
      console.warn(`[Kiosk Check-out] Booking ${booking.confirmationCode} force-checking out with outstanding balance: ${openFolio.balance}`);
    }

    // Process ALL checkout side-effects in a single transaction for data integrity
    const updatedBooking = await db.$transaction(async (tx) => {
      // 1. Post WiFi usage fees to folio BEFORE closing it
      const activeWifiSessions = await tx.wiFiSession.findMany({
        where: {
          OR: [
            { bookingId: booking.id },
            { guestId: booking.primaryGuestId },
          ],
          status: 'active',
        },
        include: { plan: true },
      });

      if (activeWifiSessions.length > 0) {
        let totalWifiFee = 0;
        const planDetails: string[] = [];

        for (const session of activeWifiSessions) {
          if (session.plan && session.plan.price > 0) {
            totalWifiFee += session.plan.price;
            planDetails.push(session.plan.name);
          }
        }

        if (totalWifiFee > 0) {
          // Close any active WiFi sessions
          await tx.wiFiSession.updateMany({
            where: { id: { in: activeWifiSessions.map(s => s.id) } },
            data: { status: 'disconnected', endTime: new Date() },
          });

          // Find open folio for the booking
          const wifiFolio = await tx.folio.findFirst({
            where: { bookingId: booking.id, tenantId: booking.tenantId, status: { in: ['open', 'partially_paid'] } },
          });

          if (wifiFolio) {
            await tx.folioLineItem.create({
              data: {
                folioId: wifiFolio.id,
                description: `WiFi Usage Charges (${planDetails.join(', ')})`,
                category: 'wifi',
                quantity: 1,
                unitPrice: totalWifiFee,
                totalAmount: totalWifiFee,
                serviceDate: new Date(),
                postedBy: 'kiosk-self-service',
              },
            });

            // Recalculate folio totals
            const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: wifiFolio.id } });
            const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
            await tx.folio.update({
              where: { id: wifiFolio.id },
              data: {
                subtotal: newSubtotal,
                totalAmount: newSubtotal + wifiFolio.taxes - wifiFolio.discount,
                balance: Math.max(0, newSubtotal - wifiFolio.paidAmount),
              },
            });
          }
        }
      }

      // 2. Update booking status to checked_out
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'checked_out',
          actualCheckOut: now,
          checkedOutBy: 'kiosk-self-service',
        },
        include: {
          primaryGuest: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          room: { select: { id: true, number: true, floor: true } },
          roomType: { select: { id: true, name: true } },
          property: { select: { id: true, name: true, tenantId: true } },
          folios: {
            select: {
              id: true,
              balance: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
            },
            where: { status: 'open' },
          },
        },
      });

      // 3. Update room status to dirty and mark for housekeeping
      await tx.room.update({
        where: { id: booking.room.id },
        data: {
          status: 'dirty',
          housekeepingStatus: 'dirty',
        },
      });

      // 4. Close folio and generate invoice
      const folio = await tx.folio.findFirst({
        where: { bookingId, status: { in: ['open', 'partially_paid'] } },
      });
      if (folio) {
        await tx.folio.update({
          where: { id: folio.id },
          data: { status: 'closed', closedAt: new Date() },
        });

        // Auto-generate invoice
        const bookingWithGuest = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { primaryGuest: true, room: { include: { roomType: true } } },
        });

        const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').slice(0, 4)}`;

        await tx.invoice.create({
          data: {
            tenantId: folio.tenantId,
            invoiceNumber,
            folioId: folio.id,
            customerName: bookingWithGuest?.primaryGuest ? `${bookingWithGuest.primaryGuest.firstName} ${bookingWithGuest.primaryGuest.lastName}` : 'Guest',
            customerEmail: bookingWithGuest?.primaryGuest?.email,
            customerAddress: bookingWithGuest?.primaryGuest ? [bookingWithGuest.primaryGuest.city, bookingWithGuest.primaryGuest.country].filter(Boolean).join(', ') : undefined,
            subtotal: folio.subtotal,
            taxes: folio.taxes,
            totalAmount: folio.totalAmount,
            currency: folio.currency,
            issuedAt: new Date(),
            dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'issued',
            pdfUrl: `/api/invoices/${folio.id}/pdf`,
          },
        });

        await tx.folio.update({
          where: { id: folio.id },
          data: { invoiceNumber, invoiceIssuedAt: new Date() },
        });
      }

      // 5. Auto-award loyalty points
      const guest = await tx.guest.findUnique({ where: { id: booking.primaryGuestId } });
      if (guest) {
        const pointsToAward = Math.floor(booking.totalAmount / 100);
        if (pointsToAward > 0) {
          const updatedGuest = await tx.guest.update({
            where: { id: guest.id },
            data: { loyaltyPoints: { increment: pointsToAward } },
          });
          await tx.loyaltyPointTransaction.create({
            data: {
              tenantId: booking.tenantId,
              guestId: guest.id,
              points: pointsToAward,
              balance: updatedGuest.loyaltyPoints,
              type: 'earn',
              source: 'stay_completion',
              referenceId: booking.id,
              referenceType: 'booking',
              description: `Points earned from stay ${booking.confirmationCode}`,
            },
          });
        }
      }

      // 6. Create booking audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId,
          action: 'express_checkout',
          oldStatus: 'checked_in',
          newStatus: 'checked_out',
          notes: 'Express check-out via self-service kiosk (folio closed, invoice generated, loyalty awarded)',
          performedBy: 'kiosk-self-service',
        },
      });

      return updated;
    });

    // Housekeeping automation — trigger OUTSIDE transaction (non-blocking)
    try {
      await markRoomDirtyAfterCheckout(booking.room.id, booking.tenantId, booking.id);
    } catch (hkError) {
      console.error('[Kiosk Check-out] Failed to trigger housekeeping automation:', hkError);
    }

    // WiFi deactivation — OUTSIDE the transaction (non-blocking, best-effort)
    try {
      const wifiUsers = await db.wiFiUser.findMany({
        where: {
          bookingId: booking.id,
          status: 'active',
        },
        select: { id: true, username: true },
      });

      if (wifiUsers.length > 0) {
        const userIds = wifiUsers.map((u) => u.id);
        await db.wiFiUser.updateMany({
          where: { id: { in: userIds } },
          data: {
            status: 'inactive',
            validUntil: now,
          },
        });
        console.log(
          `[Kiosk Check-out] Deactivated ${wifiUsers.length} WiFi credential(s) for booking ${booking.id}: ${wifiUsers.map((u) => u.username).join(', ')}`
        );
      }
    } catch (wifiError) {
      console.error('[Kiosk Check-out] Failed to deactivate WiFi credentials:', wifiError);
    }

    // Emit booking checked-out event for other consumers (realtime, notifications, etc.)
    try {
      await emitBookingCheckedOut({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        confirmationCode: booking.confirmationCode || '',
        guestId: booking.primaryGuest.id,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        guestEmail: booking.primaryGuest.email ?? undefined,
        guestPhone: booking.primaryGuest.phone ?? undefined,
        roomTypeId: booking.roomType?.id || booking.roomTypeId || '',
        roomTypeName: booking.roomType?.name || '',
        roomId: booking.room.id,
        roomNumber: booking.room.number,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        actualCheckOut: now,
        totalAmount: booking.totalAmount,
        paidAmount: booking.folios?.[0]?.paidAmount ?? 0,
        performedBy: 'kiosk-self-service',
      });
    } catch (eventError) {
      console.warn('[Kiosk Check-out] Failed to emit booking event:', eventError);
    }

    // Build response
    const folioBalance = booking.folios?.[0]?.balance ?? 0;
    const guestName = `${updatedBooking.primaryGuest.firstName} ${updatedBooking.primaryGuest.lastName}`;

    return NextResponse.json({
      success: true,
      data: {
        propertyName: updatedBooking.property?.name,
        guestName,
        checkOutTime: updatedBooking.actualCheckOut,
        roomNumber: updatedBooking.room?.number,
        folioBalance,
        hasBalance: folioBalance > 0,
        currency: booking.currency || 'INR',
        confirmationCode: booking.confirmationCode || '',
        bookingId: booking.id,
      },
    });
  } catch (error) {
    console.error('Error processing kiosk check-out:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process check-out' },
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { applyCancellationPenalty, evaluateCancellationPolicy } from '@/lib/cancellation-policy-engine';
import { logBooking } from '@/lib/audit';
import { notifyBookingCancelled } from '@/lib/notify';
import type { CancellationResult } from '@/lib/cancellation-policy-engine';

// POST /api/bookings/[id]/cancel — Cancel a booking with full policy enforcement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // 1. Find the booking
    const booking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            loyaltyTier: true,
          },
        },
        room: {
          select: { id: true, number: true, status: true },
        },
        roomType: {
          select: { id: true, name: true },
        },
        folios: {
          select: { id: true, totalAmount: true, paidAmount: true, balance: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (booking.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // 2. Validate status transition
    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled' } },
        { status: 400 }
      );
    }

    if (booking.status === 'checked_out') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Cannot cancel a checked-out booking' } },
        { status: 400 }
      );
    }

    // checked_in is intentionally excluded: cancellation of an in-progress stay
    // should go through checkout (with penalty) rather than cancellation.
    // If checked_in cancellation is needed, use the early-checkout-request flow.
    const validCancelFrom = ['draft', 'confirmed', 'tentative', 'no_show'];
    if (!validCancelFrom.includes(booking.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot cancel booking with status: ${booking.status}`,
          },
        },
        { status: 400 }
      );
    }

    // 3. Evaluate cancellation policy
    let evaluation: CancellationResult;
    try {
      evaluation = await evaluateCancellationPolicy({
        bookingId: booking.id,
        tenantId: booking.tenantId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to evaluate cancellation policy';
      return NextResponse.json(
        { success: false, error: { code: 'POLICY_EVALUATION_ERROR', message: msg } },
        { status: 500 }
      );
    }

    // 4. Calculate refund amount
    const folio = booking.folios?.[0];
    const totalPaid = folio?.paidAmount || 0;
    const penaltyAmount = evaluation.penaltyAmount;
    const refundAmount = Math.max(0, totalPaid - penaltyAmount);

    // CRITICAL-01 FIX: Execute actual refund via payment gateway
    let refundResult: { success: boolean; gatewayRef?: string; error?: string } | null = null;
    if (refundAmount > 0 && folio) {
      try {
        // Find the last successful payment for this folio to refund through
        const lastPayment = await db.payment.findFirst({
          where: {
            folioId: folio.id,
            status: 'completed',
            gateway: { not: 'kiosk-demo' },
            gatewayRef: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lastPayment?.gateway && lastPayment.gatewayRef) {
          try {
            const { createStripeGateway } = await import('@/lib/payments/gateways/stripe');
            const gatewayConfig = await db.paymentGateway.findFirst({
              where: { tenantId: booking.tenantId, provider: lastPayment.gateway, status: 'active' },
            });

            if (gatewayConfig) {
              const gateway = createStripeGateway({
                id: gatewayConfig.id,
                apiKey: gatewayConfig.apiKey || '',
                webhookSecret: gatewayConfig.webhookSecret ?? undefined,
                feePercentage: gatewayConfig.feePercentage,
                feeFixed: gatewayConfig.feeFixed,
              });

              const result = await gateway.refundPayment({
                transactionId: lastPayment.gatewayRef,
                gatewayRef: lastPayment.gatewayRef,
                amount: refundAmount,
                reason: `Cancellation refund for booking ${booking.confirmationCode}`,
              });

              refundResult = {
                success: !!result.success,
                gatewayRef: result.refundId || undefined,
                error: result.errorMessage || undefined,
              };
            } else {
              console.warn('[Cancel] No active gateway config found for refund. Recording manual refund.');
              refundResult = { success: true, error: 'No gateway configured — manual refund recorded' };
            }
          } catch (gwErr) {
            console.error('[Cancel] Refund via gateway failed:', gwErr);
            refundResult = { success: false, error: `Gateway refund failed: ${gwErr instanceof Error ? gwErr.message : 'Unknown error'}` };
          }
        } else {
          // No gateway payment to refund through — record manual refund
          refundResult = { success: true, error: 'No gateway payment found — manual refund recorded' };
        }

        // Record the refund as a negative payment on the folio
        if (refundResult.success) {
          await db.payment.create({
            data: {
              tenantId: booking.tenantId,
              folioId: folio.id,
              amount: -refundAmount,
              currency: folio.currency || 'INR',
              method: 'refund',
              gateway: lastPayment?.gateway || 'manual',
              gatewayRef: refundResult.gatewayRef || `REFUND-${Date.now()}`,
              gatewayStatus: 'completed',
              guestId: booking.primaryGuestId,
              status: 'completed',
              processedAt: new Date(),
              reference: `REFUND-${booking.confirmationCode}`,
            },
          });
        }
      } catch (refundErr) {
        console.error('[Cancel] Refund processing error:', refundErr);
        refundResult = { success: false, error: 'Refund processing failed' };
      }
    }

    // 5. Apply penalty and cancel in a transaction
    let penaltyResult;
    try {
      penaltyResult = await applyCancellationPenalty({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        performedBy: user.id,
        reason: reason || undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply cancellation penalty';
      console.error('Cancellation penalty application failed:', err);

      // Still try to cancel the booking even if penalty fails
      // SECURITY FIX: Wrap fallback cancel + room release in a single transaction
      try {
        await db.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelledBy: user.id,
              cancellationReason: reason || 'Cancelled (penalty application failed)',
            },
          });

          // Release room inside same transaction
          if (booking.roomId) {
            await tx.room.update({
              where: { id: booking.roomId },
              data: { status: 'available' },
            });
          }

          // Close the open folio to prevent orphaned charges
          const openFolio = await tx.folio.findFirst({
            where: { bookingId: booking.id, status: { in: ['open', 'partially_paid'] } },
          });
          if (openFolio) {
            await tx.folio.update({
              where: { id: openFolio.id },
              data: { status: 'closed', closedAt: new Date() },
            });
          }
        });

        return NextResponse.json({
          success: true,
          cancelled: true,
          penalty: 0,
          policy: evaluation.policy.name,
          refunded: totalPaid,
          warning: 'Booking cancelled but penalty could not be applied: ' + msg,
        });
      } catch (fallbackErr) {
        console.error('Fallback cancellation also failed:', fallbackErr);
        return NextResponse.json(
          { success: false, error: { code: 'CANCELLATION_FAILED', message: 'Failed to cancel booking' } },
          { status: 500 }
        );
      }
    }

    // 6. Log to audit trail
    try {
      await logBooking(request, 'cancel', booking.id, {
        status: booking.status,
        confirmationCode: booking.confirmationCode,
        roomId: booking.roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalAmount: booking.totalAmount,
      }, {
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim(),
        status: 'cancelled',
        roomNumber: booking.room?.number,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    // 7. Send cancellation notification
    try {
      notifyBookingCancelled({
        tenantId: booking.tenantId,
        userId: user.id,
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim() || 'Guest',
        reason,
      });
    } catch (notifyError) {
      console.error('Cancellation notification failed (non-blocking):', notifyError);
    }

    // 8. Notify OTA channel partners about the cancellation (fire-and-forget)
    try {
      const { OTASyncService } = await import('@/lib/ota/sync-service');
      OTASyncService.notifyCancellation(
        booking.tenantId,
        booking.propertyId,
        booking.externalRef,
        reason || undefined
      ).catch((otaErr: unknown) => {
        console.error('OTA cancellation notification failed (non-blocking):', otaErr);
      });
    } catch (otaImportErr) {
      console.error('Failed to load OTASyncService for cancellation notification (non-blocking):', otaImportErr);
    }

    // 9. Return comprehensive result
    return NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        policy: {
          id: evaluation.policy.id,
          name: evaluation.policy.name,
          description: evaluation.policy.description,
        },
        evaluation: {
          isWithinFreeWindow: evaluation.isWithinFreeWindow,
          hoursUntilCheckIn: evaluation.hoursUntilCheckIn,
          penaltyType: evaluation.penaltyType,
          isExempt: evaluation.isExempt,
          exemptReason: evaluation.exemptReason,
        },
        penalty: {
          amount: penaltyAmount,
          currency: evaluation.currency,
          applied: penaltyResult.penaltyApplied,
          folioId: penaltyResult.folioId,
          lineItemId: penaltyResult.lineItemId,
        },
        financials: {
          totalPaid,
          penaltyDeducted: penaltyAmount,
          refundAmount,
          refundProcessed: refundResult?.success ?? false,
          refundGatewayRef: refundResult?.gatewayRef || null,
          refundError: refundResult?.error || null,
          remainingBalance: Math.max(0, (folio?.balance || 0) + penaltyAmount),
        },
        cancelledAt: new Date().toISOString(),
        cancelledBy: user.id,
      },
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking' } },
      { status: 500 }
    );
  }
}

// GET /api/bookings/[id]/cancel — Preview cancellation policy before cancelling
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        folios: {
          select: { id: true, totalAmount: true, paidAmount: true, balance: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (booking.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // Evaluate policy for preview
    let evaluation: CancellationResult;
    try {
      evaluation = await evaluateCancellationPolicy({
        bookingId: booking.id,
        tenantId: booking.tenantId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to evaluate policy';
      return NextResponse.json(
        { success: false, error: { code: 'POLICY_EVALUATION_ERROR', message: msg } },
        { status: 500 }
      );
    }

    const folio = booking.folios?.[0];
    const totalPaid = folio?.paidAmount || 0;
    const penaltyAmount = evaluation.penaltyAmount;
    const refundAmount = Math.max(0, totalPaid - penaltyAmount);

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        currentStatus: booking.status,
        canCancel: !['cancelled', 'checked_out'].includes(booking.status),
        policy: {
          id: evaluation.policy.id,
          name: evaluation.policy.name,
          description: evaluation.policy.description,
          freeCancelHoursBefore: evaluation.policy.freeCancelHoursBefore,
        },
        evaluation: {
          isWithinFreeWindow: evaluation.isWithinFreeWindow,
          hoursUntilCheckIn: evaluation.hoursUntilCheckIn,
          penaltyType: evaluation.penaltyType,
          isExempt: evaluation.isExempt,
          exemptReason: evaluation.exemptReason,
        },
        preview: {
          totalPaid,
          penaltyAmount,
          refundAmount,
          currency: evaluation.currency,
        },
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error previewing cancellation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to preview cancellation' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schema ───
const executeStepSchema = z.object({
  stepName: z.enum([
    'Post room charges',
    'Verify folios',
    'Process no-shows',
    'Reconcile rooms',
    'Run reports',
    'Close business day',
  ]),
});

// ─── POST: Execute a specific step ───
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.execute') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = executeStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const { stepName } = parsed.data;

    // Fetch audit with steps
    const audit = await db.nightAudit.findFirst({
      where: { id, tenantId: user.tenantId, status: 'in_progress' },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!audit) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Active night audit not found' } }, { status: 404 });
    }

    const step = audit.steps.find((s) => s.stepName === stepName);
    if (!step) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Step "${stepName}" not found in this audit` } }, { status: 404 });
    }

    if (step.status !== 'pending') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: `Step is already ${step.status}` } }, { status: 400 });
    }

    // Mark step as in_progress
    await db.nightAuditStep.update({
      where: { id: step.id },
      data: { status: 'in_progress', startedAt: new Date(), performedBy: user.id },
    });

    // Execute step logic
    let result: Record<string, unknown>;
    let logNotes = '';

    switch (stepName) {
      case 'Post room charges': {
        result = await postRoomCharges(audit);
        logNotes = `Posted ${result.chargesPosted} room charges, total $${result.totalAmount.toFixed(2)}`;
        await db.nightAudit.update({
          where: { id },
          data: { roomChargesPosted: { increment: result.chargesPosted as number } },
        });
        break;
      }
      case 'Verify folios': {
        result = await verifyFolios(audit);
        logNotes = `Verified ${result.totalFolios} folios, ${result.issuesFound} issues found`;
        break;
      }
      case 'Process no-shows': {
        result = await processNoShows(audit);
        logNotes = `Processed ${result.noShowsProcessed} no-shows, revenue: $${result.revenueCaptured.toFixed(2)}`;
        await db.nightAudit.update({
          where: { id },
          data: { noShowsProcessed: { increment: result.noShowsProcessed as number } },
        });
        break;
      }
      case 'Reconcile rooms': {
        result = await reconcileRooms(audit);
        logNotes = `Reconciled ${result.roomsReconciled} rooms, ${result.discrepancies} discrepancies`;
        await db.nightAudit.update({
          where: { id },
          data: {
            roomsReconciled: { increment: result.roomsReconciled as number },
            discrepancies: { increment: result.discrepancies as number },
          },
        });
        break;
      }
      case 'Run reports': {
        result = await runReports(audit);
        logNotes = `Generated ${result.reportsGenerated} reports`;
        break;
      }
      case 'Close business day': {
        result = await closeBusinessDay(audit);
        logNotes = `Business day closed. Revenue: Room $${result.roomRevenue.toFixed(2)}, F&B $${result.fbRevenue.toFixed(2)}, Other $${result.otherRevenue.toFixed(2)}`;
        await db.nightAudit.update({
          where: { id },
          data: {
            roomRevenue: result.roomRevenue as number,
            fbRevenue: result.fbRevenue as number,
            otherRevenue: result.otherRevenue as number,
            totalRevenue: (result.roomRevenue as number) + (result.fbRevenue as number) + (result.otherRevenue as number),
          },
        });
        break;
      }
    }

    // Mark step as completed
    const completedStep = await db.nightAuditStep.update({
      where: { id: step.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify(result),
        notes: logNotes,
      },
    });

    // Create log entry
    await db.nightAuditLog.create({
      data: {
        nightAuditId: id,
        action: 'step_executed',
        entityType: 'NightAuditStep',
        entityId: step.id,
        oldValue: stepName,
        newValue: logNotes,
        performedBy: user.id,
      },
    });

    // Check if all steps complete
    const remainingSteps = await db.nightAuditStep.count({
      where: { nightAuditId: id, status: { in: ['pending', 'in_progress'] } },
    });

    return NextResponse.json({
      success: true,
      data: {
        step: completedStep,
        result,
        auditComplete: remainingSteps === 0,
      },
    });
  } catch (error) {
    console.error('[NightAudit ExecuteStep] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute audit step' } }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Step Business Logic
// ═══════════════════════════════════════════════════════════════════

/**
 * Post room charges for all in-house guests for the business day.
 * Calculates room rate × 1 night for each occupied room.
 */
async function postRoomCharges(audit: { id: string; propertyId: string; tenantId: string; businessDayDate: Date }) {
  const businessDay = new Date(audit.businessDayDate);
  const startOfDay = new Date(businessDay);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(businessDay);
  endOfDay.setHours(23, 59, 59, 999);

  // Find all in-house bookings (checked in but not checked out, overlapping business day)
  const activeBookings = await db.booking.findMany({
    where: {
      tenantId: audit.tenantId,
      propertyId: audit.propertyId,
      status: { in: ['confirmed', 'checked_in'] },
      actualCheckIn: { lte: endOfDay },
      OR: [
        { actualCheckOut: null },
        { actualCheckOut: { gte: startOfDay } },
      ],
    },
    include: {
      room: { select: { id: true, number: true } },
      roomType: { select: { id: true, name: true, basePrice: true } },
      folios: {
        where: { status: 'open' },
        select: { id: true },
      },
      primaryGuest: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  let chargesPosted = 0;
  let totalAmount = 0;
  const chargeDetails: Array<{ bookingId: string; room: string; amount: number; folioId: string }> = [];

  for (const booking of activeBookings) {
    const roomRate = booking.roomRate > 0 ? booking.roomRate : booking.roomType.basePrice;
    const folio = booking.folios[0];

    if (!folio) continue;

    // Create folio line item for room charge
    await db.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Room charge - Room ${booking.room?.number || 'N/A'} (${booking.roomType.name}) - Night Audit`,
        category: 'room',
        quantity: 1,
        unitPrice: roomRate,
        totalAmount: roomRate,
        serviceDate: audit.businessDayDate,
        referenceType: 'NightAudit',
        referenceId: audit.id,
        postedBy: 'system',
      },
    });

    // Update folio balance
    await db.folio.update({
      where: { id: folio.id },
      data: {
        subtotal: { increment: roomRate },
        totalAmount: { increment: roomRate },
        balance: { increment: roomRate },
      },
    });

    chargesPosted++;
    totalAmount += roomRate;
    chargeDetails.push({
      bookingId: booking.id,
      room: booking.room?.number || 'N/A',
      amount: roomRate,
      folioId: folio.id,
    });
  }

  return { chargesPosted, totalAmount, chargeDetails };
}

/**
 * Verify folios: check for negative balances, missing line items, etc.
 */
async function verifyFolios(audit: { id: string; propertyId: string; tenantId: string }) {
  const folios = await db.folio.findMany({
    where: {
      tenantId: audit.tenantId,
      propertyId: audit.propertyId,
      status: 'open',
    },
    include: {
      booking: {
        select: { id: true, confirmationCode: true, checkIn: true, checkOut: true },
      },
      _count: { select: { lineItems: true, payments: true } },
    },
  });

  let issuesFound = 0;
  const issues: string[] = [];

  for (const folio of folios) {
    // Check for folios with no activity
    if (folio._count.lineItems === 0 && folio._count.payments === 0) {
      issues.push(`Folio ${folio.folioNumber} (${folio.booking.confirmationCode}): No activity`);
      issuesFound++;
    }

    // Check for negative balances that shouldn't be
    if (folio.balance < 0 && folio.paidAmount > 0) {
      issues.push(`Folio ${folio.folioNumber}: Negative balance of $${Math.abs(folio.balance).toFixed(2)}`);
      issuesFound++;
    }
  }

  return { totalFolios: folios.length, issuesFound, issues };
}

/**
 * Process no-shows: find bookings due today that haven't checked in.
 */
async function processNoShows(audit: { id: string; propertyId: string; tenantId: string }) {
  const today = new Date(audit.businessDayDate);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const noShows = await db.booking.findMany({
    where: {
      tenantId: audit.tenantId,
      propertyId: audit.propertyId,
      status: 'confirmed',
      checkIn: { gte: today, lt: tomorrow },
      actualCheckIn: null,
      cancelledAt: null,
    },
    include: {
      primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } },
      folios: { where: { status: 'open' }, select: { id: true } },
      room: { select: { id: true, number: true } },
    },
  });

  let noShowsProcessed = 0;
  let revenueCaptured = 0;

  for (const booking of noShows) {
    // Get cancellation policy for penalty
    const policy = await db.cancellationPolicy.findFirst({
      where: {
        tenantId: audit.tenantId,
        isActive: true,
        OR: [
          { propertyId: audit.propertyId },
          { propertyId: null },
        ],
      },
    });

    const penaltyPercent = policy?.noShowPenaltyPercent ?? 100;
    const penaltyAmount = booking.totalAmount * (penaltyPercent / 100);

    // Apply no-show penalty
    if (penaltyAmount > 0 && booking.folios[0]) {
      await db.folioLineItem.create({
        data: {
          folioId: booking.folios[0].id,
          description: `No-show penalty (${penaltyPercent}%)`,
          category: 'penalty',
          quantity: 1,
          unitPrice: penaltyAmount,
          totalAmount: penaltyAmount,
          serviceDate: audit.businessDayDate,
          referenceType: 'NightAudit',
          referenceId: audit.id,
          postedBy: 'system',
        },
      });

      await db.folio.update({
        where: { id: booking.folios[0].id },
        data: {
          subtotal: { increment: penaltyAmount },
          totalAmount: { increment: penaltyAmount },
          balance: { increment: penaltyAmount },
        },
      });

      revenueCaptured += penaltyAmount;
    }

    // Create cancellation penalty record
    await db.cancellationPenalty.create({
      data: {
        tenantId: audit.tenantId,
        bookingId: booking.id,
        folioId: booking.folios[0]?.id,
        policyId: policy?.id || '00000000-0000-0000-0000-000000000000',
        policyName: policy?.name || 'Default no-show policy',
        penaltyType: 'percentage',
        penaltyAmount,
        originalAmount: booking.totalAmount,
        penaltyPercent,
        status: 'applied',
        reason: 'No-show - auto-processed during night audit',
      },
    });

    // Mark booking as no-show
    await db.booking.update({
      where: { id: booking.id },
      data: {
        status: 'no_show',
        cancelledAt: new Date(),
        cancelledBy: 'system',
        cancellationReason: 'No-show - processed during night audit',
      },
    });

    // Release the room
    if (booking.roomId) {
      await db.room.update({
        where: { id: booking.roomId },
        data: { status: 'available' },
      });
    }

    // Log
    await db.bookingAuditLog.create({
      data: {
        bookingId: booking.id,
        action: 'no_show_processed',
        oldStatus: 'confirmed',
        newStatus: 'no_show',
        notes: `Auto-processed during night audit. Penalty: $${penaltyAmount.toFixed(2)}`,
        performedBy: 'system',
      },
    });

    noShowsProcessed++;
  }

  return { noShowsProcessed, revenueCaptured, noShows: noShows.map((b) => b.id) };
}

/**
 * Reconcile rooms: verify room status matches booking status.
 */
async function reconcileRooms(audit: { id: string; propertyId: string; tenantId: string }) {
  // Pre-query: find rooms with recent check-ins (last 60 min) to avoid releasing rooms mid check-in
  const recentCheckinRoomIds = new Set(
    (
      await db.booking.findMany({
        where: {
          tenantId: audit.tenantId,
          propertyId: audit.propertyId,
          checkIn: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          roomId: { not: null },
        },
        select: { roomId: true },
      })
    ).map((b) => b.roomId!),
  );

  // Get all rooms at this property
  const rooms = await db.room.findMany({
    where: {
      propertyId: audit.propertyId,
      deletedAt: null,
    },
    include: {
      bookings: {
        where: {
          status: { in: ['confirmed', 'checked_in'] },
          actualCheckOut: null,
        },
        select: { id: true, status: true, confirmationCode: true, actualCheckIn: true },
      },
    },
  });

  let roomsReconciled = 0;
  let discrepancies = 0;
  const discrepancyDetails: string[] = [];

  for (const room of rooms) {
    roomsReconciled++;

    const activeBooking = room.bookings[0];

    if (activeBooking && room.status !== 'occupied') {
      // Room should be occupied but isn't marked as such
      discrepancyDetails.push(`Room ${room.number}: Has active booking ${activeBooking.confirmationCode} but status is "${room.status}"`);
      discrepancies++;

      // Auto-fix: mark room as occupied
      await db.room.update({
        where: { id: room.id },
        data: {
          status: 'occupied',
        },
      });
    } else if (!activeBooking && room.status === 'occupied') {
      // Guard: don't release rooms that may have in-progress check-ins/out.
      // - Skip rooms with recent bookings (checkIn within last 60 min) that might be mid check-in
      // - Only release rooms that have been occupied for more than 30 minutes to avoid race conditions
      if (
        recentCheckinRoomIds.has(room.id) ||
        (room.updatedAt && Date.now() - room.updatedAt.getTime() < 30 * 60 * 1000)
      ) {
        continue;
      }
      // Room marked occupied but no active booking
      discrepancyDetails.push(`Room ${room.number}: Marked occupied but no active booking found`);
      discrepancies++;

      // Auto-fix: mark room as available
      await db.room.update({
        where: { id: room.id },
        data: {
          status: 'available',
        },
      });
    }
  }

  return { roomsReconciled, discrepancies, discrepancyDetails };
}

/**
 * Run reports: generate summary statistics for the business day.
 */
async function runReports(audit: { id: string; propertyId: string; tenantId: string; businessDayDate: Date }) {
  const businessDay = new Date(audit.businessDayDate);
  const startOfDay = new Date(businessDay);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(businessDay);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    totalRooms,
    occupiedRooms,
    arrivals,
    departures,
    lineItems,
    payments,
  ] = await Promise.all([
    db.room.count({ where: { propertyId: audit.propertyId, deletedAt: null } }),
    db.room.count({ where: { propertyId: audit.propertyId, status: 'occupied', deletedAt: null } }),
    db.booking.count({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        actualCheckIn: { gte: startOfDay, lte: endOfDay },
      },
    }),
    db.booking.count({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        actualCheckOut: { gte: startOfDay, lte: endOfDay },
      },
    }),
    db.folioLineItem.findMany({
      where: {
        folio: { propertyId: audit.propertyId, tenantId: audit.tenantId },
        serviceDate: { gte: startOfDay, lte: endOfDay },
      },
    }),
    db.payment.findMany({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: 'completed',
      },
    }),
  ]);

  const totalCharges = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';
  const roomRevenue = lineItems.filter((i) => i.category === 'room').reduce((sum, i) => sum + i.totalAmount, 0);
  const fbRevenue = lineItems.filter((i) => ['food_beverage', 'restaurant', 'room_service', 'minibar'].includes(i.category)).reduce((sum, i) => sum + i.totalAmount, 0);
  const otherRevenue = totalCharges - roomRevenue - fbRevenue;

  return {
    reportsGenerated: 1,
    summary: {
      date: audit.businessDayDate,
      occupancy: { total: totalRooms, occupied: occupiedRooms, rate: `${occupancyRate}%` },
      movements: { arrivals, departures, inHouse: occupiedRooms },
      revenue: { room: roomRevenue, foodBeverage: fbRevenue, other: otherRevenue, total: totalCharges },
      payments: { count: payments.length, total: totalPayments },
      netRevenue: totalCharges - totalPayments,
    },
  };
}

/**
 * Close business day: final step that rolls over to the next day.
 */
async function closeBusinessDay(audit: { id: string; propertyId: string; tenantId: string; businessDayDate: Date }) {
  const businessDay = new Date(audit.businessDayDate);
  const startOfDay = new Date(businessDay);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(businessDay);
  endOfDay.setHours(23, 59, 59, 999);

  const lineItems = await db.folioLineItem.findMany({
    where: {
      folio: { propertyId: audit.propertyId, tenantId: audit.tenantId },
      serviceDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  const roomRevenue = lineItems.filter((i) => i.category === 'room').reduce((sum, i) => sum + i.totalAmount, 0);
  const fbRevenue = lineItems.filter((i) => ['food_beverage', 'restaurant', 'room_service', 'minibar'].includes(i.category)).reduce((sum, i) => sum + i.totalAmount, 0);
  const otherRevenue = lineItems.reduce((sum, i) => sum + i.totalAmount, 0) - roomRevenue - fbRevenue;

  // Mark auto-post timestamp
  await db.nightAudit.update({
    where: { id: audit.id },
    data: { autoPostedAt: new Date() },
  });

  return { roomRevenue, fbRevenue, otherRevenue, closedAt: new Date() };
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Night Audit Steps Template ───
const NIGHT_AUDIT_STEPS = [
  { stepName: 'Post room charges', stepOrder: 1 },
  { stepName: 'Verify folios', stepOrder: 2 },
  { stepName: 'Process no-shows', stepOrder: 3 },
  { stepName: 'Reconcile rooms', stepOrder: 4 },
  { stepName: 'Run reports', stepOrder: 5 },
  { stepName: 'Close business day', stepOrder: 6 },
] as const;

// ─── Zod Schemas ───
const createNightAuditSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  businessDayDate: z.string().datetime('Invalid business day date'),
  notes: z.string().optional(),
  execute: z.boolean().default(false).optional(),
});

// ─── GET: List night audits ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.view') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.businessDayDate = dateFilter;
    }

    const [audits, total] = await Promise.all([
      db.nightAudit.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          startedByUser: { select: { id: true, firstName: true, lastName: true } },
          completedByUser: { select: { id: true, firstName: true, lastName: true } },
          steps: { orderBy: { stepOrder: 'asc' } },
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.nightAudit.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: audits,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[NightAudit GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch night audits' } }, { status: 500 });
  }
}

// ─── POST: Start new night audit ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.create') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createNightAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const { propertyId, businessDayDate, notes, execute } = parsed.data;
    const auditDate = new Date(businessDayDate);

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Check if an audit already exists for this property + business day
    const existing = await db.nightAudit.findUnique({
      where: { propertyId_businessDayDate: { propertyId, businessDayDate: auditDate } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: 'Night audit already exists for this property and business day' } }, { status: 409 });
    }

    // Check for any in-progress audit on this property
    const inProgress = await db.nightAudit.findFirst({
      where: { propertyId, status: 'in_progress' },
    });
    if (inProgress) {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'An audit is already in progress for this property. Complete it before starting a new one.' } }, { status: 409 });
    }

    // Create audit with steps
    const audit = await db.nightAudit.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        auditDate: new Date(),
        businessDayDate: auditDate,
        startedBy: user.id,
        status: 'in_progress',
        notes,
        steps: {
          create: NIGHT_AUDIT_STEPS.map((s) => ({
            stepName: s.stepName,
            stepOrder: s.stepOrder,
            status: 'pending',
          })),
        },
      },
      include: {
        property: { select: { id: true, name: true } },
        startedByUser: { select: { id: true, firstName: true, lastName: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    // Create initial log entry
    await db.nightAuditLog.create({
      data: {
        nightAuditId: audit.id,
        action: 'audit_started',
        entityType: 'NightAudit',
        entityId: audit.id,
        newValue: `Night audit started by ${user.firstName} ${user.lastName}`,
        performedBy: user.id,
      },
    });

    // If execute flag is set, run all steps in a single transaction
    if (execute) {
      try {
        const auditResult = await executeFullNightAudit(audit, user.id);
        return NextResponse.json({ success: true, data: auditResult.audit, executionSummary: auditResult.summary }, { status: 201 });
      } catch (execError) {
        console.error('[NightAudit POST] Execution error:', execError);
        // Audit was created but execution failed - return the audit with error info
        await db.nightAuditLog.create({
          data: {
            nightAuditId: audit.id,
            action: 'execution_failed',
            entityType: 'NightAudit',
            entityId: audit.id,
            newValue: `Execution failed: ${execError instanceof Error ? execError.message : 'Unknown error'}`,
            performedBy: user.id,
          },
        });
        return NextResponse.json({ success: true, data: audit, warning: 'Audit created but execution failed. Steps must be run manually.' }, { status: 201 });
      }
    }

    return NextResponse.json({ success: true, data: audit }, { status: 201 });
  } catch (error) {
    console.error('[NightAudit POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create night audit' } }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// Full Night Audit Execution — runs all 6 steps in a transaction
// ═══════════════════════════════════════════════════════════════

interface AuditContext {
  id: string;
  propertyId: string;
  tenantId: string;
  businessDayDate: Date;
}

interface ExecutionSummary {
  roomChargesPosted: number;
  roomChargeTotal: number;
  scheduledChargesPosted: number;
  scheduledChargeTotal: number;
  foliosVerified: number;
  folioIssues: number;
  noShowsProcessed: number;
  noShowRevenue: number;
  roomsReconciled: number;
  discrepancies: number;
  occupancyRate: string;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
}

async function executeFullNightAudit(audit: AuditContext, userId: string) {
  const summary: ExecutionSummary = {
    roomChargesPosted: 0,
    roomChargeTotal: 0,
    scheduledChargesPosted: 0,
    scheduledChargeTotal: 0,
    foliosVerified: 0,
    folioIssues: 0,
    noShowsProcessed: 0,
    noShowRevenue: 0,
    roomsReconciled: 0,
    discrepancies: 0,
    occupancyRate: '0%',
    roomRevenue: 0,
    fbRevenue: 0,
    otherRevenue: 0,
  };

  await db.$transaction(async (tx) => {
    const businessDay = new Date(audit.businessDayDate);
    const startOfDay = new Date(businessDay);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(businessDay);
    endOfDay.setHours(23, 59, 59, 999);

    // ── Step 1: Post room charges for all in-house guests ──
    const activeBookings = await tx.booking.findMany({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        status: { in: ['confirmed', 'in_house'] },
        actualCheckIn: { lte: endOfDay },
        OR: [
          { actualCheckOut: null },
          { actualCheckOut: { gte: startOfDay } },
        ],
      },
      include: {
        room: { select: { id: true, number: true } },
        roomType: { select: { id: true, name: true, basePrice: true } },
        folios: { where: { status: 'open' }, select: { id: true } },
      },
    });

    for (const booking of activeBookings) {
      const roomRate = booking.roomRate > 0 ? booking.roomRate : booking.roomType.basePrice;
      const folio = booking.folios[0];
      if (!folio) continue;

      await tx.folioLineItem.create({
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

      await tx.folio.update({
        where: { id: folio.id },
        data: { subtotal: { increment: roomRate }, totalAmount: { increment: roomRate }, balance: { increment: roomRate } },
      });

      summary.roomChargesPosted++;
      summary.roomChargeTotal += roomRate;
    }

    // Mark step 1 complete
    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Post room charges' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ chargesPosted: summary.roomChargesPosted, totalAmount: summary.roomChargeTotal }) },
    });

    // ── Step 2: Post scheduled charges due ──
    const scheduledCharges = await tx.scheduledCharge.findMany({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        isActive: true,
        nextDueDate: { lte: endOfDay },
      },
      include: {
        booking: {
          include: {
            folios: { where: { status: 'open' }, select: { id: true } },
            room: { select: { number: true } },
          },
        },
      },
    });

    for (const sc of scheduledCharges) {
      const folio = sc.booking?.folios[0];
      if (!folio) continue;

      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: sc.description || `Scheduled charge - ${sc.chargeType || 'Recurring'}`,
          category: sc.chargeType || 'other',
          quantity: 1,
          unitPrice: sc.amount,
          totalAmount: sc.amount,
          serviceDate: audit.businessDayDate,
          referenceType: 'NightAudit',
          referenceId: audit.id,
          postedBy: 'system',
        },
      });

      await tx.folio.update({
        where: { id: folio.id },
        data: { subtotal: { increment: sc.amount }, totalAmount: { increment: sc.amount }, balance: { increment: sc.amount } },
      });

      // Update next due date
      if (sc.frequency === 'daily') {
        await tx.scheduledCharge.update({ where: { id: sc.id }, data: { nextDueDate: new Date(endOfDay.getTime() + 86400000) } });
      } else if (sc.frequency === 'weekly') {
        await tx.scheduledCharge.update({ where: { id: sc.id }, data: { nextDueDate: new Date(endOfDay.getTime() + 7 * 86400000) } });
      }

      summary.scheduledChargesPosted++;
      summary.scheduledChargeTotal += sc.amount;
    }

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Verify folios' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ scheduledChargesPosted: summary.scheduledChargesPosted, scheduledChargeTotal: summary.scheduledChargeTotal }) },
    });

    // ── Step 3: Process no-shows ──
    const tomorrow = new Date(startOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const noShows = await tx.booking.findMany({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        status: 'confirmed',
        checkIn: { gte: startOfDay, lt: tomorrow },
        actualCheckIn: null,
        cancelledAt: null,
      },
      include: {
        primaryGuest: { select: { id: true, firstName: true, lastName: true } },
        folios: { where: { status: 'open' }, select: { id: true } },
        room: { select: { id: true, number: true } },
      },
    });

    for (const booking of noShows) {
      const policy = await tx.cancellationPolicy.findFirst({
        where: { tenantId: audit.tenantId, isActive: true, OR: [{ propertyId: audit.propertyId }, { propertyId: null }] },
      });

      const penaltyPercent = policy?.noShowPenaltyPercent ?? 100;
      const penaltyAmount = booking.totalAmount * (penaltyPercent / 100);

      if (penaltyAmount > 0 && booking.folios[0]) {
        await tx.folioLineItem.create({
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
        await tx.folio.update({
          where: { id: booking.folios[0].id },
          data: { subtotal: { increment: penaltyAmount }, totalAmount: { increment: penaltyAmount }, balance: { increment: penaltyAmount } },
        });
        summary.noShowRevenue += penaltyAmount;
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'no_show', cancelledAt: new Date(), cancelledBy: 'system', cancellationReason: 'No-show - auto-processed during night audit' },
      });

      if (booking.roomId) {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'available' } });
      }

      summary.noShowsProcessed++;
    }

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Process no-shows' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ noShowsProcessed: summary.noShowsProcessed, revenueCaptured: summary.noShowRevenue }) },
    });

    // ── Step 4: Reconcile rooms ──
    const rooms = await tx.room.findMany({
      where: { propertyId: audit.propertyId, deletedAt: null },
      include: {
        bookings: {
          where: { status: { in: ['confirmed', 'in_house'] }, actualCheckOut: null },
          select: { id: true, confirmationCode: true },
        },
      },
    });

    for (const room of rooms) {
      summary.roomsReconciled++;
      const activeBooking = room.bookings[0];
      if (activeBooking && room.status !== 'occupied') {
        summary.discrepancies++;
        await tx.room.update({ where: { id: room.id }, data: { status: 'occupied' } });
      } else if (!activeBooking && room.status === 'occupied') {
        summary.discrepancies++;
        await tx.room.update({ where: { id: room.id }, data: { status: 'available' } });
      }
    }

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Reconcile rooms' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ roomsReconciled: summary.roomsReconciled, discrepancies: summary.discrepancies }) },
    });

    // ── Step 5: Generate occupancy and revenue summary ──
    const totalRooms = await tx.room.count({ where: { propertyId: audit.propertyId, deletedAt: null } });
    const occupiedRooms = await tx.room.count({ where: { propertyId: audit.propertyId, status: 'occupied', deletedAt: null } });

    const lineItems = await tx.folioLineItem.findMany({
      where: { folio: { propertyId: audit.propertyId, tenantId: audit.tenantId }, serviceDate: { gte: startOfDay, lte: endOfDay } },
    });

    const totalCharges = lineItems.reduce((s, i) => s + i.totalAmount, 0);
    summary.roomRevenue = lineItems.filter((i) => i.category === 'room').reduce((s, i) => s + i.totalAmount, 0);
    summary.fbRevenue = lineItems.filter((i) => ['food_beverage', 'restaurant', 'room_service', 'minibar'].includes(i.category)).reduce((s, i) => s + i.totalAmount, 0);
    summary.otherRevenue = totalCharges - summary.roomRevenue - summary.fbRevenue;
    summary.occupancyRate = totalRooms > 0 ? `${((occupiedRooms / totalRooms) * 100).toFixed(1)}%` : '0%';

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Run reports' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ occupancy: { total: totalRooms, occupied: occupiedRooms, rate: summary.occupancyRate }, revenue: { room: summary.roomRevenue, fb: summary.fbRevenue, other: summary.otherRevenue, total: totalCharges } }) },
    });

    // ── Step 6: Close business day ──
    await tx.nightAudit.update({
      where: { id: audit.id },
      data: {
        roomChargesPosted: summary.roomChargesPosted,
        noShowsProcessed: summary.noShowsProcessed,
        roomsReconciled: summary.roomsReconciled,
        discrepancies: summary.discrepancies,
        roomRevenue: summary.roomRevenue,
        fbRevenue: summary.fbRevenue,
        otherRevenue: summary.otherRevenue,
        totalRevenue: summary.roomRevenue + summary.fbRevenue + summary.otherRevenue,
        autoPostedAt: new Date(),
        completedBy: userId,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Close business day' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId },
    });

    // ── Create summary log entry ──
    await tx.nightAuditLog.create({
      data: {
        nightAuditId: audit.id,
        action: 'audit_completed',
        entityType: 'NightAudit',
        entityId: audit.id,
        newValue: `Night audit completed automatically. Room charges: ${summary.roomChargesPosted} ($${summary.roomChargeTotal.toFixed(2)}), No-shows: ${summary.noShowsProcessed} ($${summary.noShowRevenue.toFixed(2)}), Rooms reconciled: ${summary.roomsReconciled}, Occupancy: ${summary.occupancyRate}, Total revenue: $${(summary.roomRevenue + summary.fbRevenue + summary.otherRevenue).toFixed(2)}`,
        performedBy: userId,
      },
    });
  });

  // Fetch the completed audit to return
  const completedAudit = await db.nightAudit.findUnique({
    where: { id: audit.id },
    include: {
      property: { select: { id: true, name: true } },
      startedByUser: { select: { id: true, firstName: true, lastName: true } },
      completedByUser: { select: { id: true, firstName: true, lastName: true } },
      steps: { orderBy: { stepOrder: 'asc' } },
    },
  });

  return { audit: completedAudit, summary };
}

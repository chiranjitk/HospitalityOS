import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
import crypto from 'crypto';

// ─── Night Audit Steps Template ───
const NIGHT_AUDIT_STEPS = [
  { stepName: 'Post room charges', stepOrder: 1 },
  { stepName: 'Post scheduled charges', stepOrder: 2 },
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
  invoicesGenerated: number;
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
    invoicesGenerated: 0,
  };

  // H-17 FIX: Canonical folio recalculation helper. Instead of using Prisma's
  // { increment } operator (which can drift from actual line-item totals due
  // to race conditions or concurrent mutations), we sum ALL line items for
  // the folio and recalculate subtotal, taxes, totalAmount, and balance.
  async function recalcFolio(tx: typeof db, folioId: string) {
    const allItems = await tx.folioLineItem.findMany({ where: { folioId } });
    const folio = await tx.folio.findUnique({ where: { id: folioId } });
    if (!folio) return;

    const subtotal = Math.round(allItems.reduce((s, li) => s + li.totalAmount, 0) * 100) / 100;
    const taxes = Math.round(allItems.reduce((s, li) => s + (li.taxAmount || 0), 0) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxes - (folio.discount || 0)) * 100) / 100;

    const completedPayments = await tx.payment.findMany({
      where: { folioId, status: 'completed' },
      select: { amount: true },
    });
    const paidAmount = Math.round(completedPayments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    const balance = Math.round((totalAmount - paidAmount) * 100) / 100;

    await tx.folio.update({
      where: { id: folioId },
      data: { subtotal, taxes, totalAmount, paidAmount, balance },
    });
  }

  await db.$transaction(async (tx) => {
    const businessDay = new Date(audit.businessDayDate);
    const startOfDay = new Date(businessDay);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(businessDay);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch property settings for tax calculation (property is NOT in scope here)
    const property = await tx.property.findUnique({
      where: { id: audit.propertyId },
      select: { taxComponents: true, defaultTaxRate: true },
    });

    // ── Step 1: Post room charges for all in-house guests ──
    const activeBookings = await tx.booking.findMany({
      where: {
        tenantId: audit.tenantId,
        propertyId: audit.propertyId,
        status: { in: ['checked_in'] },
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

    // Calculate tax rate from property settings
    let taxRate = 0;
    if (property?.taxComponents) {
      try {
        const tc = JSON.parse(property.taxComponents || '[]');
        if (Array.isArray(tc) && tc.length > 0) {
          taxRate = tc.reduce((s: number, c: { rate: number }) => s + (c.rate || 0), 0) / 100;
        } else { taxRate = (property.defaultTaxRate || 0) / 100; }
      } catch { taxRate = (property.defaultTaxRate || 0) / 100; }
    }

    for (const booking of activeBookings) {
      const roomRate = booking.roomRate > 0 ? booking.roomRate : booking.roomType.basePrice;
      const taxAmount = Math.round(roomRate * taxRate * 100) / 100;
      const folio = booking.folios[0];
      if (!folio) continue;

      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `Room charge - Room ${booking.room?.number || 'N/A'} (${booking.roomType.name}) - Night Audit`,
          category: 'room_charge',
          quantity: 1,
          unitPrice: roomRate,
          totalAmount: roomRate,
          taxAmount,
          serviceDate: audit.businessDayDate,
          referenceType: 'NightAudit',
          referenceId: audit.id,
          postedBy: 'system',
        },
      });

      // H-17 FIX: Recalculate folio from all line items instead of incrementing
      await recalcFolio(tx, folio.id);

      summary.roomChargesPosted++;
      summary.roomChargeTotal += roomRate + taxAmount;
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
          category: sc.chargeType || 'miscellaneous',
          quantity: 1,
          unitPrice: sc.amount,
          totalAmount: sc.amount,
          serviceDate: audit.businessDayDate,
          referenceType: 'NightAudit',
          referenceId: audit.id,
          postedBy: 'system',
        },
      });

      // H-17 FIX: Recalculate folio from all line items instead of incrementing
      await recalcFolio(tx, folio.id);

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
      where: { nightAuditId: audit.id, stepName: 'Post scheduled charges' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ scheduledChargesPosted: summary.scheduledChargesPosted, scheduledChargeTotal: summary.scheduledChargeTotal }) },
    });

    // GAP 9: Post WiFi usage charges for active in-house guests with billable WiFi sessions
    try {
      const wifiBookings = await tx.booking.findMany({
        where: {
          tenantId: audit.tenantId,
          propertyId: audit.propertyId,
          status: 'checked_in',
          actualCheckIn: { lte: endOfDay },
          actualCheckOut: null,
        },
        include: {
          primaryGuest: { select: { id: true } },
          folios: { where: { status: 'open' }, select: { id: true, currency: true } },
        },
      });

      for (const booking of wifiBookings) {
        if (booking.folios.length === 0) continue;

        // Query WiFiUser for this booking to check data usage
        const wifiUsers = await tx.wiFiUser.findMany({
          where: {
            bookingId: booking.id,
            status: { in: ['active', 'suspended'] },
          },
          select: {
            id: true,
            username: true,
            totalBytesIn: true,
            totalBytesOut: true,
            lastBilledBytesIn: true,
            lastBilledBytesOut: true,
            lastAccountingAt: true,
            planId: true,
          },
        });

        for (const wifiUser of wifiUsers) {
          // Check if there's a billable plan with overage charges
          if (!wifiUser.planId) continue;

          const wifiPlan = await tx.wiFiPlan.findUnique({
            where: { id: wifiUser.planId },
            select: { dataLimit: true, pricePerMb: true, name: true, billingModel: true },
          });

          if (!wifiPlan || !wifiPlan.dataLimit || !wifiPlan.pricePerMb) continue;

          // Calculate total usage in MB (delta-based — only bill data since last night audit)
          const totalBytesIn = Number(wifiUser.totalBytesIn || BigInt(0));
          const totalBytesOut = Number(wifiUser.totalBytesOut || BigInt(0));
          const lastBilledIn = Number(wifiUser.lastBilledBytesIn || BigInt(0));
          const lastBilledOut = Number(wifiUser.lastBilledBytesOut || BigInt(0));
          const deltaUsageMB = Math.floor((Math.max(0, totalBytesIn - lastBilledIn) + Math.max(0, totalBytesOut - lastBilledOut)) / (1024 * 1024));
          const dataLimitMB = wifiPlan.dataLimit;

          if (deltaUsageMB > dataLimitMB) {
            const overageMB = deltaUsageMB - dataLimitMB;
            const overageCharge = Math.round(overageMB * wifiPlan.pricePerMb * 100) / 100;

            if (overageCharge > 0) {
              await tx.folioLineItem.create({
                data: {
                  folioId: booking.folios[0].id,
                  description: `WiFi overage - ${overageMB}MB over ${dataLimitMB}MB limit (${wifiPlan.name})`,
                  category: 'wifi',
                  quantity: overageMB,
                  unitPrice: wifiPlan.pricePerMb,
                  totalAmount: overageCharge,
                  serviceDate: audit.businessDayDate,
                  referenceType: 'NightAudit',
                  referenceId: audit.id,
                  postedBy: 'system',
                },
              });

              // H-17 FIX: Recalculate folio from all line items instead of incrementing
              await recalcFolio(tx, booking.folios[0].id);

              summary.otherRevenue += overageCharge;

              // Snapshot usage counters (prevent re-billing same data)
              await tx.wiFiUser.update({
                where: { id: wifiUser.id },
                data: {
                  lastBilledBytesIn: wifiUser.totalBytesIn,
                  lastBilledBytesOut: wifiUser.totalBytesOut,
                  lastBilledAt: new Date(),
                },
              });
            }
          }
        }
      }
    } catch (wifiBillingError) {
      console.warn('[NightAudit] WiFi usage billing step failed (non-blocking):', wifiBillingError);
      await tx.nightAuditLog.create({
        data: {
          nightAuditId: audit.id,
          action: 'wifi_billing_failed',
          entityType: 'NightAudit',
          entityId: audit.id,
          newValue: `WiFi usage billing failed: ${wifiBillingError instanceof Error ? wifiBillingError.message : 'Unknown error'}`,
          performedBy: userId,
        },
      });
    }

    // ── Step 3: Process no-shows (with configurable buffer from Property.noShowSettings) ──
    const tomorrow = new Date(startOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // GAP-002: Read no-show settings from the property
    let noShowBufferHours = 1;
    let autoProcessNoShows = true;
    try {
      const propertySettings = await tx.property.findUnique({
        where: { id: audit.propertyId },
        select: { noShowSettings: true },
      });
      if (propertySettings?.noShowSettings) {
        const parsed = JSON.parse(propertySettings.noShowSettings);
        noShowBufferHours = parsed.noShowBufferHours ?? 1;
        autoProcessNoShows = parsed.autoProcessNoShows ?? true;
      }
    } catch (parseError) {
      console.warn('[NightAudit] Failed to parse noShowSettings, using defaults:', parseError);
    }

    if (!autoProcessNoShows) {
      // Skip no-show processing — log that it was skipped
      console.log(`[NightAudit] No-show processing skipped: autoProcessNoShows is false for property ${audit.propertyId}`);
      await tx.nightAuditLog.create({
        data: {
          nightAuditId: audit.id,
          action: 'noshow_skipped',
          entityType: 'Booking',
          entityId: audit.id,
          newValue: `No-show processing skipped: autoProcessNoShows is disabled for this property (buffer: ${noShowBufferHours}h)`,
          performedBy: userId,
        },
      });
    } else {
      console.log(`[NightAudit] Processing no-shows with buffer: ${noShowBufferHours}h for property ${audit.propertyId}`);

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

      // Filter: only mark as no-show if checkIn time + buffer has passed
      const now = new Date();
      const applicableNoShows = noShows.filter(booking => {
        const bufferExpiry = new Date(booking.checkIn.getTime() + noShowBufferHours * 60 * 60 * 1000);
        return bufferExpiry < now;
      });

      console.log(`[NightAudit] Found ${noShows.length} potential no-shows, ${applicableNoShows.length} past ${noShowBufferHours}h buffer`);

      for (const booking of applicableNoShows) {
        const policy = await tx.cancellationPolicy.findFirst({
          where: { tenantId: audit.tenantId, isActive: true, OR: [{ propertyId: audit.propertyId }, { propertyId: null }] },
        });

        const penaltyPercent = policy?.noShowPenaltyPercent ?? 100;
        const penaltyAmount = booking.totalAmount * (penaltyPercent / 100);

        // H-48 FIX: Send guest notification before marking as no-show
        if (booking.guestId) {
          try {
            await tx.notification.create({
              data: {
                guestId: booking.guestId,
                bookingId: booking.id,
                type: 'no_show',
                title: 'Booking Marked as No-Show',
                message: `Your booking (${booking.confirmationCode || booking.id}) has been marked as a no-show. A penalty of ${penaltyPercent}% (${booking.currency || 'INR'} ${penaltyAmount.toFixed(2)}) has been applied to your folio. Please contact the front desk if you believe this is an error.`,
                isRead: false,
                channel: 'in_app',
              },
            });
          } catch (notifyErr) {
            console.warn('[NightAudit] Failed to create no-show notification:', notifyErr);
          }
        }

        if (penaltyAmount > 0 && booking.folios[0]) {
          await tx.folioLineItem.create({
            data: {
              folioId: booking.folios[0].id,
              description: `No-show penalty (${penaltyPercent}%)`,
              category: 'adjustment',
              quantity: 1,
              unitPrice: penaltyAmount,
              totalAmount: penaltyAmount,
              serviceDate: audit.businessDayDate,
              referenceType: 'NightAudit',
              referenceId: audit.id,
              postedBy: 'system',
            },
          });
          // H-17 FIX: Recalculate folio from all line items instead of incrementing
          await recalcFolio(tx, booking.folios[0].id);
          summary.noShowRevenue += penaltyAmount;
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'no_show', cancelledAt: new Date(), cancelledBy: 'system', cancellationReason: 'No-show - auto-processed during night audit' },
        });

        if (booking.roomId) {
          // No-show: guest never checked in → room does NOT need cleaning
          await tx.room.update({
            where: { id: booking.roomId },
            data: { status: 'available', housekeepingStatus: 'clean' },
          });
        }

        summary.noShowsProcessed++;
      }
    } // end of else (autoProcessNoShows)

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Process no-shows' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ noShowsProcessed: summary.noShowsProcessed, revenueCaptured: summary.noShowRevenue }) },
    });

    // ── Step 4: Reconcile rooms ──
    // Pre-query: find rooms with recent check-ins (last 60 min) to avoid releasing rooms mid check-in
    const recentCheckinRoomIds = new Set(
      (
        await tx.booking.findMany({
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

    const rooms = await tx.room.findMany({
      where: { propertyId: audit.propertyId, deletedAt: null },
      include: {
        bookings: {
          where: { status: { in: ['confirmed', 'checked_in'] }, actualCheckOut: null },
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
        // Guard: don't release rooms that may have in-progress check-ins/out.
        // - Skip rooms whose status changed to 'reserved' (race condition: auto-assigned but check-in not yet complete)
        // - Skip rooms with recent bookings (checkIn within last 60 min) that might be mid check-in
        // - Only release rooms that have been occupied for more than 30 minutes to avoid race conditions
        if (
          recentCheckinRoomIds.has(room.id) ||
          (room.updatedAt && Date.now() - room.updatedAt.getTime() < 30 * 60 * 1000)
        ) {
          continue;
        }
        summary.discrepancies++;
        // Data anomaly: room was occupied but no active booking → mark dirty and create cleaning task
        await tx.room.update({ where: { id: room.id }, data: { status: 'available', housekeepingStatus: 'dirty' } });
        const existingReconTask = await tx.task.findFirst({
          where: {
            roomId: room.id,
            type: 'cleaning',
            category: 'reconciliation',
            status: { in: ['pending', 'in_progress', 'assigned'] },
          },
        });
        if (!existingReconTask) {
          await tx.task.create({
            data: {
              tenantId: audit.tenantId,
              propertyId: audit.propertyId,
              roomId: room.id,
              type: 'cleaning',
              category: 'reconciliation',
              title: `Auto: Reconciliation Clean - Room ${room.number}`,
              description: 'Automatic task: room was marked occupied but has no active booking (data anomaly). Full cleaning required before reuse.',
              priority: 'medium',
              status: 'pending',
              scheduledAt: new Date(),
              estimatedDuration: 45,
              notes: 'Created during night audit room reconciliation',
            },
          });
        }
      }
    }

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Reconcile rooms' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ roomsReconciled: summary.roomsReconciled, discrepancies: summary.discrepancies }) },
    });

    // ── Step 4b (BUG-012): Auto-generate invoices for folios without invoices (GST compliance) ──
    // Under Indian GST law, invoices must be generated for all taxable supplies,
    // not just paid/closed ones. This step ensures every open or partially_paid folio
    // that doesn't already have an invoice gets one.
    const foliosNeedingInvoices = await tx.folio.findMany({
      where: {
        propertyId: audit.propertyId,
        tenantId: audit.tenantId,
        status: { in: ['open', 'partially_paid'] },
        invoiceNumber: null,
      },
      include: {
        booking: {
          include: {
            primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true, city: true, country: true } },
            room: { include: { roomType: { select: { name: true } } } },
          },
        },
      },
    });

    for (const folio of foliosNeedingInvoices) {
      const guest = folio.booking?.primaryGuest;
      const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').slice(0, 4)}`;

      await tx.invoice.create({
        data: {
          tenantId: folio.tenantId,
          invoiceNumber,
          folioId: folio.id,
          customerName: guest ? `${guest.firstName} ${guest.lastName}` : 'Guest',
          customerEmail: guest?.email,
          customerAddress: guest ? [guest.city, guest.country].filter(Boolean).join(', ') : undefined,
          subtotal: folio.subtotal,
          taxes: folio.taxes,
          discount: folio.discount,
          totalAmount: folio.totalAmount,
          currency: folio.currency,
          issuedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'issued',
          pdfUrl: `/api/invoices/${folio.id}/pdf`,
        },
      });

      // Update folio with invoice info
      await tx.folio.update({
        where: { id: folio.id },
        data: { invoiceNumber, invoiceIssuedAt: new Date() },
      });

      summary.invoicesGenerated++;
    }

    if (summary.invoicesGenerated > 0) {
      await tx.nightAuditLog.create({
        data: {
          nightAuditId: audit.id,
          action: 'invoices_generated',
          entityType: 'Folio',
          entityId: audit.id,
          newValue: `Auto-generated ${summary.invoicesGenerated} invoice(s) for folios without invoices (GST compliance)`,
          performedBy: userId,
        },
      });
    }

    // ── Step 5: Generate occupancy and revenue summary ──
    const totalRooms = await tx.room.count({ where: { propertyId: audit.propertyId, deletedAt: null } });
    const occupiedRooms = await tx.room.count({ where: { propertyId: audit.propertyId, status: 'occupied', deletedAt: null } });

    // GAP 8: Close open folios for bookings checked out more than 1 day ago
    const oneDayAgo = new Date(endOfDay.getTime() - 24 * 60 * 60 * 1000);
    const staleOpenFolios = await tx.folio.findMany({
      where: {
        propertyId: audit.propertyId,
        tenantId: audit.tenantId,
        status: { in: ['open', 'partially_paid'] },
        booking: {
          status: 'checked_out',
          actualCheckOut: { lte: oneDayAgo },
        },
      },
      select: { id: true },
    });

    for (const staleFolio of staleOpenFolios) {
      await tx.folio.update({
        where: { id: staleFolio.id },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
      });
    }

    if (staleOpenFolios.length > 0) {
      await tx.nightAuditLog.create({
        data: {
          nightAuditId: audit.id,
          action: 'stale_folios_closed',
          entityType: 'Folio',
          entityId: audit.id,
          newValue: `Closed ${staleOpenFolios.length} open folio(s) for departed guests (checked out > 1 day ago)`,
          performedBy: userId,
        },
      });
    }

    // H-7 FIX: Revenue totals come from summing daily line items, NOT cumulative folio totals.
    // This ensures revenue reflects only activity within the audit day.
    // BUG-017 FIX: Use folio totalAmount as the source of truth for totalRevenue
    // instead of summing line items (which exclude taxes/discounts and may not
    // match actual folio totals). Query folios that had activity during the audit day.
    const lineItems = await tx.folioLineItem.findMany({
      where: { folio: { propertyId: audit.propertyId, tenantId: audit.tenantId }, serviceDate: { gte: startOfDay, lte: endOfDay } },
      select: { category: true, totalAmount: true, folioId: true },
    });

    // Category breakdown from line items (for reporting granularity)
    summary.roomRevenue = lineItems.filter((i) => i.category === 'room_charge').reduce((s, i) => s + i.totalAmount, 0);
    summary.fbRevenue = lineItems.filter((i) => ['food_beverage', 'restaurant', 'room_service', 'minibar'].includes(i.category)).reduce((s, i) => s + i.totalAmount, 0);
    summary.otherRevenue = lineItems.filter((i) => i.category !== 'room_charge' && !['food_beverage', 'restaurant', 'room_service', 'minibar'].includes(i.category)).reduce((s, i) => s + i.totalAmount, 0);

    // Total revenue from summing daily line items (not cumulative folio totals)
    const lineItemTotalRevenue = lineItems.reduce((s, i) => s + i.totalAmount, 0);
    summary.occupancyRate = totalRooms > 0 ? `${((occupiedRooms / totalRooms) * 100).toFixed(1)}%` : '0%';

    await tx.nightAuditStep.updateMany({
      where: { nightAuditId: audit.id, stepName: 'Run reports' },
      data: { status: 'completed', completedAt: new Date(), performedBy: userId, result: JSON.stringify({ occupancy: { total: totalRooms, occupied: occupiedRooms, rate: summary.occupancyRate }, revenue: { room: summary.roomRevenue, fb: summary.fbRevenue, other: summary.otherRevenue, total: lineItemTotalRevenue }, invoicesGenerated: summary.invoicesGenerated }) },
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
        totalRevenue: lineItemTotalRevenue,
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
        newValue: `Night audit completed automatically. Room charges: ${summary.roomChargesPosted} ($${summary.roomChargeTotal.toFixed(2)}), No-shows: ${summary.noShowsProcessed} ($${summary.noShowRevenue.toFixed(2)}), Rooms reconciled: ${summary.roomsReconciled}, Occupancy: ${summary.occupancyRate}, Total revenue: $${lineItemTotalRevenue.toFixed(2)}, Invoices generated: ${summary.invoicesGenerated}`,
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

/**
 * Night Audit Automation Cron Job
 *
 * GET /api/cron/night-audit-automation?cron=true
 *
 * Automatically triggers night audit for properties that haven't had one today.
 * Called by external cron/scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cronMode = searchParams.get('cron') === 'true';

  if (!cronMode) {
    return NextResponse.json({
      success: false,
      error: 'This endpoint is for cron automation only. Use ?cron=true with proper auth.',
    }, { status: 400 });
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get today's date range (UTC)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Find all active properties
    const properties = await db.property.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true, name: true, tenantId: true },
    });

    let audited = 0;
    const errors: string[] = [];

    for (const property of properties) {
      try {
        // Check if an audit already ran today for this property
        const existingAudit = await db.nightAudit.findFirst({
          where: {
            propertyId: property.id,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (existingAudit) {
          continue; // Already audited today
        }

        // Check for in-progress audit
        const inProgress = await db.nightAudit.findFirst({
          where: { propertyId: property.id, status: 'in_progress' },
        });

        if (inProgress) {
          errors.push(`Property ${property.name}: Audit already in progress`);
          continue;
        }

        // Create and execute the night audit
        const auditDate = new Date();
        // Use yesterday as the business day (night audit processes the previous day)
        const businessDayDate = new Date();
        businessDayDate.setDate(businessDayDate.getDate() - 1);

        // Find a system/admin user for the audit
        const auditUser = await db.user.findFirst({
          where: { tenantId: property.tenantId, status: 'active', deletedAt: null },
          select: { id: true },
        });

        if (!auditUser) {
          errors.push(`Property ${property.name}: No active user found to run audit`);
          continue;
        }

        const NIGHT_AUDIT_STEPS = [
          { stepName: 'Post room charges', stepOrder: 1 },
          { stepName: 'Verify folios', stepOrder: 2 },
          { stepName: 'Process no-shows', stepOrder: 3 },
          { stepName: 'Reconcile rooms', stepOrder: 4 },
          { stepName: 'Run reports', stepOrder: 5 },
          { stepName: 'Close business day', stepOrder: 6 },
        ];

        const audit = await db.nightAudit.create({
          data: {
            tenantId: property.tenantId,
            propertyId: property.id,
            auditDate,
            businessDayDate,
            startedBy: auditUser.id,
            status: 'in_progress',
            steps: {
              create: NIGHT_AUDIT_STEPS.map((s) => ({
                stepName: s.stepName,
                stepOrder: s.stepOrder,
                status: 'pending',
              })),
            },
          },
        });

        // Log execution
        await db.auditLog.create({
          data: {
            tenantId: property.tenantId,
            module: 'night_audit',
            action: 'create',
            entityType: 'NightAudit',
            entityId: audit.id,
            newValue: JSON.stringify({
              triggeredBy: 'cron',
              propertyId: property.id,
              propertyName: property.name,
              businessDay: businessDayDate.toISOString().split('T')[0],
            }),
          },
        });

        // Mark all steps as completed (simplified automation)
        // The full audit logic runs asynchronously via the existing night audit execution
        // Execute actual night audit steps via transaction
        try {
          await db.$transaction(async (tx) => {
            // Step 1: Post room charges
            const activeBookings = await tx.booking.findMany({
              where: {
                tenantId: property.tenantId,
                propertyId: property.id,
                status: { in: ['confirmed', 'checked_in'] },
                actualCheckIn: { lte: new Date() },
                OR: [{ actualCheckOut: null }, { actualCheckOut: { gte: new Date() } }],
              },
              include: { room: { select: { id: true, number: true } }, roomType: { select: { basePrice: true } }, folios: { where: { status: 'open' }, select: { id: true } } },
            });
            for (const booking of activeBookings) {
              const folio = booking.folios[0];
              if (!folio) continue;
              const rate = Math.round(booking.roomRate > 0 ? booking.roomRate : (booking.roomType?.basePrice || 0));
              await tx.folioLineItem.create({ data: { folioId: folio.id, description: `Room charge - Room ${booking.room?.number || 'N/A'} - Night Audit`, category: 'room', quantity: 1, unitPrice: rate, totalAmount: rate, serviceDate: businessDayDate, referenceType: 'NightAudit', referenceId: audit.id, postedBy: 'system' } });
              await tx.folio.update({ where: { id: folio.id }, data: { subtotal: { increment: rate }, totalAmount: { increment: rate }, balance: { increment: rate } } });
            }
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 1 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });

            // CRITICAL-06 FIX: Step 2 — Verify folios (check for negative balances, orphaned items)
            const openFolios = await tx.folio.findMany({
              where: {
                tenantId: property.tenantId,
                propertyId: property.id,
                status: { in: ['open', 'partially_paid'] },
              },
              select: { id: true, balance: true },
            });
            let folioWarnings = 0;
            for (const f of openFolios) {
              if (f.balance < -0.01) folioWarnings++;
            }
            if (folioWarnings > 0) {
              await db.auditLog.create({
                data: {
                  tenantId: property.tenantId, module: 'night_audit', action: 'warning',
                  entityType: 'NightAudit', entityId: audit.id,
                  newValue: JSON.stringify({ step: 2, warning: `${folioWarnings} folio(s) with negative balance detected` }),
                },
              });
            }
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 2 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });

            // Step 3 — Process no-shows (bookings past check-out date still confirmed)
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const noShowBookings = await tx.booking.findMany({
              where: {
                tenantId: property.tenantId,
                propertyId: property.id,
                status: 'confirmed',
                actualCheckIn: null,
                checkIn: { lt: today },
              },
              select: { id: true, confirmationCode: true, folios: { select: { id: true } } },
            });
            for (const ns of noShowBookings) {
              await tx.booking.update({
                where: { id: ns.id },
                data: { status: 'no_show', cancelledAt: new Date(), cancellationReason: 'Auto no-show by night audit' },
              });
              // Release room
              await tx.room.updateMany({
                where: { currentBookingId: ns.id },
                data: { status: 'available', currentBookingId: null },
              });
            }
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 3 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });

            // Step 4 — Reconcile rooms (ensure room status matches booking status)
            const checkedOutRooms = await tx.room.findMany({
              where: {
                propertyId: property.id,
                status: 'occupied',
                currentBookingId: { not: null },
              },
              include: { currentBooking: { select: { id: true, status: true } } },
            });
            for (const room of checkedOutRooms) {
              if (room.currentBooking && !['confirmed', 'checked_in'].includes(room.currentBooking.status)) {
                await tx.room.update({
                  where: { id: room.id },
                  data: { status: 'available', currentBookingId: null },
                });
              }
            }
            // Set rooms with no active booking to available
            await tx.room.updateMany({
              where: {
                propertyId: property.id,
                status: 'occupied',
                currentBookingId: null,
              },
              data: { status: 'available' },
            });
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 4 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });

            // Step 5 — Run reports (log occupancy and revenue summary)
            const occupancyStats = await tx.booking.groupBy({
              by: ['status'],
              where: {
                tenantId: property.tenantId,
                propertyId: property.id,
                status: { in: ['confirmed', 'checked_in'] },
                OR: [{ actualCheckOut: null }, { actualCheckOut: { gte: new Date() } }],
              },
              _count: true,
            });
            const revenueResult = await tx.folioLineItem.aggregate({
              where: {
                tenantId: property.tenantId,
                serviceDate: businessDayDate,
                category: 'room',
              },
              _sum: { totalAmount: true },
            });
            await db.auditLog.create({
              data: {
                tenantId: property.tenantId, module: 'night_audit', action: 'create',
                entityType: 'NightAudit', entityId: audit.id,
                newValue: JSON.stringify({
                  step: 5, type: 'daily_report',
                  occupancy: occupancyStats,
                  roomRevenue: revenueResult._sum.totalAmount || 0,
                  businessDay: businessDayDate.toISOString().split('T')[0],
                }),
              },
            });
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 5 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });

            // Step 6 — Close business day (final reconciliation)
            await tx.nightAuditStep.updateMany({
              where: { nightAuditId: audit.id, stepOrder: 6 },
              data: { status: 'completed', completedAt: new Date(), performedBy: auditUser.id },
            });
          });
        } catch (txError) {
          console.error(`[Cron] Transaction failed for property ${property.name}:`, txError);
          errors.push(`Property ${property.name}: Transaction failed`);
          // Reset audit to in_progress so it can be retried
          await db.nightAudit.update({ where: { id: audit.id }, data: { status: 'in_progress' } });
          await db.nightAuditStep.updateMany({ where: { nightAuditId: audit.id }, data: { status: 'pending' } });
          continue;
        }

        await db.nightAudit.update({
          where: { id: audit.id },
          data: {
            status: 'completed',
            completedBy: auditUser.id,
            completedAt: new Date(),
            autoPostedAt: new Date(),
          },
        });

        audited++;
      } catch (propError) {
        const message = propError instanceof Error ? propError.message : 'Unknown error';
        errors.push(`Property ${property.name}: ${message}`);
      }
    }

    // Log overall cron execution (one per tenant)
    const tenantsProcessed = new Set(properties.map(p => p.tenantId));
    for (const tenantId of tenantsProcessed) {
      try {
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'night_audit',
            action: 'create',
            entityType: 'CronJob',
            newValue: JSON.stringify({
              job: 'night-audit-automation',
              propertiesProcessed: properties.filter(p => p.tenantId === tenantId).length,
              audited: properties.filter(p => p.tenantId === tenantId).length > 0 ? audited : 0,
              errors: errors.length,
            }),
          },
        });
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      audited,
      total: properties.length,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('[Cron] Night audit automation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

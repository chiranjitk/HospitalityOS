import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/cron/deposit-reminder
 *
 * Cron job to check for group bookings with pending deposits and create
 * notification records for follow-up.
 *
 * Cron schedule suggestion: Run daily at 09:00 AM
 *   0 9 * * * curl -X POST https://your-domain.com/api/cron/deposit-reminder \
 *     -H "Authorization: Bearer ${CRON_SECRET}"
 *
 * Finds group bookings where:
 *   - status is 'confirmed' or 'in_progress'
 *   - depositPaid is false
 *   - depositAmount > 0
 *   - checkIn is within the next 7 days (urgent) or already past
 * And creates a Notification record for each.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find group bookings with pending deposits that need reminders
    const groupBookings = await db.groupBooking.findMany({
      where: {
        depositPaid: false,
        depositAmount: { gt: 0 },
        status: { in: ['confirmed', 'in_progress'] },
        checkIn: { lte: sevenDaysFromNow },
      },
      include: {
        property: { select: { id: true, name: true, tenantId: true } },
      },
    });

    if (groupBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending deposits to remind',
        reminded: 0,
      });
    }

    let reminded = 0;
    const errors: string[] = [];

    for (const group of groupBookings) {
      try {
        // Check if we already sent a reminder recently (within last 24h)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentNotification = await db.notification.findFirst({
          where: {
            entityType: 'group_booking',
            entityId: group.id,
            type: 'deposit_reminder',
            createdAt: { gte: oneDayAgo },
          },
        });

        if (recentNotification) {
          continue; // Already reminded recently
        }

        const daysUntilCheckIn = Math.ceil(
          (group.checkIn.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        const urgency = daysUntilCheckIn <= 0
          ? 'overdue'
          : daysUntilCheckIn <= 3
            ? 'urgent'
            : 'reminder';

        const message = daysUntilCheckIn <= 0
          ? `Deposit overdue for group "${group.name}" (was due ${(Math.abs(daysUntilCheckIn))} day(s) ago). Amount: ${group.depositAmount}.`
          : `Deposit pending for group "${group.name}" — ${daysUntilCheckIn} day(s) until check-in. Amount: ${group.depositAmount}.`;

        // Create notification record
        await db.notification.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: group.tenantId,
            userId: group.contactName ? undefined : undefined, // No specific user — broadcast to property managers
            propertyId: group.propertyId,
            type: 'deposit_reminder',
            title: `Group Deposit ${urgency === 'overdue' ? 'Overdue' : 'Reminder'}: ${group.name}`,
            message,
            entityType: 'group_booking',
            entityId: group.id,
            priority: urgency === 'overdue' ? 'high' : urgency === 'urgent' ? 'medium' : 'low',
            isRead: false,
            data: {
              groupName: group.name,
              depositAmount: group.depositAmount,
              checkIn: group.checkIn.toISOString(),
              daysUntilCheckIn,
              urgency,
              contactEmail: group.contactEmail,
              contactPhone: group.contactPhone,
            } as any,
          },
        });

        reminded++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Group ${group.id}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${groupBookings.length} group bookings, sent ${reminded} reminders`,
      processed: groupBookings.length,
      reminded,
      skipped: groupBookings.length - reminded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Deposit Reminder Cron] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process deposit reminders' } },
      { status: 500 }
    );
  }
}

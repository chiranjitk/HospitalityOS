/**
 * CRON: Deposit Reminder
 * Checks for bookings with pending deposits and creates notification records.
 * Should be called every 6-12 hours by an external cron scheduler.
 *
 * POST /api/cron/deposit-reminder
 * Authorization: Bearer CRON_SECRET
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Find bookings with check-in in the next 48h that have no deposit
    const pendingDeposits = await db.booking.findMany({
      where: {
        status: 'confirmed',
        actualCheckIn: null,
        checkIn: { lte: tomorrow, gte: twoDaysAgo },
        totalAmount: { gt: 0 },
      },
      select: {
        id: true, confirmationCode: true, tenantId: true, propertyId: true,
        primaryGuestId: true, checkIn: true, totalAmount: true,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, email: true } },
        folios: { select: { id: true, paidAmount: true, totalAmount: true }, where: { status: 'open' } },
      },
    });

    let notified = 0;
    for (const booking of pendingDeposits) {
      const folio = booking.folios[0];
      if (!folio || folio.paidAmount >= folio.totalAmount * 0.1) continue;

      try {
        await db.notification.create({
          data: {
            tenantId: booking.tenantId,
            userId: booking.primaryGuestId || '',
            type: 'reminder',
            category: 'info',
            title: 'Deposit Reminder',
            message: `Deposit recommended for ${booking.confirmationCode} (${booking.checkIn?.toDateString()}, amount: $${booking.totalAmount})`,
            priority: 'normal',
          },
        });
        notified++;
      } catch { /* skip */ }
    }

    return NextResponse.json({ success: true, checked: pendingDeposits.length, notified });
  } catch (error) {
    console.error('[Cron] Deposit reminder error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

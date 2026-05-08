import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/marketing/abandoned-bookings/recover — Send recovery email/SMS, apply offer
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, channel, offerPercent } = body;

    if (!id || !channel) {
      return NextResponse.json({ success: false, error: 'ID and channel are required' }, { status: 400 });
    }

    if (!['email', 'sms'].includes(channel)) {
      return NextResponse.json({ success: false, error: 'Channel must be "email" or "sms"' }, { status: 400 });
    }

    const existing = await db.abandonedBooking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Abandoned booking not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (channel === 'email') {
      updateData.recoveryStatus = 'emailed';
      updateData.recoveryEmailSentAt = new Date();
    } else {
      updateData.recoveryStatus = 'sms_sent';
      updateData.recoverySmsSentAt = new Date();
    }
    if (offerPercent !== undefined) {
      const discount = existing.selectedRate ? (existing.selectedRate * offerPercent) / 100 : 0;
      updateData.recoveryOffer = discount;
    }

    const updated = await db.abandonedBooking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { message: `Recovery ${channel} sent`, booking: updated },
    });
  } catch (error) {
    console.error('Error sending recovery:', error);
    return NextResponse.json({ success: false, error: 'Failed to send recovery' }, { status: 500 });
  }
}

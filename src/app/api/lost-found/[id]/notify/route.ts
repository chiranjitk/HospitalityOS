import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schema ───
const notifySchema = z.object({
  channel: z.enum(['email', 'sms', 'both']).default('email'),
  message: z.string().optional(),
  includeDescription: z.boolean().default(true),
});

// ─── POST: Send notification to guest about found item ───
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'lost-found.notify') && !hasPermission(user, 'lost-found.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = notifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const { channel, message: customMessage, includeDescription } = parsed.data;

    // Fetch the lost & found item with guest details
    const item = await db.lostFoundItem.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true, email: true, phone: true } },
        guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lost & found item not found' } }, { status: 404 });
    }

    if (!item.guest) {
      return NextResponse.json({ success: false, error: { code: 'NO_GUEST', message: 'No guest associated with this item. Match a guest first.' } }, { status: 400 });
    }

    const guest = item.guest;
    const sentVia: string[] = [];
    const errors: string[] = [];

    // Build notification content
    const descriptionText = includeDescription ? `\n\nItem details: ${item.description}` : '';
    const defaultMessage = customMessage || `Dear ${guest.firstName},\n\nWe have found an item that may belong to you at ${item.property.name}.${descriptionText}\n\nPlease contact our front desk to claim your item. You can reach us by replying to this message or calling the hotel directly.\n\nReference ID: ${item.id}\nCategory: ${item.category}${item.locationFound ? `\nLocation found: ${item.locationFound}` : ''}\n\nThank you.`;

    // Send email notification
    if (channel === 'email' || channel === 'both') {
      if (guest.email) {
        try {
          // Create a notification record in the system
          await db.notification.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              type: 'lost_found',
              category: 'info',
              title: `Found item at ${item.property.name}`,
              message: defaultMessage,
              data: JSON.stringify({ itemId: item.id, propertyName: item.property.name, category: item.category, channel: 'email', recipientId: guest.id }),
            },
          });
          sentVia.push('email');
        } catch (err) {
          errors.push(`Email: ${(err as Error).message}`);
        }
      } else {
        errors.push('Email: Guest has no email on file');
      }
    }

    // Send SMS notification
    if (channel === 'sms' || channel === 'both') {
      if (guest.phone) {
        try {
          await db.notification.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              type: 'lost_found',
              category: 'info',
              title: `Found item at ${item.property.name}`,
              message: defaultMessage,
              data: JSON.stringify({ itemId: item.id, propertyName: item.property.name, channel: 'sms', recipientId: guest.id }),
            },
          });
          sentVia.push('sms');
        } catch (err) {
          errors.push(`SMS: ${(err as Error).message}`);
        }
      } else {
        errors.push('SMS: Guest has no phone on file');
      }
    }

    if (sentVia.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOTIFICATION_FAILED', message: 'Could not send any notifications', errors },
      }, { status: 400 });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'lost-found',
        action: 'notify_guest',
        entityType: 'LostFoundItem',
        entityId: item.id,
        newValue: `Notification sent to guest ${guest.firstName} ${guest.lastName} via ${sentVia.join(', ')}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sentVia,
        errors: errors.length > 0 ? errors : undefined,
        guestId: guest.id,
        guestName: `${guest.firstName} ${guest.lastName}`,
        itemId: item.id,
      },
    });
  } catch (error) {
    console.error('[LostFound Notify POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send notification' } }, { status: 500 });
  }
}

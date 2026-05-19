import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { emailService } from '@/lib/services/email-service';

// GET /api/payment-reminders - List outstanding balances
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Find folios with outstanding balances (open or partially_paid with balance > 0)
    const folios = await db.folio.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ['open', 'partially_paid'] },
        balance: { gt: 0 },
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            room: { select: { number: true } },
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { balance: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.folio.count({
      where: {
        tenantId: user.tenantId,
        status: { in: ['open', 'partially_paid'] },
        balance: { gt: 0 },
      },
    });

    const reminders = folios.map((folio) => ({
      folioId: folio.id,
      folioNumber: folio.folioNumber,
      total: folio.totalAmount,
      paid: folio.paidAmount,
      balance: folio.balance,
      currency: folio.currency,
      status: folio.status,
      guest: folio.booking?.primaryGuest
        ? {
            id: folio.booking.primaryGuest.id,
            name: `${folio.booking.primaryGuest.firstName} ${folio.booking.primaryGuest.lastName}`,
            email: folio.booking.primaryGuest.email,
            phone: folio.booking.primaryGuest.phone,
          }
        : null,
      booking: folio.booking
        ? {
            id: folio.booking.id,
            confirmationCode: folio.booking.confirmationCode,
            roomNumber: folio.booking.room?.number,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: reminders,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[PaymentReminders GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment reminders' } },
      { status: 500 }
    );
  }
}

// POST /api/payment-reminders - Send payment reminders
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { folioIds, method = 'email' } = await request.json();

    if (!folioIds || !Array.isArray(folioIds) || folioIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'folioIds array is required' } },
        { status: 400 }
      );
    }

    if (folioIds.length > 50) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum 50 folios per reminder batch' } },
        { status: 400 }
      );
    }

    // Fetch the specified folios with guest info
    const folios = await db.folio.findMany({
      where: {
        id: { in: folioIds },
        tenantId: user.tenantId,
        status: { in: ['open', 'partially_paid'] },
        balance: { gt: 0 },
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    let remindersSent = 0;
    const errors: string[] = [];

    for (const folio of folios) {
      const guest = folio.booking?.primaryGuest;
      if (!guest) {
        errors.push(`Folio ${folio.folioNumber}: No guest found`);
        continue;
      }

      if (method === 'email') {
        if (!guest.email) {
          errors.push(`Folio ${folio.folioNumber}: Guest has no email`);
          continue;
        }
        try {
          await emailService.send({
            to: guest.email,
            subject: `Payment Reminder - Outstanding Balance on ${folio.folioNumber}`,
            variables: {
              name: `${guest.firstName} ${guest.lastName}`,
              folioNumber: folio.folioNumber,
              balance: folio.balance.toFixed(2),
              currency: folio.currency || 'USD',
              confirmationCode: folio.booking?.confirmationCode || 'N/A',
            },
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">Payment Reminder</h2>
                <p>Hello {{name}},</p>
                <p>This is a friendly reminder that you have an outstanding balance on your account.</p>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0;"><strong>Folio:</strong> {{folioNumber}}</p>
                  <p style="margin: 0;"><strong>Booking:</strong> {{confirmationCode}}</p>
                  <p style="margin: 0;"><strong>Outstanding Balance:</strong> {{currency}} {{balance}}</p>
                </div>
                <p>Please settle the balance at your earliest convenience. If you have any questions, please contact our front desk.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
              </div>
            `,
            text: `Hello {{name}},\n\nThis is a friendly reminder that you have an outstanding balance of {{currency}} {{balance}} on folio {{folioNumber}} (Booking: {{confirmationCode}}).\n\nPlease settle the balance at your earliest convenience.\n\nStaySuite Hotel Management System`,
            tags: { type: 'payment_reminder', folioId: folio.id },
          });
          remindersSent++;
        } catch (emailError) {
          console.error(`[PaymentReminders] Failed to send email for folio ${folio.folioNumber}:`, emailError);
          errors.push(`Folio ${folio.folioNumber}: Email send failed`);
        }
      }
      // SMS method would be implemented here when SMS service is available
    }

    // Log the reminder batch to audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'payment_reminders_sent',
          entityType: 'Folio',
          entityId: folios.map(f => f.id).join(','),
          newValue: `Sent ${remindersSent} payment reminder(s) via ${method}. Errors: ${errors.length}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent'),
        },
      });
    } catch {
      // Non-blocking: don't fail if audit log write fails
    }

    return NextResponse.json({
      success: true,
      data: {
        remindersSent,
        totalRequested: folioIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[PaymentReminders POST] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send payment reminders' } },
      { status: 500 }
    );
  }
}

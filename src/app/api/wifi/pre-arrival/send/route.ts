import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// Helper: generate a random password
function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Helper: render template variables
function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// POST /api/wifi/pre-arrival/send — Trigger pre-arrival credential delivery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, propertyId } = body;

    if (!bookingId || !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: bookingId, propertyId' } },
        { status: 400 },
      );
    }

    // 1. Look up the booking and guest
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        primaryGuest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        property: {
          select: { id: true, name: true, city: true, country: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 },
      );
    }

    if (booking.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 },
      );
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot send credentials for cancelled booking' } },
        { status: 400 },
      );
    }

    const guest = booking.primaryGuest;
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Primary guest not found for booking' } },
        { status: 404 },
      );
    }

    // 2. Find the pre-arrival config for the property
    const config = await db.wiFiPreArrivalConfig.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId: TENANT_ID,
          propertyId,
        },
      },
      include: {
        plan: {
          select: { id: true, name: true, validityMinutes: true },
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival WiFi config not found for this property' } },
        { status: 404 },
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Pre-arrival WiFi delivery is disabled for this property' } },
        { status: 400 },
      );
    }

    // 3. Create or find WiFi credentials
    let wifiUser = await db.wiFiUser.findFirst({
      where: {
        bookingId,
        status: 'active',
      },
    });

    const password = wifiUser ? wifiUser.password : generatePassword();

    if (!wifiUser) {
      // Generate username from guest info
      const username = `guest_${guest.firstName.toLowerCase().replace(/[^a-z]/g, '')}_${booking.confirmationCode.toLowerCase()}`;

      // Check uniqueness
      let finalUsername = username;
      let counter = 1;
      while (await db.wiFiUser.findUnique({ where: { username: finalUsername } })) {
        finalUsername = `${username}${counter}`;
        counter++;
      }

      // Determine validity based on plan or booking dates
      const validFrom = new Date();
      const validUntil = new Date(booking.checkOut);
      if (booking.checkOut <= validFrom) {
        validUntil.setDate(validUntil.getDate() + 1);
      }

      const planValidityMinutes = config.plan?.validityMinutes;
      if (planValidityMinutes) {
        validUntil.setTime(validFrom.getTime() + planValidityMinutes * 60 * 1000);
      }

      wifiUser = await db.wiFiUser.create({
        data: {
          tenantId: TENANT_ID,
          propertyId,
          username: finalUsername,
          password,
          guestId: guest.id,
          bookingId,
          userType: 'guest',
          planId: config.planId,
          validFrom,
          validUntil,
          status: 'active',
        },
      });
    }

    // 4. Build template variables
    const templateVars: Record<string, string> = {
      hotel_name: booking.property.name,
      guest_first_name: guest.firstName,
      guest_last_name: guest.lastName,
      username: wifiUser.username,
      password: wifiUser.password,
      ssid: `${booking.property.name.replace(/[^a-zA-Z0-9]/g, '')}_Guest`,
      check_in: new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      check_out: new Date(booking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      plan_name: config.plan?.name || 'Standard',
      confirmation_code: booking.confirmationCode,
    };

    const results: { channel: string; status: string; error?: string; logId?: string }[] = [];

    // 5a. Send email if enabled
    if (config.sendEmail && guest.email) {
      try {
        const emailSubject = `Your WiFi Credentials for ${booking.property.name}`;
        const smsTemplate = config.smsTemplate || 'Your WiFi at {{hotel_name}}: Network: {{ssid}}, Username: {{username}}, Password: {{password}}';
        const emailBody = renderTemplate(smsTemplate, templateVars);
        const fullEmailBody = `Dear ${guest.firstName},\n\n${emailBody}\n\nEnjoy your stay at ${booking.property.name}!\n\nCheck-in: ${templateVars.check_in}\nCheck-out: ${templateVars.check_out}\nConfirmation: ${booking.confirmationCode}`;

        // Create notification log
        const emailLog = await db.notificationLog.create({
          data: {
            tenantId: TENANT_ID,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientEmail: guest.email,
            channel: 'email',
            subject: `[WiFi Pre-Arrival] ${emailSubject}`,
            body: fullEmailBody,
            status: 'sent',
            sentAt: new Date(),
          },
        });

        results.push({ channel: 'email', status: 'sent', logId: emailLog.id });
      } catch (emailError: unknown) {
        const errMsg = emailError instanceof Error ? emailError.message : 'Email delivery failed';
        const emailLog = await db.notificationLog.create({
          data: {
            tenantId: TENANT_ID,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientEmail: guest.email,
            channel: 'email',
            subject: `[WiFi Pre-Arrival] Credentials for ${booking.property.name}`,
            body: `Failed to send WiFi credentials to ${guest.email}`,
            status: 'failed',
            errorMessage: errMsg,
          },
        });
        results.push({ channel: 'email', status: 'failed', error: errMsg, logId: emailLog.id });
      }
    } else if (config.sendEmail && !guest.email) {
      results.push({ channel: 'email', status: 'failed', error: 'Guest email not available' });
    }

    // 5b. Send SMS if enabled
    if (config.sendSms && guest.phone) {
      try {
        const smsTemplate = config.smsTemplate || 'Your WiFi at {{hotel_name}}: Network: {{ssid}}, Username: {{username}}, Password: {{password}}';
        const smsBody = renderTemplate(smsTemplate, templateVars);

        // Create notification log
        const smsLog = await db.notificationLog.create({
          data: {
            tenantId: TENANT_ID,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientPhone: guest.phone,
            channel: 'sms',
            subject: '[WiFi Pre-Arrival] WiFi Credentials',
            body: smsBody,
            status: 'sent',
            sentAt: new Date(),
          },
        });

        results.push({ channel: 'sms', status: 'sent', logId: smsLog.id });
      } catch (smsError: unknown) {
        const errMsg = smsError instanceof Error ? smsError.message : 'SMS delivery failed';
        const smsLog = await db.notificationLog.create({
          data: {
            tenantId: TENANT_ID,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientPhone: guest.phone,
            channel: 'sms',
            subject: '[WiFi Pre-Arrival] WiFi Credentials',
            body: `Failed to send WiFi credentials via SMS`,
            status: 'failed',
            errorMessage: errMsg,
          },
        });
        results.push({ channel: 'sms', status: 'failed', error: errMsg, logId: smsLog.id });
      }
    } else if (config.sendSms && !guest.phone) {
      results.push({ channel: 'sms', status: 'failed', error: 'Guest phone not available' });
    }

    // Mark booking pre-arrival sent
    await db.booking.update({
      where: { id: bookingId },
      data: { preArrivalSent: true },
    });

    const overallSuccess = results.length > 0 && results.some((r) => r.status === 'sent');

    return NextResponse.json({
      success: overallSuccess,
      data: {
        bookingId,
        propertyId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        wifiUsername: wifiUser.username,
        results,
      },
    });
  } catch (error) {
    console.error('[pre-arrival/send] Error triggering delivery:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger pre-arrival delivery' } },
      { status: 500 },
    );
  }
}

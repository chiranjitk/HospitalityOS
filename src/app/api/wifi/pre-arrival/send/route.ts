/**
 * WiFi Pre-Arrival Credential Delivery API
 *
 * POST — Trigger pre-arrival WiFi credential delivery (REAL email/SMS)
 *
 * Flow:
 *   1. Validate booking + guest + pre-arrival config
 *   2. Create or find WiFi credentials
 *   3. Send real email via sendEmailForTenant() (SMTP/nodemailer or mock)
 *   4. Send real SMS via sendSMSForTenant() (Twilio/17 providers or mock)
 *   5. Log delivery results to NotificationLog
 *   6. Mark booking.preArrivalSent = true
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth/tenant-context';
import { sendEmailForTenant } from '@/lib/adapters/email';
import { sendSMSForTenant } from '@/lib/adapters/sms';
import type { EmailOptions } from '@/lib/adapters/email';
import type { SMSOptions } from '@/lib/adapters/sms';

// Helper: generate a random password
function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Helper: render template variables {{var}}
function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// Helper: build HTML email body with WiFi credentials
function buildWifiEmailHtml(vars: Record<string, string>): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #0d9488; padding: 24px; color: white; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .body { padding: 24px; }
    .greeting { font-size: 16px; color: #374151; margin-bottom: 20px; }
    .creds { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .creds-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; margin-bottom: 12px; font-weight: 600; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { font-size: 13px; color: #6b7280; }
    .cred-value { font-size: 14px; font-weight: 600; color: #111827; font-family: 'SF Mono', 'Fira Code', monospace; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #e5e7eb; }
    .info { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
    .info strong { color: #374151; }
    .footer { padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; }
    .footer p { margin: 2px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${vars.hotel_name}</h1>
      <p>Your WiFi Credentials</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${vars.guest_first_name},</p>
      <p class="greeting">Welcome! Here are your WiFi credentials for your upcoming stay:</p>
      <div class="creds">
        <div class="creds-title">WiFi Access Details</div>
        <div class="cred-row">
          <span class="cred-label">Network (SSID)</span>
          <span class="cred-value">${vars.ssid}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Username</span>
          <span class="cred-value">${vars.username}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Password</span>
          <span class="cred-value">${vars.password}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Plan</span>
          <span class="cred-value">${vars.plan_name}</span>
        </div>
      </div>
      <p class="info"><strong>Check-in:</strong> ${vars.check_in}</p>
      <p class="info"><strong>Check-out:</strong> ${vars.check_out}</p>
      <p class="info"><strong>Confirmation:</strong> ${vars.confirmation_code}</p>
    </div>
    <div class="footer">
      <p>This is an automated message from ${vars.hotel_name}.</p>
      <p>Credentials are valid for the duration of your stay.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// POST /api/wifi/pre-arrival/send — Trigger real pre-arrival credential delivery
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

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

    if (!booking || booking.tenantId !== auth.tenantId) {
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
          tenantId: auth.tenantId,
          propertyId,
        },
      },
    });

    if (!config || !config.enabled) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival WiFi delivery is not configured or disabled for this property' } },
        { status: 404 },
      );
    }

    // Get plan info for template variables
    let planName = 'Standard';
    let planValidityMinutes: number | undefined;
    if (config.planId) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: config.planId },
        select: { name: true, validityMinutes: true },
      });
      if (plan) {
        planName = plan.name;
        planValidityMinutes = plan.validityMinutes;
      }
    }

    // 3. Create or find WiFi credentials
    let wifiUser = await db.wiFiUser.findFirst({
      where: { bookingId, status: 'active' },
    });

    const password = wifiUser ? wifiUser.password : generatePassword();

    if (!wifiUser) {
      const username = `guest_${guest.firstName.toLowerCase().replace(/[^a-z]/g, '')}_${booking.confirmationCode.toLowerCase()}`;
      let finalUsername = username;
      let counter = 1;
      while (await db.wiFiUser.findUnique({ where: { username: finalUsername } })) {
        finalUsername = `${username}${counter}`;
        counter++;
      }

      const validFrom = new Date();
      const validUntil = new Date(booking.checkOut);
      if (booking.checkOut <= validFrom) {
        validUntil.setDate(validUntil.getDate() + 1);
      }
      if (planValidityMinutes) {
        validUntil.setTime(validFrom.getTime() + planValidityMinutes * 60 * 1000);
      }

      wifiUser = await db.wiFiUser.create({
        data: {
          tenantId: auth.tenantId,
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
      plan_name: planName,
      confirmation_code: booking.confirmationCode,
    };

    const results: { channel: string; status: string; error?: string; logId?: string; messageId?: string }[] = [];

    // 5a. Send REAL email via adapter (SMTP or mock)
    if (config.sendEmail && guest.email) {
      try {
        const emailOpts: EmailOptions = {
          to: guest.email,
          subject: `Your WiFi Credentials for ${booking.property.name}`,
          html: buildWifiEmailHtml(templateVars),
          text: `Dear ${guest.firstName},\n\nYour WiFi at ${booking.property.name}:\nNetwork: ${templateVars.ssid}\nUsername: ${wifiUser.username}\nPassword: ${wifiUser.password}\nPlan: ${planName}\n\nCheck-in: ${templateVars.check_in}\nCheck-out: ${templateVars.check_out}\nConfirmation: ${booking.confirmationCode}\n\nEnjoy your stay!`,
        };

        const emailResult = await sendEmailForTenant(auth.tenantId, emailOpts);

        const status = emailResult.success ? 'sent' : 'failed';
        const log = await db.notificationLog.create({
          data: {
            tenantId: auth.tenantId,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientEmail: guest.email,
            channel: 'email',
            subject: emailOpts.subject,
            body: emailOpts.text || emailOpts.html || '',
            status,
            sentAt: emailResult.success ? new Date() : null,
            errorMessage: emailResult.error,
            externalId: emailResult.messageId,
          },
        });

        results.push({
          channel: 'email',
          status,
          logId: log.id,
          messageId: emailResult.messageId,
          error: emailResult.error,
        });
        console.log(`[PreArrival] Email ${status}: ${guest.email} → ${emailResult.messageId || 'no-id'} ${emailResult.error ? `(${emailResult.error})` : ''}`);
      } catch (emailError: unknown) {
        const errMsg = emailError instanceof Error ? emailError.message : 'Email delivery failed';
        const log = await db.notificationLog.create({
          data: {
            tenantId: auth.tenantId,
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
        results.push({ channel: 'email', status: 'failed', error: errMsg, logId: log.id });
        console.error(`[PreArrival] Email failed: ${guest.email} — ${errMsg}`);
      }
    } else if (config.sendEmail && !guest.email) {
      results.push({ channel: 'email', status: 'skipped', error: 'Guest email not available' });
    }

    // 5b. Send REAL SMS via adapter (Twilio/17 providers or mock)
    if (config.sendSms && guest.phone) {
      try {
        const smsTemplate = config.smsTemplate || 'Your WiFi at {{hotel_name}}: Network: {{ssid}}, Username: {{username}}, Password: {{password}}';
        const smsBody = renderTemplate(smsTemplate, templateVars);

        const smsOpts: SMSOptions = {
          to: guest.phone,
          message: smsBody,
        };

        const smsResult = await sendSMSForTenant(auth.tenantId, smsOpts);

        const status = smsResult.success ? 'sent' : 'failed';
        const log = await db.notificationLog.create({
          data: {
            tenantId: auth.tenantId,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientPhone: guest.phone,
            channel: 'sms',
            subject: '[WiFi Pre-Arrival] WiFi Credentials',
            body: smsBody,
            status,
            sentAt: smsResult.success ? new Date() : null,
            errorMessage: smsResult.error,
            externalId: smsResult.messageId,
          },
        });

        results.push({
          channel: 'sms',
          status,
          logId: log.id,
          messageId: smsResult.messageId,
          error: smsResult.error,
        });
        console.log(`[PreArrival] SMS ${status}: ${guest.phone} → ${smsResult.messageId || 'no-id'} ${smsResult.error ? `(${smsResult.error})` : ''}`);
      } catch (smsError: unknown) {
        const errMsg = smsError instanceof Error ? smsError.message : 'SMS delivery failed';
        const log = await db.notificationLog.create({
          data: {
            tenantId: auth.tenantId,
            recipientType: 'guest',
            recipientId: guest.id,
            recipientPhone: guest.phone,
            channel: 'sms',
            subject: '[WiFi Pre-Arrival] WiFi Credentials',
            body: `Failed to send WiFi credentials via SMS to ${guest.phone}`,
            status: 'failed',
            errorMessage: errMsg,
          },
        });
        results.push({ channel: 'sms', status: 'failed', error: errMsg, logId: log.id });
        console.error(`[PreArrival] SMS failed: ${guest.phone} — ${errMsg}`);
      }
    } else if (config.sendSms && !guest.phone) {
      results.push({ channel: 'sms', status: 'skipped', error: 'Guest phone not available' });
    }

    // 6. Mark booking pre-arrival sent (even if partial failure — at least we attempted)
    await db.booking.update({
      where: { id: bookingId },
      data: { preArrivalSent: true },
    });

    const delivered = results.filter((r) => r.status === 'sent').length;
    const overallSuccess = delivered > 0;

    return NextResponse.json({
      success: overallSuccess,
      data: {
        bookingId,
        propertyId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        wifiUsername: wifiUser.username,
        delivered,
        total: results.length,
        results,
      },
      message: overallSuccess
        ? `Credentials delivered via ${results.filter((r) => r.status === 'sent').map((r) => r.channel).join(' + ')}`
        : 'All delivery attempts failed — check notification logs for details',
    });
  } catch (error) {
    console.error('[pre-arrival/send] Error triggering delivery:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger pre-arrival delivery' } },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { emailService, TemplatedEmailOptions } from '@/lib/services/email-service';
import { smsService, TemplatedSMSOptions } from '@/lib/services/sms-service';
import { randomBytes } from 'crypto';

// POST /api/guests/nps/[surveyId]/send - Send NPS survey to guests via email, SMS, and in-app
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for sending surveys
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { surveyId } = await params;
    const body = await request.json();
    const { daysSinceCheckout = 7, guestIds, channels = ['email', 'sms', 'in_app'] } = body;

    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId, isActive: true },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found or inactive' } }, { status: 404 });
    }

    // Get property info for personalizing emails
    const property = await db.property.findUnique({
      where: { id: survey.propertyId },
      select: { name: true, address: true, city: true, country: true, phone: true, email: true },
    });

    // Find guests who checked out in the last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceCheckout);

    const whereClause: Record<string, unknown> = {
      booking: {
        tenantId: user.tenantId,
        propertyId: survey.propertyId,
        status: 'checked_out',
        actualCheckOut: { gte: cutoffDate },
      },
      guest: { deletedAt: null },
    };

    // Exclude guests who already responded to this survey
    const existingRespondents = await db.npsResponse.findMany({
      where: { surveyId, tenantId: user.tenantId },
      select: { guestId: true },
    });
    const respondedGuestIds = new Set(existingRespondents.map(r => r.guestId));

    // Also exclude guests who already have a delivery record (prevent re-sending)
    const existingDeliveries = await db.npsSurveyDelivery.findMany({
      where: { surveyId, tenantId: user.tenantId },
      select: { guestId: true },
    });
    const deliveredGuestIds = new Set(existingDeliveries.map(d => d.guestId));

    let targetGuestStays = await db.guestStay.findMany({
      where: whereClause,
      select: {
        guestId: true,
        bookingId: true,
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
      distinct: ['guestId'],
    });

    // Filter out already-responded and already-delivered guests
    targetGuestStays = targetGuestStays.filter(
      gs => !respondedGuestIds.has(gs.guestId) && !deliveredGuestIds.has(gs.guestId)
    );

    // Filter by specific guest IDs if provided
    if (guestIds && Array.isArray(guestIds) && guestIds.length > 0) {
      targetGuestStays = targetGuestStays.filter(gs => guestIds.includes(gs.guestId));
    }

    const guestName = (g: { firstName: string; lastName: string }) =>
      `${g.firstName} ${g.lastName}`.trim();

    // Delivery counters
    let emailSentCount = 0;
    let smsSentCount = 0;
    let inAppCount = 0;
    const deliveryResults: Array<{
      guestId: string;
      email: { success: boolean; error?: string } | null;
      sms: { success: boolean; error?: string } | null;
    }> = [];

    for (const guestStay of targetGuestStays) {
      const guest = guestStay.guest;
      const fullName = guestName(guest);
      const token = randomBytes(24).toString('hex'); // 48-char secure token

      // Determine which channels to use for this guest
      const guestChannels: string[] = [];
      if (channels.includes('email') && guest.email) guestChannels.push('email');
      if (channels.includes('sms') && guest.phone) guestChannels.push('sms');
      if (channels.includes('in_app')) guestChannels.push('in_app');

      // Ensure at least one channel is used
      if (guestChannels.length === 0) {
        if (guest.email) guestChannels.push('email');
        else if (guest.phone) guestChannels.push('sms');
        else guestChannels.push('in_app');
      }

      const result: typeof deliveryResults[number] = {
        guestId: guestStay.guestId,
        email: null,
        sms: null,
      };

      // --- EMAIL delivery ---
      if (guestChannels.includes('email') && guest.email) {
        try {
          const surveyLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/survey/nps/${surveyId}?token=${token}`;
          const html = generateNpsSurveyEmailHtml({
            guestName: fullName,
            propertyName: property?.name || 'Our Hotel',
            surveySubject: survey.subject || 'We value your feedback',
            surveyMessage: survey.message || 'Please take a moment to rate your stay with us.',
            surveyLink,
            minScore: survey.minScore,
            maxScore: survey.maxScore,
            customQuestion: survey.customQuestion,
          });

          const emailOptions: TemplatedEmailOptions = {
            to: guest.email,
            subject: survey.subject || 'How was your stay? We\'d love your feedback',
            html,
            text: generateNpsSurveyEmailText({
              guestName: fullName,
              propertyName: property?.name || 'Our Hotel',
              surveySubject: survey.subject || 'We value your feedback',
              surveyMessage: survey.message || '',
              surveyLink,
            }),
            tenantId: user.tenantId,
            recipientId: guest.id,
            tags: { type: 'nps_survey', surveyId, guestId: guest.id },
          };

          const emailResult = await emailService.send(emailOptions);

          if (emailResult.success) {
            emailSentCount++;
            result.email = { success: true };
          } else {
            result.email = { success: false, error: emailResult.error };
            console.error(`[NPS Send] Email failed for guest ${guest.id}: ${emailResult.error}`);
          }
        } catch (err) {
          result.email = { success: false, error: err instanceof Error ? err.message : 'Unknown email error' };
          console.error(`[NPS Send] Email error for guest ${guest.id}:`, err);
        }
      }

      // --- SMS delivery ---
      if (guestChannels.includes('sms') && guest.phone) {
        try {
          const surveyLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/survey/nps/${surveyId}?token=${token}`;
          const smsMessage = `Hi ${guest.firstName}, thanks for staying at ${property?.name || 'our hotel'}! How was your experience? Rate us: ${surveyLink}`;

          const smsOptions: TemplatedSMSOptions = {
            to: guest.phone,
            message: smsMessage,
            tenantId: user.tenantId,
            recipientId: guest.id,
          };

          const smsResult = await smsService.send(smsOptions);

          if (smsResult.success) {
            smsSentCount++;
            result.sms = { success: true };
          } else {
            result.sms = { success: false, error: smsResult.error };
            console.error(`[NPS Send] SMS failed for guest ${guest.id}: ${smsResult.error}`);
          }
        } catch (err) {
          result.sms = { success: false, error: err instanceof Error ? err.message : 'Unknown SMS error' };
          console.error(`[NPS Send] SMS error for guest ${guest.id}:`, err);
        }
      }

      // --- IN-APP notification (always created as fallback) ---
      try {
        await db.notification.create({
          data: {
            tenantId: user.tenantId,
            userId: guest.id,
            type: 'survey',
            category: 'info',
            title: survey.subject || 'We value your feedback',
            message: survey.message || `Please take a moment to rate your stay with us (0-10).`,
            data: JSON.stringify({ surveyId, bookingId: guestStay.bookingId, token }),
            link: `/survey/nps/${surveyId}?token=${token}`,
            priority: 'normal',
          },
        });
        inAppCount++;
      } catch (err) {
        console.error(`[NPS Send] In-app notification failed for guest ${guest.id}:`, err);
      }

      // Determine primary delivery channel and overall status
      const primaryChannel = guestChannels[0];
      const emailOk = result.email?.success ?? false;
      const smsOk = result.sms?.success ?? false;
      const anyDeliveryOk = emailOk || smsOk;

      // Create delivery tracking record
      await db.npsSurveyDelivery.create({
        data: {
          surveyId,
          tenantId: user.tenantId,
          guestId: guestStay.guestId,
          bookingId: guestStay.bookingId,
          channel: primaryChannel,
          token,
          status: anyDeliveryOk ? 'sent' : 'pending',
          sentAt: anyDeliveryOk ? new Date() : null,
          deliveredAt: anyDeliveryOk ? new Date() : null,
        },
      }).catch(err => {
        console.error(`[NPS Send] Failed to create delivery record for guest ${guest.id}:`, err);
      });

      deliveryResults.push(result);
    }

    // Update survey sent count
    await db.npsSurvey.update({
      where: { id: surveyId },
      data: { sentCount: { increment: inAppCount } },
    });

    const deliveryErrors: string[] = [];
    for (const dr of deliveryResults) {
      if (dr.email && !dr.email.success) deliveryErrors.push(`Email: ${dr.email.error}`);
      if (dr.sms && !dr.sms.success) deliveryErrors.push(`SMS: ${dr.sms.error}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalEligible: targetGuestStays.length,
        emailSent: emailSentCount,
        smsSent: smsSentCount,
        inAppCreated: inAppCount,
        channels: {
          email: channels.includes('email'),
          sms: channels.includes('sms'),
          in_app: channels.includes('in_app'),
        },
        errors: deliveryErrors.length > 0 ? deliveryErrors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error('Error sending NPS survey:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send NPS survey' } }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Email HTML template for NPS surveys
// ---------------------------------------------------------------------------
function generateNpsSurveyEmailHtml(params: {
  guestName: string;
  propertyName: string;
  surveySubject: string;
  surveyMessage: string;
  surveyLink: string;
  minScore: number;
  maxScore: number;
  customQuestion?: string | null;
}): string {
  const { guestName, propertyName, surveySubject, surveyMessage, surveyLink, minScore, maxScore, customQuestion } = params;

  // Build score buttons (0-10)
  const scoreButtons: string[] = [];
  for (let i = minScore; i <= maxScore; i++) {
    const bg = i <= 6 ? '#ef4444' : i <= 8 ? '#f59e0b' : '#10b981';
    scoreButtons.push(
      `<a href="${surveyLink}&score=${i}" style="display:inline-block; width:44px; height:44px; line-height:44px; text-align:center; border-radius:50%; background:${bg}; color:#fff; font-weight:700; font-size:16px; text-decoration:none; margin:3px;">${i}</a>`
    );
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${surveySubject}</title>
</head>
<body style="margin:0; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f5f5; color:#333; line-height:1.6;">
  <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0d9488,#065f46); padding:28px 24px; text-align:center;">
      <h1 style="margin:0; color:#fff; font-size:22px; font-weight:700;">${surveySubject}</h1>
      <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">${propertyName}</p>
    </div>
    <div style="padding:28px 24px;">
      <p style="margin:0 0 16px; font-size:16px;">Dear ${guestName},</p>
      <p style="margin:0 0 20px; font-size:15px; color:#4b5563;">${surveyMessage}</p>
      ${customQuestion ? `<p style="margin:0 0 16px; font-size:14px; color:#6b7280; font-style:italic;">${customQuestion}</p>` : ''}

      <div style="text-align:center; margin:24px 0;">
        <p style="margin:0 0 12px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">How likely are you to recommend us?</p>
        <div style="margin:16px 0;">
          ${scoreButtons.join('\n          ')}
        </div>
        <p style="margin:12px 0 0; font-size:11px; color:#9ca3af;">
          0 = Not likely &nbsp;&bull;&nbsp; 10 = Very likely
        </p>
      </div>

      <div style="text-align:center; margin:24px 0 8px;">
        <a href="${surveyLink}" style="display:inline-block; padding:14px 36px; background:#0d9488; color:#fff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">Take the Survey</a>
      </div>
      <p style="text-align:center; margin:8px 0 0; font-size:12px; color:#9ca3af;">
        Or copy this link: <a href="${surveyLink}" style="color:#0d9488;">${surveyLink}</a>
      </p>
    </div>
    <div style="background:#f9fafb; padding:16px 24px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb;">
      <p style="margin:0;">Thank you for choosing ${propertyName}.</p>
      <p style="margin:4px 0 0;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain-text fallback for NPS survey emails
// ---------------------------------------------------------------------------
function generateNpsSurveyEmailText(params: {
  guestName: string;
  propertyName: string;
  surveySubject: string;
  surveyMessage: string;
  surveyLink: string;
}): string {
  const { guestName, propertyName, surveySubject, surveyMessage, surveyLink } = params;
  return [
    `Dear ${guestName},`,
    '',
    surveySubject,
    '',
    surveyMessage,
    '',
    `How likely are you to recommend ${propertyName} to a friend or colleague?`,
    '(0 = Not likely, 10 = Very likely)',
    '',
    `Take the survey: ${surveyLink}`,
    '',
    `Thank you for choosing ${propertyName}.`,
    'This is an automated message. Please do not reply directly to this email.',
  ].join('\n');
}

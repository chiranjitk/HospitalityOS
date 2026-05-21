/**
 * Message Dispatcher Service
 *
 * Dispatches outgoing messages to external channels (WhatsApp, SMS, Email, In-App)
 * based on the conversation's channel type. Uses the existing notification infrastructure
 * for email delivery and logs pending dispatches for channels not yet fully integrated.
 */

import { db } from '@/lib/db';
import { notificationService } from '@/lib/services/notification-service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DispatchResult {
  success: boolean;
  status: 'sent' | 'pending_delivery' | 'delivered' | 'failed';
  channel: string;
  externalMessageId?: string;
  error?: string;
}

export interface DispatchPayload {
  conversationId: string;
  messageId: string;
  channel: string; // whatsapp, sms, email, in_app
  tenantId: string;
  guestId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  content: string;
  messageType: string;
  propertyId: string;
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

/**
 * Dispatch an outgoing message to the appropriate external channel.
 * Returns a DispatchResult so the caller can update the message status accordingly.
 */
export async function dispatchMessage(payload: DispatchPayload): Promise<DispatchResult> {
  const { channel } = payload;

  try {
    switch (channel) {
      case 'email':
        return await dispatchEmail(payload);
      case 'sms':
        return await dispatchSMS(payload);
      case 'whatsapp':
        return await dispatchWhatsApp(payload);
      case 'in_app':
        return await dispatchInApp(payload);
      default:
        // Unknown channel — treat as in_app (always deliverable)
        console.warn(`[Dispatcher] Unknown channel "${channel}" for conversation ${payload.conversationId}, treating as in_app`);
        return await dispatchInApp(payload);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown dispatch error';
    console.error(`[Dispatcher] Failed to dispatch message on channel "${channel}":`, errorMessage);
    return { success: false, status: 'failed', channel, error: errorMessage };
  }
}

// ─── Channel Handlers ────────────────────────────────────────────────────────

async function dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
  const recipientEmail = payload.recipientEmail;
  if (!recipientEmail) {
    // Try to look up guest email
    if (payload.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: payload.guestId },
        select: { email: true },
      });
      if (!guest?.email) {
        return { success: false, status: 'failed', channel: 'email', error: 'No recipient email address available' };
      }
      payload.recipientEmail = guest.email;
    } else {
      return { success: false, status: 'failed', channel: 'email', error: 'No recipient email address available' };
    }
  }

  try {
    const result = await notificationService.send({
      tenantId: payload.tenantId,
      guestId: payload.guestId || undefined,
      type: 'communication',
      category: 'info',
      title: 'New message from our team',
      message: payload.content,
      channels: ['email'],
    });

    const emailResult = result.channels.email;
    if (emailResult?.success) {
      return { success: true, status: 'sent', channel: 'email', externalMessageId: emailResult.messageId };
    }
    return {
      success: false,
      status: 'failed',
      channel: 'email',
      error: emailResult?.error || result.errors?.join(', ') || 'Email delivery failed',
    };
  } catch (error) {
    return {
      success: false,
      status: 'pending_delivery',
      channel: 'email',
      error: error instanceof Error ? error.message : 'Email dispatch failed',
    };
  }
}

async function dispatchSMS(payload: DispatchPayload): Promise<DispatchResult> {
  const recipientPhone = payload.recipientPhone;
  if (!recipientPhone) {
    // Try to look up guest phone
    if (payload.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: payload.guestId },
        select: { phone: true },
      });
      if (!guest?.phone) {
        return { success: false, status: 'failed', channel: 'sms', error: 'No recipient phone number available' };
      }
      payload.recipientPhone = guest.phone;
    } else {
      return { success: false, status: 'failed', channel: 'sms', error: 'No recipient phone number available' };
    }
  }

  try {
    const result = await notificationService.send({
      tenantId: payload.tenantId,
      guestId: payload.guestId || undefined,
      type: 'communication',
      category: 'info',
      title: '',
      message: payload.content,
      channels: ['sms'],
    });

    const smsResult = result.channels.sms;
    if (smsResult?.success) {
      return { success: true, status: 'sent', channel: 'sms', externalMessageId: smsResult.messageId };
    }
    // SMS gateway not configured — log as pending
    return {
      success: false,
      status: 'pending_delivery',
      channel: 'sms',
      error: smsResult?.error || 'SMS dispatch pending — gateway not yet configured',
    };
  } catch (error) {
    return {
      success: false,
      status: 'pending_delivery',
      channel: 'sms',
      error: error instanceof Error ? error.message : 'SMS dispatch failed',
    };
  }
}

async function dispatchWhatsApp(payload: DispatchPayload): Promise<DispatchResult> {
  const recipientPhone = payload.recipientPhone;
  if (!recipientPhone) {
    // Try to look up guest phone
    if (payload.guestId) {
      const guest = await db.guest.findUnique({
        where: { id: payload.guestId },
        select: { phone: true },
      });
      if (!guest?.phone) {
        return { success: false, status: 'failed', channel: 'whatsapp', error: 'No recipient phone number available' };
      }
      payload.recipientPhone = guest.phone;
    } else {
      return { success: false, status: 'failed', channel: 'whatsapp', error: 'No recipient phone number available' };
    }
  }

  // WhatsApp Business API integration is not yet connected.
  // Log the dispatch intent so it can be retried when the channel is configured.
  try {
    await db.notificationLog.create({
      data: {
        tenantId: payload.tenantId,
        recipientType: 'guest',
        recipientId: payload.guestId || '',
        recipientPhone: payload.recipientPhone,
        channel: 'whatsapp',
        subject: 'Outbound WhatsApp message',
        body: payload.content.substring(0, 1000),
        status: 'pending',
        errorMessage: 'WhatsApp Business API not yet configured',
      },
    });
  } catch {
    // Ignore logging errors — non-critical
  }

  return {
    success: false,
    status: 'pending_delivery',
    channel: 'whatsapp',
    error: 'WhatsApp Business API not yet configured',
  };
}

async function dispatchInApp(_payload: DispatchPayload): Promise<DispatchResult> {
  // In-app messages are already stored in ChatMessage table and pushed via realtime.
  // No external dispatch needed — mark as delivered immediately.
  return { success: true, status: 'delivered', channel: 'in_app' };
}

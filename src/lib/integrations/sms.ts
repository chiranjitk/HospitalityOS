/**
 * SMS Gateway Integration — DEPRECATED
 *
 * This module has been consolidated into `@/lib/adapters/sms`.
 * All SMS providers (Twilio, Vonage, MessageBird, AWS SNS, Custom, Mock)
 * are now handled by the unified adapter layer.
 *
 * This file re-exports types and functions for backward compatibility.
 * New code should import directly from `@/lib/adapters/sms`.
 *
 * @deprecated Use `@/lib/adapters/sms` instead.
 */

// Re-export all types from the unified adapter
export type {
  SMSOptions,
  SMSResult,
  SMSAdapter,
  SMSProviderType,
  SMSCredentials,
} from '@/lib/adapters/sms';

export { normalizePhoneNumber } from '@/lib/adapters/sms';

// ──────────────────────────────────────────────────────────────────
// Backward-compatible types (legacy names)
// ──────────────────────────────────────────────────────────────────

/** @deprecated Use SMSOptions from @/lib/adapters/sms */
export interface SMSConfig {
  provider: 'twilio' | 'vonage' | 'messagebird' | 'custom';
  accountSid: string;
  authToken: string;
  fromNumber: string;
  webhookSecret?: string;
  baseUrl?: string;
}

/** @deprecated Use SMSOptions from @/lib/adapters/sms */
export interface SMSMessage {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  statusCallback?: string;
  validityPeriod?: number;
  scheduledAt?: Date;
}

/** @deprecated Use SMSResult from @/lib/adapters/sms */
export type SMSMessageResult = {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  errorCode?: string;
  cost?: number;
  provider?: string;
};

export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  segments?: number;
  cost?: number;
}

export interface SMSWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus?: string;
  ApiVersion?: string;
  SmsSid?: string;
  SmsMessageSid?: string;
  MessageStatus?: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  ErrorCode?: string;
  ErrorMessage?: string;
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToZip?: string;
  ToCountry?: string;
}

export interface SMSBalanceInfo {
  currency: string;
  balance: number;
  usage: number;
}

// ──────────────────────────────────────────────────────────────────
// Backward-compatible SMSClient class
// ──────────────────────────────────────────────────────────────────

import { createHmac } from 'crypto';
import { sendSMSForTenant as sendSMSForTenantUnified } from '@/lib/adapters/sms';
import { getSMSProviderConfig, getTwilioConfig } from '@/lib/service-config';

/**
 * @deprecated Use functions from @/lib/adapters/sms directly.
 * This class is kept for backward compatibility.
 */
export class SMSClient {
  private provider: SMSConfig['provider'];
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private webhookSecret?: string;
  private baseUrl?: string;

  constructor(config: SMSConfig) {
    this.provider = config.provider;
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.baseUrl;
  }

  async sendMessage(message: SMSMessage): Promise<SMSMessageResult> {
    // Delegate to unified adapter via env override
    // For direct usage without tenant, we construct a one-off call
    const { getSMS } = await import('@/lib/adapters/sms');
    try {
      const sms = await getSMS();
      return await sms.send({
        to: message.to,
        message: message.body,
        from: message.from || this.fromNumber,
        mediaUrls: message.mediaUrls,
        statusCallback: message.statusCallback,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      };
    }
  }

  async getMessageStatus(_messageId: string): Promise<SMSDeliveryStatus | null> {
    console.warn('[SMS] getMessageStatus is deprecated — use provider-specific APIs');
    return null;
  }

  async getBalance(): Promise<SMSBalanceInfo | null> {
    console.warn('[SMS] getBalance is deprecated — use provider-specific APIs');
    return null;
  }

  verifyWebhookSignature(signature: string, url: string, params: Record<string, string>): boolean {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');
    const data = `${url}${sortedParams}`;
    const expectedSignature = createHmac('sha1', this.webhookSecret)
      .update(data)
      .digest('base64');

    return signature === expectedSignature;
  }
}

// ──────────────────────────────────────────────────────────────────
// Backward-compatible factory functions
// ──────────────────────────────────────────────────────────────────

/** @deprecated Use getSMS() from @/lib/adapters/sms */
export function createSMSClient(): SMSClient | null {
  const provider = (process.env.SMS_PROVIDER || 'twilio') as SMSConfig['provider'];
  const accountSid = process.env.SMS_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.SMS_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.SMS_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS/Integration] Credentials not configured — deprecated module');
    return null;
  }

  return new SMSClient({
    provider,
    accountSid,
    authToken,
    fromNumber,
    webhookSecret: process.env.SMS_WEBHOOK_SECRET,
  });
}

// Singleton
let smsClientInstance: SMSClient | null = null;

/** @deprecated Use getSMS() from @/lib/adapters/sms */
export function getSMSClient(): SMSClient | null {
  if (!smsClientInstance) {
    smsClientInstance = createSMSClient();
  }
  return smsClientInstance;
}

/** @deprecated Use createSMSClientForTenant() or sendSMSForTenant() from @/lib/adapters/sms */
export async function createSMSClientForTenant(tenantId: string): Promise<SMSClient | null> {
  const creds = await getSMSProviderConfig(tenantId);
  if (creds) {
    return new SMSClient({
      provider: creds.provider as SMSConfig['provider'],
      accountSid: creds.accountSid || '',
      authToken: creds.authToken || '',
      fromNumber: creds.phoneNumber || '',
    });
  }

  const twilioCreds = await getTwilioConfig(tenantId);
  if (twilioCreds.accountSid) {
    return new SMSClient({
      provider: 'twilio',
      accountSid: twilioCreds.accountSid,
      authToken: twilioCreds.authToken,
      fromNumber: twilioCreds.phoneNumber,
    });
  }

  return createSMSClient();
}

/** @deprecated Use sendSMSForTenant() from @/lib/adapters/sms */
export async function sendSMSForTenant(
  tenantId: string,
  to: string,
  body: string,
  options?: Partial<SMSMessage>,
): Promise<SMSMessageResult> {
  return sendSMSForTenantUnified(tenantId, {
    to,
    message: body,
    from: options?.from,
    mediaUrls: options?.mediaUrls,
    statusCallback: options?.statusCallback,
  });
}

/** @deprecated Use sendSMS() from @/lib/adapters/sms */
export async function sendSMS(
  to: string,
  body: string,
  options?: Partial<SMSMessage>,
): Promise<SMSMessageResult> {
  const { getSMS } = await import('@/lib/adapters/sms');
  try {
    const sms = await getSMS();
    return await sms.send({
      to,
      message: body,
      ...options,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
}

/**
 * Parse incoming SMS webhook payload (Twilio format)
 * @deprecated — kept for webhook routes that still use it
 */
export function parseSMSWebhook(payload: SMSWebhookPayload): {
  type: 'inbound' | 'status';
  data: {
    messageId: string;
    from: string;
    to: string;
    body?: string;
    status?: SMSDeliveryStatus['status'];
    media?: { url: string; type: string }[];
    errorCode?: string;
    errorMessage?: string;
    location?: { city?: string; state?: string; country?: string };
  };
} {
  const hasInboundContent = payload.Body || payload.MediaUrl0;

  if (hasInboundContent) {
    const media: { url: string; type: string }[] = [];
    let i = 0;
    while (payload[`MediaUrl${i}` as keyof SMSWebhookPayload]) {
      media.push({
        url: payload[`MediaUrl${i}` as keyof SMSWebhookPayload] as string,
        type: payload[`MediaContentType${i}` as keyof SMSWebhookPayload] as string,
      });
      i++;
    }

    return {
      type: 'inbound',
      data: {
        messageId: payload.MessageSid || payload.SmsSid || '',
        from: payload.From,
        to: payload.To,
        body: payload.Body,
        media: media.length > 0 ? media : undefined,
        location: {
          city: payload.FromCity,
          state: payload.FromState,
          country: payload.FromCountry,
        },
      },
    };
  } else {
    return {
      type: 'status',
      data: {
        messageId: payload.MessageSid || '',
        from: payload.From,
        to: payload.To,
        status: payload.MessageStatus,
        errorCode: payload.ErrorCode,
        errorMessage: payload.ErrorMessage,
      },
    };
  }
}

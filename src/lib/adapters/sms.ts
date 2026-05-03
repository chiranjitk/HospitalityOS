/**
 * StaySuite Unified SMS Gateway
 *
 * Single adapter layer supporting multiple SMS providers:
 *   - Twilio (SDK + HTTP)
 *   - Vonage / Nexmo
 *   - MessageBird
 *   - AWS SNS
 *   - MSG91 (India-focused, DLT compliant)
 *   - Gupshup (India, WhatsApp + SMS)
 *   - Textlocal (India / Global)
 *   - Kaleyra (India, CPaaS)
 *   - Exotel (India, Cloud Telephony)
 *   - Fast2SMS (India, Budget SMS)
 *   - Plivo (India/Global, CPaaS)
 *   - Route Mobile (India, Enterprise A2P)
 *   - ValueFirst (India, Enterprise)
 *   - MSGCLUB (India, Bulk SMS)
 *   - Airtel IQ (India, Telecom API)
 *   - BulkSMS India (India, Bulk Messaging)
 *   - Custom HTTP (any REST API)
 *   - Mock (dev / test)
 *
 * Architecture:
 *   adapters/sms.ts  →  Low-level per-provider send (this file)
 *   services/sms-service.ts →  Templates, queue, delivery tracking
 *   notification-service.ts →  Multi-channel orchestration
 *
 * Config priority (per tenant):
 *   1. DB Integration record (type: sms_twilio / sms_vonage / etc.)
 *   2. Environment variables (SMS_PROVIDER, SMS_ACCOUNT_SID, …)
 *   3. Fallback to mock ONLY in sandbox / development
 */

import { getConfig } from '../config/env';
import { getTwilioConfig, getSMSProviderConfig } from '../service-config';

// ──────────────────────────────────────────────────────────────────
// Public Types
// ──────────────────────────────────────────────────────────────────

export type SMSProviderType =
  | 'twilio'
  | 'vonage'
  | 'messagebird'
  | 'aws_sns'
  | 'msg91'
  | 'gupshup'
  | 'textlocal'
  | 'kaleyra'
  | 'exotel'
  | 'fast2sms'
  | 'plivo'
  | 'route_mobile'
  | 'valuefirst'
  | 'msgclub'
  | 'airtel_iq'
  | 'bulk_sms'
  | 'custom'
  | 'mock';

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
  mediaUrls?: string[];
  statusCallback?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: SMSProviderType;
  status?: string;
  cost?: number;
}

/** Credential config that comes from DB or env */
export interface SMSCredentials {
  provider: SMSProviderType;
  accountSid?: string;      // Twilio SID / Vonage API key / MessageBird AccessKey ID
  authToken?: string;       // Twilio token / Vonage secret / MessageBird master key / AWS secret
  phoneNumber?: string;     // Sender number / Vonage sender name / AWS origination number
  region?: string;          // AWS region (default us-east-1)
  baseUrl?: string;         // Custom provider endpoint
  webhookSecret?: string;   // For webhook verification
  defaultCountryCode?: string; // e.g. '91', '1', '44'
}

// ──────────────────────────────────────────────────────────────────
// Phone Number Normalization
// ──────────────────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format.
 * - Strips all non-digit characters (except leading +)
 * - If only 10 digits → prepends defaultCountryCode
 * - If no + and 11-15 digits → prepends +
 * - Already E.164 → returned as-is
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode?: string): string {
  let digits = phone.replace(/[^\d+]/g, '');

  // Already E.164
  if (/^\+\d{10,15}$/.test(digits)) return digits;

  // Strip leading + for digit-only processing
  if (digits.startsWith('+')) digits = digits.slice(1);

  // 10 digits → local number, prepend country code
  if (digits.length === 10 && defaultCountryCode) {
    return `+${defaultCountryCode}${digits}`;
  }

  // 10 digits without country code → can't normalize, return with + prefix
  if (digits.length === 10) return `+${digits}`;

  // 11-15 digits → assume includes country code
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  // Fallback — return as-is with + prefix if missing
  return digits.startsWith('+') ? digits : `+${digits}`;
}

// ──────────────────────────────────────────────────────────────────
// Provider Adapters
// ──────────────────────────────────────────────────────────────────

// ---- Mock Adapter ----
class MockSMSAdapter {
  private logs: string[] = [];

  async send(options: SMSOptions, _creds?: SMSCredentials): Promise<SMSResult> {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      to: options.to,
      from: options.from || '+1234567890',
      message: options.message,
      mediaUrls: options.mediaUrls,
    });
    this.logs.push(entry);

    console.log('\n[SMS Mock] ====================');
    console.log(`  To: ${options.to}`);
    console.log(`  From: ${options.from || '+1234567890'}`);
    console.log(`  Message: ${options.message}`);
    console.log('[SMS Mock] ====================\n');

    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider: 'mock',
      status: 'delivered',
    };
  }

  async sendBatch(messages: SMSOptions[], creds?: SMSCredentials): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m, creds)));
  }

  getLogs(): string[] { return [...this.logs]; }
  clearLogs(): void { this.logs = []; }
  async getBalance(): Promise<number> { return 999; }
}

// ---- Twilio Adapter (uses official SDK) ----
class TwilioSMSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  private async getClient() {
    const twilio = await import('twilio');
    return twilio.default(this.config.accountSid!, this.config.authToken!);
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const client = await this.getClient();
      const from = options.from || this.config.phoneNumber;

      const payload: Record<string, unknown> = {
        body: options.message,
        from,
        to: options.to,
      };
      if (options.mediaUrls?.length) payload.mediaUrl = options.mediaUrls;
      if (options.statusCallback) payload.statusCallback = options.statusCallback;

      const msg = await client.messages.create(
        payload as Parameters<typeof client.messages.create>[0],
      );

      return {
        success: msg.status !== 'failed' && msg.status !== 'undelivered',
        messageId: msg.sid,
        provider: 'twilio',
        status: msg.status,
        cost: parseFloat((msg as Record<string, unknown>).price as string || '0'),
      };
    } catch (error) {
      console.error('[SMS/Twilio] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twilio send failed',
        provider: 'twilio',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const client = await this.getClient();
      const account = await client.api.accounts(this.config.accountSid!).fetch();
      return parseFloat(account.subresourceUris?.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Vonage / Nexmo Adapter (HTTP POST, NOT GET — more secure) ----
class VonageSMSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || 'StaySuite';

      // Use POST instead of GET to avoid credentials in URL
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.accountSid,
          api_secret: this.config.authToken,
          to: options.to,
          from,
          text: options.message,
          'status-report-req': options.statusCallback ? '1' : '0',
          callback: options.statusCallback || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.messages?.[0]?.status !== '0') {
        const errMsg = data.messages?.[0]?.['error-text'] || `HTTP ${response.status}`;
        return {
          success: false,
          error: errMsg,
          provider: 'vonage',
          status: 'failed',
          messageId: data.messages?.[0]?.['message-id'],
        };
      }

      return {
        success: true,
        messageId: data.messages[0]['message-id'],
        provider: 'vonage',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/Vonage] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vonage send failed',
        provider: 'vonage',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const res = await fetch(
        `https://rest.nexmo.com/account/get-balance/${this.config.accountSid}/${this.config.authToken}`,
      );
      const data = await res.json();
      return parseFloat(data.value || '0');
    } catch {
      return 0;
    }
  }
}

// ---- MessageBird Adapter ----
class MessageBirdSMSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const body: Record<string, unknown> = {
        recipients: [options.to],
        originator: options.from || this.config.phoneNumber || 'StaySuite',
        body: options.message,
      };
      if (options.statusCallback) body.reportUrl = options.statusCallback;

      const response = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.errors?.[0]?.description || `HTTP ${response.status}`;
        return {
          success: false,
          error: errMsg,
          provider: 'messagebird',
          status: 'failed',
          messageId: data.id,
        };
      }

      return {
        success: true,
        messageId: data.id,
        provider: 'messagebird',
        status: data.status || 'sent',
      };
    } catch (error) {
      console.error('[SMS/MessageBird] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MessageBird send failed',
        provider: 'messagebird',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const res = await fetch('https://rest.messagebird.com/balance', {
        headers: { Authorization: `AccessKey ${this.config.authToken}` },
      });
      const data = await res.json();
      return parseFloat(data.amount || '0');
    } catch {
      return 0;
    }
  }
}

// ---- AWS SNS Adapter ----
class AWSSNSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  private getEndpoint(): string {
    const region = this.config.region || 'us-east-1';
    return `https://sns.${region}.amazonaws.com`;
  }

  /**
   * AWS Signature Version 4 signing helper
   */
  private async signRequest(
    method: string,
    service: string,
    host: string,
    path: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<Record<string, string>> {
    const region = this.config.region || 'us-east-1';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const dateStamp = amzDate.slice(0, 8);

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('\n');
    const signedHeaders = Object.keys(headers)
      .sort()
      .join(';');
    const payloadHash = await this.sha256Hex(body);
    const canonicalRequest = [
      method, path, '', canonicalHeaders + '\n', signedHeaders, payloadHash,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, credentialScope,
      await this.sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = await this.getSignatureKey(
      this.config.authToken!, dateStamp, region, service,
    );
    const signature = (await this.hmacHex(signingKey, stringToSign)).toString('hex');
    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${this.config.accountSid}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return headers;
  }

  private async sha256Hex(data: string): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(data).digest('hex');
  }

  private async getSignatureKey(
    key: string, date: string, region: string, service: string,
  ): Promise<Buffer> {
    const { createHmac } = await import('crypto');
    const kDate = createHmac('sha256', `AWS4${key}`).update(date).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  private async hmacHex(key: Buffer, data: string): Promise<Buffer> {
    const { createHmac } = await import('crypto');
    return createHmac('sha256', key).update(data).digest();
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const method = 'POST';
      const service = 'sns';
      const host = `sns.${this.config.region || 'us-east-1'}.amazonaws.com`;
      const endpoint = `https://${host}`;
      const path = '/';

      const body = JSON.stringify({
        PhoneNumber: options.to,
        Message: options.message,
        MessageAttributes: options.from
          ? { 'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: options.from } }
          : undefined,
      });

      const amzDate = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-Amz-Date': amzDate,
        Host: host,
      };

      const signedHeaders = await this.signRequest(method, service, host, path, body, headers);

      const response = await fetch(endpoint, {
        method,
        headers: signedHeaders,
        body,
      });

      const text = await response.text();

      if (!response.ok) {
        // Extract error message from XML response
        const match = text.match(/<Message>(.*?)<\/Message>/);
        const errMsg = match?.[1] || `AWS SNS HTTP ${response.status}`;
        return {
          success: false,
          error: errMsg,
          provider: 'aws_sns',
          status: 'failed',
        };
      }

      // Extract MessageId from XML response
      const idMatch = text.match(/<MessageId>(.*?)<\/MessageId>/);
      return {
        success: true,
        messageId: idMatch?.[1],
        provider: 'aws_sns',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/AWS-SNS] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AWS SNS send failed',
        provider: 'aws_sns',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    // SNS doesn't have native batch — publish individually
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    // AWS SNS uses IAM roles, no direct balance API
    return -1; // indicates "unlimited" (pay-per-use)
  }
}

// ---- Exotel Adapter (India, Cloud Telephony) ----
class ExotelAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const sid = this.config.accountSid || '';
      const token = this.config.authToken || '';
      const from = options.from || this.config.phoneNumber || '';
      const to = options.to.replace(/^\+/, '');

      const params = new URLSearchParams({
        From: from,
        To: to,
        Body: options.message,
      });
      if (this.config.region) params.set('DltTemplateId', this.config.region);

      const response = await fetch(
        `https://${sid}:${token}@api.exotel.com/v1/Accounts/${sid}/Sms/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          },
          body: params.toString(),
        },
      );

      const data = await response.json();

      if (!response.ok || data.status !== 'queued' && data.status !== 'sent') {
        return {
          success: false,
          error: data.message || data.error || `Exotel HTTP ${response.status}`,
          provider: 'exotel',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.SMSMessage?.Sid || data.message_id || `exotel-${Date.now()}`,
        provider: 'exotel',
        status: data.status || 'sent',
      };
    } catch (error) {
      console.error('[SMS/Exotel] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Exotel send failed',
        provider: 'exotel',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const sid = this.config.accountSid || '';
      const token = this.config.authToken || '';
      const response = await fetch(
        `https://api.exotel.com/v1/Accounts/${sid}`,
        { headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` } },
      );
      const data = await response.json();
      return parseFloat(data.Account?.Balance?.SMSCredits || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Fast2SMS Adapter (India, Budget SMS) ----
class Fast2SMSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const numbers = options.to.replace(/^\+/, '');
      const sender = options.from || this.config.phoneNumber || '';

      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': this.config.authToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: this.config.accountSid || 'otp',
          sender_id: sender,
          message: options.message,
          numbers,
          flash: 0,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success' && data.return !== true) {
        return {
          success: false,
          error: data.message || `Fast2SMS HTTP ${response.status}`,
          provider: 'fast2sms',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.message_id?.[0] || `fast2sms-${Date.now()}`,
        provider: 'fast2sms',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/Fast2SMS] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fast2SMS send failed',
        provider: 'fast2sms',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/wallet', {
        headers: { authorization: this.config.authToken! },
      });
      const data = await response.json();
      return parseFloat(data.wallet_balance || data.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Plivo Adapter (India/Global, CPaaS) ----
class PlivoAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const authId = this.config.accountSid || '';
      const authToken = this.config.authToken || '';
      const from = options.from || this.config.phoneNumber || '';
      const to = options.to;

      const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
        },
        body: JSON.stringify({
          src: from,
          dst: to,
          text: options.message,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        return {
          success: false,
          error: data.error || `Plivo HTTP ${response.status}`,
          provider: 'plivo',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.message_uuid?.[0] || data.messageId || `plivo-${Date.now()}`,
        provider: 'plivo',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/Plivo] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Plivo send failed',
        provider: 'plivo',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const authId = this.config.accountSid || '';
      const authToken = this.config.authToken || '';
      const response = await fetch(
        `https://api.plivo.com/v1/Account/${authId}/`,
        { headers: { Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}` } },
      );
      const data = await response.json();
      return parseFloat(data.cash_credits || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Route Mobile Adapter (India, Enterprise A2P) ----
class RouteMobileAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || '';
      const to = options.to.replace(/^\+/, '');

      const params = new URLSearchParams({
        username: this.config.accountSid || '',
        apiKey: this.config.authToken || '',
        sender: from,
        destination: to,
        message: options.message,
        routeid: this.config.region || '1',
      });

      const response = await fetch('https://api.routemobile.com/feeds/IntlSms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const text = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok || data.status === 'failure') {
        return {
          success: false,
          error: data.message || data.description || `Route Mobile HTTP ${response.status}`,
          provider: 'route_mobile',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messsageId || data.message_id || `routemobile-${Date.now()}`,
        provider: 'route_mobile',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/RouteMobile] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Route Mobile send failed',
        provider: 'route_mobile',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `https://api.routemobile.com/feeds/IntlSms?username=${this.config.accountSid}&apiKey=${this.config.authToken}&type=balance`,
      );
      const data = await response.json();
      return parseFloat(data.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- ValueFirst Adapter (India, Enterprise) ----
class ValueFirstAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || '';

      const response = await fetch('https://www.valuefirst.com/v1/sms/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: from,
          to: [options.to],
          message: options.message,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        return {
          success: false,
          error: data.message || `ValueFirst HTTP ${response.status}`,
          provider: 'valuefirst',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messageId || data.data?.[0]?.messageId || `valuefirst-${Date.now()}`,
        provider: 'valuefirst',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/ValueFirst] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ValueFirst send failed',
        provider: 'valuefirst',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch('https://www.valuefirst.com/v1/balance', {
        headers: { Authorization: `Bearer ${this.config.authToken}` },
      });
      const data = await response.json();
      return parseFloat(data.balance || data.credits || '0');
    } catch {
      return 0;
    }
  }
}

// ---- MSGCLUB Adapter (India, Bulk SMS) ----
class MSGCLUBAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || '';
      const to = options.to.replace(/^\+/, '');

      const response = await fetch('https://api.msgclub.net/rest/v1/message/send', {
        method: 'POST',
        headers: {
          'Authorization': this.config.authToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: from,
          message: options.message,
          contactNumbers: [to],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        return {
          success: false,
          error: data.message || data.response || `MSGCLUB HTTP ${response.status}`,
          provider: 'msgclub',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messageId || data.data?.[0]?.messageId || `msgclub-${Date.now()}`,
        provider: 'msgclub',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/MSGCLUB] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MSGCLUB send failed',
        provider: 'msgclub',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch('https://api.msgclub.net/rest/v1/balance', {
        headers: { Authorization: this.config.authToken! },
      });
      const data = await response.json();
      return parseFloat(data.balance || data.data?.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Airtel IQ Adapter (India, Telecom API) ----
class AirtelIQAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const clientId = this.config.accountSid || '';
      const clientSecret = this.config.authToken || '';
      const from = options.from || this.config.phoneNumber || '';

      const body: Record<string, unknown> = {
        from,
        to: [options.to],
        text: options.message,
      };
      if (this.config.region) body.dlt_template_id = this.config.region;

      const response = await fetch('https://iq.airtel.in/sms/api/v2/sms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientId}:${clientSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        return {
          success: false,
          error: data.message || `Airtel IQ HTTP ${response.status}`,
          provider: 'airtel_iq',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.transactionId || data.message_id || `airteliq-${Date.now()}`,
        provider: 'airtel_iq',
        status: data.status || 'sent',
      };
    } catch (error) {
      console.error('[SMS/AirtelIQ] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Airtel IQ send failed',
        provider: 'airtel_iq',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const clientId = this.config.accountSid || '';
      const clientSecret = this.config.authToken || '';
      const response = await fetch('https://iq.airtel.in/sms/api/v2/balance', {
        headers: { Authorization: `Bearer ${clientId}:${clientSecret}` },
      });
      const data = await response.json();
      return parseFloat(data.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- BulkSMS India Adapter (India, Bulk Messaging) ----
class BulkSMSAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || '';
      const to = options.to.replace(/^\+/, '');

      const params = new URLSearchParams({
        username: this.config.accountSid || '',
        apiKey: this.config.authToken || '',
        sender: from,
        mobile: to,
        message: options.message,
        type: 'TEXT',
      });

      const response = await fetch('https://portal.bulksmsindia.in/api/api_http.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const text = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok || data.status === 'error' || data.code === '402') {
        return {
          success: false,
          error: data.description || data.message || `BulkSMS HTTP ${response.status}`,
          provider: 'bulk_sms',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messageId || data.id || `bulksms-${Date.now()}`,
        provider: 'bulk_sms',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/BulkSMS] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'BulkSMS send failed',
        provider: 'bulk_sms',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const params = new URLSearchParams({
        username: this.config.accountSid || '',
        apiKey: this.config.authToken || '',
        type: 'balance',
      });
      const response = await fetch('https://portal.bulksmsindia.in/api/api_http.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await response.text();
      const match = text.match(/(?:balance|credit)[^\d]*(\d+(?:\.\d+)?)/i);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }
}

// ---- Custom HTTP Adapter ----
class CustomHTTPAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      if (!this.config.baseUrl) {
        return {
          success: false,
          error: 'Custom SMS provider URL not configured',
          provider: 'custom',
          status: 'failed',
        };
      }

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.to,
          from: options.from || this.config.phoneNumber,
          body: options.message,
          callback: options.statusCallback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          provider: 'custom',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.id || data.messageId || `custom-${Date.now()}`,
        provider: 'custom',
        status: data.status || 'sent',
        cost: data.cost ? parseFloat(data.cost) : undefined,
      };
    } catch (error) {
      console.error('[SMS/Custom] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Custom SMS send failed',
        provider: 'custom',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    // Custom providers may not have balance API
    return -1;
  }
}

// ---- MSG91 Adapter (India-focused, DLT compliant) ----
class MSG91Adapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || 'STAYSU';
      // MSG91 flow: <country_code><10-digit-mobile>
      const to = options.to.replace(/^\+/, '');

      const response = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': this.config.authToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: this.config.accountSid, // Reuse accountSid as flow_id for template-based
          sender: from,
          mobiles: to,
          message: options.message,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.type === 'error') {
        return {
          success: false,
          error: data.message || `MSG91 HTTP ${response.status}`,
          provider: 'msg91',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.message_id || `msg91-${Date.now()}`,
        provider: 'msg91',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/MSG91] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MSG91 send failed',
        provider: 'msg91',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    // MSG91 doesn't have native batch — send individually
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `https://api.msg91.com/api/v5/balance?authkey=${this.config.authToken}`,
      );
      const data = await response.json();
      return parseFloat(data.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Gupshup Adapter (India, WhatsApp + SMS) ----
class GupshupAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || 'STAYSU';
      // Gupshup send endpoint
      const params = new URLSearchParams({
        userid: this.config.accountSid || '',
        password: this.config.authToken || '',
        send_to: options.to.replace(/^\+/, ''),
        msg: options.message,
        msg_type: 'TEXT',
        v: '1.1',
      });
      if (from) params.set('mask', from);

      const response = await fetch('https://api.gupshup.io/smapi/v1/msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.status === 'failure' || data.responseCode === '402') {
        return {
          success: false,
          error: data.message || data.reason || 'Gupshup send failed',
          provider: 'gupshup',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messageId || `gupshup-${Date.now()}`,
        provider: 'gupshup',
        status: data.status || 'sent',
      };
    } catch (error) {
      console.error('[SMS/Gupshup] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gupshup send failed',
        provider: 'gupshup',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `https://api.gupshup.io/sm/api/v1/balance?userid=${this.config.accountSid}&password=${this.config.authToken}`,
      );
      const data = await response.json();
      return parseFloat(data.balance || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Textlocal Adapter (India / Global) ----
class TextlocalAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const params = new URLSearchParams({
        apiKey: this.config.authToken || '',
        numbers: options.to.replace(/^\+/, ''),
        message: options.message,
        sender: options.from || this.config.phoneNumber || 'STAYSU',
        test: '0',
      });

      if (options.statusCallback) {
        params.set('receipt_url', options.statusCallback);
      }

      const response = await fetch('https://api.txtlocal.com/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.status !== 'success') {
        return {
          success: false,
          error: data.errors?.[0]?.message || 'Textlocal send failed',
          provider: 'textlocal',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id || `textlocal-${Date.now()}`,
        provider: 'textlocal',
        status: data.messages?.[0]?.status || 'sent',
        cost: parseFloat(data.messages?.[0]?.cost || '0'),
      };
    } catch (error) {
      console.error('[SMS/Textlocal] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Textlocal send failed',
        provider: 'textlocal',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `https://api.txtlocal.com/balance/?apiKey=${this.config.authToken}`,
      );
      const data = await response.json();
      return parseFloat(data.balance?.sms || '0');
    } catch {
      return 0;
    }
  }
}

// ---- Kaleyra Adapter (India, CPaaS) ----
class KaleyraAdapter {
  private config: SMSCredentials;

  constructor(config: SMSCredentials) {
    this.config = config;
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    try {
      const from = options.from || this.config.phoneNumber || 'STAYSU';
      const to = options.to.replace(/^\+/, '');

      const response = await fetch('https://api.kaleyra.io/v1/' + this.config.accountSid + '/messages', {
        method: 'POST',
        headers: {
          'api-key': this.config.authToken!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: `+${to}`,
          type: 'OTP',
          sender: from,
          body: options.message,
          template_id: this.config.region || '', // Optional: DLT template ID
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        return {
          success: false,
          error: data.message || `Kaleyra HTTP ${response.status}`,
          provider: 'kaleyra',
          status: 'failed',
        };
      }

      return {
        success: true,
        messageId: data.data?.[0]?.id || data.message_id || `kaleyra-${Date.now()}`,
        provider: 'kaleyra',
        status: 'sent',
      };
    } catch (error) {
      console.error('[SMS/Kaleyra] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kaleyra send failed',
        provider: 'kaleyra',
        status: 'failed',
      };
    }
  }

  async sendBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async getBalance(): Promise<number> {
    try {
      const response = await fetch(
        `https://api.kaleyra.io/v1/${this.config.accountSid}/balance`,
        { headers: { 'api-key': this.config.authToken! } },
      );
      const data = await response.json();
      return parseFloat(data.data?.balance?.sms || '0');
    } catch {
      return 0;
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// Unified SMS Adapter Interface
// ──────────────────────────────────────────────────────────────────

export interface SMSAdapter {
  send(options: SMSOptions): Promise<SMSResult>;
  sendBatch(messages: SMSOptions[]): Promise<SMSResult[]>;
  getBalance(): Promise<number>;
}

// ──────────────────────────────────────────────────────────────────
// Factory: Create adapter from credentials
// ──────────────────────────────────────────────────────────────────

function createAdapterFromCreds(creds: SMSCredentials): SMSAdapter {
  switch (creds.provider) {
    case 'twilio':
      return new TwilioSMSAdapter(creds) as unknown as SMSAdapter;
    case 'vonage':
      return new VonageSMSAdapter(creds) as unknown as SMSAdapter;
    case 'messagebird':
      return new MessageBirdSMSAdapter(creds) as unknown as SMSAdapter;
    case 'aws_sns':
      return new AWSSNSAdapter(creds) as unknown as SMSAdapter;
    case 'msg91':
      return new MSG91Adapter(creds) as unknown as SMSAdapter;
    case 'gupshup':
      return new GupshupAdapter(creds) as unknown as SMSAdapter;
    case 'textlocal':
      return new TextlocalAdapter(creds) as unknown as SMSAdapter;
    case 'kaleyra':
      return new KaleyraAdapter(creds) as unknown as SMSAdapter;
    case 'exotel':
      return new ExotelAdapter(creds) as unknown as SMSAdapter;
    case 'fast2sms':
      return new Fast2SMSAdapter(creds) as unknown as SMSAdapter;
    case 'plivo':
      return new PlivoAdapter(creds) as unknown as SMSAdapter;
    case 'route_mobile':
      return new RouteMobileAdapter(creds) as unknown as SMSAdapter;
    case 'valuefirst':
      return new ValueFirstAdapter(creds) as unknown as SMSAdapter;
    case 'msgclub':
      return new MSGCLUBAdapter(creds) as unknown as SMSAdapter;
    case 'airtel_iq':
      return new AirtelIQAdapter(creds) as unknown as SMSAdapter;
    case 'bulk_sms':
      return new BulkSMSAdapter(creds) as unknown as SMSAdapter;
    case 'custom':
      return new CustomHTTPAdapter(creds) as unknown as SMSAdapter;
    case 'mock':
    default:
      return new MockSMSAdapter() as unknown as SMSAdapter;
  }
}

// ──────────────────────────────────────────────────────────────────
// Singleton + Per-Tenant Management
// ──────────────────────────────────────────────────────────────────

let globalInstance: SMSAdapter | null = null;

/**
 * Build credentials from environment variables.
 * Reads SMS_PROVIDER, SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM_NUMBER, etc.
 */
function getEnvCredentials(): SMSCredentials | null {
  const provider = (process.env.SMS_PROVIDER || process.env.SMS_GATEWAY || '') as SMSProviderType;
  const accountSid = process.env.SMS_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.SMS_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.SMS_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) return null;

  return {
    provider: ['twilio', 'vonage', 'messagebird', 'aws_sns', 'msg91', 'gupshup', 'textlocal', 'kaleyra', 'exotel', 'fast2sms', 'plivo', 'route_mobile', 'valuefirst', 'msgclub', 'airtel_iq', 'bulk_sms', 'custom'].includes(provider)
      ? provider
      : 'twilio',
    accountSid,
    authToken,
    phoneNumber,
    region: process.env.AWS_REGION || process.env.SMS_REGION,
    baseUrl: process.env.SMS_BASE_URL,
    webhookSecret: process.env.SMS_WEBHOOK_SECRET,
    defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || process.env.DEFAULT_COUNTRY_CODE,
  };
}

/**
 * Get the global SMS adapter (singleton).
 * Priority: ENABLE_SMS + credentials → mock only in non-production.
 * In production without credentials: throws error (no silent fallback).
 */
export async function getSMS(): Promise<SMSAdapter> {
  if (globalInstance) return globalInstance;

  const config = getConfig();
  const envCreds = getEnvCredentials();

  // Production: require real credentials
  if (config.isProduction && !envCreds) {
    throw new Error(
      '[SMS] No SMS credentials configured in production. ' +
      'Set SMS_PROVIDER, SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM_NUMBER in .env ' +
      'or configure via Settings > Integrations in the admin panel.',
    );
  }

  // Sandbox / Dev: use mock if no credentials
  if (!envCreds) {
    globalInstance = new MockSMSAdapter() as unknown as SMSAdapter;
    console.log('[SMS] No credentials found — using mock adapter (dev mode)');
    return globalInstance;
  }

  // Check feature flag for SMS
  if (!config.sms.enabled && !config.features.enableSMS) {
    globalInstance = new MockSMSAdapter() as unknown as SMSAdapter;
    console.log('[SMS] SMS feature disabled — using mock adapter');
    return globalInstance;
  }

  globalInstance = createAdapterFromCreds(envCreds);
  console.log(`[SMS] Using ${envCreds.provider} provider (env config)`);
  return globalInstance;
}

/**
 * Get SMS adapter for a specific tenant.
 * Priority: DB Integration → env vars → mock (dev) / error (prod).
 * Returns a fresh instance each time — never caches tenant adapters.
 */
export async function getSMSForTenant(tenantId: string): Promise<SMSAdapter> {
  // Try DB-first config (handles sms_twilio, sms_vonage, etc.)
  const dbCreds = await getSMSProviderConfig(tenantId);
  if (dbCreds) {
    console.log(`[SMS] Using ${dbCreds.provider} for tenant ${tenantId} (${dbCreds._source})`);
    return createAdapterFromCreds(dbCreds);
  }

  // Fallback: try legacy Twilio-specific DB config
  const twilioCreds = await getTwilioConfig(tenantId);
  if (twilioCreds.accountSid) {
    const creds: SMSCredentials = {
      provider: 'twilio',
      accountSid: twilioCreds.accountSid,
      authToken: twilioCreds.authToken,
      phoneNumber: twilioCreds.phoneNumber,
    };
    console.log(`[SMS] Using Twilio (legacy DB config) for tenant ${tenantId}`);
    return createAdapterFromCreds(creds);
  }

  // Fallback: global env adapter or mock
  const envCreds = getEnvCredentials();
  if (envCreds) {
    console.log(`[SMS] Using ${envCreds.provider} (env fallback) for tenant ${tenantId}`);
    return createAdapterFromCreds(envCreds);
  }

  // No credentials at all
  const config = getConfig();
  if (config.isProduction) {
    throw new Error(
      `[SMS] No SMS credentials for tenant ${tenantId} (production). ` +
      'Configure via Settings > Integrations or set env vars.',
    );
  }

  console.log(`[SMS] No credentials for tenant ${tenantId} — using mock`);
  return new MockSMSAdapter() as unknown as SMSAdapter;
}

/**
 * Send a single SMS using the global adapter.
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
  const sms = await getSMS();
  return sms.send(options);
}

/**
 * Send multiple SMS using the global adapter.
 */
export async function sendSMSBatch(messages: SMSOptions[]): Promise<SMSResult[]> {
  const sms = await getSMS();
  return sms.sendBatch(messages);
}

/**
 * Send a single SMS for a specific tenant.
 */
export async function sendSMSForTenant(
  tenantId: string,
  options: SMSOptions,
): Promise<SMSResult> {
  const sms = await getSMSForTenant(tenantId);
  return sms.send(options);
}

/**
 * Reset the global SMS adapter (for testing / hot-reload).
 */
export function resetSMS(): void {
  globalInstance = null;
}

// ──────────────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────────────

export {
  MockSMSAdapter,
  TwilioSMSAdapter,
  VonageSMSAdapter,
  MessageBirdSMSAdapter,
  AWSSNSAdapter,
  MSG91Adapter,
  GupshupAdapter,
  TextlocalAdapter,
  KaleyraAdapter,
  ExotelAdapter,
  Fast2SMSAdapter,
  PlivoAdapter,
  RouteMobileAdapter,
  ValueFirstAdapter,
  MSGCLUBAdapter,
  AirtelIQAdapter,
  BulkSMSAdapter,
  CustomHTTPAdapter,
  createAdapterFromCreds,
  getEnvCredentials,
};

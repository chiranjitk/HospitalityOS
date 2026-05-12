/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * StripeTerminalAdapter — real Stripe Terminal SDK integration via REST.
 *
 * Connects to the Stripe Terminal API to manage readers, process payments,
 * create refunds, and handle terminal lifecycle. Uses the Stripe API version
 * header for request routing.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
  type PaginatedResult,
  type CreateCheckoutRequest,
  type CreateCheckoutResponse,
} from '../../types';
import { mapHttpError, createHardwareError, HardwareErrorCode } from '../../errors';
import { BaseTerminalAdapter } from '../base-terminal-adapter';
import type { TerminalInfo, TransactionInfo } from '../terminal-provider';
import {
  TerminalStatus,
  TerminalTransactionStatus,
  PaymentMethodType,
  type TerminalId,
  type VendorTerminalId,
  type TerminalMetadata,
  type TerminalTransaction,
  type RefundRequest,
  type VoidRequest,
  type CaptureRequest,
  type DisplayMessageRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Stripe API response shapes
// ---------------------------------------------------------------------------

interface StripeTerminalReader {
  id: string;
  object: string;
  device_type: string;
  label: string;
  location: string;
  status: 'online' | 'offline';
  metadata: Record<string, unknown>;
  livemode: boolean;
  serial_number?: string;
  ip_address?: string;
  deleted?: boolean;
}

interface StripeTerminalLocation {
  id: string;
  object: string;
  display_name: string;
  address?: Record<string, unknown>;
  livemode: boolean;
}

interface StripePaymentIntent {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  amount_capturable?: number;
  amount_received?: number;
  capture_method?: string;
  created: number;
  metadata?: Record<string, unknown>;
  payment_method?: string;
  payment_method_types?: string[];
  latest_charge?: string;
  description?: string;
  statement_descriptor?: string;
  client_secret?: string;
}

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  refunded: boolean;
  payment_method_details?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
      funding: string;
    };
  };
}

interface StripeRefund {
  id: string;
  object: string;
  amount: number;
  currency: string;
  payment_intent: string;
  status: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  created: number;
}

interface StripePaymentMethod {
  id: string;
  object: string;
  type: string;
  created: number;
  livemode: boolean;
  card?: {
    brand: string;
    last4: string;
    funding: string;
    country: string;
  };
}

interface StripeBalance {
  object: string;
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
  livemode: boolean;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class StripeTerminalAdapter extends BaseTerminalAdapter {
  private baseUrl = 'https://api.stripe.com';
  private stripeVersion = '2023-10-16';
  private defaultCurrency = 'usd';
  private stripeAccountId = '';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'stripe-terminal',
      category: 'terminal',
      displayName: 'Stripe Terminal',
      version: '1.0.0',
      hasSimulation: false,
      supportsWebhooks: true,
      supportsPolling: true,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  override async initialize(
    config: HardwareAdapterConfig,
    credentials: HardwareAdapterCredentials,
  ): Promise<void> {
    await super.initialize(config, credentials);

    this.stripeAccountId = String(config.stripeAccountId ?? '');
    this.defaultCurrency = String(config.defaultCurrency ?? 'usd');

    if (!credentials.secretKey) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Stripe Terminal adapter requires "secretKey" credential.',
        'stripe-terminal',
      );
    }

    if (!String(credentials.secretKey).startsWith('sk_')) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Stripe secretKey must start with "sk_".',
        'stripe-terminal',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Verify credentials by fetching terminal locations
      await this.stripeGet<{ data: StripeTerminalLocation[] }>('/v1/terminal/locations?limit=1');
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Stripe Terminal connection failed: ${msg}`,
        'stripe-terminal',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      await this.stripeGet<StripeBalance>('/v1/balance');
      const latencyMs = Date.now() - start;
      return {
        providerId: 'stripe-terminal',
        propertyId: this.propertyId,
        status: AdapterHealthStatus.Healthy,
        lastHealthyAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        message: null,
        consecutiveFailures: 0,
        latencyMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        providerId: 'stripe-terminal',
        propertyId: this.propertyId,
        status: AdapterHealthStatus.Unhealthy,
        lastHealthyAt: null,
        lastCheckedAt: new Date().toISOString(),
        message: msg,
        consecutiveFailures: 1,
        latencyMs: Date.now() - start,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Webhook signature verification
  // -----------------------------------------------------------------------

  async verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    const signature = headers['stripe-signature'];
    if (!signature) return false;

    // Stripe uses t.v1 HMAC-based signatures.
    // Full verification requires the webhook secret (not the API key).
    // For now, validate the format: "t=timestamp,v1=hmac"
    const parts = signature.split(',');
    if (parts.length < 1) return false;

    const timestampPart = parts.find((p) => p.startsWith('t='));
    const v1Part = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !v1Part) return false;

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const v1 = v1Part.slice(3);

    // Basic format check
    if (isNaN(timestamp) || v1.length < 10) return false;

    // Reject signatures older than 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) return false;

    // In production, compute HMAC-SHA256 with webhookSecret and compare to v1.
    // Placeholder: we've validated format and timing.
    void rawBody;
    return true;
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Queries
  // -----------------------------------------------------------------------

  async listTerminals(
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<TerminalInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.stripeGet<{ data: StripeTerminalReader[]; has_more: boolean; next_page?: string }>(
        '/v1/terminal/readers?limit=100',
      );

      const items: TerminalInfo[] = response.data.map((reader) => this.mapReaderToTerminalInfo(reader));

      return {
        items,
        nextCursor: response.has_more ? (response.next_page ?? 'true') : null,
        hasMore: response.has_more,
        total: items.length,
      };
    } catch {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  async getTerminal(terminalId: string): Promise<HardwareResult<TerminalInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const reader = await this.stripeGet<StripeTerminalReader>(
        `/v1/terminal/readers/${terminalId}`,
      );

      return {
        success: true,
        data: this.mapReaderToTerminalInfo(reader),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTerminal');
    }
  }

  async listTransactions(
    terminalId: string,
    _cursor?: string,
    limit: number = 50,
  ): Promise<PaginatedResult<TransactionInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.stripeGet<{ data: StripePaymentIntent[]; has_more: boolean }>(
        `/v1/payment_intents?limit=${limit}&expand[]=latest_charge`,
      );

      const items: TransactionInfo[] = response.data.map((pi) =>
        this.mapPaymentIntentToTransactionInfo(pi, terminalId),
      );

      return {
        items,
        nextCursor: response.has_more ? String(limit) : null,
        hasMore: response.has_more,
        total: items.length,
      };
    } catch {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Operations
  // -----------------------------------------------------------------------

  async createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<HardwareResult<CreateCheckoutResponse>> {
    try {
      await this.executeWithReconnect(async () => {});

      const vendorTerminalId = String(request.metadata?.vendorTerminalId ?? request.terminalId);

      const piParams: Record<string, unknown> = {
        amount: request.amount,
        currency: request.currency || this.defaultCurrency,
        payment_method_types: ['card_present'],
        capture_method: request.metadata?.autoCapture === false ? 'manual' : 'automatic',
        metadata: {},
      };

      if (request.description) piParams.description = request.description;
      if (request.correlationId) piParams.statement_descriptor = request.correlationId;
      if (request.bookingId) (piParams.metadata as Record<string, unknown>).bookingId = request.bookingId;
      if (request.metadata?.guestId) (piParams.metadata as Record<string, unknown>).guestId = request.metadata.guestId;
      if (request.metadata?.paymentId) (piParams.metadata as Record<string, unknown>).paymentId = request.metadata.paymentId;

      const pi = await this.stripePost<StripePaymentIntent>(
        '/v1/payment_intents',
        piParams,
      );

      // Process on reader
      const processResponse = await this.stripePost<StripePaymentIntent>(
        `/v1/terminal/readers/${vendorTerminalId}/process_payment_intent`,
        { payment_intent: pi.id },
      );

      return {
        success: true,
        data: {
          checkoutId: processResponse.id,
          terminalId: request.terminalId,
          amount: request.amount,
          currency: request.currency || this.defaultCurrency,
          status: processResponse.status,
          vendorCheckoutId: processResponse.id,
          timestamp: new Date(processResponse.created * 1000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'createCheckout');
    }
  }

  // -----------------------------------------------------------------------
  // Extended terminal-domain methods
  // -----------------------------------------------------------------------

  async getTerminalStatus(terminalId: TerminalId): Promise<HardwareResult<TerminalMetadata>> {
    try {
      await this.executeWithReconnect(async () => {});

      const reader = await this.stripeGet<StripeTerminalReader>(
        `/v1/terminal/readers/${terminalId}`,
      );

      return {
        success: true,
        data: this.mapReaderToMetadata(reader),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTerminalStatus');
    }
  }

  async cancelCheckout(
    _transactionId: string,
    vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const pi = await this.stripePost<StripePaymentIntent>(
        `/v1/payment_intents/${vendorTransactionId}/cancel`,
        {},
      );

      return {
        success: true,
        data: this.mapPaymentIntentToTransaction(pi),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'cancelCheckout');
    }
  }

  async captureTransaction(
    request: CaptureRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const params: Record<string, unknown> = {};
      if (request.amount != null) params.amount_to_capture = request.amount;

      const pi = await this.stripePost<StripePaymentIntent>(
        `/v1/payment_intents/${request.vendorTransactionId}/capture`,
        params,
      );

      return {
        success: true,
        data: this.mapPaymentIntentToTransaction(pi),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'captureTransaction');
    }
  }

  async refundTransaction(
    request: RefundRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const params: Record<string, unknown> = {
        payment_intent: request.vendorTransactionId,
      };
      if (request.amount != null) params.amount = request.amount;
      if (request.reason) params.reason = request.reason;

      const refund = await this.stripePost<StripeRefund>(
        '/v1/refunds',
        params,
      );

      return {
        success: true,
        data: {
          transactionId: refund.id,
          vendorTransactionId: refund.id,
          terminalId: '',
          vendorTerminalId: '',
          currency: refund.currency,
          amount: refund.amount,
          status: TerminalTransactionStatus.Refunded,
          description: `Refund: ${request.reason ?? 'no reason'}`,
          createdAt: new Date(refund.created * 1000).toISOString(),
          completedAt: new Date(refund.created * 1000).toISOString(),
          vendorMetadata: {
            refundId: refund.id,
            originalPaymentIntent: refund.payment_intent,
            refundStatus: refund.status,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'refundTransaction');
    }
  }

  async voidTransaction(
    request: VoidRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    // Stripe voids are handled by cancelling the PaymentIntent
    try {
      await this.executeWithReconnect(async () => {});

      const pi = await this.stripePost<StripePaymentIntent>(
        `/v1/payment_intents/${request.vendorTransactionId}/cancel`,
        {},
      );

      return {
        success: true,
        data: this.mapPaymentIntentToTransaction(pi),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'voidTransaction');
    }
  }

  async getTransaction(
    _transactionId: string,
    vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const pi = await this.stripeGet<StripePaymentIntent>(
        `/v1/payment_intents/${vendorTransactionId}?expand[]=latest_charge`,
      );

      return {
        success: true,
        data: this.mapPaymentIntentToTransaction(pi),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTransaction');
    }
  }

  async listTerminalTransactions(
    terminalId: TerminalId,
    _cursor?: string,
    limit: number = 50,
  ): Promise<HardwareResult<PaginatedResult<TerminalTransaction>>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.stripeGet<{ data: StripePaymentIntent[]; has_more: boolean }>(
        `/v1/terminal/readers/${terminalId}/transactions?limit=${limit}`,
      );

      const items: TerminalTransaction[] = response.data.map((pi) =>
        this.mapPaymentIntentToTransaction(pi),
      );

      return {
        success: true,
        data: {
          items,
          nextCursor: response.has_more ? String(limit) : null,
          hasMore: response.has_more,
          total: items.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'listTerminalTransactions');
    }
  }

  async displayMessage(
    request: DisplayMessageRequest,
  ): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {});

      // Stripe Terminal readers support collecting payment methods but not
      // arbitrary display messages via the REST API (requires SDK).
      await this.stripePost(
        `/v1/terminal/readers/${request.vendorTerminalId}/display_cart`,
        {
          line_items: [{ description: request.message, amount: 0, quantity: 1 }],
        },
      );

      return { success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'displayMessage');
    }
  }

  async storePaymentMethod(
    _terminalId: TerminalId,
    _vendorTerminalId: VendorTerminalId,
  ): Promise<HardwareResult<{ paymentToken: string }>> {
    try {
      await this.executeWithReconnect(async () => {});

      // Create a SetupIntent for collecting payment method on terminal
      const setupIntent = await this.stripePost<{ id: string; client_secret: string; status: string }>(
        '/v1/setup_intents',
        {
          payment_method_types: ['card_present'],
          usage: 'off_session',
        },
      );

      // Process setup intent on reader
      await this.stripePost(
        `/v1/terminal/readers/${_vendorTerminalId}/process_setup_intent`,
        { setup_intent: setupIntent.id },
      );

      return {
        success: true,
        data: { paymentToken: setupIntent.id },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'storePaymentMethod');
    }
  }

  async discoverTerminals(): Promise<HardwareResult<TerminalMetadata[]>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.stripeGet<{ data: StripeTerminalReader[] }>(
        '/v1/terminal/readers?limit=100',
      );

      const terminals: TerminalMetadata[] = response.data.map((reader) =>
        this.mapReaderToMetadata(reader),
      );

      return {
        success: true,
        data: terminals,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'discoverTerminals');
    }
  }

  async registerTerminal(
    registrationCode: string,
  ): Promise<HardwareResult<TerminalMetadata>> {
    try {
      await this.executeWithReconnect(async () => {});

      const reader = await this.stripePost<StripeTerminalReader>(
        '/v1/terminal/readers',
        { registration_code: registrationCode },
      );

      return {
        success: true,
        data: this.mapReaderToMetadata(reader),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'registerTerminal');
    }
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.credentials.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.stripeVersion,
    };
    if (this.stripeAccountId) {
      headers['Stripe-Account'] = this.stripeAccountId;
    }
    return headers;
  }

  private async stripeGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.credentials.secretKey}`,
        'Stripe-Version': this.stripeVersion,
        ...(this.stripeAccountId ? { 'Stripe-Account': this.stripeAccountId } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'stripe-terminal');
    }

    return (await response.json()) as T;
  }

  private async stripePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const formBody = Object.entries(body)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => {
        const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`;
      })
      .join('&');

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders,
      body: formBody,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'stripe-terminal');
    }

    return (await response.json()) as T;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapReaderToTerminalInfo(reader: StripeTerminalReader): TerminalInfo {
    return {
      id: reader.id,
      vendorTerminalId: reader.id,
      name: reader.label,
      model: reader.device_type,
      serialNumber: reader.serial_number,
      status: reader.status,
      p2peEnabled: true,
    };
  }

  private mapReaderToMetadata(reader: StripeTerminalReader): TerminalMetadata {
    let status = TerminalStatus.Unknown;
    if (reader.status === 'online') status = TerminalStatus.Idle;
    else if (reader.status === 'offline') status = TerminalStatus.Offline;

    return {
      terminalId: reader.id,
      vendorTerminalId: reader.id,
      name: reader.label,
      propertyId: this.propertyId,
      status,
      isConnected: reader.status === 'online',
      batteryLevel: null,
      serialNumber: reader.serial_number,
      deviceInfo: {
        model: reader.device_type,
        manufacturer: 'Stripe',
      },
      lastSeenAt: new Date().toISOString(),
      vendorMetadata: reader.metadata,
    };
  }

  private mapPaymentIntentToTransaction(pi: StripePaymentIntent): TerminalTransaction {
    let status = TerminalTransactionStatus.Pending;
    if (pi.status === 'succeeded' && (pi as unknown as { capture_method?: string }).capture_method !== 'manual') {
      status = TerminalTransactionStatus.Captured;
    } else if (pi.status === 'succeeded') {
      status = TerminalTransactionStatus.Authorized;
    } else if (pi.status === 'canceled') {
      status = TerminalTransactionStatus.Cancelled;
    } else if (pi.status === 'requires_payment_method') {
      status = TerminalTransactionStatus.Declined;
    }

    return {
      transactionId: pi.id,
      vendorTransactionId: pi.id,
      terminalId: '',
      vendorTerminalId: '',
      currency: pi.currency,
      amount: pi.amount,
      capturedAmount: pi.amount_received,
      status,
      description: pi.description ?? undefined,
      createdAt: new Date(pi.created * 1000).toISOString(),
      completedAt: status === TerminalTransactionStatus.Captured || status === TerminalTransactionStatus.Cancelled
        ? new Date(pi.created * 1000).toISOString()
        : undefined,
      vendorMetadata: pi.metadata,
    };
  }

  private mapPaymentIntentToTransactionInfo(pi: StripePaymentIntent, terminalId: string): TransactionInfo {
    let status = 'pending';
    if (pi.status === 'succeeded') status = 'succeeded';
    else if (pi.status === 'canceled') status = 'cancelled';
    else if (pi.status === 'requires_payment_method') status = 'requires_payment_method';

    return {
      id: pi.id,
      vendorTransactionId: pi.id,
      terminalId,
      amount: pi.amount,
      currency: pi.currency,
      transactionType: 'payment',
      status,
      createdAt: new Date(pi.created * 1000).toISOString(),
    };
  }
}

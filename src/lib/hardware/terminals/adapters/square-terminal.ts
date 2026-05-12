/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * SquareTerminalAdapter — Square Terminal Checkout API integration.
 *
 * Square's Terminal Checkout API is the simplest to integrate — pure REST
 * with no client SDK required. This adapter creates terminal checkouts,
 * processes payments, and handles refunds via the Square API.
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
// Square API response shapes
// ---------------------------------------------------------------------------

interface SquareError {
  category: string;
  code: string;
  detail: string;
}

interface SquareResponse<T> {
  errors?: SquareError[];
  [key: string]: unknown;
}

interface SquareLocation {
  id: string;
  name: string;
  address?: Record<string, unknown>;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

interface SquareDevice {
  id: string;
  name: string;
  component?: Record<string, unknown>;
  location_id: string;
  status: string;
  created_at: string;
}

interface SquareTerminalCheckout {
  id: string;
  amount_money: { amount: number; currency: string };
  payment_id?: string;
  status: string;
  device_options?: { device_id: string; skip_receipt_screen?: boolean; tip_settings?: Record<string, unknown> };
  reference_id?: string;
  created_at: string;
  updated_at?: string;
}

interface SquarePayment {
  id: string;
  order_id?: string;
  amount_money: { amount: number; currency: string };
  status: string;
  source_type?: string;
  card_details?: {
    status: string;
    card?: { card_brand: string; last_4: string; fingerprint: string };
    entry_method: string;
  };
  created_at: string;
  location_id: string;
}

interface SquareRefund {
  id: string;
  status: string;
  amount_money: { amount: number; currency: string };
  payment_id: string;
  reason?: string;
  created_at: string;
  location_id: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SquareTerminalAdapter extends BaseTerminalAdapter {
  private baseUrl = 'https://connect.squareup.com';
  private squareVersion = '2024-06-20';
  private locationId = '';
  private defaultCurrency = 'USD';
  private environment: 'sandbox' | 'production' = 'sandbox';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'square-terminal',
      category: 'terminal',
      displayName: 'Square Terminal',
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

    this.locationId = String(config.locationId ?? '');
    this.defaultCurrency = String(config.defaultCurrency ?? 'USD');

    if (config.environment === 'production') {
      this.environment = 'production';
      this.baseUrl = 'https://connect.squareup.com';
    } else {
      this.environment = 'sandbox';
      this.baseUrl = 'https://connect.squareupsandbox.com';
    }

    if (!this.locationId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Square Terminal adapter requires "locationId" in config.',
        'square-terminal',
      );
    }

    if (!credentials.accessToken) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Square Terminal adapter requires "accessToken" credential.',
        'square-terminal',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Verify access token by fetching the location
      await this.squareGet<SquareResponse<SquareLocation>>(
        `/v2/locations/${this.locationId}`,
      );
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Square Terminal connection failed: ${msg}`,
        'square-terminal',
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
      await this.squareGet<SquareResponse<{ locations: SquareLocation[] }>>(
        '/v2/locations',
      );
      const latencyMs = Date.now() - start;
      return {
        providerId: 'square-terminal',
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
        providerId: 'square-terminal',
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
  // Webhook
  // -----------------------------------------------------------------------

  async verifyWebhookSignature(
    _rawBody: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    const signature = headers['x-square-signature'];
    if (!signature) return false;
    // Square uses HMAC-SHA256 with webhook signing key.
    // Basic format validation — full verification requires the signing key.
    return signature.length > 10;
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

      const response = await this.squareGet<SquareResponse<{ devices: SquareDevice[] }>>(
        `/v2/devices?location_id=${this.locationId}`,
      );

      const devices = (response as unknown as { devices: SquareDevice[] }).devices ?? [];
      const items: TerminalInfo[] = devices.map((device) => this.mapDeviceToTerminalInfo(device));

      return {
        items,
        nextCursor: null,
        hasMore: false,
        total: items.length,
      };
    } catch {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  async getTerminal(terminalId: string): Promise<HardwareResult<TerminalInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.squareGet<SquareResponse<{ device: SquareDevice }>>(
        `/v2/devices/${terminalId}`,
      );

      const device = (response as unknown as { device: SquareDevice }).device;
      if (!device) {
        return {
          success: false,
          error: `Terminal "${terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: this.mapDeviceToTerminalInfo(device),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTerminal');
    }
  }

  async listTransactions(
    _terminalId: string,
    _cursor?: string,
    limit: number = 50,
  ): Promise<PaginatedResult<TransactionInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.squareGet<SquareResponse<{ payments: SquarePayment[] }>>(
        `/v2/payments?location_id=${this.locationId}&limit=${limit}`,
      );

      const payments = (response as unknown as { payments: SquarePayment[] }).payments ?? [];
      const items: TransactionInfo[] = payments.map((payment) => this.mapPaymentToTransactionInfo(payment));

      return {
        items,
        nextCursor: null,
        hasMore: payments.length >= limit,
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

      const body: Record<string, unknown> = {
        idempotency_key: `staysuite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        checkout: {
          amount_money: {
            amount: request.amount,
            currency: request.currency || this.defaultCurrency,
          },
          device_options: {
            device_id: vendorTerminalId,
          },
        },
      };

      if (request.description) {
        (body.checkout as Record<string, unknown>).note = request.description;
      }
      if (request.correlationId) {
        (body.checkout as Record<string, unknown>).reference_id = request.correlationId;
      }
      if (request.metadata?.enableTipping) {
        (body.checkout as Record<string, unknown>).tip_settings = {
          enter_tip_amount_custom: true,
          separate_tip_screen: true,
        };
      }

      const response = await this.squarePost<SquareResponse<{ checkout: SquareTerminalCheckout }>>(
        '/v2/terminal/checkouts',
        body,
      );

      const checkout = (response as unknown as { checkout: SquareTerminalCheckout }).checkout;

      return {
        success: true,
        data: {
          checkoutId: checkout.id,
          terminalId: request.terminalId,
          amount: request.amount,
          currency: request.currency || this.defaultCurrency,
          status: checkout.status,
          vendorCheckoutId: checkout.id,
          timestamp: new Date().toISOString(),
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

      const response = await this.squareGet<SquareResponse<{ device: SquareDevice }>>(
        `/v2/devices/${terminalId}`,
      );

      const device = (response as unknown as { device: SquareDevice }).device;
      if (!device) {
        return {
          success: false,
          error: `Terminal "${terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: this.mapDeviceToMetadata(device),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTerminalStatus');
    }
  }

  async cancelCheckout(
    transactionId: string,
    _vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      // Get checkout first to find payment_id
      const checkoutResponse = await this.squareGet<SquareResponse<{ checkout: SquareTerminalCheckout }>>(
        `/v2/terminal/checkouts/${transactionId}`,
      );
      const checkout = (checkoutResponse as unknown as { checkout: SquareTerminalCheckout }).checkout;

      // If there's a payment, cancel it
      if (checkout?.payment_id) {
        await this.squarePost<SquareResponse<{ payment: SquarePayment }>>(
          `/v2/payments/${checkout.payment_id}/cancel`,
          {},
        );
      }

      return {
        success: true,
        data: {
          transactionId: checkout?.id ?? transactionId,
          vendorTransactionId: checkout?.id ?? transactionId,
          terminalId: '',
          vendorTerminalId: checkout?.device_options?.device_id ?? '',
          currency: checkout?.amount_money?.currency ?? this.defaultCurrency,
          amount: checkout?.amount_money?.amount ?? 0,
          status: TerminalTransactionStatus.Cancelled,
          createdAt: checkout?.created_at ?? new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'cancelCheckout');
    }
  }

  async captureTransaction(
    _request: CaptureRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    // Square Terminal Checkout payments are auto-captured.
    // Manual capture is not supported for terminal checkouts.
    return {
      success: false,
      error: 'Square Terminal Checkout payments are automatically captured. Manual capture is not supported.',
      timestamp: new Date().toISOString(),
    };
  }

  async refundTransaction(
    request: RefundRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const body: Record<string, unknown> = {
        idempotency_key: `staysuite-refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        payment_id: request.vendorTransactionId,
        amount_money: {
          amount: request.amount ?? 0, // 0 = full refund in Square
          currency: this.defaultCurrency,
        },
        reason: request.reason ?? 'Refund requested by customer',
      };

      // If amount is not specified, we need to fetch the payment first
      if (!request.amount) {
        const paymentResponse = await this.squareGet<SquareResponse<{ payment: SquarePayment }>>(
          `/v2/payments/${request.vendorTransactionId}`,
        );
        const payment = (paymentResponse as unknown as { payment: SquarePayment }).payment;
        if (payment) {
          body.amount_money = payment.amount_money;
        }
      }

      const response = await this.squarePost<SquareResponse<{ refund: SquareRefund }>>(
        '/v2/refunds',
        body,
      );

      const refund = (response as unknown as { refund: SquareRefund }).refund;

      return {
        success: true,
        data: {
          transactionId: refund.id,
          vendorTransactionId: refund.id,
          terminalId: '',
          vendorTerminalId: '',
          currency: refund.amount_money.currency,
          amount: refund.amount_money.amount,
          status: TerminalTransactionStatus.Refunded,
          description: `Refund: ${refund.reason ?? 'no reason'}`,
          createdAt: refund.created_at,
          completedAt: refund.created_at,
          vendorMetadata: {
            refundId: refund.id,
            originalPaymentId: refund.payment_id,
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
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.squarePost<SquareResponse<{ payment: SquarePayment }>>(
        `/v2/payments/${request.vendorTransactionId}/cancel`,
        {},
      );

      const payment = (response as unknown as { payment: SquarePayment }).payment;

      return {
        success: true,
        data: {
          transactionId: payment.id,
          vendorTransactionId: payment.id,
          terminalId: '',
          vendorTerminalId: '',
          currency: payment.amount_money.currency,
          amount: payment.amount_money.amount,
          status: TerminalTransactionStatus.Voided,
          description: `Voided: ${request.reason ?? 'no reason'}`,
          createdAt: payment.created_at,
          completedAt: new Date().toISOString(),
        },
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

      const response = await this.squareGet<SquareResponse<{ payment: SquarePayment }>>(
        `/v2/payments/${vendorTransactionId}`,
      );

      const payment = (response as unknown as { payment: SquarePayment }).payment;

      return {
        success: true,
        data: this.mapPaymentToTransaction(payment),
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

      const response = await this.squareGet<SquareResponse<{ payments: SquarePayment[] }>>(
        `/v2/payments?location_id=${this.locationId}&limit=${limit}`,
      );

      const payments = (response as unknown as { payments: SquarePayment[] }).payments ?? [];
      const items: TerminalTransaction[] = payments.map((payment) =>
        this.mapPaymentToTransaction(payment),
      );

      return {
        success: true,
        data: {
          items,
          nextCursor: payments.length >= limit ? String(limit) : null,
          hasMore: payments.length >= limit,
          total: items.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'listTerminalTransactions');
    }
  }

  async displayMessage(
    _request: DisplayMessageRequest,
  ): Promise<HardwareResult<void>> {
    // Square does not have a terminal display message API
    return {
      success: false,
      error: 'Square Terminal does not support arbitrary display messages.',
      timestamp: new Date().toISOString(),
    };
  }

  async storePaymentMethod(
    _terminalId: TerminalId,
    _vendorTerminalId: VendorTerminalId,
  ): Promise<HardwareResult<{ paymentToken: string }>> {
    // Square Terminal card on file requires the Square Point of Sale SDK
    return {
      success: false,
      error: 'Square Terminal card-on-file requires the Square POS SDK integration.',
      timestamp: new Date().toISOString(),
    };
  }

  async discoverTerminals(): Promise<HardwareResult<TerminalMetadata[]>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.squareGet<SquareResponse<{ devices: SquareDevice[] }>>(
        `/v2/devices?location_id=${this.locationId}`,
      );

      const devices = (response as unknown as { devices: SquareDevice[] }).devices ?? [];
      const terminals: TerminalMetadata[] = devices.map((device) =>
        this.mapDeviceToMetadata(device),
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

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.accessToken}`,
      'Square-Version': this.squareVersion,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async squareGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'square-terminal');
    }

    return (await response.json()) as T;
  }

  private async squarePost<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'square-terminal');
    }

    return (await response.json()) as T;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapDeviceToTerminalInfo(device: SquareDevice): TerminalInfo {
    return {
      id: device.id,
      vendorTerminalId: device.id,
      name: device.name,
      model: device.component?.device_code as string ?? 'Unknown',
      status: device.status,
      p2peEnabled: true,
    };
  }

  private mapDeviceToMetadata(device: SquareDevice): TerminalMetadata {
    let status = TerminalStatus.Unknown;
    if (device.status === 'ACTIVE') status = TerminalStatus.Idle;

    return {
      terminalId: device.id,
      vendorTerminalId: device.id,
      name: device.name,
      propertyId: this.propertyId,
      status,
      isConnected: device.status === 'ACTIVE',
      batteryLevel: null,
      deviceInfo: {
        model: (device.component?.device_code as string) ?? 'Square Terminal',
        manufacturer: 'Square',
      },
      lastSeenAt: device.created_at,
    };
  }

  private mapPaymentToTransaction(payment: SquarePayment): TerminalTransaction {
    let status = TerminalTransactionStatus.Pending;
    if (payment.status === 'COMPLETED') status = TerminalTransactionStatus.Captured;
    else if (payment.status === 'APPROVED') status = TerminalTransactionStatus.Authorized;
    else if (payment.status === 'CANCELED') status = TerminalTransactionStatus.Cancelled;
    else if (payment.status === 'FAILED') status = TerminalTransactionStatus.Failed;

    let paymentMethod: TerminalTransaction['paymentMethod'];
    if (payment.card_details?.card) {
      let type = PaymentMethodType.Other;
      const entry = payment.card_details.entry_method;
      if (entry === 'CONTACTLESS') type = PaymentMethodType.Contactless;
      else if (entry === 'CHIP') type = PaymentMethodType.ChipInsert;
      else if (entry === 'SWIPE') type = PaymentMethodType.Swipe;

      paymentMethod = {
        type,
        last4: payment.card_details.card.last_4,
        cardBrand: payment.card_details.card.card_brand,
      };
    }

    return {
      transactionId: payment.id,
      vendorTransactionId: payment.id,
      terminalId: '',
      vendorTerminalId: '',
      currency: payment.amount_money.currency,
      amount: payment.amount_money.amount,
      capturedAmount: status === TerminalTransactionStatus.Captured ? payment.amount_money.amount : undefined,
      status,
      paymentMethod,
      createdAt: payment.created_at,
      completedAt: status === TerminalTransactionStatus.Captured || status === TerminalTransactionStatus.Cancelled
        ? payment.created_at
        : undefined,
    };
  }

  private mapPaymentToTransactionInfo(payment: SquarePayment): TransactionInfo {
    return {
      id: payment.id,
      vendorTransactionId: payment.id,
      terminalId: '',
      amount: payment.amount_money.amount,
      currency: payment.amount_money.currency,
      cardType: payment.card_details?.card?.card_brand,
      cardLast4: payment.card_details?.card?.last_4,
      entryMethod: payment.card_details?.entry_method,
      transactionType: 'payment',
      status: payment.status,
      createdAt: payment.created_at,
    };
  }
}

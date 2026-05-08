/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * AdyenTerminalAdapter — Adyen POS Cloud API integration.
 *
 * Integrates with Adyen's /checkout/v67 API for terminal payments using
 * the Nexo/ISO 20022 format. Supports payment creation, capture, refund,
 * void, and terminal transaction queries.
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
// Adyen API response shapes
// ---------------------------------------------------------------------------

interface AdyenPaymentMethod {
  brands?: Array<{ brand: string; type?: string }>;
  name?: string;
  type: string;
}

interface AdyenPaymentResponse {
  pspReference: string;
  resultCode: string;
  amount?: { currency: string; value: number };
  merchantReference?: string;
  paymentMethod?: { brand?: string; type?: string };
  additionalData?: Record<string, unknown>;
  refusalReason?: string;
  refusalReasonCode?: string;
  authCode?: string;
  operations?: string[];
  saleToAcquirerData?: string;
}

interface AdyenPaymentDetailResponse extends AdyenPaymentResponse {
  paymentMethod?: {
    brand?: string;
    type?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    fundingSource?: string;
  };
}

interface AdyenRefundResponse {
  pspReference: string;
  originalReference: string;
  merchantReference: string;
  status: string;
  amount: { currency: string; value: number };
  resultCode: string;
}

interface AdyenCancelResponse {
  pspReference: string;
  originalReference: string;
  merchantReference: string;
  resultCode: string;
}

interface AdyenCaptureResponse {
  pspReference: string;
  originalReference: string;
  merchantReference: string;
  resultCode: string;
  amount?: { currency: string; value: number };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AdyenTerminalAdapter extends BaseTerminalAdapter {
  private baseUrl = 'https://checkout-test.adyen.com';
  private apiKey = '';
  private merchantAccountCode = '';
  private storeId = '';
  private poiId = '';
  private adyenVersion = 'v67';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'adyen-terminal',
      category: 'terminal',
      displayName: 'Adyen POS Cloud',
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

    this.merchantAccountCode = String(config.merchantAccountCode ?? '');
    this.storeId = String(config.storeId ?? '');
    this.poiId = String(config.poiId ?? '');

    if (config.environment === 'production') {
      this.baseUrl = 'https://checkout-live.adyen.com';
    }

    if (!this.merchantAccountCode) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Adyen Terminal adapter requires "merchantAccountCode" in config.',
        'adyen-terminal',
      );
    }

    if (!credentials.apiKey) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Adyen Terminal adapter requires "apiKey" credential.',
        'adyen-terminal',
      );
    }

    this.apiKey = String(credentials.apiKey);
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Verify API key by fetching available payment methods
      await this.adyenPost<AdyenPaymentMethod[]>(
        '/checkout/v67/paymentMethods',
        { merchantAccount: this.merchantAccountCode, countryCode: 'US', amount: { currency: 'USD', value: 0 } },
      );
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Adyen connection failed: ${msg}`,
        'adyen-terminal',
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
      await this.adyenPost<AdyenPaymentMethod[]>(
        '/checkout/v67/paymentMethods',
        { merchantAccount: this.merchantAccountCode, countryCode: 'US', amount: { currency: 'USD', value: 0 } },
      );
      const latencyMs = Date.now() - start;
      return {
        providerId: 'adyen-terminal',
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
        providerId: 'adyen-terminal',
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
    const signature = headers['adyen-signature'];
    if (!signature) return false;
    // Adyen uses HMAC-SHA256 with webhook credentials.
    // Basic presence and length check — full verification requires the webhook key.
    return signature.length > 10;
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Queries
  // -----------------------------------------------------------------------

  async listTerminals(
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<TerminalInfo>> {
    // Adyen does not have a dedicated list terminals endpoint via REST.
    // Terminal management is done via the Adyen Customer Area or API.
    return { items: [], nextCursor: null, hasMore: false };
  }

  async getTerminal(terminalId: string): Promise<HardwareResult<TerminalInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      return {
        success: true,
        data: {
          id: terminalId,
          vendorTerminalId: terminalId,
          name: terminalId,
          model: 'Adyen Terminal',
          serialNumber: terminalId,
          status: 'ACTIVE',
          p2peEnabled: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getTerminal');
    }
  }

  async listTransactions(
    _terminalId: string,
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<TransactionInfo>> {
    // Adyen /checkout API does not support listing by terminal directly.
    // Use /transactions API if available (requires additional endpoint).
    return { items: [], nextCursor: null, hasMore: false };
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Operations
  // -----------------------------------------------------------------------

  async createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<HardwareResult<CreateCheckoutResponse>> {
    try {
      await this.executeWithReconnect(async () => {});

      const vendorTerminalId = String(request.metadata?.vendorTerminalId ?? this.poiId ?? request.terminalId);

      // Build Nexo/ISO 20022 terminal payment request
      const saleToAcquirerData: Record<string, unknown> = {
        poiid: vendorTerminalId,
      };

      // Build SaleToPOI data (terminal-specific)
      const saleToPOI: Record<string, unknown> = {
        PaymentTransaction: {
          SaleToPOIRequest: {
            MessageHeader: {
              MessageType: 'Request',
              ServiceID: `staysuite-${Date.now()}`,
            },
            PaymentRequest: {
              SaleData: {
                TransactionID: request.correlationId ?? `txn-${Date.now()}`,
                SaleReferenceID: request.correlationId,
              },
              PaymentTransaction: {
                AmountsReq: {
                  Currency: request.currency,
                  RequestedAmount: String(request.amount / 100),
                },
              },
            },
          },
        },
      };

      const body: Record<string, unknown> = {
        amount: {
          currency: request.currency,
          value: request.amount,
        },
        countryCode: 'US',
        merchantAccount: this.merchantAccountCode,
        paymentMethod: {
          type: 'terminal',
        },
        reference: request.correlationId ?? `staysuite-${Date.now()}`,
        saleToAcquirerData: JSON.stringify(saleToAcquirerData),
        saleToPOI: JSON.stringify(saleToPOI),
        metadata: {},
      };

      if (request.description) body.description = request.description;
      if (request.bookingId) (body.metadata as Record<string, unknown>).bookingId = request.bookingId;
      if (request.metadata?.guestId) (body.metadata as Record<string, unknown>).guestId = request.metadata.guestId;
      if (request.metadata?.paymentId) (body.metadata as Record<string, unknown>).paymentId = request.metadata.paymentId;

      const response = await this.adyenPost<AdyenPaymentResponse>(
        '/checkout/v67/payments',
        body,
      );

      const resultCode = response.resultCode;

      return {
        success: true,
        data: {
          checkoutId: response.pspReference,
          terminalId: request.terminalId,
          amount: request.amount,
          currency: request.currency,
          status: this.mapAdyenResultCode(resultCode),
          vendorCheckoutId: response.pspReference,
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

      // Adyen doesn't have a dedicated terminal status endpoint via REST
      return {
        success: true,
        data: {
          terminalId,
          vendorTerminalId: terminalId,
          name: terminalId,
          propertyId: this.propertyId,
          status: TerminalStatus.Unknown,
          isConnected: true,
          batteryLevel: null,
          deviceInfo: {
            model: 'Adyen Terminal',
            manufacturer: 'Adyen',
          },
          lastSeenAt: new Date().toISOString(),
        },
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

      const body: Record<string, unknown> = {
        merchantAccount: this.merchantAccountCode,
        originalReference: vendorTransactionId,
      };

      const response = await this.adyenPost<AdyenCancelResponse>(
        `/checkout/v67/payments/${vendorTransactionId}/cancels`,
        body,
      );

      return {
        success: true,
        data: {
          transactionId: response.pspReference,
          vendorTransactionId: response.pspReference,
          terminalId: '',
          vendorTerminalId: '',
          currency: '',
          amount: 0,
          status: this.mapAdyenCancelResultCode(response.resultCode),
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          vendorMetadata: { originalReference: response.originalReference },
        },
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

      const body: Record<string, unknown> = {
        merchantAccount: this.merchantAccountCode,
        originalReference: request.vendorTransactionId,
      };

      if (request.amount != null) {
        body.modificationAmount = { value: request.amount, currency: '' };
      }

      const response = await this.adyenPost<AdyenCaptureResponse>(
        `/checkout/v67/payments/${request.vendorTransactionId}/captures`,
        body,
      );

      return {
        success: true,
        data: {
          transactionId: response.pspReference,
          vendorTransactionId: response.pspReference,
          terminalId: '',
          vendorTerminalId: '',
          currency: response.amount?.currency ?? '',
          amount: response.amount?.value ?? request.amount ?? 0,
          capturedAmount: response.amount?.value ?? request.amount ?? 0,
          status: response.resultCode === 'Received'
            ? TerminalTransactionStatus.Captured
            : TerminalTransactionStatus.Failed,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          vendorMetadata: { originalReference: response.originalReference },
        },
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

      const body: Record<string, unknown> = {
        merchantAccount: this.merchantAccountCode,
        originalReference: request.vendorTransactionId,
        reference: `refund-${Date.now()}`,
      };

      if (request.amount != null) {
        body.modificationAmount = { value: request.amount, currency: '' };
      }

      if (request.reason) {
        body.description = request.reason;
      }

      const response = await this.adyenPost<AdyenRefundResponse>(
        `/checkout/v67/payments/${request.vendorTransactionId}/refunds`,
        body,
      );

      return {
        success: true,
        data: {
          transactionId: response.pspReference,
          vendorTransactionId: response.pspReference,
          terminalId: '',
          vendorTerminalId: '',
          currency: response.amount.currency,
          amount: response.amount.value,
          status: response.resultCode === 'Received'
            ? TerminalTransactionStatus.Refunded
            : TerminalTransactionStatus.Failed,
          description: request.reason,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          vendorMetadata: {
            originalReference: response.originalReference,
            refundStatus: response.status,
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
    // Adyen uses cancel for voiding
    return this.cancelCheckout(request.transactionId, request.vendorTransactionId);
  }

  async getTransaction(
    _transactionId: string,
    vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.adyenGet<AdyenPaymentDetailResponse>(
        `/checkout/v67/payments/${vendorTransactionId}?merchantAccount=${this.merchantAccountCode}`,
      );

      return {
        success: true,
        data: this.mapAdyenPaymentToTransaction(response),
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

      const params = new URLSearchParams({
        merchantAccountCode: this.merchantAccountCode,
        limit: String(limit),
      });
      if (terminalId) params.set('poiId', terminalId);

      // Adyen's /transactions endpoint (if available via PAL)
      const response = await this.adyenGet<{ results: AdyenPaymentDetailResponse[] }>(
        `/checkout/v67/payments?${params.toString()}`,
      );

      const results = response.results ?? [];
      const items: TerminalTransaction[] = results.map((payment) =>
        this.mapAdyenPaymentToTransaction(payment),
      );

      return {
        success: true,
        data: {
          items,
          nextCursor: null,
          hasMore: false,
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
    // Adyen terminal display requires the synchronous Cloud API, not REST
    return {
      success: false,
      error: 'Adyen terminal display requires the synchronous Cloud API integration.',
      timestamp: new Date().toISOString(),
    };
  }

  async storePaymentMethod(
    _terminalId: TerminalId,
    _vendorTerminalId: VendorTerminalId,
  ): Promise<HardwareResult<{ paymentToken: string }>> {
    // Adyen tokenization for terminals uses the /storedPaymentMethods flow
    return {
      success: false,
      error: 'Adyen terminal tokenization requires the synchronous Cloud API with recurring processing model.',
      timestamp: new Date().toISOString(),
    };
  }

  async discoverTerminals(): Promise<HardwareResult<TerminalMetadata[]>> {
    // Adyen does not expose terminal discovery via REST
    return {
      success: false,
      error: 'Adyen terminal discovery is not available via REST. Use the Adyen Customer Area.',
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private get authHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async adyenGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'adyen-terminal');
    }

    return (await response.json()) as T;
  }

  private async adyenPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'adyen-terminal');
    }

    return (await response.json()) as T;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapAdyenResultCode(resultCode: string): string {
    const mapping: Record<string, string> = {
      'Authorised': 'captured',
      'Refused': 'declined',
      'Cancelled': 'cancelled',
      'Error': 'failed',
      'Received': 'pending',
      'PresentToShopper': 'pending',
    };
    return mapping[resultCode] ?? resultCode.toLowerCase();
  }

  private mapAdyenCancelResultCode(resultCode: string): TerminalTransactionStatus {
    const mapping: Record<string, TerminalTransactionStatus> = {
      'Received': TerminalTransactionStatus.Cancelled,
      'Authorised': TerminalTransactionStatus.Cancelled,
    };
    return mapping[resultCode] ?? TerminalTransactionStatus.Failed;
  }

  private mapAdyenPaymentToTransaction(payment: AdyenPaymentDetailResponse): TerminalTransaction {
    let status = TerminalTransactionStatus.Pending;
    if (payment.resultCode === 'Authorised') status = TerminalTransactionStatus.Captured;
    else if (payment.resultCode === 'Refused') status = TerminalTransactionStatus.Declined;
    else if (payment.resultCode === 'Cancelled') status = TerminalTransactionStatus.Cancelled;
    else if (payment.resultCode === 'Error') status = TerminalTransactionStatus.Failed;
    else if (payment.resultCode === 'Received') status = TerminalTransactionStatus.Pending;

    let paymentMethod: TerminalTransaction['paymentMethod'];
    if (payment.paymentMethod?.brand || payment.paymentMethod?.type) {
      let type = PaymentMethodType.Other;
      const brand = payment.paymentMethod.brand?.toLowerCase();
      if (brand === 'visa' || brand === 'mastercard' || brand === 'amex') {
        type = PaymentMethodType.CreditCard;
      }

      paymentMethod = {
        type,
        last4: payment.paymentMethod.lastFour,
        cardBrand: payment.paymentMethod.brand,
      };
    }

    return {
      transactionId: payment.pspReference,
      vendorTransactionId: payment.pspReference,
      terminalId: '',
      vendorTerminalId: '',
      currency: payment.amount?.currency ?? '',
      amount: payment.amount?.value ?? 0,
      capturedAmount: payment.amount?.value,
      status,
      paymentMethod,
      authorizationCode: payment.authCode,
      declineReason: payment.refusalReason,
      description: payment.merchantReference,
      createdAt: new Date().toISOString(),
      vendorMetadata: payment.additionalData,
    };
  }
}

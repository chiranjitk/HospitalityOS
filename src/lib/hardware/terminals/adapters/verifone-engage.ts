/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * VerifoneEngageAdapter — stub adapter for Verifone Engage terminals.
 *
 * Verifone Engage API requires partner registration at developer.verifone.com.
 * This adapter provides the interface contract and real metadata, with all
 * operations returning NOT_SUPPORTED until full integration is available.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
} from '../../types';
import { createHardwareError, HardwareErrorCode } from '../../errors';
import { BaseTerminalAdapter } from '../base-terminal-adapter';

// ---------------------------------------------------------------------------
// Stub message
// ---------------------------------------------------------------------------

const NOT_SUPPORTED_MESSAGE =
  'Verifone Engage API integration requires partner registration at developer.verifone.com. Contact StaySuite support.';

function stubNotSupported<T>(method: string): HardwareResult<T> {
  return {
    success: false,
    error: NOT_SUPPORTED_MESSAGE,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class VerifoneEngageAdapter extends BaseTerminalAdapter {
  private baseUrl = '';
  private merchantId = '';
  private terminalId = '';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'verifone-engage',
      category: 'terminal',
      displayName: 'Verifone Engage',
      version: '1.0.0',
      hasSimulation: false,
      supportsWebhooks: false,
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

    this.baseUrl = String(config.baseUrl ?? '');
    this.merchantId = String(config.merchantId ?? '');
    this.terminalId = String(config.terminalId ?? '');

    if (!this.baseUrl) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Verifone Engage adapter requires "baseUrl" in config.',
        'verifone-engage',
      );
    }

    if (!this.merchantId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Verifone Engage adapter requires "merchantId" in config.',
        'verifone-engage',
      );
    }

    if (!credentials.clientId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Verifone Engage adapter requires "clientId" credential.',
        'verifone-engage',
      );
    }

    if (!credentials.clientSecret) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Verifone Engage adapter requires "clientSecret" credential.',
        'verifone-engage',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    // Stub — mark as connected with a warning
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.connectionState = AdapterConnectionState.Connected;
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      providerId: 'verifone-engage',
      propertyId: this.propertyId,
      status: AdapterHealthStatus.Degraded,
      lastHealthyAt: null,
      lastCheckedAt: new Date().toISOString(),
      message: 'Verifone Engage API integration is a stub. All operations return NOT_SUPPORTED.',
      consecutiveFailures: 0,
      latencyMs: 0,
    };
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Operations (all NOT_SUPPORTED)
  // -----------------------------------------------------------------------

  override async createCheckout(
    _request: import('../../types').CreateCheckoutRequest,
  ): Promise<HardwareResult<import('../../types').CreateCheckoutResponse>> {
    return stubNotSupported('createCheckout');
  }

  override async listTerminals(
    _cursor?: string,
    _limit?: number,
  ): Promise<import('../../types').PaginatedResult<import('../terminal-provider').TerminalInfo>> {
    return { items: [], nextCursor: null, hasMore: false };
  }

  override async getTerminal(
    _terminalId: string,
  ): Promise<HardwareResult<import('../terminal-provider').TerminalInfo>> {
    return stubNotSupported('getTerminal');
  }

  override async listTransactions(
    _terminalId: string,
    _cursor?: string,
    _limit?: number,
  ): Promise<import('../../types').PaginatedResult<import('../terminal-provider').TransactionInfo>> {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // -----------------------------------------------------------------------
  // Extended methods (all NOT_SUPPORTED)
  // -----------------------------------------------------------------------

  override async getTerminalStatus(
    _terminalId: import('../types').TerminalId,
  ): Promise<HardwareResult<import('../types').TerminalMetadata>> {
    return stubNotSupported('getTerminalStatus');
  }

  override async cancelCheckout(
    _transactionId: string,
    _vendorTransactionId: string,
  ): Promise<HardwareResult<import('../types').TerminalTransaction>> {
    return stubNotSupported('cancelCheckout');
  }

  override async captureTransaction(
    _request: import('../types').CaptureRequest,
  ): Promise<HardwareResult<import('../types').TerminalTransaction>> {
    return stubNotSupported('captureTransaction');
  }

  override async refundTransaction(
    _request: import('../types').RefundRequest,
  ): Promise<HardwareResult<import('../types').TerminalTransaction>> {
    return stubNotSupported('refundTransaction');
  }

  override async voidTransaction(
    _request: import('../types').VoidRequest,
  ): Promise<HardwareResult<import('../types').TerminalTransaction>> {
    return stubNotSupported('voidTransaction');
  }

  override async getTransaction(
    _transactionId: string,
    _vendorTransactionId: string,
  ): Promise<HardwareResult<import('../types').TerminalTransaction>> {
    return stubNotSupported('getTransaction');
  }

  override async listTerminalTransactions(
    _terminalId: import('../types').TerminalId,
    _cursor?: string,
    _limit?: number,
  ): Promise<HardwareResult<import('../../types').PaginatedResult<import('../types').TerminalTransaction>>> {
    return stubNotSupported('listTerminalTransactions');
  }

  override async displayMessage(
    _request: import('../types').DisplayMessageRequest,
  ): Promise<HardwareResult<void>> {
    return stubNotSupported('displayMessage');
  }

  override async storePaymentMethod(
    _terminalId: import('../types').TerminalId,
    _vendorTerminalId: import('../types').VendorTerminalId,
  ): Promise<HardwareResult<{ paymentToken: string }>> {
    return stubNotSupported('storePaymentMethod');
  }

  override async discoverTerminals(): Promise<HardwareResult<import('../types').TerminalMetadata[]>> {
    return stubNotSupported('discoverTerminals');
  }

  override async registerTerminal(
    _registrationCode: string,
  ): Promise<HardwareResult<import('../types').TerminalMetadata>> {
    return stubNotSupported('registerTerminal');
  }
}

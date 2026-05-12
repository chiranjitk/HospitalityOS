/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * SimulatedTerminalProvider — fully functional in-memory terminal simulator.
 *
 * This is NOT a mock — it provides realistic behaviour including configurable
 * latency, failure injection, decline rates, and simulated payment processing.
 * Ideal for development, testing, and demos.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
  type HardwareAdapterFactory,
  type PaginatedResult,
  type CreateCheckoutRequest,
  type CreateCheckoutResponse,
} from '../../types';
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
// SimulatedTerminal
// ---------------------------------------------------------------------------

interface SimulatedTerminal {
  vendorTerminalId: string;
  name: string;
  status: TerminalStatus;
  propertyId: string;
  isConnected: boolean;
  batteryLevel: number;
  location?: string;
}

// ---------------------------------------------------------------------------
// Simulator config
// ---------------------------------------------------------------------------

interface SimulatorConfig {
  latencyMs?: number;
  failureRate?: number; // 0-1
  declineRate?: number; // 0-1
  seedTerminalCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `sim-txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldTrigger(rate: number): boolean {
  return Math.random() < rate;
}

// ---------------------------------------------------------------------------
// SimulatedTerminalProvider
// ---------------------------------------------------------------------------

export class SimulatedTerminalProvider extends BaseTerminalAdapter {
  private simConfig: Required<SimulatorConfig> = {
    latencyMs: 200,
    failureRate: 0,
    declineRate: 0.05,
    seedTerminalCount: 3,
  };

  private terminals = new Map<string, SimulatedTerminal>();
  private transactions = new Map<string, TerminalTransaction>();

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'simulator',
      category: 'terminal',
      displayName: 'StaySuite Terminal Simulator',
      version: '1.0.0',
      hasSimulation: true,
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

    if (config.configJson && typeof config.configJson === 'string') {
      try {
        const parsed = JSON.parse(config.configJson) as SimulatorConfig;
        if (parsed.latencyMs != null) this.simConfig.latencyMs = parsed.latencyMs;
        if (parsed.failureRate != null) this.simConfig.failureRate = parsed.failureRate;
        if (parsed.declineRate != null) this.simConfig.declineRate = parsed.declineRate;
        if (parsed.seedTerminalCount != null) this.simConfig.seedTerminalCount = parsed.seedTerminalCount;
      } catch {
        // Invalid JSON — use defaults
      }
    } else if (config.configJson && typeof config.configJson === 'object') {
      const parsed = config.configJson as unknown as SimulatorConfig;
      if (parsed.latencyMs != null) this.simConfig.latencyMs = parsed.latencyMs;
      if (parsed.failureRate != null) this.simConfig.failureRate = parsed.failureRate;
      if (parsed.declineRate != null) this.simConfig.declineRate = parsed.declineRate;
      if (parsed.seedTerminalCount != null) this.simConfig.seedTerminalCount = parsed.seedTerminalCount;
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;

    this.connectionState = AdapterConnectionState.Connecting;

    await this.simulateDelay();

    this.seedTerminals();

    this.connectionState = AdapterConnectionState.Connected;
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    await this.simulateDelay();
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    await this.simulateDelay(10, 50);
    const latencyMs = Date.now() - start;

    return {
      providerId: 'simulator',
      propertyId: this.propertyId,
      status: this.isConnected()
        ? AdapterHealthStatus.Healthy
        : AdapterHealthStatus.Disconnected,
      lastHealthyAt: this.isConnected() ? new Date().toISOString() : null,
      lastCheckedAt: new Date().toISOString(),
      message: null,
      consecutiveFailures: 0,
      latencyMs,
    };
  }

  // -----------------------------------------------------------------------
  // Seed
  // -----------------------------------------------------------------------

  private seedTerminals(): void {
    this.terminals.clear();
    this.transactions.clear();

    const defaults: Array<{ name: string; location: string }> = [
      { name: 'Front Desk Terminal', location: 'Lobby' },
      { name: 'Restaurant Terminal', location: 'Restaurant' },
      { name: 'Spa Terminal', location: 'Spa & Wellness' },
    ];

    const count = Math.min(this.simConfig.seedTerminalCount, 10);

    for (let i = 0; i < count; i++) {
      const def = defaults[i % defaults.length];
      const suffix = count > defaults.length ? ` #${i + 1}` : '';
      const vendorTerminalId = `SIM-TERM-${String(i + 1).padStart(4, '0')}`;
      const batteryLevel = randomBetween(65, 100);

      this.terminals.set(vendorTerminalId, {
        vendorTerminalId,
        name: `${def.name}${suffix}`,
        status: TerminalStatus.Idle,
        propertyId: this.propertyId || 'prop-sim-1',
        isConnected: true,
        batteryLevel,
        location: def.location,
      });
    }
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Queries
  // -----------------------------------------------------------------------

  async listTerminals(
    _cursor?: string,
    limit: number = 50,
  ): Promise<PaginatedResult<TerminalInfo>> {
    const allTerminals = Array.from(this.terminals.values());
    const items: TerminalInfo[] = allTerminals.map((st) => this.toTerminalInfo(st));
    const sliced = items.slice(0, limit);
    return {
      items: sliced,
      nextCursor: items.length > limit ? String(limit) : null,
      hasMore: items.length > limit,
      total: allTerminals.length,
    };
  }

  async getTerminal(terminalId: string): Promise<HardwareResult<TerminalInfo>> {
    try {
      const simTerminal = this.findTerminal(terminalId);
      if (!simTerminal) {
        return {
          success: false,
          error: `Terminal "${terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: this.toTerminalInfo(simTerminal),
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
    const simTerminal = this.findTerminal(terminalId);
    if (!simTerminal) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const allTxns = Array.from(this.transactions.values())
      .filter((t) => t.terminalId === terminalId || t.vendorTerminalId === terminalId)
      .map((t) => this.toTransactionInfo(t))
      .slice(0, limit);

    return {
      items: allTxns,
      nextCursor: null,
      hasMore: false,
      total: allTxns.length,
    };
  }

  // -----------------------------------------------------------------------
  // ITerminalProvider — Operations
  // -----------------------------------------------------------------------

  async createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<HardwareResult<CreateCheckoutResponse>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      if (shouldTrigger(this.simConfig.failureRate)) {
        return {
          success: false,
          error: 'Simulated vendor failure.',
          timestamp: new Date().toISOString(),
        };
      }

      const simTerminal = this.findTerminal(request.terminalId);
      if (!simTerminal) {
        return {
          success: false,
          error: `Terminal "${request.terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      if (!simTerminal.isConnected) {
        return {
          success: false,
          error: `Terminal "${request.terminalId}" is offline.`,
          timestamp: new Date().toISOString(),
        };
      }

      // Set terminal to processing
      simTerminal.status = TerminalStatus.WaitingForPayment;

      const transactionId = generateId();
      const vendorCheckoutId = `sim-chk-${Date.now()}`;
      const createdAt = new Date().toISOString();

      // Create pending transaction
      const isDeclined = shouldTrigger(this.simConfig.declineRate);
      const vendorTerminalId = String(request.metadata?.vendorTerminalId ?? request.terminalId);

      const txn: TerminalTransaction = {
        transactionId,
        vendorTransactionId: vendorCheckoutId,
        terminalId: request.terminalId,
        vendorTerminalId,
        currency: request.currency,
        amount: request.amount,
        status: isDeclined ? TerminalTransactionStatus.Declined : TerminalTransactionStatus.Captured,
        paymentMethod: isDeclined
          ? undefined
          : {
              type: PaymentMethodType.Contactless,
              last4: '4242',
              cardBrand: 'visa',
              paymentToken: `pm_sim_${Date.now()}`,
            },
        bookingId: request.bookingId,
        guestId: request.metadata?.guestId as string | undefined,
        paymentId: request.metadata?.paymentId as string | undefined,
        description: request.description,
        authorizationCode: isDeclined ? undefined : `AUTH-${randomBetween(100000, 999999)}`,
        declineReason: isDeclined ? 'Simulated decline' : undefined,
        capturedAmount: isDeclined ? undefined : request.amount,
        createdAt,
        completedAt: new Date().toISOString(),
      };

      // Simulate 3-second payment delay
      await new Promise((resolve) => setTimeout(resolve, Math.min(this.simConfig.latencyMs, 3000)));

      simTerminal.status = TerminalStatus.Idle;

      this.transactions.set(transactionId, txn);

      const response: CreateCheckoutResponse = {
        checkoutId: transactionId,
        terminalId: request.terminalId,
        amount: request.amount,
        currency: request.currency,
        status: isDeclined ? 'declined' : 'succeeded',
        vendorCheckoutId,
        timestamp: new Date().toISOString(),
      };

      return { success: true, data: response, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'createCheckout');
    }
  }

  // -----------------------------------------------------------------------
  // Extended terminal-domain methods
  // -----------------------------------------------------------------------

  async getTerminalStatus(terminalId: TerminalId): Promise<HardwareResult<TerminalMetadata>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const simTerminal = this.findTerminal(terminalId);
      if (!simTerminal) {
        return {
          success: false,
          error: `Terminal "${terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: this.toTerminalMetadata(simTerminal),
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const txn = this.findTransaction(vendorTransactionId);
      if (!txn) {
        return {
          success: false,
          error: `Transaction "${vendorTransactionId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      if (
        txn.status !== TerminalTransactionStatus.Pending
        && txn.status !== TerminalTransactionStatus.Authorized
      ) {
        return {
          success: false,
          error: `Transaction "${vendorTransactionId}" cannot be cancelled (status: ${txn.status}).`,
          timestamp: new Date().toISOString(),
        };
      }

      txn.status = TerminalTransactionStatus.Cancelled;
      txn.completedAt = new Date().toISOString();

      return { success: true, data: txn, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'cancelCheckout');
    }
  }

  async captureTransaction(
    request: CaptureRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const txn = this.findTransaction(request.vendorTransactionId);
      if (!txn) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      if (txn.status !== TerminalTransactionStatus.Authorized) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" cannot be captured (status: ${txn.status}).`,
          timestamp: new Date().toISOString(),
        };
      }

      const captureAmount = request.amount ?? txn.amount;
      txn.status = TerminalTransactionStatus.Captured;
      txn.capturedAmount = captureAmount;
      txn.completedAt = new Date().toISOString();

      return { success: true, data: txn, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'captureTransaction');
    }
  }

  async refundTransaction(
    request: RefundRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      if (shouldTrigger(this.simConfig.failureRate)) {
        return {
          success: false,
          error: 'Simulated vendor failure during refund.',
          timestamp: new Date().toISOString(),
        };
      }

      const originalTxn = this.findTransaction(request.vendorTransactionId);
      if (!originalTxn) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      if (originalTxn.status !== TerminalTransactionStatus.Captured) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" cannot be refunded (status: ${originalTxn.status}).`,
          timestamp: new Date().toISOString(),
        };
      }

      const refundAmount = request.amount ?? originalTxn.amount;
      const refundTxnId = generateId();

      const refundTxn: TerminalTransaction = {
        transactionId: refundTxnId,
        vendorTransactionId: `sim-ref-${Date.now()}`,
        terminalId: originalTxn.terminalId,
        vendorTerminalId: originalTxn.vendorTerminalId,
        currency: originalTxn.currency,
        amount: refundAmount,
        status: TerminalTransactionStatus.Refunded,
        paymentMethod: originalTxn.paymentMethod,
        bookingId: originalTxn.bookingId,
        guestId: originalTxn.guestId,
        paymentId: originalTxn.paymentId,
        description: `Refund: ${request.reason ?? 'Customer refund'}`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        vendorMetadata: {
          originalTransactionId: originalTxn.transactionId,
          refundReason: request.reason,
        },
      };

      this.transactions.set(refundTxnId, refundTxn);

      return { success: true, data: refundTxn, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'refundTransaction');
    }
  }

  async voidTransaction(
    request: VoidRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const txn = this.findTransaction(request.vendorTransactionId);
      if (!txn) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      if (
        txn.status !== TerminalTransactionStatus.Pending
        && txn.status !== TerminalTransactionStatus.Authorized
      ) {
        return {
          success: false,
          error: `Transaction "${request.vendorTransactionId}" cannot be voided (status: ${txn.status}).`,
          timestamp: new Date().toISOString(),
        };
      }

      txn.status = TerminalTransactionStatus.Voided;
      txn.completedAt = new Date().toISOString();
      txn.description = `Voided: ${request.reason ?? 'No reason provided'}`;

      return { success: true, data: txn, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'voidTransaction');
    }
  }

  async getTransaction(
    _transactionId: string,
    vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const txn = this.findTransaction(vendorTransactionId);
      if (!txn) {
        return {
          success: false,
          error: `Transaction "${vendorTransactionId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      return { success: true, data: txn, timestamp: new Date().toISOString() };
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const allTxns = Array.from(this.transactions.values())
        .filter(
          (t) => t.terminalId === terminalId || t.vendorTerminalId === terminalId,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      const sliced = allTxns.slice(0, limit);

      return {
        success: true,
        data: {
          items: sliced,
          nextCursor: sliced.length < allTxns.length ? String(limit) : null,
          hasMore: sliced.length < allTxns.length,
          total: allTxns.length,
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const simTerminal = this.findTerminal(request.terminalId);
      if (!simTerminal) {
        return {
          success: false,
          error: `Terminal "${request.terminalId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      // No-op — just acknowledge the message
      const duration = request.durationSeconds ?? 5;
      void duration;

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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      return {
        success: true,
        data: {
          paymentToken: `pm_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'storePaymentMethod');
    }
  }

  async discoverTerminals(): Promise<HardwareResult<TerminalMetadata[]>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const terminals: TerminalMetadata[] = Array.from(this.terminals.values()).map(
        (st) => this.toTerminalMetadata(st),
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
  // Helpers
  // -----------------------------------------------------------------------

  private findTerminal(terminalId: string): SimulatedTerminal | null {
    const byVendor = this.terminals.get(terminalId);
    if (byVendor) return byVendor;

    return Array.from(this.terminals.values()).find(
      (t) => t.name === terminalId || t.vendorTerminalId === terminalId,
    ) ?? null;
  }

  private findTransaction(vendorTransactionId: string): TerminalTransaction | null {
    return Array.from(this.transactions.values()).find(
      (t) => t.transactionId === vendorTransactionId || t.vendorTransactionId === vendorTransactionId,
    ) ?? null;
  }

  private toTerminalInfo(simTerminal: SimulatedTerminal): TerminalInfo {
    return {
      id: simTerminal.vendorTerminalId,
      vendorTerminalId: simTerminal.vendorTerminalId,
      name: simTerminal.name,
      model: 'StaySuite Simulated Reader',
      serialNumber: `SN-${simTerminal.vendorTerminalId}`,
      status: simTerminal.status,
      p2peEnabled: true,
      lastTransactionAt: new Date().toISOString(),
    };
  }

  private toTerminalMetadata(simTerminal: SimulatedTerminal): TerminalMetadata {
    return {
      terminalId: simTerminal.vendorTerminalId,
      vendorTerminalId: simTerminal.vendorTerminalId,
      name: simTerminal.name,
      location: simTerminal.location,
      propertyId: simTerminal.propertyId,
      status: simTerminal.status,
      isConnected: simTerminal.isConnected,
      batteryLevel: simTerminal.batteryLevel,
      paperLevel: randomBetween(30, 100),
      serialNumber: `SN-${simTerminal.vendorTerminalId}`,
      deviceInfo: {
        model: 'StaySuite Simulated Reader',
        firmwareVersion: '1.0.0',
        manufacturer: 'StaySuite',
      },
      lastSeenAt: new Date().toISOString(),
    };
  }

  private toTransactionInfo(txn: TerminalTransaction): TransactionInfo {
    return {
      id: txn.transactionId,
      vendorTransactionId: txn.vendorTransactionId,
      terminalId: txn.terminalId,
      amount: txn.amount,
      currency: txn.currency,
      cardType: txn.paymentMethod?.cardBrand,
      cardLast4: txn.paymentMethod?.last4,
      entryMethod: txn.paymentMethod?.type,
      transactionType: txn.status === TerminalTransactionStatus.Refunded ? 'refund' : 'payment',
      status: txn.status,
      authCode: txn.authorizationCode,
      createdAt: txn.createdAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createSimulatedTerminalProvider: HardwareAdapterFactory<SimulatedTerminalProvider> = (
  config,
  credentials,
) => {
  const provider = new SimulatedTerminalProvider();
  void provider.initialize(config, credentials);
  return provider;
};

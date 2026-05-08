/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * ITerminalProvider — contract that every terminal adapter must satisfy.
 *
 * This module will be expanded by the terminal adapter implementation agent.
 */

import type {
  IHardwareAdapter,
  HardwareAdapterConfig,
  HardwareAdapterCredentials,
  HardwareResult,
  AdapterHealthStatus,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  PaginatedResult,
} from '../types';

export interface TerminalInfo {
  id: string;
  vendorTerminalId?: string;
  name: string;
  model?: string;
  serialNumber?: string;
  status: string;
  p2peEnabled: boolean;
  lastTransactionAt?: string;
}

export interface TransactionInfo {
  id: string;
  vendorTransactionId?: string;
  terminalId: string;
  amount: number;
  currency: string;
  cardType?: string;
  cardLast4?: string;
  entryMethod?: string;
  transactionType: string;
  status: string;
  authCode?: string;
  reference?: string;
  createdAt: string;
}

export interface ITerminalProvider extends IHardwareAdapter {
  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  /** Initialise with the given configuration. */
  initialize(config: HardwareAdapterConfig, credentials: HardwareAdapterCredentials): Promise<void>;

  /** Teardown and release resources. */
  destroy(): Promise<void>;

  // -------------------------------------------------------------------
  // Operations
  // -------------------------------------------------------------------

  /** Create a new payment checkout session on the terminal. */
  createCheckout(request: CreateCheckoutRequest): Promise<HardwareResult<CreateCheckoutResponse>>;

  // -------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------

  /** List all terminals for the property. */
  listTerminals(cursor?: string, limit?: number): Promise<PaginatedResult<TerminalInfo>>;

  /** Get details for a single terminal. */
  getTerminal(terminalId: string): Promise<HardwareResult<TerminalInfo>>;

  /** List transactions for a terminal. */
  listTransactions(
    terminalId: string,
    cursor?: string,
    limit?: number,
  ): Promise<PaginatedResult<TransactionInfo>>;

  /** Return an adapter-level health summary. */
  getAdapterHealth(): Promise<{
    status: AdapterHealthStatus;
    message?: string;
    terminals: { terminalId: string; status: AdapterHealthStatus }[];
  }>;
}

/**
 * Factory type used by the registry to instantiate terminal adapters.
 */
export type TerminalAdapterFactory = (
  config: HardwareAdapterConfig,
  credentials: HardwareAdapterCredentials,
) => ITerminalProvider;

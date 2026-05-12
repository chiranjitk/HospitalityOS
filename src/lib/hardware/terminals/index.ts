/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Terminal adapters barrel export.
 */

// Terminal-specific domain types
export {
  TerminalStatus,
  TerminalTransactionStatus,
  PaymentMethodType,
  type TerminalId,
  type VendorTerminalId,
  type TerminalMetadata,
  type TerminalTransaction,
  type CreateCheckoutRequest,
  type CreateCheckoutResponse,
  type RefundRequest,
  type VoidRequest,
  type CaptureRequest,
  type DisplayMessageRequest,
} from './types';

// ITerminalProvider interface
export {
  type ITerminalProvider,
  type TerminalInfo,
  type TransactionInfo,
  type TerminalAdapterFactory,
} from './terminal-provider';

// Base adapter class
export { BaseTerminalAdapter } from './base-terminal-adapter';

// Adapter factory
export { createTerminalAdapter, terminalAdapterFactoryMap } from './adapters/index';

// Individual adapters (available for direct import when needed)
export { SimulatedTerminalProvider, createSimulatedTerminalProvider } from './adapters/simulator';
export { StripeTerminalAdapter } from './adapters/stripe-terminal';
export { SquareTerminalAdapter } from './adapters/square-terminal';
export { AdyenTerminalAdapter } from './adapters/adyen-terminal';
export { VerifoneEngageAdapter } from './adapters/verifone-engage';
export { IngenicoAdapter } from './adapters/ingenico';

/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Terminal-specific domain types used across all terminal adapters.
 */

// ---------------------------------------------------------------------------
// ID type aliases
// ---------------------------------------------------------------------------

export type TerminalId = string;
export type VendorTerminalId = string;

// ---------------------------------------------------------------------------
// Terminal Status
// ---------------------------------------------------------------------------

export enum TerminalStatus {
  Idle = 'idle',
  WaitingForPayment = 'waiting_for_payment',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Offline = 'offline',
  Updating = 'updating',
  AttentionRequired = 'attention_required',
  Unknown = 'unknown',
}

// ---------------------------------------------------------------------------
// Terminal Metadata
// ---------------------------------------------------------------------------

export interface TerminalMetadata {
  terminalId: TerminalId;
  vendorTerminalId: VendorTerminalId;
  name: string;
  location?: string;
  propertyId: string;
  status: TerminalStatus;
  isConnected: boolean;
  batteryLevel: number | null;
  paperLevel?: number | null;
  serialNumber?: string;
  deviceInfo?: {
    model: string;
    firmwareVersion?: string;
    manufacturer?: string;
  };
  lastSeenAt: string | null; // ISO-8601
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Terminal Transaction Status
// ---------------------------------------------------------------------------

export enum TerminalTransactionStatus {
  Pending = 'pending',
  Authorized = 'authorized',
  Captured = 'captured',
  Voided = 'voided',
  Refunded = 'refunded',
  Declined = 'declined',
  Failed = 'failed',
  Cancelled = 'cancelled',
  TimedOut = 'timed_out',
}

// ---------------------------------------------------------------------------
// Payment Method Type
// ---------------------------------------------------------------------------

export enum PaymentMethodType {
  CreditCard = 'credit_card',
  DebitCard = 'debit_card',
  Contactless = 'contactless',
  ChipInsert = 'chip_insert',
  Swipe = 'swipe',
  QrCode = 'qr_code',
  StoredValue = 'stored_value',
  Cash = 'cash',
  Other = 'other',
}

// ---------------------------------------------------------------------------
// Terminal Transaction
// ---------------------------------------------------------------------------

export interface TerminalTransaction {
  transactionId: string;
  vendorTransactionId: string;
  terminalId: TerminalId;
  vendorTerminalId: VendorTerminalId;
  currency: string; // ISO 4217
  amount: number; // in cents
  capturedAmount?: number; // in cents
  status: TerminalTransactionStatus;
  paymentMethod?: {
    type: PaymentMethodType;
    last4?: string;
    cardBrand?: string;
    paymentToken?: string;
  };
  bookingId?: string;
  guestId?: string;
  paymentId?: string;
  description?: string;
  authorizationCode?: string;
  declineReason?: string;
  createdAt: string; // ISO-8601
  completedAt?: string; // ISO-8601
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Create Checkout
// ---------------------------------------------------------------------------

export interface CreateCheckoutRequest {
  terminalId: TerminalId;
  vendorTerminalId: VendorTerminalId;
  currency: string; // ISO 4217
  amount: number; // in cents
  description?: string;
  referenceId?: string;
  enableTipping?: boolean;
  tipAmounts?: number[];
  autoCapture?: boolean;
  metadata?: {
    bookingId?: string;
    guestId?: string;
    paymentId?: string;
  };
}

export interface CreateCheckoutResponse {
  transactionId: string;
  vendorCheckoutId: string;
  vendorTerminalId: VendorTerminalId;
  status: string;
  createdAt: string; // ISO-8601
  redirectUrl?: string;
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Refund / Void / Capture
// ---------------------------------------------------------------------------

export interface RefundRequest {
  transactionId: string;
  vendorTransactionId: string;
  amount?: number; // in cents — if omitted, full refund
  reason?: string;
}

export interface VoidRequest {
  transactionId: string;
  vendorTransactionId: string;
  reason?: string;
}

export interface CaptureRequest {
  transactionId: string;
  vendorTransactionId: string;
  amount?: number; // in cents — if omitted, full capture
}

// ---------------------------------------------------------------------------
// Display Message
// ---------------------------------------------------------------------------

export interface DisplayMessageRequest {
  terminalId: TerminalId;
  vendorTerminalId: VendorTerminalId;
  message: string;
  durationSeconds?: number;
}

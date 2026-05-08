/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Centralised error definitions and helpers.
 */

// ---------------------------------------------------------------------------
// Error Detail
// ---------------------------------------------------------------------------

export interface HardwareErrorDetail {
  code: HardwareErrorCode;
  message: string;
  providerId?: string;
  vendorError?: string;
  timestamp?: string; // ISO-8601 — filled by createHardwareError
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error Code Enum — grouped by category
// ---------------------------------------------------------------------------

export enum HardwareErrorCode {
  // -- Connection -----------------------------------------------------------
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  VENDOR_UNAVAILABLE = 'VENDOR_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // -- Client (caller) ------------------------------------------------------
  INVALID_CONFIG = 'INVALID_CONFIG',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // -- Adapter lifecycle ----------------------------------------------------
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  ADAPTER_NOT_READY = 'ADAPTER_NOT_READY',
  ADAPTER_NOT_REGISTERED = 'ADAPTER_NOT_REGISTERED',

  // -- Vendor-domain --------------------------------------------------------
  VENDOR_ERROR = 'VENDOR_ERROR',
  LOCK_JAMMED = 'LOCK_JAMMED',
  LOCK_BUSY = 'LOCK_BUSY',
  LOW_BATTERY = 'LOW_BATTERY',
  TERMINAL_BUSY = 'TERMINAL_BUSY',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CARD_EXPIRED = 'CARD_EXPIRED',

  // -- Timeout / Cancellation -----------------------------------------------
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',

  // -- Webhook --------------------------------------------------------------
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_PROCESSING_FAILED = 'WEBHOOK_PROCESSING_FAILED',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map an HTTP status code from a vendor response to a HardwareErrorCode and
 * produce a {@link HardwareErrorDetail}.
 */
export function mapHttpError(
  status: number,
  vendorMessage: string,
): HardwareErrorDetail {
  let code: HardwareErrorCode;
  let message: string;

  if (status === 401) {
    code = HardwareErrorCode.AUTH_FAILED;
    message = vendorMessage || 'Authentication with vendor failed.';
  } else if (status === 403) {
    code = HardwareErrorCode.AUTH_FAILED;
    message = vendorMessage || 'Insufficient permissions to perform this operation.';
  } else if (status === 404) {
    code = HardwareErrorCode.NOT_FOUND;
    message = vendorMessage || 'Requested resource not found at vendor.';
  } else if (status === 408 || status === 504) {
    code = HardwareErrorCode.CONNECTION_TIMEOUT;
    message = vendorMessage || 'Vendor request timed out.';
  } else if (status === 409) {
    code = HardwareErrorCode.ALREADY_EXISTS;
    message = vendorMessage || 'Resource already exists at vendor.';
  } else if (status === 422 || status === 400) {
    code = HardwareErrorCode.VALIDATION_ERROR;
    message = vendorMessage || 'Vendor rejected the request as invalid.';
  } else if (status === 429) {
    code = HardwareErrorCode.RATE_LIMITED;
    message = vendorMessage || 'Vendor rate-limit has been exceeded.';
  } else if (status >= 500) {
    code = HardwareErrorCode.VENDOR_UNAVAILABLE;
    message = vendorMessage || 'Vendor returned a server error.';
  } else {
    code = HardwareErrorCode.VENDOR_ERROR;
    message = vendorMessage || `Unexpected HTTP ${status} from vendor.`;
  }

  return createHardwareError(code, message);
}

/**
 * Convenience factory that stamps `timestamp` and returns a fully-formed
 * {@link HardwareErrorDetail}.
 */
export function createHardwareError(
  code: HardwareErrorCode,
  message: string,
  providerId?: string,
): HardwareErrorDetail {
  return {
    code,
    message,
    providerId,
    timestamp: new Date().toISOString(),
  };
}

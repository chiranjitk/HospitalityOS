/**
 * GDS (Global Distribution System) Protocol Adapter Types
 *
 * Type definitions for Amadeus, Sabre, and Travelport (Galileo/Worldspan)
 * integrations. Covers ARI (Availability, Rates, Inventory) push/pull,
 * booking retrieval by PNR, and connection management.
 */

// ============================================================
// PROVIDER TYPES
// ============================================================

/** Supported GDS providers */
export type GDSProvider = 'amadeus' | 'sabre' | 'travelport';

/** GDS connection lifecycle status */
export type GDSConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing' | 'pending';

/** Sync actions supported by GDS adapters */
export type GDSSyncAction =
  | 'inventory_push'    // Push ARI (Availability, Rates, Inventory) to GDS
  | 'rate_update'       // Update rate codes across GDS channels
  | 'booking_pull'       // Poll/receive booking notifications from GDS
  | 'full_sync';         // Full bidirectional sync

// ============================================================
// ARI (Availability, Rates, Inventory) TYPES
// ============================================================

/** Request structure for ARI (Availability, Rates, Inventory) operations */
export interface ARIRequest {
  propertyId: string;
  roomTypeId: string;
  rateCodeId: string;
  dateFrom: Date;
  dateTo: Date;
  daysOfWeek?: number[]; // 0=Sun .. 6=Sat
}

/** Single ARI update record — one room type × one rate code × one date */
export interface ARIUpdate {
  roomTypeId: string;
  rateCodeId: string;
  date: string; // YYYY-MM-DD
  availableRooms: number;
  rateAmount: number;
  currency: string;
  restrictions?: {
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

// ============================================================
// BOOKING TYPES
// ============================================================

/** A booking retrieved from or pushed to a GDS */
export interface GDSBooking {
  pnr: string;
  firstName: string;
  lastName: string;
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  rateCode: string;
  status: string;
  guestCount: number;
  specialRequests?: string;
  gdsSource: GDSProvider;
}

// ============================================================
// CONFIGURATION TYPES
// ============================================================

/** Connection configuration for a single GDS provider */
export interface GDSConfig {
  provider: GDSProvider;
  endpoint: string;
  pcc: string;       // Pseudo City Code (office identifier)
  username: string;
  password: string;
  officeId?: string;
  chainCode?: string;
  propertyCode: string;
}

/** Rate update payload */
export interface RateUpdate {
  rateCodeId: string;
  rateCode: string;
  roomTypeId: string;
  roomTypeCode: string;
  dates: {
    from: string;  // YYYY-MM-DD
    to: string;    // YYYY-MM-DD
  };
  amount: number;
  currency: string;
  restrictions?: {
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

// ============================================================
// RESPONSE / RESULT TYPES
// ============================================================

/** Result of a single sync operation against a GDS provider */
export interface GDSSyncResult {
  success: boolean;
  action: GDSSyncAction;
  provider: GDSProvider;
  recordsProcessed: number;
  errors: string[];
  warnings: string[];
  duration: number;
  timestamp: Date;
}

/** Connection test result */
export interface GDSTestResult {
  connected: boolean;
  latency: number;       // ms
  provider: GDSProvider;
  error?: string;
  pccVerified?: boolean;
  propertyCodeVerified?: boolean;
  endpointReachable?: boolean;
}

/** Availability check response */
export interface AvailabilityResponse {
  roomTypeCode: string;
  date: string;
  availableRooms: number;
  ratePlans: {
    rateCode: string;
    rateAmount: number;
    currency: string;
    restrictions?: {
      minStay: number;
      maxStay: number;
      closedToArrival: boolean;
      closedToDeparture: boolean;
    };
  }[];
}

/** GDS error details */
export interface GDSError {
  code: string;
  message: string;
  provider: GDSProvider;
  severity: 'error' | 'warning' | 'info';
  retryable: boolean;
  details?: string;
  soapFaultCode?: string;
}

// ============================================================
// SOAP ENVELOPE TYPES (for request/response logging)
// ============================================================

/** Parsed SOAP fault */
export interface SOAPFault {
  faultCode: string;
  faultString: string;
  detail?: string;
  provider: GDSProvider;
}

/** Raw request/response pair for audit logging */
export interface GDSRequestLog {
  timestamp: Date;
  provider: GDSProvider;
  action: string;
  requestXml?: string;
  responseXml?: string;
  statusCode?: number;
  durationMs: number;
  error?: string;
}

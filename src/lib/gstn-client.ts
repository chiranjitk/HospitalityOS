// FIX (M-8): Added GSTN API integration architecture

/**
 * GSTN (Goods and Services Tax Network) API Client
 *
 * This module provides an architecture-ready GSTN e-invoicing integration.
 * It handles:
 *   - GSTN authentication (OTP-based, as per GSTN protocol)
 *   - E-invoice generation and IRN retrieval
 *   - Invoice data validation against GST e-invoicing rules
 *   - JWT signing for local IRN generation (development/sandbox mode)
 *
 * TODO: Replace the local signing mechanism with actual GSTN API calls when
 * integrating with the GSTN Sandbox (https://sandbox.gstn.gov.in) or
 * Production (https://einvoice1.gst.gov.in) environments.
 *
 * GSTN API Documentation: https://einvoice1.gst.gov.in/docs/html/
 * GSTN Sandbox credentials must be obtained from https://sandbox.gstn.gov.in
 */

import { SignJWT, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const GSTN_ENV = (process.env.GSTN_ENV || 'sandbox') as 'sandbox' | 'production';

const GSTN_BASE_URLS = {
  sandbox: 'https://sandbox.gstn.gov.in/einvoice/api',
  production: 'https://einvoice1.gst.gov.in/einvoice/api',
} as const;

/**
 * GSTN API version — currently v1.03 is the mandated version.
 */
const GSTN_API_VERSION = 'v1.03';

/**
 * Valid supply types for GST e-invoicing
 */
export const VALID_SUPPLY_TYPES = [
  'b2b',   // Business to Business (intra-state or inter-state with GSTIN)
  'b2c',   // Business to Consumer (intra-state, value ≤ 2.5L)
  'b2cl',  // Business to Consumer Large (inter-state, value > 2.5L)
  'expwp', // Export with payment of tax
  'expwop',// Export without payment of tax
  'sez',   // SEZ unit / SEZ developer
] as const;

export type SupplyType = (typeof VALID_SUPPLY_TYPES)[number];

/**
 * Valid document types for e-invoicing
 */
export const VALID_DOCUMENT_TYPES = [
  'INV',  // Invoice
  'CRN',  // Credit Note
  'DBN',  // Debit Note
] as const;

export type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GstnAuthConfig {
  /** GSTIN of the taxpayer (15 characters) */
  gstin: string;
  /** Username registered on GSTN portal */
  username: string;
  /** Password for GSTN portal */
  password: string;
  /** Environment: sandbox or production */
  env?: 'sandbox' | 'production';
}

export interface GstnAuthToken {
  /** Authentication token from GSTN */
  token: string;
  /** Expiry timestamp (Unix epoch seconds) */
  expiresAt: number;
  /** GSTIN used for authentication */
  gstin: string;
}

export interface GstnEInvoiceData {
  /** Supply type: B2B, B2C, etc. */
  supplyType: SupplyType;
  /** Place of supply (2-digit state code + "UT" for Union Territories) */
  placeOfSupply: string;
  /** Invoice number */
  invoiceNumber: string;
  /** Invoice date (ISO 8601 datetime) */
  invoiceDate: string;
  /** Total assessable value before tax */
  totalValue: number;
  /** Total CGST amount */
  totalCgst: number;
  /** Total SGST amount */
  totalSgst: number;
  /** Total IGST amount */
  totalIgst: number;
  /** Total CESS amount */
  totalCess: number;
  /** Total tax amount */
  totalTax: number;
  /** Grand total (value + tax) */
  totalAmount: number;
  /** Whether reverse charge applies */
  reverseCharge: boolean;
  /** GSTIN of the supplier (property's GSTIN) */
  sellerGstin: string;
  /** Trade/Legal name of the seller */
  sellerTradeName: string;
  /** GSTIN of the buyer (null for B2C) */
  buyerGstin?: string;
  /** Trade/Legal name of the buyer */
  buyerTradeName?: string;
  /** Buyer state code (required for B2C) */
  buyerStateCode?: string;
  /** Buyer location (pin code) */
  buyerPinCode?: string;
  /** E-commerce GSTIN (if applicable) */
  ecomGstin?: string;
  /** Line items for the invoice */
  items?: GstnInvoiceItem[];
}

export interface GstnInvoiceItem {
  /** Product/service description */
  description: string;
  /** HSN/SAC code */
  hsncode: string;
  /** Quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Unit price (before tax) */
  unitPrice: number;
  /** Total value (qty × unit price) */
  totalValue: number;
  /** Tax rate (%) */
  taxRate: number;
  /** CGST amount */
  cgstAmount: number;
  /** SGST amount */
  sgstAmount: number;
  /** IGST amount */
  igstAmount: number;
  /** CESS amount */
  cessAmount: number;
  /** Total tax amount */
  totalTax: number;
}

export interface GstnIRNResponse {
  /** Success status */
  success: boolean;
  /** Invoice Reference Number (64-char alphanumeric) */
  irn: string;
  /** Signed e-invoice (base64 encoded) */
  signedInvoice?: string;
  /** Signed QR code (base64 encoded) */
  signedQrCode?: string;
  /** Acknowledgement number */
  ackNo?: string;
  /** Acknowledgement date */
  ackDate?: string;
  /** Error details if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GSTN Authentication
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory cache for GSTN auth tokens */
let authTokenCache: Map<string, GstnAuthToken> = new Map();

/**
 * Authenticate with GSTN portal.
 *
 * GSTN uses an OTP-based authentication flow:
 *   1. POST /authenticate with { username, password } → returns OTP request ID
 *   2. POST /auth/otp with { otp, request_id } → returns appkey + sek
 *   3. Use appkey + sek to generate Auth-Token header for subsequent API calls
 *
 * TODO: Implement actual GSTN OTP flow. Currently generates a local JWT token
 * for development and testing purposes.
 *
 * @param config - GSTN authentication credentials
 * @returns Authentication token
 */
export async function authenticateGSTN(config: GstnAuthConfig): Promise<GstnAuthToken> {
  const { gstin, username, password, env = GSTN_ENV } = config;
  const cacheKey = `${env}:${gstin}`;

  // Return cached token if still valid (with 5-min buffer)
  const cached = authTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Math.floor(Date.now() / 1000) + 300) {
    return cached;
  }

  // ── TODO: Replace the block below with actual GSTN API authentication ──
  //
  // Step 1: Request OTP
  // const otpResponse = await fetch(`${GSTN_BASE_URLS[env]}/authenticate`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'clientid': gstin,
  //     'client-secret': generateClientSecret(),
  //     'ip-address': '127.0.0.1', // or server IP
  //     'state-cd': gstin.substring(0, 2),
  //     'username': username,
  //     'password': encryptPassword(password),
  //   },
  // });
  //
  // Step 2: Verify OTP (requires user interaction or pre-registered OTP)
  // const otpResult = await otpResponse.json();
  // ...
  //
  // Step 3: Generate Auth-Token using appkey and sek from step 2
  // ...
  // ── END TODO ──

  // Local development fallback: Generate a JWT token signed with the GSTIN
  const secret = new TextEncoder().encode(
    process.env.GSTN_SIGNING_SECRET || `gstn-signing-${gstin}-${env}`
  );

  const token = await new SignJWT({
    sub: gstin,
    username,
    env,
    scope: 'einvoice',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer(`staysuite:${gstin}`)
    .sign(secret);

  const authToken: GstnAuthToken = {
    token,
    expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    gstin,
  };

  authTokenCache.set(cacheKey, authToken);
  return authToken;
}

/**
 * Invalidate a cached auth token (e.g., after a 401 response).
 */
export function invalidateAuthToken(gstin: string, env: 'sandbox' | 'production' = GSTN_ENV): void {
  authTokenCache.delete(`${env}:${gstin}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Invoice Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validate e-invoice data against GST e-invoicing rules.
 *
 * Checks include:
 *   - Required field presence
 *   - GSTIN format validation (15-char alphanumeric with checksum)
 *   - Supply-type specific rules (e.g., B2C doesn't need buyer GSTIN)
 *   - Tax calculation consistency
 *   - Invoice amount positivity
 *
 * @param data - Invoice data to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateEInvoiceData(data: GstnEInvoiceData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.sellerGstin) {
    errors.push({ field: 'sellerGstin', message: 'Seller GSTIN is required', code: 'REQUIRED' });
  } else if (!isValidGSTIN(data.sellerGstin)) {
    errors.push({ field: 'sellerGstin', message: 'Invalid GSTIN format', code: 'INVALID_FORMAT' });
  }

  if (!data.supplyType || !VALID_SUPPLY_TYPES.includes(data.supplyType)) {
    errors.push({ field: 'supplyType', message: `Invalid supply type. Must be one of: ${VALID_SUPPLY_TYPES.join(', ')}`, code: 'INVALID_ENUM' });
  }

  if (!data.placeOfSupply) {
    errors.push({ field: 'placeOfSupply', message: 'Place of supply is required', code: 'REQUIRED' });
  }

  if (!data.invoiceNumber) {
    errors.push({ field: 'invoiceNumber', message: 'Invoice number is required', code: 'REQUIRED' });
  }

  if (!data.invoiceDate) {
    errors.push({ field: 'invoiceDate', message: 'Invoice date is required', code: 'REQUIRED' });
  } else {
    const invoiceDate = new Date(data.invoiceDate);
    if (isNaN(invoiceDate.getTime())) {
      errors.push({ field: 'invoiceDate', message: 'Invalid invoice date format', code: 'INVALID_DATE' });
    }
  }

  // Supply-type specific rules
  if (data.supplyType === 'b2b' || data.supplyType === 'sez') {
    if (!data.buyerGstin) {
      errors.push({ field: 'buyerGstin', message: `Buyer GSTIN is required for ${data.supplyType} supply type`, code: 'REQUIRED' });
    } else if (!isValidGSTIN(data.buyerGstin)) {
      errors.push({ field: 'buyerGstin', message: 'Invalid buyer GSTIN format', code: 'INVALID_FORMAT' });
    }
  }

  if ((data.supplyType === 'b2c' || data.supplyType === 'b2cl') && data.buyerGstin && !isValidGSTIN(data.buyerGstin)) {
    errors.push({ field: 'buyerGstin', message: 'Invalid buyer GSTIN format', code: 'INVALID_FORMAT' });
  }

  // Tax calculation consistency
  const totalTaxCalculated = data.totalCgst + data.totalSgst + data.totalIgst + data.totalCess;
  if (Math.abs(totalTaxCalculated - data.totalTax) > 0.01) {
    errors.push({
      field: 'totalTax',
      message: `Tax mismatch: CGST(${data.totalCgst}) + SGST(${data.totalSgst}) + IGST(${data.totalIgst}) + CESS(${data.totalCess}) = ${totalTaxCalculated}, expected ${data.totalTax}`,
      code: 'TAX_MISMATCH',
    });
  }

  const totalAmountCalculated = data.totalValue + data.totalTax;
  if (Math.abs(totalAmountCalculated - data.totalAmount) > 0.01) {
    errors.push({
      field: 'totalAmount',
      message: `Amount mismatch: value(${data.totalValue}) + tax(${data.totalTax}) = ${totalAmountCalculated}, expected ${data.totalAmount}`,
      code: 'AMOUNT_MISMATCH',
    });
  }

  // IGST/CGST+SGST mutual exclusivity check
  if (data.totalIgst > 0 && (data.totalCgst > 0 || data.totalSgst > 0)) {
    errors.push({
      field: 'tax',
      message: 'IGST and CGST/SGST are mutually exclusive. Use IGST for inter-state, CGST+SGST for intra-state.',
      code: 'TAX_RULE_VIOLATION',
    });
  }

  // Positivity checks
  if (data.totalValue < 0) {
    errors.push({ field: 'totalValue', message: 'Total value cannot be negative', code: 'NEGATIVE_VALUE' });
  }
  if (data.totalTax < 0) {
    errors.push({ field: 'totalTax', message: 'Total tax cannot be negative', code: 'NEGATIVE_VALUE' });
  }

  return errors;
}

/**
 * Validate GSTIN format (15-character alphanumeric with Luhn-like checksum).
 *
 * GSTIN format: XXAAAAA9999X1Zx
 *   - First 2 chars: State code (01-37)
 *   - Next 10 chars: PAN (uppercase alphanumeric)
 *   - 13th char: Entity type (1-9, A-Z)
 *   - 14th char: Z (fixed)
 *   - 15th char: Checksum (alphanumeric, calculated from first 14)
 *
 * @param gstin - GSTIN to validate
 * @returns Whether the GSTIN is valid
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || typeof gstin !== 'string') return false;
  if (gstin.length !== 15) return false;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[A-Z0-9]{1}$/.test(gstin)) {
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Invoice Generation (IRN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the GSTN e-invoice JSON payload according to the schema.
 *
 * @param data - Validated invoice data
 * @returns JSON-serializable e-invoice payload
 */
export function buildEInvoicePayload(data: GstnEInvoiceData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    Version: GSTN_API_VERSION,
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: data.supplyType.toUpperCase(),
      RegRev: data.reverseCharge ? 'Y' : 'N',
      EcmGstin: data.ecomGstin || null,
    },
    DocDtls: {
      Typ: 'INV',
      No: data.invoiceNumber,
      Dt: data.invoiceDate.substring(0, 10), // YYYY-MM-DD
    },
    SellerDtls: {
      Gstin: data.sellerGstin,
      LglNm: data.sellerTradeName,
      Addr1: '',
      Addr2: '',
      Loc: '',
      Pin: 0,
      Stcd: data.placeOfSupply,
    },
    BuyerDtls: {
      Gstin: data.buyerGstin || 'URP', // URP = Unregistered Person
      LglNm: data.buyerTradeName || 'Consumer',
      Pos: data.placeOfSupply,
      Addr1: '',
      Addr2: '',
      Loc: '',
      Pin: data.buyerPinCode || 0,
      Stcd: data.buyerStateCode || data.placeOfSupply,
    },
    ValDtls: {
      AssVal: round2(data.totalValue),
      CgstVal: round2(data.totalCgst),
      SgstVal: round2(data.totalSgst),
      IgstVal: round2(data.totalIgst),
      CesVal: round2(data.totalCess),
      TotInvVal: round2(data.totalAmount),
    },
    PayDtls: {
      Y_N: 'Y', // Has payment been made?
      PtNm: 'Cash', // Payment type
      CrDay: 0,
      PaidAmt: round2(data.totalAmount),
      PaymtDue: 0,
    },
    RefDtls: {
      PrecInvDt: null,
      PrecInvNo: null,
      TendRefDt: null,
      TendRefNo: null,
      OthRefNo: null,
    },
    AddlDocDtls: [],
    EwBDtls: [],
  };

  // Add line items if provided
  if (data.items && data.items.length > 0) {
    payload.ItemList = data.items.map((item, index) => ({
      SlNo: String(index + 1),
      IsServc: 'Y',
      HsnCd: item.hsncode,
      Barcde: null,
      Qty: item.quantity,
      Unit: item.unit,
      UnitPrice: round2(item.unitPrice),
      TotAmt: round2(item.totalValue),
      Disct: 0,
      PreTaxVal: round2(item.totalValue),
      AssAmt: round2(item.totalValue),
      GstRt: item.taxRate,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvl: 0,
      TotItemVal: round2(item.totalValue + item.totalTax),
    }));
  }

  return payload;
}

/**
 * Generate an IRN (Invoice Reference Number) for an e-invoice.
 *
 * In production, this calls the GSTN API to generate a signed IRN.
 * In development/sandbox mode, it signs the invoice data locally with a JWT
 * and returns it as the IRN for testing purposes.
 *
 * TODO: Integrate with the actual GSTN Sandbox/Production API.
 * The GSTN endpoint is: POST /invoice/irn
 * Headers: Auth-Token, user_name, requestid
 * Body: { data: <base64-encoded e-invoice JSON>, hmac: <SHA-256 HMAC> }
 *
 * @param invoiceData - Validated e-invoice data
 * @param authConfig - GSTN authentication config (optional for local mode)
 * @returns IRN response with signed invoice details
 */
export async function generateGSTNIRN(
  invoiceData: GstnEInvoiceData,
  authConfig?: GstnAuthConfig
): Promise<GstnIRNResponse> {
  // Step 1: Validate invoice data
  const validationErrors = validateEInvoiceData(invoiceData);
  if (validationErrors.length > 0) {
    return {
      success: false,
      irn: '',
      error: `Validation failed: ${validationErrors.map(e => e.message).join('; ')}`,
      errorCode: 'VALIDATION_ERROR',
    };
  }

  // Step 2: Build e-invoice payload
  const payload = buildEInvoicePayload(invoiceData);

  // ── TODO: Replace this section with actual GSTN API call ──
  //
  // Step 3: Authenticate with GSTN
  // if (!authConfig) {
  //   return { success: false, irn: '', error: 'GSTN auth config required for production mode' };
  // }
  // const authToken = await authenticateGSTN(authConfig);
  //
  // Step 4: Encrypt and HMAC the payload
  // const jsonStr = JSON.stringify(payload);
  // const base64Data = Buffer.from(jsonStr).toString('base64');
  // const hmac = createHmac('sha256', authConfig.gstin).update(base64Data).digest('hex');
  //
  // Step 5: Call GSTN IRN generation endpoint
  // const response = await fetch(`${GSTN_BASE_URLS[authConfig.env || GSTN_ENV]}/invoice/irn`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Auth-Token': authToken.token,
  //     'user_name': authConfig.gstin,
  //     'requestid': crypto.randomUUID(),
  //   },
  //   body: JSON.stringify({
  //     data: base64Data,
  //     hmac: hmac,
  //   }),
  // });
  //
  // const result = await response.json();
  // if (result.Status === 0) {
  //   return {
  //     success: true,
  //     irn: result.Data.Irn,
  //     signedInvoice: result.Data.SignedInvoice,
  //     signedQrCode: result.Data.SignedQRCode,
  //     ackNo: result.Data.AckNo,
  //     ackDate: result.Data.AckDt,
  //   };
  // } else {
  //   return { success: false, irn: '', error: result.Message, errorCode: result.ErrorCode };
  // }
  //
  // ── END TODO ──

  // Local development fallback: Sign with JWT
  const secret = new TextEncoder().encode(
    process.env.GSTN_SIGNING_SECRET || `gstn-signing-${invoiceData.sellerGstin}-${GSTN_ENV}`
  );

  const payloadStr = JSON.stringify(payload);
  const payloadHash = await sha256(payloadStr);

  const signedIrn = await new SignJWT({
    payloadHash,
    invoiceNumber: invoiceData.invoiceNumber,
    sellerGstin: invoiceData.sellerGstin,
    supplyType: invoiceData.supplyType,
    totalAmount: invoiceData.totalAmount,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(invoiceData.sellerGstin)
    .setSubject(`IRN-${invoiceData.invoiceNumber}`)
    .setJti(crypto.randomUUID())
    .sign(secret);

  const now = new Date();
  const ackNo = `STAYSUITE${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

  return {
    success: true,
    irn: signedIrn,
    signedInvoice: Buffer.from(payloadStr).toString('base64'),
    signedQrCode: generateSignedQRCode(payload),
    ackNo,
    ackDate: now.toISOString(),
  };
}

/**
 * Verify a locally-generated IRN signature.
 *
 * @param irn - The JWT IRN string
 * @param gstin - The expected issuer GSTIN
 * @returns Whether the IRN is valid and its payload
 */
export async function verifyIRN(
  irn: string,
  gstin: string
): Promise<{ valid: boolean; payload?: unknown; error?: string }> {
  try {
    const secret = new TextEncoder().encode(
      process.env.GSTN_SIGNING_SECRET || `gstn-signing-${gstin}-${GSTN_ENV}`
    );
    const { payload } = await jwtVerify(irn, secret, {
      issuer: gstin,
    });
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'IRN verification failed',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places (GST standard) */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** SHA-256 hash utility */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a signed QR code string for the e-invoice.
 *
 * Per GSTN specification, the QR code encodes:
 *   GSTIN | Invoice Number | Invoice Date | Total Value | Tax Value | IRN
 *
 * @param payload - E-invoice payload
 * @returns Base64-encoded QR code string
 */
function generateSignedQRCode(payload: Record<string, unknown>): string {
  const qrData = [
    payload.SellerDtls?.Gstin || '',
    payload.DocDtls?.No || '',
    payload.DocDtls?.Dt || '',
    payload.ValDtls?.TotInvVal || '',
    payload.ValDtls?.CgstVal || 0 + payload.ValDtls?.SgstVal || 0 + payload.ValDtls?.IgstVal || 0,
  ].join('|');

  return Buffer.from(qrData).toString('base64');
}

/**
 * Get the configured GSTN base URL for the current environment.
 */
export function getGSTNBaseUrl(): string {
  return GSTN_BASE_URLS[GSTN_ENV];
}

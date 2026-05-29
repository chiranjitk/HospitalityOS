/**
 * TDS (Tax Deducted at Source) Calculator for Indian Market
 *
 * Handles TDS computation for travel agent and OTA commission payments.
 * Controlled by tenant-level configuration — only active when tenant
 * has Indian market settings enabled.
 *
 * Reference: Section 194C of Income Tax Act (payments to contractors)
 * and Section 194H (commission/brokerage).
 *
 * - With PAN: 5% of commission
 * - Without PAN: 10% of commission (higher rate as penalty)
 */

export interface TDSOptions {
  pan?: string | null;
  agentType?: 'travel_agent' | 'ota' | 'corporate';
  gstNumber?: string | null;
}

export interface TDSResult {
  /** Final TDS amount to deduct */
  tdsAmount: number;
  /** Rate applied (5% or 10%) */
  tdsRate: number;
  /** Whether PAN was provided */
  isPanAvailable: boolean;
  /** TDS section reference */
  section: string;
  /** Rounded amounts */
  tdsAmountRounded: number;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** TDS rate when PAN is available */
const TDS_RATE_WITH_PAN = 5;

/** TDS rate when PAN is NOT available (penalty rate) */
const TDS_RATE_WITHOUT_PAN = 10;

/** Minimum commission amount threshold below which TDS is not applicable */
const TDS_THRESHOLD = 0; // TDS applies on any amount > 0

/** Default section for commission brokerage */
const DEFAULT_SECTION = '194H';

/**
 * calculateTDS — Computes TDS amount for a given commission.
 *
 * @param commissionAmount - Gross commission amount before TDS
 * @param options - Agent details (PAN, type, GST)
 * @returns TDS breakdown including deduction amount and rate
 */
export function calculateTDS(
  commissionAmount: number,
  options: TDSOptions = {}
): TDSResult {
  if (commissionAmount <= TDS_THRESHOLD) {
    return {
      tdsAmount: 0,
      tdsRate: 0,
      isPanAvailable: !!options.pan,
      section: DEFAULT_SECTION,
      tdsAmountRounded: 0,
    };
  }

  const isPanAvailable = !!options.pan && options.pan.trim().length > 0;
  const tdsRate = isPanAvailable ? TDS_RATE_WITH_PAN : TDS_RATE_WITHOUT_PAN;
  const tdsAmount = commissionAmount * (tdsRate / 100);

  return {
    tdsAmount,
    tdsRate,
    isPanAvailable,
    section: DEFAULT_SECTION,
    tdsAmountRounded: roundFinancial(tdsAmount),
  };
}

/**
 * generateTDSLineItemDescription — Returns a human-readable description
 * for a TDS deduction line item on an invoice.
 */
export function generateTDSLineItemDescription(result: TDSResult): string {
  const panStatus = result.isPanAvailable ? 'PAN available' : 'PAN not available';
  return `TDS @ ${result.tdsRate}% u/s ${result.section} (${panStatus})`;
}

/**
 * generateChallanStub — Generates a stub for TDS challan (deposit slip).
 * In production this would integrate with the Indian tax portal (TRACES).
 *
 * @returns Challan stub data for record-keeping
 */
export function generateChallanStub(params: {
  tdsAmount: number;
  pan?: string | null;
  deductionDate: Date;
  tenantGST?: string | null;
}): {
  challanNumber: string;
  bsrCode: string;
  serialNumber: string;
  date: string;
  amount: number;
  status: string;
} {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;

  return {
    challanNumber: `CHLN-${dateStr}-${generateStubId()}`,
    bsrCode: 'STUB',
    serialNumber: generateStubId(),
    date: params.deductionDate.toISOString().split('T')[0],
    amount: roundFinancial(params.tdsAmount),
    status: 'pending_filing',
  };
}

/**
 * exportQuarterlyTDSSummary — Generates a stub for quarterly TDS return data.
 * In production this would generate Form 26Q/27Q data.
 */
export function exportQuarterlyTDSSummary(params: {
  quarterStart: Date;
  quarterEnd: Date;
  records: Array<{
    payeeName: string;
    pan?: string | null;
    totalCommission: number;
    totalTDS: number;
    paymentDate: Date;
  }>;
}): {
  quarter: string;
  totalCommission: number;
  totalTDS: number;
  deductionCount: number;
  status: string;
} {
  const totalCommission = params.records.reduce((s, r) => s + r.totalCommission, 0);
  const totalTDS = params.records.reduce((s, r) => s + r.totalTDS, 0);

  return {
    quarter: `${params.quarterStart.toISOString().split('T')[0]} to ${params.quarterEnd.toISOString().split('T')[0]}`,
    totalCommission: roundFinancial(totalCommission),
    totalTDS: roundFinancial(totalTDS),
    deductionCount: params.records.length,
    status: 'stub_ready_for_export',
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function roundFinancial(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateStubId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

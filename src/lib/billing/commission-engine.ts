/**
 * Commission Auto-Accrual Engine
 *
 * Core service for automated commission management:
 * - Auto-accrual on booking creation/confirmation
 * - Tiered commission calculation
 * - OTA channel commission via ChannelCommissionConfig
 * - Commission invoice generation with TDS deduction
 * - Agent statement generation
 *
 * Designed to be fire-and-forget: failures must never block booking creation.
 */

import { db } from '@/lib/db';
import { calculateTDS, generateTDSLineItemDescription, type TDSResult } from '@/lib/billing/tds-calculator';
import { generateInvoiceNumber } from '@/lib/billing/number-generation';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface BookingRef {
  id: string;
  tenantId: string;
  propertyId: string;
  totalAmount: number;
  roomRate: number;
  source: string;
  channelId?: string | null;
  roomTypeId?: string;
  ratePlanId?: string | null;
  status: string;
}

interface TieredBracket {
  upTo: number | null; // null = unlimited (last bracket)
  rate: number;
}

interface TieredConditions {
  tiers: TieredBracket[];
}

interface CommissionInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  agentId?: string | null;
  totalCommission: number;
  tdsAmount: number;
  netPayable: number;
  recordCount: number;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
}

interface AgentStatement {
  agentId: string;
  agentName: string;
  periodStart: Date;
  periodEnd: Date;
  bookings: AgentStatementBooking[];
  totalEarned: number;
  totalTDS: number;
  netPayable: number;
  paymentHistory: AgentPaymentEntry[];
  outstandingBalance: number;
  currency: string;
}

interface AgentStatementBooking {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  bookingAmount: number;
  commissionAmount: number;
  commissionStatus: string;
  ruleName?: string;
}

interface AgentPaymentEntry {
  paymentId: string;
  amount: number;
  paymentMethod: string | null;
  reference: string | null;
  paidAt: Date;
}

// ──────────────────────────────────────────────
// 1. Auto-Accrual on Booking Creation
// ──────────────────────────────────────────────

/**
 * accrueCommissionOnBooking — Main entry point called after a booking is created.
 *
 * Checks if the booking qualifies for commission auto-accrual:
 * - Travel agent bookings (source = 'travel_agent')
 * - OTA channel bookings (channelId set, ChannelCommissionConfig exists)
 * - Corporate bookings via CommissionRule
 *
 * This function is designed to be called in fire-and-forget mode:
 * errors are caught and logged but never propagated.
 */
export async function accrueCommissionOnBooking(booking: BookingRef): Promise<void> {
  try {
    // Skip draft, cancelled, or no-show bookings
    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return;
    }

    // Skip bookings with zero amount
    if (booking.totalAmount <= 0) {
      return;
    }

    const accrualPromises: Promise<void>[] = [];

    // Check for travel agent commission rules
    if (booking.source === 'travel_agent') {
      accrualPromises.push(accrueAgentCommission(booking));
    }

    // Check for OTA channel commission
    if (booking.channelId) {
      accrualPromises.push(autoAccrueForChannelBooking(booking));
    }

    // Also check for generic CommissionRules matching this booking (regardless of source)
    accrualPromises.push(accrueFromCommissionRules(booking));

    await Promise.allSettled(accrualPromises);
  } catch (error) {
    console.error('[CommissionEngine] accrueCommissionOnBooking failed:', error);
    // Do NOT throw — this is fire-and-forget
  }
}

/**
 * accrueAgentCommission — Handles commission accrual for travel agent bookings.
 */
async function accrueAgentCommission(booking: BookingRef): Promise<void> {
  try {
    // Find matching CommissionRule for this travel agent
    const rule = await findMatchingRule(booking, 'travel_agent');
    if (!rule) {
      console.log(`[CommissionEngine] No matching rule for travel_agent booking ${booking.id}`);
      return;
    }

    // Check for duplicate
    const existing = await db.commissionRecord.findFirst({
      where: { bookingId: booking.id, ruleId: rule.id },
    });
    if (existing) {
      return;
    }

    const commissionAmount = calculateCommission(
      booking.totalAmount,
      rule.commissionType,
      rule.rate,
      rule.fixedAmount,
      rule.minAmount,
      rule.maxAmount,
    );

    if (commissionAmount <= 0) {
      return;
    }

    await db.commissionRecord.create({
      data: {
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        ruleId: rule.id,
        bookingId: booking.id,
        sourceType: 'travel_agent',
        sourceName: rule.name,
        bookingAmount: booking.totalAmount,
        commissionAmount,
        status: 'accrued',
        notes: `Auto-accrued on booking creation via rule "${rule.name}"`,
      },
    });

    console.log(`[CommissionEngine] Accrued ${commissionAmount} for booking ${booking.id} (travel_agent)`);
  } catch (error) {
    console.error(`[CommissionEngine] accrueAgentCommission failed for booking ${booking.id}:`, error);
  }
}

/**
 * accrueFromCommissionRules — Finds and applies any matching CommissionRule regardless of source.
 */
async function accrueFromCommissionRules(booking: BookingRef): Promise<void> {
  try {
    // Skip if we already handled this via agent/channel paths
    if (booking.source === 'travel_agent' || booking.channelId) {
      // Still check for non-agent/channel rules (e.g., referral, corporate, direct)
    }

    const sourceTypesToCheck = ['corporate', 'referral', 'direct'];
    if (!sourceTypesToCheck.includes(booking.source)) {
      return;
    }

    const rule = await findMatchingRule(booking, booking.source as string);
    if (!rule) return;

    // Check for duplicate
    const existing = await db.commissionRecord.findFirst({
      where: { bookingId: booking.id, ruleId: rule.id },
    });
    if (existing) return;

    const commissionAmount = calculateCommission(
      booking.totalAmount,
      rule.commissionType,
      rule.rate,
      rule.fixedAmount,
      rule.minAmount,
      rule.maxAmount,
    );

    if (commissionAmount <= 0) return;

    await db.commissionRecord.create({
      data: {
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        ruleId: rule.id,
        bookingId: booking.id,
        sourceType: rule.sourceType,
        sourceName: rule.name,
        bookingAmount: booking.totalAmount,
        commissionAmount,
        status: 'accrued',
        notes: `Auto-accrued on booking creation via rule "${rule.name}"`,
      },
    });
  } catch (error) {
    console.error(`[CommissionEngine] accrueFromCommissionRules failed for booking ${booking.id}:`, error);
  }
}

// ──────────────────────────────────────────────
// 2. OTA Channel Commission Auto-Accrual
// ──────────────────────────────────────────────

/**
 * autoAccrueForChannelBooking — For OTA bookings (Booking.com, Expedia, etc.).
 *
 * Looks up ChannelCommissionConfig for the channel and calculates commission
 * based on the configured model (gross, net, hybrid).
 */
export async function autoAccrueForChannelBooking(booking: BookingRef): Promise<void> {
  try {
    if (!booking.channelId) return;

    // Find active commission config for this channel
    const config = await db.channelCommissionConfig.findFirst({
      where: {
        connectionId: booking.channelId,
        tenantId: booking.tenantId,
        isActive: true,
      },
    });

    if (!config) {
      return;
    }

    // Check for duplicate
    const existing = await db.commissionRecord.findFirst({
      where: {
        bookingId: booking.id,
        ruleId: { isEmpty: undefined }, // OTA records don't use rules
        sourceType: 'ota',
      },
    });
    if (existing) return;

    // Calculate commission based on config type
    let commissionAmount = 0;

    switch (config.commissionType) {
      case 'percentage': {
        commissionAmount = booking.totalAmount * (config.baseCommission / 100);
        break;
      }
      case 'fixed_amount': {
        commissionAmount = config.baseCommission;
        break;
      }
      case 'tiered': {
        commissionAmount = calculateChannelTiered(booking.totalAmount, config.baseCommission);
        break;
      }
      default: {
        commissionAmount = booking.totalAmount * (config.baseCommission / 100);
      }
    }

    // Apply min/max commission
    if (config.minCommission !== null && commissionAmount < config.minCommission) {
      commissionAmount = config.minCommission;
    }
    if (config.maxCommission !== null && commissionAmount > config.maxCommission) {
      commissionAmount = config.maxCommission;
    }

    commissionAmount = roundFinancial(commissionAmount);

    if (commissionAmount <= 0) return;

    // Determine actual booking amount based on commission model
    let actualBookingAmount = booking.totalAmount;
    if (config.commissionModel === 'gross') {
      // Gross: commission is on the full booking amount
      actualBookingAmount = booking.totalAmount;
    } else if (config.commissionModel === 'net') {
      // Net: commission is on the net (base) rate
      actualBookingAmount = booking.roomRate > 0 ? booking.roomRate : booking.totalAmount;
    }
    // Hybrid: use total as-is

    // For OTA commissions, we need a dummy rule since CommissionRecord requires ruleId
    // Create a special "system" rule for OTA commissions if one doesn't exist
    const systemRule = await db.commissionRule.findFirst({
      where: {
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        sourceType: 'ota',
        name: `OTA Auto-Accrual - ${config.channelCode}`,
        isActive: true,
      },
    });

    const ruleId = systemRule?.id;

    await db.commissionRecord.create({
      data: {
        tenantId: booking.tenantId,
        propertyId: booking.propertyId,
        ruleId: ruleId || '00000000-0000-0000-0000-000000000000', // fallback
        bookingId: booking.id,
        sourceType: 'ota',
        sourceName: config.channelCode,
        bookingAmount: actualBookingAmount,
        commissionAmount,
        status: 'accrued',
        notes: `OTA auto-accrual: ${config.channelCode} (${config.commissionType} @ ${config.baseCommission}%)`,
      },
    });

    console.log(`[CommissionEngine] OTA commission accrued: ${commissionAmount} for booking ${booking.id} (${config.channelCode})`);
  } catch (error) {
    console.error(`[CommissionEngine] autoAccrueForChannelBooking failed for booking ${booking.id}:`, error);
  }
}

// ──────────────────────────────────────────────
// 3. Commission Invoice Generation
// ──────────────────────────────────────────────

/**
 * generateCommissionInvoice — Generates a commission invoice for an agent for a period.
 *
 * - Sums all 'accrued' CommissionRecords for the agent in the period
 * - Calculates TDS deduction (if Indian market)
 * - Creates CityLedgerInvoice with breakdown
 * - Updates CommissionRecord status to 'invoiced'
 * - Returns invoice details
 */
export async function generateCommissionInvoice(
  agentId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  propertyId?: string,
): Promise<CommissionInvoiceResult | null> {
  try {
    // Get the travel agent
    const agent = await db.travelAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      console.error(`[CommissionEngine] Agent ${agentId} not found`);
      return null;
    }

    // Get the agent's city ledger account for PAN/GST info (for TDS)
    const ledgerAccount = await db.cityLedgerAccount.findFirst({
      where: {
        tenantId,
        accountType: 'travel_agent',
        accountCode: agent.code,
      },
    });

    // Find all accrued commission records for this agent in the period
    const whereClause: Record<string, unknown> = {
      tenantId,
      sourceType: 'travel_agent',
      status: 'accrued',
      createdAt: { gte: periodStart, lt: periodEnd },
    };

    if (propertyId) whereClause.propertyId = propertyId;

    // Find records via matching rules that have this agent as source
    const agentRules = await db.commissionRule.findMany({
      where: {
        tenantId,
        sourceType: 'travel_agent',
        sourceId: agentId,
        isActive: true,
      },
      select: { id: true },
    });

    const ruleIds = agentRules.map(r => r.id);

    const records = await db.commissionRecord.findMany({
      where: {
        ...whereClause,
        ruleId: { in: ruleIds },
      },
      include: {
        booking: { select: { confirmationCode: true, totalAmount: true } },
      },
    });

    if (records.length === 0) {
      console.log(`[CommissionEngine] No accrued records for agent ${agentId} in period`);
      return null;
    }

    const totalCommission = records.reduce((sum, r) => sum + r.commissionAmount, 0);
    const currency = records[0]?.booking?.totalAmount !== undefined ? agent.country === 'India' ? 'INR' : 'USD' : 'USD';

    // Get the property ID for the invoice (first record)
    const invoicePropertyId = propertyId || records[0].propertyId;

    // Calculate TDS if applicable
    let tdsAmount = 0;
    let tdsDescription = '';
    const pan = ledgerAccount?.panNumber || agent.taxId;

    if (pan || !pan) {
      // Always calculate TDS (opt-in via tenant config check would go here)
      const tdsResult = calculateTDS(totalCommission, { pan, agentType: 'travel_agent' });
      tdsAmount = tdsResult.tdsAmountRounded;
      tdsDescription = generateTDSLineItemDescription(tdsResult);
    }

    const netPayable = roundFinancial(totalCommission - tdsAmount);

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber('COMM');

    // Calculate due date based on agent's payment terms
    const paymentDays = parsePaymentTerms(agent.paymentTerms);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentDays);

    // Create CityLedgerInvoice with items in a transaction
    const invoice = await db.$transaction(async (tx) => {
      const lineItems = records.map(r => ({
        description: `Commission: Booking ${r.booking.confirmationCode}`,
        amount: r.commissionAmount,
        quantity: 1,
        folioId: null,
      }));

      // Add TDS as a negative line item if applicable
      if (tdsAmount > 0) {
        lineItems.push({
          description: tdsDescription,
          amount: -tdsAmount,
          quantity: 1,
          folioId: null,
        });
      }

      const subtotal = roundFinancial(lineItems.reduce((s, item) => s + item.amount, 0));

      const newInvoice = await tx.cityLedgerInvoice.create({
        data: {
          tenantId,
          propertyId: invoicePropertyId,
          travelAgentId: agentId,
          accountName: agent.agencyName,
          accountType: 'travel_agent',
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate,
          subtotal: Math.max(0, totalCommission),
          tax: 0,
          total: Math.max(0, netPayable),
          currency,
          paidAmount: 0,
          status: 'sent',
          notes: `Commission invoice for ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
          items: {
            create: lineItems,
          },
        },
      });

      // Update all commission records to 'invoiced'
      await tx.commissionRecord.updateMany({
        where: { id: { in: records.map(r => r.id) } },
        data: { status: 'invoiced', invoicedAt: new Date() },
      });

      return newInvoice;
    });

    console.log(`[CommissionEngine] Commission invoice ${invoice.invoiceNumber} generated for agent ${agent.agencyName} (${records.length} records, ${currency} ${netPayable})`);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      agentId,
      totalCommission: roundFinancial(totalCommission),
      tdsAmount,
      netPayable,
      recordCount: records.length,
      periodStart,
      periodEnd,
      currency,
    };
  } catch (error) {
    console.error(`[CommissionEngine] generateCommissionInvoice failed for agent ${agentId}:`, error);
    return null;
  }
}

// ──────────────────────────────────────────────
// 4. Tiered Commission Calculation
// ──────────────────────────────────────────────

/**
 * processTieredCommission — Calculates commission using tiered brackets.
 *
 * Example:
 * - Bracket 1: first $50,000 → 5%
 * - Bracket 2: $50,000 to $200,000 → 8%
 * - Bracket 3: above $200,000 → 12%
 *
 * @param totalBookingAmount - Total booking amount to compute commission on
 * @param tiers - Array of tier brackets
 * @returns Total commission amount
 */
export function processTieredCommission(
  totalBookingAmount: number,
  tiers: TieredBracket[]
): number {
  if (!tiers || tiers.length === 0 || totalBookingAmount <= 0) {
    return 0;
  }

  // Sort tiers by upTo value (null = unlimited, should be last)
  const sortedTiers = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  let totalCommission = 0;
  let remaining = totalBookingAmount;
  let previousLimit = 0;

  for (const tier of sortedTiers) {
    if (remaining <= 0) break;

    const tierRange = tier.upTo === null
      ? remaining
      : Math.min(tier.upTo - previousLimit, remaining);

    if (tierRange > 0) {
      totalCommission += tierRange * (tier.rate / 100);
      remaining -= tierRange;
    }

    previousLimit = tier.upTo || previousLimit;
  }

  return roundFinancial(totalCommission);
}

/**
 * calculateChannelTiered — Simple tiered calculation for OTA channel commissions.
 * Uses a basic two-tier model: base rate for first portion, higher rate for excess.
 */
function calculateChannelTiered(bookingAmount: number, baseRate: number): number {
  const threshold = 500; // First $500 at base rate
  const basePortion = Math.min(bookingAmount, threshold) * (baseRate / 100);
  const tierPortion = Math.max(0, bookingAmount - threshold) * (baseRate * 1.5 / 100);
  return roundFinancial(basePortion + tierPortion);
}

// ──────────────────────────────────────────────
// 5. Agent Statement
// ──────────────────────────────────────────────

/**
 * getAgentStatement — Generates a commission statement for an agent.
 *
 * Includes:
 * - All bookings with commission in period
 * - Commission earned, TDS deducted, net payable
 * - Payment history
 * - Outstanding balance
 */
export async function getAgentStatement(
  agentId: string,
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<AgentStatement | null> {
  try {
    const agent = await db.travelAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) return null;

    // Get agent's commission rules
    const agentRules = await db.commissionRule.findMany({
      where: {
        tenantId,
        sourceType: 'travel_agent',
        sourceId: agentId,
      },
      select: { id: true, name: true },
    });

    const ruleIds = agentRules.map(r => r.id);
    const ruleMap = new Map(agentRules.map(r => [r.id, r.name]));

    // Find commission records in period
    const records = await db.commissionRecord.findMany({
      where: {
        tenantId,
        ruleId: ruleIds.length > 0 ? { in: ruleIds } : undefined,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      include: {
        booking: {
          select: {
            confirmationCode: true,
            totalAmount: true,
            primaryGuest: { select: { firstName: true, lastName: true } },
            checkIn: true,
            checkOut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bookings: AgentStatementBooking[] = records.map(r => ({
      bookingId: r.bookingId,
      confirmationCode: r.booking.confirmationCode,
      guestName: `${r.booking.primaryGuest.firstName} ${r.booking.primaryGuest.lastName}`.trim(),
      checkIn: r.booking.checkIn,
      checkOut: r.booking.checkOut,
      bookingAmount: r.bookingAmount,
      commissionAmount: r.commissionAmount,
      commissionStatus: r.status,
      ruleName: ruleMap.get(r.ruleId) || undefined,
    }));

    const totalEarned = records.reduce((s, r) => s + r.commissionAmount, 0);

    // Get TDS deductions from city ledger invoices for this agent in period
    const tdsInvoices = await db.cityLedgerInvoice.findMany({
      where: {
        tenantId,
        travelAgentId: agentId,
        createdAt: { gte: periodStart, lt: periodEnd },
        accountType: 'travel_agent',
      },
      select: { items: true },
    });

    let totalTDS = 0;
    for (const invoice of tdsInvoices) {
      for (const item of invoice.items) {
        if (item.description.toLowerCase().includes('tds') && item.amount < 0) {
          totalTDS += Math.abs(item.amount);
        }
      }
    }

    // Payment history
    const payments = await db.commissionPayment.findMany({
      where: {
        tenantId,
        payeeType: 'travel_agent',
        paidAt: { gte: periodStart, lt: periodEnd },
      },
      orderBy: { paidAt: 'desc' },
    });

    const paymentHistory: AgentPaymentEntry[] = payments.map(p => ({
      paymentId: p.id,
      amount: p.totalAmount,
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      paidAt: p.paidAt,
    }));

    const totalPaid = payments.reduce((s, p) => s + p.totalAmount, 0);

    // Outstanding balance = earned - TDS - paid
    const outstandingBalance = roundFinancial(totalEarned - totalTDS - totalPaid);

    return {
      agentId,
      agentName: agent.agencyName,
      periodStart,
      periodEnd,
      bookings,
      totalEarned: roundFinancial(totalEarned),
      totalTDS: roundFinancial(totalTDS),
      netPayable: roundFinancial(totalEarned - totalTDS),
      paymentHistory,
      outstandingBalance,
      currency: agent.country === 'India' ? 'INR' : 'USD',
    };
  } catch (error) {
    console.error(`[CommissionEngine] getAgentStatement failed for agent ${agentId}:`, error);
    return null;
  }
}

// ──────────────────────────────────────────────
// Rule Matching & Commission Calculation
// ──────────────────────────────────────────────

/**
 * findMatchingRule — Finds the best matching CommissionRule for a booking.
 *
 * Priority order:
 * 1. Rule with matching sourceId (specific agent/channel)
 * 2. Rule with matching sourceType but no sourceId (general)
 * 3. Most specific match (most recent created, or active)
 */
async function findMatchingRule(
  booking: BookingRef,
  sourceType: string,
): Promise<ReturnType<typeof db.commissionRule.findFirst> | null> {
  const now = new Date();

  // First try: find a rule with a specific sourceId
  // For travel_agent, sourceId could be the agent's ID
  // We'll search by sourceType first, then filter
  const rules = await db.commissionRule.findMany({
    where: {
      tenantId: booking.tenantId,
      propertyId: booking.propertyId,
      sourceType,
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validUntil: null },
        { validUntil: { gte: now } },
      ],
    },
    orderBy: { createdAt: 'desc' }, // Prefer newer rules
  });

  if (rules.length === 0) return null;

  // Prefer rules with sourceId match (most specific)
  // For now, return the first (most recent) rule
  return rules[0] || null;
}

/**
 * calculateCommission — Calculates commission amount based on rule type.
 */
function calculateCommission(
  bookingAmount: number,
  commissionType: string,
  rate: number,
  fixedAmount: number,
  minAmount: number,
  maxAmount: number | null | undefined,
): number {
  let commission: number;

  switch (commissionType) {
    case 'percentage':
      commission = bookingAmount * (rate / 100);
      break;
    case 'flat':
      commission = fixedAmount;
      break;
    case 'tiered':
      // Tiered requires conditions JSON with tiers array
      // For now, use basic rate-based calculation
      // Tiered rules should have their conditions set via the rules API
      commission = bookingAmount * (rate / 100);
      break;
    default:
      commission = bookingAmount * (rate / 100);
  }

  // Apply min/max constraints
  if (minAmount > 0 && commission < minAmount) {
    commission = minAmount;
  }
  if (maxAmount !== null && maxAmount !== undefined && maxAmount > 0 && commission > maxAmount) {
    commission = maxAmount;
  }

  return roundFinancial(commission);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function roundFinancial(value: number): number {
  return Math.round(value * 100) / 100;
}

function parsePaymentTerms(terms: string): number {
  switch (terms) {
    case 'net_15': return 15;
    case 'net_30': return 30;
    case 'net_45': return 45;
    case 'net_60': return 60;
    case 'cod': return 0;
    default: return 30;
  }
}

/**
 * Room Charge Calculation Helper
 *
 * Determines the room rate for a given booking on a given date,
 * considering price overrides, rate plan base prices, and pricing rules.
 * Calculates applicable taxes based on the property's tax settings.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateSource =
  | 'price_override'
  | 'rate_plan'
  | 'booking_rate'
  | 'fallback_zero';

export interface RoomChargeResult {
  baseRate: number;
  taxAmount: number;
  totalAmount: number;
  rateSource: RateSource;
  taxComponents: TaxComponentDetail[];
  currency: string;
  warning?: string;
}

export interface TaxComponentDetail {
  name: string;
  rate: number;
  type: string; // percentage | fixed
  amount: number;
}

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * calculateRoomCharge
 *
 * Determines the room rate for a booking on a specific date and calculates tax.
 *
 * Priority order:
 *  1. PriceOverride for the date (rate plan level)
 *  2. Rate plan base price
 *  3. Booking's roomRate field (previously agreed rate)
 *  4. Fallback to 0
 *
 * After determining the base rate, pricing rules are evaluated and applied
 * if any active rule matches the date, property, and room type.
 *
 * Tax is calculated using the property's taxComponents configuration.
 */
export async function calculateRoomCharge(
  booking: {
    id: string;
    tenantId: string;
    propertyId: string;
    roomTypeId: string;
    ratePlanId: string | null;
    roomRate: number;
    currency: string;
  },
  property: {
    id: string;
    currency: string;
    taxType: string;
    defaultTaxRate: number;
    taxComponents: string; // JSON: [{name, rate, type}]
    serviceChargePercent: number;
    includeTaxInPrice: boolean;
  },
  date: Date
): Promise<RoomChargeResult> {
  const currency = property.currency || booking.currency || 'USD';

  // 1. Determine base rate
  let baseRate = 0;
  let rateSource: RateSource = 'fallback_zero';

  // 1a. Check for price override on the rate plan for the given date
  if (booking.ratePlanId) {
    const priceOverride = await db.priceOverride.findUnique({
      where: {
        ratePlanId_date: {
          ratePlanId: booking.ratePlanId,
          date: normalizeDate(date),
        },
      },
    });

    if (priceOverride) {
      baseRate = priceOverride.price;
      rateSource = 'price_override';
    }
  }

  // 1b. Fall back to rate plan base price
  if (baseRate === 0 && booking.ratePlanId) {
    const ratePlan = await db.ratePlan.findUnique({
      where: { id: booking.ratePlanId },
      select: { basePrice: true },
    });

    if (ratePlan) {
      baseRate = ratePlan.basePrice;
      rateSource = 'rate_plan';
    }
  }

  // 1c. Fall back to booking's roomRate
  if (baseRate === 0 && booking.roomRate > 0) {
    baseRate = booking.roomRate;
    rateSource = 'booking_rate';
  }

  // 1d. No pricing found — log a WARNING and set a flag so callers can handle it
  if (baseRate === 0) {
    const dateStr = normalizeDate(date).toISOString().split('T')[0];
    console.warn(
      `[room-charge] No pricing found for room type ${booking.roomTypeId} on ${dateStr}. ` +
      `No active rate plan, price override, or booking rate configured. Returning $0 with NO_PRICING_FOUND warning.`
    );
  }

  // 2. Apply pricing rules if available
  baseRate = await applyPricingRules(
    baseRate,
    booking.tenantId,
    property.id,
    booking.roomTypeId,
    date
  );

  // 3. Calculate tax
  const { taxAmount, taxComponents } = calculateTax(baseRate, property);

  // 4. If tax is included in the displayed price, adjust base rate display
  const totalAmount = property.includeTaxInPrice
    ? baseRate
    : baseRate + taxAmount;

  return {
    baseRate: Math.round(baseRate * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    rateSource,
    taxComponents,
    currency,
    warning: baseRate === 0 ? 'NO_PRICING_FOUND' : undefined,
  };
}

// ─── Pricing Rules ────────────────────────────────────────────────────────────

/**
 * Apply active pricing rules to the base rate.
 * Rules are evaluated in priority order (highest first).
 * Only the first matching rule is applied.
 */
async function applyPricingRules(
  baseRate: number,
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  date: Date
): Promise<number> {
  if (baseRate <= 0) return 0;

  const rules = await db.pricingRule.findMany({
    where: {
      tenantId,
      isActive: true,
      effectiveFrom: { lte: date },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: date } },
      ],
    },
    orderBy: { priority: 'desc' },
  });

  for (const rule of rules) {
    // Check if rule applies to this property
    if (rule.propertyId && rule.propertyId !== propertyId) continue;

    // Check if rule applies to this room type
    const applicableRoomTypes: string[] = JSON.parse(rule.roomTypes || '[]');
    if (applicableRoomTypes.length > 0 && !applicableRoomTypes.includes(roomTypeId)) {
      continue;
    }

    // Parse conditions for additional checks
    const conditions = JSON.parse(rule.conditions || '{}');

    // Day-of-week check
    if (conditions.daysOfWeek) {
      const dayOfWeek = date.getDay();
      const allowedDays: number[] = conditions.daysOfWeek;
      if (!allowedDays.includes(dayOfWeek)) continue;
    }

    // Occupancy thresholds, etc. could be checked here
    // For now, apply the first matching rule
    const adjustedRate = applyRuleToRate(baseRate, rule.value, rule.valueType, rule.type);
    return adjustedRate;
  }

  return baseRate;
}

/**
 * Apply a single pricing rule to a rate.
 */
function applyRuleToRate(
  rate: number,
  value: number,
  valueType: string,
  ruleType: string
): number {
  let adjusted = rate;

  switch (ruleType) {
    case 'markup':
      adjusted = valueType === 'percentage'
        ? rate * (1 + value / 100)
        : rate + value;
      break;
    case 'markdown':
      adjusted = valueType === 'percentage'
        ? rate * (1 - value / 100)
        : rate - value;
      break;
    case 'discount_percentage':
      adjusted = rate * (1 - value / 100);
      break;
    case 'discount_fixed':
      adjusted = rate - value;
      break;
    case 'surcharge_percentage':
      adjusted = rate * (1 + value / 100);
      break;
    case 'surcharge_fixed':
      adjusted = rate + value;
      break;
    case 'early_bird':
    case 'last_minute':
    case 'long_stay':
    case 'weekend':
    case 'occupancy':
    case 'seasonal':
    case 'dynamic':
      adjusted = valueType === 'percentage'
        ? rate * (1 + value / 100)
        : rate + value;
      break;
    case 'promo_code':
      adjusted = valueType === 'percentage'
        ? rate * (1 - value / 100)
        : rate - value;
      break;
    default:
      adjusted = valueType === 'percentage'
        ? rate * (1 + value / 100)
        : rate + value;
  }

  return Math.max(0, adjusted);
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

/**
 * Calculate tax for a given base amount using the property's tax configuration.
 * Supports both a single defaultTaxRate and detailed taxComponents.
 */
export function calculateTax(
  baseAmount: number,
  property: {
    taxType: string;
    defaultTaxRate: number;
    taxComponents: string; // JSON: [{name, rate, type}]
    serviceChargePercent: number;
  }
): { taxAmount: number; taxComponents: TaxComponentDetail[] } {
  if (baseAmount <= 0) {
    return { taxAmount: 0, taxComponents: [] };
  }

  let components: TaxComponentDetail[] = [];
  let totalTax = 0;

  // Parse tax components from property settings
  try {
    const parsed: TaxComponentDetail[] = JSON.parse(property.taxComponents || '[]');
    if (parsed.length > 0) {
      for (const comp of parsed) {
        let amount = 0;
        if (comp.type === 'fixed') {
          amount = comp.rate;
        } else {
          amount = baseAmount * (comp.rate / 100);
        }
        components.push({
          name: comp.name,
          rate: comp.rate,
          type: comp.type || 'percentage',
          amount: Math.round(amount * 100) / 100,
        });
        totalTax += amount;
      }
    } else if (property.defaultTaxRate > 0) {
      // Fallback to default tax rate
      const amount = baseAmount * (property.defaultTaxRate / 100);
      components.push({
        name: property.taxType === 'gst' ? 'GST' : property.taxType === 'vat' ? 'VAT' : 'Tax',
        rate: property.defaultTaxRate,
        type: 'percentage',
        amount: Math.round(amount * 100) / 100,
      });
      totalTax += amount;
    }
  } catch {
    // If tax components JSON is invalid, use default rate
    if (property.defaultTaxRate > 0) {
      const amount = baseAmount * (property.defaultTaxRate / 100);
      components.push({
        name: property.taxType === 'gst' ? 'GST' : property.taxType === 'vat' ? 'VAT' : 'Tax',
        rate: property.defaultTaxRate,
        type: 'percentage',
        amount: Math.round(amount * 100) / 100,
      });
      totalTax += amount;
    }
  }

  return {
    taxAmount: Math.round(totalTax * 100) / 100,
    taxComponents: components,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Normalize a date to the start of day (UTC) for consistent comparisons.
 */
function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get today's start-of-day date in UTC.
 */
export function getTodayUTC(): Date {
  return normalizeDate(new Date());
}

/**
 * Format a date as YYYY-MM-DD for use in descriptions.
 */
export function formatDateForDescription(date: Date): string {
  const d = normalizeDate(date);
  return d.toISOString().split('T')[0];
}

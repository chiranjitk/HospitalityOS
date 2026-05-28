import { db } from '@/lib/db';

// Types
export interface PricingRule {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  type: string;
  description: string | null;
  value: number;
  valueType: string; // 'percentage' | 'fixed'
  conditions: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  roomTypes: string;
  appliedCount: number;
  lastAppliedAt: Date | null;
}

export interface PricingRuleCondition {
  minNights?: number;
  maxNights?: number;
  minOccupancy?: number;
  maxOccupancy?: number;
  daysOfWeek?: number[]; // 0-6, Sunday to Saturday
  months?: number[]; // 1-12
  bookingChannel?: string[];
  guestType?: string[];
  advanceBookingDaysMin?: number;
  advanceBookingDaysMax?: number;
  promoCode?: string; // Required for promo_code rule type
}

export interface PriceBreakdown {
  basePrice: number;
  adjustments: Array<{
    ruleId: string;
    ruleName: string;
    type: string;
    value: number;
    amount: number;
  }>;
  subtotal: number;
  taxes: number;
  fees: number;
  totalAmount: number;
  currency: string;
  nights: number;
  pricePerNight: number;
}

export interface PricingContext {
  roomTypeId: string;
  propertyId: string;
  tenantId: string;
  checkIn: Date;
  checkOut: Date;
  basePrice: number;
  adults?: number;
  children?: number;
  bookingChannel?: string;
  guestId?: string;
  promoCode?: string;
  ratePlanId?: string;
}

/**
 * Calculate the final price for a booking with all applicable rules
 */
export async function calculatePrice(context: PricingContext): Promise<PriceBreakdown> {
  const {
    roomTypeId,
    propertyId,
    checkIn,
    checkOut,
    basePrice,
    adults = 1,
    children = 0,
    bookingChannel = 'direct',
    promoCode,
    ratePlanId,
  } = context;

  // Calculate nights
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  // Get room type and property for currency and tax settings
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { currency: true, propertyId: true },
  });

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      currency: true,
      defaultTaxRate: true,
      taxComponents: true,
      serviceChargePercent: true,
    },
  });

  const currency = roomType?.currency || property?.currency || 'USD';

  // Start with base price
  let currentPricePerNight = basePrice;
  const adjustments: PriceBreakdown['adjustments'] = [];

  // Load applicable pricing rules (scoped to tenant)
  const applicableRules = await loadApplicableRules({
    tenantId: roomType ? await getPropertyTenantId(propertyId) : '',
    propertyId,
    roomTypeId,
    checkIn,
    checkOut,
    basePrice,
    adults,
    children,
    bookingChannel,
    promoCode,
  });

  // Sort by priority (higher priority first)
  applicableRules.sort((a, b) => b.priority - a.priority);

  // Apply rules in priority order
  for (const rule of applicableRules) {
    const result = applyRule(rule, currentPricePerNight, nights, context);
    if (result.applied) {
      adjustments.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        value: rule.value,
        amount: result.amount,
      });
      currentPricePerNight = result.newPrice;
      // Note: appliedCount update should be handled by the caller as a side effect,
      // not inside the calculation function, to keep this pure and performant.
    }
  }

  // Apply Length-of-Stay (LOS) graduated discount
  try {
    const losTiers = await db.losPricingTier.findMany({
      where: {
        tenantId: roomType ? await getPropertyTenantId(propertyId) : '',
        propertyId,
        roomTypeId,
        isActive: true,
      },
      orderBy: { minNights: 'desc' },
    });

    if (losTiers.length > 0) {
      // Find the applicable tier (highest minNights that the stay qualifies for)
      for (const tier of losTiers) {
        if (nights >= tier.minNights && (tier.maxNights === null || nights <= tier.maxNights)) {
          if (tier.discountPercent > 0) {
            const losAmount = currentPricePerNight * (tier.discountPercent / 100);
            currentPricePerNight = Math.max(0, currentPricePerNight - losAmount);
            adjustments.push({
              ruleId: `los-${tier.id}`,
              ruleName: `LOS Discount (${tier.label})`,
              type: 'los_discount',
              value: tier.discountPercent,
              amount: -losAmount,
            });
          }
          break; // Only apply the first matching tier (highest minNights)
        }
      }
    }
  } catch {
    // LOS tiers not available or table doesn't exist yet — skip silently
  }

  // Calculate totals
  const subtotal = currentPricePerNight * nights;

  // Calculate taxes
  let taxes = 0;
  if (property) {
    let taxCalculated = false;
    if (property.taxComponents) {
      try {
        const components = JSON.parse(property.taxComponents);
        if (Array.isArray(components) && components.length > 0) {
          for (const component of components) {
            // SECURITY FIX: Guard against missing/invalid rate producing NaN (zero room charge edge case)
            const rate = Number(component.rate);
            if (subtotal <= 0 || isNaN(rate)) continue;
            taxes += subtotal * (rate / 100);
            taxCalculated = true;
          }
        }
      } catch {
        // Fall back to default tax rate
      }
    }
    // Fall back to defaultTaxRate if taxComponents was empty/invalid or not set
    if (!taxCalculated && property.defaultTaxRate && subtotal > 0) {
      taxes = subtotal * (property.defaultTaxRate / 100);
    }
  }

  // Calculate service charge
  const fees = (subtotal > 0 && property?.serviceChargePercent)
    ? subtotal * (property.serviceChargePercent / 100)
    : 0;

  // SECURITY FIX: Sanitize all financial values — NaN propagates to DB writes (see bookings/route.ts L637-661)
  const safeTaxes = Number(taxes) || 0;
  const safeFees = Number(fees) || 0;
  const totalAmount = Number(subtotal) + safeTaxes + safeFees;

  return {
    basePrice,
    adjustments,
    subtotal,
    taxes,
    fees,
    totalAmount,
    currency,
    nights,
    pricePerNight: currentPricePerNight,
  };
}

/**
 * Get the tenant ID for a property
 */
async function getPropertyTenantId(propertyId: string): Promise<string> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { tenantId: true },
  });
  return property?.tenantId || '';
}

/**
 * Load applicable pricing rules for a booking context (tenant-scoped)
 */
async function loadApplicableRules(
  context: PricingContext
): Promise<PricingRule[]> {
  const {
    tenantId,
    propertyId,
    roomTypeId,
    checkIn,
    checkOut,
    adults,
    children,
    bookingChannel,
    promoCode,
  } = context;

  const now = new Date();

  // Build base query - scoped to tenant
  const rules = await db.pricingRule.findMany({
    where: {
      isActive: true,
      tenantId,
      OR: [
        { propertyId: null }, // Global rules for this tenant
        { propertyId },
      ],
      effectiveFrom: { lte: now },
      effectiveTo: null,
    },
    orderBy: { priority: 'desc' },
  });

  // Filter rules based on conditions
  const applicableRules: PricingRule[] = [];

  for (const rule of rules) {
    // Check room type applicability
    if (rule.roomTypes) {
      try {
        const roomTypeIds = JSON.parse(rule.roomTypes);
        if (Array.isArray(roomTypeIds) && roomTypeIds.length > 0) {
          if (!roomTypeIds.includes(roomTypeId)) {
            continue;
          }
        }
      } catch {
        // If parsing fails, assume all room types
      }
    }

    // Check conditions
    if (rule.conditions) {
      try {
        const conditions: PricingRuleCondition = JSON.parse(rule.conditions);

        // Check if rule applies
        if (!checkRuleConditions(conditions, {
          checkIn,
          checkOut,
          adults,
          children,
          bookingChannel,
          promoCode,
        })) {
          continue;
        }
      } catch {
        // If parsing fails, apply rule anyway
      }
    }

    applicableRules.push(rule as PricingRule);
  }

  return applicableRules;
}

/**
 * Normalize daysOfWeek from string names ('Sun','Mon',etc.) to numbers (0-6).
 * The form saves daysOfWeek as strings like ['Sat','Sun'] but the engine expects numbers [0,6].
 */
function normalizeDaysOfWeek(daysOfWeek?: (number | string)[]): number[] {
  if (!daysOfWeek || daysOfWeek.length === 0) return [];
  const dayNameToNum: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  };
  return daysOfWeek.map(d => typeof d === 'number' ? d : (dayNameToNum[d] ?? -1)).filter(d => d >= 0);
}

/**
 * Check if rule conditions match the booking context
 */
function checkRuleConditions(
  conditions: PricingRuleCondition,
  context: {
    checkIn: Date;
    checkOut: Date;
    adults?: number;
    children?: number;
    bookingChannel?: string;
    promoCode?: string;
  }
): boolean {
  const nights = Math.ceil(
    (context.checkOut.getTime() - context.checkIn.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check min nights
  if (conditions.minNights !== undefined && nights < conditions.minNights) {
    return false;
  }

  // Check max nights
  if (conditions.maxNights !== undefined && nights > conditions.maxNights) {
    return false;
  }

  // Check min occupancy
  if (conditions.minOccupancy !== undefined && (context.adults ?? 1) < conditions.minOccupancy) {
    return false;
  }

  // Check max occupancy
  if (conditions.maxOccupancy !== undefined && (context.adults ?? 1) > conditions.maxOccupancy) {
    return false;
  }

  // Check days of week (normalize string day names to numbers)
  if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
    const normalizedDays = normalizeDaysOfWeek(conditions.daysOfWeek as (number | string)[]);
    const checkInDay = context.checkIn.getDay();
    if (normalizedDays.length > 0 && !normalizedDays.includes(checkInDay)) {
      return false;
    }
  }

  // Check months
  if (conditions.months && conditions.months.length > 0) {
    const checkInMonth = context.checkIn.getMonth() + 1;
    if (!conditions.months.includes(checkInMonth)) {
      return false;
    }
  }

  // Check booking channel
  if (conditions.bookingChannel && conditions.bookingChannel.length > 0) {
    if (!conditions.bookingChannel.includes(context.bookingChannel || 'direct')) {
      return false;
    }
  }

  // Check advance booking days
  if (conditions.advanceBookingDaysMin !== undefined || conditions.advanceBookingDaysMax !== undefined) {
    const now = new Date();
    const advanceDays = Math.ceil(
      (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (conditions.advanceBookingDaysMin !== undefined && advanceDays < conditions.advanceBookingDaysMin) {
      return false;
    }

    if (conditions.advanceBookingDaysMax !== undefined && advanceDays > conditions.advanceBookingDaysMax) {
      return false;
    }
  }

  // Check guest type (e.g., 'corporate', 'vip', 'loyalty')
  // Note: guestType matching requires a guest context that is not yet passed in.
  // This is a placeholder for future expansion when guest profiles are linked to bookings.
  // if (conditions.guestType && conditions.guestType.length > 0) { ... }

  return true;
}

/**
 * Apply a single pricing rule to a price
 */
function applyRule(
  rule: PricingRule,
  currentPrice: number,
  nights: number,
  context: PricingContext
): { applied: boolean; amount: number; newPrice: number } {
  let amount = 0;
  let newPrice = currentPrice;
  const now = new Date();

  switch (rule.type) {
    case 'discount_percentage':
      // Apply percentage discount
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice - amount;
      break;

    case 'discount_fixed':
      // Apply fixed discount per night
      amount = rule.value;
      newPrice = Math.max(0, currentPrice - amount);
      break;

    case 'surcharge_percentage':
      // Apply percentage surcharge
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice + amount;
      break;

    case 'surcharge_fixed':
      // Apply fixed surcharge per night
      amount = rule.value;
      newPrice = currentPrice + amount;
      break;

    case 'markup':
      // Apply percentage markup (increase price)
      // E.g., value=10 means price goes up by 10%
      amount = currentPrice * (rule.value / 100);
      newPrice = currentPrice + amount;
      break;

    case 'markdown':
      // Apply percentage markdown (decrease price)
      // E.g., value=15 means price goes down by 15%
      amount = currentPrice * (rule.value / 100);
      newPrice = Math.max(0, currentPrice - amount);
      break;

    case 'early_bird': {
      // Early bird discount - configurable threshold from conditions
      const earlyBirdDays = Math.ceil(
        (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      let threshold = 7; // default
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.advanceBookingDaysMin !== undefined) threshold = conds.advanceBookingDaysMin;
      } catch { /* use default */ }
      if (earlyBirdDays >= threshold) {
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'last_minute': {
      // Last minute discount - configurable threshold from conditions
      const lmAdvanceDays = Math.ceil(
        (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      let maxWindow = 3; // default
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.advanceBookingDaysMax !== undefined) maxWindow = conds.advanceBookingDaysMax;
      } catch { /* use default */ }
      if (lmAdvanceDays >= 0 && lmAdvanceDays <= maxWindow) {
        const amt = currentPrice * (Math.abs(rule.value) / 100);
        if (rule.value > 0) {
          amount = amt;
          newPrice = currentPrice + amt;
        } else {
          amount = amt;
          newPrice = currentPrice - amt;
        }
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'long_stay': {
      // Long stay discount - configurable minNights from conditions
      let minNightsThreshold = 7; // default
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.minNights !== undefined) minNightsThreshold = conds.minNights;
        else if (conds.minStay !== undefined) minNightsThreshold = conds.minStay; // backward compat with form
      } catch { /* use default */ }
      if (nights >= minNightsThreshold) {
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'weekend': {
      // Weekend surcharge/discount - read days from conditions
      const checkInDay = context.checkIn.getDay();
      // Read days from conditions, default to Sat(6) and Sun(0)
      let weekendDays = [0, 6]; // default Sat & Sun
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.daysOfWeek && Array.isArray(conds.daysOfWeek) && conds.daysOfWeek.length > 0) {
          weekendDays = normalizeDaysOfWeek(conds.daysOfWeek as (number | string)[]);
        }
      } catch { /* use defaults */ }
      if (weekendDays.includes(checkInDay)) {
        amount = currentPrice * (Math.abs(rule.value) / 100);
        newPrice = rule.value < 0 ? currentPrice - amount : currentPrice + amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'seasonal':
      // Seasonal pricing - check if within effective dates
      if (rule.effectiveFrom && rule.effectiveTo) {
        const effectiveFrom = new Date(rule.effectiveFrom);
        const effectiveTo = new Date(rule.effectiveTo);
        if (context.checkIn >= effectiveFrom && context.checkIn <= effectiveTo) {
          // For seasonal, the value is typically the new price or multiplier
          if (rule.valueType === 'percentage') {
            amount = currentPrice * (rule.value / 100);
            newPrice = currentPrice + amount;
          } else {
            // Fixed seasonal price
            amount = rule.value - currentPrice;
            newPrice = rule.value;
          }
        } else {
          return { applied: false, amount: 0, newPrice: currentPrice };
        }
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;

    case 'promo_code': {
      // Promo code discount - check if promo code matches the rule's conditions
      // NOTE: rule.conditions is a JSON string; parse it to access promoCode
      let parsedPromoConditions: PricingRuleCondition | null = null;
      if (rule.conditions) {
        try {
          parsedPromoConditions = JSON.parse(rule.conditions);
        } catch {
          // If parsing fails, cannot validate promo code
        }
      }
      if (
        context.promoCode &&
        parsedPromoConditions?.promoCode &&
        context.promoCode.toLowerCase() === parsedPromoConditions.promoCode.toLowerCase()
      ) {
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'occupancy': {
      // Occupancy-based pricing - configurable threshold from conditions
      const totalGuests = (context.adults ?? 1) + ((context.children) || 0);
      let threshold = 2; // default
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.minOccupancy !== undefined) threshold = conds.minOccupancy;
      } catch { /* use default */ }
      if (totalGuests > threshold) {
        amount = rule.value * (totalGuests - threshold);
        newPrice = currentPrice + amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'channel': {
      // Channel-based pricing
      let channels: string[] = [];
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        if (conds.bookingChannel && Array.isArray(conds.bookingChannel)) {
          channels = conds.bookingChannel;
        }
      } catch { /* no channels specified */ }
      if (channels.length === 0 || channels.includes(context.bookingChannel || 'direct')) {
        if (rule.valueType === 'percentage') {
          amount = currentPrice * (rule.value / 100);
          newPrice = currentPrice + amount;
        } else {
          amount = rule.value;
          newPrice = currentPrice + amount;
        }
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    case 'advance_booking': {
      // Advance booking discount with configurable min/max days
      const advDays = Math.ceil(
        (context.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      let minAdv: number | undefined;
      let maxAdv: number | undefined;
      try {
        const conds = rule.conditions ? JSON.parse(rule.conditions as string) : {};
        minAdv = conds.advanceBookingDaysMin;
        maxAdv = conds.advanceBookingDaysMax;
      } catch { /* use defaults */ }
      const minOk = minAdv !== undefined ? advDays >= minAdv : true;
      const maxOk = maxAdv !== undefined ? advDays <= maxAdv : true;
      if (minOk && maxOk) {
        amount = currentPrice * (rule.value / 100);
        newPrice = currentPrice - amount;
      } else {
        return { applied: false, amount: 0, newPrice: currentPrice };
      }
      break;
    }

    default:
      // Unknown rule type, don't apply
      return { applied: false, amount: 0, newPrice: currentPrice };
  }

  return { applied: true, amount, newPrice };
}

/**
 * Get all active pricing rules for a property (tenant-scoped)
 */
export async function getActivePricingRules(propertyId: string, tenantId: string): Promise<PricingRule[]> {
  const now = new Date();

  return db.pricingRule.findMany({
    where: {
      tenantId,
      OR: [
        { propertyId: null },
        { propertyId },
      ],
      isActive: true,
      effectiveFrom: { lte: now },
      effectiveTo: null,
    },
    orderBy: { priority: 'desc' },
  }) as Promise<PricingRule[]>;
}

// ============================================================
// Per-Night Rate Variation
// ============================================================

export interface PriceOverride {
  date: Date;
  price: number;
  reason?: string;
}

export interface PerNightRate {
  date: Date;
  dayOfWeek: number; // 0=Sun, 6=Sat
  baseRate: number;
  adjustedRate: number;
  ruleApplied: string | null;
  source: 'base' | 'override' | 'weekend' | 'seasonal' | 'occupancy' | 'early_bird' | 'last_minute' | 'long_stay' | 'advance_booking';
}

/**
 * Calculate per-night rates for a stay, checking overrides, day-of-week,
 * seasonal, and occupancy adjustments on each individual night.
 */
export async function calculatePerNightRates(
  checkIn: Date,
  checkOut: Date,
  roomRate: number,
  pricingRules: PricingRule[],
  priceOverrides?: PriceOverride[],
  occupancy?: { adults: number; children: number },
): Promise<PerNightRate[]> {
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  const now = new Date();
  const totalNights = nights;

  // Build a date-keyed lookup for overrides
  const overrideMap = new Map<string, PriceOverride>();
  if (priceOverrides) {
    for (const po of priceOverrides) {
      const key = new Date(po.date).toISOString().slice(0, 10);
      overrideMap.set(key, po);
    }
  }

  const perNightRates: PerNightRate[] = [];

  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(checkIn);
    nightDate.setDate(nightDate.getDate() + i);
    const dateKey = nightDate.toISOString().slice(0, 10);
    const dayOfWeek = nightDate.getDay();

    let adjustedRate = roomRate;
    let ruleApplied: string | null = null;
    let source: PerNightRate['source'] = 'base';

    // 1. Check for price override on this specific date
    const override = overrideMap.get(dateKey);
    if (override) {
      adjustedRate = override.price;
      ruleApplied = `Override: ${override.reason || 'Manual override'}`;
      source = 'override';
      perNightRates.push({ date: nightDate, dayOfWeek, baseRate: roomRate, adjustedRate, ruleApplied, source });
      continue; // Override takes precedence
    }

    // Sort applicable rules by priority (higher first)
    const sortedRules = [...pricingRules].sort((a, b) => b.priority - a.priority);

    // 2. Check each rule for applicability on this specific night
    for (const rule of sortedRules) {
      if (!rule.isActive) continue;

      // Check effective date range
      if (rule.effectiveFrom && nightDate < new Date(rule.effectiveFrom)) continue;
      if (rule.effectiveTo && nightDate > new Date(rule.effectiveTo)) continue;

      let conditions: PricingRuleCondition = {};
      if (rule.conditions) {
        try {
          conditions = JSON.parse(rule.conditions);
        } catch {
          // Skip unparseable conditions
        }
      }

      // --- Apply rule types that are per-night aware ---

      // Weekend rules
      if (rule.type === 'weekend') {
        let weekendDays = [0, 6];
        if (conditions.daysOfWeek && Array.isArray(conditions.daysOfWeek) && conditions.daysOfWeek.length > 0) {
          weekendDays = normalizeDaysOfWeek(conditions.daysOfWeek as (number | string)[]);
        }
        if (weekendDays.includes(dayOfWeek)) {
          const amount = adjustedRate * (Math.abs(rule.value) / 100);
          if (rule.value < 0) {
            adjustedRate = Math.max(0, adjustedRate - amount);
            ruleApplied = `${rule.name}: -${Math.abs(rule.value)}% weekend`;
          } else {
            adjustedRate = adjustedRate + amount;
            ruleApplied = `${rule.name}: +${rule.value}% weekend`;
          }
          source = 'weekend';
        }
        continue;
      }

      // Seasonal rules - check if night falls within seasonal range
      if (rule.type === 'seasonal') {
        if (rule.effectiveFrom && rule.effectiveTo) {
          const effFrom = new Date(rule.effectiveFrom);
          const effTo = new Date(rule.effectiveTo);
          if (nightDate >= effFrom && nightDate <= effTo) {
            if (rule.valueType === 'percentage') {
              const amount = adjustedRate * (rule.value / 100);
              adjustedRate = adjustedRate + amount;
              ruleApplied = `${rule.name}: seasonal +${rule.value}%`;
            } else {
              const amount = rule.value - adjustedRate;
              adjustedRate = rule.value;
              ruleApplied = `${rule.name}: seasonal flat ${rule.value}`;
            }
            source = 'seasonal';
          }
        }
        continue;
      }

      // Occupancy rules
      if (rule.type === 'occupancy' && occupancy) {
        const totalGuests = occupancy.adults + (occupancy.children || 0);
        const threshold = conditions.minOccupancy || 2;
        if (totalGuests > threshold) {
          const surcharge = rule.value * (totalGuests - threshold);
          adjustedRate = adjustedRate + surcharge;
          ruleApplied = `${rule.name}: +${rule.value} × ${totalGuests - threshold} extra guest(s)`;
          source = 'occupancy';
        }
        continue;
      }

      // Early bird rules - based on advance booking days
      if (rule.type === 'early_bird') {
        const advanceDays = Math.ceil((nightDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = conditions.advanceBookingDaysMin || 7;
        if (advanceDays >= threshold) {
          const amount = adjustedRate * (rule.value / 100);
          adjustedRate = Math.max(0, adjustedRate - amount);
          ruleApplied = `${rule.name}: -${rule.value}% early bird`;
          source = 'early_bird';
        }
        continue;
      }

      // Last minute rules
      if (rule.type === 'last_minute') {
        const advanceDays = Math.ceil((nightDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const maxWindow = conditions.advanceBookingDaysMax || 3;
        if (advanceDays >= 0 && advanceDays <= maxWindow) {
          const amount = adjustedRate * (Math.abs(rule.value) / 100);
          if (rule.value > 0) {
            // Positive value = markup
            adjustedRate = adjustedRate + amount;
            ruleApplied = `${rule.name}: +${rule.value}% last minute markup`;
          } else {
            adjustedRate = Math.max(0, adjustedRate - amount);
            ruleApplied = `${rule.name}: -${Math.abs(rule.value)}% last minute discount`;
          }
          source = 'last_minute';
        }
        continue;
      }

      // Long stay discount - applies if total nights >= min
      if (rule.type === 'long_stay') {
        const minNights = conditions.minNights || 7;
        if (totalNights >= minNights) {
          const amount = adjustedRate * (rule.value / 100);
          adjustedRate = Math.max(0, adjustedRate - amount);
          ruleApplied = `${rule.name}: -${rule.value}% long stay`;
          source = 'long_stay';
        }
        continue;
      }

      // Advance booking rules
      if (rule.type === 'advance_booking') {
        const advanceDays = Math.ceil((nightDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const minAdv = conditions.advanceBookingDaysMin;
        const maxAdv = conditions.advanceBookingDaysMax;
        if (
          (minAdv !== undefined && advanceDays >= minAdv) &&
          (maxAdv === undefined || advanceDays <= maxAdv)
        ) {
          const amount = adjustedRate * (rule.value / 100);
          adjustedRate = Math.max(0, adjustedRate - amount);
          ruleApplied = `${rule.name}: -${rule.value}% advance booking`;
          source = 'advance_booking';
        }
        continue;
      }
    }

    perNightRates.push({ date: nightDate, dayOfWeek, baseRate: roomRate, adjustedRate, ruleApplied, source });
  }

  return perNightRates;
}

/**
 * Preview pricing for a potential booking
 */
export async function previewPricing(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  adults: number = 1,
  children: number = 0,
  promoCode?: string
): Promise<PriceBreakdown | null> {
  try {
    // Get room type
    const roomType = await db.roomType.findUnique({
      where: { id: roomTypeId },
      include: { property: true },
    });

    if (!roomType) {
      return null;
    }

    return calculatePrice({
      roomTypeId,
      propertyId: roomType.propertyId,
      tenantId: roomType.property?.tenantId || '',
      checkIn,
      checkOut,
      basePrice: roomType.basePrice,
      adults,
      children,
      promoCode,
    });
  } catch (error) {
    console.error('Error previewing pricing:', error);
    return null;
  }
}

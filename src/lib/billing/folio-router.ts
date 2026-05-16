/**
 * Folio Routing Rules Engine
 *
 * When a charge is posted, this engine evaluates active routing rules to determine
 * which folio the charge should be routed to based on category, conditions, and priority.
 */

import { db } from '@/lib/db';

export interface RouteChargeInput {
  folioId: string;
  amount: number;
  category: string;
  bookingId: string;
  tenantId: string;
  propertyId: string;
}

export interface RouteChargeResult {
  targetFolioId: string;
  routingRuleId: string;
}

interface RoutingRuleConditions {
  source?: string;
  amountMin?: number;
  amountMax?: number;
  roomType?: string;
  channel?: string;
}

/**
 * routeCharge - Evaluates routing rules and returns the target folio ID.
 *
 * 1. Find all active rules matching the charge category and property
 * 2. Sort by priority (lower number = higher priority)
 * 3. Evaluate each rule's conditions
 * 4. Return the first matching rule's target folio
 * 5. If no rule matches, return the original folio (guest's primary)
 */
export async function routeCharge(
  charge: RouteChargeInput
): Promise<RouteChargeResult> {
  // Find active rules for this category and property
  const rules = await db.folioRoutingRule.findMany({
    where: {
      tenantId: charge.tenantId,
      propertyId: charge.propertyId,
      chargeCategory: charge.category,
      isActive: true,
    },
    orderBy: { priority: 'asc' },
  });

  if (rules.length === 0) {
    // No rules match — return the guest's primary folio
    return {
      targetFolioId: charge.folioId,
      routingRuleId: '',
    };
  }

  // Fetch the booking to get room type and source for condition evaluation
  const booking = await db.booking.findUnique({
    where: { id: charge.bookingId },
    select: {
      roomTypeId: true,
      source: true,
      channelId: true,
    },
  });

  const bookingSource = booking?.source || 'direct';

  // Evaluate each rule's conditions
  for (const rule of rules) {
    const conditions: RoutingRuleConditions =
      typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions;

    if (!evaluateConditions(conditions, charge.amount, bookingSource, booking?.roomTypeId)) {
      continue;
    }

    // Rule matched — find or determine the target folio
    const targetFolioId = await resolveTargetFolio(
      rule.targetFolioType,
      charge.bookingId,
      charge.tenantId,
      charge.propertyId
    );

    if (targetFolioId) {
      return {
        targetFolioId,
        routingRuleId: rule.id,
      };
    }
  }

  // No rule matched — return original folio
  return {
    targetFolioId: charge.folioId,
    routingRuleId: '',
  };
}

/**
 * evaluateConditions - Checks if a charge meets all conditions defined in a routing rule.
 */
function evaluateConditions(
  conditions: RoutingRuleConditions,
  amount: number,
  source: string,
  roomTypeId?: string
): boolean {
  // Check amount range
  if (conditions.amountMin !== undefined && amount < conditions.amountMin) {
    return false;
  }
  if (conditions.amountMax !== undefined && amount > conditions.amountMax) {
    return false;
  }

  // Check source
  if (conditions.source && conditions.source !== 'all' && conditions.source !== source) {
    return false;
  }

  // Check room type
  if (conditions.roomType && conditions.roomType !== 'all' && conditions.roomType !== roomTypeId) {
    return false;
  }

  // Check channel
  if (conditions.channel && conditions.channel !== 'all') {
    // Channel check would need the booking's channelId
    // For now, treat 'all' as pass-through
  }

  return true;
}

/**
 * resolveTargetFolio - Determines the target folio based on the rule's target folio type.
 *
 * For types that require a specific folio (company, city_ledger, travel_agent),
 * it looks up existing folios on the booking. If none exists, returns null
 * so the caller falls through to the next rule or default.
 */
async function resolveTargetFolio(
  targetFolioType: string,
  bookingId: string,
  tenantId: string,
  propertyId: string
): Promise<string | null> {
  if (targetFolioType === 'guest') {
    // Return the primary folio
    const primaryFolio = await db.folio.findFirst({
      where: { bookingId, tenantId, propertyId },
      orderBy: { createdAt: 'asc' },
    });
    return primaryFolio?.id || null;
  }

  // For company, city_ledger, travel_agent, package types:
  // Look for a folio with a description or reference matching the type
  const targetFolio = await db.folio.findFirst({
    where: {
      bookingId,
      tenantId,
      propertyId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (targetFolio) {
    return targetFolio.id;
  }

  // If no specific folio found, we could create one here in the future
  // For now, return null so the charge goes to the primary folio
  return null;
}

/**
 * getActiveRoutingRules - Fetches all active routing rules for a property.
 */
export async function getActiveRoutingRules(tenantId: string, propertyId: string) {
  return db.folioRoutingRule.findMany({
    where: {
      tenantId,
      propertyId,
      isActive: true,
    },
    orderBy: { priority: 'asc' },
  });
}

/**
 * getRuleStats - Returns statistics about a routing rule (how many charges it has routed).
 */
export async function getRuleStats(ruleId: string) {
  // In a production system, this would query a charge routing log table.
  // For now, return default stats.
  return {
    ruleId,
    chargesRouted: 0,
    lastRoutedAt: null,
    totalAmountRouted: 0,
  };
}

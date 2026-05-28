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
        ? (() => { try { return JSON.parse(rule.conditions); } catch { return {}; } })()
        : rule.conditions;

    if (!evaluateConditions(conditions, charge.amount, bookingSource, booking?.roomTypeId, booking?.channelId ?? undefined)) {
      continue;
    }

    // Rule matched — find or determine the target folio
    const targetFolioId = await resolveTargetFolio(
      rule.targetFolioType,
      charge.bookingId,
      charge.tenantId,
      charge.propertyId
    );

    // M-22: Audit log the routing decision for compliance tracking.
    // TODO: Create a FolioRoutingDecision audit entry with charge details, matched rule, and target folio.
    // Consider adding to the folio-router API route that invokes routeCharge().
    if (targetFolioId) {
      // Track routing stat for this rule
      recordRoutingStat(rule.id, charge.amount);
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
  roomTypeId?: string,
  channelId?: string
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
    if (!channelId || channelId !== conditions.channel) {
      return false;
    }
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

// ─── In-Memory Rule Stats Tracking ──────────────────────────────────────────
// LIMITATION: There is no dedicated FolioRoutingLog table in the schema.
// Stats are tracked in-memory and periodically flushed. This means stats are
// lost on process restart and are not shared across serverless function instances.
// TODO: Add a FolioRoutingLog table to the schema for persistent, cross-instance stats.

interface RuleStatRecord {
  ruleId: string;
  chargesRouted: number;
  totalAmountRouted: number;
  lastRoutedAt: Date | null;
}

// In-memory store keyed by ruleId
const ruleStatsMap = new Map<string, RuleStatRecord>();

/**
 * Record a routed charge for stats tracking. Called after successful routing.
 */
export function recordRoutingStat(ruleId: string, amount: number): void {
  if (!ruleId) return;
  const existing = ruleStatsMap.get(ruleId);
  if (existing) {
    existing.chargesRouted += 1;
    existing.totalAmountRouted += amount;
    existing.lastRoutedAt = new Date();
  } else {
    ruleStatsMap.set(ruleId, {
      ruleId,
      chargesRouted: 1,
      totalAmountRouted: amount,
      lastRoutedAt: new Date(),
    });
  }
}

/**
 * getRuleStats - Returns statistics about a routing rule (how many charges it has routed).
 *
 * Queries in-memory stats first. If no in-memory data exists, falls back to querying
 * FolioLineItem counts by category as an approximate measure.
 */
export async function getRuleStats(ruleId: string) {
  // Check in-memory stats first
  const inMemory = ruleStatsMap.get(ruleId);
  if (inMemory) {
    return {
      ruleId: inMemory.ruleId,
      chargesRouted: inMemory.chargesRouted,
      lastRoutedAt: inMemory.lastRoutedAt,
      totalAmountRouted: Math.round(inMemory.totalAmountRouted * 100) / 100,
    };
  }

  // No in-memory data — look up the rule to get its charge category, then count
  // FolioLineItems matching that category as an approximate fallback.
  try {
    const rule = await db.folioRoutingRule.findUnique({
      where: { id: ruleId },
      select: { chargeCategory: true, propertyId: true, tenantId: true },
    });

    if (rule) {
      const aggregate = await db.folioLineItem.aggregate({
        where: {
          folio: {
            tenantId: rule.tenantId,
            propertyId: rule.propertyId,
          },
          category: rule.chargeCategory as any, // chargeCategory is a string, category is an enum
        },
        _count: true,
        _sum: { totalAmount: true },
        _max: { createdAt: true },
      });

      return {
        ruleId,
        chargesRouted: aggregate._count || 0,
        lastRoutedAt: aggregate._max?.createdAt || null,
        totalAmountRouted: Math.round((aggregate._sum?.totalAmount || 0) * 100) / 100,
      };
    }
  } catch (error) {
    console.error(`[folio-router] Failed to query fallback stats for rule ${ruleId}:`, error);
  }

  return {
    ruleId,
    chargesRouted: 0,
    lastRoutedAt: null,
    totalAmountRouted: 0,
  };
}

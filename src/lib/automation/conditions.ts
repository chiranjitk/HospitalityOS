/**
 * Automation Condition Evaluator
 *
 * Evaluates rule conditions against event payloads.
 * Supports dot-notation field paths and a rich set of comparison operators.
 * All conditions in a rule must match (AND logic) for the rule to trigger.
 */

// ── Types ──

/** Supported comparison operators for condition evaluation */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'starts_with'
  | 'ends_with';

/** A single condition to evaluate against a payload */
export interface Condition {
  /** Dot-notation path into the payload, e.g. "booking.roomType" or "guest.loyaltyTier" */
  field: string;
  /** The comparison operator to apply */
  operator: ConditionOperator;
  /** The value to compare against (ignored for exists / not_exists) */
  value?: unknown;
}

/** A group of conditions with a logic combiner (AND/OR) */
export interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: Array<Condition | ConditionGroup>;
}

/**
 * Resolve a dot-notation path into a deeply nested value.
 *
 * @example
 * resolveField({ booking: { roomType: 'suite' } }, 'booking.roomType') // => 'suite'
 */
export function resolveField(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  const segments = path.split('.');
  let current: unknown = payload;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    // Handle array index notation, e.g. "items.0.name"
    if (/^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      current = Array.isArray(current) ? current[index] : undefined;
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

/**
 * Evaluate a single condition against a payload value.
 *
 * @param condition - The condition with field, operator, and optional value
 * @param payload - The event payload to evaluate against
 * @returns `true` if the condition matches
 */
export function evaluateCondition(
  condition: Condition,
  payload: Record<string, unknown>,
): boolean {
  const fieldValue = resolveField(payload, condition.field);

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'contains': {
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;
    }

    case 'greater_than':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue > condition.value
      );

    case 'less_than':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue < condition.value
      );

    case 'greater_than_or_equal':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue >= condition.value
      );

    case 'less_than_or_equal':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue <= condition.value
      );

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);

    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;

    case 'starts_with':
      return (
        typeof fieldValue === 'string' &&
        typeof condition.value === 'string' &&
        fieldValue.startsWith(condition.value)
      );

    case 'ends_with':
      return (
        typeof fieldValue === 'string' &&
        typeof condition.value === 'string' &&
        fieldValue.endsWith(condition.value)
      );

    default: {
      // Unknown operators default to true (fail-open) but log a warning
      console.warn(
        `[ConditionEvaluator] Unknown operator "${(condition as { operator: string }).operator}" — treating as match`,
      );
      return true;
    }
  }
}

/**
 * Evaluate a group of conditions (supports nested AND/OR groups).
 *
 * @param group - The condition group to evaluate
 * @param payload - The event payload
 * @returns `true` if the group matches
 */
export function evaluateConditionGroup(
  group: ConditionGroup | Condition,
  payload: Record<string, unknown>,
): boolean {
  if ('logic' in group && Array.isArray(group.conditions)) {
    const evaluate = (c: Condition | ConditionGroup): boolean =>
      evaluateConditionGroup(c, payload);

    return group.logic === 'and'
      ? group.conditions.every(evaluate)
      : group.conditions.some(evaluate);
  }

  // It's a flat Condition
  return evaluateCondition(group as Condition, payload);
}

/**
 * Parse and evaluate trigger conditions from a JSON string.
 *
 * The JSON can be:
 * - A flat array of `Condition` objects (all must match — AND logic)
 * - A single `ConditionGroup` with explicit `logic: 'and' | 'or'`
 * - `null` / empty (always matches)
 *
 * @param conditionsJson - JSON string from `AutomationRule.triggerConditions`
 * @param payload - The event data payload
 * @returns `true` if all conditions pass (or no conditions exist)
 */
export function evaluateTriggerConditions(
  conditionsJson: string | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!conditionsJson) {
    return true; // No conditions = always match
  }

  try {
    const parsed = JSON.parse(conditionsJson);

    if (!parsed) {
      return true;
    }

    // Flat array of conditions (implicit AND)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return true;
      return parsed.every((condition: Condition) =>
        evaluateCondition(condition, payload),
      );
    }

    // Single condition object (not an array, not a group)
    if (parsed.field && parsed.operator) {
      return evaluateCondition(parsed as Condition, payload);
    }

    // ConditionGroup with logic/conditions
    if (parsed.logic && Array.isArray(parsed.conditions)) {
      return evaluateConditionGroup(parsed as ConditionGroup, payload);
    }

    console.warn(
      '[ConditionEvaluator] Unrecognized conditions format — treating as match',
    );
    return true;
  } catch (error) {
    console.error(
      '[ConditionEvaluator] Failed to parse conditions JSON:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

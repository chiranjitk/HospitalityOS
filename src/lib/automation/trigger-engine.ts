/**
 * Automation Trigger Engine — Legacy Compatibility Layer
 *
 * This module re-exports from the new modular automation engine for
 * backward compatibility with existing code that imports from this path.
 *
 * The actual implementation has been refactored into:
 * - `./engine.ts`    — Core evaluateAndExecuteRules
 * - `./conditions.ts` — Condition evaluator
 * - `./actions.ts`   — Action executor
 * - `./event-bus.ts` — In-memory event bus
 * - `./hooks.ts`     — Convenience hooks for API routes
 *
 * New code should import directly from the new modules.
 */

// Re-export types
export type { TriggerEventType, TriggerPayload } from './engine';
export type {
  AutomationContext,
  Action,
  ActionResult,
  ActionType,
} from './actions';
export type {
  Condition,
  ConditionOperator,
  ConditionGroup,
} from './conditions';
export type { EventListener } from './event-bus';
export type {
  RuleEvaluation,
  EngineResult,
} from './engine';

// Re-export core functions
export { evaluateAndExecuteRules } from './engine';
export { executeAction } from './actions';
export {
  evaluateCondition,
  evaluateConditionGroup,
  evaluateTriggerConditions,
  resolveField,
} from './conditions';
export {
  eventBus,
  emitEvent,
} from './event-bus';

// Re-export all hooks
export {
  onBookingCreated,
  onBookingConfirmed,
  onBookingCancelled,
  onBookingModified,
  onGuestCheckIn,
  onGuestCheckOut,
  onGuestCreated,
  onGuestBirthday,
  onPaymentReceived,
  onPaymentFailed,
  onFeedbackReceived,
  onReviewSubmitted,
  onLoyaltyTierUpgraded,
  onTaskCompleted,
  onTaskOverdue,
  onRoomStatusChanged,
  onWifiSessionStarted,
  onServiceRequestCreated,
  onCustomEvent,
} from './hooks';

// ── Legacy Compatibility ──

import { evaluateAndExecuteRules as newEvaluateAndExecute } from './engine';
import type { AutomationContext as NewAutomationContext } from './actions';

/**
 * @deprecated Use `evaluateAndExecuteRules` from `./engine` instead.
 * This function wraps the legacy TriggerPayload format.
 */
export async function evaluateAndExecuteRulesLegacy(
  payload: {
    eventType: string;
    tenantId: string;
    propertyId?: string;
    entityId?: string;
    data: Record<string, unknown>;
  },
): Promise<Array<{
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: number;
  errors: string[];
}>> {
  const context: NewAutomationContext = {
    event: payload.eventType,
    tenantId: payload.tenantId,
    payload: {
      ...payload.data,
      propertyId: payload.propertyId,
      entityId: payload.entityId,
    },
    timestamp: new Date(),
  };

  const result = await newEvaluateAndExecute(context);

  return result.evaluations.map((ev) => ({
    ruleId: ev.ruleId,
    ruleName: ev.ruleName,
    matched: ev.matches,
    actionsExecuted: ev.actionsExecuted,
    errors: ev.errors,
  }));
}

/**
 * @deprecated Use `emitEvent` from `./event-bus` or `onBookingCreated` etc. from `./hooks` instead.
 */
export function fireTrigger(payload: {
  eventType: string;
  tenantId: string;
  propertyId?: string;
  entityId?: string;
  data: Record<string, unknown>;
}): void {
  evaluateAndExecuteRulesLegacy(payload).catch((error) => {
    console.error('[TriggerEngine] Background trigger failed:', error);
  });
}

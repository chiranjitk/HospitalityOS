/**
 * StaySuite Automation Engine
 *
 * The complete automation trigger system for StaySuite HospitalityOS.
 * Import from here for a clean entry point, or from individual modules.
 *
 * @module automation
 *
 * @example
 * ```ts
 * // Import hooks for use in API routes
 * import { onBookingCreated, onGuestCheckIn } from '@/lib/automation';
 *
 * // Import the engine directly for advanced use
 * import { evaluateAndExecuteRules } from '@/lib/automation/engine';
 *
 * // Import the event bus for custom listeners
 * import { eventBus } from '@/lib/automation/event-bus';
 * ```
 */

// Core engine
export { evaluateAndExecuteRules } from './engine';
export type { RuleEvaluation, EngineResult } from './engine';

// Actions
export { executeAction } from './actions';
export type {
  AutomationContext,
  Action,
  ActionResult,
  ActionType,
} from './actions';

// Conditions
export {
  evaluateCondition,
  evaluateConditionGroup,
  evaluateTriggerConditions,
  resolveField,
} from './conditions';
export type {
  Condition,
  ConditionOperator,
  ConditionGroup,
} from './conditions';

// Event Bus
export { eventBus, emitEvent } from './event-bus';
export type { EventListener } from './event-bus';

// Hooks (convenience functions for API routes)
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

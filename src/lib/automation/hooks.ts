/**
 * Automation Event Hooks
 *
 * Provides `fireAutomationEvent()` — a safe, fire-and-forget wrapper around the
 * trigger engine that can be called from any server-side API route or server action.
 *
 * Automation failures NEVER propagate to the caller, ensuring the main business
 * flow is never broken by automation errors.
 */

import {
  fireTrigger,
  evaluateAndExecuteRules,
  type TriggerEventType,
  type TriggerPayload,
} from './trigger-engine';

// ── Re-export everything from trigger-engine for backward compatibility ──
export {
  fireTrigger,
  evaluateAndExecuteRules,
  type TriggerEventType,
  type TriggerPayload,
};

// ── Convenience payload builder ──

interface FireAutomationEventOptions {
  eventType: TriggerEventType;
  tenantId: string;
  propertyId?: string;
  entityId?: string;
  data: Record<string, unknown>;
}

/**
 * Fire an automation event in a fire-and-forget manner.
 *
 * This is the primary entry point for API routes to signal that something
 * happened (e.g. a booking was created, a guest checked in).
 *
 * Key guarantees:
 * - Errors are caught and logged — they will NEVER throw
 * - The trigger engine evaluates rules asynchronously in the background
 * - Returns void — callers should NOT await the result (use `.catch(() => {})` if needed)
 *
 * @example
 * ```ts
 * import { fireAutomationEvent } from '@/lib/automation/hooks';
 *
 * // After a booking is created successfully:
 * fireAutomationEvent('booking.created', {
 *   tenantId: booking.tenantId,
 *   propertyId: booking.propertyId,
 *   entityId: booking.id,
 *   data: { bookingId: booking.id, confirmationCode: booking.confirmationCode },
 * });
 * ```
 */
export function fireAutomationEvent(eventType: TriggerEventType, options: Omit<FireAutomationEventOptions, 'eventType'>): void {
  try {
    const payload: TriggerPayload = {
      eventType,
      tenantId: options.tenantId,
      ...(options.propertyId && { propertyId: options.propertyId }),
      ...(options.entityId && { entityId: options.entityId }),
      data: options.data,
    };

    fireTrigger(payload);
  } catch (error) {
    // Automation must never break the main flow — log and swallow
    console.error(
      `[AutomationHook] Failed to fire event "${eventType}":`,
      error instanceof Error ? error.message : error
    );
  }
}

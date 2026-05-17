/**
 * In-Memory Event Bus for Automation
 *
 * Provides a synchronous event bus that:
 * - Calls the automation engine (`evaluateAndExecuteRules`) for each event
 * - Supports multiple listeners per event type
 * - Handles listener errors gracefully without crashing
 * - Provides fire-and-forget emission for use in API handlers
 */

import { evaluateAndExecuteRules } from './engine';
import type { AutomationContext } from './actions';

// ── Types ──

/** Listener callback invoked when an event is emitted */
export type EventListener = (context: AutomationContext) => Promise<void>;

// ── Event Bus ──

class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();
  private wildcardListeners: EventListener[] = [];

  /**
   * Register a listener for a specific event type.
   *
   * @param event - The event name to listen for, e.g. 'booking.created'
   * @param listener - Async callback invoked with the AutomationContext
   */
  on(event: string, listener: EventListener): void {
    const existing = this.listeners.get(event) || [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  /**
   * Register a listener for ALL events (wildcard).
   *
   * @param listener - Async callback invoked with the AutomationContext
   */
  onAny(listener: EventListener): void {
    this.wildcardListeners.push(listener);
  }

  /**
   * Remove a specific listener for an event type.
   * The listener reference must be the same object used in `on()`.
   *
   * @param event - The event name
   * @param listener - The exact listener function reference to remove
   */
  off(event: string, listener: EventListener): void {
    const existing = this.listeners.get(event);
    if (existing) {
      const filtered = existing.filter((l) => l !== listener);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  /**
   * Remove a wildcard listener.
   *
   * @param listener - The exact listener function reference to remove
   */
  offAny(listener: EventListener): void {
    this.wildcardListeners = this.wildcardListeners.filter((l) => l !== listener);
  }

  /**
   * Emit an event and process all registered listeners + the automation engine.
   *
   * Flow:
   * 1. Build an `AutomationContext`
   * 2. Call the automation engine to evaluate and execute matching rules
   * 3. Call any registered specific listeners for this event
   * 4. Call any wildcard listeners
   *
   * All listener errors are caught and logged — one failed listener never
   * prevents other listeners from running.
   *
   * @param event - The event name, e.g. 'booking.created'
   * @param tenantId - The tenant that owns this event
   * @param payload - The event data
   * @returns The AutomationContext that was built for this event
   */
  async emit(
    event: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<AutomationContext> {
    const context: AutomationContext = {
      event,
      tenantId,
      payload,
      timestamp: new Date(),
    };

    // 1. Evaluate and execute automation rules (core engine)
    try {
      await evaluateAndExecuteRules(context);
    } catch (error) {
      console.error(
        `[EventBus] Automation engine failed for "${event}":`,
        error instanceof Error ? error.message : error,
      );
    }

    // 2. Call specific event listeners
    const specificListeners = this.listeners.get(event) || [];
    await this.invokeListeners(specificListeners, context);

    // 3. Call wildcard listeners
    if (this.wildcardListeners.length > 0) {
      await this.invokeListeners(this.wildcardListeners, context);
    }

    return context;
  }

  /**
   * Fire-and-forget version of `emit`. Does NOT await the result.
   * Safe to call from API handlers without blocking the response.
   *
   * @param event - The event name
   * @param tenantId - The tenant ID
   * @param payload - The event data
   */
  emitAsync(event: string, tenantId: string, payload: Record<string, unknown>): void {
    this.emit(event, tenantId, payload).catch((error) => {
      console.error(
        `[EventBus] Unhandled error in async emit for "${event}":`,
        error instanceof Error ? error.message : error,
      );
    });
  }

  /**
   * Get the number of listeners registered for a specific event.
   */
  listenerCount(event: string): number {
    return (this.listeners.get(event) || []).length + this.wildcardListeners.length;
  }

  /**
   * Get all registered event names (without wildcards).
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Remove all listeners for all events.
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.wildcardListeners = [];
  }

  /**
   * Invoke a list of listeners, catching errors individually.
   */
  private async invokeListeners(
    listeners: EventListener[],
    context: AutomationContext,
  ): Promise<void> {
    const invocations = listeners.map(async (listener) => {
      try {
        await listener(context);
      } catch (error) {
        console.error(
          `[EventBus] Listener error for "${context.event}":`,
          error instanceof Error ? error.message : error,
        );
      }
    });

    await Promise.all(invocations);
  }
}

// ── Singleton ──

/** The global event bus instance */
export const eventBus = new EventBus();

/**
 * Convenience function to emit an event. Fire-and-forget.
 *
 * @param event - The event name, e.g. 'booking.created'
 * @param tenantId - The tenant ID
 * @param payload - The event data
 */
export function emitEvent(
  event: string,
  tenantId: string,
  payload: Record<string, unknown>,
): void {
  eventBus.emitAsync(event, tenantId, payload);
}

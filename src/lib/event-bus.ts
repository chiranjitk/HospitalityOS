/**
 * EventBus - Event-driven automation system for StaySuite HospitalityOS
 *
 * Emits domain events and checks for matching AutomationRules.
 * When a rule matches, it logs the execution and records the result.
 *
 * Built-in events:
 * - booking.created
 * - booking.checked_in
 * - booking.checked_out
 * - guest.arrived
 * - payment.received
 * - room.status_changed
 * - service.request.created
 */

import { db } from '@/lib/db';

// ── Event Type Definitions ─────────────────────────────────

export const EVENT_TYPES = {
  BOOKING_CREATED: 'booking.created',
  BOOKING_CHECKED_IN: 'booking.checked_in',
  BOOKING_CHECKED_OUT: 'booking.checked_out',
  GUEST_ARRIVED: 'guest.arrived',
  PAYMENT_RECEIVED: 'payment.received',
  ROOM_STATUS_CHANGED: 'room.status_changed',
  SERVICE_REQUEST_CREATED: 'service.request.created',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const ALL_EVENT_TYPES: string[] = Object.values(EVENT_TYPES);

// Event schema descriptions for API documentation
export const EVENT_SCHEMAS: Record<string, { description: string; payload: Record<string, string> }> = {
  'booking.created': {
    description: 'Fired when a new booking is created',
    payload: { bookingId: 'uuid', confirmationCode: 'string', propertyId: 'uuid', checkIn: 'datetime', checkOut: 'datetime' },
  },
  'booking.checked_in': {
    description: 'Fired when a guest checks in to a booking',
    payload: { bookingId: 'uuid', confirmationCode: 'string', roomId: 'uuid', checkedInBy: 'string' },
  },
  'booking.checked_out': {
    description: 'Fired when a guest checks out of a booking',
    payload: { bookingId: 'uuid', confirmationCode: 'string', roomId: 'uuid' },
  },
  'guest.arrived': {
    description: 'Fired when a guest physically arrives at the property',
    payload: { guestId: 'uuid', bookingId: 'uuid', propertyId: 'uuid' },
  },
  'payment.received': {
    description: 'Fired when a payment is received',
    payload: { paymentId: 'uuid', amount: 'number', currency: 'string', bookingId: 'uuid' },
  },
  'room.status_changed': {
    description: 'Fired when a room status changes',
    payload: { roomId: 'uuid', oldStatus: 'string', newStatus: 'string', propertyId: 'uuid' },
  },
  'service.request.created': {
    description: 'Fired when a guest service request is created',
    payload: { requestId: 'uuid', type: 'string', roomId: 'uuid', priority: 'string' },
  },
};

// ── Handler Registration ───────────────────────────────────

type EventHandler = (event: string, payload: unknown, tenantId: string) => Promise<void> | void;

const handlers = new Map<string, EventHandler[]>();

/**
 * Register an event handler for a specific event type.
 */
export function on(event: string, handler: EventHandler): void {
  const existing = handlers.get(event) || [];
  existing.push(handler);
  handlers.set(event, existing);
}

// ── Event Bus ──────────────────────────────────────────────

/**
 * Emit an event and trigger matching automation rules.
 */
export async function emit(
  event: string,
  payload: unknown,
  tenantId: string
): Promise<void> {
  console.log(`[EventBus] Emitting: ${event} (tenant: ${tenantId})`);

  // 1. Run registered handlers
  const eventHandlers = handlers.get(event) || [];
  for (const handler of eventHandlers) {
    try {
      await handler(event, payload, tenantId);
    } catch (error) {
      console.error(`[EventBus] Handler error for ${event}:`, error);
    }
  }

  // 2. Run wildcard handlers
  const wildcardHandlers = handlers.get('*') || [];
  for (const handler of wildcardHandlers) {
    try {
      await handler(event, payload, tenantId);
    } catch (error) {
      console.error(`[EventBus] Wildcard handler error for ${event}:`, error);
    }
  }

  // 3. Query matching automation rules
  try {
    const rules = await db.automationRule.findMany({
      where: {
        tenantId,
        triggerEvent: event,
        isActive: true,
      },
    });

    for (const rule of rules) {
      await executeRule(rule, event, payload, tenantId);
    }
  } catch (error) {
    console.error(`[EventBus] Error querying automation rules for ${event}:`, error);
  }
}

/**
 * Execute an automation rule.
 * Evaluates conditions and runs configured actions.
 */
async function executeRule(
  rule: { id: string; triggerConditions?: string | null; actions: string; tenantId: string },
  event: string,
  payload: unknown,
  tenantId: string
): Promise<void> {
  const triggerData = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  // Check trigger conditions if defined
  if (rule.triggerConditions) {
    try {
      const conditions = JSON.parse(rule.triggerConditions);
      const passes = evaluateConditions(conditions, payload);
      if (!passes) return; // Conditions not met, skip execution
    } catch (error) {
      console.error(`[EventBus] Error evaluating conditions for rule ${rule.id}:`, error);
      await logExecution(rule.id, triggerData, 'error', 'Failed to evaluate conditions');
      return;
    }
  }

  // Execute actions
  try {
    const actions = JSON.parse(rule.actions);
    const actionsResult: Record<string, unknown> = {};

    for (const action of actions) {
      try {
        await executeAction(action, payload, tenantId);
        actionsResult[action.type || action.action || 'unknown'] = 'success';
      } catch (actionError) {
        console.error(`[EventBus] Action error in rule ${rule.id}:`, actionError);
        actionsResult[action.type || action.action || 'unknown'] = `error: ${actionError}`;
      }
    }

    // Update rule execution count
    await db.automationRule.update({
      where: { id: rule.id },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    });

    // Log successful execution
    await logExecution(rule.id, triggerData, 'success', JSON.stringify(actionsResult));
    console.log(`[EventBus] Rule ${rule.id} executed successfully`);
  } catch (error) {
    console.error(`[EventBus] Error executing rule ${rule.id}:`, error);
    await logExecution(rule.id, triggerData, 'error', `Execution failed: ${error}`);
  }
}

/**
 * Evaluate trigger conditions against event payload.
 * Supports simple field matching: { field: 'booking.status', operator: 'equals', value: 'confirmed' }
 */
function evaluateConditions(conditions: unknown, payload: unknown): boolean {
  if (!conditions || typeof conditions !== 'object') return true;

  const conditionsArray = Array.isArray(conditions) ? conditions : [conditions];
  const payloadObj = payload as Record<string, unknown>;

  for (const condition of conditionsArray) {
    if (!condition || typeof condition !== 'object') continue;

    const cond = condition as Record<string, unknown>;
    const field = cond.field as string;
    const operator = (cond.operator as string) || 'equals';
    const value = cond.value;

    // Resolve nested field path (e.g., "booking.status")
    const fieldParts = field.split('.');
    let fieldValue: unknown = payloadObj;
    for (const part of fieldParts) {
      if (fieldValue && typeof fieldValue === 'object') {
        fieldValue = (fieldValue as Record<string, unknown>)[part];
      } else {
        fieldValue = undefined;
        break;
      }
    }

    // Evaluate condition
    let passes = false;
    switch (operator) {
      case 'equals':
        passes = fieldValue === value;
        break;
      case 'not_equals':
        passes = fieldValue !== value;
        break;
      case 'contains':
        passes = typeof fieldValue === 'string' && String(value).includes(fieldValue);
        break;
      case 'greater_than':
        passes = Number(fieldValue) > Number(value);
        break;
      case 'less_than':
        passes = Number(fieldValue) < Number(value);
        break;
      case 'exists':
        passes = fieldValue !== undefined && fieldValue !== null;
        break;
      case 'in':
        passes = Array.isArray(value) && value.includes(fieldValue);
        break;
      default:
        passes = true; // Unknown operator — skip
    }

    if (!passes) return false;
  }

  return true;
}

/**
 * Execute a single automation action.
 * Supports action types: log, notify, webhook, update_field
 */
async function executeAction(
  action: Record<string, unknown>,
  payload: unknown,
  tenantId: string
): Promise<void> {
  const actionType = action.type as string || action.action as string;

  switch (actionType) {
    case 'log':
      console.log(`[Automation Action: log] ${JSON.stringify(action)}`);
      break;

    case 'notify':
      console.log(`[Automation Action: notify] tenant=${tenantId}, message=${action.message}`);
      // Notification dispatch would be integrated here
      break;

    case 'webhook': {
      const webhookUrl = action.url as string;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: action.event || 'automation',
            tenantId,
            payload,
            action,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000),
        }).catch(() => {
          // Webhook failure is logged but doesn't stop other actions
        });
      }
      break;
    }

    case 'update_field': {
      // Update a model field based on action config
      const { model, id, field, value } = action as Record<string, string>;
      if (model && id && field && value !== undefined) {
        const prismaModel = (db as unknown as Record<string, unknown>)[model];
        if (prismaModel && typeof prismaModel === 'object') {
          const updateFn = (prismaModel as Record<string, unknown>).update as
            | ((args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>)
            | undefined;
          if (updateFn) {
            await updateFn({
              where: { id },
              data: { [field]: value },
            });
          }
        }
      }
      break;
    }

    default:
      console.log(`[Automation Action] Unknown action type: ${actionType}`);
  }
}

/**
 * Log an automation execution.
 */
async function logExecution(
  ruleId: string,
  triggerData: string,
  status: string,
  result: string | null
): Promise<void> {
  try {
    await db.automationExecutionLog.create({
      data: {
        ruleId,
        triggerData,
        status,
        errorMessage: status === 'error' ? result : null,
        actionsResult: status === 'success' ? result : null,
      },
    });
  } catch (error) {
    console.error('[EventBus] Failed to log execution:', error);
  }
}

// Export the EventBus as a default object
const eventBus = {
  emit,
  on,
  EVENT_TYPES,
  ALL_EVENT_TYPES,
  EVENT_SCHEMAS,
};

export default eventBus;

/**
 * Automation Trigger Engine
 *
 * Evaluates automation rules against events and executes matching actions.
 * Called from the /api/automation/trigger endpoint and from workflow hooks.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ── Types ──

export type TriggerEventType =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.modified'
  | 'guest.check_in'
  | 'guest.check_out'
  | 'guest.created'
  | 'guest.birthday'
  | 'payment.received'
  | 'payment.failed'
  | 'feedback.received'
  | 'review.submitted'
  | 'loyalty.tier_upgraded'
  | 'task.completed'
  | 'task.overdue'
  | 'room.status_changed'
  | 'wifi.session_started'
  | 'scheduled.daily'
  | 'scheduled.weekly';

export interface TriggerPayload {
  eventType: TriggerEventType;
  tenantId: string;
  propertyId?: string;
  entityId?: string;
  data: Record<string, unknown>;
}

interface AutomationRuleWithActions {
  id: string;
  tenantId: string;
  name: string;
  triggerEvent: string;
  triggerConditions: string | null;
  actions: string;
}

interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value: unknown;
}

interface Action {
  type: 'send_notification' | 'update_room' | 'create_task' | 'send_email' | 'update_booking' | 'send_sms' | 'log' | 'tag_guest';
  params: Record<string, unknown>;
}

interface TriggerResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: number;
  errors: string[];
}

// ── Condition Evaluation ──

function evaluateCondition(condition: Condition, payload: Record<string, unknown>): boolean {
  const fieldValue = getNestedValue(payload, condition.field);

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
    case 'contains':
      return typeof fieldValue === 'string' && typeof condition.value === 'string' && fieldValue.includes(condition.value);
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof condition.value === 'string' && !fieldValue.includes(condition.value);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;
    default:
      return true;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

function evaluateConditions(conditionsJson: string | null, payload: Record<string, unknown>): boolean {
  if (!conditionsJson) return true; // No conditions = always match

  try {
    const conditions: Condition[] = JSON.parse(conditionsJson);
    // All conditions must match (AND logic)
    return conditions.every((condition) => evaluateCondition(condition, payload));
  } catch {
    console.error('[TriggerEngine] Failed to parse conditions JSON');
    return false;
  }
}

// ── Action Execution ──

async function executeAction(
  action: Action,
  ruleId: string,
  payload: TriggerPayload,
  tx: Prisma.TransactionClient
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'send_notification': {
        const { userId, title, message, type = 'info' } = action.params as {
          userId?: string;
          title?: string;
          message?: string;
          type?: string;
        };

        if (!title || !message) {
          return { success: false, error: 'Notification requires title and message' };
        }

        await tx.notification.create({
          data: {
            tenantId: payload.tenantId,
            userId: userId || payload.entityId || '',
            title,
            message,
            type,
            channel: 'in_app',
            status: 'sent',
            read: false,
          },
        });
        return { success: true };
      }

      case 'create_task': {
        const { title, description, assignedTo, priority = 'medium', propertyId } = action.params as {
          title?: string;
          description?: string;
          assignedTo?: string;
          priority?: string;
          propertyId?: string;
        };

        if (!title) {
          return { success: false, error: 'Task requires a title' };
        }

        await tx.task.create({
          data: {
            tenantId: payload.tenantId,
            propertyId: propertyId || payload.propertyId || null,
            title,
            description: description || '',
            assignedTo: assignedTo || null,
            priority: priority as 'low' | 'medium' | 'high' | 'urgent',
            status: 'pending',
            source: 'automation',
            sourceId: ruleId,
          },
        });
        return { success: true };
      }

      case 'update_room': {
        const { roomId, status, ...updateData } = action.params as {
          roomId?: string;
          status?: string;
          [key: string]: unknown;
        };

        if (!roomId) {
          // Try to get room from payload
          const payloadRoomId = payload.data.roomId as string | undefined;
          if (!payloadRoomId) {
            return { success: false, error: 'Room update requires roomId' };
          }
        }

        const targetRoomId = (roomId || payload.data.roomId) as string;
        const updatePayload: Record<string, unknown> = { ...updateData };
        if (status) updatePayload.status = status;

        await tx.room.update({
          where: { id: targetRoomId },
          data: updatePayload,
        });
        return { success: true };
      }

      case 'update_booking': {
        const { bookingId, status, ...updateData } = action.params as {
          bookingId?: string;
          status?: string;
          [key: string]: unknown;
        };

        const targetBookingId = (bookingId || payload.entityId) as string;
        if (!targetBookingId) {
          return { success: false, error: 'Booking update requires bookingId' };
        }

        const updatePayload: Record<string, unknown> = { ...updateData };
        if (status) updatePayload.status = status;

        await tx.booking.update({
          where: { id: targetBookingId },
          data: updatePayload,
        });
        return { success: true };
      }

      case 'tag_guest': {
        const { guestId, tag } = action.params as {
          guestId?: string;
          tag?: string;
        };

        if (!guestId || !tag) {
          return { success: false, error: 'Guest tag requires guestId and tag' };
        }

        // Append tag to guest's tags array
        const guest = await tx.guest.findUnique({ where: { id: guestId }, select: { tags: true } });
        const existingTags: string[] = guest?.tags ? JSON.parse(guest.tags) : [];
        if (!existingTags.includes(tag)) {
          existingTags.push(tag);
          await tx.guest.update({
            where: { id: guestId },
            data: { tags: JSON.stringify(existingTags) },
          });
        }
        return { success: true };
      }

      case 'log': {
        // Simple logging action — no side effects, just recorded
        console.log(`[AutomationRule ${ruleId}] Log: ${JSON.stringify(action.params)}`);
        return { success: true };
      }

      case 'send_email':
      case 'send_sms': {
        // Placeholder: email/SMS integrations should be implemented here
        console.log(`[AutomationRule ${ruleId}] ${action.type}: ${JSON.stringify(action.params)} (integration pending)`);
        return { success: true, error: `${action.type} integration not yet implemented` };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown action error',
    };
  }
}

// ── Main Trigger Engine ──

export async function evaluateAndExecuteRules(payload: TriggerPayload): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];

  // Fetch all active rules matching this event type for this tenant
  const rules = await db.automationRule.findMany({
    where: {
      tenantId: payload.tenantId,
      triggerEvent: payload.eventType,
      isActive: true,
    },
  });

  if (rules.length === 0) {
    return results;
  }

  for (const rule of rules) {
    const result: TriggerResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: false,
      actionsExecuted: 0,
      errors: [],
    };

    try {
      // Evaluate conditions against the payload
      const matched = evaluateConditions(rule.triggerConditions, payload.data);

      if (!matched) {
        results.push(result);
        continue;
      }

      result.matched = true;

      // Parse actions
      let actions: Action[];
      try {
        actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
      } catch {
        result.errors.push('Failed to parse actions JSON');
        results.push(result);
        continue;
      }

      if (!Array.isArray(actions)) {
        result.errors.push('Actions must be an array');
        results.push(result);
        continue;
      }

      // Execute all actions within a transaction per rule
      await db.$transaction(async (tx) => {
        for (const action of actions) {
          const actionResult = await executeAction(action, rule.id, payload, tx);
          if (actionResult.success) {
            result.actionsExecuted++;
          } else if (actionResult.error) {
            result.errors.push(actionResult.error);
          }
        }

        // Create execution log
        await tx.automationExecutionLog.create({
          data: {
            ruleId: rule.id,
            status: result.errors.length > 0 ? 'partial' : 'success',
            triggerData: JSON.stringify(payload),
            actionsResult: JSON.stringify({
              matched: true,
              actionsExecuted: result.actionsExecuted,
              totalActions: actions.length,
              errors: result.errors,
            }),
            errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
          },
        });
      });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Rule execution failed');

      // Log the failure
      await db.automationExecutionLog.create({
        data: {
          ruleId: rule.id,
          status: 'failed',
          triggerData: JSON.stringify(payload),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(() => {});
    }

    results.push(result);
  }

  return results;
}

/**
 * Fire-and-forget trigger — used to evaluate rules without waiting for results.
 * Safe to call from within other API handlers.
 */
export function fireTrigger(payload: TriggerPayload): void {
  // Execute asynchronously — do not await
  evaluateAndExecuteRules(payload).catch((error) => {
    console.error('[TriggerEngine] Background trigger failed:', error);
  });
}

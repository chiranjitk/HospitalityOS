/**
 * Automation Action Executor
 *
 * Executes individual actions triggered by automation rules.
 * Each action type integrates with the appropriate StaySuite service
 * (email, SMS, notifications, database operations, external webhooks).
 *
 * Design: One failed action MUST NOT stop other actions in the sequence.
 */

import { db } from '@/lib/db';
import { sendEmailNow, type TemplatedEmailOptions } from '@/lib/services/email-service';
import { sendSMSNow, type TemplatedSMSOptions } from '@/lib/services/sms-service';
import {
  notificationService,
  type NotificationData,
} from '@/lib/services/notification-service';

// ── Types ──

/** The automation context passed through to every action */
export interface AutomationContext {
  /** The event that triggered evaluation, e.g. 'booking.created' */
  event: string;
  /** The tenant this event belongs to */
  tenantId: string;
  /** The event data (booking, guest, payment, etc.) */
  payload: Record<string, unknown>;
  /** When the event was emitted */
  timestamp: Date;
}

/** A single action from an automation rule */
export interface Action {
  /** The action type — determines which executor runs */
  type: ActionType;
  /** Configuration specific to this action type */
  config: Record<string, unknown>;
}

/** All supported action types */
export type ActionType =
  | 'send_email'
  | 'send_sms'
  | 'send_notification'
  | 'update_status'
  | 'assign_task'
  | 'post_to_folio'
  | 'webhook'
  | 'delay'
  | 'create_task'
  | 'update_room'
  | 'update_booking'
  | 'tag_guest'
  | 'log';

/** Result of executing a single action */
export interface ActionResult {
  success: boolean;
  actionType: string;
  error?: string;
  result?: unknown;
  durationMs?: number;
}

/**
 * Execute a single automation action.
 *
 * @param action - The action definition with type and config
 * @param context - The automation context (event, tenant, payload)
 * @returns An `ActionResult` indicating success/failure and any details
 */
export async function executeAction(
  action: Action,
  context: AutomationContext,
): Promise<ActionResult> {
  const startMs = Date.now();
  const { type, config } = action;

  try {
    let result: unknown;

    switch (type) {
      case 'send_email':
        result = await executeSendEmail(config, context);
        break;
      case 'send_sms':
        result = await executeSendSMS(config, context);
        break;
      case 'send_notification':
        result = await executeSendNotification(config, context);
        break;
      case 'update_status':
        result = await executeUpdateStatus(config, context);
        break;
      case 'assign_task':
      case 'create_task':
        result = await executeAssignTask(config, context);
        break;
      case 'post_to_folio':
        result = await executePostToFolio(config, context);
        break;
      case 'webhook':
        result = await executeWebhook(config, context);
        break;
      case 'delay':
        result = executeDelay(config, context);
        break;
      case 'update_room':
        result = await executeUpdateRoom(config, context);
        break;
      case 'update_booking':
        result = await executeUpdateBooking(config, context);
        break;
      case 'tag_guest':
        result = await executeTagGuest(config, context);
        break;
      case 'log':
        result = executeLog(config, context);
        break;
      default: {
        const unknownType = type as string;
        return {
          success: false,
          actionType: unknownType,
          error: `Unknown action type: ${unknownType}`,
          durationMs: Date.now() - startMs,
        };
      }
    }

    return {
      success: true,
      actionType: type,
      result,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown action error';
    return {
      success: false,
      actionType: type,
      error: message,
      durationMs: Date.now() - startMs,
    };
  }
}

// ── Action Implementations ──

/**
 * Send an email via the Email Service.
 * Config: { templateId?, to, subject?, body?, variables? }
 */
async function executeSendEmail(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ messageId?: string; provider: string }> {
  const {
    templateId,
    to,
    subject,
    body,
    html,
    variables,
  } = config as {
    templateId?: string;
    to?: string;
    subject?: string;
    body?: string;
    html?: string;
    variables?: Record<string, string | number | boolean>;
  };

  // Resolve 'to' from payload if not provided directly
  const recipientEmail = to || resolveFromPayload(context.payload, 'guest.email')
    || resolveFromPayload(context.payload, 'booking.guestEmail')
    || '';

  if (!recipientEmail) {
    throw new Error('send_email: No recipient email found in config or payload');
  }

  const emailSubject = interpolateTemplate(subject || '', context.payload);
  const emailBody = interpolateTemplate(body || html || '', context.payload);

  const resolvedVariables = variables
    ? mapValues(variables, (v) => interpolateTemplate(String(v), context.payload))
    : undefined;

  const options: TemplatedEmailOptions = {
    to: recipientEmail,
    tenantId: context.tenantId,
    subject: emailSubject,
    html: emailBody,
    text: emailBody,
    templateId,
    variables: resolvedVariables,
  };

  const result = await sendEmailNow(options);

  if (!result.success) {
    throw new Error(`send_email: ${result.error || 'Delivery failed'}`);
  }

  return { messageId: result.messageId, provider: result.provider };
}

/**
 * Send an SMS via the SMS Service.
 * Config: { to?, message?, templateId? }
 */
async function executeSendSMS(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ messageId?: string; provider: string }> {
  const {
    to,
    message,
    templateId,
    variables,
  } = config as {
    to?: string;
    message?: string;
    templateId?: string;
    variables?: Record<string, string | number | boolean>;
  };

  const recipientPhone = to || resolveFromPayload(context.payload, 'guest.phone')
    || resolveFromPayload(context.payload, 'booking.guestPhone')
    || '';

  if (!recipientPhone) {
    throw new Error('send_sms: No recipient phone found in config or payload');
  }

  const smsMessage = interpolateTemplate(message || '', context.payload);

  const resolvedVariables = variables
    ? mapValues(variables, (v) => interpolateTemplate(String(v), context.payload))
    : undefined;

  const options: TemplatedSMSOptions = {
    to: recipientPhone,
    message: smsMessage,
    tenantId: context.tenantId,
    templateId,
    variables: resolvedVariables,
  };

  const result = await sendSMSNow(options);

  if (!result.success) {
    throw new Error(`send_sms: ${result.error || 'Delivery failed'}`);
  }

  return { messageId: result.messageId, provider: result.provider };
}

/**
 * Send an in-app notification via the Notification Service.
 * Config: { userId?, title, message, type?, category?, link? }
 */
async function executeSendNotification(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ notificationId?: string }> {
  const {
    userId,
    guestId,
    title,
    message,
    type,
    category,
    link,
    priority,
    channels,
  } = config as {
    userId?: string;
    guestId?: string;
    title?: string;
    message?: string;
    type?: string;
    category?: string;
    link?: string;
    priority?: string;
    channels?: string[];
  };

  const resolvedTitle = interpolateTemplate(title || '', context.payload);
  const resolvedMessage = interpolateTemplate(message || '', context.payload);

  if (!resolvedTitle || !resolvedMessage) {
    throw new Error('send_notification: title and message are required');
  }

  const data: NotificationData = {
    tenantId: context.tenantId,
    userId: userId || resolveFromPayload(context.payload, 'userId') || undefined,
    guestId: guestId || resolveFromPayload(context.payload, 'guestId') || undefined,
    type: type || 'automation',
    category: (category as NotificationData['category']) || 'info',
    title: resolvedTitle,
    message: resolvedMessage,
    link: link ? interpolateTemplate(link, context.payload) : undefined,
    priority: (priority as NotificationData['priority']) || 'normal',
    channels: channels as NotificationData['channels'],
  };

  const result = await notificationService.send(data);

  if (!result.success && result.errors?.length) {
    throw new Error(`send_notification: ${result.errors.join(', ')}`);
  }

  return { notificationId: result.notificationId };
}

/**
 * Update a record's status field.
 * Config: { model, id, status }
 */
async function executeUpdateStatus(
  config: Record<string, unknown>,
  _context: AutomationContext,
): Promise<{ model: string; id: string; status: string }> {
  const { model, id, status } = config as {
    model?: string;
    id?: string;
    status?: string;
  };

  if (!model || !id || !status) {
    throw new Error('update_status: model, id, and status are required');
  }

  const modelMap: Record<string, { update: (args: { where: { id: string }; data: { status: string } }) => Promise<unknown> }> = {
    booking: db.booking,
    folio: db.folio,
    task: db.task,
    room: db.room,
    guest: db.guest,
  };

  const modelClient = modelMap[model];
  if (!modelClient) {
    throw new Error(`update_status: Unsupported model "${model}". Supported: ${Object.keys(modelMap).join(', ')}`);
  }

  await modelClient.update({ where: { id }, data: { status } });

  return { model, id, status };
}

/**
 * Create and optionally assign a task.
 * Config: { title, description?, department?, priority?, assignedTo?, propertyId? }
 */
async function executeAssignTask(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ taskId: string }> {
  const {
    title,
    description,
    department,
    priority,
    assignedTo,
    propertyId,
    type,
    category,
  } = config as {
    title?: string;
    description?: string;
    department?: string;
    priority?: string;
    assignedTo?: string;
    propertyId?: string;
    type?: string;
    category?: string;
  };

  const resolvedTitle = interpolateTemplate(title || '', context.payload);
  const resolvedDescription = interpolateTemplate(description || '', context.payload);

  if (!resolvedTitle) {
    throw new Error('assign_task: title is required');
  }

  const resolvedPropertyId =
    propertyId ||
    resolveFromPayload(context.payload, 'propertyId') ||
    resolveFromPayload(context.payload, 'booking.propertyId');

  if (!resolvedPropertyId) {
    throw new Error('assign_task: propertyId is required (provide in config or payload)');
  }

  const task = await db.task.create({
    data: {
      tenantId: context.tenantId,
      propertyId: resolvedPropertyId,
      title: resolvedTitle,
      description: resolvedDescription || '',
      type: type || department || 'general',
      category: category || department || 'general',
      priority: (priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
      status: 'pending',
      assignedTo: assignedTo || null,
      createdBy: resolveFromPayload(context.payload, 'userId') || null,
      source: 'automation',
    },
  });

  return { taskId: task.id };
}

/**
 * Post a charge to a booking's folio by creating a FolioLineItem.
 * Config: { bookingId, description, amount, category?, quantity?, taxRate? }
 */
async function executePostToFolio(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ lineItemId: string; folioId: string }> {
  const {
    bookingId,
    folioId: explicitFolioId,
    description,
    amount,
    category,
    quantity,
    taxRate,
  } = config as {
    bookingId?: string;
    folioId?: string;
    description?: string;
    amount?: number;
    category?: string;
    quantity?: number;
    taxRate?: number;
  };

  const resolvedBookingId =
    bookingId ||
    resolveFromPayload(context.payload, 'booking.id') ||
    resolveFromPayload(context.payload, 'bookingId');

  if (!resolvedBookingId && !explicitFolioId) {
    throw new Error('post_to_folio: bookingId or folioId is required');
  }

  const resolvedDescription = interpolateTemplate(description || 'Automated charge', context.payload);
  const resolvedAmount = typeof amount === 'number' ? amount : 0;
  const resolvedQuantity = typeof quantity === 'number' ? quantity : 1;
  const resolvedTaxRate = typeof taxRate === 'number' ? taxRate : 0;
  const resolvedCategory = category || 'miscellaneous';

  // Find or determine the folio
  let targetFolioId = explicitFolioId;

  if (!targetFolioId && resolvedBookingId) {
    // Find the first open folio for the booking
    const folio = await db.folio.findFirst({
      where: { bookingId: resolvedBookingId, status: 'open' },
      select: { id: true },
    });
    targetFolioId = folio?.id;

    if (!targetFolioId) {
      throw new Error(`post_to_folio: No open folio found for booking ${resolvedBookingId}`);
    }
  }

  if (!targetFolioId) {
    throw new Error('post_to_folio: Could not determine target folio');
  }

  const unitPrice = resolvedAmount;
  const totalAmount = unitPrice * resolvedQuantity;
  const taxAmount = totalAmount * (resolvedTaxRate / 100);

  const lineItem = await db.folioLineItem.create({
    data: {
      folioId: targetFolioId,
      description: resolvedDescription,
      category: resolvedCategory,
      quantity: resolvedQuantity,
      unitPrice,
      totalAmount,
      serviceDate: new Date(),
      referenceType: 'automation',
      taxRate: resolvedTaxRate,
      taxAmount,
      itemCurrency: 'USD',
    },
  });

  // Update folio totals
  await db.folio.update({
    where: { id: targetFolioId },
    data: {
      subtotal: { increment: totalAmount },
      taxes: { increment: taxAmount },
      totalAmount: { increment: totalAmount + taxAmount },
    },
  });

  return { lineItemId: lineItem.id, folioId: targetFolioId };
}

/**
 * Call an external webhook URL.
 * Config: { url, method?, headers?, body?, timeout? }
 */
async function executeWebhook(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ status: number; body: string }> {
  const {
    url,
    method,
    headers,
    body,
    timeout,
  } = config as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeout?: number;
  };

  if (!url) {
    throw new Error('webhook: url is required');
  }

  const resolvedUrl = interpolateTemplate(url, context.payload);
  const resolvedMethod = (method || 'POST').toUpperCase();
  const resolvedTimeout = typeof timeout === 'number' ? timeout : 10000;

  // Build request body: merge explicit body with context
  const requestBody = {
    event: context.event,
    timestamp: context.timestamp.toISOString(),
    tenantId: context.tenantId,
    payload: context.payload,
    ...(body || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolvedTimeout);

  try {
    const response = await fetch(resolvedUrl, {
      method: resolvedMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-StaySuite-Event': context.event,
        'X-StaySuite-Tenant': context.tenantId,
        ...(headers || {}),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `webhook: HTTP ${response.status} — ${responseBody.substring(0, 200)}`,
      );
    }

    return { status: response.status, body: responseBody.substring(0, 1000) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`webhook: Request timed out after ${resolvedTimeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Schedule a delayed action (logged but not yet scheduled for future execution).
 * Config: { duration?, durationUnit? }
 */
function executeDelay(
  config: Record<string, unknown>,
  context: AutomationContext,
): { message: string; scheduledFor: string } {
  const { duration, durationUnit } = config as {
    duration?: number;
    durationUnit?: string;
  };

  const resolvedDuration = typeof duration === 'number' ? duration : 0;
  const unit = durationUnit || 'minutes';

  const msMultipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  };

  const ms = resolvedDuration * (msMultipliers[unit] || 60_000);
  const scheduledFor = new Date(Date.now() + ms).toISOString();

  console.log(
    `[Automation:delay] Event "${context.event}" — delayed ${resolvedDuration} ${unit}. ` +
    `Scheduled for ${scheduledFor}. (Future scheduler integration needed)`,
  );

  return {
    message: `Delay action logged. ${resolvedDuration} ${unit} from now. Scheduled for: ${scheduledFor}`,
    scheduledFor,
  };
}

/**
 * Update a room record.
 * Config: { roomId?, status?, ...extra fields }
 */
async function executeUpdateRoom(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ roomId: string }> {
  const { roomId, status, ...extraData } = config as {
    roomId?: string;
    status?: string;
    [key: string]: unknown;
  };

  const targetRoomId =
    roomId ||
    resolveFromPayload(context.payload, 'room.id') ||
    resolveFromPayload(context.payload, 'roomId');

  if (!targetRoomId) {
    throw new Error('update_room: roomId is required');
  }

  const data: Record<string, unknown> = { ...extraData };
  if (status) data.status = status;

  await db.room.update({
    where: { id: targetRoomId },
    data,
  });

  return { roomId: targetRoomId };
}

/**
 * Update a booking record.
 * Config: { bookingId?, status?, ...extra fields }
 */
async function executeUpdateBooking(
  config: Record<string, unknown>,
  context: AutomationContext,
): Promise<{ bookingId: string }> {
  const { bookingId, status, ...extraData } = config as {
    bookingId?: string;
    status?: string;
    [key: string]: unknown;
  };

  const targetBookingId =
    bookingId ||
    resolveFromPayload(context.payload, 'booking.id') ||
    resolveFromPayload(context.payload, 'bookingId');

  if (!targetBookingId) {
    throw new Error('update_booking: bookingId is required');
  }

  const data: Record<string, unknown> = { ...extraData };
  if (status) data.status = status;

  await db.booking.update({
    where: { id: targetBookingId },
    data,
  });

  return { bookingId: targetBookingId };
}

/**
 * Tag a guest with a label.
 * Config: { guestId, tag }
 */
async function executeTagGuest(
  config: Record<string, unknown>,
  _context: AutomationContext,
): Promise<{ guestId: string; tag: string }> {
  const { guestId, tag } = config as {
    guestId?: string;
    tag?: string;
  };

  if (!guestId || !tag) {
    throw new Error('tag_guest: guestId and tag are required');
  }

  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: { tags: true },
  });

  if (!guest) {
    throw new Error(`tag_guest: Guest ${guestId} not found`);
  }

  const existingTags: string[] = guest.tags ? JSON.parse(guest.tags) : [];
  if (!existingTags.includes(tag)) {
    existingTags.push(tag);
    await db.guest.update({
      where: { id: guestId },
      data: { tags: JSON.stringify(existingTags) },
    });
  }

  return { guestId, tag };
}

/**
 * Simple log action — records to console and returns the logged data.
 * Config: { message?, ...extra }
 */
function executeLog(
  config: Record<string, unknown>,
  context: AutomationContext,
): { logged: true; config: Record<string, unknown> } {
  const { message, ...rest } = config;
  console.log(
    `[Automation:log] Event "${context.event}" — ${message || 'No message'}`,
    { config: rest, payload: context.payload },
  );
  return { logged: true, config };
}

// ── Utility Helpers ──

/**
 * Resolve a value from the event payload using dot notation.
 * Returns the value as a string if found, otherwise undefined.
 */
function resolveFromPayload(
  payload: Record<string, unknown>,
  path: string,
): string | undefined {
  const segments = path.split('.');
  let current: unknown = payload;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current !== undefined && current !== null ? String(current) : undefined;
}

/**
 * Simple template interpolation — replaces `{{field.path}}` with values from payload.
 * Only replaces references that resolve to a string.
 */
function interpolateTemplate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const value = resolveFromPayload(payload, path.trim());
    return value || `{{${path.trim()}}}`;
  });
}

/**
 * Map object values through a transform function.
 */
function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T) => U,
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value);
  }
  return result;
}

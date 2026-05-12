/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Webhook Router — receives, validates, deduplicates and dispatches vendor
 * webhook payloads.
 */

import { db } from '@/lib/db';
import type { IHardwareAdapter, WebhookPayload, HardwareResult } from './types';
import { hardwareRegistry } from './registry';
import {
  createHardwareError,
  HardwareErrorCode,
} from './errors';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WebhookProcessingResult {
  acknowledged: boolean;
  processedEvents: number;
  error?: string;
}

/**
 * Process an incoming webhook from a hardware vendor.
 *
 * Flow:
 *  1. Look up the adapter config in `HardwareAdapter` (by providerId).
 *  2. Extract vendorEventId from the raw body (provider-specific heuristics).
 *  3. Idempotency check / upsert via `HardwareWebhookLog`.
 *  4. Resolve the adapter instance from the registry.
 *  5. Verify the webhook signature.
 *  6. Delegate to `adapter.processWebhook()`.
 *  7. Persist the result back to the webhook log.
 */
export async function processWebhook(
  providerId: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<WebhookProcessingResult> {
  // ------------------------------------------------------------------
  // 1. Find adapter config in DB
  // ------------------------------------------------------------------
  const adapterConfig = await db.hardwareAdapter.findFirst({
    where: { providerId, enabled: true },
  });

  if (!adapterConfig) {
    console.warn(
      `[HAL:WebhookRouter] No active adapter found for provider "${providerId}"`,
    );
    return { acknowledged: false, processedEvents: 0, error: 'ADAPTER_NOT_FOUND' };
  }

  // ------------------------------------------------------------------
  // 2. Extract vendorEventId (provider-specific parsing)
  // ------------------------------------------------------------------
  const vendorEventId = extractVendorEventId(providerId, rawBody);

  if (!vendorEventId) {
    console.warn(
      `[HAL:WebhookRouter] Could not extract vendorEventId for provider "${providerId}"`,
    );
    return {
      acknowledged: false,
      processedEvents: 0,
      error: 'EVENT_ID_EXTRACTION_FAILED',
    };
  }

  // ------------------------------------------------------------------
  // 3. Idempotency check via HardwareWebhookLog (upsert)
  // ------------------------------------------------------------------
  const eventType = extractEventType(providerId, rawBody) ?? 'unknown';
  const signature = headers['x-signature'] ?? headers['stripe-signature'] ?? headers['signature'] ?? undefined;

  const webhookLog = await db.hardwareWebhookLog.upsert({
    where: {
      providerId_vendorEventId: { providerId, vendorEventId },
    },
    create: {
      tenantId: adapterConfig.tenantId,
      providerId,
      vendorEventId,
      eventType,
      rawBody,
      signature,
      processingStatus: 'processing',
    },
    update: {
      // If we already processed this event, skip it.
      // Only update the `receivedAt` for dedup bookkeeping.
      receivedAt: new Date(),
    },
  });

  // If it was already completed, return early.
  if (webhookLog.processingStatus === 'completed') {
    return { acknowledged: true, processedEvents: 0 };
  }

  // ------------------------------------------------------------------
  // 4. Get adapter from registry
  // ------------------------------------------------------------------
  let adapter: IHardwareAdapter | undefined;
  try {
    adapter = hardwareRegistry.getAdapterSync(adapterConfig.propertyId, providerId);
  } catch {
    // fall through to error handling below
  }

  if (!adapter) {
    await db.hardwareWebhookLog.update({
      where: { id: webhookLog.id },
      data: {
        processingStatus: 'failed',
        errorMessage: 'ADAPTER_NOT_AVAILABLE_IN_REGISTRY',
        processedAt: new Date(),
      },
    });

    return {
      acknowledged: false,
      processedEvents: 0,
      error: 'ADAPTER_NOT_AVAILABLE_IN_REGISTRY',
    };
  }

  // ------------------------------------------------------------------
  // 5. Verify webhook signature
  // ------------------------------------------------------------------
  try {
    const valid = await adapter.verifyWebhookSignature(rawBody, headers);
    if (!valid) {
      await db.hardwareWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processingStatus: 'failed',
          errorMessage: 'WEBHOOK_SIGNATURE_INVALID',
          processedAt: new Date(),
        },
      });

      return {
        acknowledged: false,
        processedEvents: 0,
        error: 'WEBHOOK_SIGNATURE_INVALID',
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.hardwareWebhookLog.update({
      where: { id: webhookLog.id },
      data: {
        processingStatus: 'failed',
        errorMessage: `Signature verification error: ${msg}`,
        processedAt: new Date(),
      },
    });

    return {
      acknowledged: false,
      processedEvents: 0,
      error: 'WEBHOOK_SIGNATURE_INVALID',
    };
  }

  // ------------------------------------------------------------------
  // 6. Process the webhook
  // ------------------------------------------------------------------
  const payload: WebhookPayload = {
    providerId,
    vendorEventId,
    eventType,
    receivedAt: new Date().toISOString(),
    rawBody,
    signature,
  };

  let result: HardwareResult<Record<string, unknown>[]>;

  try {
    result = await adapter.processWebhook(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await db.hardwareWebhookLog.update({
      where: { id: webhookLog.id },
      data: {
        processingStatus: 'failed',
        errorMessage: `Processing error: ${msg}`,
        processedAt: new Date(),
      },
    });

    return {
      acknowledged: false,
      processedEvents: 0,
      error: 'WEBHOOK_PROCESSING_FAILED',
    };
  }

  // ------------------------------------------------------------------
  // 7. Persist result to webhook log
  // ------------------------------------------------------------------
  const processedEvents = result.success && Array.isArray(result.data)
    ? result.data.length
    : 0;

  await db.hardwareWebhookLog.update({
    where: { id: webhookLog.id },
    data: {
      processingStatus: result.success ? 'completed' : 'failed',
      errorMessage: result.error,
      responseJson: result.data ? JSON.stringify(result.data) : undefined,
      processedAt: new Date(),
    },
  });

  // ------------------------------------------------------------------
  // 8. Write domain events to DB (domain event outbox pattern)
  // ------------------------------------------------------------------
  if (result.success && Array.isArray(result.data) && result.data.length > 0) {
    await persistDomainEvents(adapterConfig.tenantId, adapterConfig.propertyId, providerId, result.data);
  }

  return {
    acknowledged: true,
    processedEvents,
  };
}

// ---------------------------------------------------------------------------
// Domain event persistence
// ---------------------------------------------------------------------------

/**
 * Persist structured domain events from a webhook into the `Event` table so
 * downstream services can react without coupling to the hardware layer.
 */
async function persistDomainEvents(
  tenantId: string,
  propertyId: string,
  providerId: string,
  events: Record<string, unknown>[],
): Promise<void> {
  const rows = events.map((event) => ({
    tenantId,
    propertyId,
    type: `${providerId}:${String(event.eventType ?? event.type ?? 'unknown')}`,
    payload: JSON.stringify(event),
    source: 'hardware_webhook',
    status: 'pending' as const,
  }));

  try {
    await db.event.createMany({ data: rows });
  } catch (err) {
    // Non-critical — log and continue
    console.error(
      '[HAL:WebhookRouter] Failed to persist domain events',
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Provider-specific event ID / type extraction helpers
// ---------------------------------------------------------------------------

function extractVendorEventId(providerId: string, rawBody: string): string | null {
  try {
    const body: Record<string, unknown> = JSON.parse(rawBody);

    // Common patterns — try the most likely keys first.
    const candidateKeys = [
      'id',
      'event_id',
      'eventId',
      'webhook_id',
      'uid',
      'uuid',
      'notification_id',
    ];

    for (const key of candidateKeys) {
      if (typeof body[key] === 'string' && body[key]) {
        return body[key] as string;
      }
    }

    // Provider-specific fallbacks
    switch (providerId) {
      case 'stripe-terminal':
      case 'stripe-terminal':
        return (body.id ?? body.object) as string | null ?? null;
      case 'assa-abloy-visionline':
        return (body.messageId ?? body.id) as string | null ?? null;
      case 'salto-ks':
        return (body.eventId ?? body.id) as string | null ?? null;
      case 'dormakaba-saflok':
        return (body.notificationId ?? body.id) as string | null ?? null;
      case 'adyen-terminal':
        return (body.notificationReference ?? body.id) as string | null ?? null;
      case 'square-terminal':
        return (body.event_id ?? body.id) as string | null ?? null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function extractEventType(providerId: string, rawBody: string): string | null {
  try {
    const body: Record<string, unknown> = JSON.parse(rawBody);

    const candidateKeys = [
      'type',
      'event_type',
      'eventType',
      'event',
      'action',
    ];

    for (const key of candidateKeys) {
      if (typeof body[key] === 'string' && body[key]) {
        return body[key] as string;
      }
    }

    return null;
  } catch {
    return null;
  }
}

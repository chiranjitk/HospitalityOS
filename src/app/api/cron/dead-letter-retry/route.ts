/**
 * Dead Letter Queue Retry Cron Endpoint
 *
 * POST /api/cron/dead-letter-retry
 *   Scans the ChannelDeadLetterQueue for entries that are due for retry,
 *   re-processes the original webhook payload, and handles backoff.
 *
 *   Fixes H-27: Dead letter queue entries that were stored but never retried
 *   beyond a single immediate retry. This cron implements scheduled retries
 *   with exponential backoff (1min, 5min, 15min, 1hr, 4hr) up to 5 attempts,
 *   after which entries are marked as permanently failed for manual review.
 *
 *   Should be called by an external cron scheduler (e.g., cron-job.org,
 *   Vercel Cron, AWS EventBridge).
 *
 *   Recommended schedule: Every 5 minutes (see GET endpoint)
 *
 * GET /api/cron/dead-letter-retry
 *   Returns endpoint status and configuration info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  handleReservationCreated,
  handleReservationModified,
  handleReservationCancelled,
  type OTAWebhookPayload,
} from '@/app/api/ota/webhooks/route';

// ─── Cron Secret ──────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON:dead-letter-retry] CRON_SECRET environment variable is required');
}
const CRON_SECRET_VALUE = CRON_SECRET;

function verifyCronSecret(request: NextRequest): boolean {
  if (!CRON_SECRET_VALUE) return false;
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  return providedSecret === CRON_SECRET_VALUE;
}

// ─── Exponential Backoff Configuration ───────────────────────────────────────
// attemptCount 0 → 1 min, 1 → 5 min, 2 → 15 min, 3 → 1 hr, 4 → 4 hr
// After attemptCount reaches 5 (after 5 failed retries), mark permanently_failed.

const BACKOFF_DELAYS_MS: number[] = [
  1 * 60 * 1000,        // 1 minute
  5 * 60 * 1000,        // 5 minutes
  15 * 60 * 1000,       // 15 minutes
  60 * 60 * 1000,       // 1 hour
  4 * 60 * 60 * 1000,   // 4 hours
];

const MAX_RETRIES = 5;

/**
 * Calculate the next retry time based on the current attempt count.
 * Uses exponential backoff from the table above, clamped to array bounds.
 */
function calculateNextRetryAt(attemptCount: number): Date {
  const index = Math.min(attemptCount, BACKOFF_DELAYS_MS.length - 1);
  const delay = BACKOFF_DELAYS_MS[index];
  return new Date(Date.now() + delay);
}

/**
 * Calculate nextRetryAt from createdAt for legacy entries that have no nextRetryAt set.
 * Uses the same backoff delays based on current attemptCount.
 */
function calculateNextRetryFromCreatedAt(createdAt: Date, attemptCount: number): Date {
  const index = Math.min(attemptCount, BACKOFF_DELAYS_MS.length - 1);
  const delay = BACKOFF_DELAYS_MS[index];
  return new Date(createdAt.getTime() + delay);
}

// ─── DLQ Re-processing Logic ─────────────────────────────────────────────────

interface RetryResult {
  entryId: string;
  channelCode: string;
  operation: string;
  attemptCount: number;
  outcome: 'resolved' | 'retried' | 'permanently_failed';
  error?: string;
}

/**
 * Re-process a single dead letter queue entry.
 * Returns the outcome for reporting.
 */
async function processDlqEntry(entry: {
  id: string;
  tenantId: string;
  propertyId: string | null;
  channelCode: string;
  operation: string;
  payload: string;
  attemptCount: number;
}): Promise<RetryResult> {
  const result: RetryResult = {
    entryId: entry.id,
    channelCode: entry.channelCode,
    operation: entry.operation,
    attemptCount: entry.attemptCount,
    outcome: 'retried',
  };

  // Parse the original payload
  let parsedPayload: OTAWebhookPayload;
  try {
    parsedPayload = JSON.parse(entry.payload);
  } catch {
    // Unparseable payload — mark permanently failed
    await db.channelDeadLetterQueue.update({
      where: { id: entry.id },
      data: {
        status: 'permanently_failed',
        error: 'Failed to parse payload JSON — cannot retry',
      },
    });
    result.outcome = 'permanently_failed';
    result.error = 'Unparseable payload';
    return result;
  }

  // Find the active channel connection for this tenant/channel
  const connection = await db.channelConnection.findFirst({
    where: {
      channel: entry.channelCode,
      tenantId: entry.tenantId,
      status: 'active',
      ...(entry.propertyId ? { propertyId: entry.propertyId } : {}),
    },
  });

  if (!connection) {
    // No connection available — mark permanently failed since there's nothing to do
    await db.channelDeadLetterQueue.update({
      where: { id: entry.id },
      data: {
        status: 'permanently_failed',
        error: `No active channel connection found for ${entry.channelCode} (tenant: ${entry.tenantId})`,
      },
    });
    result.outcome = 'permanently_failed';
    result.error = 'No active channel connection';
    return result;
  }

  // Attempt to re-process based on event type
  try {
    switch (parsedPayload.event_type) {
      case 'reservation_created':
        await handleReservationCreated(entry.tenantId, connection, parsedPayload);
        break;
      case 'reservation_modified':
        await handleReservationModified(entry.tenantId, connection, parsedPayload);
        break;
      case 'reservation_cancelled':
        await handleReservationCancelled(entry.tenantId, connection, parsedPayload);
        break;
      default:
        throw new Error(`Unknown event_type: ${parsedPayload.event_type}`);
    }

    // ── Success: Mark as resolved ──────────────────────────────────────────
    await db.channelDeadLetterQueue.update({
      where: { id: entry.id },
      data: {
        status: 'resolved',
        nextRetryAt: null,
        error: '', // Clear the error
      },
    });

    // Log a sync record for audit trail
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: 'bookings',
        direction: 'inbound',
        status: 'success',
        correlationId: `dlq-retry:${entry.id}`,
        requestPayload: entry.payload,
        responsePayload: JSON.stringify({ source: 'dlq_retry', dlqEntryId: entry.id }),
      },
    });

    result.outcome = 'resolved';
    console.log(`[DLQ-RETRY] Entry ${entry.id} resolved successfully after ${entry.attemptCount} prior attempts`);
    return result;

  } catch (processError) {
    const errorMessage = processError instanceof Error ? processError.message : 'Unknown processing error';
    const newAttemptCount = entry.attemptCount + 1;

    if (newAttemptCount >= MAX_RETRIES) {
      // ── Exhausted retries: Mark permanently failed ─────────────────────
      await db.channelDeadLetterQueue.update({
        where: { id: entry.id },
        data: {
          attemptCount: newAttemptCount,
          status: 'permanently_failed',
          nextRetryAt: null,
          error: `Permanently failed after ${MAX_RETRIES} attempts. Last error: ${errorMessage}`,
        },
      });

      // Log for manual review
      console.error(
        `[DLQ-RETRY] Entry ${entry.id} PERMANENTLY FAILED after ${MAX_RETRIES} attempts. ` +
        `Channel: ${entry.channelCode}, Tenant: ${entry.tenantId}, Error: ${errorMessage}`
      );

      // Create an audit log for visibility
      try {
        await db.auditLog.create({
          data: {
            tenantId: entry.tenantId,
            module: 'channel_manager',
            action: 'error',
            entityType: 'channelDeadLetterQueue',
            entityId: entry.id,
            newValue: JSON.stringify({
              action: 'permanently_failed',
              channelCode: entry.channelCode,
              operation: entry.operation,
              attemptCount: newAttemptCount,
              lastError: errorMessage,
              payloadPreview: entry.payload.substring(0, 500),
            }),
          },
        });
      } catch {
        // Audit log creation failure should not block the retry process
      }

      result.outcome = 'permanently_failed';
      result.error = errorMessage;
    } else {
      // ── Retryable failure: Schedule next attempt ─────────────────────────
      const nextRetryAt = calculateNextRetryAt(newAttemptCount);
      await db.channelDeadLetterQueue.update({
        where: { id: entry.id },
        data: {
          attemptCount: newAttemptCount,
          nextRetryAt,
          error: errorMessage,
        },
      });

      const delayLabel = BACKOFF_DELAYS_MS[newAttemptCount]
        ? `${BACKOFF_DELAYS_MS[newAttemptCount] / 1000}s`
        : 'max';
      console.warn(
        `[DLQ-RETRY] Entry ${entry.id} failed attempt ${newAttemptCount}/${MAX_RETRIES}. ` +
        `Next retry in ${delayLabel}. Error: ${errorMessage}`
      );

      result.outcome = 'retried';
      result.error = errorMessage;
    }

    return result;
  }
}

// ─── Core Retry Execution ─────────────────────────────────────────────────────

async function runDeadLetterRetry(): Promise<{
  success: boolean;
  scanned: number;
  resolved: number;
  retried: number;
  permanentlyFailed: number;
  skipped: number;
  results: RetryResult[];
  durationMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  const results: RetryResult[] = [];

  let resolved = 0;
  let retried = 0;
  let permanentlyFailed = 0;
  let skipped = 0;

  try {
    const now = new Date();

    // Query entries that are:
    //   - status = 'pending' (not already resolved or permanently failed)
    //   - attemptCount < MAX_RETRIES
    //   - nextRetryAt is NULL (legacy entries) or nextRetryAt <= now (due for retry)
    //
    // For legacy entries with no nextRetryAt, we calculate eligibility from createdAt:
    // We'll fetch those separately and filter in-memory.

    const eligibleEntries = await db.channelDeadLetterQueue.findMany({
      where: {
        status: 'pending',
        attemptCount: { lt: MAX_RETRIES },
        OR: [
          { nextRetryAt: { lte: now } },
          { nextRetryAt: null },
        ],
      },
      orderBy: { createdAt: 'asc' }, // Process oldest entries first
      take: 50, // Batch limit to avoid long-running cron jobs
    });

    for (const entry of eligibleEntries) {
      // For legacy entries with no nextRetryAt, check if enough time has passed
      // based on the exponential backoff schedule relative to createdAt
      if (!entry.nextRetryAt) {
        const calculatedNext = calculateNextRetryFromCreatedAt(entry.createdAt, entry.attemptCount);
        if (calculatedNext > now) {
          skipped++;
          continue; // Not yet due for retry
        }
      }

      try {
        const retryResult = await processDlqEntry(entry);
        results.push(retryResult);

        switch (retryResult.outcome) {
          case 'resolved':
            resolved++;
            break;
          case 'retried':
            retried++;
            break;
          case 'permanently_failed':
            permanentlyFailed++;
            break;
        }
      } catch (entryError) {
        // Unexpected error processing this entry — skip and continue
        console.error(`[DLQ-RETRY] Unexpected error processing entry ${entry.id}:`, entryError);
        skipped++;
      }
    }

    const durationMs = Date.now() - startTime;

    console.log(
      `[DLQ-RETRY] Batch complete in ${durationMs}ms — ` +
      `scanned: ${eligibleEntries.length}, resolved: ${resolved}, retried: ${retried}, ` +
      `permanentlyFailed: ${permanentlyFailed}, skipped: ${skipped}`
    );

    return {
      success: true,
      scanned: eligibleEntries.length,
      resolved,
      retried,
      permanentlyFailed,
      skipped,
      results,
      durationMs,
    };
  } catch (error) {
    console.error('[DLQ-RETRY] Fatal error:', error);
    return {
      success: false,
      scanned: 0,
      resolved: 0,
      retried: 0,
      permanentlyFailed: 0,
      skipped: 0,
      results: [],
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── POST: Trigger dead letter queue retry ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET not configured' } },
        { status: 500 }
      );
    }

    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
        { status: 401 }
      );
    }

    // Parse optional body for configuration
    const body = await request.json().catch(() => ({}));
    const { dryRun = false } = body as { dryRun?: boolean };

    if (dryRun) {
      const now = new Date();
      const pendingCount = await db.channelDeadLetterQueue.count({
        where: {
          status: 'pending',
          attemptCount: { lt: MAX_RETRIES },
          OR: [
            { nextRetryAt: { lte: now } },
            { nextRetryAt: null },
          ],
        },
      });

      const failedCount = await db.channelDeadLetterQueue.count({
        where: { status: 'permanently_failed' },
      });

      const resolvedCount = await db.channelDeadLetterQueue.count({
        where: { status: 'resolved' },
      });

      return NextResponse.json({
        success: true,
        message: 'Dry run — no retries were performed',
        data: {
          dryRun: true,
          eligibleForRetry: pendingCount,
          permanentlyFailed: failedCount,
          alreadyResolved: resolvedCount,
          maxRetries: MAX_RETRIES,
          backoffSchedule: ['1min', '5min', '15min', '1hr', '4hr'],
        },
      });
    }

    const result = await runDeadLetterRetry();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.scanned > 0
          ? `Processed ${result.scanned} DLQ entries: ${result.resolved} resolved, ${result.retried} scheduled for retry, ${result.permanentlyFailed} permanently failed`
          : 'No DLQ entries eligible for retry',
        data: {
          scanned: result.scanned,
          resolved: result.resolved,
          retried: result.retried,
          permanentlyFailed: result.permanentlyFailed,
          skipped: result.skipped,
          durationMs: result.durationMs,
          results: result.results,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'PROCESS_ERROR', message: result.error || 'DLQ retry failed' } },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[CRON:dead-letter-retry] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run dead letter retry' } },
      { status: 500 }
    );
  }
}

// ─── GET: Health check / endpoint info ────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!CRON_SECRET_VALUE) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 }
    );
  }

  // Gather current DLQ stats
  const pendingCount = await db.channelDeadLetterQueue.count({ where: { status: 'pending' } });
  const resolvedCount = await db.channelDeadLetterQueue.count({ where: { status: 'resolved' } });
  const failedCount = await db.channelDeadLetterQueue.count({ where: { status: 'permanently_failed' } });

  return NextResponse.json({
    success: true,
    message: 'Dead letter queue retry cron endpoint is active',
    data: {
      endpoint: '/api/cron/dead-letter-retry',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      body: {
        dryRun: 'boolean (optional) — preview eligible entries without retrying',
      },
      recommendedSchedule: '*/5 * * * * (every 5 minutes)',
      config: {
        maxRetries: MAX_RETRIES,
        backoffSchedule: ['1min', '5min', '15min', '1hr', '4hr'],
        batchSize: 50,
      },
      currentStats: {
        pending: pendingCount,
        resolved: resolvedCount,
        permanentlyFailed: failedCount,
      },
    },
  });
}

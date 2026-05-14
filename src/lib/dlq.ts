/**
 * Dead Letter Queue Library (Feature #43)
 *
 * Framework for capturing, retrying, and resolving failed operations.
 */

import { db } from './db';
import { logger } from './logger';

export async function addToDLQ(params: {
  tenantId: string;
  source: string;
  entityType: string;
  entityId?: string;
  payload: unknown;
  error: string | Error;
}): Promise<void> {
  const errorMsg = typeof params.error === 'string' ? params.error : params.error.message;
  const payloadStr = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload);

  await db.deadLetterQueue.create({
    data: {
      tenantId: params.tenantId,
      source: params.source,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: payloadStr,
      error: errorMsg,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min first retry
    },
  });

  logger.warn('Added to DLQ', { source: params.source, entityType: params.entityType, tenantId: params.tenantId });
}

export async function retryFromDLQ(id: string): Promise<boolean> {
  const entry = await db.deadLetterQueue.findUnique({ where: { id } });
  if (!entry) return false;

  if (entry.retryCount >= entry.maxRetries) {
    await db.deadLetterQueue.update({
      where: { id },
      data: { status: 'failed' },
    });
    logger.error('DLQ entry exceeded max retries', undefined, { id, source: entry.source });
    return false;
  }

  const nextRetry = new Date(Date.now() + Math.pow(2, entry.retryCount) * 60 * 1000); // Exponential backoff

  await db.deadLetterQueue.update({
    where: { id },
    data: {
      retryCount: { increment: 1 },
      nextRetryAt: nextRetry,
      status: 'processing',
    },
  });

  logger.info('DLQ entry queued for retry', { id, retryCount: entry.retryCount + 1 });
  return true;
}

export async function resolveDLQ(id: string, resolution: string, resolvedBy?: string): Promise<void> {
  await db.deadLetterQueue.update({
    where: { id },
    data: {
      status: 'resolved',
      resolution,
      resolvedBy,
      resolvedAt: new Date(),
    },
  });

  logger.info('DLQ entry resolved', { id, resolution });
}

export async function getDLQStats(tenantId: string): Promise<{
  pending: number;
  processing: number;
  resolved: number;
  failed: number;
}> {
  const [pending, processing, resolved, failed] = await Promise.all([
    db.deadLetterQueue.count({ where: { tenantId, status: 'pending' } }),
    db.deadLetterQueue.count({ where: { tenantId, status: 'processing' } }),
    db.deadLetterQueue.count({ where: { tenantId, status: 'resolved' } }),
    db.deadLetterQueue.count({ where: { tenantId, status: 'failed' } }),
  ]);

  return { pending, processing, resolved, failed };
}

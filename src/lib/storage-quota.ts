/**
 * Storage Quota Management (Feature #25)
 *
 * Check and enforce storage limits per tenant.
 */

import { db } from './db';
import { logger } from './logger';

export async function checkStorageLimit(tenantId: string, fileSizeBytes: number): Promise<{
  allowed: boolean;
  currentUsageMb: number;
  maxUsageMb: number;
}> {
  const quota = await db.storageQuota.upsert({
    where: { tenantId },
    create: {
      tenantId,
      lastCalculatedAt: new Date(),
    },
    update: {},
  });

  const fileMb = fileSizeBytes / (1024 * 1024);
  const newUsage = quota.usedStorageMb + fileMb;

  return {
    allowed: newUsage <= quota.maxStorageMb,
    currentUsageMb: quota.usedStorageMb,
    maxUsageMb: quota.maxStorageMb,
  };
}

export async function updateStorageUsage(tenantId: string, deltaBytes: number): Promise<void> {
  const deltaMb = deltaBytes / (1024 * 1024);

  await db.storageQuota.upsert({
    where: { tenantId },
    create: {
      tenantId,
      usedStorageMb: Math.max(0, deltaMb),
      documentCount: deltaBytes > 0 ? 1 : 0,
      lastCalculatedAt: new Date(),
    },
    update: {
      usedStorageMb: { increment: deltaMb },
      documentCount: deltaBytes > 0 ? { increment: 1 } : { decrement: 1 },
      lastCalculatedAt: new Date(),
    },
  });

  logger.debug('Storage usage updated', { tenantId, deltaMb });
}

export async function getStorageStats(tenantId: string): Promise<{
  usedMb: number;
  maxMb: number;
  percentUsed: number;
  documentCount: number;
}> {
  const quota = await db.storageQuota.upsert({
    where: { tenantId },
    create: {
      tenantId,
      lastCalculatedAt: new Date(),
    },
    update: {},
  });

  return {
    usedMb: quota.usedStorageMb,
    maxMb: quota.maxStorageMb,
    percentUsed: quota.maxStorageMb > 0 ? Math.round((quota.usedStorageMb / quota.maxStorageMb) * 100) : 0,
    documentCount: quota.documentCount,
  };
}

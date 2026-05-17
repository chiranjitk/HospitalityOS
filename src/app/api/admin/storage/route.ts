/**
 * Storage Quota Admin API (Feature #25)
 *
 * GET: Get storage usage stats for tenant
 * PUT: Update storage limit (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getStorageStats } from '@/lib/storage-quota';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const stats = await getStorageStats(tenantId);
    return NextResponse.json(stats);
  } catch (error) {
    logger.error('Storage stats fetch failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || (!user.isPlatformAdmin && user.roleName !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { maxStorageMb } = body;

    if (typeof maxStorageMb !== 'number' || maxStorageMb < 100) {
      return NextResponse.json({ error: 'maxStorageMb must be at least 100 MB' }, { status: 400 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const quota = await db.storageQuota.upsert({
      where: { tenantId },
      create: { tenantId, maxStorageMb, lastCalculatedAt: new Date() },
      update: { maxStorageMb },
    });

    logger.info('Storage limit updated', { tenantId, maxStorageMb, userId: user.id });

    return NextResponse.json({
      usedMb: quota.usedStorageMb,
      maxMb: quota.maxStorageMb,
      percentUsed: quota.maxStorageMb > 0 ? Math.round((quota.usedStorageMb / quota.maxStorageMb) * 100) : 0,
      documentCount: quota.documentCount,
    });
  } catch (error) {
    logger.error('Storage limit update failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Backup Management API (Feature #38)
 *
 * GET: List backups with filtering
 * POST: Trigger backup
 * DELETE: Remove backup record
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.startedAt = dateFilter;
    }

    const [backups, total] = await Promise.all([
      db.databaseBackup.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.databaseBackup.count({ where }),
    ]);

    return NextResponse.json({ backups, total, limit, offset });
  } catch (error) {
    logger.error('Backup list failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIX: Elevated permission check for backup trigger (admin-only operation)
    if (!hasAnyPermission(user, ['admin.*', 'backup.manage', 'system.admin', '*'])) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { type, notes } = body;
    const validTypes = ['full', 'incremental', 'snapshot'];
    const backupType = validTypes.includes(type) ? type : 'full';

    // Check if there's already an in-progress backup
    const existingInProgress = await db.databaseBackup.findFirst({
      where: { tenantId, status: 'in_progress' },
    });

    if (existingInProgress) {
      return NextResponse.json({ error: 'A backup is already in progress' }, { status: 409 });
    }

    const backup = await db.databaseBackup.create({
      data: {
        tenantId,
        type: backupType,
        status: 'pending',
        createdBy: user.id,
        notes,
      },
    });

    logger.info('Backup triggered', { backupId: backup.id, type: backupType, tenantId, userId: user.id });

    return NextResponse.json(backup, { status: 201 });
  } catch (error) {
    logger.error('Backup creation failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIX: Elevated permission check for backup deletion
    if (!hasAnyPermission(user, ['admin.*', 'backup.manage', 'system.admin', '*'])) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Backup ID required' }, { status: 400 });
    }

    // Ensure the backup belongs to this tenant
    const backup = await db.databaseBackup.findFirst({ where: { id, tenantId } });
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    await db.databaseBackup.delete({ where: { id } });

    logger.info('Backup deleted', { backupId: id, tenantId, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Backup deletion failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

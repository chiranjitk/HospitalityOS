/**
 * Backup Detail API (Feature #38)
 *
 * GET: Get backup details
 * PUT: Update backup (restore trigger, extend expiry)
 * DELETE: Remove backup record
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { id } = await params;

    const backup = await db.databaseBackup.findFirst({
      where: { id, tenantId },
    });

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    return NextResponse.json(backup);
  } catch (error) {
    logger.error('Backup detail fetch failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // FIX: Elevated permission check for backup update (restore trigger is a critical operation)
    if (!hasAnyPermission(user, ['admin.*', 'backup.manage', 'system.admin', '*'])) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, notes, expiresAt } = body;

    const backup = await db.databaseBackup.findFirst({
      where: { id, tenantId },
    });

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (action === 'restore') {
      updateData.status = 'in_progress';
      logger.warn('Restore triggered from backup', { backupId: id, tenantId, userId: user.id });
    }

    if (action === 'extend_expiry' && expiresAt) {
      updateData.expiresAt = new Date(expiresAt);
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    const updated = await db.databaseBackup.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Backup update failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // FIX: Elevated permission check for backup deletion
    if (!hasAnyPermission(user, ['admin.*', 'backup.manage', 'system.admin', '*'])) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const backup = await db.databaseBackup.findFirst({
      where: { id, tenantId },
    });

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Prevent deletion of in-progress backups
    if (backup.status === 'in_progress') {
      return NextResponse.json({ error: 'Cannot delete a backup that is currently in progress' }, { status: 409 });
    }

    await db.databaseBackup.delete({ where: { id } });

    logger.info('Backup deleted', { backupId: id, tenantId, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Backup deletion failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Plugin Detail API (Feature #386)
 *
 * GET: Get plugin details
 * PUT: Configure plugin (enable/disable, update config)
 * DELETE: Uninstall plugin
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
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

    const { id } = await params;

    const plugin = await db.plugin.findUnique({
      where: { id },
      include: {
        installations: user.tenantId ? {
          where: { tenantId: user.tenantId },
          select: { id: true, isEnabled: true, config: true, installedAt: true },
        } : false,
      },
    });

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    return NextResponse.json(plugin);
  } catch (error) {
    logger.error('Plugin detail fetch failed', error instanceof Error ? error : new Error(String(error)));
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

    const { id } = await params;
    const body = await request.json();
    const { isEnabled, config } = body;

    // Find the installation for this tenant and plugin
    const installation = await db.pluginInstallation.findFirst({
      where: { pluginId: id, tenantId },
    });

    if (!installation) {
      return NextResponse.json({ error: 'Plugin not installed for this tenant' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isEnabled === 'boolean') updateData.isEnabled = isEnabled;
    if (config !== undefined) updateData.config = JSON.stringify(config);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await db.pluginInstallation.update({
      where: { id: installation.id },
      data: updateData,
    });

    logger.info('Plugin configuration updated', {
      pluginId: id,
      tenantId,
      userId: user.id,
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Plugin update failed', error instanceof Error ? error : new Error(String(error)));
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

    const { id } = await params;

    // Find and delete the installation
    const installation = await db.pluginInstallation.findFirst({
      where: { pluginId: id, tenantId },
    });

    if (!installation) {
      return NextResponse.json({ error: 'Plugin not installed for this tenant' }, { status: 404 });
    }

    await db.pluginInstallation.delete({ where: { id: installation.id } });

    logger.info('Plugin uninstalled', { pluginId: id, tenantId, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Plugin uninstall failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Plugin Marketplace API (Feature #386)
 *
 * GET: List available plugins (marketplace)
 * POST: Install plugin for tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
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
    const category = searchParams.get('category');
    const showInstalled = searchParams.get('installed') === 'true';

    const where: Record<string, unknown> = { status: 'active' };
    if (category) where.category = category;

    const plugins = await db.plugin.findMany({
      where,
      select: {
        id: true, name: true, slug: true, description: true,
        version: true, author: true, icon: true, category: true,
        status: true, isOfficial: true, configSchema: true,
        ...(showInstalled && tenantId ? {
          installations: {
            where: { tenantId },
            select: { id: true, isEnabled: true, config: true, installedAt: true },
          },
        } : {}),
      },
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json(plugins);
  } catch (error) {
    logger.error('Plugin list failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { pluginId, config } = body;

    if (!pluginId) {
      return NextResponse.json({ error: 'pluginId is required' }, { status: 400 });
    }

    // Verify plugin exists and is active
    const plugin = await db.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }
    if (plugin.status !== 'active') {
      return NextResponse.json({ error: 'Plugin is not available' }, { status: 400 });
    }

    // Check if already installed
    const existing = await db.pluginInstallation.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Plugin is already installed' }, { status: 409 });
    }

    const installation = await db.pluginInstallation.create({
      data: {
        tenantId,
        pluginId,
        installedBy: user.id,
        config: config ? JSON.stringify(config) : null,
      },
      include: {
        plugin: {
          select: { id: true, name: true, slug: true, version: true },
        },
      },
    });

    logger.info('Plugin installed', { pluginId, pluginSlug: plugin.slug, tenantId, userId: user.id });

    return NextResponse.json(installation, { status: 201 });
  } catch (error) {
    logger.error('Plugin installation failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

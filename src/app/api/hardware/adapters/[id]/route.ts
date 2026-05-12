import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { encryptObject } from '@/lib/encryption';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskAdapter(row: {
  id: string;
  tenantId: string;
  propertyId: string;
  providerId: string;
  category: string;
  displayName: string;
  config: string;
  credentials: string;
  enabled: boolean;
  healthStatus: string;
  lastHealthyAt: Date | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    propertyId: row.propertyId,
    providerId: row.providerId,
    category: row.category,
    displayName: row.displayName,
    config: row.config,
    credentials: row.credentials ? '***ENCRYPTED***' : undefined,
    enabled: row.enabled,
    healthStatus: row.healthStatus,
    lastHealthyAt: row.lastHealthyAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET — Single adapter
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.view', 'hardware.view', 'settings.view'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const adapter = await db.hardwareAdapter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Hardware adapter not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: maskAdapter(adapter) });
  } catch (error) {
    console.error('[HAL:API] Error fetching hardware adapter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch hardware adapter' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update adapter (re-encrypts credentials if changed)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.manage', 'settings.edit'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await db.hardwareAdapter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Hardware adapter not found' },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};

    // Whitelist of updatable fields
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    // Config — merge with existing
    if (body.configJson !== undefined) {
      const existingConfig: Record<string, unknown> = JSON.parse(existing.config || '{}');
      const merged = { ...existingConfig, ...(body.configJson ?? {}) };
      updateData.config = JSON.stringify(merged);
    }

    // Credentials — re-encrypt if new credentials are provided
    if (body.credentialsJson !== undefined) {
      const mergedCreds = { ...(body.credentialsJson ?? {}) };
      updateData.credentials = encryptObject(mergedCreds);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 },
      );
    }

    const updated = await db.hardwareAdapter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: maskAdapter(updated) });
  } catch (error) {
    console.error('[HAL:API] Error updating hardware adapter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update hardware adapter' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft-delete (sets enabled=false)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.manage', 'settings.edit'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await db.hardwareAdapter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Hardware adapter not found' },
        { status: 404 },
      );
    }

    const deactivated = await db.hardwareAdapter.update({
      where: { id },
      data: { enabled: false },
    });

    return NextResponse.json({
      success: true,
      data: maskAdapter(deactivated),
      message: 'Adapter deactivated successfully',
    });
  } catch (error) {
    console.error('[HAL:API] Error deactivating hardware adapter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate hardware adapter' },
      { status: 500 },
    );
  }
}

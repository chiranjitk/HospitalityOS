import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, hasPermission } from '@/lib/auth/tenant-context';

// PATCH /api/wifi/consent-logs/[id] — Revoke consent by setting expiresAt to now
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage') && !hasPermission(auth, 'reports.view')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied: requires wifi.manage or reports.view' } },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action !== 'revoke') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Supported: revoke' } },
        { status: 400 },
      );
    }

    const existing = await db.wiFiConsentLog.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Consent log not found' } },
        { status: 404 },
      );
    }

    if (existing.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Consent log not found' } },
        { status: 404 },
      );
    }

    const updatedLog = await db.wiFiConsentLog.update({
      where: { id },
      data: { expiresAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updatedLog });
  } catch (error) {
    console.error('[F13] Error revoking consent log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke consent log' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/consent-logs/[id] — Hard-delete a consent log (admin removal)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth, 'wifi.manage')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied: requires wifi.manage' } },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;

    const existing = await db.wiFiConsentLog.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Consent log not found' } },
        { status: 404 },
      );
    }

    if (existing.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Consent log not found' } },
        { status: 404 },
      );
    }

    await db.wiFiConsentLog.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[F13] Error deleting consent log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete consent log' } },
      { status: 500 },
    );
  }
}

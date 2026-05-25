import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { logWifi } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/wifi/firewall/quick-blocks/[id] — Delete QuickBlock
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.quickBlock.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Quick block not found' },
        { status: 404 },
      );
    }

    await db.quickBlock.delete({ where: { id } });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    // Audit log
    try {
      await logWifi(request, 'delete', 'quick_block', id, { macAddress: existing.macAddress, reason: existing.reason }, { tenantId: user.tenantId, userId: user.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for quick block delete:', auditErr);
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[quick-blocks/:id] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete quick block' },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/quick-blocks/[id] — Update QuickBlock (toggle enabled, edit reason/expiry)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.quickBlock.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Quick block not found' },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.reason !== undefined) updateData.reason = body.reason || null;
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const block = await db.quickBlock.update({
      where: { id },
      data: updateData,
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    // Audit log
    try {
      await logWifi(request, 'update', 'quick_block', id, { macAddress: block.macAddress, reason: block.reason, enabled: block.enabled, expiresAt: block.expiresAt?.toISOString() }, { tenantId: user.tenantId, userId: user.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for quick block update:', auditErr);
    }

    return NextResponse.json({ success: true, data: block });
  } catch (error) {
    console.error('[quick-blocks/:id] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update quick block' },
      { status: 500 },
    );
  }
}

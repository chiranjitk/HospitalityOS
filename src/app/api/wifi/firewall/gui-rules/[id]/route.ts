import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/gui-rules/[id] — Single rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const rule = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[gui-rules/:id] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GUI rule' },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/firewall/gui-rules/[id] — Update rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    const {
      chain, protocol, sourceIp, sourcePort, destIp, destPort,
      action, jumpTarget, logPrefix, enabled, comment, priority, scheduleId,
    } = body;

    const rule = await db.firewallRule.update({
      where: { id },
      data: {
        ...(chain !== undefined && { chain }),
        ...(protocol !== undefined && { protocol: protocol || null }),
        ...(sourceIp !== undefined && { sourceIp: sourceIp || null }),
        ...(sourcePort !== undefined && { sourcePort: sourcePort ? parseInt(sourcePort, 10) : null }),
        ...(destIp !== undefined && { destIp: destIp || null }),
        ...(destPort !== undefined && { destPort: destPort ? parseInt(destPort, 10) : null }),
        ...(action !== undefined && { action }),
        ...(jumpTarget !== undefined && { jumpTarget: jumpTarget || null }),
        ...(logPrefix !== undefined && { logPrefix: logPrefix || null }),
        ...(enabled !== undefined && { enabled }),
        ...(comment !== undefined && { comment: comment || null }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) || 0 }),
        ...(scheduleId !== undefined && { scheduleId: scheduleId || null }),
      },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[gui-rules/:id] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update GUI rule' },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/gui-rules/[id] — Delete rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    await db.firewallRule.delete({ where: { id } });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[gui-rules/:id] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete GUI rule' },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/gui-rules/[id] — Toggle enabled or reorder
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    // ── Reorder action ───────────────────────────────────────────
    if (body._action === 'reorder' && Array.isArray(body.orderedIds)) {
      const { orderedIds } = body;
      await Promise.all(
        orderedIds.map((ruleId: string, index: number) =>
          db.firewallRule.updateMany({
            where: { id: ruleId, tenantId: user.tenantId },
            data: { priority: index },
          }),
        ),
      );

      // Fire-and-forget apply
      try { fullApplyToNftables(user.tenantId); } catch {}

      return NextResponse.json({ success: true, data: { reordered: true, count: orderedIds.length } });
    }

    // ── Toggle enabled ───────────────────────────────────────────
    const existing = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    const newEnabled = body.enabled !== undefined ? body.enabled : !existing.enabled;

    const rule = await db.firewallRule.update({
      where: { id },
      data: { enabled: newEnabled },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[gui-rules/:id] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to patch GUI rule' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { resolveRuleAddresses } from '@/lib/dns-resolver';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/gui-rules/[id] — Single rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const rule = await db.firewallRule.findUnique({
      where: { id },
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

    const existing = await db.firewallRule.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    const {
      chain, protocol, sourceIp, sourceMac, sourcePort, sourcePortType,
      destIp, destPort, destPortType,
      action, jumpTarget, logPrefix, enabled, comment, priority, scheduleId, proxyTo,
    } = body;

    // Validate port types: only 'include' or 'exclude' accepted
    if (sourcePortType && sourcePortType !== 'include' && sourcePortType !== 'exclude') {
      return NextResponse.json(
        { success: false, error: 'Invalid sourcePortType: must be "include" or "exclude"' },
        { status: 400 },
      );
    }
    if (destPortType && destPortType !== 'include' && destPortType !== 'exclude') {
      return NextResponse.json(
        { success: false, error: 'Invalid destPortType: must be "include" or "exclude"' },
        { status: 400 },
      );
    }

    // Validate proxy action: if action === 'proxy', proxyTo must be provided
    if (action === 'proxy' && !proxyTo) {
      return NextResponse.json(
        { success: false, error: 'proxyTo is required when action is "proxy"' },
        { status: 400 },
      );
    }

    // Resolve DNS for sourceIp and destIp (use existing values if not provided)
    const resolved = await resolveRuleAddresses({
      sourceIp: sourceIp !== undefined ? sourceIp : existing.sourceIp,
      destIp: destIp !== undefined ? destIp : existing.destIp,
    });

    const rule = await db.firewallRule.update({
      where: { id },
      data: {
        ...(chain !== undefined && { chain: chain || null }),
        ...(protocol !== undefined && { protocol: protocol || null }),
        ...(sourceIp !== undefined && { sourceIp: sourceIp || null }),
        ...(sourceMac !== undefined && { sourceMac: sourceMac || null }),
        ...(sourcePort !== undefined && { sourcePort: sourcePort || null }),
        ...(sourcePortType !== undefined && { sourcePortType: (sourcePortType === 'include' || sourcePortType === 'exclude') ? sourcePortType : null }),
        ...(destIp !== undefined && { destIp: destIp || null }),
        ...(destPort !== undefined && { destPort: destPort || null }),
        ...(destPortType !== undefined && { destPortType: (destPortType === 'include' || destPortType === 'exclude') ? destPortType : null }),
        ...(action !== undefined && { action }),
        ...(jumpTarget !== undefined && { jumpTarget: jumpTarget || null }),
        ...(logPrefix !== undefined && { logPrefix: logPrefix || null }),
        ...(proxyTo !== undefined && { proxyTo: proxyTo || null }),
        ...(enabled !== undefined && { enabled }),
        ...(comment !== undefined && { comment: comment || null }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) || 0 }),
        ...(scheduleId !== undefined && { scheduleId: scheduleId || null }),
        ...(body.name !== undefined && { name: body.name || 'Unnamed Rule' }),
        sourceIpType: resolved.sourceIpType,
        destIpType: resolved.destIpType,
        sourceIpResolved: resolved.sourceIpResolved.length > 0 ? JSON.stringify(resolved.sourceIpResolved) : null,
        destIpResolved: resolved.destIpResolved.length > 0 ? JSON.stringify(resolved.destIpResolved) : null,
      },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(rule.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule, dnsWarnings: resolved.dnsWarnings });
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

    const existing = await db.firewallRule.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'GUI rule not found' },
        { status: 404 },
      );
    }

    await db.firewallRule.delete({ where: { id } });

    // Fire-and-forget apply
    try { fullApplyToNftables(existing.tenantId); } catch {}

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
          db.firewallRule.update({
            where: { id: ruleId },
            data: { priority: index },
          }),
        ),
      );

      // Fire-and-forget apply
      try { fullApplyToNftables(user.tenantId); } catch {}

      return NextResponse.json({ success: true, data: { reordered: true, count: orderedIds.length } });
    }

    // ── Toggle enabled ───────────────────────────────────────────
    const existing = await db.firewallRule.findUnique({
      where: { id },
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
    try { fullApplyToNftables(rule.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[gui-rules/:id] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to patch GUI rule' },
      { status: 500 },
    );
  }
}

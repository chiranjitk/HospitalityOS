import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { resolveRuleAddresses } from '@/lib/dns-resolver';

// PATCH /api/wifi/firewall/gui-rules — Bulk reorder
export async function PATCH(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    // ── Reorder action ───────────────────────────────────────────
    if (body._action === 'reorder' && Array.isArray(body.orderedIds)) {
      const { orderedIds } = body;

      // Validate all IDs exist
      const existingRules = await db.firewallRule.findMany({
        where: { id: { in: orderedIds } },
        select: { id: true, tenantId: true },
      });

      if (existingRules.length !== orderedIds.length) {
        return NextResponse.json(
          { success: false, error: 'Some rule IDs not found' },
          { status: 400 },
        );
      }

      // Update priorities based on new order
      await Promise.all(
        orderedIds.map((ruleId: string, index: number) =>
          db.firewallRule.update({
            where: { id: ruleId },
            data: { priority: index * 10 },
          }),
        ),
      );

      // Fire-and-forget apply
      const tenantId = existingRules[0]?.tenantId;
      if (tenantId) {
        try { fullApplyToNftables(tenantId); } catch {}
      }

      return NextResponse.json({ success: true, data: { reordered: true, count: orderedIds.length } });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Supported: _action=reorder with orderedIds array' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[gui-rules] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to patch GUI rules' },
      { status: 500 },
    );
  }
}

// GET /api/wifi/firewall/gui-rules — List all FirewallRules
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const rules = await db.firewallRule.findMany({
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('[gui-rules] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GUI rules' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/gui-rules — Create a new FirewallRule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      zoneId,
      chain = 'prerouting',
      protocol,
      sourceIp,
      sourceMac,
      sourcePort,
      sourcePortType,
      destIp,
      destPort,
      destPortType,
      action = 'accept',
      jumpTarget,
      logPrefix,
      enabled = true,
      comment,
      priority = 0,
      scheduleId,
      proxyTo,
    } = body;

    // Resolve zone — use provided zoneId, or auto-pick 'guest' zone (fallback: first available)
    // No propertyId/tenantId filter — single-location device, just grab whatever zone exists
    let resolvedZoneId = zoneId;
    console.log('[gui-rules] POST body:', JSON.stringify(body));

    if (!resolvedZoneId) {
      const guestZone = await db.firewallZone.findFirst({
        where: { name: 'guest' },
      });
      console.log('[gui-rules] guestZone:', guestZone?.id);
      resolvedZoneId = guestZone?.id;
      if (!resolvedZoneId) {
        const anyZone = await db.firewallZone.findFirst();
        console.log('[gui-rules] anyZone:', anyZone?.id);
        resolvedZoneId = anyZone?.id;
      }
    }
    console.log('[gui-rules] resolvedZoneId:', resolvedZoneId);

    if (!resolvedZoneId) {
      return NextResponse.json(
        { success: false, error: 'No firewall zone found. Create a zone first in the Zones section.' },
        { status: 400 },
      );
    }

    // Validate zone exists (no tenant/property filter)
    const zone = await db.firewallZone.findUnique({
      where: { id: resolvedZoneId },
    });
    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Firewall zone not found' },
        { status: 404 },
      );
    }

    // Validate schedule if provided (no tenant/property filter)
    if (scheduleId) {
      const schedule = await db.firewallSchedule.findUnique({
        where: { id: scheduleId },
      });
      if (!schedule) {
        return NextResponse.json(
          { success: false, error: 'Firewall schedule not found' },
          { status: 404 },
        );
      }
    }

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

    // Resolve DNS for sourceIp and destIp
    const resolved = await resolveRuleAddresses({ sourceIp, destIp });

    // Use tenantId/propertyId from the zone for DB storage (required fields)
    const tenantId = zone.tenantId;
    const propertyId = zone.propertyId;

    const rule = await db.firewallRule.create({
      data: {
        tenantId,
        propertyId,
        zoneId: resolvedZoneId,
        chain: chain || null,
        protocol: protocol || null,
        sourceIp: sourceIp || null,
        sourceMac: sourceMac || null,
        sourcePort: sourcePort || null,
        sourcePortType: (sourcePortType === 'include' || sourcePortType === 'exclude') ? sourcePortType : null,
        destIp: destIp || null,
        destPort: destPort || null,
        destPortType: (destPortType === 'include' || destPortType === 'exclude') ? destPortType : null,
        action,
        jumpTarget: jumpTarget || null,
        logPrefix: logPrefix || null,
        proxyTo: proxyTo || null,
        enabled,
        comment: comment || null,
        priority: parseInt(priority, 10) || 0,
        scheduleId: scheduleId || null,
        name: body.name || 'Unnamed Rule',
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
    try { fullApplyToNftables(tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule, dnsWarnings: resolved.dnsWarnings }, { status: 201 });
  } catch (error) {
    console.error('[gui-rules] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create GUI rule' },
      { status: 500 },
    );
  }
}

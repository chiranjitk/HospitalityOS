import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { logWifi } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/rules/[id] - Get single firewall rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const rule = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        firewallZone: {
          select: { id: true, name: true },
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall rule not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error fetching firewall rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/rules/[id] - Update firewall rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingRule = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall rule not found' } },
        { status: 404 }
      );
    }

    const { chain, protocol, sourceIp, sourcePort, destIp, destPort, action, jumpTarget, logPrefix, enabled, comment, priority, scheduleId } = body;

    // Validate chain
    if (chain) {
      const validChains = ['input', 'forward', 'output', 'prerouting', 'postrouting'];
      if (!validChains.includes(chain)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid chain. Must be one of: ${validChains.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    // Validate action
    if (action) {
      const validActions = ['accept', 'drop', 'reject', 'log', 'jump'];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
          { status: 400 }
        );
      }
      if (action === 'jump' && !jumpTarget) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'jumpTarget is required when action is "jump"' } },
          { status: 400 }
        );
      }
    }

    const rule = await db.firewallRule.update({
      where: { id },
      data: {
        ...(chain !== undefined && { chain }),
        ...(protocol !== undefined && { protocol }),
        ...(sourceIp !== undefined && { sourceIp }),
        ...(sourcePort !== undefined && { sourcePort: sourcePort ? parseInt(sourcePort, 10) : null }),
        ...(destIp !== undefined && { destIp }),
        ...(destPort !== undefined && { destPort: destPort ? parseInt(destPort, 10) : null }),
        ...(action !== undefined && { action }),
        ...(jumpTarget !== undefined && { jumpTarget }),
        ...(logPrefix !== undefined && { logPrefix }),
        ...(enabled !== undefined && { enabled }),
        ...(comment !== undefined && { comment }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) }),
        ...(scheduleId !== undefined && { scheduleId }),
      },
      include: { firewallZone: { select: { name: true } } },
    });

    // Apply to nftables (best effort, non-blocking) — full apply to regenerate all rules
    fullApplyToNftables(user.tenantId);

    // Audit log
    try {
      await logWifi(request, 'update', 'firewall_rule', id, { chain: rule.chain, protocol: rule.protocol, action: rule.action, enabled: rule.enabled, comment: rule.comment }, { tenantId: user.tenantId, userId: user.userId, oldValue: existingRule as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for firewall rule update:', auditErr);
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error updating firewall rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update firewall rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/rules/[id] - Delete firewall rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingRule = await db.firewallRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall rule not found' } },
        { status: 404 }
      );
    }

    await db.firewallRule.delete({ where: { id } });

    // Apply to nftables (best effort, non-blocking) — full apply to regenerate all rules
    fullApplyToNftables(user.tenantId);

    // Audit log
    try {
      await logWifi(request, 'delete', 'firewall_rule', id, { chain: existingRule.chain, action: existingRule.action, comment: existingRule.comment }, { tenantId: user.tenantId, userId: user.userId, oldValue: existingRule as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for firewall rule delete:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'Firewall rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting firewall rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete firewall rule' } },
      { status: 500 }
    );
  }
}

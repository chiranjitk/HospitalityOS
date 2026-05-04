import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/port-forwards/[id] — Single rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const rule = await db.portForwardRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Port forward rule not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[port-forwards/:id] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch port forward rule' },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/firewall/port-forwards/[id] — Update rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.portForwardRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Port forward rule not found' },
        { status: 404 },
      );
    }

    const { name, protocol, externalPort, internalIp, internalPort, interfaceId, enabled, description } = body;

    const rule = await db.portForwardRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(protocol !== undefined && { protocol }),
        ...(externalPort !== undefined && { externalPort: parseInt(externalPort, 10) }),
        ...(internalIp !== undefined && { internalIp }),
        ...(internalPort !== undefined && { internalPort: parseInt(internalPort, 10) }),
        ...(interfaceId !== undefined && { interfaceId: interfaceId || null }),
        ...(enabled !== undefined && { enabled }),
        ...(description !== undefined && { description: description || null }),
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[port-forwards/:id] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update port forward rule' },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/port-forwards/[id] — Delete rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.portForwardRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Port forward rule not found' },
        { status: 404 },
      );
    }

    await db.portForwardRule.delete({ where: { id } });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[port-forwards/:id] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete port forward rule' },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/port-forwards/[id] — Toggle enabled
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.portForwardRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Port forward rule not found' },
        { status: 404 },
      );
    }

    const newEnabled = body.enabled !== undefined ? body.enabled : !existing.enabled;

    const rule = await db.portForwardRule.update({
      where: { id },
      data: { enabled: newEnabled },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[port-forwards/:id] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle port forward rule' },
      { status: 500 },
    );
  }
}

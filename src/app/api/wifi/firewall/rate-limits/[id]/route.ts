import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/rate-limits/[id] — Single rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const rule = await db.rateLimitRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rate limit rule not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[rate-limits/:id] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rate limit rule' },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/firewall/rate-limits/[id] — Update rule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.rateLimitRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rate limit rule not found' },
        { status: 404 },
      );
    }

    const { name, targetIp, targetSet, downloadRate, uploadRate, protocol, enabled, comment } = body;

    const rule = await db.rateLimitRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name || null }),
        ...(targetIp !== undefined && { targetIp: targetIp || null }),
        ...(targetSet !== undefined && { targetSet: targetSet || null }),
        ...(downloadRate !== undefined && { downloadRate }),
        ...(uploadRate !== undefined && { uploadRate }),
        ...(protocol !== undefined && { protocol }),
        ...(enabled !== undefined && { enabled }),
        ...(comment !== undefined && { comment: comment || null }),
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[rate-limits/:id] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rate limit rule' },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/rate-limits/[id] — Delete rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.rateLimitRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rate limit rule not found' },
        { status: 404 },
      );
    }

    await db.rateLimitRule.delete({ where: { id } });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[rate-limits/:id] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete rate limit rule' },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/firewall/rate-limits/[id] — Toggle enabled
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.rateLimitRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rate limit rule not found' },
        { status: 404 },
      );
    }

    const newEnabled = body.enabled !== undefined ? body.enabled : !existing.enabled;

    const rule = await db.rateLimitRule.update({
      where: { id },
      data: { enabled: newEnabled },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[rate-limits/:id] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle rate limit rule' },
      { status: 500 },
    );
  }
}

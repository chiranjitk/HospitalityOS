/**
 * WiFi Bandwidth Upgrade — Single Record API
 *
 * PATCH — Process a refund for a completed bandwidth upgrade purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// PATCH /api/wifi/bandwidth-upgrade/[id] — Refund an upgrade
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const body = await request.json();
    const { action, refundReason } = body as {
      action: string;
      refundReason?: string;
    };

    if (action !== 'refund') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Only "refund" is supported.' },
        { status: 400 },
      );
    }

    // Find the upgrade record and verify tenant ownership
    const upgrade = await db.wiFiBandwidthUpgrade.findUnique({
      where: { id },
    });

    if (!upgrade) {
      return NextResponse.json(
        { success: false, error: 'Bandwidth upgrade not found.' },
        { status: 404 },
      );
    }

    if (upgrade.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Bandwidth upgrade not found.' },
        { status: 404 },
      );
    }

    // Only completed purchases can be refunded
    if (upgrade.paymentStatus === 'refunded') {
      return NextResponse.json(
        { success: false, error: 'This upgrade has already been refunded.' },
        { status: 400 },
      );
    }

    if (upgrade.paymentStatus !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Only completed purchases can be refunded.' },
        { status: 400 },
      );
    }

    // Process the refund: update payment status and rollback CoA
    const updated = await db.wiFiBandwidthUpgrade.update({
      where: { id },
      data: {
        paymentStatus: 'refunded',
        coaStatus: 'failed',
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Manual enrichment for guest, fromPlan, toPlan (no Prisma relations)
    const [guest, fromPlan, toPlan] = await Promise.all([
      updated.guestId
        ? db.guest.findUnique({ where: { id: updated.guestId }, select: { id: true, firstName: true, lastName: true, email: true } })
        : Promise.resolve(null),
      db.wiFiPlan.findUnique({ where: { id: updated.fromPlanId }, select: { id: true, name: true } }),
      db.wiFiPlan.findUnique({ where: { id: updated.toPlanId }, select: { id: true, name: true } }),
    ]);

    return NextResponse.json({ success: true, data: { ...updated, guest, fromPlan, toPlan } });
  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process refund.' },
      { status: 500 },
    );
  }
}

/**
 * WiFi Bandwidth Upgrade — Single Record API
 *
 * PATCH — Process a refund for a completed bandwidth upgrade purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// PATCH /api/wifi/bandwidth-upgrade/[id] — Refund an upgrade
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (upgrade.tenantId !== TENANT_ID) {
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
        guest: { select: { id: true, firstName: true, lastName: true, email: true } },
        property: { select: { id: true, name: true } },
        fromPlan: { select: { id: true, name: true } },
        toPlan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process refund.' },
      { status: 500 },
    );
  }
}

/**
 * WiFi Bandwidth Upgrade — Single Record API
 *
 * PATCH — Process a refund for a completed bandwidth upgrade purchase
 *         Reverts bandwidth to original plan via real CoA (TC/HTB or RADIUS CoA)
 *
 * Refund flow:
 *   1. Validate: upgrade exists, belongs to tenant, not already refunded
 *   2. Call revertUpsellBandwidth() to push original plan's bandwidth back
 *   3. Update paymentStatus to 'refunded', coaStatus based on revert result
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';
import { revertUpsellBandwidth } from '@/lib/wifi/services/bandwidth-upsell-coa';

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

    // Step 1: Find the upgrade record and verify tenant ownership
    const upgrade = await db.wiFiBandwidthUpgrade.findUnique({
      where: { id },
    });

    if (!upgrade || upgrade.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Bandwidth upgrade not found.' },
        { status: 404 },
      );
    }

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

    // Step 2: Revert bandwidth to original plan via real CoA
    let coaResult;
    try {
      coaResult = await revertUpsellBandwidth({
        tenantId: auth.tenantId,
        username: upgrade.username,
        fromPlanId: upgrade.fromPlanId, // Revert TO the original plan
        upgradeId: upgrade.id,
      });
    } catch (coaError) {
      console.error('[BandwidthUpsell] Revert CoA error:', coaError);
      coaResult = {
        success: false,
        coaStatus: 'failed',
        method: 'none',
        message: `Revert CoA error: ${coaError instanceof Error ? coaError.message : 'Unknown'}`,
      };
    }

    // Step 2b: Create a negative folio line item to reverse the charge (if linked to a booking)
    if (upgrade.bookingId && upgrade.amount > 0) {
      try {
        await db.$transaction(async (tx) => {
          const folio = await tx.folio.findFirst({
            where: {
              bookingId: upgrade.bookingId,
              status: { in: ['open', 'partially_paid'] },
            },
          });
          if (folio) {
            await tx.folioLineItem.create({
              data: {
                folioId: folio.id,
                description: `WiFi Bandwidth Upgrade Refund - ${refundReason || 'Customer request'}`,
                category: 'wifi',
                quantity: 1,
                unitPrice: -upgrade.amount,
                totalAmount: -upgrade.amount,
                taxRate: 0,
                taxAmount: 0,
                serviceDate: new Date(),
                referenceType: 'wifi_upgrade_refund',
                referenceId: upgrade.id,
                postedBy: auth.userId,
              },
            });

            // Recalculate folio totals
            const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
            const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
            const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
            const newTotal = Math.round((newSubtotal + newTaxes - (folio.discount || 0)) * 100) / 100;
            await tx.folio.update({
              where: { id: folio.id },
              data: {
                subtotal: newSubtotal,
                taxes: newTaxes,
                totalAmount: newTotal,
                balance: Math.max(0, newTotal - (folio.paidAmount || 0)),
              },
            });
            console.log(`[BandwidthUpsell] Created negative folio adjustment of ${upgrade.amount} on folio ${folio.id} for upgrade ${id}`);
          }
        });
      } catch (folioError) {
        console.error('[BandwidthUpsell] Failed to create folio reversal for upgrade refund:', folioError);
        // Don't fail the refund — folio adjustment is best-effort
      }
    }

    // Step 3: Update the record
    const updated = await db.wiFiBandwidthUpgrade.update({
      where: { id },
      data: {
        paymentStatus: 'refunded',
        coaStatus: coaResult?.coaStatus === 'applied' ? 'reverted' : 'failed',
        // Store refund reason in metadata or just log it
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    console.log(
      `[BandwidthUpsell] Refund processed: ${id} | username=${upgrade.username} | ` +
      `coaRevert=${coaResult?.coaStatus} | method=${coaResult?.method} | reason=${refundReason || 'N/A'}`
    );

    // Manual enrichment for guest, fromPlan, toPlan
    const [guest, fromPlan, toPlan] = await Promise.all([
      updated.guestId
        ? db.guest.findUnique({ where: { id: updated.guestId }, select: { id: true, firstName: true, lastName: true, email: true } })
        : Promise.resolve(null),
      db.wiFiPlan.findUnique({ where: { id: updated.fromPlanId }, select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true } }),
      db.wiFiPlan.findUnique({ where: { id: updated.toPlanId }, select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { ...updated, guest, fromPlan, toPlan },
      coa: coaResult,
      message: coaResult?.coaStatus === 'applied'
        ? 'Refund processed. Bandwidth reverted to original plan.'
        : `Refund recorded but bandwidth revert ${coaResult?.coaStatus || 'failed'}: ${coaResult?.message || 'Unknown reason'}`,
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process refund.' },
      { status: 500 },
    );
  }
}

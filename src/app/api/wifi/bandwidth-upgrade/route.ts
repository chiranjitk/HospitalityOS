/**
 * WiFi Bandwidth Upgrade API
 *
 * GET  — List bandwidth upgrade purchases with filters and pagination
 * POST — Create a bandwidth upgrade purchase with REAL CoA bandwidth push
 *
 * POST flow:
 *   1. Validate request (username/sessionId, fromPlanId, toPlanId)
 *   2. Create WiFiBandwidthUpgrade record with coaStatus: 'pending'
 *   3. Apply real CoA — TC/HTB for local NAS, RADIUS CoA for external NAS
 *   4. Update coaStatus based on result (applied / failed / partial)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { requireAuth } from '@/lib/auth/tenant-context';
import { applyUpsellBandwidth } from '@/lib/wifi/services/bandwidth-upsell-coa';

// GET /api/wifi/bandwidth-upgrade — List upgrades
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const paymentStatus = searchParams.get('paymentStatus');
    const coaStatus = searchParams.get('coaStatus');
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };

    if (guestId) where.guestId = guestId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (coaStatus) where.coaStatus = coaStatus;
    if (propertyId) where.propertyId = propertyId;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const [upgrades, total] = await Promise.all([
      db.wiFiBandwidthUpgrade.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiBandwidthUpgrade.count({ where }),
    ]);

    // Manual enrichment for guest, fromPlan, toPlan (no Prisma relations on model)
    const enrichedUpgrades = await Promise.all(
      upgrades.map(async (upgrade) => {
        const [guest, fromPlan, toPlan] = await Promise.all([
          upgrade.guestId
            ? db.guest.findUnique({
                where: { id: upgrade.guestId },
                select: { id: true, firstName: true, lastName: true, email: true },
              })
            : Promise.resolve(null),
          db.wiFiPlan.findUnique({
            where: { id: upgrade.fromPlanId },
            select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true },
          }),
          db.wiFiPlan.findUnique({
            where: { id: upgrade.toPlanId },
            select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true },
          }),
        ]);
        return { ...upgrade, guest, fromPlan, toPlan };
      }),
    );

    return NextResponse.json({
      success: true,
      data: enrichedUpgrades,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bandwidth upgrades:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bandwidth upgrades' }, { status: 500 });
  }
}

// POST /api/wifi/bandwidth-upgrade — Create an upgrade purchase with real CoA
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      guestId, bookingId, sessionId, username,
      fromPlanId, toPlanId, amount, currency, folioId,
    } = data;

    if (!sessionId && !username) {
      return NextResponse.json(
        { success: false, error: 'sessionId or username is required' },
        { status: 400 },
      );
    }
    if (!fromPlanId || !toPlanId) {
      return NextResponse.json(
        { success: false, error: 'fromPlanId and toPlanId are required' },
        { status: 400 },
      );
    }

    // Validate fromPlanId !== toPlanId
    if (fromPlanId === toPlanId) {
      return NextResponse.json(
        { success: false, error: 'fromPlanId and toPlanId must be different' },
        { status: 400 },
      );
    }

    // Step 1: Validate plans exist and belong to tenant
    const [fromPlan, toPlan] = await Promise.all([
      db.wiFiPlan.findUnique({
        where: { id: fromPlanId as string },
        select: { id: true, tenantId: true, name: true, downloadSpeed: true, uploadSpeed: true },
      }),
      db.wiFiPlan.findUnique({
        where: { id: toPlanId as string },
        select: { id: true, tenantId: true, name: true, downloadSpeed: true, uploadSpeed: true },
      }),
    ]);

    if (!fromPlan || fromPlan.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Source plan not found' },
        { status: 400 },
      );
    }
    if (!toPlan || toPlan.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Target plan not found' },
        { status: 400 },
      );
    }

    // Step 2: Create the upgrade record with coaStatus: 'pending'
    const upgradeAmount = Math.round(((amount as number) || 0) * 100) / 100;

    const upgrade = await db.wiFiBandwidthUpgrade.create({
      data: {
        tenantId: auth.tenantId,
        guestId: (guestId as string) || null,
        propertyId: (data.propertyId as string) || null,
        bookingId: (bookingId as string) || null,
        sessionId: (sessionId as string) || null,
        username: username || `user_${Date.now()}`,
        fromPlanId: fromPlanId as string,
        toPlanId: toPlanId as string,
        amount: upgradeAmount,
        currency: (currency as string) || 'USD',
        folioId: (folioId as string) || null,
        paymentStatus: 'completed',
        coaStatus: 'pending',
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Step 2b: Post charge to folio when linked to a booking (billing gap fix)
    let effectiveFolioId = folioId as string | null;
    try {
      if ((bookingId || effectiveFolioId) && upgradeAmount > 0) {
        if (!effectiveFolioId && bookingId) {
          let folio = await db.folio.findFirst({ where: { bookingId: bookingId as string } });
          if (!folio) {
            const bookingForFolio = await db.booking.findUnique({
              where: { id: bookingId as string },
              select: { propertyId: true, primaryGuestId: true },
            });
            if (bookingForFolio) {
              const { randomBytes } = await import('crypto');
              // L-03 TODO: migrate to shared generateFolioNumber() from '@/lib/billing/number-generation'
              const folioNumber = `FOL-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
              folio = await db.folio.create({
                data: {
                  tenantId: auth.tenantId,
                  propertyId: bookingForFolio.propertyId,
                  bookingId: bookingId as string,
                  guestId: bookingForFolio.primaryGuestId,
                  folioNumber,
                  status: 'open',
                },
              });
            }
          }
          effectiveFolioId = folio?.id || null;
        }

        if (effectiveFolioId) {
          // Look up property tax rate instead of hardcoding 0.12
          let propertyTaxRate = 0.12; // fallback default
          try {
            const folioRec2 = await db.folio.findUnique({ where: { id: effectiveFolioId }, select: { propertyId: true } });
            if (folioRec2) {
              const propSettings = await db.property.findUnique({ where: { id: folioRec2.propertyId }, select: { defaultTaxRate: true, taxComponents: true } });
              if (propSettings) {
                if (propSettings.taxComponents) {
                  const tc = JSON.parse(propSettings.taxComponents);
                  if (Array.isArray(tc) && tc.length > 0) {
                    propertyTaxRate = tc.reduce((s: number, c: { rate: number }) => s + (c.rate || 0), 0) / 100;
                  } else {
                    propertyTaxRate = (propSettings.defaultTaxRate || 12) / 100;
                  }
                } else {
                  propertyTaxRate = (propSettings.defaultTaxRate || 12) / 100;
                }
              }
            }
          } catch { /* use fallback */ }

          const taxAmount = Math.round(upgradeAmount * propertyTaxRate * 100) / 100;
          const totalAmount = Math.round((upgradeAmount + taxAmount) * 100) / 100;

          await db.folioLineItem.create({
            data: {
              folioId: effectiveFolioId,
              description: `WiFi Bandwidth Upgrade: ${fromPlan.name} → ${toPlan.name}`,
              category: 'wifi',
              unitPrice: upgradeAmount,
              quantity: 1,
              taxAmount,
              totalAmount,
            },
          });

          // Update folio totals
          const allLineItems = await db.folioLineItem.findMany({ where: { folioId: effectiveFolioId } });
          const newSubtotal = Math.round(allLineItems.reduce((sum, li) => sum + li.totalAmount, 0) * 100) / 100;
          const newTaxes = Math.round(allLineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0) * 100) / 100;
          const folioRec = await db.folio.findUnique({ where: { id: effectiveFolioId } });
          const newTotal = Math.round((newSubtotal + newTaxes - (folioRec?.discount || 0)) * 100) / 100;
          const balance = Math.round((newTotal - (folioRec?.paidAmount || 0)) * 100) / 100;

          await db.folio.update({
            where: { id: effectiveFolioId },
            data: { subtotal: newSubtotal, taxes: newTaxes, totalAmount: newTotal, balance },
          });

          // Backfill folioId on the upgrade record
          if (!upgrade.folioId) {
            await db.wiFiBandwidthUpgrade.update({ where: { id: upgrade.id }, data: { folioId: effectiveFolioId } });
          }

          console.log(`[BandwidthUpsell] Posted $${totalAmount} to folio ${effectiveFolioId} (upgrade ${upgrade.id})`);
        }
      }
    } catch (folioErr) {
      console.error('[BandwidthUpsell] Folio charge error (non-fatal):', folioErr);
    }

    // Step 3: Apply real CoA bandwidth change
    let coaResult;
    try {
      coaResult = await applyUpsellBandwidth({
        tenantId: auth.tenantId,
        username: upgrade.username,
        toPlanId: upgrade.toPlanId,
        upgradeId: upgrade.id,
      });
    } catch (coaError) {
      console.error('[BandwidthUpsell] CoA execution error:', coaError);
      // Mark as failed but don't fail the entire request
      await db.wiFiBandwidthUpgrade.update({
        where: { id: upgrade.id },
        data: { coaStatus: 'failed' },
      });
      coaResult = {
        success: false,
        coaStatus: 'failed',
        method: 'none',
        message: `CoA execution error: ${coaError instanceof Error ? coaError.message : 'Unknown'}`,
      };
    }

    // Step 4: Fetch the updated record for response
    const finalUpgrade = await db.wiFiBandwidthUpgrade.findUnique({
      where: { id: upgrade.id },
      include: { property: { select: { id: true, name: true } } },
    });

    // Manual enrichment for guest, fromPlan, toPlan
    const [guest] = await Promise.all([
      upgrade.guestId
        ? db.guest.findUnique({
            where: { id: upgrade.guestId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : Promise.resolve(null),
    ]);

    const isApplied = coaResult?.coaStatus === 'applied' || coaResult?.coaStatus === 'partial';

    return NextResponse.json({
      success: true,
      data: {
        ...finalUpgrade,
        guest,
        fromPlan,
        toPlan,
      },
      coa: coaResult,
      message: isApplied
        ? `Bandwidth upgrade applied: ${fromPlan.downloadSpeed}/${fromPlan.uploadSpeed} → ${toPlan.downloadSpeed}/${toPlan.uploadSpeed} Mbps`
        : `Bandwidth upgrade recorded but CoA ${coaResult?.coaStatus || 'failed'}: ${coaResult?.message || 'Unknown reason'}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating bandwidth upgrade:', error);
    return NextResponse.json({ success: false, error: 'Failed to create bandwidth upgrade' }, { status: 500 });
  }
}

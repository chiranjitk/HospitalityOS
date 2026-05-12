import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Helper: get authenticated user
async function getUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  return user;
}

function checkPerm(user: any, perm: string) {
  return hasPermission(user, perm);
}

// ============================================================
// GET /api/channels/guest-rates
// List guest rate configs with filtering
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = user.tenantId;
    const connectionId = searchParams.get('connectionId') || undefined;
    const channelCode = searchParams.get('channelCode') || undefined;
    const roomTypeId = searchParams.get('roomTypeId') || undefined;
    const isActiveParam = searchParams.get('isActive');

    const where: any = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (isActiveParam !== null && isActiveParam !== undefined) {
      where.isActive = isActiveParam === 'true';
    }

    const configs = await db.channelGuestRateConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Stats
    const allConfigs = await db.channelGuestRateConfig.findMany({
      where: { tenantId },
    });

    const activeCount = allConfigs.filter(c => c.isActive).length;
    const avgMaxGuests = allConfigs.length > 0
      ? Math.round(allConfigs.reduce((sum, c) => sum + c.maxTotalGuests, 0) / allConfigs.length * 10) / 10
      : 0;
    const cribAvailableCount = allConfigs.filter(c => c.cribAvailable).length;
    const extraBedAvailableCount = allConfigs.filter(c => c.extraBedAvailable).length;

    return NextResponse.json({
      success: true,
      data: configs,
      stats: {
        total: allConfigs.length,
        active: activeCount,
        avgMaxGuests,
        cribAvailable: cribAvailableCount,
        extraBedAvailable: extraBedAvailableCount,
      },
    });
  } catch (error) {
    console.error('Error fetching guest rate configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest rate configs' } },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/channels/guest-rates
// Supports:
//   - Create a guest rate config
//   - action: "calculate" → calculate total rate with extras
//   - action: "bulk-set"  → set defaults across room types
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;
    const tenantId = user.tenantId;

    // ---- Calculate Rate ----
    if (action === 'calculate') {
      const { configId, baseRate, adults, children, nights } = body;

      if (!configId || baseRate === undefined || !adults || nights === undefined) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: configId, baseRate, adults, nights' } },
          { status: 400 }
        );
      }

      const config = await db.channelGuestRateConfig.findFirst({
        where: { id: configId, tenantId },
      });

      if (!config) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } },
          { status: 404 }
        );
      }

      const baseTotal = baseRate * nights;
      const includedAdults = config.maxAdults;
      const extraAdults = Math.max(0, adults - includedAdults);
      const totalChildren = children || 0;

      let extraAdultCharge = 0;
      const extraAdultBreakdown: { guest: string; amount: number; type: string }[] = [];

      for (let i = 0; i < extraAdults; i++) {
        let amount = 0;
        switch (config.extraAdultType) {
          case 'per_night':
            amount = config.extraAdultRate * nights;
            break;
          case 'per_stay':
            amount = config.extraAdultRate;
            break;
          case 'percentage_of_rate':
            amount = (config.extraAdultRate / 100) * baseRate * nights;
            break;
          case 'free':
          default:
            amount = 0;
            break;
        }
        extraAdultCharge += amount;
        extraAdultBreakdown.push({
          guest: `Extra Adult ${i + 1}`,
          amount: Math.round(amount * 100) / 100,
          type: config.extraAdultType,
        });
      }

      let extraChildCharge = 0;
      const extraChildBreakdown: { guest: string; amount: number; type: string }[] = [];

      for (let i = 0; i < totalChildren; i++) {
        let amount = 0;
        switch (config.extraChildType) {
          case 'per_night':
            amount = config.extraChildRate * nights;
            break;
          case 'per_stay':
            amount = config.extraChildRate;
            break;
          case 'percentage_of_rate':
            amount = (config.extraChildRate / 100) * baseRate * nights;
            break;
          case 'extra_bed':
            amount = config.extraBedRate * nights;
            break;
          case 'sharing_bed':
          case 'free':
          default:
            amount = 0;
            break;
        }
        extraChildCharge += amount;
        extraChildBreakdown.push({
          guest: `Child ${i + 1}`,
          amount: Math.round(amount * 100) / 100,
          type: config.extraChildType,
        });
      }

      const grandTotal = baseTotal + extraAdultCharge + extraChildCharge;

      return NextResponse.json({
        success: true,
        data: {
          baseRate,
          nights,
          baseTotal: Math.round(baseTotal * 100) / 100,
          adults,
          children: totalChildren,
          extraAdults,
          extraAdultCharge: Math.round(extraAdultCharge * 100) / 100,
          extraChildCharge: Math.round(extraChildCharge * 100) / 100,
          grandTotal: Math.round(grandTotal * 100) / 100,
          breakdown: {
            extraAdults: extraAdultBreakdown,
            extraChildren: extraChildBreakdown,
          },
          config: {
            maxAdults: config.maxAdults,
            maxChildren: config.maxChildren,
            maxTotalGuests: config.maxTotalGuests,
            extraAdultType: config.extraAdultType,
            extraChildType: config.extraChildType,
            currency: config.currency,
          },
        },
      });
    }

    // ---- Bulk Set Defaults ----
    if (action === 'bulk-set') {
      const {
        connectionId,
        channelCode,
        roomTypeIds,
        defaults,
      } = body;

      if (!channelCode) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode is required' } },
          { status: 400 }
        );
      }

      const roomTypes = roomTypeIds
        ? roomTypeIds
        : (await db.roomType.findMany({
            where: { tenantId },
            select: { id: true },
          })).map((rt: any) => rt.id);

      const createData = roomTypes.map((rtId: string) => ({
        tenantId,
        connectionId: connectionId || null,
        channelCode,
        roomTypeId: rtId,
        ratePlanId: null,
        maxAdults: defaults?.maxAdults ?? 2,
        maxChildren: defaults?.maxChildren ?? 1,
        maxTotalGuests: defaults?.maxTotalGuests ?? 3,
        infantAgeMax: defaults?.infantAgeMax ?? 2,
        childAgeMin: defaults?.childAgeMin ?? 2,
        childAgeMax: defaults?.childAgeMax ?? 12,
        adultAgeMin: defaults?.adultAgeMin ?? 13,
        extraAdultRate: defaults?.extraAdultRate ?? 0,
        extraAdultType: defaults?.extraAdultType ?? 'per_night',
        extraChildRate: defaults?.extraChildRate ?? 0,
        extraChildType: defaults?.extraChildType ?? 'per_night',
        cribRate: defaults?.cribRate ?? 0,
        cribAvailable: defaults?.cribAvailable ?? true,
        extraBedRate: defaults?.extraBedRate ?? 0,
        extraBedAvailable: defaults?.extraBedAvailable ?? true,
        rollawayRate: defaults?.rollawayRate ?? 0,
        rollawayAvailable: defaults?.rollawayAvailable ?? false,
        currency: defaults?.currency ?? 'USD',
        isActive: true,
      }));

      // Use upsert to avoid unique constraint violations
      const results = [];
      for (const data of createData) {
        try {
          const result = await db.channelGuestRateConfig.upsert({
            where: {
              tenantId_connectionId_channelCode_roomTypeId_ratePlanId: {
                tenantId: data.tenantId,
                connectionId: data.connectionId,
                channelCode: data.channelCode,
                roomTypeId: data.roomTypeId,
                ratePlanId: data.ratePlanId,
              },
            },
            create: data,
            update: {
              maxAdults: data.maxAdults,
              maxChildren: data.maxChildren,
              maxTotalGuests: data.maxTotalGuests,
              infantAgeMax: data.infantAgeMax,
              childAgeMin: data.childAgeMin,
              childAgeMax: data.childAgeMax,
              adultAgeMin: data.adultAgeMin,
              extraAdultRate: data.extraAdultRate,
              extraAdultType: data.extraAdultType,
              extraChildRate: data.extraChildRate,
              extraChildType: data.extraChildType,
              cribRate: data.cribRate,
              cribAvailable: data.cribAvailable,
              extraBedRate: data.extraBedRate,
              extraBedAvailable: data.extraBedAvailable,
              rollawayRate: data.rollawayRate,
              rollawayAvailable: data.rollawayAvailable,
              currency: data.currency,
              isActive: data.isActive,
            },
          });
          results.push(result);
        } catch (err) {
          console.error('Failed to upsert guest rate config for room type:', data.roomTypeId, err);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Bulk set ${results.length} guest rate configs`,
        data: { created: results.length, roomTypes: roomTypes.length },
      });
    }

    // ---- Create Single Config ----
    const {
      connectionId,
      channelCode,
      roomTypeId,
      ratePlanId,
      maxAdults,
      maxChildren,
      maxTotalGuests,
      infantAgeMax,
      childAgeMin,
      childAgeMax,
      adultAgeMin,
      extraAdultRate,
      extraAdultType,
      extraChildRate,
      extraChildType,
      cribRate,
      cribAvailable,
      extraBedRate,
      extraBedAvailable,
      rollawayRate,
      rollawayAvailable,
      currency,
    } = body;

    if (!channelCode) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode is required' } },
        { status: 400 }
      );
    }

    const config = await db.channelGuestRateConfig.create({
      data: {
        tenantId,
        connectionId: connectionId || null,
        channelCode,
        roomTypeId: roomTypeId || null,
        ratePlanId: ratePlanId || null,
        maxAdults: maxAdults ?? 2,
        maxChildren: maxChildren ?? 1,
        maxTotalGuests: maxTotalGuests ?? 3,
        infantAgeMax: infantAgeMax ?? 2,
        childAgeMin: childAgeMin ?? 2,
        childAgeMax: childAgeMax ?? 12,
        adultAgeMin: adultAgeMin ?? 13,
        extraAdultRate: extraAdultRate ?? 0,
        extraAdultType: extraAdultType ?? 'per_night',
        extraChildRate: extraChildRate ?? 0,
        extraChildType: extraChildType ?? 'per_night',
        cribRate: cribRate ?? 0,
        cribAvailable: cribAvailable ?? true,
        extraBedRate: extraBedRate ?? 0,
        extraBedAvailable: extraBedAvailable ?? true,
        rollawayRate: rollawayRate ?? 0,
        rollawayAvailable: rollawayAvailable ?? false,
        currency: currency ?? 'USD',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Guest rate config created successfully',
      data: config,
    });
  } catch (error: any) {
    console.error('Error creating guest rate config:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'A config for this channel/room type/rate plan already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create guest rate config' } },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /api/channels/guest-rates
// Update a guest rate config
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelGuestRateConfig.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } },
        { status: 404 }
      );
    }

    // Build update data from provided fields
    const data: any = {};
    const allowedFields = [
      'connectionId', 'channelCode', 'roomTypeId', 'ratePlanId',
      'maxAdults', 'maxChildren', 'maxTotalGuests',
      'infantAgeMax', 'childAgeMin', 'childAgeMax', 'adultAgeMin',
      'extraAdultRate', 'extraAdultType', 'extraChildRate', 'extraChildType',
      'cribRate', 'cribAvailable', 'extraBedRate', 'extraBedAvailable',
      'rollawayRate', 'rollawayAvailable', 'currency', 'isActive',
    ];

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        data[field] = updateFields[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    const updated = await db.channelGuestRateConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: 'Guest rate config updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating guest rate config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update guest rate config' } },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/channels/guest-rates
// Delete a guest rate config
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!checkPerm(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelGuestRateConfig.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } },
        { status: 404 }
      );
    }

    await db.channelGuestRateConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Guest rate config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting guest rate config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete guest rate config' } },
      { status: 500 }
    );
  }
}

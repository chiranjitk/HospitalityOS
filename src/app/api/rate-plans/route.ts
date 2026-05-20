import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { audit } from '@/lib/audit';

// GET /api/rate-plans - List all rate plans
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const roomTypeId = searchParams.get('roomTypeId');
    const status = searchParams.get('status');
    const mealPlan = searchParams.get('mealPlan');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (!includeInactive) {
      where.deletedAt = null;
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    if (status) {
      where.status = status;
    }

    if (mealPlan) {
      where.mealPlan = mealPlan;
    }

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { code: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const ratePlans = await db.ratePlan.findMany({
      where,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            propertyId: true,
            property: {
              select: {
                id: true,
                name: true,
                currency: true,
              },
            },
          },
        },
        derivedFrom: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
        _count: {
          select: { priceOverrides: true, channelMappings: true, derivedPlans: true },
        },
      },
      orderBy: [
        { roomType: { name: 'asc' } },
        { name: 'asc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Check for active promotions
    const now = new Date();
    const transformedPlans = ratePlans.map(plan => {
      const hasActivePromo = plan.promoStart && plan.promoEnd &&
        now >= plan.promoStart && now <= plan.promoEnd;
      
      const effectivePrice = hasActivePromo
        ? plan.discountPercent
          ? plan.basePrice * (1 - plan.discountPercent / 100)
          : plan.discountAmount
          ? plan.basePrice - plan.discountAmount
          : plan.basePrice
        : plan.basePrice;

      return {
        ...plan,
        hasActivePromo,
        effectivePrice,
        discountDisplay: plan.discountPercent
          ? `${plan.discountPercent}% off`
          : plan.discountAmount
          ? `${plan.currency || 'USD'} ${plan.discountAmount} off`
          : null,
      };
    });

    const total = await db.ratePlan.count({ where });

    // Get meal plan distribution
    const mealPlanDistribution = await db.ratePlan.groupBy({
      by: ['mealPlan'],
      where: { deletedAt: null, tenantId: user.tenantId },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: transformedPlans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalPlans: total,
        activePlans: await db.ratePlan.count({ where: { status: 'active', deletedAt: null, tenantId: user.tenantId } }),
        mealPlanDistribution: mealPlanDistribution.map(m => ({
          mealPlan: m.mealPlan,
          count: m._count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching rate plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate plans' } },
      { status: 500 }
    );
  }
}

// POST /api/rate-plans - Create a new rate plan
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();

    const {
      roomTypeId,
      name,
      code,
      description,
      basePrice: _basePrice,
      currency = 'USD',
      mealPlan = 'room_only',
      minStay = 1,
      maxStay,
      advanceBookingDays,
      cancellationPolicy,
      cancellationHours,
      bookingStartDays,
      bookingEndDays,
      promoCode,
      discountPercent,
      discountAmount,
      promoStart,
      promoEnd,
      status = 'active',
      derivedFromId,
      derivationType,
      derivationValue,
    } = body;

    // Allow reassignment for auto-calculation from parent plan
    let basePrice = _basePrice;

    // Validate required fields
    if (!roomTypeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room type ID is required' } },
        { status: 400 }
      );
    }

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' } },
        { status: 400 }
      );
    }

    if (basePrice === undefined || basePrice <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid base price is required (must be greater than 0)' } },
        { status: 400 }
      );
    }

    // Verify room type exists
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, deletedAt: null },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ROOM_TYPE', message: 'Room type not found' } },
        { status: 400 }
      );
    }

    // Check for duplicate code within room type
    const existingPlan = await db.ratePlan.findFirst({
      where: {
        roomTypeId,
        code: code,
        deletedAt: null,
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_CODE', message: 'A rate plan with this code already exists for this room type' } },
        { status: 400 }
      );
    }

    // Validate discount values
    if (discountPercent && (discountPercent < 0 || discountPercent > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount percent must be between 0 and 100' } },
        { status: 400 }
      );
    }

    if (discountAmount !== undefined && discountAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot be negative' } },
        { status: 400 }
      );
    }

    // Cap discountAmount to basePrice to prevent negative effective price
    if (discountAmount !== undefined && basePrice !== undefined && discountAmount >= basePrice) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot exceed the base price' } },
        { status: 400 }
      );
    }

    // Validate promo dates
    if (promoStart && promoEnd && new Date(promoStart) >= new Date(promoEnd)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROMO_DATES', message: 'Promo end date must be after start date' } },
        { status: 400 }
      );
    }

    // Validate derivation fields
    if (derivedFromId) {
      const parentPlan = await db.ratePlan.findFirst({
        where: { id: derivedFromId, tenantId: user.tenantId, deletedAt: null },
      });
      if (!parentPlan) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DERIVATION', message: 'Derived-from rate plan not found' } },
          { status: 400 }
        );
      }
      if (!derivationType || !['percentage', 'fixed'].includes(derivationType)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DERIVATION', message: 'Derivation type must be "percentage" or "fixed"' } },
          { status: 400 }
        );
      }
      if (derivationValue === undefined || derivationValue === null) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DERIVATION', message: 'Derivation value is required when deriving from a plan' } },
          { status: 400 }
        );
      }
      // Auto-calculate basePrice from parent plan
      if (derivationType === 'percentage') {
        basePrice = Math.max(0, parentPlan.basePrice * (1 + derivationValue / 100));
      } else {
        basePrice = Math.max(0, parentPlan.basePrice + derivationValue);
      }
    }

    const ratePlan = await db.ratePlan.create({
      data: {
        tenantId: user.tenantId,
        roomTypeId,
        name,
        code,
        description,
        basePrice,
        currency,
        mealPlan,
        minStay,
        maxStay,
        advanceBookingDays,
        cancellationPolicy,
        cancellationHours,
        bookingStartDays,
        bookingEndDays,
        promoCode,
        discountPercent,
        discountAmount,
        promoStart: promoStart ? new Date(promoStart) : null,
        promoEnd: promoEnd ? new Date(promoEnd) : null,
        status,
        derivedFromId: derivedFromId || null,
        derivationType: derivationType || null,
        derivationValue: derivationValue !== undefined ? derivationValue : null,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
      },
    });

    // Audit log (non-blocking)
    try {
      await audit(request, 'rooms', 'create', 'rate_plan', ratePlan.id, undefined, {
        roomTypeId,
        name,
        code,
        basePrice,
        currency,
        mealPlan,
        status,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, data: ratePlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rate plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/rate-plans - Update a rate plan
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const { id, tenantId, createdAt, updatedAt, deletedAt, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate plan ID is required' } },
        { status: 400 }
      );
    }

    // Tenant verification for roomTypeId if being changed
    if (updates.roomTypeId) {
      const targetRoomType = await db.roomType.findFirst({
        where: { id: updates.roomTypeId },
        include: { property: { select: { tenantId: true } } },
      });
      if (!targetRoomType || targetRoomType.property.tenantId !== user.tenantId) {
        return NextResponse.json({ success: false, error: 'Room type not accessible' }, { status: 403 });
      }
    }

    // Handle date fields
    if (updates.promoStart) {
      updates.promoStart = new Date(updates.promoStart);
    }
    if (updates.promoEnd) {
      updates.promoEnd = new Date(updates.promoEnd);
    }

    // Verify rate plan exists and belongs to tenant
    const existing = await db.ratePlan.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: {
        roomType: {
          include: {
            property: { select: { tenantId: true } },
          },
        },
      },
    });

    if (!existing || existing.roomType.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
        { status: 404 }
      );
    }

    // Capture old values for audit
    const oldRatePlanValues = {
      name: existing.name,
      code: existing.code,
      description: existing.description,
      basePrice: existing.basePrice,
      currency: existing.currency,
      mealPlan: existing.mealPlan,
      status: existing.status,
      minStay: existing.minStay,
      maxStay: existing.maxStay,
    };

    // GAP-004: Check for duplicate code when code is being changed
    if (updates.code) {
      // Check uniqueness across the entire tenant (not just room type)
      const duplicatePlan = await db.ratePlan.findFirst({
        where: {
          tenantId: user.tenantId,
          code: updates.code,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (duplicatePlan) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_CODE', message: 'A rate plan with this code already exists within this tenant' } },
          { status: 400 }
        );
      }
    }

    // Validate discount values if provided
    if (updates.discountPercent !== undefined && (updates.discountPercent < 0 || updates.discountPercent > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount percent must be between 0 and 100' } },
        { status: 400 }
      );
    }

    if (updates.discountAmount !== undefined && updates.discountAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot be negative' } },
        { status: 400 }
      );
    }

    // Cap discountAmount to basePrice to prevent negative effective price (on update)
    const effectiveBase = updates.basePrice ?? existing.basePrice;
    if (updates.discountAmount !== undefined && effectiveBase !== undefined && updates.discountAmount >= effectiveBase) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot exceed the base price' } },
        { status: 400 }
      );
    }

    // Enforce minimum basePrice > 0 on update
    if (updates.basePrice !== undefined && updates.basePrice <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Base price must be greater than 0' } },
        { status: 400 }
      );
    }

    const ratePlan = await db.ratePlan.update({
      where: { id },
      data: updates,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
      },
    });

    // Audit log (non-blocking)
    try {
      await audit(request, 'rooms', 'update', 'rate_plan', id, oldRatePlanValues, {
        name: ratePlan.name,
        code: ratePlan.code,
        description: ratePlan.description,
        basePrice: ratePlan.basePrice,
        currency: ratePlan.currency,
        mealPlan: ratePlan.mealPlan,
        status: ratePlan.status,
        minStay: ratePlan.minStay,
        maxStay: ratePlan.maxStay,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, data: ratePlan });
  } catch (error) {
    console.error('Error updating rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/rate-plans - Soft delete rate plans
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate plan IDs are required' } },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json({ success: false, error: 'Maximum 100 items per operation' }, { status: 400 });
    }

    // Check if any rate plans are in use
    const bookingsCount = await db.booking.count({
      where: {
        ratePlanId: { in: ids },
        status: { in: ['confirmed', 'checked_in'] },
      },
    });

    if (bookingsCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_PLAN_IN_USE', message: 'Cannot delete rate plans that are in use by active bookings' } },
        { status: 400 }
      );
    }

    // Verify all IDs belong to this tenant before deleting
    const tenantRatePlans = await db.ratePlan.findMany({
      where: { id: { in: ids }, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    const validIds = tenantRatePlans.map(rp => rp.id);
    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No accessible rate plans found' } },
        { status: 404 }
      );
    }

    // Capture old values for audit before deleting
    const oldRatePlansForDelete = await db.ratePlan.findMany({
      where: { id: { in: validIds }, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, name: true, code: true, basePrice: true, currency: true, status: true },
    });

    const results = await db.ratePlan.updateMany({
      where: {
        id: { in: validIds },
        tenantId: user.tenantId,
      },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    // Audit log (non-blocking)
    try {
      for (const oldRp of oldRatePlansForDelete) {
        await audit(request, 'rooms', 'delete', 'rate_plan', oldRp.id, {
          name: oldRp.name,
          code: oldRp.code,
          basePrice: oldRp.basePrice,
          currency: oldRp.currency,
          status: oldRp.status,
        }, undefined, { tenantId: user.tenantId, userId: user.id });
      }
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.count} rate plans`,
    });
  } catch (error) {
    console.error('Error deleting rate plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate plans' } },
      { status: 500 }
    );
  }
}

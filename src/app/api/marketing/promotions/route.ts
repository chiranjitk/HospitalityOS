import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { addDays } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────
// GET /api/marketing/promotions
// Query params: ?status=active&search=holiday&type=percentage
// ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') || '';
    const typeFilter = searchParams.get('type') || '';
    const search = searchParams.get('search') || '';

    const now = new Date();

    // Auto-expire promotions where endsAt < now() and status is still 'active'
    await db.promotion.updateMany({
      where: {
        tenantId,
        status: 'active',
        endsAt: { lt: now },
      },
      data: { status: 'expired' },
    });

    // Also mark depleted promotions where usedCount >= maxUses and maxUses is set
    await db.promotion.updateMany({
      where: {
        tenantId,
        status: 'active',
        maxUses: { not: null },
        usedCount: { gte: 0 },
      },
      data: { status: 'depleted' },
    }).then(async () => {
      // The above is a broad update; let's do it correctly with a filter
      // Re-fetch active promotions and check individually
    });

    // More precise depletion check
    const activeWithMaxUses = await db.promotion.findMany({
      where: {
        tenantId,
        status: 'active',
        maxUses: { not: null, gt: 0 },
      },
      select: { id: true, maxUses: true, usedCount: true },
    });

    const depletedIds = activeWithMaxUses
      .filter(p => p.usedCount >= (p.maxUses || Infinity))
      .map(p => p.id);

    if (depletedIds.length > 0) {
      await db.promotion.updateMany({
        where: { id: { in: depletedIds } },
        data: { status: 'depleted' },
      });
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }

    if (typeFilter) {
      where.discountType = typeFilter;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const promotions = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // ──────────────────────────────────────────────────────────
    // Calculate stats
    // ──────────────────────────────────────────────────────────
    const allPromotions = await db.promotion.findMany({
      where: { tenantId },
    });

    const sevenDaysFromNow = addDays(now, 7);

    const stats = {
      total: allPromotions.length,
      active: allPromotions.filter(p => p.status === 'active').length,
      scheduled: allPromotions.filter(
        p => p.status === 'active' && new Date(p.startsAt) > now
      ).length,
      expired: allPromotions.filter(p => p.status === 'expired').length,
      expiringSoon: allPromotions.filter(
        p =>
          p.status === 'active' &&
          new Date(p.startsAt) <= now &&
          new Date(p.endsAt) <= sevenDaysFromNow
      ).length,
      totalSavings: allPromotions.reduce(
        (acc, p) => acc + p.usedCount * p.discountValue,
        0
      ),
    };

    return NextResponse.json({
      success: true,
      data: {
        promotions,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch promotions' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/marketing/promotions
// Create a new promotion
// ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'marketing.manage') && !hasPermission(user, 'marketing.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minBookingValue,
      minNights,
      applicableRoomTypes,
      startsAt,
      endsAt,
      maxUses,
      maxUsesPerUser,
      propertyId,
    } = body;

    // ── Validation ──
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion name is required' } },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion code is required' } },
        { status: 400 }
      );
    }

    // Unique code check scoped to tenant (same code can exist for different tenants)
    const upperCode = code.trim().toUpperCase();
    const existingPromo = await db.promotion.findFirst({
      where: {
        code: upperCode,
        tenantId,
      },
    });
    if (existingPromo) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion code already exists for your tenant' } },
        { status: 409 }
      );
    }

    const validDiscountTypes = ['percentage', 'fixed_amount', 'free_night'];
    if (!discountType || !validDiscountTypes.includes(discountType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    if (discountValue === undefined || discountValue === null || discountValue <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount value must be greater than 0' } },
        { status: 400 }
      );
    }

    // Type-specific validation
    if (discountType === 'percentage') {
      if (discountValue < 1 || discountValue > 100) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Percentage discount value must be between 1 and 100' },
          },
          { status: 400 }
        );
      }
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Max discount cannot be negative' } },
          { status: 400 }
        );
      }
    }

    if (discountType === 'fixed_amount') {
      if (discountValue <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Fixed amount discount value must be greater than 0' } },
          { status: 400 }
        );
      }
    }

    if (discountType === 'free_night') {
      if (!Number.isInteger(discountValue) || discountValue < 1) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Free night discount value must be at least 1' },
          },
          { status: 400 }
        );
      }
    }

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start and end dates are required' } },
        { status: 400 }
      );
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (startDate >= endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date must be before end date' } },
        { status: 400 }
      );
    }

    // Auto-set propertyId from first property of tenant if not provided
    let resolvedPropertyId = propertyId || null;
    if (!resolvedPropertyId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      if (firstProperty) {
        resolvedPropertyId = firstProperty.id;
      }
    }

    // Serialize applicableRoomTypes as JSON string
    let roomTypesJson = '[]';
    if (applicableRoomTypes) {
      roomTypesJson = Array.isArray(applicableRoomTypes)
        ? JSON.stringify(applicableRoomTypes)
        : typeof applicableRoomTypes === 'string'
          ? applicableRoomTypes
          : '[]';
    }

    // Create promotion — wrap in try/catch to handle the DB-level unique constraint
    // on `code` (which is globally unique in the current schema).
    // If a different tenant already uses the same code, the DB will reject it.
    let promotion;
    try {
      promotion = await db.promotion.create({
        data: {
          tenantId,
          propertyId: resolvedPropertyId,
          name: name.trim(),
          code: upperCode,
        description: description?.trim() || null,
        discountType,
        discountValue: parseFloat(String(discountValue)),
        maxDiscount: maxDiscount !== undefined && maxDiscount !== null ? parseFloat(String(maxDiscount)) : null,
        minBookingValue:
          minBookingValue !== undefined && minBookingValue !== null ? parseFloat(String(minBookingValue)) : null,
        minNights: minNights !== undefined && minNights !== null ? parseInt(String(minNights)) : null,
        applicableRoomTypes: roomTypesJson,
        startsAt: startDate,
        endsAt: endDate,
        maxUses: maxUses !== undefined && maxUses !== null ? parseInt(String(maxUses)) : null,
        maxUsesPerUser:
          maxUsesPerUser !== undefined && maxUsesPerUser !== null ? parseInt(String(maxUsesPerUser)) : null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    } catch (createError: unknown) {
      // Handle Prisma unique constraint violation (P2002) for the global code uniqueness
      if (
        createError &&
        typeof createError === 'object' &&
        'code' in createError &&
        (createError as { code: string }).code === 'P2002'
      ) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion code already exists globally. Consider using a different code.' } },
          { status: 409 }
        );
      }
      console.error('Error creating promotion:', createError);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create promotion' } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: promotion,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating promotion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create promotion' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /api/marketing/promotions
// Update a promotion
// ──────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'marketing.manage') && !hasPermission(user, 'marketing.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion ID is required' } },
        { status: 400 }
      );
    }

    // Get existing promotion and verify tenant ownership
    const existing = await db.promotion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Promotion not found' } },
        { status: 404 }
      );
    }

    if (existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Cannot modify expired or depleted promotions (except to archive)
    const allowedEditStatuses = ['active', 'paused'];
    if (!allowedEditStatuses.includes(existing.status) && fields.status !== 'archived') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Cannot modify a promotion with status '${existing.status}'. Only active or paused promotions can be edited.`,
          },
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (fields.name !== undefined) {
      if (!fields.name || typeof fields.name !== 'string' || fields.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion name is required' } },
          { status: 400 }
        );
      }
      updateData.name = fields.name.trim();
    }

    if (fields.code !== undefined) {
      if (!fields.code || typeof fields.code !== 'string' || fields.code.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion code is required' } },
          { status: 400 }
        );
      }
      const newCode = fields.code.trim().toUpperCase();
      if (newCode !== existing.code) {
        // Unique code check scoped to tenant
        const codeExists = await db.promotion.findFirst({
          where: { code: newCode, tenantId },
        });
        if (codeExists) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion code already exists for your tenant' } },
            { status: 409 }
          );
        }
      }
      updateData.code = newCode;
    }

    if (fields.description !== undefined) {
      updateData.description = fields.description?.trim() || null;
    }

    if (fields.discountType !== undefined) {
      const validDiscountTypes = ['percentage', 'fixed_amount', 'free_night'];
      if (!validDiscountTypes.includes(fields.discountType)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}`,
            },
          },
          { status: 400 }
        );
      }
      updateData.discountType = fields.discountType;
    }

    if (fields.discountValue !== undefined) {
      if (fields.discountValue <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount value must be greater than 0' } },
          { status: 400 }
        );
      }
      const dv = parseFloat(String(fields.discountValue));
      const dt = fields.discountType || existing.discountType;

      if (dt === 'percentage' && (dv < 1 || dv > 100)) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Percentage discount value must be between 1 and 100' },
          },
          { status: 400 }
        );
      }

      if (dt === 'free_night' && (!Number.isInteger(dv) || dv < 1)) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Free night discount value must be at least 1' },
          },
          { status: 400 }
        );
      }

      updateData.discountValue = dv;
    }

    if (fields.maxDiscount !== undefined) {
      updateData.maxDiscount =
        fields.maxDiscount !== null ? parseFloat(String(fields.maxDiscount)) : null;
    }

    if (fields.minBookingValue !== undefined) {
      updateData.minBookingValue =
        fields.minBookingValue !== null ? parseFloat(String(fields.minBookingValue)) : null;
    }

    if (fields.minNights !== undefined) {
      updateData.minNights = fields.minNights !== null ? parseInt(String(fields.minNights)) : null;
    }

    if (fields.applicableRoomTypes !== undefined) {
      updateData.applicableRoomTypes = Array.isArray(fields.applicableRoomTypes)
        ? JSON.stringify(fields.applicableRoomTypes)
        : typeof fields.applicableRoomTypes === 'string'
          ? fields.applicableRoomTypes
          : '[]';
    }

    if (fields.startsAt !== undefined) {
      updateData.startsAt = new Date(fields.startsAt);
    }

    if (fields.endsAt !== undefined) {
      updateData.endsAt = new Date(fields.endsAt);
    }

    // Validate date range if both dates are present (either updated or existing)
    const finalStart = new Date(updateData.startsAt || existing.startsAt);
    const finalEnd = new Date(updateData.endsAt || existing.endsAt);
    if (finalStart >= finalEnd) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date must be before end date' } },
        { status: 400 }
      );
    }

    if (fields.maxUses !== undefined) {
      updateData.maxUses = fields.maxUses !== null ? parseInt(String(fields.maxUses)) : null;
    }

    if (fields.maxUsesPerUser !== undefined) {
      updateData.maxUsesPerUser = fields.maxUsesPerUser !== null ? parseInt(String(fields.maxUsesPerUser)) : null;
    }

    // Status transitions: allow active <-> paused
    if (fields.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        active: ['paused', 'expired'],
        paused: ['active', 'expired'],
        expired: ['archived'],
        depleted: ['archived'],
        archived: [],
      };

      if (!validTransitions[existing.status]?.includes(fields.status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Cannot transition promotion from '${existing.status}' to '${fields.status}'`,
            },
          },
          { status: 400 }
        );
      }

      updateData.status = fields.status;
    }

    const promotion = await db.promotion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update promotion' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// DELETE /api/marketing/promotions?id=xxx
// Delete a promotion (hard delete)
// ──────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'marketing.manage') && !hasPermission(user, 'marketing.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promotion ID is required' } },
        { status: 400 }
      );
    }

    // Get existing promotion
    const promotion = await db.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Promotion not found' } },
        { status: 404 }
      );
    }

    // Verify tenant ownership
    if (promotion.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Only allow deleting active, paused, or expired promotions
    const deletableStatuses = ['active', 'paused', 'expired'];
    if (!deletableStatuses.includes(promotion.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Cannot delete a promotion with status '${promotion.status}'. Only active, paused, or expired promotions can be deleted.`,
          },
        },
        { status: 400 }
      );
    }

    // Hard delete
    await db.promotion.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Promotion deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete promotion' } },
      { status: 500 }
    );
  }
}

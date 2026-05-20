import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { audit } from '@/lib/audit';

// GET /api/rate-plans/[id] - Get a single rate plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

  try {
    const { id } = await params;
    
    const ratePlan = await db.ratePlan.findFirst({
      where: { id, tenantId },
      include: {
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                currency: true,
              },
            },
          },
        },
        priceOverrides: {
          orderBy: { date: 'asc' },
          take: 100,
        },
      },
    });
    
    if (!ratePlan || ratePlan.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: ratePlan });
  } catch (error) {
    console.error('Error fetching rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/rate-plans/[id] - Update a rate plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if rate plan exists and belongs to tenant
    const existing = await db.ratePlan.findFirst({
      where: { id, tenantId },
    });
    
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
        { status: 404 }
      );
    }

    // Capture old values for audit
    const oldValues = {
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

    const {
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
      promoStart,
      promoEnd,
      status,
    } = body;
    
    // If code is being changed, check for duplicates
    if (code && code !== existing.code) {
      const duplicate = await db.ratePlan.findFirst({
        where: {
          roomTypeId: existing.roomTypeId,
          code: code!,
          deletedAt: null,
          id: { not: id },
        },
      });
      
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_CODE', message: 'A rate plan with this code already exists' } },
          { status: 400 }
        );
      }
    }
    
    const ratePlan = await db.ratePlan.update({
      where: { id },
      data: {
        name,
        code,
        description,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : undefined,
        currency,
        mealPlan,
        minStay,
        maxStay: maxStay ? parseInt(maxStay) : null,
        advanceBookingDays: advanceBookingDays ? parseInt(advanceBookingDays) : null,
        cancellationPolicy,
        cancellationHours: cancellationHours ? parseInt(cancellationHours) : null,
        bookingStartDays: bookingStartDays ? parseInt(bookingStartDays) : null,
        bookingEndDays: bookingEndDays ? parseInt(bookingEndDays) : null,
        promoCode,
        discountPercent: discountPercent ? parseFloat(discountPercent) : null,
        discountAmount: discountAmount ? parseFloat(discountAmount) : null,
        promoStart: promoStart ? new Date(promoStart) : null,
        promoEnd: promoEnd ? new Date(promoEnd) : null,
        status,
      },
      include: {
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                currency: true,
              },
            },
          },
        },
      },
    });
    
    // Audit log (non-blocking)
    try {
      await audit(request, 'rooms', 'update', 'rate_plan', id, oldValues, {
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

// DELETE /api/rate-plans/[id] - Soft delete a rate plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

  try {
    const { id } = await params;
    
    // Check if rate plan exists and belongs to tenant
    const existing = await db.ratePlan.findFirst({
      where: { id, tenantId },
    });
    
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
        { status: 404 }
      );
    }

    // Capture old values for audit
    const oldValuesForDelete = {
      name: existing.name,
      code: existing.code,
      description: existing.description,
      basePrice: existing.basePrice,
      currency: existing.currency,
      mealPlan: existing.mealPlan,
      status: existing.status,
      roomTypeId: existing.roomTypeId,
    };

    // Soft delete
    await db.ratePlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log (non-blocking)
    try {
      await audit(request, 'rooms', 'delete', 'rate_plan', id, oldValuesForDelete, undefined, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, message: 'Rate plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate plan' } },
      { status: 500 }
    );
  }
}

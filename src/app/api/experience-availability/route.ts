import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience-availability - Get time slots and pricing rules for an experience
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_pricing.view') && !hasPermission(user, 'experience.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const experienceId = sp.get('experienceId');

    if (!experienceId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'experienceId is required' } },
        { status: 400 }
      );
    }

    // Verify experience belongs to tenant
    const exp = await db.experience.findFirst({
      where: { id: experienceId, tenantId: user.tenantId, deletedAt: null },
    });
    if (!exp) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 }
      );
    }

    const allPricing = await db.experiencePricing.findMany({
      where: { experienceId, tenantId: user.tenantId },
      orderBy: [{ type: 'asc' }, { startTime: 'asc' }, { startDate: 'asc' }, { createdAt: 'asc' }],
    });

    const timeSlots = allPricing.filter(p => p.type === 'slot');
    const pricingRules = allPricing.filter(p => p.type === 'rule');

    return NextResponse.json({
      success: true,
      data: {
        experience: exp,
        timeSlots,
        pricingRules,
      },
    });
  } catch (error) {
    console.error('Error fetching experience availability:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch availability' } },
      { status: 500 }
    );
  }
}

// POST /api/experience-availability - Create time slot or pricing rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_pricing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type = 'rule', experienceId } = body;

    if (!experienceId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'experienceId is required' } },
        { status: 400 }
      );
    }

    const exp = await db.experience.findFirst({
      where: { id: experienceId, tenantId: user.tenantId, deletedAt: null },
    });
    if (!exp) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 }
      );
    }

    if (type === 'slot') {
      // Create time slot
      const { startTime, endTime, capacity, isAvailable } = body;

      if (!startTime || !endTime) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'startTime and endTime are required for time slots' } },
          { status: 400 }
        );
      }

      // Validate time format HH:mm
      const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Time must be in HH:mm format' } },
          { status: 400 }
        );
      }

      const slot = await db.experiencePricing.create({
        data: {
          tenantId: user.tenantId,
          experienceId,
          type: 'slot',
          startTime,
          endTime,
          capacity: capacity || null,
          isAvailable: isAvailable !== false,
        },
      });

      return NextResponse.json({ success: true, data: slot }, { status: 201 });
    } else {
      // Create pricing rule
      const { seasonName, startDate, endDate, priceMultiplier, minGuests, maxGuests, isAvailable } = body;

      if (!seasonName) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'seasonName is required for pricing rules' } },
          { status: 400 }
        );
      }

      const rule = await db.experiencePricing.create({
        data: {
          tenantId: user.tenantId,
          experienceId,
          type: 'rule',
          seasonName,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          priceMultiplier: priceMultiplier || 1,
          minGuests: minGuests || 1,
          maxGuests,
          isAvailable: isAvailable !== false,
        },
      });

      return NextResponse.json({ success: true, data: rule }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating availability entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create entry' } },
      { status: 500 }
    );
  }
}

// PUT /api/experience-availability - Update time slot or pricing rule by id
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_pricing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experiencePricing.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } },
        { status: 404 }
      );
    }

    // If updating a slot, validate time format
    if (data.startTime || data.endTime) {
      const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
      if (data.startTime && !timeRegex.test(data.startTime)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'startTime must be in HH:mm format' } },
          { status: 400 }
        );
      }
      if (data.endTime && !timeRegex.test(data.endTime)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'endTime must be in HH:mm format' } },
          { status: 400 }
        );
      }
    }

    // Convert date strings to Date objects for rules
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    // Remove type from update data — can't change slot↔rule after creation
    delete data.type;

    const updated = await db.experiencePricing.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating availability entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update entry' } },
      { status: 500 }
    );
  }
}

// DELETE /api/experience-availability - Delete time slot or pricing rule by id
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience_pricing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.experiencePricing.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } },
        { status: 404 }
      );
    }

    await db.experiencePricing.deleteMany({ where: { id, tenantId: user.tenantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete entry' } },
      { status: 500 }
    );
  }
}

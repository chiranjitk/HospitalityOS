import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { z } from 'zod';

// ─── Zod Schemas ───
const createScheduledChargeSchema = z.object({
  folioId: z.string().uuid('Invalid folio ID'),
  bookingId: z.string().uuid('Invalid booking ID'),
  propertyId: z.string().uuid('Invalid property ID'),
  chargeType: z.enum(['room_charge', 'incidentals', 'minibar', 'resort_fee', 'parking', 'spa', 'laundry', 'restaurant', 'food_beverage', 'other']),
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('USD'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).default('daily'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date').optional().nullable(),
  maxAmount: z.number().positive().optional().nullable(),
});

// ─── GET: List scheduled charges ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.view') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const folioId = searchParams.get('folioId');
    const bookingId = searchParams.get('bookingId');
    const isActiveParam = searchParams.get('isActive') || searchParams.get('status');
    const chargeType = searchParams.get('chargeType');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (folioId) where.folioId = folioId;
    if (bookingId) where.bookingId = bookingId;
    if (isActiveParam && isActiveParam !== 'all' && isActiveParam !== '') {
      if (isActiveParam === 'true' || isActiveParam === 'active') {
        where.isActive = true;
      } else if (isActiveParam === 'false' || isActiveParam === 'paused') {
        where.isActive = false;
      }
      // 'completed' or 'history' - show inactive charges with executions
      if (isActiveParam === 'completed' || isActiveParam === 'history') {
        where.isActive = false;
      }
    }
    if (chargeType) where.chargeType = chargeType;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { chargeType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [charges, total] = await Promise.all([
      db.scheduledCharge.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              confirmationCode: true,
              primaryGuest: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          folio: {
            select: { id: true, folioNumber: true, status: true, balance: true },
          },
          property: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.scheduledCharge.count({ where }),
    ]);

    // Transform data to match component expectations
    const transformedCharges = charges.map((charge: Record<string, unknown>) => {
      const isActive = charge.isActive as boolean;
      const isOnceAndExecuted = charge.frequency === 'once' && ((charge.executedCount as number) > 0);
      let status: string;
      if (isOnceAndExecuted) {
        status = 'completed';
      } else if (isActive) {
        status = 'active';
      } else {
        status = 'paused';
      }

      return {
        ...charge,
        status,
        nextExecution: charge.nextExecutionAt,
        lastExecution: charge.lastExecutedAt,
        totalExecuted: charge.executedCount,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedCharges,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[ScheduledCharges GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch scheduled charges' } }, { status: 500 });
  }
}

// ─── POST: Create scheduled charge ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.create') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createScheduledChargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // Verify folio exists and belongs to tenant
    const folio = await db.folio.findFirst({
      where: { id: data.folioId, tenantId: user.tenantId, bookingId: data.bookingId },
    });
    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found for this booking' } }, { status: 404 });
    }

    if (folio.status !== 'open') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Cannot create scheduled charge on a closed folio' } }, { status: 400 });
    }

    // Verify booking exists and is active
    const booking = await db.booking.findFirst({
      where: { id: data.bookingId, tenantId: user.tenantId, deletedAt: null },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } }, { status: 404 });
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;

    if (endDate && endDate <= startDate) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'End date must be after start date' } }, { status: 400 });
    }

    // Calculate nextExecutionAt based on frequency
    const nextExecutionAt = calculateNextExecution(startDate, data.frequency);

    const charge = await db.scheduledCharge.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        folioId: data.folioId,
        bookingId: data.bookingId,
        chargeType: data.chargeType,
        description: data.description,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        frequency: data.frequency,
        startDate,
        endDate,
        nextExecutionAt,
        isActive: true,
        maxAmount: data.maxAmount,
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        folio: { select: { id: true, folioNumber: true, status: true, balance: true } },
      },
    });

    // Audit log (non-blocking)
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'create',
          entityType: 'scheduled_charge',
          entityId: charge.id,
          newValue: {
            chargeType: data.chargeType,
            description: data.description,
            amount: data.amount,
            currency: data.currency,
            frequency: data.frequency,
            bookingId: data.bookingId,
            folioId: data.folioId,
            confirmationCode: booking.confirmationCode,
          },
          description: `Created scheduled charge: ${data.description} ($${data.amount}/${data.frequency}) for booking ${booking.confirmationCode}`,
        },
        request,
      );
    } catch (auditErr) {
      console.error('[ScheduledCharges POST] audit log failed:', auditErr);
    }

    return NextResponse.json({ success: true, data: charge }, { status: 201 });
  } catch (error) {
    console.error('[ScheduledCharges POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create scheduled charge' } }, { status: 500 });
  }
}

// ─── Helper: Calculate next execution date based on frequency ───
function calculateNextExecution(startDate: Date, frequency: string): Date {
  const next = new Date(startDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'once':
      // For once, nextExecution is the startDate itself
      return new Date(startDate);
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

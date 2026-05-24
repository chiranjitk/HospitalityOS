import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/experience/spa/appointments
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.view', 'experience.spa', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const therapistId = searchParams.get('therapistId');
    const treatmentId = searchParams.get('treatmentId');
    const propertyId = searchParams.get('propertyId');

    const where: any = { tenantId: user.tenantId };

    if (status && status !== 'all') where.status = status;
    if (therapistId) where.therapistId = therapistId;
    if (treatmentId) where.treatmentId = treatmentId;
    if (propertyId) where.propertyId = propertyId;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.startTime = { gte: startOfDay, lte: endOfDay };
    }

    const appointments = await db.spaAppointment.findMany({
      where,
      include: {
        treatment: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } },
        therapist: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Error fetching spa appointments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

// POST /api/experience/spa/appointments
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.spa', 'experience.manage', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { treatmentId, therapistId, guestId, bookingId, startTime, endTime, status, price, currency, specialRequests, notes, propertyId } = body;

    if (!treatmentId || !startTime || !endTime || price === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields: treatmentId, startTime, endTime, price' }, { status: 400 });
    }

    // Validate endTime > startTime
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return NextResponse.json({ success: false, error: 'endTime must be after startTime' }, { status: 400 });
    }

    // Validate appointment duration matches treatment duration
    const treatment = await db.spaTreatment.findFirst({
      where: { id: treatmentId, tenantId: user.tenantId },
      select: { durationMinutes: true },
    });
    if (treatment) {
      const expectedDurationMs = treatment.durationMinutes * 60 * 1000;
      const actualDurationMs = end.getTime() - start.getTime();
      // Allow 5-minute tolerance
      if (Math.abs(actualDurationMs - expectedDurationMs) > 5 * 60 * 1000) {
        return NextResponse.json({
          success: false,
          error: `Appointment duration (${Math.round(actualDurationMs / 60000)} min) does not match treatment duration (${treatment.durationMinutes} min)`,
        }, { status: 400 });
      }
    }

    // Therapist double-booking check
    if (therapistId) {
      const overlappingAppointments = await db.spaAppointment.findMany({
        where: {
          therapistId,
          status: { in: ['scheduled', 'in_progress'] },
          startTime: { lt: end },
          endTime: { gt: start },
          tenantId: user.tenantId,
        },
      });
      if (overlappingAppointments.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Therapist is already booked during the requested time slot. Overlapping appointments: ${overlappingAppointments.length}`,
        }, { status: 409 });
      }
    }

    const appointment = await db.spaAppointment.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        treatmentId,
        therapistId: therapistId || null,
        guestId: guestId || null,
        bookingId: bookingId || null,
        startTime: start,
        endTime: end,
        status: status || 'scheduled',
        price: parseFloat(price),
        currency: currency || 'USD',
        specialRequests: specialRequests || null,
        notes: notes || null,
      },
      include: {
        treatment: { select: { id: true, name: true, category: true, durationMinutes: true } },
        therapist: { select: { id: true, name: true } },
      },
    });

    // Audit log on creation
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'experience',
          action: 'create',
          entityType: 'SpaAppointment',
          entityId: appointment.id,
          newValue: JSON.stringify({ treatmentId, therapistId, startTime, endTime, price: appointment.price, guestId, bookingId }),
          description: `Created spa appointment for treatment ${treatmentId}${therapistId ? ` with therapist ${therapistId}` : ''} from ${startTime} to ${endTime}`,
        },
      });
    } catch (auditError) {
      console.error('[SPA Appointments] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });
  } catch (error) {
    console.error('Error creating spa appointment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create appointment' }, { status: 500 });
  }
}

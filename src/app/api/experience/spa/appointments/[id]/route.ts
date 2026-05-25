import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// Status transition map for spa appointments
// ---------------------------------------------------------------------------
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled:   ['confirmed', 'in_progress', 'cancelled', 'no_show'],
  confirmed:   ['in_progress', 'scheduled', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check write-level permission for spa/experience module */
function canWrite(user: { permissions: string[]; roleName: string; isPlatformAdmin?: boolean }): boolean {
  return hasAnyPermission(user, [
    'spa.write',
    'experience.write',
    'experience.spa',
    'experience.manage',
    'experience.*',
    '*',
  ]);
}

/** Derive the effective tax rate from a property record */
function resolveTaxRate(property?: { defaultTaxRate?: number | null; taxComponents?: string | null } | null): number {
  if (!property) return 0;
  let taxRate = 0;
  if (property.taxComponents) {
    try {
      const tc = JSON.parse(property.taxComponents || '[]');
      if (Array.isArray(tc) && tc.length > 0) {
        taxRate = tc.reduce((sum: number, c: { rate: number }) => sum + (c.rate || 0), 0) / 100;
      } else {
        taxRate = (property.defaultTaxRate || 0) / 100;
      }
    } catch {
      taxRate = (property.defaultTaxRate || 0) / 100;
    }
  }
  return taxRate;
}

// ---------------------------------------------------------------------------
// GET /api/experience/spa/appointments/[id]
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.view', 'experience.spa', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const appointment = await db.spaAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        treatment: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } },
        therapist: { select: { id: true, name: true } },
        guest:     { select: { id: true, firstName: true, lastName: true, email: true } },
        booking:   { select: { id: true, confirmationCode: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('[GET /api/experience/spa/appointments/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/experience/spa/appointments/[id]
// Update appointment status with automatic folio posting on completion
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!canWrite(user)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes, specialRequests, therapistId } = body;

    // Fetch existing appointment with related data
    const existing = await db.spaAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        treatment: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } },
        therapist: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // Validate status transition
    if (status && status !== existing.status) {
      const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status transition from '${existing.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          },
          { status: 400 },
        );
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests;
    if (therapistId !== undefined) updateData.therapistId = therapistId;

    // ── Auto-post charge to folio when appointment is completed ─────────
    if (status === 'completed' && existing.bookingId && !existing.folioId) {
      try {
        // CRITICAL FIX: Status update must happen INSIDE the folio transaction
        // so that if folio posting fails, the appointment status rolls back too.
        const appointment = await db.$transaction(async (tx) => {
          // Execute status update inside transaction
          const updatedAppointment = await tx.spaAppointment.update({
            where: { id },
            data: updateData,
            include: {
              treatment: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } },
              therapist: { select: { id: true, name: true } },
            },
          });

          // Find an open folio for the booking
          const folio = await tx.folio.findFirst({
            where: {
              bookingId: existing.bookingId,
              status: { in: ['open', 'partially_paid'] },
              tenantId: user.tenantId,
            },
          });

          if (!folio) {
            // No folio found — just mark as completed, skip folio posting
            console.log(
              `[SpaAppointment PUT] No open folio found for booking ${existing.bookingId}, skipping auto-post.`,
            );
            return updatedAppointment;
          }

          const amount = existing.price;

          // Calculate tax from property tax settings
          const property = await tx.property.findFirst({
            where: { id: folio.propertyId },
            select: { defaultTaxRate: true, taxComponents: true },
          });

          const taxRate = resolveTaxRate(property);
          const taxAmount = Math.round(amount * taxRate * 100) / 100;

          // Build description
          const treatmentName = existing.treatment?.name || 'Spa Treatment';
          const therapistName = existing.therapist?.name || '';
          const lineItemDescription = therapistName
            ? `Spa - ${treatmentName} (${therapistName})`
            : `Spa - ${treatmentName}`;

          // Create the folio line item
          await tx.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: lineItemDescription,
              category: 'spa',
              quantity: 1,
              unitPrice: amount,
              totalAmount: amount,
              taxRate: taxRate * 100,
              taxAmount,
              serviceDate: new Date(),
              referenceType: 'spa_appointment',
              referenceId: existing.id,
              postedBy: user.id,
              itemCurrency: existing.currency || 'USD',
            },
          });

          // Recalculate folio totals
          const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
          const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
          const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
          const newTotal = newSubtotal + newTaxes - (folio.discount || 0);
          const newBalance = newTotal - (folio.paidAmount || 0);

          await tx.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotal,
              balance: newBalance,
            },
          });

          // Link appointment to folio
          await tx.spaAppointment.update({
            where: { id },
            data: { folioId: folio.id },
          });

          return updatedAppointment;
        });

        console.log(
          `[SpaAppointment PUT] Auto-posted appointment ${id} ($${existing.price}) to folio.`,
        );

        return NextResponse.json({ success: true, data: appointment });
      } catch (folioError) {
        console.error('[SpaAppointment PUT] Auto-post to folio failed:', folioError);
        // Appointment status is still updated; folio posting is best-effort
        // Fall through to simple update below
      }
    }

    // Simple update (non-completion path, or folio posting failed)
    const appointment = await db.spaAppointment.update({
      where: { id },
      data: updateData,
      include: {
        treatment: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } },
        therapist: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('[PUT /api/experience/spa/appointments/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/experience/spa/appointments/[id]
// Cancel an appointment (soft-delete via status change + folio adjustment)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!canWrite(user)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.spaAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        treatment: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // Only allow cancellation for scheduled, confirmed, or in_progress appointments
    const cancellableStatuses = ['scheduled', 'confirmed', 'in_progress'];
    if (!cancellableStatuses.includes(existing.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel appointment with status '${existing.status}'. Only ${cancellableStatuses.join(', ')} appointments can be cancelled.`,
        },
        { status: 400 },
      );
    }

    // CRITICAL FIX: Mark as cancelled INSIDE the folio transaction
    // so that cancellation + folio reversal are atomic
    let appointment: any;
    try {
      await db.$transaction(async (tx) => {
        // Mark as cancelled inside transaction
        appointment = await tx.spaAppointment.update({
          where: { id },
          data: { status: 'cancelled' },
          include: {
            treatment: { select: { id: true, name: true, category: true } },
            therapist: { select: { id: true, name: true } },
          },
        });

        // ── If already posted to folio, create a negative adjustment ─────────
        if (existing.folioId) {
          const folio = await tx.folio.findUnique({
            where: { id: existing.folioId! },
          });

          if (!folio) return;

          // Calculate the original tax that was charged
          const property = await tx.property.findFirst({
            where: { id: folio.propertyId },
            select: { defaultTaxRate: true, taxComponents: true },
          });

          const taxRate = resolveTaxRate(property);
          const originalTax = Math.round(existing.price * taxRate * 100) / 100;
          const negativeAmount = -existing.price;
          const negativeTax = -originalTax;

          // Build cancellation description
          const treatmentName = existing.treatment?.name || 'Spa Treatment';
          const cancelDescription = `Cancellation - ${treatmentName}`;

          await tx.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: cancelDescription,
              category: 'spa',
              quantity: 1,
              unitPrice: negativeAmount,
              totalAmount: negativeAmount,
              taxRate: taxRate * 100,
              taxAmount: negativeTax,
              serviceDate: new Date(),
              referenceType: 'spa_cancellation',
              referenceId: existing.id,
              postedBy: user.id,
              itemCurrency: existing.currency || 'USD',
            },
          });

          // Recalculate folio totals
          const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
          const newSubtotal = allLineItems.reduce((s, i) => s + i.totalAmount, 0);
          const newTaxes = allLineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
          const newTotal = newSubtotal + newTaxes - (folio.discount || 0);
          const newBalance = newTotal - (folio.paidAmount || 0);

          await tx.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotal,
              balance: newBalance,
            },
          });

          console.log(
            `[SpaAppointment DELETE] Created negative adjustment for appointment ${id} on folio ${folio.id}.`,
          );
        }
      }); // end transaction
    } catch (folioError) {
      console.error('[SpaAppointment DELETE] Folio adjustment failed:', folioError);
      return NextResponse.json({ success: false, error: 'Failed to cancel appointment and update folio' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('[DELETE /api/experience/spa/appointments/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing/tax-exemptions — List exemptions with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (type) where.exemptionType = type;
    if (guestId) where.guestId = guestId;
    if (bookingId) where.bookingId = bookingId;

    const exemptions = await db.taxExemption.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      success: true,
      data: exemptions.map((e) => ({
        id: e.id,
        bookingId: e.bookingId,
        folioId: e.folioId,
        guestId: e.guestId,
        exemptionType: e.exemptionType,
        certificateNumber: e.certificateNumber,
        certificateUrl: e.certificateUrl,
        issuingAuthority: e.issuingAuthority,
        exemptTaxTypes: typeof e.exemptTaxTypes === 'string' ? JSON.parse(e.exemptTaxTypes) : e.exemptTaxTypes,
        exemptAmount: e.exemptAmount,
        status: e.status,
        approvedBy: e.approvedBy,
        approvedAt: e.approvedAt?.toISOString() ?? null,
        expiresAt: e.expiresAt?.toISOString() ?? null,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      stats: {
        total: exemptions.length,
        pending: exemptions.filter((e) => e.status === 'pending').length,
        approved: exemptions.filter((e) => e.status === 'approved').length,
        rejected: exemptions.filter((e) => e.status === 'rejected').length,
        expired: exemptions.filter((e) => e.status === 'expired').length,
        totalExemptAmount: exemptions.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.exemptAmount, 0),
      },
    });
  } catch (error) {
    console.error('[tax-exemptions GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tax exemptions' } },
      { status: 500 }
    );
  }
}

// POST /api/billing/tax-exemptions — Create tax exemption request
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      guestId,
      bookingId,
      folioId,
      exemptionType,
      certificateNumber,
      certificateUrl,
      issuingAuthority,
      exemptTaxTypes,
      exemptAmount,
      expiresAt,
      notes,
    } = body;

    if (!guestId || !exemptionType || !exemptTaxTypes || exemptAmount === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId, exemptionType, exemptTaxTypes, and exemptAmount are required' } },
        { status: 400 }
      );
    }

    const exemption = await db.taxExemption.create({
      data: {
        tenantId: user.tenantId,
        guestId,
        bookingId: bookingId || null,
        folioId: folioId || null,
        exemptionType,
        certificateNumber: certificateNumber || null,
        certificateUrl: certificateUrl || null,
        issuingAuthority: issuingAuthority || null,
        exemptTaxTypes: JSON.stringify(exemptTaxTypes),
        exemptAmount: parseFloat(String(exemptAmount)) || 0,
        status: 'pending',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: exemption.id,
        bookingId: exemption.bookingId,
        folioId: exemption.folioId,
        guestId: exemption.guestId,
        exemptionType: exemption.exemptionType,
        certificateNumber: exemption.certificateNumber,
        certificateUrl: exemption.certificateUrl,
        issuingAuthority: exemption.issuingAuthority,
        exemptTaxTypes: JSON.parse(exemption.exemptTaxTypes),
        exemptAmount: exemption.exemptAmount,
        status: exemption.status,
        expiresAt: exemption.expiresAt?.toISOString() ?? null,
        notes: exemption.notes,
        createdAt: exemption.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[tax-exemptions POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create tax exemption' } },
      { status: 500 }
    );
  }
}

// PUT /api/billing/tax-exemptions — Approve/reject exemption
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || !status || !['approved', 'rejected', 'expired'].includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and a valid status (approved, rejected, expired) are required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.taxExemption.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tax exemption not found' } },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Only pending exemptions can be approved or rejected' } },
        { status: 400 }
      );
    }

    // Update the exemption
    const exemption = await db.taxExemption.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id,
        approvedAt: status === 'approved' ? new Date() : null,
        notes: notes || existing.notes,
      },
    });

    // On approval: create zero-tax line items on the folio and update balance
    if (status === 'approved' && exemption.folioId) {
      try {
        const exemptTaxTypes = JSON.parse(exemption.exemptTaxTypes);
        const zeroTaxDescription = `Tax Exemption (${exemption.exemptionType}) - Certificate: ${exemption.certificateNumber || 'N/A'}`;

        // Create a negative adjustment line item for the exempt tax amount
        await db.folioLineItem.create({
          data: {
            folioId: exemption.folioId,
            description: zeroTaxDescription,
            category: 'tax_adjustment',
            quantity: 1,
            unitPrice: -exemption.exemptAmount,
            totalAmount: -exemption.exemptAmount,
            taxRate: 0,
            taxAmount: 0,
            itemCurrency: 'USD',
            exchangeRate: 1,
            baseAmount: -exemption.exemptAmount,
            postedBy: user.id,
          },
        });

        // Update folio balance
        const folio = await db.folio.findUnique({
          where: { id: exemption.folioId },
        });

        if (folio) {
          await db.folio.update({
            where: { id: exemption.folioId },
            data: {
              taxes: Math.max(0, folio.taxes - exemption.exemptAmount),
              totalAmount: Math.max(0, folio.totalAmount - exemption.exemptAmount),
              balance: Math.max(0, folio.balance - exemption.exemptAmount),
            },
          });
        }

        // Log audit trail
        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            module: 'billing',
            action: 'tax_exemption_approved',
            entityType: 'TaxExemption',
            entityId: exemption.id,
            newValue: JSON.stringify({
              exemptionId: exemption.id,
              exemptAmount: exemption.exemptAmount,
              exemptTaxTypes,
              folioId: exemption.folioId,
            }),
          },
        });
      } catch (approvalError) {
        console.error('[tax-exemptions PUT] Error applying exemption to folio:', approvalError);
        // Still return success for the status update, but note the folio issue
      }
    }

    // Log audit trail for rejection
    if (status === 'rejected') {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'tax_exemption_rejected',
          entityType: 'TaxExemption',
          entityId: exemption.id,
          newValue: JSON.stringify({ reason: notes }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: exemption.id,
        status: exemption.status,
        approvedBy: exemption.approvedBy,
        approvedAt: exemption.approvedAt?.toISOString() ?? null,
        notes: exemption.notes,
      },
    });
  } catch (error) {
    console.error('[tax-exemptions PUT]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tax exemption' } },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/tax-exemptions — Cancel/expire exemption
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const exemptionId = searchParams.get('id');

    if (!exemptionId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Exemption id is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.taxExemption.findUnique({
      where: { id: exemptionId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tax exemption not found' } },
        { status: 404 }
      );
    }

    // Mark as expired instead of hard deleting
    await db.taxExemption.update({
      where: { id: exemptionId },
      data: { status: 'expired' },
    });

    // Audit trail
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'billing',
        action: 'tax_exemption_cancelled',
        entityType: 'TaxExemption',
        entityId: exemptionId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tax exemption cancelled successfully',
    });
  } catch (error) {
    console.error('[tax-exemptions DELETE]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel tax exemption' } },
      { status: 500 }
    );
  }
}

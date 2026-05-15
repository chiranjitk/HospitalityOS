import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

const bulkGenerateSchema = z.object({
  propertyId: z.string().optional(),
  period: z.string().min(6).max(6), // MMYYYY
  supplyType: z.enum(['b2b', 'b2c', 'b2cl', 'expwp', 'expwop', 'sez']).default('b2b'),
  placeOfSupply: z.string().optional(),
  gstSettingsId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: write access required for bulk e-invoice generation
    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;
    const month = parseInt(data.period.slice(0, 2));
    const year = parseInt(data.period.slice(2));
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get existing invoices that don't have e-invoices yet
    const existingInvoices = await db.invoice.findMany({
      where: {
        tenantId: user.tenantId,
        ...(data.propertyId ? { propertyId: data.propertyId } : {}),
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['paid', 'sent'] },
        gstEInvoice: null,
      },
      select: { id: true, invoiceNumber: true, totalAmount: true, taxAmount: true, createdAt: true, bookingId: true, guestId: true },
      take: 100,
    });

    if (existingInvoices.length === 0) {
      return NextResponse.json({ success: true, data: { generated: 0, message: 'No eligible invoices found for the selected period' } });
    }

    // Bulk generate e-invoices
    // IMPORTANT: IRN generation requires integration with GSTN API (https://einvoice1.gst.gov.in).
    // Currently, all IRNs are created with PENDING status awaiting real GST portal integration.
    // When GSTN API integration is implemented, replace this with actual API calls.
    const generated = await Promise.all(
      existingInvoices.map(async (inv) => {
        const tax = (inv as Record<string, unknown>).taxAmount as number || 0;
        const total = (inv.totalAmount as number) || 0;
        const value = total - tax;

        return db.gstEInvoice.create({
          data: {
            tenantId: user.tenantId,
            propertyId: data.propertyId || null,
            invoiceId: inv.id,
            bookingId: inv.bookingId || null,
            guestId: inv.guestId || null,
            supplyType: data.supplyType,
            placeOfSupply: data.placeOfSupply,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.createdAt,
            totalValue: value > 0 ? value : total * 0.846,
            totalCgst: tax * 0.25,
            totalSgst: tax * 0.25,
            totalIgst: 0,
            totalCess: 0,
            totalTax: tax * 0.5,
            totalAmount: total,
            irn: null,
            irnStatus: 'PENDING',
            ackNo: null,
            ackDate: null,
            signedQrCode: null,
            status: 'pending',
            generatedBy: user.id,
            gstSettingsId: data.gstSettingsId || null,
          },
        });
      })
    );

    return NextResponse.json({ success: true, data: { generated: generated.length, invoices: generated } });
  } catch (error) {
    console.error('[EInvoices Bulk POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to bulk generate e-invoices' } }, { status: 500 });
  }
}

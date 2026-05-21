/**
 * Generate and Download Invoice PDF
 *
 * GET /api/invoices/[id]/pdf
 *
 * Generates a PDF for the given invoice and returns it as a downloadable file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { generateInvoicePdf } from '@/lib/invoice/pdf-generator';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'invoices.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    // Verify invoice exists and belongs to user's tenant
    const invoice = await db.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    if (invoice.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    const pdfBuffer = await generateInvoicePdf(id);
    const filename = `invoice-${invoice.invoiceNumber}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Invoice PDF] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}

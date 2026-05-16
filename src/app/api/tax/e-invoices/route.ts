import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
// FIX (M-8): Added GSTN API integration architecture
import {
  generateGSTNIRN,
  validateEInvoiceData,
  type GstnEInvoiceData,
  type ValidationError,
} from '@/lib/gstn-client';

const createEInvoiceSchema = z.object({
  propertyId: z.string().optional(),
  invoiceId: z.string().optional(),
  folioId: z.string().optional(),
  bookingId: z.string().optional(),
  guestId: z.string().optional(),
  supplyType: z.enum(['b2b', 'b2c', 'b2cl', 'expwp', 'expwop', 'sez']).default('b2b'),
  placeOfSupply: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().datetime().optional(),
  totalValue: z.number().default(0),
  totalCgst: z.number().default(0),
  totalSgst: z.number().default(0),
  totalIgst: z.number().default(0),
  totalCess: z.number().default(0),
  totalTax: z.number().default(0),
  totalAmount: z.number().default(0),
  reverseCharge: z.boolean().default(false),
  gstSettingsId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: read access required for e-invoice listing
    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const supplyType = searchParams.get('supplyType');
    const period = searchParams.get('period');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (supplyType) where.supplyType = supplyType;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { irn: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (period) {
      const [month, year] = [parseInt(period.slice(0, 2)), parseInt(period.slice(2))];
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.invoiceDate = { gte: startDate, lte: endDate };
    }

    const [invoices, total] = await Promise.all([
      db.gstEInvoice.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          gstSettings: { select: { id: true, gstin: true, tradeName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.gstEInvoice.count({ where }),
    ]);

    // Stats
    const stats = await db.gstEInvoice.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId },
      _count: true,
      _sum: { totalTax: true, totalAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { total, limit, offset },
      stats,
    });
  } catch (error) {
    console.error('[EInvoices GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch e-invoices' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: write access required for e-invoice creation
    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createEInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // FIX (M-8): Added GSTN API integration architecture
    // Fetch GST settings to obtain the seller GSTIN for IRN generation
    let sellerGstin: string | null = null;
    let sellerTradeName: string | null = null;

    if (data.gstSettingsId) {
      const gstSettings = await db.gstSettings.findUnique({
        where: { id: data.gstSettingsId, tenantId: user.tenantId },
        select: { gstin: true, tradeName: true },
      });
      if (gstSettings) {
        sellerGstin = gstSettings.gstin;
        sellerTradeName = gstSettings.tradeName;
      }
    }

    // If no GST settings specified, try to find one linked to the property
    if (!sellerGstin && data.propertyId) {
      const gstSettings = await db.gstSettings.findFirst({
        where: { propertyId: data.propertyId, tenantId: user.tenantId },
        select: { id: true, gstin: true, tradeName: true },
      });
      if (gstSettings) {
        sellerGstin = gstSettings.gstin;
        sellerTradeName = gstSettings.tradeName;
      }
    }

    // Attempt to generate IRN via GSTN client
    let irn: string | null = null;
    let signedQrCode: string | null = null;
    let signedInvoice: string | null = null;
    let ackNo: string | null = null;
    let ackDate: Date | null = null;
    let irnStatus: 'PENDING' | 'GENERATED' | 'FAILED' = 'PENDING';
    let errorDetails: string | null = null;

    if (sellerGstin) {
      try {
        const invoicePayload: GstnEInvoiceData = {
          supplyType: data.supplyType,
          placeOfSupply: data.placeOfSupply || '',
          invoiceNumber: data.invoiceNumber || '',
          invoiceDate: (data.invoiceDate || new Date().toISOString()).toString(),
          totalValue: data.totalValue,
          totalCgst: data.totalCgst,
          totalSgst: data.totalSgst,
          totalIgst: data.totalIgst,
          totalCess: data.totalCess,
          totalTax: data.totalTax,
          totalAmount: data.totalAmount,
          reverseCharge: data.reverseCharge,
          sellerGstin,
          sellerTradeName: sellerTradeName || '',
        };

        // Run pre-generation validation for logging purposes
        const validationErrors: ValidationError[] = validateEInvoiceData(invoicePayload);
        if (validationErrors.length > 0) {
          console.warn('[EInvoices POST] GST data validation warnings:', validationErrors.map(e => e.message).join('; '));
          // Don't block on warnings — still attempt IRN generation
        }

        const irnResponse = await generateGSTNIRN(invoicePayload);

        if (irnResponse.success) {
          irn = irnResponse.irn;
          signedQrCode = irnResponse.signedQrCode || null;
          signedInvoice = irnResponse.signedInvoice || null;
          ackNo = irnResponse.ackNo || null;
          ackDate = irnResponse.ackDate ? new Date(irnResponse.ackDate) : null;
          irnStatus = 'GENERATED';
        } else {
          irnStatus = 'FAILED';
          errorDetails = irnResponse.error || 'IRN generation failed';
          console.error('[EInvoices POST] IRN generation failed:', errorDetails);
        }
      } catch (irnError) {
        irnStatus = 'FAILED';
        errorDetails = irnError instanceof Error ? irnError.message : 'Unknown IRN generation error';
        console.error('[EInvoices POST] IRN generation exception:', irnError);
      }
    } else {
      // No GSTIN configured — mark as PENDING
      errorDetails = 'No GST settings configured for this property. IRN will be pending until GSTIN is provided.';
    }

    const invoice = await db.gstEInvoice.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        invoiceId: data.invoiceId || null,
        folioId: data.folioId || null,
        bookingId: data.bookingId || null,
        guestId: data.guestId || null,
        supplyType: data.supplyType,
        placeOfSupply: data.placeOfSupply,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        totalValue: data.totalValue,
        totalCgst: data.totalCgst,
        totalSgst: data.totalSgst,
        totalIgst: data.totalIgst,
        totalCess: data.totalCess,
        totalTax: data.totalTax,
        totalAmount: data.totalAmount,
        reverseCharge: data.reverseCharge,
        irn,
        signedInvoice,
        signedQrCode,
        ackNo,
        ackDate,
        errorDetails,
        status: irnStatus === 'GENERATED' ? 'active' : 'pending',
        generatedBy: user.id,
        gstSettingsId: data.gstSettingsId || null,
      },
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error('[EInvoices POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate e-invoice' } }, { status: 500 });
  }
}

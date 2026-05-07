import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { z } from 'zod';

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

    const body = await request.json();
    const parsed = createEInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // Generate simulated IRN (in production, this would call the GST portal API)
    const irn = `IRN${Date.now()}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const ackNo = `ACK${Date.now()}`;
    const signedQrCode = Buffer.from(JSON.stringify({
      irn,
      gstin: data.placeOfSupply || '29AAACR1234F1ZH',
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      totalAmount: data.totalAmount,
      tax: data.totalTax,
    })).toString('base64');

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
        signedQrCode,
        ackNo,
        ackDate: new Date(),
        status: 'generated',
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

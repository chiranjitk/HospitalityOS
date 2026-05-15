import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

const createSettingsSchema = z.object({
  propertyId: z.string().optional(),
  gstin: z.string().min(15, 'GSTIN must be 15 characters').max(15).optional(),
  legalName: z.string().optional(),
  tradeName: z.string().optional(),
  stateCode: z.string().max(2).default(''),
  stateName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().max(6).optional(),
  registrationType: z.enum(['regular', 'composition', 'casual', 'non-resident']).default('regular'),
  scheme: z.enum(['regular', 'composition']).default('regular'),
  gstEntityType: z.enum(['proprietary', 'partnership', 'llp', 'pvt_ltd', 'ltd', 'trust', 'society']).default('proprietary'),
  fssaiLicenseNo: z.string().optional(),
  tcsRate: z.number().min(0).max(1).default(0.01),
  tcsThreshold: z.number().min(0).default(100000),
  tds194cRate: z.number().min(0).max(1).default(0.01),
  tds194hRate: z.number().min(0).max(1).default(0.05),
  tds194jRate: z.number().min(0).max(1).default(0.10),
  panNumber: z.string().max(10).optional(),
  aadhaarNumber: z.string().max(12).optional(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: read access required for tax settings
    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const settings = await db.gstSettings.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[TaxSettings GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tax settings' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: admin/write access required to create tax settings
    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    const settings = await db.gstSettings.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        gstin: data.gstin,
        legalName: data.legalName,
        tradeName: data.tradeName,
        stateCode: data.stateCode,
        stateName: data.stateName,
        address: data.address,
        city: data.city,
        pincode: data.pincode,
        registrationType: data.registrationType,
        scheme: data.scheme,
        gstEntityType: data.gstEntityType,
        fssaiLicenseNo: data.fssaiLicenseNo,
        tcsRate: data.tcsRate,
        tcsThreshold: data.tcsThreshold,
        tds194cRate: data.tds194cRate,
        tds194hRate: data.tds194hRate,
        tds194jRate: data.tds194jRate,
        panNumber: data.panNumber,
        aadhaarNumber: data.aadhaarNumber,
        isActive: data.isActive,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: settings }, { status: 201 });
  } catch (error) {
    console.error('[TaxSettings POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create tax settings' } }, { status: 500 });
  }
}

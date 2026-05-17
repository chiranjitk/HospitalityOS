import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

// FIX (M-1): GSTIN regex per Indian GST format: 2-digit state code + 10-digit PAN + 1-digit entity + Z
// e.g. 22AAAAA0000A1Z5
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// FIX (M-1): PAN regex per Indian ITD format: 5 letters + 4 digits + 1 letter
// e.g. ABCDE1234F
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const createSettingsSchema = z.object({
  propertyId: z.string().optional(),
  gstin: z.string().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid GSTIN format. Must be 15 characters: 2-digit state code + PAN + entity code + Z',
  }).optional().or(z.literal('')),
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
  panNumber: z.string().refine((val) => !val || PAN_REGEX.test(val.toUpperCase()), {
    message: 'Invalid PAN format. Must be 10 characters: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)',
  }).optional().or(z.literal('')),
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

    // SECURITY FIX (H-5): Decrypt Aadhaar numbers before returning to client.
    // Aadhaar is stored encrypted (AES-256-GCM) in the database.
    const decryptedSettings = settings.map(s => ({
      ...s,
      aadhaarNumber: s.aadhaarNumber && isEncrypted(s.aadhaarNumber)
        ? decrypt(s.aadhaarNumber)
        : s.aadhaarNumber,
    }));

    return NextResponse.json({ success: true, data: decryptedSettings });
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
        // SECURITY FIX (H-5): Encrypt Aadhaar number before storing.
        // Aadhaar is a sensitive PII identifier (Indian UIDAI). AES-256-GCM encryption
        // via lib/encryption.ts ensures compliance with data protection requirements.
        aadhaarNumber: data.aadhaarNumber ? encrypt(data.aadhaarNumber) : null,
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

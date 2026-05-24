import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

const updateSettingsSchema = z.object({
  propertyId: z.string().optional().nullable(),
  gstin: z.string().min(15).max(15).optional().nullable(),
  legalName: z.string().optional().nullable(),
  tradeName: z.string().optional().nullable(),
  stateCode: z.string().max(2).optional(),
  stateName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  pincode: z.string().max(6).optional().nullable(),
  registrationType: z.enum(['regular', 'composition', 'casual', 'non-resident']).optional(),
  scheme: z.enum(['regular', 'composition']).optional(),
  gstEntityType: z.enum(['proprietary', 'partnership', 'llp', 'pvt_ltd', 'ltd', 'trust', 'society']).optional(),
  fssaiLicenseNo: z.string().optional().nullable(),
  tcsRate: z.number().min(0).max(1).optional(),
  tcsThreshold: z.number().min(0).optional(),
  tds194cRate: z.number().min(0).max(1).optional(),
  tds194hRate: z.number().min(0).max(1).optional(),
  tds194jRate: z.number().min(0).max(1).optional(),
  panNumber: z.string().max(10).optional().nullable(),
  aadhaarNumber: z.string().max(12).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: read access required
    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const settings = await db.gstSettings.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        sacCodes: { where: { isActive: true }, orderBy: { serviceType: 'asc' } },
      },
    });

    if (!settings) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tax settings not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[TaxSettings GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tax settings' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: write access required to update tax settings
    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const existing = await db.gstSettings.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tax settings not found' } }, { status: 404 });
    }

    // SECURITY FIX: Encrypt Aadhaar number on update (same as create route)
    if (parsed.data.aadhaarNumber !== undefined && parsed.data.aadhaarNumber !== null) {
      parsed.data.aadhaarNumber = encrypt(parsed.data.aadhaarNumber);
    }

    const settings = await db.gstSettings.update({
      where: { id },
      data: parsed.data,
      include: { property: { select: { id: true, name: true } } },
    });

    // Decrypt Aadhaar before returning
    const decryptedSettings = {
      ...settings,
      aadhaarNumber: settings.aadhaarNumber && isEncrypted(settings.aadhaarNumber)
        ? decrypt(settings.aadhaarNumber)
        : settings.aadhaarNumber,
    };

    return NextResponse.json({ success: true, data: decryptedSettings });
  } catch (error) {
    console.error('[TaxSettings PUT/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tax settings' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: admin access required to delete tax settings
    if (!hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.gstSettings.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tax settings not found' } }, { status: 404 });
    }

    await db.gstSettings.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Tax settings deleted' });
  } catch (error) {
    console.error('[TaxSettings DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tax settings' } }, { status: 500 });
  }
}

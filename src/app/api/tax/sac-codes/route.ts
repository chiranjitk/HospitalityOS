import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

const createSacCodeSchema = z.object({
  serviceType: z.enum(['room_rent', 'restaurant', 'fnb', 'laundry', 'minibar', 'spa', 'events', 'parking', 'other']),
  sacCode: z.string().min(1, 'SAC code is required'),
  description: z.string().optional(),
  cgstRate: z.number().min(0).max(1).default(0.09),
  sgstRate: z.number().min(0).max(1).default(0.09),
  igstRate: z.number().min(0).max(1).default(0.18),
  cessRate: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (isActive && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const sacCodes = await db.gstSacCode.findMany({
      where,
      orderBy: { serviceType: 'asc' },
    });

    return NextResponse.json({ success: true, data: sacCodes });
  } catch (error) {
    console.error('[SacCodes GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SAC codes' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSacCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await db.gstSacCode.findFirst({
      where: { tenantId: user.tenantId, serviceType: data.serviceType },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: `SAC code for ${data.serviceType} already exists` } }, { status: 409 });
    }

    const sacCode = await db.gstSacCode.create({
      data: {
        tenantId: user.tenantId,
        serviceType: data.serviceType,
        sacCode: data.sacCode,
        description: data.description,
        cgstRate: data.cgstRate,
        sgstRate: data.sgstRate,
        igstRate: data.igstRate,
        cessRate: data.cessRate,
        isActive: data.isActive,
      },
    });

    return NextResponse.json({ success: true, data: sacCode }, { status: 201 });
  } catch (error) {
    console.error('[SacCodes POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create SAC code' } }, { status: 500 });
  }
}

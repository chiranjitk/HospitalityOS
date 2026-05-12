import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { z } from 'zod';

const updateSacCodeSchema = z.object({
  sacCode: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  cgstRate: z.number().min(0).max(1).optional(),
  sgstRate: z.number().min(0).max(1).optional(),
  igstRate: z.number().min(0).max(1).optional(),
  cessRate: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const sacCode = await db.gstSacCode.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!sacCode) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'SAC code not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sacCode });
  } catch (error) {
    console.error('[SacCodes GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SAC code' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSacCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const existing = await db.gstSacCode.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'SAC code not found' } }, { status: 404 });
    }

    const sacCode = await db.gstSacCode.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: sacCode });
  } catch (error) {
    console.error('[SacCodes PUT/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update SAC code' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.gstSacCode.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'SAC code not found' } }, { status: 404 });
    }

    await db.gstSacCode.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'SAC code deleted' });
  } catch (error) {
    console.error('[SacCodes DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete SAC code' } }, { status: 500 });
  }
}

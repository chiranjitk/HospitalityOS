import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { postBEOToFolio, getBEOSummary, reverseBEOPosting } from '@/lib/events/beo-folio-service';

// POST /api/events/beo/[id]/folio — Post BEO charges to folio
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const result = await postBEOToFolio(id, user.tenantId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('POST /api/events/beo/[id]/folio:', error);
    if (error instanceof Error && error.message.includes('Cannot post BEO to folio')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to post BEO to folio' }, { status: 500 });
  }
}

// GET /api/events/beo/[id]/folio — Get BEO financial summary
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.view', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const summary = await getBEOSummary(id);

    return NextResponse.json({ success: true, data: summary });
  } catch (error: unknown) {
    console.error('GET /api/events/beo/[id]/folio:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch BEO folio summary' }, { status: 500 });
  }
}

// DELETE /api/events/beo/[id]/folio — Reverse BEO folio posting
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return NextResponse.json({ success: false, error: 'A reversal reason is required (min 3 characters)' }, { status: 400 });
    }

    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const result = await reverseBEOPosting(id, user.tenantId, reason.trim());

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('DELETE /api/events/beo/[id]/folio:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to reverse BEO folio posting' }, { status: 500 });
  }
}

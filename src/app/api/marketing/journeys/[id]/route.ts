import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/marketing/journeys/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const journey = await db.journeyCampaign.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        actions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!journey) {
      return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
    }

    // Aggregate action performance metrics
    const metrics = {
      totalSent: journey.actions.reduce((s, a) => s + a.sentCount, 0),
      totalOpened: journey.actions.reduce((s, a) => s + a.openedCount, 0),
      totalClicked: journey.actions.reduce((s, a) => s + a.clickedCount, 0),
      totalConverted: journey.actions.reduce((s, a) => s + a.convertedCount, 0),
      openRate: 0,
      clickRate: 0,
      conversionRate: 0,
    };
    metrics.openRate = metrics.totalSent > 0 ? Math.round((metrics.totalOpened / metrics.totalSent) * 10000) / 100 : 0;
    metrics.clickRate = metrics.totalSent > 0 ? Math.round((metrics.totalClicked / metrics.totalSent) * 10000) / 100 : 0;
    metrics.conversionRate = metrics.totalSent > 0 ? Math.round((metrics.totalConverted / metrics.totalSent) * 10000) / 100 : 0;

    return NextResponse.json({ success: true, data: { ...journey, metrics } });
  } catch (error) {
    console.error('Error fetching journey:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch journey' }, { status: 500 });
  }
}

// PUT /api/marketing/journeys/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.journeyCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.journeyType !== undefined) data.journeyType = body.journeyType;
    if (body.triggerEvent !== undefined) data.triggerEvent = body.triggerEvent;
    if (body.targetSegments !== undefined) data.targetSegments = JSON.stringify(body.targetSegments);
    if (body.status !== undefined) {
      const allowedStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
      }
      data.status = body.status;
    }

    const journey = await db.journeyCampaign.update({
      where: { id },
      data,
      include: { actions: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, data: journey });
  } catch (error) {
    console.error('Error updating journey:', error);
    return NextResponse.json({ success: false, error: 'Failed to update journey' }, { status: 500 });
  }
}

// DELETE /api/marketing/journeys/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await db.journeyCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
    }

    // Only allow deleting 'draft' journeys
    if (existing.status !== 'draft') {
      return NextResponse.json({ success: false, error: `Cannot delete journey with status '${existing.status}'. Only draft journeys can be deleted.` }, { status: 400 });
    }

    await db.journeyCampaign.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: 'Journey deleted' } });
  } catch (error) {
    console.error('Error deleting journey:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete journey' }, { status: 500 });
  }
}

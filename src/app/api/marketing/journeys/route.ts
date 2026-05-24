import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/marketing/journeys — List journey campaigns
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const journeyType = searchParams.get('journeyType');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (journeyType) where.journeyType = journeyType;

    const journeys = await db.journeyCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const stats = {
      total: journeys.length,
      active: journeys.filter((j) => j.status === 'active').length,
      draft: journeys.filter((j) => j.status === 'draft').length,
      totalContacts: journeys.reduce((s, j) => s + j.totalContacts, 0),
      totalConverted: journeys.reduce((s, j) => s + j.convertedCount, 0),
      totalRevenue: journeys.reduce((s, j) => s + j.revenue, 0),
    };

    return NextResponse.json({ success: true, data: { journeys, stats } });
  } catch (error) {
    console.error('Error fetching journeys:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch journeys' }, { status: 500 });
  }
}

// POST /api/marketing/journeys — Create journey campaign
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, journeyType, triggerEvent, targetSegments, actions } = body;

    if (!name || !journeyType || !triggerEvent) {
      return NextResponse.json({ success: false, error: 'Name, journeyType, and triggerEvent are required' }, { status: 400 });
    }

    const allowedActionTypes = ['email', 'sms', 'wait', 'notification', 'tag', 'webhook'];
    if (actions) {
      for (const a of actions) {
        if (a.actionType && !allowedActionTypes.includes(a.actionType)) {
          return NextResponse.json({ success: false, error: `Invalid actionType: ${a.actionType}. Allowed: ${allowedActionTypes.join(', ')}` }, { status: 400 });
        }
      }
    }

    const journey = await db.journeyCampaign.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        journeyType,
        triggerEvent,
        targetSegments: targetSegments ? JSON.stringify(targetSegments) : '[]',
        actions: actions
          ? {
              create: actions.map((a: Record<string, unknown>, i: number) => ({
                tenantId: user.tenantId,
                stageId: a.stageId || null,
                actionType: a.actionType || 'email',
                actionConfig: a.actionConfig ? JSON.stringify(a.actionConfig) : '{}',
                subject: a.subject || null,
                content: a.content || null,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { actions: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, data: journey }, { status: 201 });
  } catch (error) {
    console.error('Error creating journey:', error);
    return NextResponse.json({ success: false, error: 'Failed to create journey' }, { status: 500 });
  }
}

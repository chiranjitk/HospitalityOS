import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/marketing/journeys/[id]/execute — Trigger campaign execution
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const journey = await db.journeyCampaign.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { actions: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!journey) {
      return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
    }

    if (journey.status === 'completed') {
      return NextResponse.json({ success: false, error: 'Cannot execute a completed journey' }, { status: 400 });
    }

    // Block re-execution if already active
    if (journey.status === 'active') {
      return NextResponse.json({ success: false, error: 'Journey is already active' }, { status: 400 });
    }

    // Update journey status and timestamps
    const updatedJourney = await db.journeyCampaign.update({
      where: { id },
      data: {
        status: 'active',
        startedAt: journey.startedAt || new Date(),
        totalContacts: journey.totalContacts + Math.floor(Math.random() * 50) + 10, // Simulate contacts
      },
      include: { actions: { orderBy: { sortOrder: 'asc' } } },
    });

    // Simulate execution: increment action metrics
    for (const action of updatedJourney.actions) {
      const sentInc = Math.floor(Math.random() * 30) + 5;
      await db.journeyAction.update({
        where: { id: action.id },
        data: {
          sentCount: action.sentCount + sentInc,
          openedCount: action.openedCount + Math.floor(sentInc * (0.3 + Math.random() * 0.4)),
          clickedCount: action.clickedCount + Math.floor(sentInc * (0.1 + Math.random() * 0.2)),
          convertedCount: action.convertedCount + Math.floor(sentInc * (0.02 + Math.random() * 0.08)),
        },
      });
    }

    // Update campaign aggregate metrics
    const refreshed = await db.journeyCampaign.findUnique({
      where: { id },
      include: { actions: true },
    });

    const totalConverted = refreshed?.actions.reduce((s, a) => s + a.convertedCount, 0) ?? 0;
    await db.journeyCampaign.update({
      where: { id },
      data: { convertedCount: totalConverted },
    });

    return NextResponse.json({
      success: true,
      data: { message: `Journey "${journey.name}" execution triggered`, journeyId: id },
    });
  } catch (error) {
    console.error('Error executing journey:', error);
    return NextResponse.json({ success: false, error: 'Failed to execute journey' }, { status: 500 });
  }
}

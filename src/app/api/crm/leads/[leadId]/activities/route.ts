import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { addLeadActivity as logActivity, scoreLead } from '@/lib/crm/lead-pipeline';

// GET /api/crm/leads/[leadId]/activities — List activities for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { leadId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    // Verify lead belongs to tenant
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = { leadId };
    if (type) where.type = type;

    const [activities, total] = await Promise.all([
      db.leadActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.leadActivity.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[crm/leads/[leadId]/activities GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activities' } },
      { status: 500 }
    );
  }
}

// POST /api/crm/leads/[leadId]/activities — Add activity (call, email, meeting, note, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['crm.view', 'crm.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { leadId } = await params;
    const body = await request.json();
    const { type, content } = body;

    const validTypes = ['call', 'email', 'meeting', 'proposal', 'follow_up', 'note', 'status_change', 'assignment'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Content is required and must be a non-empty string' } },
        { status: 400 }
      );
    }

    // Verify lead belongs to tenant
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const activity = await logActivity(leadId, type, content.trim(), user.id);

    // Re-score lead after engagement activity (engagement adds +3 per activity)
    const rescored = await scoreLead(leadId);

    return NextResponse.json(
      {
        success: true,
        data: activity,
        leadScore: rescored.score,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[crm/leads/[leadId]/activities POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add activity' } },
      { status: 500 }
    );
  }
}

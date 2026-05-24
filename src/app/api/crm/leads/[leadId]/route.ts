import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { updateLeadStatus, getLeadActivities, scoreLead } from '@/lib/crm/lead-pipeline';

// GET /api/crm/leads/[leadId] — Get single lead with full activity history
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

    if (!hasAnyPermission(user, ['crm.view', 'crm.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { leadId } = await params;

    const lead = await db.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.tenantId !== user.tenantId || lead.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const activities = await getLeadActivities(leadId);

    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        tags: typeof lead.tags === 'string' ? JSON.parse(lead.tags) : (lead.tags || []),
      },
      activities,
    });
  } catch (error) {
    console.error('[crm/leads/[leadId] GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch lead' } },
      { status: 500 }
    );
  }
}

// PUT /api/crm/leads/[leadId] — Update specific lead
export async function PUT(
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

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    // If status update, use the pipeline function with transition validation
    if (body.status) {
      const updated = await updateLeadStatus(leadId, body.status, user.id, body.lossReason);
      return NextResponse.json({ success: true, data: updated });
    }

    // Regular field updates
    const data: Record<string, unknown> = {};
    const updatableFields = [
      'contactName', 'contactEmail', 'contactPhone', 'contactCompany',
      'estimatedArrival', 'estimatedDeparture', 'roomCount', 'guestCount',
      'estimatedRevenue', 'assignedTo', 'notes', 'followUpDate', 'lossReason',
      'priority', 'type', 'source', 'tags',
    ];
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = field === 'tags' ? JSON.stringify(body[field]) : body[field];
      }
    }

    const lead = await db.lead.update({ where: { id: leadId }, data });

    // Re-score after field updates (if scoring-relevant fields changed)
    const scoreRelevantFields = ['source', 'type', 'priority', 'estimatedRevenue', 'roomCount', 'guestCount', 'followUpDate', 'assignedTo'];
    const shouldRescore = scoreRelevantFields.some(f => body[f] !== undefined);
    if (shouldRescore) {
      await scoreLead(leadId);
      const rescored = await db.lead.findUnique({ where: { id: leadId } });
      return NextResponse.json({
        success: true,
        data: {
          ...rescored,
          tags: typeof rescored!.tags === 'string' ? JSON.parse(rescored!.tags) : (rescored!.tags || []),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        tags: typeof lead.tags === 'string' ? JSON.parse(lead.tags) : (lead.tags || []),
      },
    });
  } catch (error: unknown) {
    console.error('[crm/leads/[leadId] PUT]', error);
    const message = error instanceof Error ? error.message : 'Failed to update lead';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/leads/[leadId] — Archive lead (soft delete)
export async function DELETE(
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

    if (!hasAnyPermission(user, ['crm.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { leadId } = await params;
    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    await db.lead.update({
      where: { id: leadId },
      data: { deletedAt: new Date(), status: 'lost', lossReason: 'Archived' },
    });

    return NextResponse.json({ success: true, message: 'Lead archived' });
  } catch (error) {
    console.error('[crm/leads/[leadId] DELETE]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to archive lead' } },
      { status: 500 }
    );
  }
}

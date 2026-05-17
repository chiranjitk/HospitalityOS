import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { createLead, getLeadsByPipeline } from '@/lib/crm/lead-pipeline';
import { Prisma } from '@prisma/client';

// GET /api/crm/leads — List leads with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const type = searchParams.get('type');
    const pipeline = searchParams.get('pipeline');
    const assignedTo = searchParams.get('assignedTo');
    const view = searchParams.get('view'); // 'pipeline' or 'list'
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 }
      );
    }

    // Pipeline view returns grouped leads
    if (view === 'pipeline') {
      const grouped = await getLeadsByPipeline(user.tenantId, propertyId);
      return NextResponse.json({ success: true, data: grouped, view: 'pipeline' });
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId: user.tenantId, propertyId, deletedAt: null };

    if (status) where.status = status;
    if (source) where.source = source;
    if (type) where.type = type;
    if (pipeline) where.pipeline = pipeline;
    if (assignedTo) where.assignedTo = assignedTo;

    // Date range filter
    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, unknown> = {};
      if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
      if (dateTo) createdAtFilter.lte = new Date(dateTo);
      where.createdAt = createdAtFilter;
    }

    // Text search across contactName, contactEmail, contactPhone, contactCompany
    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search, mode: 'insensitive' } },
        { contactCompany: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Count total for pagination
    const total = await db.lead.count({ where });

    // Fetch paginated leads
    const skip = (page - 1) * limit;
    const leads = await db.lead.findMany({
      where,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    });

    const parsed = leads.map(l => ({
      ...l,
      tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : (l.tags || []),
    }));

    // Stats
    const allLeads = await db.lead.findMany({
      where: { tenantId: user.tenantId, propertyId, deletedAt: null },
    });
    const stats = {
      total: allLeads.length,
      new: allLeads.filter(l => l.status === 'new').length,
      contacted: allLeads.filter(l => l.status === 'contacted').length,
      qualified: allLeads.filter(l => l.status === 'qualified').length,
      proposalSent: allLeads.filter(l => l.status === 'proposal_sent').length,
      negotiation: allLeads.filter(l => l.status === 'negotiation').length,
      confirmed: allLeads.filter(l => l.status === 'confirmed').length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      lost: allLeads.filter(l => l.status === 'lost').length,
    };

    return NextResponse.json({
      success: true,
      data: parsed,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[crm/leads GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leads' } },
      { status: 500 }
    );
  }
}

// POST /api/crm/leads — Create new lead
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { propertyId, contactName, contactEmail, contactPhone, ...rest } = body;

    if (!propertyId || !contactName || !contactEmail || !contactPhone) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId, contactName, contactEmail, and contactPhone are required',
          },
        },
        { status: 400 }
      );
    }

    const lead = await createLead(user.tenantId, propertyId, {
      contactName,
      contactEmail,
      contactPhone,
      ...rest,
    });

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error: unknown) {
    console.error('[crm/leads POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to create lead';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

// PUT /api/crm/leads — Update lead fields
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Lead id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    const updatableFields = [
      'contactName', 'contactEmail', 'contactPhone', 'contactCompany',
      'estimatedArrival', 'estimatedDeparture', 'roomCount', 'guestCount',
      'estimatedRevenue', 'assignedTo', 'notes', 'followUpDate', 'lossReason',
      'priority', 'type', 'source', 'tags',
    ];
    for (const field of updatableFields) {
      if (updates[field] !== undefined) {
        data[field] = field === 'tags' ? JSON.stringify(updates[field]) : updates[field];
      }
    }

    const lead = await db.lead.update({ where: { id }, data });

    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        tags: typeof lead.tags === 'string' ? JSON.parse(lead.tags) : (lead.tags || []),
      },
    });
  } catch (error) {
    console.error('[crm/leads PUT]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update lead' } },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/leads — Archive lead (soft delete)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('id');

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Lead id is required' } },
        { status: 400 }
      );
    }

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
    console.error('[crm/leads DELETE]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to archive lead' } },
      { status: 500 }
    );
  }
}

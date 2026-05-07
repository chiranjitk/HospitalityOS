import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Night Audit Steps Template ───
const NIGHT_AUDIT_STEPS = [
  { stepName: 'Post room charges', stepOrder: 1 },
  { stepName: 'Verify folios', stepOrder: 2 },
  { stepName: 'Process no-shows', stepOrder: 3 },
  { stepName: 'Reconcile rooms', stepOrder: 4 },
  { stepName: 'Run reports', stepOrder: 5 },
  { stepName: 'Close business day', stepOrder: 6 },
] as const;

// ─── Zod Schemas ───
const createNightAuditSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  businessDayDate: z.string().datetime('Invalid business day date'),
  notes: z.string().optional(),
});

// ─── GET: List night audits ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.view') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.businessDayDate = dateFilter;
    }

    const [audits, total] = await Promise.all([
      db.nightAudit.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          startedByUser: { select: { id: true, firstName: true, lastName: true } },
          completedByUser: { select: { id: true, firstName: true, lastName: true } },
          steps: { orderBy: { stepOrder: 'asc' } },
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.nightAudit.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: audits,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[NightAudit GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch night audits' } }, { status: 500 });
  }
}

// ─── POST: Start new night audit ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'night-audit.create') && !hasPermission(user, 'night-audit.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createNightAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const { propertyId, businessDayDate, notes } = parsed.data;
    const auditDate = new Date(businessDayDate);

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Check if an audit already exists for this property + business day
    const existing = await db.nightAudit.findUnique({
      where: { propertyId_businessDayDate: { propertyId, businessDayDate: auditDate } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: 'Night audit already exists for this property and business day' } }, { status: 409 });
    }

    // Check for any in-progress audit on this property
    const inProgress = await db.nightAudit.findFirst({
      where: { propertyId, status: 'in_progress' },
    });
    if (inProgress) {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'An audit is already in progress for this property. Complete it before starting a new one.' } }, { status: 409 });
    }

    // Create audit with steps
    const audit = await db.nightAudit.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        auditDate: new Date(),
        businessDayDate: auditDate,
        startedBy: user.id,
        status: 'in_progress',
        notes,
        steps: {
          create: NIGHT_AUDIT_STEPS.map((s) => ({
            stepName: s.stepName,
            stepOrder: s.stepOrder,
            status: 'pending',
          })),
        },
      },
      include: {
        property: { select: { id: true, name: true } },
        startedByUser: { select: { id: true, firstName: true, lastName: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    // Create initial log entry
    await db.nightAuditLog.create({
      data: {
        nightAuditId: audit.id,
        action: 'audit_started',
        entityType: 'NightAudit',
        entityId: audit.id,
        newValue: `Night audit started by ${user.firstName} ${user.lastName}`,
        performedBy: user.id,
      },
    });

    return NextResponse.json({ success: true, data: audit }, { status: 201 });
  } catch (error) {
    console.error('[NightAudit POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create night audit' } }, { status: 500 });
  }
}

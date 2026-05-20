import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
import { auditLogService } from '@/lib/services/audit-service';

// ─── Zod Schemas ───
const createPostingRuleSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  chargeCategory: z.string().optional(),
  chargeType: z.string().optional(),
  revenueAccountId: z.string().uuid('Invalid revenue account ID'),
  taxTreatment: z.enum(['taxable', 'exempt', 'zero_rated']).default('taxable'),
  autoPost: z.boolean().default(false),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  conditions: z.record(z.unknown()).optional(),
});

// ─── GET: List posting rules ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'posting-rules.view') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const chargeCategory = searchParams.get('chargeCategory');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (chargeCategory) where.chargeCategory = chargeCategory;
    if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { chargeCategory: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      db.postingRule.findMany({
        where,
        include: {
          revenueAccount: { select: { id: true, code: true, name: true, accountType: true } },
          property: { select: { id: true, name: true } },
          _count: { select: { logs: true } },
        },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.postingRule.count({ where }),
    ]);

    // Transform data to match component expectations
    const transformedRules = rules.map((rule: Record<string, unknown>) => ({
      ...rule,
      status: rule.isActive ? 'active' : 'inactive',
    }));

    return NextResponse.json({
      success: true,
      data: transformedRules,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[PostingRules GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posting rules' } }, { status: 500 });
  }
}

// ─── POST: Create posting rule ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'posting-rules.create') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPostingRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Verify revenue account exists and belongs to tenant
    const revenueAccount = await db.revenueAccount.findFirst({
      where: { id: data.revenueAccountId, tenantId: user.tenantId },
    });
    if (!revenueAccount) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revenue account not found' } }, { status: 404 });
    }

    const rule = await db.postingRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        name: data.name,
        description: data.description,
        chargeCategory: data.chargeCategory,
        chargeType: data.chargeType,
        revenueAccountId: data.revenueAccountId,
        taxTreatment: data.taxTreatment,
        autoPost: data.autoPost,
        isActive: data.isActive,
        priority: data.priority,
        conditions: JSON.stringify(data.conditions || {}),
      },
      include: {
        revenueAccount: { select: { id: true, code: true, name: true, accountType: true } },
        property: { select: { id: true, name: true } },
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'create',
          entityType: 'posting_rule',
          entityId: rule.id,
          newValue: {
            name: rule.name,
            propertyId: rule.propertyId,
            chargeCategory: rule.chargeCategory,
            chargeType: rule.chargeType,
            revenueAccountId: rule.revenueAccountId,
            taxTreatment: rule.taxTreatment,
            autoPost: rule.autoPost,
            isActive: rule.isActive,
            priority: rule.priority,
          },
          description: `Created posting rule: ${rule.name}`,
        },
        request
      );
    } catch (auditError) {
      console.error('[PostingRules POST] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('[PostingRules POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create posting rule' } }, { status: 500 });
  }
}

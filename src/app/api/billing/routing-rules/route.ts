import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing/routing-rules — List routing rules with stats, sorted by priority
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (!includeInactive) where.isActive = true;

    const rules = await db.folioRoutingRule.findMany({
      where,
      orderBy: { priority: 'asc' },
    });

    // Build stats per category
    const categoryStats: Record<string, number> = {};
    for (const rule of rules) {
      categoryStats[rule.chargeCategory] = (categoryStats[rule.chargeCategory] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        chargeCategory: rule.chargeCategory,
        targetFolioType: rule.targetFolioType,
        priority: rule.priority,
        conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
        isActive: rule.isActive,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      })),
      stats: {
        totalRules: rules.length,
        activeRules: rules.filter((r) => r.isActive).length,
        inactiveRules: rules.filter((r) => !r.isActive).length,
        categoriesCovered: Object.keys(categoryStats),
        rulesPerCategory: categoryStats,
      },
    });
  } catch (error) {
    console.error('[routing-rules GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch routing rules' } },
      { status: 500 }
    );
  }
}

// POST /api/billing/routing-rules — Create a new routing rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, propertyId, chargeCategory, targetFolioType, priority, conditions, isActive } = body;

    if (!name || !propertyId || !chargeCategory || !targetFolioType) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name, propertyId, chargeCategory, and targetFolioType are required' } },
        { status: 400 }
      );
    }

    // Check for duplicate category+property with same priority
    const existing = await db.folioRoutingRule.findFirst({
      where: {
        tenantId: user.tenantId,
        propertyId,
        chargeCategory,
        priority: priority ?? 0,
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_RULE', message: 'An active rule with the same category and priority already exists for this property' } },
        { status: 409 }
      );
    }

    const rule = await db.folioRoutingRule.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        propertyId,
        chargeCategory,
        targetFolioType,
        priority: priority ?? 0,
        conditions: JSON.stringify(conditions || {}),
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        chargeCategory: rule.chargeCategory,
        targetFolioType: rule.targetFolioType,
        priority: rule.priority,
        conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
        isActive: rule.isActive,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[routing-rules POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create routing rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/billing/routing-rules — Update a routing rule
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, description, chargeCategory, targetFolioType, priority, conditions, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule id is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.folioRoutingRule.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Routing rule not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (chargeCategory !== undefined) updateData.chargeCategory = chargeCategory;
    if (targetFolioType !== undefined) updateData.targetFolioType = targetFolioType;
    if (priority !== undefined) updateData.priority = priority;
    if (conditions !== undefined) updateData.conditions = JSON.stringify(conditions);
    if (isActive !== undefined) updateData.isActive = isActive;

    const rule = await db.folioRoutingRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        chargeCategory: rule.chargeCategory,
        targetFolioType: rule.targetFolioType,
        priority: rule.priority,
        conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
        isActive: rule.isActive,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[routing-rules PUT]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update routing rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/routing-rules — Delete a routing rule
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule id is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.folioRoutingRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Routing rule not found' } },
        { status: 404 }
      );
    }

    await db.folioRoutingRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({
      success: true,
      message: 'Routing rule deleted successfully',
    });
  } catch (error) {
    console.error('[routing-rules DELETE]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete routing rule' } },
      { status: 500 }
    );
  }
}

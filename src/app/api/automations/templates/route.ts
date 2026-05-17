import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// GET /api/automations/templates - List automation templates (system + custom)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const isSystem = searchParams.get('isSystem');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (category) where.category = category;
    if (isSystem !== null) where.isSystem = isSystem === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const templates = await db.automationTemplate.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { usageCount: 'desc' }, { sortOrder: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        actions: typeof t.actions === 'string' ? JSON.parse(t.actions) : t.actions,
        triggerConditions: t.triggerConditions ? (typeof t.triggerConditions === 'string' ? JSON.parse(t.triggerConditions) : t.triggerConditions) : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching automation templates:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates' } }, { status: 500 });
  }
}

// POST /api/automations/templates - Create custom template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, triggerEvent, triggerConditions, actions, icon } = body;

    if (!name || !category || !triggerEvent || !actions) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name, category, triggerEvent, and actions are required' } },
        { status: 400 }
      );
    }

    const template = await db.automationTemplate.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        category,
        triggerEvent,
        triggerConditions: triggerConditions ? JSON.stringify(triggerConditions) : null,
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
        isSystem: false,
        icon: icon || null,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Error creating automation template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create template' } }, { status: 500 });
  }
}

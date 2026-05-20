import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// GET /api/guests/vip/rules — List recognition rules with active/inactive status
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.view', 'guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const isActive = sp.get('isActive');
    const ruleType = sp.get('ruleType');
    const alertLevel = sp.get('alertLevel');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (ruleType) where.ruleType = ruleType;
    if (alertLevel) where.alertLevel = alertLevel;

    const rules = await db.vipRule.findMany({
      where,
      include: {
        _count: { select: { alerts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform rules for frontend compatibility with vip-recognition.tsx
    const transformedRules = rules.map((r) => {
      let conditions: Record<string, unknown> = {};
      try {
        conditions = typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions;
      } catch {
        conditions = {};
      }

      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        alertType: r.ruleType || 'check_in',
        triggerCondition: r.alertMessage || `${r.name}: ${r.ruleType} trigger`,
        channels: (conditions.channels as string[]) || ['front_desk'],
        isActive: r.isActive,
        tierFilter: (conditions.tierFilter as string[]) || ['bronze', 'silver', 'gold', 'platinum'],
        alertCount: r._count.alerts,
      };
    });

    const stats = {
      total: rules.length,
      active: rules.filter((r) => r.isActive).length,
      inactive: rules.filter((r) => !r.isActive).length,
    };

    return NextResponse.json({ success: true, data: transformedRules, stats });
  } catch (error) {
    console.error('GET /api/guests/vip/rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch recognition rules' }, { status: 500 });
  }
}

// POST /api/guests/vip/rules — Create a new recognition rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, alertType, triggerCondition, channels, isActive, tierFilter, propertyId } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Build conditions JSON from frontend fields
    const conditions: Record<string, unknown> = {
      channels: channels || ['front_desk'],
      tierFilter: tierFilter || ['bronze', 'silver', 'gold', 'platinum'],
    };
    if (triggerCondition) conditions.triggerCondition = triggerCondition;

    const rule = await db.vipRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        ruleType: alertType || 'check_in',
        conditions: JSON.stringify(conditions),
        alertMessage: triggerCondition || null,
        isActive: isActive !== false,
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'guests',
        action: 'create',
        entityType: 'vip_rule',
        entityId: rule.id,
        newValue: {
          name,
          description: description || null,
          ruleType: alertType || 'check_in',
          channels: channels || ['front_desk'],
          tierFilter: tierFilter || ['bronze', 'silver', 'gold', 'platinum'],
          isActive: isActive !== false,
          propertyId: propertyId || null,
        },
      }, request);
    } catch (auditError) {
      console.error('[AUDIT] Failed to log VIP rule creation:', auditError);
    }

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('POST /api/guests/vip/rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to create recognition rule' }, { status: 500 });
  }
}

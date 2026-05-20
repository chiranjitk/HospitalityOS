import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// PUT /api/guests/vip/rules/[id] — Toggle rule active/inactive or update rule config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify the rule exists and belongs to tenant
    const existing = await db.vipRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, ruleType, conditions, alertLevel, alertMessage, autoUpgrade, isActive } = body;

    // Parse existing conditions for merging
    let existingConditions: Record<string, unknown> = {};
    try {
      existingConditions = typeof existing.conditions === 'string' ? JSON.parse(existing.conditions) : (existing.conditions || {});
    } catch {
      existingConditions = {};
    }

    // If channels or tierFilter provided in update, merge into conditions
    let mergedConditions = { ...existingConditions };
    if (body.channels) mergedConditions.channels = body.channels;
    if (body.tierFilter) mergedConditions.tierFilter = body.tierFilter;
    if (body.triggerCondition) mergedConditions.triggerCondition = body.triggerCondition;

    // Capture old values for audit
    const oldValues: Record<string, unknown> = {
      name: existing.name,
      description: existing.description,
      ruleType: existing.ruleType,
      alertLevel: existing.alertLevel,
      alertMessage: existing.alertMessage,
      autoUpgrade: existing.autoUpgrade,
      isActive: existing.isActive,
    };

    const updated = await db.vipRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(ruleType !== undefined && { ruleType }),
        ...(conditions !== undefined && { conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions) }),
        ...((Object.keys(mergedConditions).length > 0 || body.channels || body.tierFilter) && {
          conditions: JSON.stringify(mergedConditions),
        }),
        ...(alertLevel !== undefined && { alertLevel }),
        ...(alertMessage !== undefined && { alertMessage }),
        ...(autoUpgrade !== undefined && { autoUpgrade }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'guests',
        action: 'update',
        entityType: 'vip_rule',
        entityId: id,
        oldValue: oldValues,
        newValue: {
          name: updated.name,
          description: updated.description,
          ruleType: updated.ruleType,
          alertLevel: updated.alertLevel,
          alertMessage: updated.alertMessage,
          autoUpgrade: updated.autoUpgrade,
          isActive: updated.isActive,
        },
      }, request);
    } catch (auditError) {
      console.error('[AUDIT] Failed to log VIP rule update:', auditError);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('PUT /api/guests/vip/rules/[id]:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update rule' }, { status: 500 });
  }
}

// DELETE /api/guests/vip/rules/[id] — Remove a rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify the rule exists and belongs to tenant
    const existing = await db.vipRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    await db.vipRule.delete({ where: { id } });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'guests',
        action: 'delete',
        entityType: 'vip_rule',
        entityId: id,
        oldValue: {
          name: existing.name,
          description: existing.description,
          ruleType: existing.ruleType,
          alertLevel: existing.alertLevel,
          alertMessage: existing.alertMessage,
          autoUpgrade: existing.autoUpgrade,
          isActive: existing.isActive,
        },
      }, request);
    } catch (auditError) {
      console.error('[AUDIT] Failed to log VIP rule deletion:', auditError);
    }

    return NextResponse.json({ success: true, message: `Rule "${existing.name}" deleted successfully` });
  } catch (error: unknown) {
    console.error('DELETE /api/guests/vip/rules/[id]:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 });
  }
}

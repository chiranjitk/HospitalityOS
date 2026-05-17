import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/payments/fraud/rules - List fraud detection rules for tenant (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage', 'payments.manage'])) {
      return NextResponse.json({ success: false, error: 'Admin permission required' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const isEnabled = searchParams.get('isEnabled');
    const ruleType = searchParams.get('ruleType');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (isEnabled !== null && isEnabled !== undefined) {
      where.isEnabled = isEnabled === 'true';
    }

    if (ruleType) {
      where.ruleType = ruleType;
    }

    const rules = await db.fraudDetectionRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Error fetching fraud rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch fraud rules' } },
      { status: 500 }
    );
  }
}

// POST /api/payments/fraud/rules - Create new rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: 'Admin permission required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, ruleType, conditions, action, severity, isEnabled } = body;

    // Validate required fields
    if (!name || !ruleType || !conditions) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, ruleType, conditions' } },
        { status: 400 }
      );
    }

    const validRuleTypes = ['velocity', 'amount', 'geolocation', 'pattern', 'device_fingerprint'];
    if (!validRuleTypes.includes(ruleType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid ruleType. Must be one of: ${validRuleTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    const validActions = ['flag', 'block', 'review', 'mfa_required'];
    if (action && !validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
        { status: 400 }
      );
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate conditions is valid JSON
    let parsedConditions: unknown;
    try {
      parsedConditions = JSON.parse(conditions);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'conditions must be valid JSON' } },
        { status: 400 }
      );
    }

    // If conditions is already an object, stringify it
    const conditionsStr = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);

    const rule = await db.fraudDetectionRule.create({
      data: {
        tenantId: user.tenantId,
        name,
        description: description || null,
        ruleType,
        conditions: conditionsStr,
        action: action || 'flag',
        severity: severity || 'medium',
        isEnabled: isEnabled !== false,
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating fraud rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create fraud rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/payments/fraud/rules - Update rule
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: 'Admin permission required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, ruleType, conditions, action, severity, isEnabled } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.fraudDetectionRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (ruleType !== undefined) updateData.ruleType = ruleType;
    if (conditions !== undefined) {
      const conditionsStr = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
      updateData.conditions = conditionsStr;
    }
    if (action !== undefined) updateData.action = action;
    if (severity !== undefined) updateData.severity = severity;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const updated = await db.fraudDetectionRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating fraud rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update fraud rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/fraud/rules - Delete rule
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: 'Admin permission required' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: id' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.fraudDetectionRule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    await db.fraudDetectionRule.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting fraud rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete fraud rule' } },
      { status: 500 }
    );
  }
}

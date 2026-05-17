import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/payments/fraud/alerts - List fraud alerts with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage', 'payments.view'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const alertType = searchParams.get('alertType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    if (alertType) {
      where.alertType = alertType;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [alerts, total] = await Promise.all([
      db.fraudAlert.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              transactionId: true,
              status: true,
            },
          },
          rule: {
            select: {
              id: true,
              name: true,
              ruleType: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: parseInt(limit, 10) } : {}),
        ...(offset ? { skip: parseInt(offset, 10) } : {}),
      }),
      db.fraudAlert.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch fraud alerts' } },
      { status: 500 }
    );
  }
}

// PUT /api/payments/fraud/alerts - Update alert status (review, dismiss, confirm fraud)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage', 'payments.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, resolution } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, status' } },
        { status: 400 }
      );
    }

    const validStatuses = ['reviewed', 'dismissed', 'confirmed_fraud'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.fraudAlert.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    const updated = await db.fraudAlert.update({
      where: { id },
      data: {
        status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        resolution: resolution || null,
      },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            transactionId: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating fraud alert:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update fraud alert' } },
      { status: 500 }
    );
  }
}

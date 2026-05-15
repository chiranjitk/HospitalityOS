import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { evaluateTransaction } from '@/lib/fraud-detection';

// POST /api/payments/fraud-check - Run fraud check on a pending payment
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.view', 'payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { amount, currency = 'USD', userId, ip, deviceFingerprint, paymentMethod, paymentId } = body;

    // Validate required fields
    if (!amount || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: amount, paymentMethod' } },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' } },
        { status: 400 }
      );
    }

    // Run fraud detection
    const result = await evaluateTransaction({
      tenantId: user.tenantId,
      amount: parseFloat(amount),
      currency,
      userId,
      ip: ip || request.headers.get('x-forwarded-for') || undefined,
      deviceFingerprint,
      paymentMethod,
      paymentId,
    });

    return NextResponse.json({
      success: true,
      data: {
        allowed: result.allowed,
        riskScore: result.riskScore,
        alerts: result.alerts,
        action: result.action,
      },
    });
  } catch (error) {
    console.error('Error running fraud check:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Fraud check failed' } },
      { status: 500 }
    );
  }
}

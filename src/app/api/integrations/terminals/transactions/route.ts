import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/terminals/transactions — list terminal transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const terminalId = searchParams.get('terminalId');
    const status = searchParams.get('status');
    const transactionType = searchParams.get('type');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (terminalId) where.terminalId = terminalId;
    if (status) where.status = status;
    if (transactionType) where.transactionType = transactionType;

    const transactions = await db.terminalTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error listing terminal transactions:', error);
    return NextResponse.json({ success: false, error: 'Failed to list transactions' }, { status: 500 });
  }
}

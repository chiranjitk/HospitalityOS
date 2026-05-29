/**
 * Cash Book API — CRUD for CashBookEntry
 *
 * GET:    List cash book entries (paginated, filterable by propertyId, date, status)
 * POST:   Create a new cash book entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      db.cashBookEntry.findMany({
        where,
        include: {
          transactions: true,
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.cashBookEntry.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list cash book entries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, date, openingBalance, closingBalance, transactions } = body;

    if (!propertyId || !date) {
      return NextResponse.json({ error: 'propertyId and date are required' }, { status: 400 });
    }

    // INVARIANT CHECK: closingBalance must equal openingBalance + income - expense
    // M-28 / CRITICAL-12: Individual cash book transactions are persisted to the DB
    // via the Prisma nested `transactions: { create: [...] }` block below (lines 108–121).
    // This was verified as already-fixed; the comment documents the invariant.
    const incomeAmount = Array.isArray(transactions)
      ? transactions
          .filter((t: Record<string, unknown>) => t.type === 'income' || t.type === 'credit')
          .reduce((sum: number, t: Record<string, unknown>) => sum + (Number(t.amount) || 0), 0)
      : 0;
    const expenseAmount = Array.isArray(transactions)
      ? transactions
          .filter((t: Record<string, unknown>) => t.type === 'expense' || t.type === 'debit')
          .reduce((sum: number, t: Record<string, unknown>) => sum + (Number(t.amount) || 0), 0)
      : 0;

    const expectedClosing = (openingBalance ?? 0) + incomeAmount - expenseAmount;
    const actualClosing = closingBalance ?? 0;

    if (Math.abs(expectedClosing - actualClosing) > 0.01) {
      return NextResponse.json(
        { error: `Balance invariant violated: openingBalance (${openingBalance ?? 0}) + income (${incomeAmount}) - expense (${expenseAmount}) = ${expectedClosing}, but closingBalance is ${actualClosing}. Difference: ${Math.round((actualClosing - expectedClosing) * 100) / 100}` },
        { status: 400 }
      );
    }

    const entry = await db.cashBookEntry.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        date: new Date(date),
        openingBalance: openingBalance ?? 0,
        closingBalance: closingBalance ?? 0,
        preparedBy: user.id,
        transactions: Array.isArray(transactions)
          ? {
              create: transactions.map((t: Record<string, unknown>, idx: number) => ({
                time: t.time || String(idx).padStart(2, '0') + ':00',
                description: t.description || 'Cash transaction',
                category: t.category || t.type || 'receipt',
                amount: Number(t.amount) || 0,
                reference: t.reference || t.folioId || null,
                paymentMethod: t.paymentMethod || 'cash',
                createdBy: user.id,
                approved: false,
              })),
            }
          : undefined,
      },
      include: { transactions: true },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create cash book entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

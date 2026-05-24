import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/resort/casino/transactions - List casino transactions
 * Query params: page, limit, tableId, transactionType, guestId, dateFrom, dateTo
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['resort.casino.view', 'resort.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const tableId = searchParams.get('tableId');
    const transactionType = searchParams.get('transactionType');
    const guestId = searchParams.get('guestId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (tableId) where.tableId = tableId;
    if (transactionType && transactionType !== 'all') where.transactionType = transactionType;
    if (guestId) where.guestId = guestId;
    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [transactions, total] = await Promise.all([
      db.casinoTransaction.findMany({
        where,
        include: {
          casinoTable: {
            select: { id: true, name: true, gameType: true, tableNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.casinoTransaction.count({ where }),
    ]);

    // Stats - today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayBuy, todayCash, todayWin, todayBet, todayCount, todayComp] = await Promise.all([
      db.casinoTransaction.aggregate({
        where: { tenantId: user.tenantId, transactionType: 'chip_buy', createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.casinoTransaction.aggregate({
        where: { tenantId: user.tenantId, transactionType: 'chip_cash', createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.casinoTransaction.aggregate({
        where: { tenantId: user.tenantId, transactionType: 'win', createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.casinoTransaction.aggregate({
        where: { tenantId: user.tenantId, transactionType: 'bet', createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.casinoTransaction.count({ where: { tenantId: user.tenantId, createdAt: { gte: today, lt: tomorrow } } }),
      db.casinoTransaction.aggregate({
        where: { tenantId: user.tenantId, transactionType: 'comp', createdAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
    ]);

    // Transaction type breakdown
    const typeBreakdown = await db.casinoTransaction.groupBy({
      by: ['transactionType'],
      where: { tenantId: user.tenantId, createdAt: { gte: today, lt: tomorrow } },
      _count: { id: true },
      _sum: { amount: true },
    });

    return NextResponse.json({
      success: true,
      data: transactions.map(t => ({
        id: t.id,
        tableId: t.tableId,
        guestId: t.guestId,
        folioId: t.folioId,
        bookingId: t.bookingId,
        transactionType: t.transactionType,
        amount: t.amount,
        currency: t.currency,
        chipColor: t.chipColor,
        pitBossApproval: t.pitBossApproval,
        table: t.casinoTable,
        createdAt: t.createdAt.toISOString(),
      })),
      stats: {
        todayChipBuy: todayBuy._sum.amount || 0,
        todayChipCash: todayCash._sum.amount || 0,
        todayPayouts: todayWin._sum.amount || 0,
        todayTotalBets: todayBet._sum.amount || 0,
        todayComps: todayComp._sum.amount || 0,
        todayTransactionCount: todayCount,
        todayNetRevenue: (todayBuy._sum.amount || 0) - (todayWin._sum.amount || 0) - (todayComp._sum.amount || 0),
        typeBreakdown: typeBreakdown.map(b => ({
          type: b.transactionType,
          count: b._count.id,
          amount: b._sum.amount || 0,
        })),
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching casino transactions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch casino transactions' }, { status: 500 });
  }
}

/**
 * POST /api/resort/casino/transactions - Record a new casino transaction
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['resort.casino.manage', 'resort.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { tableId, guestId, folioId, bookingId, transactionType, amount, currency, chipColor, pitBossApproval } = body;

    if (!tableId || !transactionType || amount === undefined) {
      return NextResponse.json({ success: false, error: 'tableId, transactionType, and amount are required' }, { status: 400 });
    }

    // FIX: Validate amount is a valid non-negative number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a valid non-negative number' }, { status: 400 });
    }

    // FIX: Validate transactionType whitelist
    const validTypes = ['chip_buy', 'chip_cash', 'win', 'bet', 'comp', 'payout', 'tip'];
    if (!validTypes.includes(transactionType)) {
      return NextResponse.json({ success: false, error: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Verify table belongs to tenant
    const table = await db.casinoTable.findFirst({ where: { id: tableId, tenantId: user.tenantId } });
    if (!table) {
      return NextResponse.json({ success: false, error: 'Casino table not found' }, { status: 404 });
    }

    const transaction = await db.casinoTransaction.create({
      data: {
        tenantId: user.tenantId,
        tableId,
        guestId: guestId || null,
        folioId: folioId || null,
        bookingId: bookingId || null,
        transactionType,
        amount: parsedAmount,
        currency: currency || 'USD',
        chipColor: chipColor || null,
        pitBossApproval: pitBossApproval || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: transaction.id,
        ...transaction,
        table: { id: table.id, name: table.name, gameType: table.gameType },
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating casino transaction:', error);
    return NextResponse.json({ success: false, error: 'Failed to create casino transaction' }, { status: 500 });
  }
}

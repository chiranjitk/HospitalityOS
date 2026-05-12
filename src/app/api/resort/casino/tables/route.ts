import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/resort/casino/tables - List casino tables
 * Query params: page, limit, gameType, status, search, propertyId
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const gameType = searchParams.get('gameType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (gameType && gameType !== 'all') where.gameType = gameType;
    if (status && status !== 'all') where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { dealerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tables, total] = await Promise.all([
      db.casinoTable.findMany({
        where,
        include: {
          _count: { select: { transactions: true } },
        },
        orderBy: [{ gameType: 'asc' }, { tableNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.casinoTable.count({ where }),
    ]);

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openTables, totalTableCount, todayRevenue] = await Promise.all([
      db.casinoTable.count({ where: { tenantId: user.tenantId, status: 'open', isActive: true } }),
      db.casinoTable.count({ where: { tenantId: user.tenantId, isActive: true } }),
      db.casinoTransaction.aggregate({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: today },
          transactionType: { in: ['chip_buy', 'chip_cash'] },
        },
        _sum: { amount: true },
      }),
    ]);

    // Game type breakdown
    const gameTypeBreakdown = await db.casinoTable.groupBy({
      by: ['gameType'],
      where: { tenantId: user.tenantId, isActive: true },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: tables.map(t => ({
        id: t.id,
        propertyId: t.propertyId,
        name: t.name,
        gameType: t.gameType,
        tableNumber: t.tableNumber,
        minBet: t.minBet,
        maxBet: t.maxBet,
        status: t.status,
        dealerName: t.dealerName,
        isActive: t.isActive,
        transactionCount: t._count.transactions,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      stats: {
        openTables,
        totalTables: totalTableCount,
        todayRevenue: todayRevenue._sum.amount || 0,
        gameTypeBreakdown: gameTypeBreakdown.map(g => ({
          gameType: g.gameType,
          count: g._count.id,
        })),
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching casino tables:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch casino tables' }, { status: 500 });
  }
}

/**
 * POST /api/resort/casino/tables - Create a new casino table
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
    const { propertyId, name, gameType, tableNumber, minBet, maxBet, status, dealerName } = body;

    if (!propertyId || !name || !gameType || tableNumber === undefined) {
      return NextResponse.json({ success: false, error: 'propertyId, name, gameType, and tableNumber are required' }, { status: 400 });
    }

    const table = await db.casinoTable.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        gameType: gameType || 'poker',
        tableNumber: parseInt(tableNumber),
        minBet: parseFloat(minBet) || 0,
        maxBet: parseFloat(maxBet) || 0,
        status: status || 'open',
        dealerName: dealerName || null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: table.id,
        ...table,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating casino table:', error);
    return NextResponse.json({ success: false, error: 'Failed to create casino table' }, { status: 500 });
  }
}

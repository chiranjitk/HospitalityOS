import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/terminals — Payment Terminals dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view payment terminal data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const location = searchParams.get('location');

    // Fetch terminals
    const terminalWhere: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (statusFilter) terminalWhere.status = statusFilter;

    const terminals = await db.paymentTerminal.findMany({
      where: terminalWhere,
      orderBy: { createdAt: 'desc' },
    });

    const terminalIds = terminals.map(t => t.id);

    // Fetch transactions
    const transactions = await db.terminalTransaction.findMany({
      where: { tenantId: user.tenantId, terminalId: { in: terminalIds } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Fetch tokens
    const tokens = await db.storedToken.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const filteredTerminals = location
      ? terminals.filter(t => t.location === location)
      : terminals;

    const formattedTerminals = filteredTerminals.map(t => ({
      id: t.id,
      serialNumber: t.serialNumber ?? null,
      name: t.name,
      model: t.model ?? null,
      provider: t.provider,
      location: t.location ?? null,
      merchantId: null,
      status: t.status,
      connectionType: 'ethernet',
      ipAddress: t.ipAddress ?? null,
      batteryLevel: null,
      firmwareVersion: null,
      p2peCertified: t.p2peEnabled,
      lastTransaction: t.lastTransactionAt?.toISOString() ?? null,
    }));

    const formattedTransactions = transactions.map(tx => {
      const terminal = terminals.find(t => t.id === tx.terminalId);
      return {
        id: tx.id,
        terminalId: tx.terminalId,
        terminalName: terminal?.name ?? null,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.transactionType === 'sale' ? 'charge' : tx.transactionType === 'refund' ? 'refund' : tx.transactionType === 'void' ? 'void' : tx.transactionType,
        method: tx.cardType ?? null,
        last4: tx.cardLast4 ?? null,
        authCode: tx.authCode ?? null,
        status: tx.status,
        guestId: tx.folioId ?? null,
        guestName: null,
        folioId: tx.folioId ?? null,
        createdAt: tx.createdAt.toISOString(),
        processingTimeMs: null,
      };
    });

    const formattedTokens = tokens.map(tok => ({
      id: tok.id,
      token: `${tok.gateway}_${tok.tokenRef.substring(0, 4)}****`,
      type: tok.cardBrand ?? tok.tokenType,
      last4: tok.cardLast4 ?? null,
      expiryMonth: tok.expiryMonth,
      expiryYear: tok.expiryYear,
      guestId: tok.guestId ?? null,
      guestName: null,
      provider: tok.gateway,
      createdAt: tok.createdAt.toISOString(),
      lastUsed: tok.updatedAt.toISOString(),
      status: tok.status,
    }));

    // P2PE status derived from terminal data
    const p2peStatus = {
      overallCompliant: terminals.every(t => t.p2peEnabled),
      certificationExpiry: terminals.filter(t => t.p2peCertExpiry).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null,
      providers: [
        { provider: 'verifone', p2peVersion: 'v3.2', certified: true, encryptionMethod: 'AES-256', tokenFormat: 'TAVV', lastKeyRotation: null, nextKeyRotation: null },
      ],
      complianceNotes: [],
    };

    const stats = {
      totalTerminals: terminals.length,
      onlineTerminals: terminals.filter(t => t.status === 'online').length,
      offlineTerminals: terminals.filter(t => t.status === 'offline').length,
      totalTransactionsToday: transactions.length,
      todayVolume: Math.round(transactions.filter(t => t.status === 'approved' && t.transactionType === 'sale').reduce((sum, t) => sum + t.amount, 0) * 100) / 100,
      avgProcessingTime: 0,
      p2peCompliant: p2peStatus.overallCompliant,
      activeTokens: tokens.filter(t => t.status === 'active').length,
      refundsToday: transactions.filter(t => t.transactionType === 'refund').length,
      refundAmountToday: Math.round(transactions.filter(t => t.transactionType === 'refund').reduce((sum, t) => sum + t.amount, 0) * 100) / 100,
    };

    return NextResponse.json({
      success: true,
      data: {
        terminals: formattedTerminals,
        transactions: formattedTransactions,
        p2peStatus,
        tokens: formattedTokens,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching payment terminal data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment terminal data' } },
      { status: 500 }
    );
  }
}

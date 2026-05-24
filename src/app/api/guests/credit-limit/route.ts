import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/guests/credit-limit — Get guest's current credit limit and usage
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Fetch credit limit record
    let creditLimit = await db.guestCreditLimit.findUnique({
      where: { tenantId_guestId: { tenantId: user.tenantId, guestId } },
    });

    // Also check the guest record for legacy credit limit
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        creditLimit: true,
        tenantId: true,
      },
    });

    if (!guest || guest.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // If no credit limit record exists, create one from the guest's credit limit
    if (!creditLimit) {
      const currentBalance = await calculateGuestBalance(guestId, user.tenantId);
      const limit = guest.creditLimit || 0;
      const available = Math.max(0, limit - currentBalance);

      creditLimit = await db.guestCreditLimit.create({
        data: {
          tenantId: user.tenantId,
          guestId,
          limitAmount: limit,
          currentBalance,
          availableCredit: available,
          status: limit > 0 ? 'active' : 'active',
        },
      });
    } else {
      // Recalculate balance
      const currentBalance = await calculateGuestBalance(guestId, user.tenantId);
      const available = Math.max(0, creditLimit.limitAmount - currentBalance);

      if (creditLimit.currentBalance !== currentBalance || creditLimit.availableCredit !== available) {
        creditLimit = await db.guestCreditLimit.update({
          where: { id: creditLimit.id },
          data: {
            currentBalance,
            availableCredit: available,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        guestId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        limit: creditLimit.limitAmount,
        currentBalance: creditLimit.currentBalance,
        availableCredit: creditLimit.availableCredit,
        status: creditLimit.status,
        utilizationPercent: creditLimit.limitAmount > 0
          ? Math.round((creditLimit.currentBalance / creditLimit.limitAmount) * 100)
          : 0,
        adjustedBy: creditLimit.adjustedBy,
        adjustedAt: creditLimit.adjustedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[guests/credit-limit GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credit limit' } },
      { status: 500 }
    );
  }
}

// PUT /api/guests/credit-limit — Update credit limit (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestId, limitAmount, status, notes } = body;

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists
    const guest = await db.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || guest.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    const currentBalance = await calculateGuestBalance(guestId, user.tenantId);
    const limit = limitAmount !== undefined ? parseFloat(String(limitAmount)) : 0;

    // Validate limitAmount is non-negative
    if (limitAmount !== undefined && (isNaN(limit) || limit < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'limitAmount must be a non-negative number' } },
        { status: 400 }
      );
    }
    const available = Math.max(0, limit - currentBalance);
    const newStatus = status || 'active';

    // Upsert the credit limit record
    const creditLimit = await db.guestCreditLimit.upsert({
      where: { tenantId_guestId: { tenantId: user.tenantId, guestId } },
      create: {
        tenantId: user.tenantId,
        guestId,
        limitAmount: limit,
        currentBalance,
        availableCredit: available,
        status: newStatus,
        adjustedBy: user.id,
        notes: notes || null,
      },
      update: {
        limitAmount: limit !== undefined ? limit : undefined,
        availableCredit: available,
        status: newStatus,
        adjustedBy: user.id,
        notes: notes || undefined,
        adjustedAt: new Date(),
      },
    });

    // Also update the guest record's credit limit for backwards compatibility
    if (limitAmount !== undefined) {
      await db.guest.update({
        where: { id: guestId },
        data: { creditLimit: limit },
      });
    }

    // Audit trail
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'billing',
        action: 'credit_limit_updated',
        entityType: 'Guest',
        entityId: guestId,
        oldValue: JSON.stringify({ previousLimit: guest.creditLimit }),
        newValue: JSON.stringify({ newLimit: limit, status: newStatus, notes }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        guestId,
        limit: creditLimit.limitAmount,
        currentBalance: creditLimit.currentBalance,
        availableCredit: creditLimit.availableCredit,
        status: creditLimit.status,
        adjustedBy: creditLimit.adjustedBy,
        adjustedAt: creditLimit.adjustedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[guests/credit-limit PUT]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update credit limit' } },
      { status: 500 }
    );
  }
}

// POST /api/guests/credit-limit — Check if a charge would exceed credit limit
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'frontdesk.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestId, chargeAmount } = body;

    if (!guestId || chargeAmount === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId and chargeAmount are required' } },
        { status: 400 }
      );
    }

    const amount = parseFloat(String(chargeAmount));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'chargeAmount must be a positive number' } },
        { status: 400 }
      );
    }

    // Get credit limit
    const creditLimit = await db.guestCreditLimit.findUnique({
      where: { tenantId_guestId: { tenantId: user.tenantId, guestId } },
    });

    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { creditLimit: true, tenantId: true, firstName: true, lastName: true },
    });

    if (!guest || guest.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    const limit = creditLimit?.limitAmount ?? guest.creditLimit ?? 0;
    const currentBalance = creditLimit?.currentBalance ?? await calculateGuestBalance(guestId, user.tenantId);
    const available = Math.max(0, limit - currentBalance);

    const wouldExceedBy = amount > available ? amount - available : 0;
    const allowed = wouldExceedBy <= 0 || limit === 0; // No limit = always allowed

    return NextResponse.json({
      success: true,
      data: {
        guestId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        allowed,
        wouldExceedBy: Math.round(wouldExceedBy * 100) / 100,
        message: allowed
          ? 'Charge is within credit limit'
          : `Charge would exceed credit limit by $${wouldExceedBy.toFixed(2)}. Current available credit is $${available.toFixed(2)}.`,
        currentBalance: Math.round(currentBalance * 100) / 100,
        limit: Math.round(limit * 100) / 100,
        availableCredit: Math.round(available * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[guests/credit-limit POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check credit limit' } },
      { status: 500 }
    );
  }
}

/**
 * calculateGuestBalance — Sums up outstanding balances across all open folios for a guest.
 */
async function calculateGuestBalance(guestId: string, tenantId: string): Promise<number> {
  const folios = await db.folio.findMany({
    where: {
      guestId,
      tenantId,
      status: { in: ['open', 'partially_paid'] },
    },
    select: { balance: true },
  });

  return folios.reduce((sum, folio) => sum + folio.balance, 0);
}

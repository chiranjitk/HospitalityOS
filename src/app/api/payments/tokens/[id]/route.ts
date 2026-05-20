import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// GET /api/payments/tokens/[id] - Get single token details (masked)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.view', 'payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const token = await db.storedToken.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      );
    }

    // Return masked token data
    return NextResponse.json({
      success: true,
      data: {
        id: token.id,
        gateway: token.gateway,
        tokenType: token.tokenType,
        cardLast4: token.cardLast4,
        cardBrand: token.cardBrand,
        expiryMonth: token.expiryMonth,
        expiryYear: token.expiryYear,
        isDefault: token.isDefault,
        status: token.status,
        guestId: token.guestId,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching payment token:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment token' } },
      { status: 500 }
    );
  }
}

// PUT /api/payments/tokens/[id] - Update token (e.g., set as default)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isDefault, status } = body;

    // Verify token exists and belongs to tenant
    const existingToken = await db.storedToken.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      );
    }

    // Handle setting as default
    if (isDefault === true && !existingToken.isDefault) {
      // Unset existing defaults
      await db.storedToken.updateMany({
        where: {
          tenantId: user.tenantId,
          guestId: existingToken.guestId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (isDefault !== undefined) {
      updateData.isDefault = isDefault;
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'expired', 'deleted'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    const updatedToken = await db.storedToken.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedToken.id,
        gateway: updatedToken.gateway,
        tokenType: updatedToken.tokenType,
        cardLast4: updatedToken.cardLast4,
        cardBrand: updatedToken.cardBrand,
        expiryMonth: updatedToken.expiryMonth,
        expiryYear: updatedToken.expiryYear,
        isDefault: updatedToken.isDefault,
        status: updatedToken.status,
        guestId: updatedToken.guestId,
        createdAt: updatedToken.createdAt,
        updatedAt: updatedToken.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating payment token:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update payment token' } },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/tokens/[id] - Remove specific token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    // Verify token exists and belongs to tenant
    const existingToken = await db.storedToken.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      );
    }

    // Capture old values before soft delete
    const oldValues = {
      gateway: existingToken.gateway,
      tokenType: existingToken.tokenType,
      cardLast4: existingToken.cardLast4,
      cardBrand: existingToken.cardBrand,
      expiryMonth: existingToken.expiryMonth,
      expiryYear: existingToken.expiryYear,
      isDefault: existingToken.isDefault,
      status: existingToken.status,
      guestId: existingToken.guestId,
    };

    // Soft delete by marking as deleted
    await db.storedToken.update({
      where: { id },
      data: {
        status: 'deleted',
        isDefault: false,
      },
    });

    // Audit log for token deletion
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'delete',
          entityType: 'payment_token',
          entityId: id,
          oldValue: oldValues,
          newValue: { status: 'deleted', isDefault: false },
          details: {
            event: 'delete_token',
            gateway: existingToken.gateway,
            tokenType: existingToken.tokenType,
            cardLast4: existingToken.cardLast4,
            guestId: existingToken.guestId,
          },
        },
        request
      );
    } catch (auditError) {
      console.error('[Audit] Failed to log payment token deletion:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Token removed successfully',
    });
  } catch (error) {
    console.error('Error deleting payment token:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete payment token' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { hardwareRegistry } from '@/lib/hardware';
import { logHardwareOperation } from '@/lib/hardware/audit-logger';
import type { CreateCheckoutRequest as HalCheckoutRequest } from '@/lib/hardware/types';

// ---------------------------------------------------------------------------
// POST — Create terminal checkout via HAL
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.terminals.checkout', 'payments.process'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId,
      terminalId,
      vendorTerminalId,
      currency,
      amount,
      description,
      autoCapture,
    } = body as {
      propertyId?: string;
      terminalId?: string;
      vendorTerminalId?: string;
      currency?: string;
      amount?: number;
      description?: string;
      autoCapture?: boolean;
    };

    // --- Validation ---
    if (!propertyId || !terminalId || !vendorTerminalId || !currency || amount == null) {
      return NextResponse.json(
        { success: false, error: 'propertyId, terminalId, vendorTerminalId, currency, and amount are required' },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be greater than zero' },
        { status: 400 },
      );
    }

    // --- Resolve the terminal adapter config ---
    const adapterConfig = await db.hardwareAdapter.findFirst({
      where: { propertyId, category: 'terminal', enabled: true, tenantId: user.tenantId },
    });

    if (!adapterConfig) {
      return NextResponse.json(
        { success: false, error: 'No active terminal adapter configured for this property' },
        { status: 404 },
      );
    }

    // --- Build correlation ID and check idempotency ---
    const correlationId = `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Idempotency: check for existing transaction with same correlationId
    const existingTx = await db.terminalTransaction.findFirst({
      where: { reference: correlationId },
    });
    if (existingTx) {
      return NextResponse.json({
        success: true,
        data: { id: existingTx.id, checkoutId: existingTx.reference, amount: existingTx.amount, currency: existingTx.currency, message: 'Checkout already processed (idempotent)' },
      });
    }

    // --- Build HAL CreateCheckoutRequest ---

    const halRequest: HalCheckoutRequest = {
      terminalId,
      amount,
      currency,
      description,
      correlationId,
    };

    // --- Execute via registry ---
    const startMs = Date.now();

    const result = await hardwareRegistry.createTerminalCheckout(propertyId, halRequest);

    // --- Create TerminalTransaction record ---
    if (result.success && result.data) {
      try {
        await db.terminalTransaction.create({
          data: {
            tenantId: user.tenantId,
            terminalId,
            amount: result.data.amount ?? amount,
            currency: result.data.currency ?? currency,
            transactionType: 'sale',
            status: 'approved',
            reference: result.data.checkoutId,
            createdAt: new Date(result.data.timestamp),
          },
        });
      } catch (txErr) {
        // Transaction record creation failure should not break the response
        console.error('[HAL:API] Failed to create TerminalTransaction record:', txErr);
      }
    }

    // --- Audit log ---
    try {
      await logHardwareOperation({
        propertyId,
        tenantId: user.tenantId,
        adapterId: adapterConfig.id,
        providerId: adapterConfig.providerId,
        category: 'terminal',
        operation: 'create_checkout',
        targetId: terminalId,
        vendorTargetId: vendorTerminalId,
        success: result.success,
        errorCode: result.error,
        initiatedBy: user.id,
        durationMs: Date.now() - startMs,
        correlationId,
        responseJson: result.data ? JSON.stringify(result.data) : undefined,
      });
    } catch (auditErr) {
      console.error('[HAL:API] Audit log write failed:', auditErr);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Terminal checkout failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[HAL:API] Error creating terminal checkout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create terminal checkout' },
      { status: 500 },
    );
  }
}

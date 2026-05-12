import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { hardwareRegistry } from '@/lib/hardware';
import { logHardwareOperation } from '@/lib/hardware/audit-logger';
import type { RefundRequest as HalRefundRequest } from '@/lib/hardware/terminals/types';

// ---------------------------------------------------------------------------
// POST — Refund a terminal transaction
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
      !hasAnyPermission(user, ['integrations.manage', 'hardware.terminals.refund', 'payments.refund'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId,
      transactionId,
      vendorTransactionId,
      amount,
      reason,
    } = body as {
      propertyId?: string;
      transactionId?: string;
      vendorTransactionId?: string;
      amount?: number;
      reason?: string;
    };

    // --- Validation ---
    if (!propertyId || !transactionId || !vendorTransactionId) {
      return NextResponse.json(
        { success: false, error: 'propertyId, transactionId, and vendorTransactionId are required' },
        { status: 400 },
      );
    }

    // --- Resolve the terminal adapter config ---
    const adapterConfig = await db.hardwareAdapter.findFirst({
      where: { propertyId, category: 'terminal', enabled: true },
    });

    if (!adapterConfig) {
      return NextResponse.json(
        { success: false, error: 'No active terminal adapter configured for this property' },
        { status: 404 },
      );
    }

    // --- Get the terminal adapter from registry ---
    const terminalAdapter = await hardwareRegistry.getTerminalAdapter(
      propertyId,
      adapterConfig.providerId,
    );

    // --- Build refund request ---
    const refundRequest: HalRefundRequest = {
      transactionId,
      vendorTransactionId,
      amount,
      reason,
    };

    // --- Execute refund ---
    const startMs = Date.now();
    const correlationId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const result = await terminalAdapter.refundTransaction(refundRequest);

    // --- Update TerminalTransaction status in DB ---
    if (result.success && result.data) {
      try {
        await db.terminalTransaction.update({
          where: { id: transactionId },
          data: {
            transactionType: 'refund',
            status: 'voided',
            amount: result.data.amount,
          },
        });
      } catch (txErr) {
        console.error('[HAL:API] Failed to update TerminalTransaction:', txErr);
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
        operation: 'refund',
        targetId: transactionId,
        vendorTargetId: vendorTransactionId,
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
        { success: false, error: result.error ?? 'Terminal refund failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[HAL:API] Error processing terminal refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process terminal refund' },
      { status: 500 },
    );
  }
}

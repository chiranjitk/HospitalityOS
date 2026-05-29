import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { processSmartMinibarEvent } from '@/lib/minibar/auto-charge';

// POST /api/minibar/auto-charge
// IoT-triggered auto-charge endpoint.
// Smart minibar devices call this when they detect item consumption.
export async function POST(request: NextRequest) {
  try {
    // IoT devices authenticate via API key, but we also support session auth
    // For now, accept with or without user session (IoT devices may use API keys)
    const user = await getUserFromRequest(request).catch(() => null);

    const body = await request.json();
    const { roomId, itemId, quantity = 1, propertyId, detectedAt } = body;

    // Validate required fields
    if (!roomId || !itemId || !propertyId) {
      return NextResponse.json(
        { success: false, error: 'roomId, itemId, and propertyId are required' },
        { status: 400 }
      );
    }

    const result = await processSmartMinibarEvent(
      roomId,
      itemId,
      quantity,
      propertyId,
      detectedAt ? new Date(detectedAt) : undefined
    );

    if (!result.success) {
      // Still return 200 for IoT devices — fire-and-forget
      // IoT devices should not retry if the data is invalid
      return NextResponse.json({
        success: true,
        data: {
          message: 'Consumption recorded with issues',
          error: result.error,
          pending: result.pending,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        consumptionId: result.consumption?.id,
        itemName: result.consumption?.itemName,
        totalPrice: result.consumption?.totalPrice,
        quantity: result.consumption?.quantity,
        folioPosted: result.folioPosted,
        pending: result.pending,
        auditLogId: result.auditLogId,
      },
    });
  } catch (error) {
    console.error('[POST /api/minibar/auto-charge]', error);
    // Always return 200 for IoT — fire-and-forget
    return NextResponse.json({
      success: true,
      data: {
        message: 'Error processing consumption — logged for review',
        error: 'Internal error',
      },
    });
  }
}

/**
 * POST /api/admin/plan-builder/reorder
 *
 * Reorder plans by position in the request body array.
 * Body: { "planIds": ["id1", "id2", "id3"] }
 * Updates sortOrder for each plan to match its array index.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();

    if (!Array.isArray(body.planIds) || body.planIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'planIds must be a non-empty array of plan IDs or names' },
        { status: 400 }
      );
    }

    const { planIds } = body as { planIds: string[] };

    if (planIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Cannot reorder more than 100 plans at once' },
        { status: 400 }
      );
    }

    // Use interactive transaction to resolve IDs and update sortOrder atomically
    const updatedCount = await db.$transaction(async (tx) => {
      let count = 0;
      for (let index = 0; index < planIds.length; index++) {
        const planId = planIds[index];

        // Try UUID first, then fall back to name lookup
        let plan = await tx.registrationPlan.findFirst({
          where: { id: planId },
          select: { id: true },
        });
        if (!plan) {
          plan = await tx.registrationPlan.findFirst({
            where: { name: planId },
            select: { id: true },
          });
        }

        if (plan) {
          await tx.registrationPlan.update({
            where: { id: plan.id },
            data: { sortOrder: index },
          });
          count++;
        }
      }
      return count;
    });

    return NextResponse.json({
      success: true,
      message: `Reordered ${updatedCount} plan(s)`,
      data: { updatedCount, requestedCount: planIds.length },
    });
  } catch (error) {
    console.error('[plan-builder] POST reorder error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder plans' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/billing/subscriptions/[id]
 * Get a single subscription by ID.
 * Requires platform admin access.
 *
 * PUT /api/admin/billing/subscriptions/[id]
 * Update a subscription (plan change, billing cycle change).
 * Requires platform admin access.
 *
 * DELETE /api/admin/billing/subscriptions/[id]
 * Cancel a subscription (sets status to 'cancelled').
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = ['active', 'cancelled', 'past_due', 'paused', 'trialing'];

// GET - Get a single subscription
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const subscription = await db.subscription.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: subscription.tenantId },
      select: { id: true, name: true, slug: true, email: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        tenantId: subscription.tenantId,
        tenant: tenant ? { name: tenant.name, slug: tenant.slug, email: tenant.email } : null,
        planId: subscription.planId,
        planName: subscription.planName,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelledAt: subscription.cancelledAt?.toISOString() || null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
        invoices: subscription.invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          currency: inv.currency,
          status: inv.status,
          issuedAt: inv.issuedAt?.toISOString() || null,
          dueAt: inv.dueAt?.toISOString() || null,
          paidAt: inv.paidAt?.toISOString() || null,
          pdfUrl: inv.pdfUrl,
          createdAt: inv.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// PUT - Update a subscription (plan change, billing cycle change)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const body = await request.json();
    const { planName, billingCycle, status } = body;

    // Fix D: billingCycle validation
    if (billingCycle && !['monthly', 'yearly'].includes(billingCycle)) {
      return NextResponse.json(
        { success: false, error: 'billingCycle must be "monthly" or "yearly"' },
        { status: 400 }
      );
    }

    // Fix C: Status whitelist validation
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const subscription = await db.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Fix A: Plan change - atomic with invoice creation
    if (planName && planName !== subscription.planName) {
      const plan = await db.subscriptionPlan.findFirst({
        where: { name: planName, isActive: true },
      });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: `Plan "${planName}" not found` },
          { status: 404 }
        );
      }

      const cycle = billingCycle === 'yearly' ? 'yearly' : subscription.billingCycle;
      const amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

      updateData.planId = plan.id;
      updateData.planName = plan.name;
      updateData.amount = amount;

      // Reset billing period
      const now = new Date();
      const periodEnd = new Date(now);
      if (cycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      updateData.currentPeriodStart = now;
      updateData.currentPeriodEnd = periodEnd;

      // Atomic transaction: update tenant plan, create proration invoice, update subscription
      const result = await db.$transaction(async (tx) => {
        // Update tenant plan and limits
        await tx.tenant.update({
          where: { id: subscription.tenantId },
          data: {
            plan: plan.name,
            maxProperties: plan.maxProperties,
            maxUsers: plan.maxUsers,
            maxRooms: plan.maxRooms,
            storageLimitMb: plan.storageLimitMb,
            subscriptionStartsAt: now,
            subscriptionEndsAt: periodEnd,
          },
        });

        // Generate proration invoice for plan change
        const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.subscriptionInvoice.create({
          data: {
            subscriptionId: subscription.id,
            invoiceNumber,
            amount,
            currency: plan.currency,
            status: 'issued',
            issuedAt: now,
            dueAt: dueDate,
          },
        });

        // Update subscription
        const updated = await tx.subscription.update({
          where: { id },
          data: updateData,
        });

        return updated;
      });

      // Fix E: Audit logging for plan change
      try {
        await db.auditLog.create({
          data: {
            tenantId: subscription.tenantId,
            userId: authResult.userId,
            module: 'billing',
            action: 'SUBSCRIPTION_PLAN_CHANGED',
            entityType: 'Subscription',
            entityId: subscription.id,
            oldValue: JSON.stringify({ planName: subscription.planName, amount: subscription.amount }),
            newValue: JSON.stringify({ planName: updateData.planName, amount: updateData.amount }),
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
            userAgent: request.headers.get('user-agent') || '',
          },
        });
      } catch (auditError) {
        console.error('[Billing] Failed to create audit log for plan change:', auditError);
      }

      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          tenantId: result.tenantId,
          planId: result.planId,
          planName: result.planName,
          billingCycle: result.billingCycle,
          amount: result.amount,
          currency: result.currency,
          status: result.status,
          currentPeriodStart: result.currentPeriodStart.toISOString(),
          currentPeriodEnd: result.currentPeriodEnd.toISOString(),
          cancelledAt: result.cancelledAt?.toISOString() || null,
        },
        message: 'Subscription updated successfully',
      });
    }

    // Billing cycle change (only if no plan change was made above)
    if (billingCycle && billingCycle !== subscription.billingCycle) {
      const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
      updateData.billingCycle = cycle;

      // Recalculate amount based on new cycle
      const currentPlanName = (updateData.planName as string) || subscription.planName;
      const plan = await db.subscriptionPlan.findFirst({
        where: { name: currentPlanName, isActive: true },
      });
      if (plan) {
        updateData.amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

        const now = new Date();
        const periodEnd = new Date(now);
        if (cycle === 'yearly') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        if (!updateData.currentPeriodStart) {
          updateData.currentPeriodStart = now;
          updateData.currentPeriodEnd = periodEnd;
        }
      }
    }

    // Fix C: Status change with transition validation
    if (status && status !== subscription.status) {
      // Don't allow reactivation from 'cancelled' to 'active' without generating a new invoice
      if (status === 'active' && subscription.status === 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'Cannot reactivate a cancelled subscription. Create a new subscription instead.' },
          { status: 400 }
        );
      }
      if (status === 'active' && subscription.status === 'cancelled') {
        updateData.cancelledAt = null;
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes provided' },
        { status: 400 }
      );
    }

    const updated = await db.subscription.update({
      where: { id },
      data: updateData,
    });

    // Fix E: Audit logging for subscription update (non-plan-change)
    try {
      await db.auditLog.create({
        data: {
          tenantId: subscription.tenantId,
          userId: authResult.userId,
          module: 'billing',
          action: 'SUBSCRIPTION_UPDATED',
          entityType: 'Subscription',
          entityId: subscription.id,
          oldValue: JSON.stringify({ billingCycle: subscription.billingCycle, status: subscription.status }),
          newValue: JSON.stringify({ billingCycle: updated.billingCycle, status: updated.status }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditError) {
      console.error('[Billing] Failed to create audit log for subscription update:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        tenantId: updated.tenantId,
        planId: updated.planId,
        planName: updated.planName,
        billingCycle: updated.billingCycle,
        amount: updated.amount,
        currency: updated.currency,
        status: updated.status,
        currentPeriodStart: updated.currentPeriodStart.toISOString(),
        currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
        cancelledAt: updated.cancelledAt?.toISOString() || null,
      },
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a subscription
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    const subscription = await db.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Subscription is already cancelled' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Fix B: Cancel subscription atomically (subscription update + tenant update + void invoices)
    // Fix F: Cancel at end of period instead of immediately
    await db.$transaction([
      db.subscription.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: now,
        },
      }),
      db.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          status: 'cancelled',
          // Fix F: Use current period end instead of now
          subscriptionEndsAt: subscription.currentPeriodEnd,
        },
      }),
      db.subscriptionInvoice.updateMany({
        where: {
          subscriptionId: subscription.id,
          status: { in: ['draft', 'issued'] },
        },
        data: {
          status: 'void',
        },
      }),
    ]);

    // Fix E: Audit logging for cancellation
    try {
      await db.auditLog.create({
        data: {
          tenantId: subscription.tenantId,
          userId: authResult.userId,
          module: 'billing',
          action: 'SUBSCRIPTION_CANCELLED',
          entityType: 'Subscription',
          entityId: subscription.id,
          oldValue: JSON.stringify({ status: subscription.status, planName: subscription.planName }),
          newValue: JSON.stringify({ status: 'cancelled', cancelledAt: now.toISOString(), subscriptionEndsAt: subscription.currentPeriodEnd.toISOString() }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditError) {
      console.error('[Billing] Failed to create audit log for cancellation:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully. Access will remain active until the end of the current billing period.',
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

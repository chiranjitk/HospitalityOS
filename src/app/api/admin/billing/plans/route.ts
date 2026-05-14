/**
 * GET /api/admin/billing/plans
 * Returns subscription plans from the database with real subscriber counts.
 * Requires platform admin access.
 *
 * POST /api/admin/billing/plans
 * Create or update a subscription plan.
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

// Default plan definitions used for seeding if DB is empty
const defaultPlanDefs = [
  {
    name: 'trial',
    displayName: 'Trial',
    description: 'Try StaySuite free for 14 days',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxProperties: 1,
    maxUsers: 3,
    maxRooms: 20,
    storageLimitMb: 500,
    features: JSON.stringify([
      { name: 'Basic PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'Basic reports', included: true },
      { name: 'Channel manager', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ]),
    sortOrder: 0,
    isPopular: false,
  },
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for small properties',
    monthlyPrice: 99,
    yearlyPrice: 990,
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 50,
    storageLimitMb: 1000,
    features: JSON.stringify([
      { name: 'Full PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'All reports', included: true },
      { name: 'Channel manager', included: true },
      { name: 'Email support', included: true },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ]),
    sortOrder: 1,
    isPopular: false,
  },
  {
    name: 'professional',
    displayName: 'Professional',
    description: 'For growing hospitality businesses',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    maxProperties: 5,
    maxUsers: 25,
    maxRooms: 200,
    storageLimitMb: 5000,
    features: JSON.stringify([
      { name: 'Everything in Starter', included: true },
      { name: 'Multi-property support', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'API access', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Priority support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Custom branding', included: false },
      { name: 'Dedicated account manager', included: false },
    ]),
    sortOrder: 2,
    isPopular: true,
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    maxProperties: 999,
    maxUsers: 999,
    maxRooms: 9999,
    storageLimitMb: 50000,
    features: JSON.stringify([
      { name: 'Everything in Professional', included: true },
      { name: 'Unlimited properties', included: true },
      { name: 'Custom branding', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'On-premise option', included: true },
      { name: 'Custom development', included: true },
      { name: '24/7 phone support', included: true },
    ]),
    sortOrder: 3,
    isPopular: false,
  },
];

async function ensurePlansSeeded() {
  const existing = await db.subscriptionPlan.count();
  if (existing === 0) {
    await db.subscriptionPlan.createMany({ data: defaultPlanDefs });
  }
}

// GET - List all subscription plans with subscriber counts
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Ensure default plans exist
    await ensurePlansSeeded();

    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Get subscriber counts from tenants
    const tenantCounts = await db.tenant.groupBy({
      by: ['plan'],
      where: { deletedAt: null },
      _count: { plan: true },
    });

    const countMap = new Map(tenantCounts.map(t => [t.plan, t._count.plan]));

    const plansWithCounts = plans.map(plan => ({
      id: plan.name,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      maxProperties: plan.maxProperties,
      maxUsers: plan.maxUsers,
      maxRooms: plan.maxRooms,
      storageLimitMb: plan.storageLimitMb,
      features: JSON.parse(plan.features || '[]'),
      isPopular: plan.isPopular,
      isCustom: plan.name === 'enterprise',
      sortOrder: plan.sortOrder,
      subscriberCount: countMap.get(plan.name) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: { plans: plansWithCounts },
    });
  } catch (error) {
    console.error('Error fetching billing plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing plans' },
      { status: 500 }
    );
  }
}

// PUT - Update a subscription plan
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { name, displayName, description, monthlyPrice, yearlyPrice, maxProperties, maxUsers, maxRooms, storageLimitMb, features } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Plan name is required' },
        { status: 400 }
      );
    }

    const existing = await db.subscriptionPlan.findFirst({ where: { name } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Fix M: parseFloat/parseInt NaN checks
    if (monthlyPrice !== undefined) {
      const parsedMonthly = parseFloat(monthlyPrice);
      if (isNaN(parsedMonthly)) {
        return NextResponse.json(
          { success: false, error: 'monthlyPrice must be a valid number' },
          { status: 400 }
        );
      }
    }
    if (yearlyPrice !== undefined) {
      const parsedYearly = parseFloat(yearlyPrice);
      if (isNaN(parsedYearly)) {
        return NextResponse.json(
          { success: false, error: 'yearlyPrice must be a valid number' },
          { status: 400 }
        );
      }
    }
    if (maxProperties !== undefined) {
      const parsedProp = parseInt(maxProperties);
      if (isNaN(parsedProp) || parsedProp < 0) {
        return NextResponse.json(
          { success: false, error: 'maxProperties must be a valid non-negative integer' },
          { status: 400 }
        );
      }
    }
    if (maxUsers !== undefined) {
      const parsedUsers = parseInt(maxUsers);
      if (isNaN(parsedUsers) || parsedUsers < 0) {
        return NextResponse.json(
          { success: false, error: 'maxUsers must be a valid non-negative integer' },
          { status: 400 }
        );
      }
    }
    if (maxRooms !== undefined) {
      const parsedRooms = parseInt(maxRooms);
      if (isNaN(parsedRooms) || parsedRooms < 0) {
        return NextResponse.json(
          { success: false, error: 'maxRooms must be a valid non-negative integer' },
          { status: 400 }
        );
      }
    }
    if (storageLimitMb !== undefined) {
      const parsedStorage = parseInt(storageLimitMb);
      if (isNaN(parsedStorage) || parsedStorage < 0) {
        return NextResponse.json(
          { success: false, error: 'storageLimitMb must be a valid non-negative integer' },
          { status: 400 }
        );
      }
    }

    // Capture old values for audit logging
    const oldValues = {
      displayName: existing.displayName,
      description: existing.description,
      monthlyPrice: existing.monthlyPrice,
      yearlyPrice: existing.yearlyPrice,
      maxProperties: existing.maxProperties,
      maxUsers: existing.maxUsers,
      maxRooms: existing.maxRooms,
      storageLimitMb: existing.storageLimitMb,
    };

    // Fix L: Plan update + tenant cascade in a transaction
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          ...(displayName !== undefined && { displayName }),
          ...(description !== undefined && { description }),
          ...(monthlyPrice !== undefined && { monthlyPrice: parseFloat(monthlyPrice) }),
          ...(yearlyPrice !== undefined && { yearlyPrice: parseFloat(yearlyPrice) }),
          ...(maxProperties !== undefined && { maxProperties: parseInt(maxProperties) }),
          ...(maxUsers !== undefined && { maxUsers: parseInt(maxUsers) }),
          ...(maxRooms !== undefined && { maxRooms: parseInt(maxRooms) }),
          ...(storageLimitMb !== undefined && { storageLimitMb: parseInt(storageLimitMb) }),
          ...(features !== undefined && { features: JSON.stringify(features) }),
          updatedAt: new Date(),
        },
      });

      // Also update all tenants on this plan with new limits
      const tenantsOnPlan = await tx.tenant.findMany({
        where: { plan: name, deletedAt: null },
        select: { id: true },
      });

      if (tenantsOnPlan.length > 0 && (maxProperties !== undefined || maxUsers !== undefined || maxRooms !== undefined || storageLimitMb !== undefined)) {
        await tx.tenant.updateMany({
          where: { plan: name, deletedAt: null },
          data: {
            ...(maxProperties !== undefined && { maxProperties: parseInt(maxProperties) }),
            ...(maxUsers !== undefined && { maxUsers: parseInt(maxUsers) }),
            ...(maxRooms !== undefined && { maxRooms: parseInt(maxRooms) }),
            ...(storageLimitMb !== undefined && { storageLimitMb: parseInt(storageLimitMb) }),
          },
        });
      }

      return { updated, tenantCount: tenantsOnPlan.length };
    });

    // Fix N: Audit logging with old and new values
    const newValues = {
      ...(displayName !== undefined && { displayName }),
      ...(description !== undefined && { description }),
      ...(monthlyPrice !== undefined && { monthlyPrice: parseFloat(monthlyPrice) }),
      ...(yearlyPrice !== undefined && { yearlyPrice: parseFloat(yearlyPrice) }),
      ...(maxProperties !== undefined && { maxProperties: parseInt(maxProperties) }),
      ...(maxUsers !== undefined && { maxUsers: parseInt(maxUsers) }),
      ...(maxRooms !== undefined && { maxRooms: parseInt(maxRooms) }),
      ...(storageLimitMb !== undefined && { storageLimitMb: parseInt(storageLimitMb) }),
      ...(features !== undefined && { features: 'updated' }),
    };

    try {
      await db.auditLog.create({
        data: {
          tenantId: authResult.tenantId,
          userId: authResult.userId,
          module: 'billing',
          action: 'PLAN_UPDATED',
          entityType: 'SubscriptionPlan',
          entityId: existing.id,
          oldValue: JSON.stringify(oldValues),
          newValue: JSON.stringify(newValues),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditError) {
      console.error('[Billing] Failed to create audit log for plan update:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.updated.name,
        name: result.updated.name,
        displayName: result.updated.displayName,
        description: result.updated.description,
        monthlyPrice: result.updated.monthlyPrice,
        yearlyPrice: result.updated.yearlyPrice,
        currency: result.updated.currency,
        maxProperties: result.updated.maxProperties,
        maxUsers: result.updated.maxUsers,
        maxRooms: result.updated.maxRooms,
        storageLimitMb: result.updated.storageLimitMb,
        features: JSON.parse(result.updated.features || '[]'),
        isPopular: result.updated.isPopular,
        subscriberCount: result.tenantCount,
      },
      message: `Plan updated. ${result.tenantCount} tenant(s) updated with new limits.`,
    });
  } catch (error) {
    console.error('Error updating billing plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update billing plan' },
      { status: 500 }
    );
  }
}

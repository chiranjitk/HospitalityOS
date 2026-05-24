/**
 * GET /api/admin/plans
 * List all SaaS subscription plans from the database with subscriber counts.
 * Auto-seeds Indian market plans if the DB is empty.
 *
 * POST /api/admin/plans
 * Create a new subscription plan in the database.
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

// Indian market plan definitions — seeded if DB is empty
const defaultPlanDefs = [
  // ──────── CLOUD PLANS ────────
  {
    name: 'cloud-starter',
    displayName: 'Starter Cloud',
    description: 'Essential PMS for small hotels & guesthouses — up to 30 rooms',
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 30,
    storageLimitMb: 2000,
    features: JSON.stringify([
      { name: 'Dashboard & Analytics', included: true },
      { name: 'PMS Core', included: true },
      { name: 'Bookings Management', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guest Management', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing & Invoicing', included: true },
      { name: 'Reports', included: true },
      { name: 'Notifications', included: true },
      { name: 'Settings & Config', included: true },
      { name: 'Help & Support', included: true },
      { name: 'WiFi RADIUS', included: false },
      { name: 'POS & Restaurant', included: false },
      { name: 'Channel Manager', included: false },
      { name: 'CRM & Marketing', included: false },
    ]),
    addonModules: JSON.stringify([]),
    sortOrder: 0,
    isPopular: false,
    isCustom: false,
  },
  {
    name: 'cloud-professional',
    displayName: 'Professional Cloud',
    description: 'Full-featured PMS with WiFi RADIUS — up to 80 rooms',
    monthlyPrice: 9999,
    yearlyPrice: 99990,
    currency: 'INR',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 2,
    maxUsers: 15,
    maxRooms: 80,
    storageLimitMb: 10000,
    features: JSON.stringify([
      { name: 'Everything in Starter', included: true },
      { name: 'Multi-Property Support', included: true },
      { name: 'Guest Experience Module', included: true },
      { name: 'POS & Restaurant', included: true },
      { name: 'CRM & Marketing', included: true },
      { name: 'Channel Manager', included: true },
      { name: 'WiFi RADIUS Authentication', included: true },
      { name: 'Revenue Management', included: false },
      { name: 'Digital Advertising', included: false },
      { name: 'AI Assistant', included: false },
    ]),
    addonModules: JSON.stringify([]),
    sortOrder: 1,
    isPopular: true,
    isCustom: false,
  },
  {
    name: 'cloud-enterprise',
    displayName: 'Enterprise Cloud',
    description: 'Unlimited cloud PMS with all cloud-compatible modules — up to 200 rooms',
    monthlyPrice: 17999,
    yearlyPrice: 179990,
    currency: 'INR',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 5,
    maxUsers: 30,
    maxRooms: 200,
    storageLimitMb: 50000,
    features: JSON.stringify([
      { name: 'All Cloud-Compatible Modules', included: true },
      { name: 'Revenue Management', included: true },
      { name: 'Digital Advertising', included: true },
      { name: 'Events / MICE', included: true },
      { name: 'Staff Management', included: true },
      { name: 'AI Assistant', included: true },
      { name: 'Automation & Workflows', included: true },
      { name: 'Chain Management', included: true },
      { name: 'Priority Support', included: true },
      { name: 'WiFi RADIUS Authentication', included: true },
      { name: 'WiFi Gateway (requires on-prem)', included: false },
      { name: 'Room VLAN Isolation (requires on-prem)', included: false },
      { name: 'ZTNA Security (requires on-prem)', included: false },
    ]),
    addonModules: JSON.stringify([]),
    sortOrder: 2,
    isPopular: false,
    isCustom: true,
  },
  // ──────── ON-PREMISE PLANS ────────
  {
    name: 'onprem-professional',
    displayName: 'Professional On-Prem',
    description: 'Full WiFi Gateway + all professional modules — data sovereignty',
    monthlyPrice: 14999,
    yearlyPrice: 149990,
    currency: 'INR',
    deploymentType: 'onprem',
    setupFee: 75000,
    maxProperties: 2,
    maxUsers: 15,
    maxRooms: 80,
    storageLimitMb: 100000,
    features: JSON.stringify([
      { name: 'All Professional Cloud Features', included: true },
      { name: 'Full WiFi Gateway', included: true },
      { name: 'Captive Portal', included: true },
      { name: 'Bandwidth Management', included: true },
      { name: 'Room VLAN Isolation', included: true },
      { name: 'ZTNA Security', included: true },
      { name: 'On-Premise Data Sovereignty', included: true },
      { name: 'Surveillance Integration', included: true },
      { name: 'IoT Smart Hotel', included: false },
      { name: 'AI Assistant', included: false },
      { name: 'Chain Management', included: false },
      { name: 'Custom Development', included: false },
    ]),
    addonModules: JSON.stringify([]),
    sortOrder: 3,
    isPopular: true,
    isCustom: false,
  },
  {
    name: 'onprem-enterprise',
    displayName: 'Enterprise On-Prem',
    description: 'Complete StaySuite with every module — unlimited scale',
    monthlyPrice: 24999,
    yearlyPrice: 249990,
    currency: 'INR',
    deploymentType: 'onprem',
    setupFee: 150000,
    maxProperties: 10,
    maxUsers: 999,
    maxRooms: 9999,
    storageLimitMb: 500000,
    features: JSON.stringify([
      { name: 'Everything in Professional On-Prem', included: true },
      { name: 'Multi-Property Management', included: true },
      { name: 'Chain Management Module', included: true },
      { name: 'AI Assistant', included: true },
      { name: 'Automation & Workflows', included: true },
      { name: 'IoT Smart Hotel', included: true },
      { name: 'Priority Support & SLA', included: true },
      { name: 'Custom Development', included: true },
      { name: 'Dedicated Account Manager', included: true },
      { name: '24/7 Phone Support', included: true },
    ]),
    addonModules: JSON.stringify([]),
    sortOrder: 4,
    isPopular: false,
    isCustom: true,
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
    // FIX: Use requirePlatformAdmin for consistency with other admin endpoints (was requireAuth)
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await ensurePlansSeeded();

    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

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
      billingPeriod: 'monthly' as const,
      deploymentType: plan.deploymentType || 'cloud',
      setupFee: plan.setupFee || 0,
      maxProperties: plan.maxProperties,
      maxUsers: plan.maxUsers,
      maxRooms: plan.maxRooms,
      storageLimitMb: plan.storageLimitMb,
      features: JSON.parse(plan.features || '[]'),
      addonModules: JSON.parse(plan.addonModules || '[]'),
      isPopular: plan.isPopular,
      isCustom: plan.isCustom,
      sortOrder: plan.sortOrder,
      subscriberCount: countMap.get(plan.name) || 0,
      status: 'active' as const,
    }));

    return NextResponse.json({
      success: true,
      data: plansWithCounts,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription plan in the database
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { name, displayName, description, monthlyPrice, yearlyPrice, deploymentType, setupFee, maxProperties, maxUsers, maxRooms, storageLimitMb, features, addonModules } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { success: false, error: 'name and displayName are required' },
        { status: 400 }
      );
    }

    const existing = await db.subscriptionPlan.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Plan with name "${name}" already exists` },
        { status: 409 }
      );
    }

    const maxSort = await db.subscriptionPlan.aggregate({
      _max: { sortOrder: true },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description: description || '',
        monthlyPrice: typeof monthlyPrice === 'number' ? monthlyPrice : 0,
        yearlyPrice: typeof yearlyPrice === 'number' ? yearlyPrice : 0,
        currency: 'INR',
        deploymentType: deploymentType || 'cloud',
        setupFee: typeof setupFee === 'number' ? setupFee : 0,
        maxProperties: typeof maxProperties === 'number' ? maxProperties : 1,
        maxUsers: typeof maxUsers === 'number' ? maxUsers : 5,
        maxRooms: typeof maxRooms === 'number' ? maxRooms : 50,
        storageLimitMb: typeof storageLimitMb === 'number' ? storageLimitMb : 1000,
        features: JSON.stringify(Array.isArray(features) ? features : []),
        addonModules: JSON.stringify(Array.isArray(addonModules) ? addonModules : []),
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        isPopular: false,
        isCustom: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: plan.name,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        billingPeriod: 'monthly',
        deploymentType: plan.deploymentType,
        setupFee: plan.setupFee,
        maxProperties: plan.maxProperties,
        maxUsers: plan.maxUsers,
        maxRooms: plan.maxRooms,
        storageLimitMb: plan.storageLimitMb,
        features: JSON.parse(plan.features || '[]'),
        addonModules: JSON.parse(plan.addonModules || '[]'),
        isPopular: plan.isPopular,
        isCustom: plan.isCustom,
        sortOrder: plan.sortOrder,
        subscriberCount: 0,
        status: 'active',
      },
      message: 'Plan created successfully',
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}

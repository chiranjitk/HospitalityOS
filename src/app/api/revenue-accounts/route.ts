import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const createRevenueAccountSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  code: z.string().min(1, 'Code is required').max(50),
  name: z.string().min(1, 'Name is required').max(255),
  accountType: z.enum(['revenue', 'liability', 'asset', 'expense', 'equity']).default('revenue'),
  category: z.enum(['room', 'food_beverage', 'minibar', 'laundry', 'spa', 'parking', 'other', 'miscellaneous', 'telecom', 'event', 'rental', 'service_charge', 'tax']).default('miscellaneous'),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

// ─── GET: List revenue accounts ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'revenue-accounts.view') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const accountType = searchParams.get('accountType');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (accountType) where.accountType = accountType;
    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      db.revenueAccount.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          postingRules: {
            select: { id: true, name: true, isActive: true },
          },
          _count: { select: { postingRules: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: Math.min(limit, 500),
        skip: offset,
      }),
      db.revenueAccount.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: accounts,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[RevenueAccounts GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch revenue accounts' } }, { status: 500 });
  }
}

// ─── POST: Create revenue account ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'revenue-accounts.create') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createRevenueAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Check for duplicate code within tenant
    const duplicate = await db.revenueAccount.findFirst({
      where: { tenantId: user.tenantId, code: data.code },
    });
    if (duplicate) {
      return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: `Revenue account with code "${data.code}" already exists` } }, { status: 409 });
    }

    const account = await db.revenueAccount.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        code: data.code,
        name: data.name,
        accountType: data.accountType,
        category: data.category,
        description: data.description,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'revenue-accounts',
        action: 'create',
        entityType: 'RevenueAccount',
        entityId: account.id,
        newValue: `Created revenue account: ${account.code} - ${account.name}`,
      },
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    console.error('[RevenueAccounts POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create revenue account' } }, { status: 500 });
  }
}

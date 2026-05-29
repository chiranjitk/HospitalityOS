import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/events/menu-packages — List menu packages
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.view', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const category = sp.get('category');
    const activeOnly = sp.get('active') !== 'false';
    const search = sp.get('search');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (category) where.category = category;
    if (activeOnly) where.isActive = true;
    if (search) where.name = { contains: search };

    const data = await db.menuPackage.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    const total = await db.menuPackage.count({ where });

    // Calculate computed fields for each package
    const enriched = data.map(pkg => {
      const itemsTotal = pkg.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const serviceCharge = Math.round(itemsTotal * pkg.serviceChargeRate * 100) / 100;
      const taxableSubtotal = itemsTotal + serviceCharge;
      const tax = Math.round(taxableSubtotal * pkg.taxRate * 100) / 100;
      return {
        ...pkg,
        itemsTotal,
        serviceCharge,
        tax,
        grandTotal: Math.round((itemsTotal + serviceCharge + tax) * 100) / 100,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('GET /api/events/menu-packages:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch menu packages' }, { status: 500 });
  }
}

// POST /api/events/menu-packages — Create a menu package
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { name, category, description, serviceChargeRate, taxRate, isActive, items = [] } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return NextResponse.json({ success: false, error: 'Package name is required' }, { status: 400 });
    }

    const validCategories = ['corporate', 'wedding', 'birthday', 'conference', 'social', 'custom'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    const pkg = await db.menuPackage.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        category: category || 'corporate',
        description: description || null,
        serviceChargeRate: serviceChargeRate ?? 0.1,
        taxRate: taxRate ?? 0.18,
        isActive: isActive ?? true,
        items: {
          create: items.map((i: { name: string; itemCategory?: string; unitPrice?: number; quantity?: number; notes?: string; sortOrder?: number }, idx: number) => ({
            tenantId: user.tenantId,
            name: i.name,
            itemCategory: i.itemCategory || 'food',
            unitPrice: i.unitPrice || 0,
            quantity: i.quantity || 1,
            notes: i.notes || null,
            sortOrder: i.sortOrder ?? idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, data: pkg }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events/menu-packages:', error);
    return NextResponse.json({ success: false, error: 'Failed to create menu package' }, { status: 500 });
  }
}

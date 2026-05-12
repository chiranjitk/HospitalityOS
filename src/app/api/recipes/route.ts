import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const categoryId = searchParams.get('categoryId');

    const where: Record<string, unknown> = { tenantId: user.tenantId, deletedAt: null };
    if (propertyId) where.propertyId = propertyId;

    const recipes = await db.recipe.findMany({
      where,
      include: {
        menuItem: { select: { id: true, name: true, price: true, category: { select: { id: true, name: true } } } },
        ingredients: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = categoryId ? recipes.filter(r => r.menuItem.category?.id === categoryId) : recipes;

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const body = await request.json();
    const { menuItemId, instructions, prepTime, cookTime, yield: servings, ingredients } = body;

    if (!menuItemId) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Menu item ID required' } }, { status: 400 });

    const totalCost = (ingredients || []).reduce((sum: number, i: { quantity: number; costPerUnit: number }) => sum + (i.quantity * i.costPerUnit), 0);
    const costPerServing = servings > 0 ? totalCost / servings : totalCost;

    const recipe = await db.recipe.create({
      data: {
        tenantId: user.tenantId, menuItemId, instructions, prepTime: prepTime || 0,
        cookTime: cookTime || 0, yield: servings || 1, costPerServing,
        ingredients: { create: (ingredients || []).map((i: { name: string; quantity: number; unit: string; costPerUnit: number; sortOrder: number }, idx: number) => ({
          tenantId: user.tenantId, name: i.name, quantity: i.quantity, unit: i.unit || 'g',
          costPerUnit: i.costPerUnit || 0, sortOrder: i.sortOrder ?? idx,
        }))},
      },
      include: { menuItem: true, ingredients: true },
    });

    return NextResponse.json({ success: true, data: recipe }, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const body = await request.json();
    const { id, instructions, prepTime, cookTime, yield: servings, ingredients } = body;
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 });

    const existing = await db.recipe.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    const totalCost = (ingredients || []).reduce((sum: number, i: { quantity: number; costPerUnit: number }) => sum + (i.quantity * i.costPerUnit), 0);
    const costPerServing = (servings || 1) > 0 ? totalCost / (servings || 1) : totalCost;

    await db.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      await tx.recipe.update({
        where: { id },
        data: { instructions, prepTime: prepTime || 0, cookTime: cookTime || 0, yield: servings || 1, costPerServing },
      });
      if (ingredients && Array.isArray(ingredients)) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((i: { name: string; quantity: number; unit: string; costPerUnit: number; sortOrder: number }, idx: number) => ({
            tenantId: user.tenantId, recipeId: id, name: i.name, quantity: i.quantity,
            unit: i.unit || 'g', costPerUnit: i.costPerUnit || 0, sortOrder: i.sortOrder ?? idx,
          })),
        });
      }
    });

    const recipe = await db.recipe.findUnique({ where: { id }, include: { menuItem: true, ingredients: { orderBy: { sortOrder: 'asc' } } } });
    return NextResponse.json({ success: true, data: recipe });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 });

    const existing = await db.recipe.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    await db.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

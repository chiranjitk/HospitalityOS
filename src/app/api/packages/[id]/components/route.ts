import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/packages/[id]/components - List components for a package plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify package exists and belongs to tenant
    const pkg = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    const components = await db.packageComponent.findMany({
      where: { packagePlanId: id },
      orderBy: { sortOrder: 'asc' },
    });

    // Calculate totals
    const includedTotal = components
      .filter(c => c.isIncluded)
      .reduce((sum, c) => sum + c.unitCost * c.includedQty, 0);
    const addonTotal = components
      .filter(c => !c.isIncluded)
      .reduce((sum, c) => sum + c.unitCost * c.includedQty, 0);

    return NextResponse.json({
      success: true,
      data: {
        components,
        totals: {
          includedTotal,
          addonTotal,
          grandTotal: includedTotal + addonTotal,
          componentCount: components.length,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/packages/[id]/components]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/packages/[id]/components - Add a component to a package plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      componentType,
      referenceId,
      referenceName,
      includedQty,
      unitCost,
      isIncluded,
      sortOrder,
    } = body;

    if (!componentType) {
      return NextResponse.json({ success: false, error: 'componentType is required' }, { status: 400 });
    }

    const validTypes = ['meal', 'experience', 'spa', 'airport_transfer', 'minibar', 'laundry', 'late_checkout', 'early_checkin', 'other'];
    if (!validTypes.includes(componentType)) {
      return NextResponse.json({ success: false, error: `Invalid componentType. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Verify package exists and belongs to tenant
    const pkg = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    const component = await db.$transaction(async (tx) => {
      const created = await tx.packageComponent.create({
        data: {
          packagePlanId: id,
          componentType,
          referenceId: referenceId || null,
          referenceName: referenceName || null,
          includedQty: includedQty ?? 1,
          unitCost: unitCost ?? 0,
          isIncluded: isIncluded ?? true,
          sortOrder: sortOrder ?? 0,
        },
      });

      // Recalculate package base price
      const allComponents = await tx.packageComponent.findMany({
        where: { packagePlanId: id },
      });
      const newBasePrice = allComponents
        .filter(c => c.isIncluded)
        .reduce((sum, c) => sum + c.unitCost * c.includedQty, 0);

      await tx.packagePlan.update({
        where: { id },
        data: { totalBasePrice: newBasePrice },
      });

      return created;
    });

    return NextResponse.json({ success: true, data: component }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/packages/[id]/components]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/packages/[id]/components - Remove a component from a package plan
// Expects { componentId } in the body
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { componentId } = body;

    if (!componentId) {
      return NextResponse.json({ success: false, error: 'componentId is required in request body' }, { status: 400 });
    }

    // Verify package exists and belongs to tenant
    const pkg = await db.packagePlan.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package plan not found' }, { status: 404 });
    }

    // Verify component belongs to this package
    const component = await db.packageComponent.findFirst({
      where: { id: componentId, packagePlanId: id },
    });

    if (!component) {
      return NextResponse.json({ success: false, error: 'Component not found in this package' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.packageComponent.delete({
        where: { id: componentId },
      });

      // Recalculate package base price
      const remainingComponents = await tx.packageComponent.findMany({
        where: { packagePlanId: id },
      });
      const newBasePrice = remainingComponents
        .filter(c => c.isIncluded)
        .reduce((sum, c) => sum + c.unitCost * c.includedQty, 0);

      await tx.packagePlan.update({
        where: { id },
        data: { totalBasePrice: newBasePrice },
      });
    });

    return NextResponse.json({ success: true, data: { id: componentId } });
  } catch (error) {
    console.error('[DELETE /api/packages/[id]/components]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

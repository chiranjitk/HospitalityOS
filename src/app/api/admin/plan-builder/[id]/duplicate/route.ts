/**
 * POST /api/admin/plan-builder/[id]/duplicate
 *
 * Duplicate an existing plan with a "-copy" suffix on both name and displayName.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import { parseFeatures, serializeFeatures } from '../../route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function findPlan(idOrName: string) {
  const byId = await db.registrationPlan.findFirst({ where: { id: idOrName } });
  if (byId) return byId;
  return db.registrationPlan.findFirst({ where: { name: idOrName } });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const source = await findPlan(id);
    if (!source) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    // Generate unique name with -copy suffix
    let copyName = `${source.name}-copy`;
    let suffix = 1;
    while (
      await db.registrationPlan.findFirst({ where: { name: copyName }, select: { id: true } })
    ) {
      copyName = `${source.name}-copy-${suffix++}`;
      if (suffix > 100) {
        return NextResponse.json(
          { success: false, error: 'Could not generate a unique copy name' },
          { status: 500 }
        );
      }
    }

    // Get next sort order
    const maxSort = await db.registrationPlan.aggregate({ _max: { sortOrder: true } });
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    // Duplicate
    const copy = await db.registrationPlan.create({
      data: {
        name: copyName,
        displayName: `${source.displayName} (Copy)`,
        description: source.description ?? '',
        price: source.price,
        currency: source.currency,
        maxProperties: source.maxProperties,
        maxRoomsPerProperty: source.maxRoomsPerProperty,
        maxUsers: source.maxUsers,
        maxStaff: source.maxStaff,
        trialDays: source.trialDays,
        highlighted: false, // copied plans are not popular by default
        isActive: true,
        sortOrder: nextSort,
        features: source.features, // copy the full features JSON as-is
      },
    });

    const payload = parseFeatures(copy.features);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: copy.id,
          name: copy.name,
          displayName: copy.displayName,
          description: copy.description,
          monthlyPrice: copy.price,
          yearlyPrice: payload.yearlyPrice ?? 0,
          currency: copy.currency,
          deploymentType: payload.deploymentType ?? 'cloud',
          setupFee: payload.setupFee ?? 0,
          maxProperties: copy.maxProperties,
          maxUsers: copy.maxUsers,
          maxRoomsPerProperty: copy.maxRoomsPerProperty,
          maxStaff: copy.maxStaff,
          storageLimitMb: payload.storageLimitMb ?? 1000,
          trialDays: copy.trialDays,
          isPopular: copy.highlighted,
          isCustom: payload.isCustom ?? false,
          isActive: copy.isActive,
          sortOrder: copy.sortOrder,
          parsedFeatures: payload.enabled,
          parsedAddonModules: payload.addonPricing ?? [],
          subscriberCount: 0,
        },
        message: `Plan duplicated as "${copyName}"`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[plan-builder] POST [id]/duplicate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to duplicate plan' },
      { status: 500 }
    );
  }
}

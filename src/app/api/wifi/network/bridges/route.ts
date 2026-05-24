/**
 * Bridge Config API Route
 *
 * List and create bridge configurations for a property.
 * OS-level: this box is a single-tenant gateway. Bridge names are
 * the natural key. No UUID validation needed for lookups.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/bridges - List all bridge configs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const bridges = await db.bridgeConfig.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: bridges });
  } catch (error) {
    console.error('Error fetching bridge configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bridge configs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/bridges - Create a new bridge config
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      memberInterfaces = '[]',
      stpEnabled = false,
      forwardDelay = 15,
      helloTime = 2,
      maxAge = 20,
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    // Validate STP timers
    const fd = parseFloat(String(forwardDelay));
    const ht = parseFloat(String(helloTime));
    const ma = parseFloat(String(maxAge));
    if (!isNaN(fd) && (fd < 4 || fd > 30)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'forwardDelay must be between 4 and 30 seconds' } },
        { status: 400 },
      );
    }
    if (!isNaN(ht) && (ht < 1 || ht > 10)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'helloTime must be between 1 and 10 seconds' } },
        { status: 400 },
      );
    }
    if (!isNaN(ma) && (ma < 6 || ma > 40)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxAge must be between 6 and 40 seconds' } },
        { status: 400 },
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // Serialize memberInterfaces if it's an array
    const members = Array.isArray(memberInterfaces)
      ? JSON.stringify(memberInterfaces)
      : memberInterfaces;

    // Check for duplicate name within the property
    const existing = await db.bridgeConfig.findFirst({
      where: { propertyId, name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A bridge with this name already exists on this property' } },
        { status: 400 },
      );
    }

    // Parse member interfaces
    JSON.parse(members);

    // OS-level bridge creation and file persistence are handled by the frontend
    // calling /api/network/os/bridges before this route.

    const bridge = await db.bridgeConfig.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        name,
        memberInterfaces: members,
        stpEnabled,
        forwardDelay,
        helloTime,
        maxAge,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: bridge }, { status: 201 });
  } catch (error) {
    console.error('Error creating bridge config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bridge config' } },
      { status: 500 },
    );
  }
}

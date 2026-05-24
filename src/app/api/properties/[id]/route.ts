import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { audit } from '@/lib/audit';

// GET /api/properties/[id] - Get a single property
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.view') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const property = await db.property.findUnique({
      where: { id, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        rooms: {
          where: { deletedAt: null },
          include: {
            roomType: true,
          },
        },
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
      },
    });
    
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (property.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Audit log for property view
    try {
      await audit(request, 'settings' as any, 'view', 'property', id, undefined, undefined, {
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log property view:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...property,
        totalRooms: property._count.rooms,
        totalRoomTypes: property._count.roomTypes,
      },
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch property' } },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id] - Update a property
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.update') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingProperty = await db.property.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (existingProperty.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Capture old values before update for audit log
    const oldValue = { ...existingProperty } as unknown as Record<string, unknown>;
    
    const {
      name,
      slug,
      description,
      type,
      address,
      city,
      state,
      country,
      postalCode,
      latitude,
      longitude,
      email,
      phone,
      website,
      logo,
      primaryColor,
      secondaryColor,
      checkInTime,
      checkOutTime,
      timezone,
      currency,
      // Tax configuration
      taxId,
      taxType,
      defaultTaxRate,
      taxComponents,
      serviceChargePercent,
      includeTaxInPrice,
      totalFloors,
      status,
    } = body;

    // GAP-FIX(17b): Validate status against valid values
    const VALID_STATUSES = ['active', 'inactive', 'maintenance', 'archived'];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` } },
        { status: 400 }
      );
    }

    // GAP-FIX(17b): Validate tax rate range
    if (defaultTaxRate !== undefined) {
      const parsedRate = parseFloat(defaultTaxRate);
      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'defaultTaxRate must be between 0 and 100' } },
          { status: 400 }
        );
      }
    }

    // GAP-FIX(17b): Validate service charge range
    if (serviceChargePercent !== undefined) {
      const parsedSc = parseFloat(serviceChargePercent);
      if (isNaN(parsedSc) || parsedSc < 0 || parsedSc > 100) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'serviceChargePercent must be between 0 and 100' } },
          { status: 400 }
        );
      }
    }

    // GAP-FIX(17b): Validate totalFloors range
    if (totalFloors !== undefined) {
      const parsedFloors = parseInt(String(totalFloors), 10);
      if (isNaN(parsedFloors) || parsedFloors < 1 || parsedFloors > 999) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'totalFloors must be between 1 and 999' } },
          { status: 400 }
        );
      }
    }
    
    const property = await db.$transaction(async (tx) => {
      // If slug is being changed, check for conflicts
      if (slug && slug !== existingProperty.slug) {
        const slugConflict = await tx.property.findUnique({
          where: {
            tenantId_slug: {
              tenantId: existingProperty.tenantId,
              slug,
            },
          },
        });
        
        if (slugConflict) {
          throw new Error('DUPLICATE_SLUG');
        }
      }
      
      return tx.property.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(slug && { slug }),
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type }),
          ...(address !== undefined && { address }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(country !== undefined && { country }),
          ...(postalCode !== undefined && { postalCode }),
          ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
          ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(website !== undefined && { website }),
          ...(logo !== undefined && { logo }),
          ...(primaryColor !== undefined && { primaryColor }),
          ...(secondaryColor !== undefined && { secondaryColor }),
          ...(checkInTime && { checkInTime }),
          ...(checkOutTime && { checkOutTime }),
          ...(timezone && { timezone }),
          ...(currency && { currency }),
          // Tax configuration
          ...(taxId !== undefined && { taxId: taxId || null }),
          ...(taxType !== undefined && { taxType }),
          ...(defaultTaxRate !== undefined && { defaultTaxRate: parseFloat(defaultTaxRate) || 0 }),
          ...(taxComponents !== undefined && { taxComponents: JSON.stringify(taxComponents) }),
          ...(serviceChargePercent !== undefined && { serviceChargePercent: parseFloat(serviceChargePercent) || 0 }),
          ...(includeTaxInPrice !== undefined && { includeTaxInPrice }),
          ...(totalFloors !== undefined && { totalFloors }),
          ...(status && { status }),
        },
      });
    });

    // Audit log for property update
    try {
      await audit(request, 'settings' as any, 'update', 'property', id, oldValue, property as unknown as Record<string, unknown>, {
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log property update:', auditError);
    }
    
    return NextResponse.json({ success: true, data: property });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_SLUG') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_SLUG', message: 'A property with this slug already exists' } },
        { status: 400 }
      );
    }
    console.error('Error updating property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update property' } },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id] - Soft delete a property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.delete') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const existingProperty = await db.property.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    if (existingProperty.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Capture old values before delete for audit log
    const deletedProperty = { ...existingProperty } as unknown as Record<string, unknown>;
    
    // Check for active rooms and bookings before deleting
    const activeRooms = await db.room.count({
      where: { propertyId: id, deletedAt: null },
    });
    const activeBookings = await db.booking.count({
      where: { propertyId: id, status: { in: ['confirmed', 'checked_in'] } },
    });
    if (activeRooms > 0 || activeBookings > 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'HAS_DEPENDENTS', message: `Cannot delete property with ${activeRooms} active rooms and ${activeBookings} active bookings` },
      }, { status: 400 });
    }

    // Soft delete in a transaction for atomicity
    await db.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    // Audit log for property deletion
    try {
      await audit(request, 'settings' as any, 'delete', 'property', id, deletedProperty, undefined, {
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log property deletion:', auditError);
    }
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete property' } },
      { status: 500 }
    );
  }
}

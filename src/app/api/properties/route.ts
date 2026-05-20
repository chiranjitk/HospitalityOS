import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { audit } from '@/lib/audit';

// GET /api/properties - List all properties
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const myProperties = searchParams.get('myProperties') === 'true';

    // RBAC check - skip for myProperties since any authenticated user can see their own assigned properties
    if (!myProperties && !hasPermission(user, 'properties.view') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    
    const where: Record<string, unknown> = {
      deletedAt: null,
      tenantId: user.tenantId,
    };

    // Platform admins bypass property assignment filtering
    if (myProperties && !user.isPlatformAdmin) {
      // Filter to only properties the current user is assigned to
      const userAssignments = await db.userProperty.findMany({
        where: {
          userId: user.id,
          tenantId: user.tenantId,
        },
        select: { propertyId: true },
      });

      const assignedPropertyIds = userAssignments.map((a) => a.propertyId);

      if (assignedPropertyIds.length === 0) {
        // User has no property assignments - return empty list
        return NextResponse.json({
          success: true,
          pagination: { total: 0, limit, offset },
          data: [],
        });
      }

      where.id = { in: assignedPropertyIds };
    }
    
    if (status) {
      where.status = status;
    }
    
    if (type) {
      where.type = type;
    }
    
    const total = await db.property.count({ where });

    const properties = await db.property.findMany({
      where,
      include: {
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
        ...(myProperties && !user.isPlatformAdmin
          ? {
              userAssignments: {
                where: { userId: user.id },
                select: {
                  id: true,
                  role: true,
                  isDefault: true,
                },
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
    
    const responseData = properties.map((p) => {
        const mapped: Record<string, unknown> = {
          ...p,
          totalRooms: p._count.rooms,
          totalRoomTypes: p._count.roomTypes,
        };

        // Include the user's per-property role when myProperties is active
        if (myProperties && !user.isPlatformAdmin && p.userAssignments && p.userAssignments.length > 0) {
          const assignment = p.userAssignments[0];
          mapped.userRole = assignment.role;
          mapped.isDefaultProperty = assignment.isDefault;
        }

        // Remove internal userAssignments from response
        delete mapped.userAssignments;

        return mapped;
      });

    // Audit log for list/view
    try {
      await audit(request, 'settings' as any, 'view', 'property', undefined, undefined, undefined, {
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log property list view:', auditError);
    }

    return NextResponse.json({
      success: true,
      pagination: { total, limit, offset },
      data: responseData,
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch properties' } },
      { status: 500 }
    );
  }
}

// POST /api/properties - Create a new property
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.create') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const tenantId = user.tenantId;
    
    const body = await request.json();
    
    const {
      name,
      slug,
      description,
      type = 'hotel',
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
      checkInTime = '14:00',
      checkOutTime = '11:00',
      timezone = 'Asia/Kolkata',
      currency = 'INR',
      // Tax configuration
      taxId,
      taxType = 'gst',
      defaultTaxRate = 0,
      taxComponents = [],
      serviceChargePercent = 0,
      includeTaxInPrice = false,
      totalFloors = 1,
      status = 'active',
    } = body;
    
    // Validate required fields
    if (!name || !slug || !address || !city || !country) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Slug must contain only lowercase letters, numbers, and hyphens' } },
        { status: 400 }
      );
    }
    
    // Check if slug already exists
    const existingProperty = await db.property.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });
    
    if (existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_SLUG', message: 'A property with this slug already exists' } },
        { status: 400 }
      );
    }
    
    const property = await db.property.create({
      data: {
        tenantId,
        name,
        slug,
        description,
        type,
        address,
        city,
        state,
        country,
        postalCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
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
        taxId: taxId || null,
        taxType,
        defaultTaxRate,
        taxComponents: JSON.stringify(taxComponents),
        serviceChargePercent,
        includeTaxInPrice,
        totalFloors,
        status,
      },
    });

    // Audit log for property creation
    try {
      await audit(request, 'settings' as any, 'create', 'property', property.id, undefined, property as unknown as Record<string, unknown>, {
        tenantId: user.tenantId,
        userId: user.id,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log property creation:', auditError);
    }
    
    return NextResponse.json({ success: true, data: property }, { status: 201 });
  } catch (error) {
    console.error('Error creating property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create property' } },
      { status: 500 }
    );
  }
}

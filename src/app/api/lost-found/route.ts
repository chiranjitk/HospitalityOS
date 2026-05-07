import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const createLostFoundSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  itemType: z.enum(['lost', 'found'], { required_error: 'itemType is required' }),
  category: z.enum(['electronics', 'clothing', 'documents', 'accessories', 'jewelry', 'keys', 'wallet', 'other']).default('other'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  locationFound: z.string().optional(),
  roomId: z.string().uuid().optional().nullable(),
  foundBy: z.string().optional(),
  finderContact: z.string().optional(),
  foundAt: z.string().datetime().optional(),
  photos: z.array(z.string().url()).default([]),
  guestId: z.string().uuid().optional().nullable(),
  bookingId: z.string().uuid().optional().nullable(),
  storageLocation: z.string().optional(),
  notes: z.string().optional(),
});

// ─── GET: List lost & found items ───
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'lost-found.view') && !hasPermission(user, 'lost-found.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const itemType = searchParams.get('itemType');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (itemType) where.itemType = itemType;
    if (category) where.category = category;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.foundAt = dateFilter;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { locationFound: { contains: search, mode: 'insensitive' } },
        { foundBy: { contains: search, mode: 'insensitive' } },
        { returnedTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.lostFoundItem.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { foundAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.lostFoundItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[LostFound GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch lost & found items' } }, { status: 500 });
  }
}

// ─── POST: Report new lost & found item ───
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'lost-found.create') && !hasPermission(user, 'lost-found.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createLostFoundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Verify guest exists if provided
    if (data.guestId) {
      const guest = await db.guest.findFirst({ where: { id: data.guestId, tenantId: user.tenantId } });
      if (!guest) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } }, { status: 404 });
      }
    }

    // Verify room belongs to property if provided
    if (data.roomId) {
      const room = await db.room.findFirst({ where: { id: data.roomId, propertyId: data.propertyId } });
      if (!room) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found at this property' } }, { status: 404 });
      }
    }

    const item = await db.lostFoundItem.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        itemType: data.itemType,
        category: data.category,
        description: data.description,
        locationFound: data.locationFound,
        roomId: data.roomId,
        foundBy: data.foundBy,
        finderContact: data.finderContact,
        foundAt: data.foundAt ? new Date(data.foundAt) : new Date(),
        photos: JSON.stringify(data.photos),
        guestId: data.guestId,
        bookingId: data.bookingId,
        storageLocation: data.storageLocation,
        status: 'reported',
        notes: data.notes,
      },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'lost-found',
        action: 'create',
        entityType: 'LostFoundItem',
        entityId: item.id,
        newValue: `New ${data.itemType} item reported: ${data.description.substring(0, 100)}`,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('[LostFound POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to report lost & found item' } }, { status: 500 });
  }
}

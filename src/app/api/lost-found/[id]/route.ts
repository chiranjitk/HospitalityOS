import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const updateItemSchema = z.object({
  category: z.enum(['electronics', 'clothing', 'documents', 'accessories', 'jewelry', 'keys', 'wallet', 'other']).optional(),
  description: z.string().min(3).optional(),
  locationFound: z.string().optional(),
  storageLocation: z.string().optional(),
  status: z.enum(['reported', 'matched', 'returned', 'disposed', 'claimed']).optional(),
  guestId: z.string().uuid().optional().nullable(),
  bookingId: z.string().uuid().optional().nullable(),
  returnedTo: z.string().optional(),
  disposalReason: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
});

// ─── GET: Get single lost & found item ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'lost-found.view') && !hasPermission(user, 'lost-found.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const item = await db.lostFoundItem.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lost & found item not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('[LostFound GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch lost & found item' } }, { status: 500 });
  }
}

// ─── PATCH: Update item (match, return, dispose, update status) ───
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'lost-found.edit') && !hasPermission(user, 'lost-found.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    // Fetch existing item
    const existing = await db.lostFoundItem.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lost & found item not found' } }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.locationFound !== undefined) updateData.locationFound = data.locationFound;
    if (data.storageLocation !== undefined) updateData.storageLocation = data.storageLocation;
    if (data.guestId !== undefined) updateData.guestId = data.guestId;
    if (data.bookingId !== undefined) updateData.bookingId = data.bookingId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.photos !== undefined) updateData.photos = JSON.stringify(data.photos);

    // Handle status transitions with timestamps
    if (data.status !== undefined && data.status !== existing.status) {
      updateData.status = data.status;

      switch (data.status) {
        case 'matched':
          updateData.matchedAt = new Date();
          break;
        case 'returned':
          updateData.returnedAt = new Date();
          if (data.returnedTo) updateData.returnedTo = data.returnedTo;
          else updateData.returnedTo = existing.guestId ? 'Matched guest' : user.name;
          break;
        case 'disposed':
          updateData.disposedAt = new Date();
          if (data.disposalReason) updateData.disposalReason = data.disposalReason;
          break;
        case 'claimed':
          updateData.returnedAt = new Date();
          break;
      }
    }

    const item = await db.lostFoundItem.update({
      where: { id },
      data: updateData,
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
        action: 'update',
        entityType: 'LostFoundItem',
        entityId: id,
        oldValue: existing.status,
        newValue: `Status changed to ${item.status}${data.notes ? `. Notes: ${data.notes}` : ''}`,
      },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('[LostFound PATCH/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update lost & found item' } }, { status: 500 });
  }
}

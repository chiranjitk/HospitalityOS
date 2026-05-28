import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.view', 'rooms.manage', 'rooms.*', 'pms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const roomId = sp.get('roomId');
    const propertyId = sp.get('propertyId');
    const dateFrom = sp.get('dateFrom');
    const dateTo = sp.get('dateTo');
    const search = sp.get('search');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) where.status = status;
    if (roomId) where.roomId = roomId;

    // Filter by property via room relation
    if (propertyId) {
      where.room = { propertyId };
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    if (search) {
      where.OR = [
        { reason: { contains: search } },
      ];
    }

    const changes = await db.roomTypeChange.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    const total = await db.roomTypeChange.count({ where });

    const statusCounts = await db.roomTypeChange.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId },
      _count: true,
    });

    // Fetch related rooms and room types
    const roomIds = [...new Set(changes.map(c => c.roomId))];
    const typeIds = [...new Set([...changes.map(c => c.oldRoomTypeId), ...changes.map(c => c.newRoomTypeId)])];

    const roomsMap: Record<string, { id: string; number: string; floor: number; status: string }> = {};
    const typesMap: Record<string, { id: string; name: string; code: string; basePrice: number }> = {};

    if (roomIds.length > 0) {
      const rooms = await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, number: true, floor: true, status: true },
      });
      rooms.forEach(r => { roomsMap[r.id] = r; });
    }

    if (typeIds.length > 0) {
      const types = await db.roomType.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, name: true, code: true, basePrice: true },
      });
      types.forEach(t => { typesMap[t.id] = t; });
    }

    // Enrich data with room and type info
    const data = changes.map(c => ({
      ...c,
      room: roomsMap[c.roomId] || null,
      oldRoomType: typesMap[c.oldRoomTypeId] || null,
      newRoomType: typesMap[c.newRoomTypeId] || null,
    }));

    // Fetch all rooms and room types for dropdowns
    const properties = await db.property.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    const allRooms = propertyIds.length > 0 ? await db.room.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true, number: true, roomTypeId: true, floor: true, status: true },
      take: 500,
    }) : [];

    const allRoomTypes = propertyIds.length > 0 ? await db.roomType.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true, name: true, code: true, basePrice: true },
      take: 100,
    }) : [];

    return NextResponse.json({
      success: true,
      data,
      pagination: { total, limit, offset },
      stats: { statusDistribution: statusCounts },
      meta: { rooms: allRooms, roomTypes: allRoomTypes },
    });
  } catch (error) {
    console.error('GET /api/pms/room-type-change:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch room type changes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', 'pms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { roomId, oldRoomTypeId, newRoomTypeId, reason, bookingId, notes } = body;

    if (!roomId || !oldRoomTypeId || !newRoomTypeId) {
      return NextResponse.json({ success: false, error: 'Room ID, old room type, and new room type are required' }, { status: 400 });
    }

    if (oldRoomTypeId === newRoomTypeId) {
      return NextResponse.json({ success: false, error: 'Old and new room types must be different' }, { status: 400 });
    }

    // Verify room exists
    const room = await db.room.findFirst({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // Calculate rate difference
    const [oldType, newType] = await Promise.all([
      db.roomType.findFirst({ where: { id: oldRoomTypeId } }),
      db.roomType.findFirst({ where: { id: newRoomTypeId } }),
    ]);
    const rateDifference = (newType?.basePrice || 0) - (oldType?.basePrice || 0);

    // Use the room's propertyId for the propertyId field; generate a bookingId placeholder
    const change = await db.roomTypeChange.create({
      data: {
        tenantId: user.tenantId,
        propertyId: room.propertyId,
        roomId,
        oldRoomTypeId,
        newRoomTypeId,
        reason: reason || null,
        rateDifference,
        requestedBy: user.id,
        status: 'requested',
        bookingId: bookingId || room.id,
        notes: notes || null,
      },
    });

    // Enrich with room and type info
    const enriched = {
      ...change,
      room: { id: room.id, number: room.number, floor: room.floor, status: room.status },
      oldRoomType: oldType ? { id: oldType.id, name: oldType.name, code: oldType.code, basePrice: oldType.basePrice } : null,
      newRoomType: newType ? { id: newType.id, name: newType.name, code: newType.code, basePrice: newType.basePrice } : null,
    };

    return NextResponse.json({ success: true, data: enriched }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pms/room-type-change:', error);
    return NextResponse.json({ success: false, error: 'Failed to create room type change' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

// ============================================================
// GET /api/channels/virtual-inventory
// List virtual room types, support ?include=mappings&connectionId=xxx&action=available-count
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';
    const connectionId = searchParams.get('connectionId') || undefined;
    const action = searchParams.get('action');
    const virtualRoomTypeId = searchParams.get('virtualRoomTypeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // --- available-count action ---
    if (action === 'available-count' && virtualRoomTypeId) {
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date(start);
      end.setDate(end.getDate() + 1);

      // Get mappings for this virtual room type
      const mappings = await db.virtualRoomMapping.findMany({
        where: {
          virtualRoomTypeId,
          tenantId: user.tenantId,
          isActive: true,
        },
      });

      if (mappings.length === 0) {
        return NextResponse.json({
          success: true,
          data: { virtualRoomTypeId, date: start.toISOString().split('T')[0], available: 0, totalPhysical: 0 },
        });
      }

      const physicalRoomTypeIds = mappings.map(m => m.physicalRoomTypeId);

      // Get total rooms in those physical room types
      const rooms = await db.room.findMany({
        where: {
          roomTypeId: { in: physicalRoomTypeIds },
          status: { in: ['available', 'occupied'] },
        },
        select: { id: true, roomTypeId: true, status: true },
      });

      // Count bookings overlapping the target date
      const bookings = await db.booking.findMany({
        where: {
          roomTypeId: { in: physicalRoomTypeIds },
          status: { in: ['confirmed', 'checked_in'] },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
        select: { id: true, roomId: true },
      });

      const bookedRoomIds = new Set(bookings.map(b => b.roomId).filter(Boolean));
      const availableRooms = rooms.filter(r => r.status === 'available' && !bookedRoomIds.has(r.id));
      const totalPhysical = rooms.length;

      return NextResponse.json({
        success: true,
        data: {
          virtualRoomTypeId,
          date: start.toISOString().split('T')[0],
          available: availableRooms.length,
          totalPhysical,
        },
      });
    }

    // --- calculate-inventory action ---
    if (action === 'calculate-inventory' && virtualRoomTypeId && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days: { date: string; available: number; total: number }[] = [];

      // Get mappings
      const mappings = await db.virtualRoomMapping.findMany({
        where: {
          virtualRoomTypeId,
          tenantId: user.tenantId,
          isActive: true,
        },
      });

      const physicalRoomTypeIds = mappings.map(m => m.physicalRoomTypeId);

      // Get all rooms for those physical types
      const rooms = await db.room.findMany({
        where: {
          roomTypeId: { in: physicalRoomTypeIds },
          status: { in: ['available', 'occupied'] },
        },
        select: { id: true, roomTypeId: true, status: true },
      });

      const totalRooms = rooms.length;

      // Iterate each day in range
      const current = new Date(start);
      while (current <= end) {
        const dayStart = new Date(current);
        const dayEnd = new Date(current);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // Count bookings for this day
        const bookings = await db.booking.findMany({
          where: {
            roomTypeId: { in: physicalRoomTypeIds },
            status: { in: ['confirmed', 'checked_in'] },
            checkIn: { lt: dayEnd },
            checkOut: { gt: dayStart },
          },
          select: { id: true, roomId: true },
        });

        const bookedRoomIds = new Set(bookings.map(b => b.roomId).filter(Boolean));
        const available = rooms.filter(r => r.status === 'available' && !bookedRoomIds.has(r.id)).length;

        days.push({
          date: current.toISOString().split('T')[0],
          available,
          total: totalRooms,
        });

        current.setDate(current.getDate() + 1);
      }

      return NextResponse.json({
        success: true,
        data: { virtualRoomTypeId, startDate, endDate, days },
      });
    }

    // --- Default: list virtual room types ---
    const where: Prisma.VirtualRoomTypeWhereInput = {
      tenantId: user.tenantId,
    };

    const includeMappings = include.includes('mappings');

    const virtualRoomTypes = await db.virtualRoomType.findMany({
      where,
      include: includeMappings ? {
        virtualMappings: {
          where: connectionId ? { connectionId } : undefined,
          include: {
            physicalRoomType: {
              select: { id: true, name: true, code: true, totalRooms: true },
            },
          },
          orderBy: { priority: 'desc' },
        },
      } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    // Get stats
    const totalCount = await db.virtualRoomType.count({ where });
    const activeCount = await db.virtualRoomType.count({ where: { ...where, isActive: true } });
    const totalMappings = await db.virtualRoomMapping.count({
      where: { tenantId: user.tenantId, isActive: true },
    });

    // Get unique physical room types mapped
    const uniquePhysicalMappings = await db.virtualRoomMapping.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { physicalRoomTypeId: true },
      distinct: ['physicalRoomTypeId'],
    });

    // Get total capacity from unique physical room types
    let totalCapacity = 0;
    if (uniquePhysicalMappings.length > 0) {
      const physicalRoomTypes = await db.roomType.findMany({
        where: { id: { in: uniquePhysicalMappings.map(m => m.physicalRoomTypeId) } },
        select: { totalRooms: true },
      });
      totalCapacity = physicalRoomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0);
    }

    return NextResponse.json({
      success: true,
      data: virtualRoomTypes,
      stats: {
        totalCount,
        activeCount,
        totalMappings,
        totalCapacity,
        uniquePhysicalRooms: uniquePhysicalMappings.length,
      },
    });
  } catch (error) {
    console.error('Error fetching virtual inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch virtual inventory' } },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/channels/virtual-inventory
// Create virtual room type or perform actions (add-mapping, calculate-inventory)
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // --- add-mapping action ---
    if (action === 'add-mapping') {
      const { virtualRoomTypeId, physicalRoomTypeId, connectionId, channelCode, externalRoomId, externalRoomName, rateMultiplier, priority } = body;

      if (!virtualRoomTypeId || !physicalRoomTypeId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'virtualRoomTypeId and physicalRoomTypeId are required' } },
          { status: 400 }
        );
      }

      // Verify ownership
      const vrt = await db.virtualRoomType.findFirst({
        where: { id: virtualRoomTypeId, tenantId: user.tenantId },
      });
      if (!vrt) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Virtual room type not found' } },
          { status: 404 }
        );
      }

      const mapping = await db.virtualRoomMapping.create({
        data: {
          tenantId: user.tenantId,
          virtualRoomTypeId,
          physicalRoomTypeId,
          connectionId: connectionId || null,
          channelCode: channelCode || null,
          externalRoomId: externalRoomId || null,
          externalRoomName: externalRoomName || null,
          rateMultiplier: rateMultiplier ?? 1,
          priority: priority ?? 0,
          isActive: true,
        },
        include: {
          physicalRoomType: {
            select: { id: true, name: true, code: true, totalRooms: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: mapping });
    }

    // --- update-mapping action ---
    if (action === 'update-mapping') {
      const { mappingId, rateMultiplier, priority, externalRoomName, externalRoomId, channelCode, isActive } = body;

      if (!mappingId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'mappingId is required' } },
          { status: 400 }
        );
      }

      // Verify ownership
      const existing = await db.virtualRoomMapping.findFirst({
        where: { id: mappingId, tenantId: user.tenantId },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' } },
          { status: 404 }
        );
      }

      const updated = await db.virtualRoomMapping.update({
        where: { id: mappingId },
        data: {
          ...(rateMultiplier !== undefined ? { rateMultiplier } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(externalRoomName !== undefined ? { externalRoomName } : {}),
          ...(externalRoomId !== undefined ? { externalRoomId } : {}),
          ...(channelCode !== undefined ? { channelCode } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: {
          physicalRoomType: {
            select: { id: true, name: true, code: true, totalRooms: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // --- calculate-inventory action (POST version) ---
    if (action === 'calculate-inventory') {
      const { virtualRoomTypeId, startDate, endDate } = body;

      if (!virtualRoomTypeId || !startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'virtualRoomTypeId, startDate, endDate are required' } },
          { status: 400 }
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days: { date: string; available: number; total: number }[] = [];

      const mappings = await db.virtualRoomMapping.findMany({
        where: {
          virtualRoomTypeId,
          tenantId: user.tenantId,
          isActive: true,
        },
      });

      const physicalRoomTypeIds = mappings.map(m => m.physicalRoomTypeId);

      const rooms = await db.room.findMany({
        where: {
          roomTypeId: { in: physicalRoomTypeIds },
          status: { in: ['available', 'occupied'] },
        },
        select: { id: true, roomTypeId: true, status: true },
      });

      const totalRooms = rooms.length;

      const current = new Date(start);
      while (current <= end) {
        const dayStart = new Date(current);
        const dayEnd = new Date(current);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const bookings = await db.booking.findMany({
          where: {
            roomTypeId: { in: physicalRoomTypeIds },
            status: { in: ['confirmed', 'checked_in'] },
            checkIn: { lt: dayEnd },
            checkOut: { gt: dayStart },
          },
          select: { id: true, roomId: true },
        });

        const bookedRoomIds = new Set(bookings.map(b => b.roomId).filter(Boolean));
        const available = rooms.filter(r => r.status === 'available' && !bookedRoomIds.has(r.id)).length;

        days.push({
          date: current.toISOString().split('T')[0],
          available,
          total: totalRooms,
        });

        current.setDate(current.getDate() + 1);
      }

      return NextResponse.json({
        success: true,
        data: { virtualRoomTypeId, startDate, endDate, days },
      });
    }

    // --- Default: create virtual room type ---
    const { name, description, aggregationType, propertyId, mappings } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    const virtualRoomType = await db.virtualRoomType.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        aggregationType: aggregationType || 'single',
        isActive: true,
        virtualMappings: mappings?.length
          ? {
              create: mappings.map((m: {
                physicalRoomTypeId: string;
                connectionId?: string;
                channelCode?: string;
                externalRoomId?: string;
                externalRoomName?: string;
                rateMultiplier?: number;
                priority?: number;
              }) => ({
                tenantId: user.tenantId,
                physicalRoomTypeId: m.physicalRoomTypeId,
                connectionId: m.connectionId || null,
                channelCode: m.channelCode || null,
                externalRoomId: m.externalRoomId || null,
                externalRoomName: m.externalRoomName || null,
                rateMultiplier: m.rateMultiplier ?? 1,
                priority: m.priority ?? 0,
                isActive: true,
              })),
            }
          : undefined,
      },
      include: {
        virtualMappings: {
          include: {
            physicalRoomType: {
              select: { id: true, name: true, code: true, totalRooms: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: virtualRoomType }, { status: 201 });
  } catch (error) {
    console.error('Error creating virtual room type:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'A mapping with this combination already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create virtual room type' } },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /api/channels/virtual-inventory
// Update virtual room type or mapping
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, id, name, description, aggregationType, propertyId, isActive } = body;

    // --- update-mapping action ---
    if (action === 'update-mapping') {
      const { mappingId, rateMultiplier, priority, externalRoomName, externalRoomId, channelCode, isActive: mappingActive } = body;

      if (!mappingId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'mappingId is required' } },
          { status: 400 }
        );
      }

      const existing = await db.virtualRoomMapping.findFirst({
        where: { id: mappingId, tenantId: user.tenantId },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' } },
          { status: 404 }
        );
      }

      const updated = await db.virtualRoomMapping.update({
        where: { id: mappingId },
        data: {
          ...(rateMultiplier !== undefined ? { rateMultiplier } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(externalRoomName !== undefined ? { externalRoomName } : {}),
          ...(externalRoomId !== undefined ? { externalRoomId } : {}),
          ...(channelCode !== undefined ? { channelCode } : {}),
          ...(mappingActive !== undefined ? { isActive: mappingActive } : {}),
        },
        include: {
          physicalRoomType: {
            select: { id: true, name: true, code: true, totalRooms: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // --- Default: update virtual room type ---
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.virtualRoomType.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Virtual room type not found' } },
        { status: 404 }
      );
    }

    const updated = await db.virtualRoomType.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(aggregationType !== undefined ? { aggregationType } : {}),
        ...(propertyId !== undefined ? { propertyId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating virtual inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update virtual inventory' } },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/channels/virtual-inventory
// Delete virtual room type or remove mapping
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const mappingId = searchParams.get('mappingId');

    // --- remove-mapping action ---
    if (action === 'remove-mapping' && mappingId) {
      const existing = await db.virtualRoomMapping.findFirst({
        where: { id: mappingId, tenantId: user.tenantId },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' } },
          { status: 404 }
        );
      }

      await db.virtualRoomMapping.delete({
        where: { id: mappingId },
      });

      return NextResponse.json({ success: true, message: 'Mapping removed' });
    }

    // --- Default: delete virtual room type ---
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.virtualRoomType.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Virtual room type not found' } },
        { status: 404 }
      );
    }

    // Delete cascades to mappings
    await db.virtualRoomType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Virtual room type deleted' });
  } catch (error) {
    console.error('Error deleting virtual inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete virtual inventory' } },
      { status: 500 }
    );
  }
}

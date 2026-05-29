import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

const VALID_ID_TYPES = ['national_id', 'passport', 'driving_license', 'company_id', 'other'];
const VALID_PURPOSES = ['business', 'personal', 'delivery', 'contractor', 'government', 'other'];
const VALID_STATUSES = ['checked_in', 'checked_out', 'blacklisted', 'expected'];

// GET /api/security/visitors
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.view', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const hostGuestName = searchParams.get('host');
    const purpose = searchParams.get('purpose');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.VisitorLogWhereInput = {
      tenantId: user.tenantId,
      propertyId,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (purpose) where.purpose = purpose;
    if (hostGuestName) where.hostGuestName = { contains: hostGuestName };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.checkIn = { gte: start, lte: end };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [visitors, total] = await Promise.all([
      db.visitorLog.findMany({
        where,
        orderBy: { checkIn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.visitorLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        visitors,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('[GET /api/security/visitors]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/security/visitors — Register visitor check-in
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.create', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId, firstName, lastName, email, phone,
      idType = 'other', idNumber, purpose = 'other',
      hostGuestId, hostGuestName, hostRoomNumber,
      company, vehiclePlate, badgeNumber, notes, photoUrl,
    } = body;

    if (!propertyId || !firstName || !lastName || !idNumber) {
      return NextResponse.json({ success: false, error: 'propertyId, firstName, lastName, and idNumber are required' }, { status: 400 });
    }
    if (idType && !VALID_ID_TYPES.includes(idType)) {
      return NextResponse.json({ success: false, error: `Invalid idType. Must be one of: ${VALID_ID_TYPES.join(', ')}` }, { status: 400 });
    }
    if (purpose && !VALID_PURPOSES.includes(purpose)) {
      return NextResponse.json({ success: false, error: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(', ')}` }, { status: 400 });
    }

    const visitor = await db.visitorLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        idType,
        idNumber: idNumber.trim(),
        purpose,
        hostGuestId: hostGuestId || null,
        hostGuestName: hostGuestName?.trim() || null,
        hostRoomNumber: hostRoomNumber?.trim() || null,
        company: company?.trim() || null,
        vehiclePlate: vehiclePlate?.trim() || null,
        badgeNumber: badgeNumber?.trim() || null,
        status: 'checked_in',
        notes: notes?.trim() || null,
        photoUrl: photoUrl || null,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'create',
        entityType: 'VisitorLog',
        entityId: visitor.id,
        newValue: JSON.stringify({ firstName: visitor.firstName, lastName: visitor.lastName, purpose: visitor.purpose }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({ success: true, data: visitor }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/security/visitors]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/security/visitors — Update visitor (check-out, notes, etc.)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.update', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { id, checkOut, notes, status, badgeNumber, vehiclePlate } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Visitor ID is required' }, { status: 400 });
    }

    const existing = await db.visitorLog.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Visitor not found' }, { status: 404 });
    }

    const updateData: Prisma.VisitorLogUpdateInput = {};
    if (checkOut) {
      updateData.checkOut = new Date();
      updateData.status = 'checked_out';
    }
    if (status && VALID_STATUSES.includes(status)) {
      updateData.status = status;
    }
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (badgeNumber !== undefined) updateData.badgeNumber = badgeNumber?.trim() || null;
    if (vehiclePlate !== undefined) updateData.vehiclePlate = vehiclePlate?.trim() || null;

    const visitor = await db.visitorLog.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'update',
        entityType: 'VisitorLog',
        entityId: id,
        oldValue: JSON.stringify({ previousStatus: existing.status }),
        newValue: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ success: true, data: visitor });
  } catch (error) {
    console.error('[PUT /api/security/visitors]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/security/visitors — Soft-delete visitor record
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.delete', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Visitor ID is required' }, { status: 400 });
    }

    const existing = await db.visitorLog.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Visitor not found' }, { status: 404 });
    }

    await db.visitorLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'delete',
        entityType: 'VisitorLog',
        entityId: id,
        newValue: JSON.stringify({ deletedVisitor: `${existing.firstName} ${existing.lastName}` }),
      },
    });

    return NextResponse.json({ success: true, data: { message: 'Visitor record archived' } });
  } catch (error) {
    console.error('[DELETE /api/security/visitors]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

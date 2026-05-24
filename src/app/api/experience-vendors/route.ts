import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience-vendors - List vendors
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'experience_vendors.view') && !hasPermission(user, 'experience.view')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const category = sp.get('category');
    const status = sp.get('status');
    const limit = sp.get('limit');
    const offset = sp.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId, deletedAt: null };
    if (category) where.category = category;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      db.experienceVendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(limit && { take: Math.min(parseInt(limit), 100) }),
        ...(offset && { skip: parseInt(offset) }),
      }),
      db.experienceVendor.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit: limit ? parseInt(limit) : null, offset: offset ? parseInt(offset) : null } });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch vendors' } }, { status: 500 });
  }
}

// POST /api/experience-vendors - Create vendor
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'experience_vendors.create')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { companyName, contactPerson, email, phone, address, category, commissionRate, bankAccountName, bankAccountNumber, bankIfsc, status, notes } = body;

    if (!companyName || !contactPerson || !email) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'companyName, contactPerson, email are required' } }, { status: 400 });
    }

    const vendor = await db.experienceVendor.create({
      data: {
        tenantId: user.tenantId,
        companyName,
        contactPerson,
        email,
        phone,
        address,
        category,
        commissionRate: commissionRate || 0,
        bankAccountName,
        bankAccountNumber,
        bankIfsc,
        status: status || 'active',
        notes,
      },
    });

    return NextResponse.json({ success: true, data: vendor }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create vendor' } }, { status: 500 });
  }
}

// PUT /api/experience-vendors - Update vendor
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'experience_vendors.update')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } }, { status: 400 });
    }

    const existing = await db.experienceVendor.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, { status: 404 });
    }

    // Destructure allowed fields to prevent tenantId override via spread
    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      category,
      commissionRate,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      status,
      notes,
    } = rest;

    const data: Record<string, unknown> = {};
    if (companyName !== undefined) data.companyName = companyName;
    if (contactPerson !== undefined) data.contactPerson = contactPerson;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (category !== undefined) data.category = category;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (bankAccountName !== undefined) data.bankAccountName = bankAccountName;
    if (bankAccountNumber !== undefined) data.bankAccountNumber = bankAccountNumber;
    if (bankIfsc !== undefined) data.bankIfsc = bankIfsc;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await db.experienceVendor.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update vendor' } }, { status: 500 });
  }
}

// DELETE /api/experience-vendors - Soft delete vendor
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'experience_vendors.delete')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } }, { status: 400 });
    }

    await db.experienceVendor.update({ where: { id, tenantId: user.tenantId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete vendor' } }, { status: 500 });
  }
}

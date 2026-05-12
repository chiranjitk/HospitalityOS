import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const updateTravelAgentSchema = z.object({
  agencyName: z.string().min(1).optional(),
  code: z.string().min(1).max(50).optional(),
  propertyId: z.string().uuid().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  commissionType: z.enum(['percentage', 'flat']).optional(),
  creditLimit: z.number().min(0).optional(),
  paymentTerms: z.enum(['net_15', 'net_30', 'net_45', 'net_60', 'cod']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/travel-agents/[id]
// ──────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const agent = await db.travelAgent.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        _count: { select: { invoices: true } },
        invoices: {
          where: { status: { in: ['draft', 'sent', 'partial', 'overdue'] } },
          select: { id: true, invoiceNumber: true, total: true, paidAmount: true, status: true, dueDate: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Travel agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error('[GET /api/travel-agents/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch travel agent' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/travel-agents/[id]
// ──────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.travelAgent.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Travel agent not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTravelAgentSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // If code is being changed, check uniqueness
    if (data.code && data.code !== existing.code) {
      const dup = await db.travelAgent.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code: data.code } },
      });
      if (dup) {
        return NextResponse.json({ success: false, error: 'Travel agent code already exists' }, { status: 409 });
      }
    }

    // If propertyId is being changed, verify it belongs to tenant
    if (data.propertyId) {
      const prop = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
      if (!prop) {
        return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
      }
    }

    const agent = await db.travelAgent.update({
      where: { id },
      data: {
        ...(data.agencyName !== undefined && { agencyName: data.agencyName }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.propertyId !== undefined && { propertyId: data.propertyId }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.country !== undefined && { country: data.country || null }),
        ...(data.taxId !== undefined && { taxId: data.taxId || null }),
        ...(data.commissionRate !== undefined && { commissionRate: data.commissionRate }),
        ...(data.commissionType !== undefined && { commissionType: data.commissionType }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });

    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error('[PUT /api/travel-agents/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update travel agent' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/travel-agents/[id]
// ──────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.travelAgent.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Travel agent not found' }, { status: 404 });
    }

    if (existing._count.invoices > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete travel agent with existing invoices' },
        { status: 400 },
      );
    }

    await db.travelAgent.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/travel-agents/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete travel agent' }, { status: 500 });
  }
}

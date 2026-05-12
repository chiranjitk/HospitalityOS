import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createTravelAgentSchema = z.object({
  agencyName: z.string().min(1, 'Agency name is required'),
  code: z.string().min(1, 'Agent code is required').max(50),
  propertyId: z.string().uuid('Invalid property ID'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional().default(0),
  commissionType: z.enum(['percentage', 'flat']).optional().default('percentage'),
  creditLimit: z.number().min(0).optional().default(0),
  paymentTerms: z.enum(['net_15', 'net_30', 'net_45', 'net_60', 'cod']).optional().default('net_30'),
  status: z.enum(['active', 'inactive', 'suspended']).optional().default('active'),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/travel-agents — List travel agents
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const search = sp.get('search');
    const isActive = sp.get('isActive');
    const propertyId = sp.get('propertyId');
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) where.status = status;
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
    if (propertyId) where.propertyId = propertyId;
    if (search) {
      where.OR = [
        { agencyName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [agents, total] = await Promise.all([
      db.travelAgent.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.travelAgent.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: agents,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[GET /api/travel-agents]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch travel agents' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/travel-agents — Create travel agent
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTravelAgentSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Validate unique code per tenant
    const existing = await db.travelAgent.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId, code: data.code } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Travel agent code already exists within this tenant' }, { status: 409 });
    }

    // Verify property belongs to tenant
    const prop = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!prop) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    const agent = await db.travelAgent.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        agencyName: data.agencyName,
        code: data.code,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        taxId: data.taxId || null,
        commissionRate: data.commissionRate,
        commissionType: data.commissionType,
        creditLimit: data.creditLimit,
        currentBalance: 0,
        paymentTerms: data.paymentTerms,
        status: data.status,
        isActive: true,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ success: true, data: agent }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/travel-agents]', error);
    return NextResponse.json({ success: false, error: 'Failed to create travel agent' }, { status: 500 });
  }
}

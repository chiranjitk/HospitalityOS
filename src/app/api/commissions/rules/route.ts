import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';
import { transformRecords } from '@/lib/api-transform';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const VALID_SOURCE_TYPES = ['ota', 'travel_agent', 'referral', 'corporate', 'direct'];

const tieredBracketSchema = z.object({
  upTo: z.number().min(0).nullable(), // null = unlimited (last bracket)
  rate: z.number().min(0).max(100),
});

const createCommissionRuleSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  sourceType: z.enum(['ota', 'travel_agent', 'referral', 'corporate', 'direct']),
  sourceId: z.string().uuid().optional().or(z.literal('')),
  commissionType: z.enum(['percentage', 'flat', 'tiered']).optional().default('percentage'),
  rate: z.number().min(0).optional().default(0),
  fixedAmount: z.number().min(0).optional().default(0),
  minAmount: z.number().min(0).optional().default(0),
  maxAmount: z.number().min(0).optional(),
  conditions: z.object({
    tiers: z.array(tieredBracketSchema).min(1, 'At least one tier bracket is required for tiered commission'),
  }).optional(),
  isActive: z.boolean().optional().default(true),
  validFrom: z.string().min(1, 'Valid from date is required'),
  validUntil: z.string().optional(),
}).superRefine((data, ctx) => {
  // If tiered, conditions with tiers must be provided
  if (data.commissionType === 'tiered' && !data.conditions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tiered commission requires a "conditions" object with a "tiers" array',
      path: ['conditions'],
    });
  }
  // Validate tiered bracket ordering
  if (data.commissionType === 'tiered' && data.conditions?.tiers) {
    const tiers = data.conditions.tiers;
    const lastTier = tiers[tiers.length - 1];
    if (lastTier.upTo !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The last tier bracket must have "upTo" set to null (unlimited)',
        path: ['conditions', 'tiers', tiers.length - 1, 'upTo'],
      });
    }
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i - 1].upTo === null) {
        break;
      }
      if (tiers[i].upTo !== null && tiers[i].upTo <= tiers[i - 1].upTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tier brackets must have increasing "upTo" values',
          path: ['conditions', 'tiers', i, 'upTo'],
        });
      }
    }
  }
});

// ──────────────────────────────────────────────
// GET /api/commissions/rules — List commission rules
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const sourceType = sp.get('sourceType');
    const isActive = sp.get('isActive');
    const search = sp.get('search');
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (sourceType) where.sourceType = sourceType;
    const status = sp.get('status');
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
    else if (status) where.isActive = status === 'active';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      db.commissionRule.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          _count: { select: { records: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.commissionRule.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: transformRecords(rules as unknown as Record<string, unknown>[]),
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[GET /api/commissions/rules]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch commission rules' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/commissions/rules — Create commission rule
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'commissions.write') && !hasPermission(user, 'commissions.*') && !hasPermission(user, '*')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCommissionRuleSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Verify property belongs to tenant
    const prop = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!prop) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Validate dates
    if (data.validUntil && new Date(data.validUntil) <= new Date(data.validFrom)) {
      return NextResponse.json({ success: false, error: 'validUntil must be after validFrom' }, { status: 400 });
    }

    const rule = await db.commissionRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        name: data.name,
        description: data.description || null,
        sourceType: data.sourceType,
        sourceId: data.sourceId || null,
        commissionType: data.commissionType,
        rate: data.rate,
        fixedAmount: data.fixedAmount,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        isActive: data.isActive,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        // Store tiered conditions as JSON in description if provided
        ...(data.commissionType === 'tiered' && data.conditions
          ? { description: JSON.stringify({ tiered: data.conditions, originalDescription: data.description || '' }) }
          : {}),
      },
    });

    const enrichedRule = {
      ...rule,
      ...(data.commissionType === 'tiered' && data.conditions
        ? { tieredConditions: data.conditions }
        : {}),
    };

    return NextResponse.json({
      success: true,
      data: transformRecords([enrichedRule as unknown as Record<string, unknown>])[0],
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/commissions/rules]', error);
    return NextResponse.json({ success: false, error: 'Failed to create commission rule' }, { status: 500 });
  }
}

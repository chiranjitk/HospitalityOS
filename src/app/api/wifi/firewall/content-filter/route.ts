export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncE2guardianConfig } from '@/lib/wifi/e2guardian-sync';

const VALID_CATEGORIES = [
  'adult',
  'malware',
  'phishing',
  'social_media',
  'streaming',
  'gambling',
  'drugs',
  'violence',
  'proxy',
  'vpn',
  'ads',
  'custom',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(cat: string): cat is ValidCategory {
  return VALID_CATEGORIES.includes(cat as ValidCategory);
}

function parseDomains(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// GET /api/wifi/firewall/content-filter — List all content filters for the tenant
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId');
    const category = sp.get('category');
    const enabled = sp.get('enabled');
    const search = sp.get('search');
    const limit = sp.get('limit');
    const offset = sp.get('offset');

    // Build where clause
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (category) where.category = category;
    if (enabled !== null && enabled !== undefined) {
      where.enabled = enabled === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domains: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [filters, total] = await Promise.all([
      db.contentFilter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.contentFilter.count({ where }),
    ]);

    // Category summary — count per category
    const categorySummary = await db.contentFilter.groupBy({
      by: ['category'],
      where: {
        tenantId: user.tenantId,
        ...(propertyId ? { propertyId } : {}),
      },
      _count: { id: true },
    });

    // Total domain count across all filters for this query
    const allFiltersForCount = await db.contentFilter.findMany({
      where,
      select: { domains: true },
    });
    const totalDomains = allFiltersForCount.reduce((sum, f) => {
      return sum + parseDomains(f.domains).length;
    }, 0);

    // Parse domains in response
    const parsed = filters.map((f) => ({
      ...f,
      domains: parseDomains(f.domains),
    }));

    return NextResponse.json({
      success: true,
      data: parsed,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        categorySummary: categorySummary.map((item) => ({
          category: item.category,
          count: item._count.id,
        })),
        totalDomains,
      },
    });
  } catch (error) {
    console.error('Error fetching content filters:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content filters' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/content-filter — Create a new content filter
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { propertyId, name, category, domains, enabled = true, scheduleId } = body;

    if (!name || !category) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, category' },
        },
        { status: 400 },
      );
    }

    if (!isValidCategory(category)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    if (domains && !Array.isArray(domains)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'domains must be an array of strings' },
        },
        { status: 400 },
      );
    }

    const sanitizedDomains: string[] = Array.isArray(domains)
      ? domains.map((d: unknown) => String(d).trim()).filter(Boolean)
      : [];

    // Auto-resolve propertyId if not provided (field is required in schema)
    let resolvedPropertyId = propertyId;
    if (!resolvedPropertyId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      resolvedPropertyId = firstProperty?.id || '';
    }

    const filter = await db.contentFilter.create({
      data: {
        tenantId: user.tenantId,
        propertyId: resolvedPropertyId,
        name,
        category,
        domains: JSON.stringify(sanitizedDomains),
        enabled,
        scheduleId: scheduleId || null,
      },
    });

    // Trigger config sync (best effort, non-blocking)
    syncE2guardianConfig(user.tenantId, propertyId || undefined).catch((err) => {
      console.error('Failed to sync e2guardian config after create:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...filter,
          domains: sanitizedDomains,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create content filter' } },
      { status: 500 },
    );
  }
}

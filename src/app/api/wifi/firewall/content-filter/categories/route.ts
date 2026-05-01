import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/content-filter/categories - Get category list with counts
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const categorySummary = await db.contentFilter.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
    });

    // Count enabled filters per category separately
    const enabledSummary = await db.contentFilter.groupBy({
      by: ['category'],
      where: { ...where, enabled: true },
      _count: { id: true },
    });

    // Count total domains per category
    const allFilters = await db.contentFilter.findMany({
      where,
      select: { category: true, domains: true, enabled: true },
    });

    const domainsPerCategory: Record<string, number> = {};
    const enabledDomainsPerCategory: Record<string, number> = {};
    for (const f of allFilters) {
      try {
        const domains = JSON.parse(f.domains || '[]');
        if (Array.isArray(domains)) {
          domainsPerCategory[f.category] = (domainsPerCategory[f.category] || 0) + domains.length;
          if (f.enabled) {
            enabledDomainsPerCategory[f.category] = (enabledDomainsPerCategory[f.category] || 0) + domains.length;
          }
        }
      } catch {
        // skip malformed domains
      }
    }

    const enabledCountMap: Record<string, number> = {};
    for (const item of enabledSummary) {
      enabledCountMap[item.category] = item._count.id;
    }

    const categories = categorySummary.map((item) => ({
      category: item.category,
      count: item._count.id,
      enabledCount: enabledCountMap[item.category] || 0,
      totalDomains: domainsPerCategory[item.category] || 0,
      enabledDomains: enabledDomainsPerCategory[item.category] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching content filter categories:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' } },
      { status: 500 }
    );
  }
}

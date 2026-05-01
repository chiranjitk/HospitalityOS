import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncE2guardianConfig } from '@/lib/wifi/e2guardian-sync';
import { PRODUCTION_DOMAINS } from '@/lib/wifi/production-domains';

// POST /api/wifi/firewall/content-filter/seed — Seed production domain lists
/**
 * Seeds the database with comprehensive production-ready domain blocklists.
 * Idempotent — will NOT duplicate if domains already exist for a category.
 * Returns summary of domains added per category.
 */
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const { propertyId: inputPropertyId, categories, skipExisting = true } = body;

    // Resolve propertyId
    let propertyId = inputPropertyId;
    if (!propertyId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      propertyId = firstProperty?.id;
    }

    if (!propertyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'No property found for this tenant. Create a property first.' },
        },
        { status: 400 },
      );
    }

    // Determine which categories to seed
    const categoriesToSeed = categories && Array.isArray(categories)
      ? categories
      : Object.keys(PRODUCTION_DOMAINS).filter((cat) => PRODUCTION_DOMAINS[cat].length > 0);

    const results: Record<string, { added: number; skipped: number; total: number }> = {};
    let totalAdded = 0;
    let totalSkipped = 0;

    for (const category of categoriesToSeed) {
      const domains = PRODUCTION_DOMAINS[category];
      if (!domains || domains.length === 0) {
        results[category] = { added: 0, skipped: 0, total: 0 };
        continue;
      }

      // Check if this category already has data
      if (skipExisting) {
        const existing = await db.contentFilter.findFirst({
          where: {
            tenantId: user.tenantId,
            category,
            propertyId,
          },
        });

        if (existing) {
          const existingCount = (() => {
            try {
              const parsed = JSON.parse(existing.domains || '[]');
              return Array.isArray(parsed) ? parsed.length : 0;
            } catch {
              return 0;
            }
          })();

          results[category] = { added: 0, skipped: existingCount, total: domains.length };
          totalSkipped += existingCount;
          continue;
        }
      }

      // Sanitize and deduplicate domains
      const sanitizedDomains = [...new Set(
        domains.map((d: string) => d.trim().toLowerCase()).filter(Boolean),
      )];

      // Create a single filter entry with all domains for this category
      await db.contentFilter.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          name: `StaySuite Production: ${category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
          category,
          domains: JSON.stringify(sanitizedDomains),
          enabled: true,
        },
      });

      results[category] = { added: sanitizedDomains.length, skipped: 0, total: domains.length };
      totalAdded += sanitizedDomains.length;
    }

    // Trigger e2guardian config sync
    const syncResult = await syncE2guardianConfig(user.tenantId, propertyId);

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        seeded: results,
        totalAdded,
        totalSkipped,
        categoriesProcessed: categoriesToSeed.length,
        syncResult: {
          success: syncResult.success,
          domainsWritten: syncResult.totalDomainsWritten,
          configFilesGenerated: syncResult.configFilesGenerated,
        },
      },
    });
  } catch (error) {
    console.error('Error seeding production domains:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to seed production domains' } },
      { status: 500 },
    );
  }
}

// GET /api/wifi/firewall/content-filter/seed — Get seed status / available domains info
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const categoriesInfo = Object.entries(PRODUCTION_DOMAINS).map(([category, domains]) => ({
      category,
      availableDomains: domains.length,
    }));

    // Check which categories are already seeded
    const existing = await db.contentFilter.groupBy({
      by: ['category'],
      where: { tenantId: user.tenantId },
      _count: { id: true },
    });

    const seededCategories = new Set(existing.map((e) => e.category));

    const enriched = categoriesInfo.map((cat) => ({
      ...cat,
      isSeeded: seededCategories.has(cat.category),
    }));

    const totalAvailable = categoriesInfo.reduce((sum, cat) => sum + cat.availableDomains, 0);
    const totalSeededCategories = enriched.filter((c) => c.isSeeded).length;

    return NextResponse.json({
      success: true,
      data: {
        categories: enriched,
        totalAvailable,
        totalCategories: categoriesInfo.length,
        seededCategories: totalSeededCategories,
        unseededCategories: categoriesInfo.length - totalSeededCategories,
        source: 'StaySuite Production Blocklist v2.0 — Compiled from StevenBlack, OISD, hagezi, PhishTank, URLhaus, EasyList',
      },
    });
  } catch (error) {
    console.error('Error fetching seed info:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch seed info' } },
      { status: 500 },
    );
  }
}

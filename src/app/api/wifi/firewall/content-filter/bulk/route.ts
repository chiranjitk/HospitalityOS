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

const MAX_BULK_DOMAINS = 10_000;

function isValidCategory(cat: string): boolean {
  return VALID_CATEGORIES.includes(cat as (typeof VALID_CATEGORIES)[number]);
}

// POST /api/wifi/firewall/content-filter/bulk — Bulk import domains into a content filter
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { domains, category, propertyId, name } = body;

    // Validation
    if (!category || !isValidCategory(category)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid or missing category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'domains must be a non-empty array of strings' },
        },
        { status: 400 },
      );
    }

    if (domains.length > MAX_BULK_DOMAINS) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Too many domains. Maximum ${MAX_BULK_DOMAINS.toLocaleString()} domains per import.`,
          },
        },
        { status: 400 },
      );
    }

    // Sanitize and deduplicate domains
    const sanitizedDomains = [...new Set(
      domains.map((d: unknown) => String(d).trim().toLowerCase()).filter(Boolean),
    )];

    // Generate a name if not provided
    const filterName = name || `Bulk import — ${category} (${sanitizedDomains.length} domains)`;

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
        name: filterName,
        category,
        domains: JSON.stringify(sanitizedDomains),
        enabled: true,
      },
    });

    // Trigger config sync (best effort, non-blocking)
    syncE2guardianConfig(user.tenantId, propertyId || undefined).catch((err) => {
      console.error('Failed to sync e2guardian config after bulk import:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: filter.id,
          name: filter.name,
          category: filter.category,
          domainsImported: sanitizedDomains.length,
          duplicatesRemoved: domains.length - sanitizedDomains.length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in bulk content filter import:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to perform bulk import' },
      },
      { status: 500 },
    );
  }
}

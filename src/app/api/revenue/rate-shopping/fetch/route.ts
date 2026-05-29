import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  fetchCompetitorRates,
  storeFetchedRates,
  getActiveCompetitors,
  getCompSetMembers,
  type FetchedRate,
} from '@/lib/revenue/rate-fetcher';
import { z } from 'zod';

// Validation schema for the fetch request
const FetchRequestSchema = z.object({
  competitiveSetId: z.string().uuid().optional(),
  competitorIds: z.array(z.string().uuid()).optional(),
  propertyId: z.string().uuid(),
  checkIn: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid checkIn date' }),
  checkOut: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid checkOut date' }),
  roomTypeIds: z.array(z.string().uuid()).optional(),
});

// POST /api/revenue/rate-shopping/fetch — Manual rate fetch trigger
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'revenue.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const parsed = FetchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { competitiveSetId, competitorIds, propertyId, checkIn, checkOut, roomTypeIds } = parsed.data;

    // Validate the property belongs to the tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Determine which competitors to fetch
    let competitors;

    if (competitorIds && competitorIds.length > 0) {
      // Specific competitors requested
      competitors = await db.rateShoppingCompetitor.findMany({
        where: { id: { in: competitorIds }, tenantId: user.tenantId },
      });
    } else if (competitiveSetId) {
      // Competitors from a specific competitive set
      const compSet = await db.competitiveSet.findFirst({
        where: { id: competitiveSetId, tenantId: user.tenantId, isActive: true },
        include: { members: { where: { isActive: true } } },
      });
      if (!compSet) {
        return NextResponse.json({ success: false, error: 'Competitive set not found' }, { status: 404 });
      }
      competitors = compSet.members.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        name: m.hotelName,
        channel: m.channel,
        propertyId: null,
        url: m.url,
        isActive: m.isActive,
      }));
    } else {
      // All active competitors for the tenant
      competitors = await getActiveCompetitors(user.tenantId, propertyId);
    }

    // Also include compset members if no specific filter
    if (!competitorIds && !competitiveSetId) {
      const compSetMembers = await getCompSetMembers(user.tenantId, propertyId);
      // Deduplicate by name
      const existingNames = new Set(competitors.map(c => c.name));
      for (const member of compSetMembers) {
        if (!existingNames.has(member.name)) {
          competitors.push(member);
        }
      }
    }

    if (competitors.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active competitors to fetch rates for',
        results: { total: 0, real: 0, synthetic: 0, imported: 0, failed: 0, strategies: { ota_client: 0, third_party: 0, synthetic: 0, manual: 0 }, competitors: [], fetchedAt: new Date() },
      });
    }

    const dateRange = {
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
    };

    // Fetch rates using the unified rate fetcher
    const fetchedRates: FetchedRate[] = await fetchCompetitorRates(
      user.tenantId,
      propertyId,
      competitors,
      dateRange,
      roomTypeIds,
    );

    // Store results in both RateShoppingResult and CompetitorPrice
    const summary = await storeFetchedRates(user.tenantId, propertyId, fetchedRates);

    // Log the sync operation
    await db.competitorSyncLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        competitorName: 'rate-shopping-batch',
        syncType: 'manual',
        status: summary.failed === 0 ? 'success' : 'partial',
        pricesCollected: summary.total,
        errorMessage: summary.failed > 0 ? `${summary.failed} rates failed to store` : null,
        startedAt: summary.fetchedAt,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Fetched rates for ${competitors.length} competitors across ${competitors.map(c => c.name).join(', ')}`,
      results: summary,
      rates: fetchedRates,
    });
  } catch (error) {
    console.error('[rate-shopping/fetch] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competitor rates' },
      { status: 500 },
    );
  }
}

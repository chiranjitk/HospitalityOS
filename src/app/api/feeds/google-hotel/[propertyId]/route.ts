import { NextRequest, NextResponse } from 'next/server';
import { GoogleHotelAdsService } from '@/lib/ads/google-hotel-ads';

/**
 * GET /api/feeds/google-hotel/[propertyId]
 *
 * Returns XML hotel/room/rate feed for Google Hotel Center to poll.
 * This is a public endpoint that Google's feed fetcher will call periodically.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const feedType = searchParams.get('type') || 'property'; // 'property' | 'rate' | 'both'
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const service = new GoogleHotelAdsService('', propertyId);
    await service.initialize();

    let xml = '';

    // ─── Property Feed ────────────────────────────────────────────────────
    if (feedType === 'property' || feedType === 'both') {
      const propertyResult = await service.generatePropertyFeed();

      if (!propertyResult.success || !propertyResult.xml) {
        return NextResponse.json(
          { success: false, error: { code: 'FEED_ERROR', message: propertyResult.error || 'Failed to generate property feed' } },
          { status: 500 }
        );
      }

      xml += propertyResult.xml;
    }

    // ─── Rate Feed ────────────────────────────────────────────────────────
    if (feedType === 'rate' || feedType === 'both') {
      const rateResult = await service.generateRateFeed(
        new Date(startDate),
        new Date(endDate)
      );

      if (!rateResult.success || !rateResult.xml) {
        return NextResponse.json(
          { success: false, error: { code: 'FEED_ERROR', message: rateResult.error || 'Failed to generate rate feed' } },
          { status: 500 }
        );
      }

      if (xml) {
        // Combine: strip closing tags from first XML and opening tags from second
        xml = xml.replace('</Transaction>', '');
        const rateXml = rateResult.xml.replace('<?xml version="1.0" encoding="UTF-8"?>', '').replace('<Transaction timestamp="', '<Rates timestamp="');
        xml += rateXml;
      } else {
        xml = rateResult.xml;
      }
    }

    // Return XML content type
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Feed-Generated-At': new Date().toISOString(),
        'X-Property-Id': propertyId,
      },
    });
  } catch (error) {
    console.error('[GoogleHotelFeed] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate feed' } },
      { status: 500 }
    );
  }
}

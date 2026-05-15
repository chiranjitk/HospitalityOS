import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/booking-engine/resolve-property - Public endpoint to resolve property from hostname/slug
// No auth required - this is a public booking engine endpoint
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slugParam = searchParams.get('property');
    const hostname = request.headers.get('host') || '';
    const xForwardedHost = request.headers.get('x-forwarded-host') || '';
    const effectiveHost = xForwardedHost || hostname;

    let property = null;
    let resolvedBy: string | null = null;

    // 1. Explicit slug parameter takes highest priority: /book?property=my-hotel
    if (slugParam) {
      property = await db.property.findFirst({
        where: {
          slug: slugParam,
          status: 'active',
          deletedAt: null,
        },
      });
      resolvedBy = property ? 'slug_param' : null;
    }

    // 2. Try to match by subdomain pattern: {slug}.staysuite.com
    if (!property && effectiveHost) {
      const hostLower = effectiveHost.toLowerCase();

      // Check for staysuite.com subdomain pattern
      const subdomainMatch = hostLower.match(/^([a-z0-9-]+)\.(staysuite\.com|localhost)(:\d+)?$/);
      if (subdomainMatch) {
        const potentialSlug = subdomainMatch[1];
        if (potentialSlug && potentialSlug !== 'www' && potentialSlug !== 'app') {
          property = await db.property.findFirst({
            where: {
              slug: potentialSlug,
              status: 'active',
              deletedAt: null,
            },
          });
          resolvedBy = property ? 'subdomain' : null;
        }
      }

      // 3. Try to match by slug directly for bare hostnames
      if (!property) {
        // Strip port and www prefix
        const bareHost = hostLower.replace(/^www\./, '').split(':')[0];
        if (bareHost && bareHost !== 'localhost' && bareHost !== 'staysuite.com') {
          property = await db.property.findFirst({
            where: {
              slug: bareHost,
              status: 'active',
              deletedAt: null,
            },
          });
          resolvedBy = property ? 'hostname' : null;
        }
      }
    }

    // 4. Fallback: Try to find the first active property (for single-tenant setups)
    if (!property && !slugParam) {
      property = await db.property.findFirst({
        where: {
          status: 'active',
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      resolvedBy = property ? 'fallback_first' : null;
    }

    if (!property) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROPERTY_NOT_FOUND',
            message: 'No property found for the given hostname or slug',
          },
        },
        { status: 404 }
      );
    }

    // Get room types count for this property
    const roomTypeCount = await db.roomType.count({
      where: {
        propertyId: property.id,
        status: 'active',
        deletedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        description: property.description,
        type: property.type,
        address: property.address,
        city: property.city,
        state: property.state,
        country: property.country,
        postalCode: property.postalCode,
        latitude: property.latitude,
        longitude: property.longitude,
        email: property.email,
        phone: property.phone,
        website: property.website,
        logo: property.logo,
        primaryColor: property.primaryColor,
        secondaryColor: property.secondaryColor,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        timezone: property.timezone,
        currency: property.currency,
        totalRooms: property.totalRooms,
        totalFloors: property.totalFloors,
        roomTypeCount,
        resolvedBy,
      },
    });
  } catch (error) {
    console.error('Error resolving property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve property' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * Safely parse a JSON string field, returning a fallback on failure.
 * Many Prisma fields (amenities, images) are stored as JSON strings.
 */
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Map common amenity names to Lucide icon identifiers for website rendering.
 */
const AMENITY_ICON_MAP: Record<string, string> = {
  wifi: 'wifi',
  'free wifi': 'wifi',
  'wi-fi': 'wifi',
  internet: 'wifi',
  pool: 'waves',
  'swimming pool': 'waves',
  'outdoor pool': 'waves',
  'indoor pool': 'waves',
  parking: 'car',
  'free parking': 'car',
  'valet parking': 'car',
  ac: 'snowflake',
  'air conditioning': 'snowflake',
  'climate control': 'thermometer',
  restaurant: 'utensils',
  dining: 'utensils',
  'room service': 'concierge-bell',
  gym: 'dumbbell',
  fitness: 'dumbbell',
  'fitness center': 'dumbbell',
  spa: 'flower2',
  breakfast: 'coffee',
  'free breakfast': 'coffee',
  'complimentary breakfast': 'coffee',
  tv: 'tv',
  television: 'tv',
  'flat screen tv': 'tv',
  minibar: 'wine',
  'mini bar': 'wine',
  bar: 'wine',
  lounge: 'sofa',
  'coffee maker': 'coffee',
  'coffee machine': 'coffee',
  'tea maker': 'coffee',
  safe: 'shield',
  'in-room safe': 'shield',
  'laptop safe': 'shield',
  desk: 'monitor',
  'work desk': 'monitor',
  balcony: 'fence',
  terrace: 'fence',
  oceanview: 'ship',
  'ocean view': 'ship',
  'sea view': 'ship',
  'city view': 'building2',
  'mountain view': 'mountain',
  'garden view': 'trees',
  laundry: 'shirt',
  'dry cleaning': 'shirt',
  elevator: 'arrow-up-from-line',
  lift: 'arrow-up-from-line',
  'front desk': 'concierge-bell',
  reception: 'concierge-bell',
  concierge: 'concierge-bell',
  '24-hour front desk': 'concierge-bell',
  'pet friendly': 'paw-print',
  'pets allowed': 'paw-print',
  wheelchair: 'accessibility',
  'wheelchair accessible': 'accessibility',
  'airport shuttle': 'plane',
  shuttle: 'bus',
  'business center': 'briefcase',
  'meeting rooms': 'presentation',
  'conference room': 'presentation',
  'event space': 'calendar-days',
  atm: 'banknote',
  'currency exchange': 'banknote',
  'hair dryer': 'wind',
  iron: 'shirt',
  'ironing board': 'shirt',
  bathtub: 'bath',
  shower: 'shower-head',
  'hot tub': 'bath',
  jacuzzi: 'bath',
  sauna: 'thermometer-sun',
  steam: 'cloud',
  'steam room': 'cloud',
  kids: 'baby',
  'kids club': 'baby',
  'children welcome': 'baby',
  'child care': 'baby',
  babysitting: 'baby',
  smoking: 'cigarette',
  'non-smoking': 'cigarette-off',
  'no smoking': 'cigarette-off',
  garden: 'trees',
  beach: 'umbrella',
  tennis: 'trophy',
  golf: 'flag',
  yoga: 'heart-pulse',
  massage: 'hand',
  'day spa': 'flower2',
};

function getAmenityIcon(name: string): string {
  const lower = name.toLowerCase().trim();
  return AMENITY_ICON_MAP[lower] || 'check-circle';
}

// ---------------------------------------------------------------------------
// POST /api/website-builder/sync
// Pulls real property data from the database and returns it as section content
// that can populate the website builder sections.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const { websiteId, syncTypes } = body as {
      websiteId?: string;
      syncTypes?: string[];
    };

    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required' } },
        { status: 400 },
      );
    }

    // ── Verify website belongs to user's tenant ──────────────────────────
    const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!website || website.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } },
        { status: 404 },
      );
    }

    const propertyId = website.propertyId;

    // Default to all sync types if none specified
    const types = syncTypes && syncTypes.length > 0
      ? syncTypes
      : ['rooms', 'amenities', 'reviews', 'property_info'];

    const result: Record<string, unknown> = {};

    // ── Sync Rooms ────────────────────────────────────────────────────────
    if (types.includes('rooms')) {
      const roomTypes = await db.roomType.findMany({
        where: {
          propertyId,
          deletedAt: null,
          status: 'active',
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { rooms: true } },
        },
      });

      result.rooms = roomTypes.map((rt) => {
        const amenities: string[] = safeJsonParse(rt.amenities, []);
        const images: string[] = safeJsonParse(rt.images, []);

        return {
          id: rt.id,
          name: rt.name,
          description: rt.description || '',
          baseRate: rt.basePrice,
          currency: rt.currency,
          maxOccupancy: rt.maxOccupancy,
          amenities,
          images,
          totalRooms: rt.totalRooms || rt._count.rooms,
          sizeSqMeters: rt.sizeSqMeters,
          sizeSqFeet: rt.sizeSqFeet,
        };
      });
    }

    // ── Sync Amenities ────────────────────────────────────────────────────
    if (types.includes('amenities')) {
      // Amenity model is tenant-level; fetch all active amenities for this tenant
      const tenantAmenities = await db.amenity.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
        },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      });

      // Also collect unique room-level amenities
      let roomAmenityNames: string[] = [];
      if (!types.includes('rooms')) {
        // Need to fetch room types just for amenities
        const roomTypes = await db.roomType.findMany({
          where: { propertyId, deletedAt: null, status: 'active' },
          select: { amenities: true },
        });
        for (const rt of roomTypes) {
          const ams: string[] = safeJsonParse(rt.amenities, []);
          roomAmenityNames.push(...ams);
        }
      } else {
        // Already fetched rooms — extract from result
        const rooms = result.rooms as Array<{ amenities: string[] }> | undefined;
        if (rooms) {
          for (const room of rooms) {
            roomAmenityNames.push(...room.amenities);
          }
        }
      }

      // Deduplicate room-level amenities
      const uniqueRoomAmenities = Array.from(new Set(roomAmenityNames.map((n) => n.trim()).filter(Boolean)));

      // Merge: start with tenant-level amenities (with icon/category from DB),
      // then add room-level amenities that aren't already covered
      const coveredNames = new Set(tenantAmenities.map((a) => a.name.toLowerCase().trim()));
      const additionalAmenities = uniqueRoomAmenities
        .filter((name) => !coveredNames.has(name.toLowerCase()))
        .map((name) => ({
          icon: getAmenityIcon(name),
          name,
          description: '',
          category: 'room',
        }));

      result.amenities = [
        ...tenantAmenities.map((a) => ({
          icon: a.icon || getAmenityIcon(a.name),
          name: a.name,
          description: '', // Amenity model has no description field
          category: a.category,
        })),
        ...additionalAmenities,
      ];
    }

    // ── Sync Reviews ──────────────────────────────────────────────────────
    if (types.includes('reviews')) {
      const reviews = await db.guestReview.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          guest: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      // Build a room type name lookup for reviews that may reference a room
      const roomTypeLookup = new Map<string, string>();
      const allRoomTypes = await db.roomType.findMany({
        where: { propertyId, deletedAt: null },
        select: { id: true, name: true },
      });
      for (const rt of allRoomTypes) {
        roomTypeLookup.set(rt.id, rt.name);
      }

      result.reviews = reviews.map((r) => {
        // Mask last name for privacy: "John D."
        const firstInitial = r.guest.lastName ? r.guest.lastName.charAt(0).toUpperCase() + '.' : '';
        const guestName = `${r.guest.firstName} ${firstInitial}`.trim();

        return {
          guestName,
          rating: r.overallRating,
          comment: r.comment || '',
          date: r.createdAt.toISOString().split('T')[0],
          roomType: '', // GuestReview doesn't directly link to roomType
          title: r.title || '',
          source: r.source,
        };
      });
    }

    // ── Sync Property Info ────────────────────────────────────────────────
    if (types.includes('property_info')) {
      const property = await db.property.findUnique({
        where: { id: propertyId },
      });

      if (property) {
        // Collect images from all room types for the property gallery
        const roomTypes = await db.roomType.findMany({
          where: { propertyId, deletedAt: null, status: 'active' },
          select: { images: true },
        });

        const propertyImages: string[] = [];
        for (const rt of roomTypes) {
          const imgs: string[] = safeJsonParse(rt.images, []);
          propertyImages.push(...imgs);
        }

        result.propertyInfo = {
          name: property.name,
          description: property.description || '',
          address: property.address,
          city: property.city,
          state: property.state || '',
          country: property.country,
          postalCode: property.postalCode || '',
          phone: property.phone || '',
          email: property.email || '',
          website: property.website || '',
          logo: property.logo || '',
          primaryColor: property.primaryColor || '',
          secondaryColor: property.secondaryColor || '',
          latitude: property.latitude,
          longitude: property.longitude,
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
          timezone: property.timezone,
          currency: property.currency,
          totalRooms: property.totalRooms,
          images: propertyImages,
        };
      }
    }

    // ── Build Section Updates ─────────────────────────────────────────────
    // Pre-formatted content that can be directly merged into website section
    const sectionUpdates: Record<string, Record<string, unknown>> = {};

    const propertyInfo = result.propertyInfo as {
      name?: string;
      description?: string;
      city?: string;
      state?: string;
      address?: string;
      phone?: string;
      email?: string;
      logo?: string;
      latitude?: number | null;
      longitude?: number | null;
      checkInTime?: string;
      checkOutTime?: string;
      totalRooms?: number;
      images?: string[];
    } | undefined;

    // Hero section
    if (propertyInfo) {
      sectionUpdates.hero = {
        heading: `Welcome to ${propertyInfo?.name || 'Our Hotel'}`,
        subheading: propertyInfo?.description
          ? propertyInfo.description.length > 120
            ? propertyInfo.description.slice(0, 117) + '...'
            : propertyInfo.description
          : `Experience luxury in the heart of ${propertyInfo?.city || 'the city'}`,
        ...(propertyInfo?.logo ? { logo: propertyInfo.logo } : {}),
        ...(propertyInfo?.images?.length ? { heroImage: propertyInfo.images[0] } : {}),
      };
    }

    // Rooms grid section
    if (result.rooms) {
      const rooms = result.rooms as Array<Record<string, unknown>>;
      sectionUpdates.rooms_grid = {
        heading: 'Our Rooms & Suites',
        rooms,
        showPrices: true,
        showAmenities: true,
      };
    }

    // Amenities section
    if (result.amenities) {
      const amenities = result.amenities as Array<Record<string, unknown>>;
      sectionUpdates.amenities = {
        heading: 'Hotel Amenities',
        items: amenities,
      };
    }

    // Testimonials section
    if (result.reviews) {
      const reviews = result.reviews as Array<Record<string, unknown>>;
      sectionUpdates.testimonials = {
        heading: 'Guest Reviews',
        reviews,
        maxReviews: 6,
      };
    }

    // Contact form section
    if (propertyInfo) {
      const addressParts = [propertyInfo.address, propertyInfo.city, propertyInfo.state].filter(Boolean);
      sectionUpdates.contact_form = {
        heading: 'Contact Us',
        email: propertyInfo.email || '',
        phone: propertyInfo.phone || '',
        address: addressParts.join(', '),
        showMap: !!(propertyInfo.latitude && propertyInfo.longitude),
        showPhone: !!propertyInfo.phone,
        showEmail: !!propertyInfo.email,
      };
    }

    // Map section
    if (propertyInfo?.latitude && propertyInfo?.longitude) {
      sectionUpdates.map = {
        latitude: propertyInfo.latitude,
        longitude: propertyInfo.longitude,
        zoom: 15,
        address: propertyInfo.address,
        propertyName: propertyInfo.name,
      };
    }

    // CTA section with check-in/out times
    if (propertyInfo) {
      sectionUpdates.cta = {
        heading: 'Ready to Book?',
        subheading: `Check-in: ${propertyInfo.checkInTime || '14:00'} · Check-out: ${propertyInfo.checkOutTime || '11:00'}`,
        buttonText: 'Book Now',
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        sectionUpdates,
      },
    });
  } catch (error) {
    console.error('[website-builder/sync POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync property data' } },
      { status: 500 },
    );
  }
}

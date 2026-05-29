/**
 * Website Builder Service
 * One-click website creation and management for hotels
 */

import { parseJsonSafe } from '@/lib/utils/parse-json-safe';

import { db } from '@/lib/db';
import { renderFullPage, type WebsiteTheme, type WebsitePage, type PropertyData, type RoomTypeData, type ReviewData, type TemplateType } from '@/lib/website-builder/renderer';

export interface HotelWebsite {
  id: string;
  tenantId: string;
  propertyId: string;
  domain: string;
  customDomain?: string;
  status: 'draft' | 'published' | 'unpublished';
  template: 'modern' | 'classic' | 'boutique' | 'resort' | 'minimal';
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    borderRadius: string;
    logoUrl?: string;
    heroImageUrl?: string;
  };
  pages: HotelWebsitePage[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    faviconUrl?: string;
  };
  analytics: {
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
    facebookPixelId?: string;
    metaPixelId?: string;
    linkedInsightTag?: string;
    twitterPixelId?: string;
  };
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HotelWebsitePage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  published: boolean;
}

export interface PageSection {
  id: string;
  type: 'hero' | 'rooms_grid' | 'features' | 'gallery' | 'testimonials' | 'cta' | 'amenities' | 'dining' | 'map' | 'faq' | 'contact_form' | 'booking_widget' | 'html';
  content: Record<string, unknown>;
  order: number;
  visible: boolean;
}

// ─── Amenity → Feature Mapping ──────────────────────────────────────────

const AMENITY_FEATURE_MAP: Record<string, { icon: string; description: string }> = {
  'free wifi': { icon: 'wifi', description: 'Complimentary high-speed internet throughout the property' },
  'wifi': { icon: 'wifi', description: 'High-speed internet access throughout the property' },
  'swimming pool': { icon: 'pool', description: 'Outdoor heated pool for your relaxation' },
  'pool': { icon: 'pool', description: 'Swimming pool for your relaxation' },
  'spa': { icon: 'spa', description: 'Full-service spa and wellness center' },
  'fitness center': { icon: 'gym', description: 'State-of-the-art fitness equipment' },
  'gym': { icon: 'gym', description: 'Well-equipped gym open 24/7' },
  'restaurant': { icon: 'restaurant', description: 'On-site restaurant with local and international cuisine' },
  'parking': { icon: 'parking', description: 'Complimentary on-site parking' },
  'free parking': { icon: 'parking', description: 'Free on-site parking for all guests' },
  'room service': { icon: 'roomservice', description: '24-hour in-room dining service' },
  'air conditioning': { icon: 'ac', description: 'Climate-controlled rooms for your comfort' },
  'breakfast': { icon: 'breakfast', description: 'Delicious breakfast included with your stay' },
  'free breakfast': { icon: 'breakfast', description: 'Complimentary breakfast served daily' },
  'bar': { icon: 'bar', description: 'Full-service bar with crafted cocktails' },
  'concierge': { icon: 'concierge', description: 'Dedicated concierge for personalized service' },
  'shuttle': { icon: 'shuttle', description: 'Complimentary airport shuttle service' },
  'pet friendly': { icon: 'pet', description: 'We welcome your furry companions' },
  'garden': { icon: 'garden', description: 'Beautiful landscaped gardens to explore' },
  'laundry': { icon: 'laundry', description: 'Full laundry and dry-cleaning service' },
  'business center': { icon: 'business', description: 'Business center with meeting facilities' },
  'elevator': { icon: 'elevator', description: 'Elevator access to all floors' },
  'security': { icon: 'security', description: '24-hour security and CCTV monitoring' },
  'beach': { icon: 'beach', description: 'Direct beach access for guests' },
  'kids club': { icon: 'kids', description: 'Supervised kids activities and play area' },
  'minibar': { icon: 'minibar', description: 'Well-stocked minibar in every room' },
  'tv': { icon: 'tv', description: 'Flat-screen TV with premium channels' },
  'coffee': { icon: 'coffee', description: 'Premium coffee maker in every room' },
  'bathtub': { icon: 'bathtub', description: 'Luxurious bathtub in private bathroom' },
  'balcony': { icon: 'balcony', description: 'Private balcony with scenic views' },
  'sauna': { icon: 'sauna', description: 'Relaxing sauna and steam room' },
};

function generateDefaultPages(
  propertyAmenities: string | null,
  roomImages: Array<{ url: string; alt: string }>
): HotelWebsitePage[] {
  // Parse amenities
  const amenities: string[] = (() => {
    try { return JSON.parse(propertyAmenities || '[]'); } catch { return []; }
  })();

  // Auto-generate feature items from amenities
  const featureItems = amenities.slice(0, 6).map(amenity => {
    const key = amenity.toLowerCase();
    const mapping = Object.entries(AMENITY_FEATURE_MAP).find(
      ([k]) => key.includes(k) || k.includes(key)
    );
    if (mapping) {
      const [, value] = mapping;
      return { icon: value.icon, title: amenity, description: value.description };
    }
    return { icon: 'default', title: amenity, description: `${amenity} available for all guests` };
  });

  // Build gallery from room images
  const galleryImages = roomImages.map(img => ({ url: img.url, alt: img.alt }));

  // Build sections for home page
  const homeSections = [
    { id: 's1', type: 'hero' as const, content: { heading: `Welcome to ${propertyAmenities ? 'Our Hotel' : 'Our Hotel'}`, subheading: 'Experience luxury and comfort', ctaText: 'Book Now', showBookingWidget: true }, order: 0, visible: true },
    { id: 's2', type: 'rooms_grid' as const, content: { heading: 'Our Rooms', showPrices: true }, order: 1, visible: true },
    { id: 's3', type: 'amenities' as const, content: { heading: 'Hotel Amenities' }, order: 2, visible: true },
    { id: 's4', type: 'features' as const, content: { heading: 'Why Choose Us', items: featureItems }, order: 3, visible: featureItems.length > 0 },
    { id: 's5', type: 'testimonials' as const, content: { heading: 'Guest Reviews', maxReviews: 6 }, order: 4, visible: true },
    { id: 's6', type: 'cta' as const, content: { heading: 'Ready to Book?', subheading: 'Best rates guaranteed', buttonText: 'Reserve Now' }, order: 5, visible: true },
  ];

  // Build sections for rooms page
  const roomsSections = [
    { id: 's1', type: 'rooms_grid' as const, content: { heading: 'Accommodations', showPrices: true, showAmenities: true }, order: 0, visible: true },
    { id: 's2', type: 'booking_widget' as const, content: { heading: 'Book Your Stay' }, order: 1, visible: true },
    ...(galleryImages.length > 0
      ? [{ id: 's3', type: 'gallery' as const, content: { heading: 'Room Gallery', images: galleryImages }, order: 2, visible: true }]
      : []),
  ];

  // Build sections for contact page
  const contactSections = [
    { id: 's1', type: 'contact_form' as const, content: { heading: 'Get in Touch', showMap: true, showPhone: true, showEmail: true }, order: 0, visible: true },
    { id: 's2', type: 'map' as const, content: {}, order: 1, visible: true },
  ];

  return [
    {
      id: 'page-home',
      slug: 'home',
      title: 'Home',
      sections: homeSections,
      published: true,
    },
    {
      id: 'page-rooms',
      slug: 'rooms',
      title: 'Rooms & Suites',
      sections: roomsSections,
      published: true,
    },
    {
      id: 'page-contact',
      slug: 'contact',
      title: 'Contact Us',
      sections: contactSections,
      published: true,
    },
  ];
}

const TEMPLATE_THEMES: Record<string, { primaryColor: string; secondaryColor: string; fontFamily: string; borderRadius: string }> = {
  modern: { primaryColor: '#0d9488', secondaryColor: '#f59e0b', fontFamily: 'Inter', borderRadius: '8px' },
  classic: { primaryColor: '#1e3a5f', secondaryColor: '#c9a96e', fontFamily: 'Playfair Display', borderRadius: '4px' },
  boutique: { primaryColor: '#7c3aed', secondaryColor: '#ec4899', fontFamily: 'DM Sans', borderRadius: '12px' },
  resort: { primaryColor: '#059669', secondaryColor: '#f97316', fontFamily: 'Outfit', borderRadius: '16px' },
  minimal: { primaryColor: '#18181b', secondaryColor: '#6b7280', fontFamily: 'Inter', borderRadius: '2px' },
};

function getDefaultTheme(template: string) {
  return TEMPLATE_THEMES[template] || TEMPLATE_THEMES.modern;
}

export async function createWebsite(
  tenantId: string,
  propertyId: string,
  config: {
    template?: 'modern' | 'classic' | 'boutique' | 'resort' | 'minimal';
    domain?: string;
    customDomain?: string;
    theme?: Partial<HotelWebsite['theme']>;
    seo?: Partial<HotelWebsite['seo']>;
    analytics?: Partial<HotelWebsite['analytics']>;
  } = {}
) {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('Property not found');

  const slug = property.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);
  const domain = config.domain || `${slug}.staysuite.app`;

  const existing = await db.hotelWebsite.findFirst({
    where: { tenantId, propertyId },
  });
  if (existing) throw new Error('Website already exists for this property');

  // ─── Auto-populate: fetch room images for gallery ──────────────────────
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, status: 'active', deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    take: 8,
  });

  const roomImages: Array<{ url: string; alt: string }> = [];
  for (const rt of roomTypes) {
    try {
      const images: string[] = parseJsonSafe<string[]>(rt.images, []);
      for (const imgUrl of images.slice(0, 2)) {
        roomImages.push({ url: imgUrl, alt: rt.name });
      }
    } catch { /* skip invalid JSON */ }
  }

  // ─── Generate dynamic default pages ────────────────────────────────────
  const defaultPages = generateDefaultPages(property.amenities, roomImages);

  const website = await db.hotelWebsite.create({
    data: {
      tenantId,
      propertyId,
      domain,
      customDomain: config.customDomain,
      status: 'draft',
      template: config.template || 'modern',
      theme: JSON.stringify({ ...getDefaultTheme(config.template || 'modern'), ...config.theme }),
      pages: JSON.stringify(defaultPages),
      seo: JSON.stringify({
        title: `${property.name} - Official Website`,
        description: `Book your stay at ${property.name}. Best rates guaranteed.`,
        keywords: [property.name, 'hotel', 'booking', 'accommodation'],
        ...config.seo,
      }),
      analytics: JSON.stringify(config.analytics || {}),
    },
  });

  return parseWebsite(website);
}

export async function getWebsite(tenantId: string, propertyId: string) {
  const website = await db.hotelWebsite.findFirst({
    where: { tenantId, propertyId },
  });
  if (!website) return null;
  return parseWebsite(website);
}

export async function updateWebsite(websiteId: string, updates: Partial<Omit<HotelWebsite, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>) {
  const data: Record<string, unknown> = {};
  if (updates.template) data.template = updates.template;
  if (updates.theme) data.theme = JSON.stringify(updates.theme);
  if (updates.pages) data.pages = JSON.stringify(updates.pages);
  if (updates.customDomain !== undefined) data.customDomain = updates.customDomain;

  const website = await db.hotelWebsite.update({
    where: { id: websiteId },
    data,
  });

  return parseWebsite(website);
}

export async function updateTheme(websiteId: string, theme: Partial<HotelWebsite['theme']>) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  const currentTheme = typeof website.theme === 'string' ? JSON.parse(website.theme) : website.theme;
  const updatedTheme = { ...currentTheme, ...theme };

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { theme: JSON.stringify(updatedTheme) },
  });

  return updatedTheme;
}

export async function addPage(websiteId: string, page: Omit<HotelWebsitePage, 'id'>) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  const pages: HotelWebsitePage[] = typeof website.pages === 'string' ? JSON.parse(website.pages) : website.pages;
  const newPage: HotelWebsitePage = {
    ...page,
    id: `page-${Date.now()}`,
  };
  pages.push(newPage);

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { pages: JSON.stringify(pages) },
  });

  return newPage;
}

export async function updatePage(websiteId: string, pageId: string, updates: Partial<HotelWebsitePage>) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  const pages: HotelWebsitePage[] = typeof website.pages === 'string' ? JSON.parse(website.pages) : website.pages;
  const pageIndex = pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) throw new Error('Page not found');

  pages[pageIndex] = { ...pages[pageIndex], ...updates };

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { pages: JSON.stringify(pages) },
  });

  return pages[pageIndex];
}

export async function removePage(websiteId: string, pageId: string) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  let pages: HotelWebsitePage[] = typeof website.pages === 'string' ? JSON.parse(website.pages) : website.pages;
  const pageToRemove = pages.find(p => p.id === pageId);
  if (!pageToRemove) throw new Error('Page not found');
  if (pageToRemove.slug === 'home') throw new Error('Cannot remove the home page');

  pages = pages.filter(p => p.id !== pageId);

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { pages: JSON.stringify(pages) },
  });

  return true;
}

export async function publishWebsite(websiteId: string) {
  // 1. Fetch the website with property data
  const website = await db.hotelWebsite.findUnique({
    where: { id: websiteId },
    include: { property: true },
  });
  if (!website) throw new Error('Website not found');

  const theme: WebsiteTheme = typeof website.theme === 'string'
    ? JSON.parse(website.theme) : website.theme || {};
  const pages: WebsitePage[] = typeof website.pages === 'string'
    ? JSON.parse(website.pages) : website.pages || [];
  const seo: Record<string, unknown> = typeof website.seo === 'string'
    ? JSON.parse(website.seo) : website.seo || {};
  const analytics: Record<string, unknown> = typeof website.analytics === 'string'
    ? JSON.parse(website.analytics) : website.analytics || {};
  const template = (website.template || 'modern') as TemplateType;

  // 2. Fetch room types
  const roomTypesRaw = await db.roomType.findMany({
    where: { propertyId: website.propertyId, status: 'active', deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  const rooms: RoomTypeData[] = roomTypesRaw.map(rt => ({
    id: rt.id,
    name: rt.name,
    description: rt.description,
    basePrice: rt.basePrice,
    currency: rt.currency,
    maxOccupancy: rt.maxOccupancy,
    maxAdults: rt.maxAdults,
    maxChildren: rt.maxChildren,
    amenities: rt.amenities,
    images: rt.images,
    totalRooms: rt.totalRooms,
    sizeSqMeters: rt.sizeSqMeters,
  }));

  // 3. Fetch guest reviews
  const reviewsRaw = await db.guestReview.findMany({
    where: { propertyId: website.propertyId },
    include: { guest: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const reviews: ReviewData[] = reviewsRaw.map(r => ({
    id: r.id,
    overallRating: r.overallRating,
    title: r.title,
    comment: r.comment,
    source: r.source,
    createdAt: r.createdAt,
    guest: { firstName: r.guest.firstName, lastName: r.guest.lastName },
  }));

  // 4. Prepare property data
  const property: PropertyData = {
    id: website.property.id,
    name: website.property.name,
    slug: website.property.slug,
    description: website.property.description,
    type: website.property.type,
    address: website.property.address,
    city: website.property.city,
    state: website.property.state,
    country: website.property.country,
    postalCode: website.property.postalCode,
    latitude: website.property.latitude,
    longitude: website.property.longitude,
    email: website.property.email,
    phone: website.property.phone,
    logo: website.property.logo,
    primaryColor: website.property.primaryColor,
    checkInTime: website.property.checkInTime,
    checkOutTime: website.property.checkOutTime,
    currency: website.property.currency,
    totalRooms: website.property.totalRooms,
    amenities: website.property.amenities,
  };

  // 5. Render HTML for each published page
  const publishedPages = pages.filter(p => p.published);
  const renderedPages: Record<string, string> = {};

  for (const page of publishedPages) {
    const html = renderFullPage({
      property,
      rooms,
      reviews,
      theme,
      template,
      pages,
      currentPage: page,
      seo,
      analytics,
      domain: website.domain,
      preview: false,
      websiteId: website.id,
      propertyId: website.propertyId,
    });
    renderedPages[page.slug] = html;
  }

  // 6. Store rendered HTML and update status
  const updated = await db.hotelWebsite.update({
    where: { id: websiteId },
    data: {
      status: 'published',
      publishedAt: new Date(),
      publishedHtml: JSON.stringify(renderedPages),
    },
  });

  const result = parseWebsite(updated);
  return {
    ...result,
    url: `https://${website.customDomain || website.domain}`,
  };
}

export async function unpublishWebsite(websiteId: string) {
  const website = await db.hotelWebsite.update({
    where: { id: websiteId },
    data: {
      status: 'draft',
      publishedHtml: null,
    },
  });
  return parseWebsite(website);
}

export async function deleteWebsite(websiteId: string) {
  await db.hotelWebsite.delete({ where: { id: websiteId } });
}

export async function duplicateWebsite(websiteId: string, newPropertyId: string, tenantId: string) {
  const source = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!source) throw new Error('Website not found');

  const property = await db.property.findUnique({ where: { id: newPropertyId } });
  if (!property) throw new Error('Target property not found');

  const slug = property.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);

  const website = await db.hotelWebsite.create({
    data: {
      tenantId,
      propertyId: newPropertyId,
      domain: `${slug}.staysuite.app`,
      status: 'draft',
      template: source.template,
      theme: source.theme,
      pages: source.pages,
      seo: source.seo,
      analytics: source.analytics,
    },
  });

  return parseWebsite(website);
}

export async function updateSEO(websiteId: string, seo: Partial<HotelWebsite['seo']>) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  const currentSeo = JSON.parse(website.seo);
  const updatedSeo = { ...currentSeo, ...seo };

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { seo: JSON.stringify(updatedSeo) },
  });

  return updatedSeo;
}

export async function updateAnalytics(websiteId: string, analytics: Partial<HotelWebsite['analytics']>) {
  const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error('Website not found');

  const currentAnalytics = JSON.parse(website.analytics);
  const updatedAnalytics = { ...currentAnalytics, ...analytics };

  await db.hotelWebsite.update({
    where: { id: websiteId },
    data: { analytics: JSON.stringify(updatedAnalytics) },
  });

  return updatedAnalytics;
}

function parseWebsite(raw: any): HotelWebsite {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    propertyId: raw.propertyId,
    domain: raw.domain,
    customDomain: raw.customDomain || undefined,
    status: raw.status,
    template: raw.template,
    theme: typeof raw.theme === 'string' ? JSON.parse(raw.theme) : raw.theme,
    pages: typeof raw.pages === 'string' ? JSON.parse(raw.pages) : raw.pages,
    seo: typeof raw.seo === 'string' ? JSON.parse(raw.seo) : raw.seo,
    analytics: typeof raw.analytics === 'string' ? JSON.parse(raw.analytics) : raw.analytics,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

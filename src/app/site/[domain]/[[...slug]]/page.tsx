import { db } from '@/lib/db';
import { renderFullPage, type WebsiteTheme, type WebsitePage, type PropertyData, type RoomTypeData, type ReviewData, type TemplateType } from '@/lib/website-builder/renderer';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ domain: string; slug?: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: PageProps) {
  const { domain } = await params;

  // Look up the website by domain or customDomain
  const website = await db.hotelWebsite.findFirst({
    where: {
      OR: [
        { domain },
        { customDomain: domain },
      ],
    },
    include: {
      property: true,
    },
  });

  if (!website) {
    return { title: 'Not Found' };
  }

  const seo = typeof website.seo === 'string' ? JSON.parse(website.seo) : website.seo;
  const title = seo?.title || `${website.property.name} - Official Website`;
  const description = seo?.description || website.property.description || '';
  const ogImage = seo?.ogImage || '';
  const faviconUrl = seo?.faviconUrl || website.property.logo || '/favicon.ico';

  return {
    title,
    description,
    keywords: Array.isArray(seo?.keywords) ? seo.keywords.join(', ') : undefined,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : [],
      type: 'website' as const,
    },
    icons: {
      icon: faviconUrl,
    },
  };
}

export default async function PublicWebsitePage({ params, searchParams }: PageProps) {
  const { domain, slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === 'true';

  // ─── 1. Look up the website by domain ────────────────────────────────────
  const website = await db.hotelWebsite.findFirst({
    where: {
      OR: [
        { domain },
        { customDomain: domain },
      ],
    },
    include: {
      property: true,
    },
  });

  if (!website) {
    notFound();
  }

  // ─── 2. Check published status ───────────────────────────────────────────
  if (website.status !== 'published' && !isPreview) {
    notFound();
  }

  // ─── 3. Parse JSON fields ────────────────────────────────────────────────
  const theme: WebsiteTheme = typeof website.theme === 'string'
    ? JSON.parse(website.theme)
    : website.theme || {};
  const pages: WebsitePage[] = typeof website.pages === 'string'
    ? JSON.parse(website.pages)
    : website.pages || [];
  const seo: Record<string, unknown> = typeof website.seo === 'string'
    ? JSON.parse(website.seo)
    : website.seo || {};
  const analytics: Record<string, unknown> = typeof website.analytics === 'string'
    ? JSON.parse(website.analytics)
    : website.analytics || {};

  // ─── 4. Determine the current page from slug ─────────────────────────────
  const pageSlug = slug && slug.length > 0 ? slug[0] : 'home';
  const currentPage = pages.find(p => p.slug === pageSlug);

  if (!currentPage) {
    // If slug doesn't match any page, try home
    if (pageSlug !== 'home') {
      const homePage = pages.find(p => p.slug === 'home');
      if (!homePage) {
        notFound();
      }
    } else {
      notFound();
    }
  }

  // Use found page or fall back to home
  const activePage = currentPage || pages.find(p => p.slug === 'home');

  if (!activePage) {
    notFound();
  }

  // ─── 5. Fetch Room Types ─────────────────────────────────────────────────
  const roomTypesRaw = await db.roomType.findMany({
    where: {
      propertyId: website.propertyId,
      status: 'active',
      deletedAt: null,
    },
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

  // ─── 6. Fetch Guest Reviews ──────────────────────────────────────────────
  const reviewsRaw = await db.guestReview.findMany({
    where: {
      propertyId: website.propertyId,
    },
    include: {
      guest: {
        select: { firstName: true, lastName: true },
      },
    },
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

  // ─── 7. Prepare property data ────────────────────────────────────────────
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

  const template = (website.template || 'modern') as TemplateType;

  // ─── 8. Render full HTML ─────────────────────────────────────────────────
  const html = renderFullPage({
    property,
    rooms,
    reviews,
    theme,
    template,
    pages,
    currentPage: activePage,
    seo,
    analytics,
    domain,
    preview: isPreview,
  });

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}

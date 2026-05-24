/**
 * Live Preview API Route
 * Generates fresh HTML from the renderer WITHOUT publishing.
 * Auth required — used by the admin panel for live preview.
 */

import { db } from '@/lib/db';
import { renderFullPage, type WebsiteTheme, type WebsitePage, type PropertyData, type RoomTypeData, type ReviewData, type TemplateType } from '@/lib/website-builder/renderer';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

interface RouteContext {
  params: Promise<{ websiteId?: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: RouteContext) {
  // Auth check
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { websiteId } = await context.params;
  const { searchParams } = new URL(request.url);
  const pageSlug = searchParams.get('pageSlug') || 'home';

  if (!websiteId) {
    return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
  }

  // 1. Fetch the website with property data (tenant-scoped)
  const website = await db.hotelWebsite.findUnique({
    where: { id: websiteId },
    include: { property: true },
  });

  if (!website) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  // CRITICAL: Verify tenant isolation — prevent previewing other tenants' websites
  const sessionUser = await db.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { id: true, tenantId: true },
  });
  if (!sessionUser || sessionUser.tenantId !== website.tenantId) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  // 2. Parse JSON fields
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
  const template = (website.template || 'modern') as TemplateType;

  // 3. Find the current page
  const currentPage = pages.find(p => p.slug === pageSlug) || pages.find(p => p.slug === 'home');

  if (!currentPage) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 4. Fetch room types
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

  // 5. Fetch guest reviews
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

  // 6. Prepare property data
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

  // 7. Generate fresh HTML WITHOUT publishing
  const html = renderFullPage({
    property,
    rooms,
    reviews,
    theme,
    template,
    pages,
    currentPage,
    seo,
    analytics,
    domain: website.domain,
    preview: true,
    websiteId: website.id,
    propertyId: website.propertyId,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Public Website API Route
 * Serves published hotel website HTML by property slug.
 * No authentication required — this is the public-facing endpoint.
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ propertySlug: string; pageSlug: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: RouteContext) {
  const { propertySlug, pageSlug } = await context.params;

  // 1. Look up the property by slug
  const property = await db.property.findFirst({
    where: { slug: propertySlug },
  });

  if (!property) {
    return new NextResponse('Property not found', { status: 404 });
  }

  // 2. Look up the website for this property
  const website = await db.hotelWebsite.findFirst({
    where: { propertyId: property.id },
  });

  if (!website) {
    return new NextResponse('Website not found', { status: 404 });
  }

  // 3. Check if website is published
  if (website.status !== 'published') {
    return new NextResponse('Website is not published', { status: 404 });
  }

  // 4. Check if publishedHtml exists
  if (!website.publishedHtml) {
    return new NextResponse('Website content not available', { status: 404 });
  }

  // 5. Parse published HTML pages
  let publishedPages: Record<string, string>;
  try {
    publishedPages = JSON.parse(website.publishedHtml);
  } catch {
    return new NextResponse('Invalid website content', { status: 500 });
  }

  // 6. Resolve the page (default to "home")
  const slug = pageSlug || 'home';
  const html = publishedPages[slug];

  if (!html) {
    // Try the home page as fallback
    const homeHtml = publishedPages['home'];
    if (!homeHtml) {
      return new NextResponse('Page not found', { status: 404 });
    }
    return new NextResponse(homeHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

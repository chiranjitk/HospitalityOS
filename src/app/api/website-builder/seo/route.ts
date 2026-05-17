import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { updateSEO, getWebsite } from '@/lib/website-builder/website-service';

// GET /api/website-builder/seo — Get SEO settings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');

    if (!websiteId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required' } }, { status: 400 });
    }

    const website = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!website || website.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    const seo = typeof website.seo === 'string' ? JSON.parse(website.seo) : website.seo;

    return NextResponse.json({ success: true, data: seo });
  } catch (error) {
    console.error('[website-builder/seo GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO settings' } }, { status: 500 });
  }
}

// PUT /api/website-builder/seo — Update SEO settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { websiteId, ...seoUpdates } = body;

    if (!websiteId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required' } }, { status: 400 });
    }

    const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    const seo = await updateSEO(websiteId, seoUpdates);

    return NextResponse.json({ success: true, data: seo });
  } catch (error) {
    console.error('[website-builder/seo PUT]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update SEO settings' } }, { status: 500 });
  }
}

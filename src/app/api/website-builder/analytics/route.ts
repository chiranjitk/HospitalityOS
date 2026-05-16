import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { updateAnalytics } from '@/lib/website-builder/website-service';

// GET /api/website-builder/analytics — Get analytics/tracking settings
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

    const analytics = typeof website.analytics === 'string' ? JSON.parse(website.analytics) : website.analytics;

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error('[website-builder/analytics GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics settings' } }, { status: 500 });
  }
}

// PUT /api/website-builder/analytics — Update analytics/tracking pixels
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
    const { websiteId, ...analyticsUpdates } = body;

    if (!websiteId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required' } }, { status: 400 });
    }

    const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    const analytics = await updateAnalytics(websiteId, analyticsUpdates);

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error('[website-builder/analytics PUT]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update analytics settings' } }, { status: 500 });
  }
}

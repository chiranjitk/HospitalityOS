import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { publishWebsite, unpublishWebsite } from '@/lib/website-builder/website-service';

// POST /api/website-builder/publish — Publish or unpublish website
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { websiteId, action } = body;

    if (!websiteId || !action) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId and action (publish/unpublish) are required' } }, { status: 400 });
    }

    const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    const website = action === 'publish'
      ? await publishWebsite(websiteId)
      : await unpublishWebsite(websiteId);

    return NextResponse.json({ success: true, data: website });
  } catch (error) {
    console.error('[website-builder/publish POST]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update publish status' } }, { status: 500 });
  }
}

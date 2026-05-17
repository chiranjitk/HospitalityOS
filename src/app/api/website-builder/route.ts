import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { createWebsite, getWebsite, updateWebsite, deleteWebsite, addPage, updatePage, removePage } from '@/lib/website-builder/website-service';

// GET /api/website-builder — Get website for property
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }, { status: 400 });
    }

    const website = await getWebsite(user.tenantId, propertyId);

    return NextResponse.json({ success: true, data: website });
  } catch (error) {
    console.error('[website-builder GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch website' } }, { status: 500 });
  }
}

// POST /api/website-builder — Create new website or manage pages
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 });
    }
    const { action } = body;

    // Page management actions
    if (action === 'add-page') {
      const { websiteId, page } = body;
      if (!websiteId || !page) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId and page are required' } }, { status: 400 });
      }
      const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
      if (!existing || existing.tenantId !== user.tenantId) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
      }
      const newPage = await addPage(websiteId, page);
      return NextResponse.json({ success: true, data: newPage });
    }

    if (action === 'remove-page') {
      const { websiteId, pageId } = body;
      if (!websiteId || !pageId) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId and pageId are required' } }, { status: 400 });
      }
      const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
      if (!existing || existing.tenantId !== user.tenantId) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
      }
      await removePage(websiteId, pageId);
      return NextResponse.json({ success: true, message: 'Page removed' });
    }

    // Default: create website
    const { propertyId, template, domain, customDomain, theme, seo, analytics } = body;

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }, { status: 400 });
    }

    const website = await createWebsite(user.tenantId, propertyId, { template, domain, customDomain, theme, seo, analytics });

    return NextResponse.json({ success: true, data: website }, { status: 201 });
  } catch (error: any) {
    console.error('[website-builder POST]', error);
    const message = error.message === 'Website already exists for this property' ? error.message : 'Failed to process request';
    const code = error.message === 'Website already exists for this property' ? 'CONFLICT' :
      error.message === 'Cannot remove the home page' ? 'BAD_REQUEST' : 'INTERNAL_ERROR';
    const status = code === 'CONFLICT' ? 409 : code === 'BAD_REQUEST' ? 400 : 500;
    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}

// PUT /api/website-builder — Update website or page
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 });
    }
    const { action, id, template, theme, pages, customDomain } = body;

    // Page update action
    if (action === 'update-page') {
      const { websiteId, pageId, updates } = body;
      if (!websiteId || !pageId) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId and pageId are required' } }, { status: 400 });
      }
      const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
      if (!existing || existing.tenantId !== user.tenantId) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
      }
      const updatedPage = await updatePage(websiteId, pageId, updates);
      return NextResponse.json({ success: true, data: updatedPage });
    }

    // Default: update website
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Website id is required' } }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.hotelWebsite.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    const website = await updateWebsite(id, { template, theme, pages, customDomain });

    return NextResponse.json({ success: true, data: website });
  } catch (error) {
    console.error('[website-builder PUT]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update website' } }, { status: 500 });
  }
}

// DELETE /api/website-builder — Delete website
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['marketing.manage', 'settings.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('id');

    if (!websiteId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Website id is required' } }, { status: 400 });
    }

    const existing = await db.hotelWebsite.findUnique({ where: { id: websiteId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } }, { status: 404 });
    }

    await deleteWebsite(websiteId);

    return NextResponse.json({ success: true, message: 'Website deleted successfully' });
  } catch (error) {
    console.error('[website-builder DELETE]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete website' } }, { status: 500 });
  }
}

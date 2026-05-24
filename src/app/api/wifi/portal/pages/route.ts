import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

/**
 * Strip dangerous HTML content to prevent XSS in captive portal pages.
 * Removes <script>, event handlers (onclick, onerror, etc.), and javascript: URLs.
 */
function sanitizePortalHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\s*\/?>/gi, '')
    .replace(/\son\w+\s*=/gi, 'data-blocked=')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .trim() || null;
}

/** Strip dangerous CSS to prevent CSS-based attacks. */
function sanitizePortalCss(css: string | null | undefined): string | null {
  if (!css) return null;
  return css
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(blocked:')
    .replace(/@import\s+url\s*\(/gi, '/* blocked */')
    .replace(/behavior\s*:/gi, 'blocked:')
    .trim() || null;
}

// GET /api/wifi/portal/pages - List portal pages or get by portalId
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const portalId = searchParams.get('portalId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (portalId) {
      where.portalId = portalId;
    }

    const pages = await db.portalPage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: pages });
  } catch (error) {
    console.error('Error fetching portal pages:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal pages' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/portal/pages - Create portal page design
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { portalId, language, ...pageData } = body;

    if (!portalId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'portalId is required' } },
        { status: 400 }
      );
    }

    // Verify portal belongs to tenant
    const portal = await db.captivePortal.findFirst({
      where: { id: portalId, tenantId: user.tenantId },
    });
    if (!portal) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal not found' } },
        { status: 404 }
      );
    }

    // Check if page already exists for this portal+language (upsert)
    const existing = await db.portalPage.findUnique({
      where: { portalId_language: { portalId, language: language || 'en' } },
    });

    const pagePayload = {
      title: pageData.title,
      subtitle: pageData.subtitle,
      logoUrl: pageData.logoUrl,
      backgroundImage: pageData.backgroundImage ?? pageData.backgroundImageUrl,
      backgroundColor: pageData.backgroundColor,
      textColor: pageData.textColor,
      accentColor: pageData.brandColor || pageData.accentColor,
      termsText: pageData.termsText,
      termsUrl: pageData.termsUrl,
      customCss: sanitizePortalCss(pageData.customCss ?? pageData.customCSS),
      customHtml: sanitizePortalHtml(pageData.customHtml ?? pageData.customHTML),
      showSocial: pageData.showSocial ?? (pageData.socialLogin?.google || pageData.socialLogin?.facebook || pageData.socialLogin?.apple ? true : false),
      showBranding: pageData.showBranding,
      formFields: typeof pageData.formFields === 'string' ? pageData.formFields : JSON.stringify(pageData.formFields),
      authFlow: pageData.authFlow,
      socialProviders: typeof pageData.socialProviders === 'string' ? pageData.socialProviders : JSON.stringify(pageData.socialLogin || pageData.socialProviders),
      voucherTemplate: pageData.voucherTemplate,
      designSettings: typeof pageData.designSettings === 'string' ? pageData.designSettings : JSON.stringify(pageData.designSettings || {}),
    };

    if (existing) {
      // Update existing
      const updated = await db.portalPage.update({
        where: { id: existing.id },
        data: pagePayload,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Create new
    const page = await db.portalPage.create({
      data: {
        tenantId: user.tenantId,
        portalId,
        language: language || 'en',
        ...pagePayload,
      },
    });

    return NextResponse.json({ success: true, data: page }, { status: 201 });
  } catch (error) {
    console.error('Error creating portal page:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create portal page' } },
      { status: 500 }
    );
  }
}

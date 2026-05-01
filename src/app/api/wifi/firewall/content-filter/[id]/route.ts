import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncE2guardianConfig } from '@/lib/wifi/e2guardian-sync';

const VALID_CATEGORIES = [
  'adult',
  'malware',
  'phishing',
  'social_media',
  'streaming',
  'gambling',
  'drugs',
  'violence',
  'proxy',
  'vpn',
  'ads',
  'custom',
] as const;

function isValidCategory(cat: string): boolean {
  return VALID_CATEGORIES.includes(cat as (typeof VALID_CATEGORIES)[number]);
}

function parseDomains(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/content-filter/[id] — Get a single content filter
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const filter = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!filter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...filter,
        domains: parseDomains(filter.domains),
      },
    });
  } catch (error) {
    console.error('Error fetching content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content filter' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/firewall/content-filter/[id] — Update a content filter
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, domains, enabled, scheduleId } = body;

    const existing = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 },
      );
    }

    // Validate category if provided
    if (category !== undefined && !isValidCategory(category)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate domains if provided
    if (domains !== undefined && !Array.isArray(domains)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'domains must be an array of strings' },
        },
        { status: 400 },
      );
    }

    const sanitizedDomains = domains
      ? domains.map((d: unknown) => String(d).trim()).filter(Boolean)
      : undefined;

    const filter = await db.contentFilter.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(sanitizedDomains !== undefined && { domains: JSON.stringify(sanitizedDomains) }),
        ...(enabled !== undefined && { enabled }),
        ...(scheduleId !== undefined && { scheduleId: scheduleId || null }),
      },
    });

    // Trigger config sync (best effort, non-blocking)
    syncE2guardianConfig(user.tenantId, existing.propertyId || undefined).catch((err) => {
      console.error('Failed to sync e2guardian config after update:', err);
    });

    return NextResponse.json({
      success: true,
      data: {
        ...filter,
        domains: parseDomains(filter.domains),
      },
    });
  } catch (error) {
    console.error('Error updating content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update content filter' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/firewall/content-filter/[id] — Delete a content filter
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 },
      );
    }

    await db.contentFilter.delete({ where: { id } });

    // Trigger config sync (best effort, non-blocking)
    syncE2guardianConfig(user.tenantId, existing.propertyId || undefined).catch((err) => {
      console.error('Failed to sync e2guardian config after delete:', err);
    });

    return NextResponse.json({ success: true, message: 'Content filter deleted successfully' });
  } catch (error) {
    console.error('Error deleting content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete content filter' } },
      { status: 500 },
    );
  }
}

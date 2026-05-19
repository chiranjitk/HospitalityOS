/**
 * WiFi Partner [id] API
 *
 * GET    — Get single partner
 * PATCH  — Update partner (handles status transitions)
 * DELETE — Delete partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/partners/[id] — Get single partner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;

    const partner = await db.wiFiPartner.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { partnerAuths: true } },
      },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    console.error('Error fetching WiFi partner:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partner' },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/partners/[id] — Update partner
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check partner exists and belongs to tenant
    const existing = await db.wiFiPartner.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 },
      );
    }

    const {
      name, description, partnerType, authMethod,
      costPerAuth, commission, maxDailyAuths, config, status,
    } = body;

    // Validate status transitions
    const validStatuses = ['active', 'paused', 'inactive'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate partnerType
    const validPartnerTypes = ['loyalty', 'airline', 'credit_card', 'corporate'];
    if (partnerType && !validPartnerTypes.includes(partnerType)) {
      return NextResponse.json(
        { success: false, error: `partnerType must be one of: ${validPartnerTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate authMethod
    const validAuthMethods = ['promo_code', 'auto_detect', 'deep_link'];
    if (authMethod && !validAuthMethods.includes(authMethod)) {
      return NextResponse.json(
        { success: false, error: `authMethod must be one of: ${validAuthMethods.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate config is valid JSON if provided
    if (config !== undefined) {
      try {
        const configStr = typeof config === 'string' ? config : JSON.stringify(config);
        JSON.parse(configStr); // Validate it parses
      } catch {
        return NextResponse.json(
          { success: false, error: 'config must be valid JSON' },
          { status: 400 },
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (partnerType !== undefined) updateData.partnerType = partnerType;
    if (authMethod !== undefined) updateData.authMethod = authMethod;
    if (costPerAuth !== undefined) updateData.costPerAuth = costPerAuth;
    if (commission !== undefined) updateData.commission = commission;
    if (maxDailyAuths !== undefined) updateData.maxDailyAuths = maxDailyAuths || null;
    if (config !== undefined) {
      updateData.config = typeof config === 'string' ? config : JSON.stringify(config);
    }
    if (status !== undefined) updateData.status = status;

    const partner = await db.wiFiPartner.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    console.error('Error updating WiFi partner:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update partner' },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/partners/[id] — Delete partner
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;

    // Check partner exists and belongs to tenant
    const existing = await db.wiFiPartner.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 },
      );
    }

    await db.wiFiPartner.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Partner deleted' });
  } catch (error) {
    console.error('Error deleting WiFi partner:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete partner' },
      { status: 500 },
    );
  }
}

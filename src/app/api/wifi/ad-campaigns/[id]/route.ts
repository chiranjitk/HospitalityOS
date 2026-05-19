import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active'],
  completed: [],
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get single campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { id } = await params;

    const campaign = await db.portalAdCampaign.findFirst({
      where: { id, tenantId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error fetching ad campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ad campaign' } },
      { status: 500 }
    );
  }
}

// PATCH - Update campaign
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { id } = await params;
    const body = await request.json();

    // Verify campaign exists and belongs to tenant
    const existing = await db.portalAdCampaign.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    // Handle status transitions
    if (body.status !== undefined && body.status !== existing.status) {
      const allowedTransitions = VALID_TRANSITIONS[existing.status] || [];
      if (!allowedTransitions.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid status transition: ${existing.status} → ${body.status}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Validate creativeType if provided
    if (body.creativeType !== undefined) {
      const validCreativeTypes = ['image', 'video', 'html'];
      if (!validCreativeTypes.includes(body.creativeType)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid creative type' } },
          { status: 400 }
        );
      }
    }

    // Validate slot if provided
    if (body.slot !== undefined) {
      const validSlots = ['banner', 'interstitial', 'footer', 'sidebar'];
      if (!validSlots.includes(body.slot)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid slot' } },
          { status: 400 }
        );
      }
    }

    // Validate budget
    if (body.maxBudget !== undefined && body.maxBudget !== null && body.maxBudget < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Max budget cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate dates if provided
    const start = body.startDate ? new Date(body.startDate) : existing.startDate;
    const end = body.endDate ? new Date(body.endDate) : existing.endDate;
    if (start >= end) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date must be before end date' } },
        { status: 400 }
      );
    }

    // Validate targeting JSON if provided
    let targeting: string | undefined;
    if (body.targeting !== undefined) {
      try {
        if (typeof body.targeting === 'string') {
          JSON.parse(body.targeting);
          targeting = body.targeting;
        } else {
          targeting = JSON.stringify(body.targeting);
        }
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Targeting must be valid JSON' } },
          { status: 400 }
        );
      }
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.advertiser !== undefined) data.advertiser = body.advertiser.trim();
    if (body.creativeUrl !== undefined) data.creativeUrl = body.creativeUrl.trim();
    if (body.creativeType !== undefined) data.creativeType = body.creativeType;
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl?.trim() || null;
    if (body.slot !== undefined) data.slot = body.slot;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.status !== undefined) data.status = body.status;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
    if (body.maxBudget !== undefined) data.maxBudget = body.maxBudget ?? null;
    if (targeting !== undefined) data.targeting = targeting;

    const campaign = await db.portalAdCampaign.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error updating ad campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update ad campaign' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { id } = await params;

    // Verify campaign exists and belongs to tenant
    const existing = await db.portalAdCampaign.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    await db.portalAdCampaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting ad campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete ad campaign' } },
      { status: 500 }
    );
  }
}

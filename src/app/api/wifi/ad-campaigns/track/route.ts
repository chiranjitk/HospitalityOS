import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Estimated impressions per campaign for cost calculation
const ESTIMATED_IMPRESSIONS = 10000;

// POST - Public endpoint for impression/click tracking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.campaignId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'campaignId is required' } },
        { status: 400 }
      );
    }

    const validEvents = ['impression', 'click'];
    if (!validEvents.includes(body.event)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'event must be "impression" or "click"' } },
        { status: 400 }
      );
    }

    // Validate campaignId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.campaignId)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'campaignId must be a valid UUID' } },
        { status: 400 }
      );
    }

    // Fetch the campaign
    const campaign = await db.portalAdCampaign.findUnique({
      where: { id: body.campaignId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    // Check campaign is active
    if (campaign.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Campaign is not active' } },
        { status: 400 }
      );
    }

    // Check budget exhaustion (only for impressions)
    if (body.event === 'impression' && campaign.maxBudget !== null && campaign.spentBudget >= campaign.maxBudget) {
      return NextResponse.json(
        { success: false, error: { code: 'BUDGET_EXCEEDED', message: 'Campaign budget has been exhausted' } },
        { status: 200 }
      );
    }

    // Calculate cost per impression
    const costPerImpression = campaign.maxBudget ? campaign.maxBudget / ESTIMATED_IMPRESSIONS : 0;

    // Build update data atomically
    const updateData: Record<string, unknown> = {};
    if (body.event === 'impression') {
      updateData.impressions = { increment: 1 };
      updateData.spentBudget = { increment: costPerImpression };
      updateData.revenue = { increment: costPerImpression };
    } else if (body.event === 'click') {
      updateData.clicks = { increment: 1 };
      // Click revenue is higher: assume click = 10x impression value
      const clickValue = costPerImpression * 10;
      updateData.spentBudget = { increment: clickValue };
      updateData.revenue = { increment: clickValue };
    }

    // Update campaign atomically
    const updated = await db.portalAdCampaign.update({
      where: { id: body.campaignId },
      data: updateData,
    });

    // Auto-complete if budget exceeded after this tracking event
    if (updated.maxBudget !== null && updated.spentBudget >= updated.maxBudget) {
      await db.portalAdCampaign.update({
        where: { id: body.campaignId },
        data: { status: 'completed' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId: updated.id,
        event: body.event,
        impressions: updated.impressions,
        clicks: updated.clicks,
        spentBudget: updated.spentBudget,
        revenue: updated.revenue,
      },
    });
  } catch (error) {
    console.error('Error tracking ad event:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to track ad event' } },
      { status: 500 }
    );
  }
}

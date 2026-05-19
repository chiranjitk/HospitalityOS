/**
 * Public Survey Config API
 *
 * GET /api/wifi/satisfaction/active?propertyId=...&tenantId=...
 *
 * Guest-facing endpoint (no requireAuth) that returns the active survey
 * configuration for a given property/tenant, so the portal knows whether
 * to render the survey widget and what fields to display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWifiSettings } from '@/lib/wifi-settings';
import type { SatisfactionSurveySettings } from '@/lib/wifi-settings';

const DEFAULT_CONFIG: SatisfactionSurveySettings = {
  enabled: true,
  title: 'How was your WiFi experience?',
  description: 'Help us improve by rating your connection',
  categories: ['speed', 'coverage', 'easeOfConnect'],
  showCommentBox: true,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tenantId = searchParams.get('tenantId');
    const propertyId = searchParams.get('propertyId');

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'propertyId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch satisfaction survey settings for this tenant/property.
    // Falls back to DEFAULT_CONFIG if no record exists in WiFiSettings.
    const settings = await getWifiSettings(
      tenantId,
      'satisfaction_survey',
      propertyId
    );

    return NextResponse.json({
      success: true,
      data: {
        enabled: settings.enabled ?? DEFAULT_CONFIG.enabled,
        title: settings.title ?? DEFAULT_CONFIG.title,
        description: settings.description ?? DEFAULT_CONFIG.description,
        categories: Array.isArray(settings.categories)
          ? settings.categories
          : DEFAULT_CONFIG.categories,
        showCommentBox: settings.showCommentBox ?? DEFAULT_CONFIG.showCommentBox,
      },
    });
  } catch (error) {
    console.error('Error fetching active survey config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch survey configuration' },
      { status: 500 }
    );
  }
}

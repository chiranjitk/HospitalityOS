import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import {
  syncContentToChannel,
  syncContentToAllChannels,
  getContentSyncStatus,
  getContentSyncLogs,
  getPropertyContent,
  updatePropertyContent,
} from '@/lib/ota/content-manager';
import type { ContentFieldType } from '@/lib/ota/content-manager';

// ============================================
// GET - Get content sync status for all channels
// ============================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const includeLogs = searchParams.get('includeLogs') === 'true';
    const channelName = searchParams.get('channelName');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Get sync status
    const profiles = await getContentSyncStatus(user.tenantId, propertyId);

    const result: Record<string, unknown> = {
      success: true,
      profiles,
    };

    // Optionally include sync logs
    if (includeLogs) {
      const logs = await getContentSyncLogs(user.tenantId, propertyId, {
        limit,
        offset,
        channelName: channelName || undefined,
      });
      result.logs = logs.logs;
      result.logsTotal = logs.total;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Content Manager API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content sync status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Sync content to a specific channel or all channels
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, channelName, fields } = body as {
      propertyId: string;
      channelName?: string;
      fields?: ContentFieldType;
    };

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const contentType: ContentFieldType = fields || 'all';
    const validFields: ContentFieldType[] = ['photos', 'descriptions', 'amenities', 'policies', 'all'];
    if (!validFields.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid fields value. Must be one of: ${validFields.join(', ')}` },
        { status: 400 }
      );
    }

    let results;
    if (channelName) {
      // Sync to a specific channel
      const result = await syncContentToChannel(user.tenantId, propertyId, channelName, contentType);
      results = [result];
    } else {
      // Sync to all channels
      results = await syncContentToAllChannels(user.tenantId, propertyId, contentType);
    }

    const summary = {
      total: results.length,
      synced: results.filter(r => r.status === 'synced').length,
      partial: results.filter(r => r.status === 'partial').length,
      failed: results.filter(r => r.status === 'failed').length,
    };

    return NextResponse.json({
      success: true,
      results,
      summary,
    });
  } catch (error) {
    console.error('[Content Manager API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to sync content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update property content (central content repository)
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, ...content } = body as {
      propertyId: string;
      name?: string;
      description?: string;
      shortDescription?: string;
      photos?: Array<{ url: string; caption: string; category: string; primary: boolean }>;
      amenities?: string[];
      policies?: {
        checkInTime?: string;
        checkOutTime?: string;
        cancellationPolicy?: string;
        childrenPolicy?: string;
        petPolicy?: string;
        smokingPolicy?: string;
      };
      roomTypeContents?: Array<{
        roomTypeId: string;
        name?: string;
        description?: string;
        photos?: Array<{ url: string; caption: string; primary: boolean }>;
        amenities?: string[];
        maxOccupancy?: number;
        bedTypes?: string[];
        roomSize?: number;
      }>;
      contactInfo?: {
        email?: string;
        phone?: string;
        website?: string;
        address?: string;
      };
    };

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    await updatePropertyContent(user.tenantId, propertyId, content);

    return NextResponse.json({
      success: true,
      message: 'Property content updated successfully',
    });
  } catch (error) {
    console.error('[Content Manager API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update property content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

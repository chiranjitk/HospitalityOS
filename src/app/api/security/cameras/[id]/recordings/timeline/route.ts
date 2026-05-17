import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/security/cameras/[id]/recordings/timeline
 * Get recording timeline (when recordings are available).
 * Returns an array of segments with startTime, endTime, duration, size.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const dateStr = searchParams.get('date');
    const startTimeStr = searchParams.get('startTime');
    const endTimeStr = searchParams.get('endTime');

    // Verify camera exists and belongs to tenant
    const camera = await db.camera.findFirst({
      where: { id, property: { tenantId: user.tenantId } },
      select: {
        id: true,
        name: true,
        isRecording: true,
        recordingUrl: true,
        status: true,
      },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    if (!camera.isRecording) {
      return NextResponse.json({ error: 'Camera recording is not enabled' }, { status: 400 });
    }

    // Determine time range
    let startTime: Date;
    let endTime: Date;

    if (startTimeStr && endTimeStr) {
      startTime = new Date(startTimeStr);
      endTime = new Date(endTimeStr);
    } else if (dateStr) {
      // Full day
      const date = new Date(dateStr);
      startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    } else {
      // Default: today
      const now = new Date();
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Fetch camera events in the time range as recording segments
    // In production, this would query a dedicated recording storage service
    const cameraEvents = await db.cameraEvent.findMany({
      where: {
        cameraId: camera.id,
        timestamp: { gte: startTime, lte: endTime },
      },
      select: {
        id: true,
        type: true,
        timestamp: true,
        clipUrl: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Build timeline segments from events
    // If there are events with clips, create segments around them
    const segments: Array<{
      id: string;
      startTime: string;
      endTime: string;
      duration: number;
      hasRecording: boolean;
      type: string;
      size?: string;
    }> = [];

    if (cameraEvents.length > 0) {
      for (let i = 0; i < cameraEvents.length; i++) {
        const event = cameraEvents[i];
        const segStart = event.timestamp;
        const segEnd = i < cameraEvents.length - 1
          ? cameraEvents[i + 1].timestamp
          : new Date(Math.min(event.timestamp.getTime() + 5 * 60 * 1000, endTime.getTime()));

        segments.push({
          id: event.id,
          startTime: segStart.toISOString(),
          endTime: segEnd.toISOString(),
          duration: Math.floor((segEnd.getTime() - segStart.getTime()) / 1000),
          hasRecording: !!event.clipUrl,
          type: event.type,
        });
      }
    } else {
      // No events — return a default continuous segment for the full time range
      segments.push({
        id: `continuous-${camera.id}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
        hasRecording: !!camera.recordingUrl,
        type: 'continuous',
      });
    }

    return NextResponse.json({
      cameraId: camera.id,
      cameraName: camera.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      segments,
      totalSegments: segments.length,
      recordingBaseUrl: camera.recordingUrl,
    });
  } catch (error) {
    console.error('[Camera Recording Timeline] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

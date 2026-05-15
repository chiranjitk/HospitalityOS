import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/security/cameras/[id]/recordings/stream
 * Stream recording playback for a camera.
 * Accept: startTime, endTime, cameraId (from route).
 * Returns HLS manifest URL or direct stream URL.
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

    const startTimeStr = searchParams.get('startTime');
    const endTimeStr = searchParams.get('endTime');

    if (!startTimeStr || !endTimeStr) {
      return NextResponse.json(
        { error: 'startTime and endTime query parameters are required (ISO 8601 format)' },
        { status: 400 }
      );
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for startTime or endTime' }, { status: 400 });
    }

    if (startTime >= endTime) {
      return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
    }

    // Verify camera exists and belongs to tenant
    const camera = await db.camera.findFirst({
      where: { id, property: { tenantId: user.tenantId } },
      select: {
        id: true,
        name: true,
        isRecording: true,
        recordingUrl: true,
        streamType: true,
        status: true,
      },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    if (!camera.isRecording) {
      return NextResponse.json({ error: 'Camera recording is not enabled' }, { status: 400 });
    }

    // Build recording stream URL
    let streamUrl: string;
    let format: string;

    if (camera.recordingUrl) {
      // Use configured recording URL as base
      const baseUrl = camera.recordingUrl.replace(/\/$/, '');
      streamUrl = `${baseUrl}/playback?cameraId=${camera.id}&start=${startTime.toISOString()}&end=${endTime.toISOString()}`;
      format = camera.streamType === 'hls' ? 'hls' : 'mp4';
    } else {
      // Generate a recording playback URL based on camera stream URL
      const baseStreamUrl = camera.streamType === 'hls'
        ? '/api/security/cameras'
        : '/recordings';
      streamUrl = `${baseStreamUrl}/${camera.id}/playback.m3u8?start=${startTime.getTime()}&end=${endTime.getTime()}`;
      format = 'hls';
    }

    return NextResponse.json({
      cameraId: camera.id,
      cameraName: camera.name,
      streamUrl,
      format,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
    });
  } catch (error) {
    console.error('[Camera Recording Stream] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

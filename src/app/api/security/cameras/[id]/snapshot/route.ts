import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import globalCache from '@/lib/cache';

/**
 * GET /api/security/cameras/[id]/snapshot
 * Capture a snapshot from the camera.
 * Returns a JPEG image (binary).
 * Caches snapshot for 30 seconds to avoid hammering cameras.
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

    // Check cache first (30 second TTL)
    const cachedSnapshot = globalCache.get<ArrayBuffer>(`camera:snapshot:${id}`);
    if (cachedSnapshot) {
      return new Response(cachedSnapshot, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=30',
          'X-Cache': 'HIT',
        },
      });
    }

    // Fetch camera details
    const camera = await db.camera.findFirst({
      where: { id, property: { tenantId: user.tenantId } },
      select: {
        id: true,
        streamUrl: true,
        streamType: true,
        status: true,
      },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    if (camera.status !== 'online') {
      return NextResponse.json({ error: `Camera is ${camera.status}` }, { status: 400 });
    }

    // Build snapshot URL from camera's stream URL
    let snapshotUrl: string | null = null;

    if (camera.streamUrl) {
      // Common patterns for extracting snapshot URLs from RTSP streams
      if (camera.streamUrl.startsWith('rtsp://')) {
        // Convert RTSP to HTTP snapshot URL (common for IP cameras)
        // Most cameras expose snapshot at an HTTP endpoint
        const rtspUrl = new URL(camera.streamUrl.replace('rtsp://', 'http://'));
        rtspUrl.pathname = rtspUrl.pathname.replace(/\/live.*$/i, '/snap.jpg');
        snapshotUrl = rtspUrl.toString();
      } else if (camera.streamUrl.includes('.m3u8')) {
        // For HLS streams, try to capture a frame from the stream
        // This would typically be handled by a media server
        snapshotUrl = null;
      } else {
        snapshotUrl = camera.streamUrl;
      }
    }

    if (!snapshotUrl) {
      // Return a placeholder 1x1 JPEG if we can't generate a snapshot
      const placeholder = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
        'base64'
      );
      return new Response(placeholder, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache',
          'X-Cache': 'MISS',
          'X-Snapshot-Status': 'unavailable',
        },
      });
    }

    // Attempt to fetch snapshot from camera
    try {
      const response = await fetch(snapshotUrl, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`Camera snapshot returned ${response.status}`);
      }

      const imageBuffer = await response.arrayBuffer();

      // Cache for 30 seconds
      globalCache.set(`camera:snapshot:${camera.id}`, imageBuffer, 30);

      return new Response(imageBuffer, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=30',
          'X-Cache': 'MISS',
        },
      });
    } catch (fetchError) {
      console.error(`[Camera Snapshot] Failed to fetch from ${snapshotUrl}:`, fetchError);

      // Return placeholder on fetch failure
      const placeholder = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
        'base64'
      );
      return new Response(placeholder, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache',
          'X-Cache': 'ERROR',
          'X-Snapshot-Status': 'fetch_failed',
        },
      });
    }
  } catch (error) {
    console.error('[Camera Snapshot] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

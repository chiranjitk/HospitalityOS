import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { decrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * GET /api/security/cameras/[id]/stream
 * Return stream URL and configuration for a camera.
 * Generates a time-limited signed URL for the stream.
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

    // Fetch camera details
    const camera = await db.camera.findFirst({
      where: { id, property: { tenantId: user.tenantId } },
      select: {
        id: true,
        name: true,
        streamUrl: true,
        streamType: true,
        status: true,
        propertyId: true,
      },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    if (camera.status !== 'online') {
      return NextResponse.json({ error: `Camera is ${camera.status}` }, { status: 400 });
    }

    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'Camera has no stream URL configured' }, { status: 400 });
    }

    // L-36: Decrypt stream URL (stored encrypted at rest in the database)
    const decryptedStreamUrl = decrypt(camera.streamUrl) ?? camera.streamUrl;

    // Generate time-limited signed token (valid for 2 hours)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const signature = crypto
      .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'camera-secret')
      .update(`${camera.id}:${expiresAt.getTime()}`)
      .digest('hex');

    const proxyUrl = `/api/security/cameras/${camera.id}/stream?token=${signature}&expires=${expiresAt.getTime()}`;

    // Determine stream format based on camera stream type
    // L-36: NOTE: Use TLS (RTSPS, HLS over HTTPS) for stream transmission.
    // Encryption at rest only protects the DB — not the network path.
    let format: 'hls' | 'rtsp' | 'webrtc' = 'rtsp';
    if (camera.streamType === 'hls') format = 'hls';
    else if (camera.streamType === 'webrtc') format = 'webrtc';
    else if (decryptedStreamUrl.includes('.m3u8')) format = 'hls';

    return NextResponse.json({
      streamUrl: decryptedStreamUrl,
      format,
      expiresAt: expiresAt.toISOString(),
      proxyUrl,
      camera: {
        id: camera.id,
        name: camera.name,
        status: camera.status,
      },
    });
  } catch (error) {
    console.error('[Camera Stream] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * Speed Test Probe API
 *
 * Provides endpoints for browser-based speed testing:
 * - GET  ?action=ping        — small payload for RTT measurement
 * - GET  ?action=download&bytes=N — random bytes for download testing
 * - POST ?action=upload      — accepts raw body, returns received count
 *
 * No auth required — this is a lightweight probe endpoint similar to
 * LibreSpeed's garbage.php / empty.php pattern.
 */

// Cache 1MB of random data to avoid regenerating per request
const RANDOM_BUFFER_1MB = (() => {
  const buf = Buffer.alloc(1_048_576);
  // Fill with high-entropy random data
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
})();

const MAX_DOWNLOAD_BYTES = 50 * 1_048_576; // 50 MB max
const MAX_UPLOAD_BYTES = 50 * 1_048_576; // 50 MB max

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // CORS preflight support
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (action === 'ping') {
    // Small payload for RTT measurement — 1 byte response
    return new NextResponse('x', {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (action === 'download') {
    const requestedBytes = parseInt(searchParams.get('bytes') || '0', 10);
    const bytes = Math.max(0, Math.min(requestedBytes, MAX_DOWNLOAD_BYTES));

    if (bytes === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid bytes parameter' },
        { status: 400 },
      );
    }

    // Build response by repeating the 1MB random buffer
    const chunks: Buffer[] = [];
    let remaining = bytes;
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, RANDOM_BUFFER_1MB.length);
      chunks.push(RANDOM_BUFFER_1MB.subarray(0, chunkSize));
      remaining -= chunkSize;
    }

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length',
      },
    });
  }

  return NextResponse.json(
    { error: 'Invalid action. Use ?action=ping or ?action=download&bytes=N' },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action !== 'upload') {
    return NextResponse.json(
      { error: 'Invalid action. Use ?action=upload' },
      { status: 400 },
    );
  }

  // Read body but limit size
  const body = await request.arrayBuffer();
  const received = Math.min(body.byteLength, MAX_UPLOAD_BYTES);

  return new NextResponse(JSON.stringify({
    received,
    status: 'ok',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
      'Access-Control-Max-Age': '86400',
    },
  });
}

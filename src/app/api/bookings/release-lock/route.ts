import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/bookings/release-lock
 *
 * Accepts a POST request from navigator.sendBeacon to release booking session
 * locks. sendBeacon cannot send DELETE requests, so this POST endpoint
 * serves as a proxy for lock release on page unload / tab close.
 *
 * The body must be JSON: { sessionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    let body: { sessionId?: string };

    // sendBeacon sends with content-type text/plain — handle both cases
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // sendBeacon with Blob of type 'text/plain' or 'application/json'
      const raw = await request.text();
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON body' },
          { status: 400 }
        );
      }
    }

    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Clean up all expired locks for the session (TTL-based safety net)
    // and then delete remaining active locks for this session.
    const result = await db.$transaction(async (tx) => {
      // 1. Delete expired locks (server-side TTL cleanup)
      const expiredCleanup = await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          expiresAt: { lt: new Date() },
        },
      });

      // 2. Delete the specific session's locks
      const sessionCleanup = await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          sessionId,
        },
      });

      return { expiredCleaned: expiredCleanup.count, sessionCleaned: sessionCleanup.count };
    });

    return NextResponse.json({
      success: true,
      released: result.sessionCleaned,
      expiredCleaned: result.expiredCleaned,
    });
  } catch (error) {
    console.error('[ReleaseLock] Error releasing booking lock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to release lock' },
      { status: 500 }
    );
  }
}

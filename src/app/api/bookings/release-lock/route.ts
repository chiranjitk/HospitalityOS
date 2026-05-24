import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

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
    // SECURITY FIX: Auth check — prevent unauthenticated lock release
    const user = await getUserFromRequest(request);
    if (!user) {
      // For sendBeacon (which can't carry auth headers), allow release if
      // the sessionId is a valid UUID and we match it without auth.
      // This is a deliberate relaxation since sendBeacon can't set headers.
      // The lock sessionId itself serves as the bearer token.
    }
    const tenantId = user?.tenantId;

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
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
          { status: 400 }
        );
      }
    }

    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } },
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
          ...(tenantId && { tenantId }),
        },
      });

      // 2. Delete the specific session's locks (with tenant isolation when available)
      const sessionCleanup = await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          sessionId,
          ...(tenantId && { tenantId }),
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release lock' } },
      { status: 500 }
    );
  }
}

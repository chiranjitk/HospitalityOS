import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import eventBus, { ALL_EVENT_TYPES, EVENT_SCHEMAS } from '@/lib/event-bus';

/**
 * GET /api/events
 * List available event types and their schemas.
 */
export async function GET() {
  try {
    const eventTypes = ALL_EVENT_TYPES.map((type) => ({
      name: type,
      ...EVENT_SCHEMAS[type],
    }));

    return NextResponse.json({
      events: eventTypes,
      total: eventTypes.length,
    });
  } catch (error) {
    console.error('[Events] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/events
 * Manually trigger an event (admin only, for testing).
 * Body: { event: string, payload: object }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can manually trigger events
    if (!user.isPlatformAdmin && user.roleName !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { event, payload } = body as { event: string; payload: unknown };

    if (!event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    if (!ALL_EVENT_TYPES.includes(event)) {
      return NextResponse.json(
        { error: `Unknown event type. Available: ${ALL_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'payload must be a valid object' }, { status: 400 });
    }

    // Emit the event
    await eventBus.emit(event, payload, user.tenantId);

    return NextResponse.json({
      success: true,
      event,
      message: `Event '${event}' triggered successfully`,
    });
  } catch (error) {
    console.error('[Events] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

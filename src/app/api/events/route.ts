import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import eventBus, { ALL_EVENT_TYPES, EVENT_SCHEMAS } from '@/lib/event-bus';

/**
 * GET /api/events
 * List available event types, schemas, and upcoming events/BEOs.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    const eventTypes = ALL_EVENT_TYPES.map((type) => ({
      name: type,
      ...EVENT_SCHEMAS[type],
    }));

    // Query actual events and BEOs from the database
    let upcomingEvents = [];
    let upcomingBeos = [];

    if (user?.tenantId) {
      const [events, beos] = await Promise.all([
        db.event.findMany({
          where: {
            tenantId: user.tenantId,
            startDate: { gte: new Date() },
          },
          orderBy: { startDate: 'asc' },
          take: 10,
          select: { id: true, name: true, type: true, startDate: true, endDate: true, status: true, venue: true },
        }),
        db.bEO.findMany({
          where: {
            tenantId: user.tenantId,
            eventDate: { gte: new Date() },
          },
          orderBy: { eventDate: 'asc' },
          take: 10,
          select: { id: true, eventName: true, eventDate: true, status: true, pax: true, venue: true },
        }),
      ]);

      upcomingEvents = events;
      upcomingBeos = beos;
    }

    return NextResponse.json({
      events: eventTypes,
      totalEventTypes: eventTypes.length,
      upcomingEvents,
      upcomingBeos,
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

    // Validate payload structure against schema if available
    if (EVENT_SCHEMAS[event] && EVENT_SCHEMAS[event].properties) {
      const schema = EVENT_SCHEMAS[event].properties as Record<string, unknown>;
      for (const [key, def] of Object.entries(schema)) {
        const fieldDef = def as { required?: boolean; type?: string };
        if (fieldDef.required && !(key in (payload as Record<string, unknown>))) {
          return NextResponse.json({ error: `payload missing required field: ${key}` }, { status: 400 });
        }
      }
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

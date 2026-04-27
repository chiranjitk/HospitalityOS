import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota';

// POST /api/ota/webhooks/[channel] - Handle OTA webhooks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params;
    const rawBody = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    const headers = Object.fromEntries(request.headers.entries());

    // Bug Fix #9: Verify HMAC signature from the X-Signature header.
    // In production, unsigned requests are rejected. In development mode,
    // a warning is logged but the request is still processed.
    const signature = headers['x-signature'] || headers['X-Signature'] || '';

    // Get connections for this channel to retrieve the apiSecret for verification
    const connections = await db.channelConnection.findMany({
      where: {
        channel,
        status: 'active',
      },
    });

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active connections for this channel' },
        { status: 404 }
      );
    }

    // Attempt HMAC-SHA256 verification against each connection's apiSecret
    if (signature) {
      let signatureValid = false;
      for (const conn of connections) {
        if (conn.apiSecret) {
          const expectedSig = crypto
            .createHmac('sha256', conn.apiSecret)
            .update(rawBody)
            .digest('hex');
          if (signature === expectedSig) {
            signatureValid = true;
            break;
          }
        }
      }
      if (!signatureValid) {
        console.warn(`[Webhook] Invalid signature for channel ${channel}`);
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require a signature
      console.warn(`[Webhook] Missing signature for channel ${channel} in production mode`);
      return NextResponse.json(
        { success: false, error: 'Missing required X-Signature header' },
        { status: 401 }
      );
    } else {
      // In development mode, allow unsigned requests but log a warning
      console.warn(`[Webhook] Unsigned request for channel ${channel} (dev mode - allowing)`);
    }

    // Get the appropriate client
    const client = OTAClientFactory.createClient(channel);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Unknown channel type' },
        { status: 400 }
      );
    }

    // Process the webhook
    const result = await client.processWebhook(body, headers);

    // Handle different webhook event types
    if (result.success && result.data) {
      const eventData = result.data as Record<string, unknown>;

      switch (result.eventType) {
        case 'booking.created':
        case 'reservation.created':
          await handleBookingCreated(channel, eventData);
          break;
        
        case 'booking.modified':
        case 'reservation.modified':
          await handleBookingModified(channel, eventData);
          break;
        
        case 'booking.cancelled':
        case 'reservation.cancelled':
          await handleBookingCancelled(channel, eventData);
          break;
        
        case 'booking.no_show':
          await handleBookingNoShow(channel, eventData);
          break;
      }

      // Log the webhook
      await db.channelSyncLog.create({
        data: {
          connectionId: connections[0].id,
          syncType: 'booking',
          direction: 'inbound',
          status: 'success',
          requestPayload: JSON.stringify(headers),
          responsePayload: JSON.stringify(body),
          correlationId: `webhook-${Date.now()}`,
        },
      });
    }

    return NextResponse.json(result.response);
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET /api/ota/webhooks/[channel] - Webhook verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Handle verification challenges from different OTAs
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token && challenge) {
    // Verify the token matches our expected token
    const expectedToken = process.env[`${channel.toUpperCase()}_VERIFY_TOKEN`];
    if (expectedToken && token === expectedToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  // Return webhook URL info
  const webhookUrl = `/api/ota/webhooks/${channel}`;
  return NextResponse.json({
    channel,
    webhookUrl,
    message: 'Webhook endpoint active',
  });
}

// Webhook event handlers
async function handleBookingCreated(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;
  const guestData = eventData.guest as Record<string, unknown> | undefined;

  // Check for existing booking
  const existingBooking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (existingBooking) return;

  // Find or create guest
  let guestId: string | null = null;
  if (guestData?.email) {
    let guest = await db.guest.findFirst({
      where: {
        tenantId: connection.tenantId,
        email: guestData.email as string,
      },
    });

    if (!guest) {
      guest = await db.guest.create({
        data: {
          tenantId: connection.tenantId,
          firstName: (guestData.firstName as string) || 'Unknown',
          lastName: (guestData.lastName as string) || 'Guest',
          email: guestData.email as string,
          phone: guestData.phone as string | undefined,
          nationality: guestData.country as string | undefined,
          source: channel,
        },
      });
    }
    guestId = guest.id;
  }

  // Bug Fix #10: Actually create a booking record after guest creation.
  // Previously the function only created a guest and returned without
  // creating a booking, causing all incoming webhook bookings to be lost.
  if (!guestId) {
    console.error(`[Webhook] Cannot create booking ${reservationId}: no guest email provided`);
    return;
  }

  // Extract dates and pricing from the event payload
  const dates = eventData.dates as Record<string, string> | undefined;
  const pricing = eventData.pricing as Record<string, number> | undefined;
  const guests = eventData.guests as Record<string, number> | undefined;
  const room = eventData.room as Record<string, string> | undefined;

  // Look up room type mapping
  const mapping = await db.channelMapping.findFirst({
    where: {
      connectionId: connection.id,
      externalRoomId: room?.externalRoomId || room?.roomTypeId || '',
    },
    include: {
      connection: { select: { propertyId: true } },
    },
  });

  await db.booking.create({
    data: {
      tenantId: connection.tenantId,
      propertyId: mapping?.connection.propertyId || connection.propertyId || '',
      confirmationCode: `OTA-${Date.now().toString(36).toUpperCase()}`,
      externalRef: reservationId,
      primaryGuestId: guestId,
      roomTypeId: mapping?.roomTypeId || '',
      checkIn: dates?.checkIn ? new Date(dates.checkIn) : new Date(),
      checkOut: dates?.checkOut ? new Date(dates.checkOut) : new Date(),
      adults: guests?.adults || 1,
      children: guests?.children || 0,
      roomRate: pricing?.roomRate || pricing?.totalAmount || 0,
      taxes: pricing?.taxes || 0,
      fees: pricing?.fees || 0,
      discount: pricing?.discount || 0,
      totalAmount: pricing?.totalAmount || 0,
      currency: (pricing?.currency as string) || (eventData.currency as string) || 'USD',
      source: channel,
      channelId: connection.id,
      status: 'confirmed',
      specialRequests: eventData.specialRequests as string | undefined,
    },
  });
}

async function handleBookingModified(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) {
    await handleBookingCreated(channel, eventData);
    return;
  }

  // Update booking
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (eventData.checkIn) updateData.checkIn = new Date(eventData.checkIn as string);
  if (eventData.checkOut) updateData.checkOut = new Date(eventData.checkOut as string);
  
  const guests = eventData.guests as Record<string, number> | undefined;
  if (guests?.adults) updateData.adults = guests.adults;
  if (guests?.children) updateData.children = guests.children;

  await db.booking.update({
    where: { id: booking.id },
    data: updateData,
  });
}

async function handleBookingCancelled(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: (eventData.cancellationReason as string) || 'Cancelled via OTA',
      updatedAt: new Date(),
    },
  });
}

async function handleBookingNoShow(channel: string, eventData: Record<string, unknown>): Promise<void> {
  const connection = await db.channelConnection.findFirst({
    where: { channel, status: 'active' },
  });

  if (!connection) return;

  const reservationId = eventData.reservationId as string || eventData.bookingId as string;

  const booking = await db.booking.findFirst({
    where: {
      tenantId: connection.tenantId,
      externalRef: reservationId,
    },
  });

  if (!booking) return;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'no_show',
      updatedAt: new Date(),
    },
  });
}

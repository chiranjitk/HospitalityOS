import { NextRequest, NextResponse } from 'next/server';
import { hardwareRegistry } from '@/lib/hardware';

interface RouteContext {
  params: Promise<{ providerId: string }>;
}

// ---------------------------------------------------------------------------
// POST — Webhook receiver for vendor callbacks
//
// All vendors POST here: /api/hardware/webhooks/salto-ks,
// /api/hardware/webhooks/stripe-terminal, etc.
//
// We read the raw body as text (not JSON) because different vendors send
// different content types.  The webhook router handles parsing.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { providerId } = await context.params;

    if (!providerId) {
      return NextResponse.json(
        { acknowledged: false, error: 'providerId is required' },
        { status: 400 },
      );
    }

    // Read raw body as text — do NOT use request.json() since vendors may
    // send non-JSON content types (e.g., application/x-www-form-urlencoded,
    // multipart, etc.)
    const rawBody = await request.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return NextResponse.json(
        { acknowledged: false, error: 'Empty request body' },
        { status: 400 },
      );
    }

    // Extract relevant headers for signature verification.
    // Convert the Next.js Headers object to a plain Record<string, string>
    // so the HAL can work with it generically.
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Dispatch to the webhook router via the registry
    const result = await hardwareRegistry.dispatchWebhook(providerId, rawBody, headers);

    // Always return 200 so the vendor considers the webhook delivered.
    // Individual processing errors are logged internally.
    return NextResponse.json({
      acknowledged: result.acknowledged,
      processedEvents: result.processedEvents,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error('[HAL:API] Error processing hardware webhook:', error);
    // Still return 200 to prevent vendor retry storms
    return NextResponse.json(
      {
        acknowledged: false,
        processedEvents: 0,
        error: 'Internal processing error',
      },
      { status: 200 },
    );
  }
}

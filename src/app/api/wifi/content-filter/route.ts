import { NextResponse } from 'next/server';

/**
 * DEPRECATED — This endpoint is no longer active.
 *
 * Use /api/wifi/firewall/content-filter instead:
 *   GET    /api/wifi/firewall/content-filter          — List filters
 *   POST   /api/wifi/firewall/content-filter          — Create filter
 *   GET    /api/wifi/firewall/content-filter/:id      — Get filter
 *   PUT    /api/wifi/firewall/content-filter/:id      — Update filter
 *   DELETE /api/wifi/firewall/content-filter/:id      — Delete filter
 *   POST   /api/wifi/firewall/content-filter/bulk     — Bulk import
 *   POST   /api/wifi/firewall/content-filter/sync     — Sync config
 *   GET    /api/wifi/firewall/content-filter/categories — List categories
 */

function deprecatedResponse(message: string) {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'DEPRECATED', message },
    },
    { status: 410 },
  );
}

export async function GET() {
  return deprecatedResponse('This endpoint is deprecated. Use /api/wifi/firewall/content-filter instead.');
}

export async function POST() {
  return deprecatedResponse('This endpoint is deprecated. Use /api/wifi/firewall/content-filter instead.');
}

export async function PUT() {
  return deprecatedResponse('This endpoint is deprecated. Use /api/wifi/firewall/content-filter/:id with PUT instead.');
}

export async function DELETE() {
  return deprecatedResponse('This endpoint is deprecated. Use /api/wifi/firewall/content-filter/:id with DELETE instead.');
}

import { NextRequest, NextResponse } from 'next/server';

const DHCP_SERVICE_URL = 'http://127.0.0.1:3011';

/**
 * Catch-all proxy route for DHCP service (dnsmasq backend).
 * Routes /api/kea/* → dhcp-service on port 3011/api/*
 *
 * Note: The /api/kea/ path prefix is kept for backward compatibility
 * with the existing DHCP management UI (dhcp-page.tsx).
 * The dhcp-service (dnsmasq) replaced the old Kea DHCP4 service.
 *
 * Examples:
 *   GET  /api/kea/status       → http://127.0.0.1:3011/api/status
 *   GET  /api/kea/subnets      → http://127.0.0.1:3011/api/subnets
 *   POST /api/kea/subnets      → http://127.0.0.1:3011/api/subnets
 *   GET  /api/kea/reservations → http://127.0.0.1:3011/api/reservations
 *   GET  /api/kea/leases       → http://127.0.0.1:3011/api/leases
 *   POST /api/kea/service/start → http://127.0.0.1:3011/api/service/start
 */
async function proxyRequest(request: NextRequest, method: string) {
  try {
    const pathSegments = request.nextUrl.pathname
      .replace('/api/kea/', '')
      .replace('/api/kea', '');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${DHCP_SERVICE_URL}/api/${pathSegments}${searchParams ? '?' + searchParams : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(8000), // 8s timeout
    };

    // Include body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON — that's okay for some endpoints
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const isConnectionError = error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('abort');

    if (isConnectionError || isTimeout) {
      console.warn('[DHCP Proxy] DHCP service unavailable at', DHCP_SERVICE_URL);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'DHCP service is not running. Start it with: cd mini-services/dhcp-service && bun run dev',
            hint: 'OS network data is available at /api/network/os without dhcp-service',
          },
        },
        { status: 503 }
      );
    }

    console.error('[DHCP Proxy] Error:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: `Failed to reach DHCP service: ${error.message}` } },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}

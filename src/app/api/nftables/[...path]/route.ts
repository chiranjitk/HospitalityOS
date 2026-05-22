import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';

const NFTABLES_SERVICE_PORT = 3013;
const NFTABLES_SERVICE_HOST = `http://127.0.0.1:${NFTABLES_SERVICE_PORT}`;

/**
 * Path mapping: frontend API names → nftables-service route names.
 *
 * The frontend uses descriptive names (gui-rules, chain-architecture, flush-gui)
 * while the nftables-service uses shorter names (rules, chains, flush).
 * This proxy translates between the two.
 */
const PATH_ALIASES: Record<string, string> = {
  'gui-rules': 'rules',
  'chain-architecture': 'chains',
  'flush-gui': 'flush',
};

/**
 * Regex to detect toggle requests: `/:resource/:id/toggle`
 * e.g. /gui-rules/abc-123/toggle, /port-forwards/def-456/toggle
 */
const TOGGLE_RE = /^(gui-rules|port-forwards|rate-limits)\/([^/]+)\/toggle$/;

/**
 * Catch-all proxy route for nftables firewall service.
 * Forwards requests from /api/nftables/* to http://localhost:3013/api/*
 *
 * Path translations applied:
 *   gui-rules       → rules          (GUI firewall rules CRUD)
 *   chain-architecture → chains      (chain architecture data)
 *   flush-gui       → flush          (flush GUI chains)
 *   :resource/:id/toggle → :mapped-resource/:id  (PATCH → PUT with body)
 */
async function proxyRequest(request: NextRequest, method: string) {
  try {
    // Extract the path after /api/nftables/
    let pathSegments = request.nextUrl.pathname
      .replace('/api/nftables/', '')
      .replace('/api/nftables', '');

    let effectiveMethod = method;
    let body: Record<string, unknown> | undefined;

    // ── Handle toggle: PATCH /gui-rules/:id/toggle → PUT /rules/:id ──
    const toggleMatch = pathSegments.match(TOGGLE_RE);
    if (toggleMatch && method === 'PATCH') {
      const resourceSegment = toggleMatch[1];
      const id = toggleMatch[2];
      const mappedResource = PATH_ALIASES[resourceSegment] || resourceSegment;
      pathSegments = `${mappedResource}/${id}`;
      effectiveMethod = 'PUT';
      // Read the body (contains `{ enabled: true/false }`) and pass through
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }

    // ── Apply path aliases ──
    const firstSegment = pathSegments.split('/')[0];
    if (PATH_ALIASES[firstSegment]) {
      pathSegments = pathSegments.replace(firstSegment, PATH_ALIASES[firstSegment]);
    }

    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${NFTABLES_SERVICE_HOST}/api/${pathSegments}${searchParams ? '?' + searchParams : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method: effectiveMethod,
      headers,
      signal: AbortSignal.timeout(15000), // 15s timeout (nftables apply can be slow)
    };

    // Include body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(effectiveMethod)) {
      // If body wasn't already read by toggle handler, read it now
      if (body === undefined) {
        try {
          body = await request.json();
        } catch {
          // No body or invalid JSON — that's okay for some endpoints
        }
      }
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Guard against gateway returning HTML error pages instead of JSON
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const bodyText = await response.text().catch(() => '');
      console.error('[nftables Proxy] Non-JSON response:', response.status, ct, bodyText.substring(0, 200), `← ${targetUrl}`);
      return NextResponse.json(
        { success: false, error: { code: 'BAD_GATEWAY', message: `nftables service returned non-JSON response (HTTP ${response.status})` } },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const isConnectionError = error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('abort');

    if (isConnectionError || isTimeout) {
      console.warn('[nftables Proxy] nftables service unavailable at port', NFTABLES_SERVICE_PORT);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'nftables firewall service is not running.',
          },
        },
        { status: 503 }
      );
    }

    console.error('[nftables Proxy] Error:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: `Failed to reach nftables service: ${error.message}` } },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;
  return proxyRequest(request, 'PATCH');
}

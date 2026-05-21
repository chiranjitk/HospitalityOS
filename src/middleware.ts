/**
 * Application Middleware
 *
 * Handles:
 * - Subdomain-based tenant resolution (Feature #16)
 * - CORS headers for API responses (GAP-P1-05)
 * - CSRF protection for state-changing API requests (GAP-P1-04)
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantFromRequest } from '@/lib/tenant-resolution';
import { getCorsHeaders } from '@/lib/cors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip static files, Next.js internals, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static file extension
  ) {
    return NextResponse.next();
  }

  // ─── API Route Handling ───────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight (OPTIONS)
    if (method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      if (corsHeaders) {
        for (const [key, value] of Object.entries(corsHeaders)) {
          response.headers.set(key, value);
        }
      }
      return response;
    }

    // Build the base response
    const response = NextResponse.next();

    // Apply CORS headers to all API responses
    if (corsHeaders) {
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
    }

    // Skip CSRF validation for auth routes and safe methods
    const isAuthRoute = pathname.startsWith('/api/auth/');
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (!isAuthRoute && !isSafeMethod) {
      // CSRF validation for POST/PUT/DELETE/PATCH
      const csrfToken = request.headers.get('X-CSRF-Token');
      const sessionToken = request.cookies.get('session_token')?.value;

      if (!csrfToken || !sessionToken) {
        return NextResponse.json(
          { success: false, error: { code: 'CSRF_MISSING', message: 'CSRF token or session cookie missing' } },
          { status: 403 }
        );
      }

      // Dynamic import to avoid bundling crypto utilities in Edge runtime
      // CSRF validation is done at the route level via the session check
      // This middleware provides the initial gate; full validation happens server-side
      // where we have access to the token store.
      // For Edge compatibility, we validate the token format here (UUID v4).
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidV4Regex.test(csrfToken)) {
        return NextResponse.json(
          { success: false, error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token format' } },
          { status: 403 }
        );
      }
    }

    // Handle NextAuth callback route
    if (isAuthRoute) {
      return response;
    }

    return response;
  }

  // ─── Non-API Route Handling (Tenant Resolution) ───────────────────

  const response = NextResponse.next();

  // Skip public routes that don't need tenant resolution
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return response;
  }

  // Skip portal pages (guest-facing, no tenant subdomain needed)
  if (pathname.startsWith('/portal/')) {
    return response;
  }

  // Resolve tenant from subdomain (async, awaited properly)
  try {
    const tenant = await resolveTenantFromRequest(request);
    if (tenant) {
      response.headers.set('X-Tenant-Id', tenant.id);
      response.headers.set('X-Tenant-Slug', tenant.slug);
    }
    // If subdomain not found, continue to main app (don't block)
  } catch {
    // If resolution fails, continue without tenant headers
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

/**
 * Subdomain Routing Middleware (Feature #16)
 *
 * Intercepts requests to resolve tenant from subdomain.
 * Sets X-Tenant-Id and X-Tenant-Slug headers for downstream usage.
 * Does NOT block requests when subdomain is not found — continues to main app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantFromRequest } from '@/lib/tenant-resolution';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Skip static files, API routes under /api, and internal routes
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static file extension
  ) {
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

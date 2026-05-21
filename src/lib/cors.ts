/**
 * CORS Configuration
 *
 * Manages Cross-Origin Resource Sharing headers for API responses.
 * Reads allowed origins from ALLOWED_ORIGINS env variable (comma-separated).
 * Defaults to same-origin only if not configured.
 */

/**
 * Parse allowed origins from environment.
 * Format: comma-separated list of origins (e.g., "https://app.example.com,https://admin.example.com")
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins || envOrigins.trim() === '') {
    return [];
  }

  return envOrigins
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);
}

/**
 * Get CORS headers for a given request origin.
 *
 * @param origin - The Origin header from the request
 * @returns Object with appropriate CORS headers, or null if origin is not allowed
 */
export function getCorsHeaders(origin: string): Record<string, string> | null {
  const allowedOrigins = getAllowedOrigins();

  // If no origins configured, only allow same-origin (no Origin header or matching)
  if (allowedOrigins.length === 0) {
    return null; // Same-origin only — no CORS headers needed
  }

  // Check if the origin is allowed
  const isAllowed = allowedOrigins.some(
    allowed => allowed === origin || allowed === '*'
  );

  if (!isAllowed) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Tenant-Id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 *
 * @param origin - The Origin header from the request
 * @returns Headers object for the preflight response, or null if not allowed
 */
export function handlePreflight(origin: string): Record<string, string> | null {
  return getCorsHeaders(origin);
}

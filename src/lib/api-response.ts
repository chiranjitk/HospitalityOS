/**
 * Standardized API Response Helpers
 *
 * Provides consistent response format for all API routes.
 * Usage: import { apiSuccess, apiError } from '@/lib/api-response';
 */

import { NextResponse } from 'next/server';

type ApiError = string | { code: string; message: string; details?: Record<string, unknown> };

/**
 * Return a successful API response.
 *
 * @param data - The response data payload
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standardized success format
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Return an error API response.
 *
 * @param error - Error message string or structured error object
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with standardized error format
 */
export function apiError(error: ApiError, status = 500) {
  const formatted =
    typeof error === 'string'
      ? { success: false, error: { code: 'ERROR', message: error } }
      : { success: false, error };
  return NextResponse.json(formatted, { status });
}

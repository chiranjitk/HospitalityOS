import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/api-docs/openapi-spec';

/**
 * OpenAPI Specification JSON Endpoint
 * Serves the complete OpenAPI 3.0 specification for StaySuite API
 */

export async function GET() {
  try {
    return NextResponse.json(openApiSpec, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[OpenAPI Spec] GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

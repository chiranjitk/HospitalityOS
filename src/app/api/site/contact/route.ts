/**
 * Public Contact Form API Route
 * Accepts contact form submissions from the public-facing hotel website.
 * No authentication required — this is the public-facing endpoint.
 *
 * Stores inquiries as Lead records in the CRM pipeline.
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContactRequestBody {
  websiteId: string;
  propertyId: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// POST /api/site/contact
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Parse & validate request body ----
    let body: ContactRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      );
    }

    const { websiteId, propertyId, name, email, message } = body;

    // Required fields
    if (!websiteId || typeof websiteId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'websiteId is required.' } },
        { status: 400 },
      );
    }
    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required.' } },
        { status: 400 },
      );
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required (min 2 characters).' } },
        { status: 400 },
      );
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' } },
        { status: 400 },
      );
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'message is required (min 5 characters).' } },
        { status: 400 },
      );
    }

    // Clamp message length
    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'message must not exceed 5000 characters.' } },
        { status: 400 },
      );
    }

    // ---- 2. Look up website and verify it is published ----
    const website = await db.hotelWebsite.findUnique({
      where: { id: websiteId },
    });

    if (!website) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Website not found.' } },
        { status: 404 },
      );
    }

    if (website.status !== 'published') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Website is not published.' } },
        { status: 404 },
      );
    }

    // Verify the website belongs to the provided property
    if (website.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Website does not match the provided property.' } },
        { status: 400 },
      );
    }

    // ---- 3. Build notes with optional subject ----
    const parts: string[] = [];
    if (body.subject && body.subject.trim()) {
      parts.push(`Subject: ${body.subject.trim()}`);
    }
    parts.push(message.trim());
    const notes = parts.join('\n\n');

    // ---- 4. Store inquiry as a Lead record ----
    const lead = await db.lead.create({
      data: {
        tenantId: website.tenantId,
        propertyId,
        source: 'website',
        type: 'general',
        status: 'new',
        priority: 'warm',
        contactName: name.trim(),
        contactEmail: email.trim().toLowerCase(),
        contactPhone: body.phone?.trim() || '',
        notes,
      },
    });

    // ---- 5. Return success response ----
    return NextResponse.json(
      {
        success: true,
        data: {
          leadId: lead.id,
          status: lead.status,
          message: 'Your inquiry has been submitted successfully. We will get back to you soon.',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/site/contact] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again later.' } },
      { status: 500 },
    );
  }
}

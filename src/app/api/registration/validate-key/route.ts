/**
 * POST /api/registration/validate-key
 * Validates a license key and returns the associated plan details.
 * This is a PUBLIC endpoint (no auth required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'License key is required' },
        { status: 400 },
      );
    }

    // Look up the license key
    const licenseKey = await db.licenseKey.findUnique({
      where: { key: key.trim().toUpperCase() },
      include: {
        plan: true,
      },
    });

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid license key' },
        { status: 404 },
      );
    }

    // Check if already activated
    if (licenseKey.status === 'activated') {
      return NextResponse.json(
        { success: false, error: 'This license key has already been activated' },
        { status: 410 },
      );
    }

    // Check if expired
    if (licenseKey.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'This license key has expired' },
        { status: 410 },
      );
    }

    // Check if revoked
    if (licenseKey.status === 'revoked') {
      return NextResponse.json(
        { success: false, error: 'This license key has been revoked' },
        { status: 403 },
      );
    }

    // Check expiration date
    if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      // Auto-expire the key
      await db.licenseKey.update({
        where: { id: licenseKey.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { success: false, error: 'This license key has expired' },
        { status: 410 },
      );
    }

    // Parse features from the plan
    let features: string[] = [];
    if (licenseKey.plan.features) {
      try {
        const parsed = JSON.parse(licenseKey.plan.features);
        features = Array.isArray(parsed) ? parsed : [];
      } catch {
        features = [];
      }
    }

    // Return plan details
    return NextResponse.json({
      success: true,
      licenseKeyId: licenseKey.id,
      plan: {
        id: licenseKey.plan.id,
        name: licenseKey.plan.name,
        displayName: licenseKey.plan.displayName,
        description: licenseKey.plan.description,
        price: licenseKey.plan.price,
        currency: licenseKey.plan.currency,
        maxProperties: licenseKey.plan.maxProperties,
        maxRoomsPerProperty: licenseKey.plan.maxRoomsPerProperty,
        maxUsers: licenseKey.plan.maxUsers,
        maxStaff: licenseKey.plan.maxStaff,
        features,
        trialDays: licenseKey.plan.trialDays,
      },
    });
  } catch (error) {
    console.error('[Registration] Error validating license key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate license key' },
      { status: 500 },
    );
  }
}

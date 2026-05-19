/**
 * WiFi Partner Validate API (Public endpoint)
 *
 * POST — Validate promo code from captive portal
 *
 * This is called from the captive portal when a guest enters a promo code.
 * Flow:
 *   1. Find active partner with promo_code auth method matching the code
 *   2. Check daily auth limit
 *   3. Create WiFiPartnerAuth record
 *   4. Return validation result with session parameters
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/wifi/partners/validate — Validate promo code (public)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, propertyId, macAddress, sessionId } = body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { valid: false, reason: 'Promo code is required' },
        { status: 400 },
      );
    }

    // Find active partner with promo_code auth method
    // The code is matched against the partner name (or config.promoCode)
    // We search across all tenants since this is a public endpoint
    const partners = await db.wiFiPartner.findMany({
      where: {
        status: 'active',
        authMethod: 'promo_code',
      },
    });

    // Match code against partner name or config.promoCode
    const matchedPartner = partners.find((p) => {
      try {
        const config = JSON.parse(p.config || '{}');
        const promoCode = config.promoCode || config.promo_code;
        return (
          p.name.toLowerCase() === code.trim().toLowerCase() ||
          (promoCode && promoCode.toLowerCase() === code.trim().toLowerCase())
        );
      } catch {
        return p.name.toLowerCase() === code.trim().toLowerCase();
      }
    });

    if (!matchedPartner) {
      return NextResponse.json({
        valid: false,
        reason: 'Invalid promo code. No active partner found for this code.',
      });
    }

    // Check daily auth limit
    if (matchedPartner.maxDailyAuths && matchedPartner.maxDailyAuths > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayAuthCount = await db.wiFiPartnerAuth.count({
        where: {
          partnerId: matchedPartner.id,
          tenantId: matchedPartner.tenantId,
          createdAt: { gte: todayStart },
        },
      });

      if (todayAuthCount >= matchedPartner.maxDailyAuths) {
        return NextResponse.json({
          valid: false,
          reason: 'Daily auth limit reached for this partner. Please try again tomorrow.',
        });
      }
    }

    // Parse config for session parameters
    let sessionDuration = 3600; // default 1 hour
    let bandwidthLimit = null;
    try {
      const config = JSON.parse(matchedPartner.config || '{}');
      if (config.sessionDuration) sessionDuration = config.sessionDuration;
      if (config.bandwidthLimit) bandwidthLimit = config.bandwidthLimit;
    } catch {
      // Use defaults
    }

    // Create WiFiPartnerAuth record
    const partnerAuth = await db.wiFiPartnerAuth.create({
      data: {
        tenantId: matchedPartner.tenantId,
        partnerId: matchedPartner.id,
        sessionId: sessionId || null,
        username: `partner_${matchedPartner.id.slice(0, 8)}`,
        partnerRef: code.trim(),
        partnerTier: null,
        costToPartner: matchedPartner.costPerAuth,
        commission: matchedPartner.commission,
        ipAddress: macAddress || null, // Use macAddress as fallback for IP if not available
      },
    });

    // Update partner counters
    await db.wiFiPartner.update({
      where: { id: matchedPartner.id },
      data: {
        activeAuths: { increment: 1 },
        totalAuths: { increment: 1 },
        totalRevenue: { increment: matchedPartner.costPerAuth },
      },
    });

    return NextResponse.json({
      valid: true,
      partnerId: matchedPartner.id,
      partnerName: matchedPartner.name,
      authId: partnerAuth.id,
      sessionDuration,
      bandwidthLimit,
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    return NextResponse.json(
      { valid: false, reason: 'Internal server error during validation' },
      { status: 500 },
    );
  }
}

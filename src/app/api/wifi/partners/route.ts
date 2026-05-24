/**
 * WiFi Partner API
 *
 * GET  — List partners with pagination, filters (status, partnerType), search
 * POST — Create partner with validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/partners — List partners
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'wifi.manage');
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const partnerType = searchParams.get('partnerType');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId };

    if (status && status !== 'all') where.status = status;
    if (partnerType && partnerType !== 'all') where.partnerType = partnerType;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [partners, total] = await Promise.all([
      db.wiFiPartner.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiPartner.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: partners,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching WiFi partners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partners' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/partners — Create partner
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'wifi.manage');
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { name, description, partnerType, authMethod, costPerAuth, commission, maxDailyAuths, config } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Partner name is required' },
        { status: 400 },
      );
    }

    const validPartnerTypes = ['loyalty', 'airline', 'credit_card', 'corporate'];
    if (partnerType && !validPartnerTypes.includes(partnerType)) {
      return NextResponse.json(
        { success: false, error: `partnerType must be one of: ${validPartnerTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const validAuthMethods = ['promo_code', 'auto_detect', 'deep_link'];
    if (authMethod && !validAuthMethods.includes(authMethod)) {
      return NextResponse.json(
        { success: false, error: `authMethod must be one of: ${validAuthMethods.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate config is valid JSON if provided
    let parsedConfig = '{}';
    if (config) {
      try {
        parsedConfig = typeof config === 'string' ? config : JSON.stringify(config);
        JSON.parse(parsedConfig); // Validate it parses
      } catch {
        return NextResponse.json(
          { success: false, error: 'config must be valid JSON' },
          { status: 400 },
        );
      }
    }

    const partner = await db.wiFiPartner.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        partnerType: partnerType || 'loyalty',
        authMethod: authMethod || 'promo_code',
        costPerAuth: typeof costPerAuth === 'number' ? costPerAuth : 0,
        commission: typeof commission === 'number' ? commission : 0,
        maxDailyAuths: typeof maxDailyAuths === 'number' && maxDailyAuths > 0 ? maxDailyAuths : null,
        config: parsedConfig,
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, data: partner }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi partner:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create partner' },
      { status: 500 },
    );
  }
}

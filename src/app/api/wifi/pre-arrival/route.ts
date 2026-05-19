import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/pre-arrival — List all pre-arrival configs
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const configs = await db.wiFiPreArrivalConfig.findMany({
      where,
      include: {
        property: {
          select: { id: true, name: true, logo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with plan data (no relation in schema, lookup separately)
    const planIds = [...new Set(configs.map((c) => c.planId).filter(Boolean))] as string[];
    let planMap: Record<string, { id: string; name: string; downloadSpeed: number; uploadSpeed: number }> = {};
    if (planIds.length > 0) {
      const plans = await db.wiFiPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true },
      });
      planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    }

    const enrichedConfigs = configs.map((c) => ({
      ...c,
      plan: c.planId ? (planMap[c.planId] ?? null) : null,
    }));

    // Count enabled properties for summary
    const enabledCount = configs.filter((c) => c.enabled).length;
    const totalProperties = configs.length;

    return NextResponse.json({
      success: true,
      data: enrichedConfigs,
      summary: {
        totalProperties,
        enabledProperties: enabledCount,
      },
    });
  } catch (error) {
    console.error('[pre-arrival] Error fetching configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pre-arrival configs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/pre-arrival — Create or upsert a pre-arrival config for a property
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      propertyId,
      enabled = false,
      hoursBeforeArrival = 24,
      sendEmail = true,
      sendSms = true,
      emailTemplateId,
      smsTemplate = 'Your WiFi at {{hotel_name}}: Network: {{ssid}}, Username: {{username}}, Password: {{password}}',
      includeQrCode = true,
      autoGenerateCreds = true,
      planId,
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    // Validate hoursBeforeArrival
    const validHours = [6, 12, 24, 48];
    if (!validHours.includes(hoursBeforeArrival)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'hoursBeforeArrival must be 6, 12, 24, or 48' } },
        { status: 400 },
      );
    }

    // Validate at least one channel is enabled
    if (!sendEmail && !sendSms) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one delivery channel (email or SMS) must be enabled' } },
        { status: 400 },
      );
    }

    // Verify property exists
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // If planId provided, verify it exists
    if (planId) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: planId },
        select: { id: true },
      });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
          { status: 404 },
        );
      }
    }

    // Upsert: unique constraint on [tenantId, propertyId]
    const config = await db.wiFiPreArrivalConfig.upsert({
      where: {
        tenantId_propertyId: {
          tenantId: auth.tenantId,
          propertyId,
        },
      },
      create: {
        tenantId: auth.tenantId,
        propertyId,
        enabled,
        hoursBeforeArrival,
        sendEmail,
        sendSms,
        emailTemplateId: emailTemplateId || null,
        smsTemplate,
        includeQrCode,
        autoGenerateCreds,
        planId: planId || null,
      },
      update: {
        enabled,
        hoursBeforeArrival,
        sendEmail,
        sendSms,
        emailTemplateId: emailTemplateId || null,
        smsTemplate,
        includeQrCode,
        autoGenerateCreds,
        planId: planId || null,
      },
      include: {
        property: {
          select: { id: true, name: true, logo: true },
        },
      },
    });

    // Enrich with plan data (no relation in schema, lookup separately)
    const enrichedConfig = { ...config, plan: null as unknown };
    if (config.planId) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: config.planId },
        select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true },
      });
      enrichedConfig.plan = plan;
    } else {
      enrichedConfig.plan = null;
    }

    return NextResponse.json({ success: true, data: enrichedConfig }, { status: 201 });
  } catch (error) {
    console.error('[pre-arrival] Error creating/updating config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save pre-arrival config' } },
      { status: 500 },
    );
  }
}

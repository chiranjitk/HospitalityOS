import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = 'tenant_01';

// GET /api/wifi/pre-arrival/[id] — Get single config
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const config = await db.wiFiPreArrivalConfig.findUnique({
      where: { id },
      include: {
        property: {
          select: { id: true, name: true, logo: true, city: true, country: true },
        },
        plan: {
          select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true, price: true },
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival config not found' } },
        { status: 404 },
      );
    }

    // Tenant isolation
    if (config.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival config not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[pre-arrival] Error fetching config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pre-arrival config' } },
      { status: 500 },
    );
  }
}

// PATCH /api/wifi/pre-arrival/[id] — Update config settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Verify config exists and belongs to tenant
    const existing = await db.wiFiPreArrivalConfig.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival config not found' } },
        { status: 404 },
      );
    }

    // Validate hoursBeforeArrival if provided
    if (body.hoursBeforeArrival !== undefined) {
      const validHours = [6, 12, 24, 48];
      if (!validHours.includes(body.hoursBeforeArrival)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'hoursBeforeArrival must be 6, 12, 24, or 48' } },
          { status: 400 },
        );
      }
    }

    // Validate at least one channel
    if (body.sendEmail === false && body.sendSms === false) {
      const currentSendEmail = body.sendEmail !== undefined ? body.sendEmail : existing.sendEmail;
      const currentSendSms = body.sendSms !== undefined ? body.sendSms : existing.sendSms;
      if (!currentSendEmail && !currentSendSms) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one delivery channel (email or SMS) must be enabled' } },
          { status: 400 },
        );
      }
    }

    // If planId provided, verify it exists
    if (body.planId) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: body.planId },
        select: { id: true },
      });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
          { status: 404 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.hoursBeforeArrival !== undefined) updateData.hoursBeforeArrival = body.hoursBeforeArrival;
    if (body.sendEmail !== undefined) updateData.sendEmail = body.sendEmail;
    if (body.sendSms !== undefined) updateData.sendSms = body.sendSms;
    if (body.emailTemplateId !== undefined) updateData.emailTemplateId = body.emailTemplateId || null;
    if (body.smsTemplate !== undefined) updateData.smsTemplate = body.smsTemplate;
    if (body.includeQrCode !== undefined) updateData.includeQrCode = body.includeQrCode;
    if (body.autoGenerateCreds !== undefined) updateData.autoGenerateCreds = body.autoGenerateCreds;
    if (body.planId !== undefined) updateData.planId = body.planId || null;

    const config = await db.wiFiPreArrivalConfig.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: { id: true, name: true, logo: true },
        },
        plan: {
          select: { id: true, name: true, downloadSpeed: true, uploadSpeed: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[pre-arrival] Error updating config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update pre-arrival config' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/pre-arrival/[id] — Delete config
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await db.wiFiPreArrivalConfig.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pre-arrival config not found' } },
        { status: 404 },
      );
    }

    await db.wiFiPreArrivalConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Pre-arrival config deleted successfully',
    });
  } catch (error) {
    console.error('[pre-arrival] Error deleting config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete pre-arrival config' } },
      { status: 500 },
    );
  }
}

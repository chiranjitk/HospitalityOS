/**
 * L-29: Energy Optimization Schedule CRUD API
 *
 * GET    /api/iot/energy/schedule   — List energy schedules
 * POST   /api/iot/energy/schedule   — Create a schedule
 * PUT    /api/iot/energy/schedule   — Update a schedule
 * DELETE /api/iot/energy/schedule   — Delete a schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import {
  listSchedulesForProperty,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  VALID_SCHEDULE_TYPES,
  VALID_SCHEDULE_MODES,
  type ScheduleType,
  type ScheduleEntry,
} from '@/lib/iot/energy-scheduler';

// ---------------------------------------------------------------------------
// GET: List energy optimization schedules
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'energy.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const isActive = searchParams.get('isActive');
    const type = searchParams.get('type');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    let schedules = await listSchedulesForProperty(user.tenantId, propertyId);

    // Apply filters
    if (isActive !== null && isActive !== undefined) {
      const activeVal = isActive === 'true';
      schedules = schedules.filter((s) => s.isActive === activeVal);
    }

    if (type && VALID_SCHEDULE_TYPES.includes(type as ScheduleType)) {
      schedules = schedules.filter((s) => s.type === type);
    }

    // Calculate summary stats
    const totalSavings = schedules
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + s.estimatedSavingsPercent, 0);

    const activeCount = schedules.filter((s) => s.isActive).length;

    return NextResponse.json({
      success: true,
      data: {
        schedules,
        total: schedules.length,
        activeCount,
        summary: {
          totalEstimatedSavingsPercent: Math.round(totalSavings * 10) / 10,
          averageSavingsPercent:
            activeCount > 0 ? Math.round((totalSavings / activeCount) * 10) / 10 : 0,
        },
      },
    });
  } catch (error) {
    console.error('[EnergySchedule] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list energy schedules' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST: Create a schedule
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'energy.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      propertyId,
      name,
      type,
      scheduleEntries,
      roomTypeId,
      occupancyOverride,
      isActive,
      estimatedSavingsPercent,
    } = body;

    // Validate required fields
    if (!propertyId || !name || !type) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId, name, and type are required',
          },
        },
        { status: 400 },
      );
    }

    // Validate schedule type
    if (!VALID_SCHEDULE_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid type. Must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate schedule entries
    if (!scheduleEntries || !Array.isArray(scheduleEntries) || scheduleEntries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one schedule entry is required',
          },
        },
        { status: 400 },
      );
    }

    const entryValidation = validateScheduleEntries(scheduleEntries);
    if (!entryValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: entryValidation.error },
        },
        { status: 400 },
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // Create the schedule
    const schedule = await createSchedule(user.tenantId, {
      propertyId,
      name,
      type: type as ScheduleType,
      scheduleEntries,
      roomTypeId: roomTypeId || undefined,
      occupancyOverride: occupancyOverride ?? true,
      isActive: isActive ?? true,
      estimatedSavingsPercent,
    });

    return NextResponse.json(
      { success: true, data: schedule },
      { status: 201 },
    );
  } catch (error) {
    console.error('[EnergySchedule] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create energy schedule' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT: Update a schedule
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'energy.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Schedule id is required' } },
        { status: 400 },
      );
    }

    // Validate type if provided
    if (updates.type && !VALID_SCHEDULE_TYPES.includes(updates.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid type. Must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate schedule entries if provided
    if (updates.scheduleEntries) {
      if (!Array.isArray(updates.scheduleEntries) || updates.scheduleEntries.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'At least one schedule entry is required' },
          },
          { status: 400 },
        );
      }
      const entryValidation = validateScheduleEntries(updates.scheduleEntries);
      if (!entryValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: entryValidation.error },
          },
          { status: 400 },
        );
      }
    }

    // Prevent immutable fields
    const safeUpdates: Record<string, unknown> = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.tenantId;
    delete safeUpdates.createdAt;

    const updated = await updateSchedule(user.tenantId, id, safeUpdates);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[EnergySchedule] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update energy schedule' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: Delete a schedule
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'energy.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Schedule id is required (query param)' } },
        { status: 400 },
      );
    }

    const deleted = await deleteSchedule(user.tenantId, scheduleId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted: true, id: scheduleId });
  } catch (error) {
    console.error('[EnergySchedule] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete energy schedule' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Schedule entry validation
// ---------------------------------------------------------------------------

function validateScheduleEntries(
  entries: ScheduleEntry[],
): { valid: boolean; error?: string } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Validate dayOfWeek
    if (entry.dayOfWeek === undefined || entry.dayOfWeek < 0 || entry.dayOfWeek > 6 || !Number.isInteger(entry.dayOfWeek)) {
      return {
        valid: false,
        error: `Entry ${i}: dayOfWeek must be an integer 0–6 (Sunday=0, Saturday=6)`,
      };
    }

    // Validate startHour
    if (entry.startHour === undefined || entry.startHour < 0 || entry.startHour > 23 || !Number.isInteger(entry.startHour)) {
      return {
        valid: false,
        error: `Entry ${i}: startHour must be an integer 0–23`,
      };
    }

    // Validate endHour
    if (entry.endHour === undefined || entry.endHour < 0 || entry.endHour > 23 || !Number.isInteger(entry.endHour)) {
      return {
        valid: false,
        error: `Entry ${i}: endHour must be an integer 0–23`,
      };
    }

    // Validate mode
    if (!entry.mode || !VALID_SCHEDULE_MODES.includes(entry.mode)) {
      return {
        valid: false,
        error: `Entry ${i}: Invalid mode "${entry.mode}". Must be one of: ${VALID_SCHEDULE_MODES.join(', ')}`,
      };
    }

    // Validate optional targetTemp
    if (entry.targetTemp !== undefined && (entry.targetTemp < 10 || entry.targetTemp > 35)) {
      return {
        valid: false,
        error: `Entry ${i}: targetTemp must be between 10 and 35°C`,
      };
    }

    // Validate optional lightingLevel
    if (entry.lightingLevel !== undefined && (entry.lightingLevel < 0 || entry.lightingLevel > 100)) {
      return {
        valid: false,
        error: `Entry ${i}: lightingLevel must be between 0 and 100`,
      };
    }
  }

  return { valid: true };
}

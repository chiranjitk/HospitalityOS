/**
 * L-28: Occupancy Trigger Rules CRUD API
 *
 * GET    /api/iot/occupancy-triggers        — List rules for a property
 * POST   /api/iot/occupancy-triggers        — Create a new rule
 * PUT    /api/iot/occupancy-triggers        — Update a rule
 * DELETE /api/iot/occupancy-triggers        — Delete a rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import {
  listRulesForProperty,
  createRule,
  updateRule,
  deleteRule,
  VALID_TRIGGER_TYPES,
  VALID_SENSOR_TYPES,
  VALID_ACTION_TYPES,
  VALID_ROOM_STATUSES,
  VALID_TASK_PRIORITIES,
  VALID_THERMOSTAT_MODES,
  VALID_LIGHT_STATES,
  VALID_ENERGY_MODES,
  type OccupancyTriggerAction,
  type TriggerType,
  type SensorType,
} from '@/lib/iot/occupancy-automation';

// ---------------------------------------------------------------------------
// GET: List occupancy-based automation rules for a property
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

    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'devices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const isActive = searchParams.get('isActive');
    const triggerType = searchParams.get('triggerType');

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

    let rules = await listRulesForProperty(user.tenantId, propertyId);

    // Apply filters
    if (isActive !== null && isActive !== undefined) {
      const activeVal = isActive === 'true';
      rules = rules.filter((r) => r.isActive === activeVal);
    }

    if (triggerType && VALID_TRIGGER_TYPES.includes(triggerType as any)) {
      rules = rules.filter((r) => r.triggerType === triggerType);
    }

    return NextResponse.json({
      success: true,
      data: {
        rules,
        total: rules.length,
      },
    });
  } catch (error) {
    console.error('[OccupancyTriggers] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list occupancy triggers' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST: Create an automation rule
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

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'devices.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      propertyId,
      roomId,
      name,
      description,
      triggerType,
      sensorType,
      thresholdValue,
      actions,
      isActive,
      cooldownMinutes,
    } = body;

    // Validate required fields
    if (!propertyId || !name || !triggerType || !sensorType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId, name, triggerType, and sensorType are required',
          },
        },
        { status: 400 },
      );
    }

    // Validate trigger type
    if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid triggerType. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate sensor type
    if (!VALID_SENSOR_TYPES.includes(sensorType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid sensorType. Must be one of: ${VALID_SENSOR_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate threshold for occupancy_threshold trigger type
    if (triggerType === 'occupancy_threshold' && (thresholdValue === undefined || thresholdValue === null)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'thresholdValue is required for occupancy_threshold trigger type',
          },
        },
        { status: 400 },
      );
    }

    if (thresholdValue !== undefined && (thresholdValue < 0 || thresholdValue > 1)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'thresholdValue must be between 0.0 and 1.0 for occupancy triggers',
          },
        },
        { status: 400 },
      );
    }

    // Validate actions
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one action is required' },
        },
        { status: 400 },
      );
    }

    const actionValidation = validateActions(actions);
    if (!actionValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: actionValidation.error },
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

    // Create the rule
    const rule = await createRule(user.tenantId, {
      propertyId,
      roomId: roomId || undefined,
      name,
      description,
      triggerType: triggerType as TriggerType,
      sensorType: sensorType as SensorType,
      thresholdValue,
      actions,
      isActive: isActive ?? true,
      cooldownMinutes: cooldownMinutes ?? 5,
    });

    return NextResponse.json(
      { success: true, data: rule },
      { status: 201 },
    );
  } catch (error) {
    console.error('[OccupancyTriggers] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create occupancy trigger' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT: Update a rule
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

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'devices.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule id is required' } },
        { status: 400 },
      );
    }

    // Validate trigger type if provided
    if (updates.triggerType && !VALID_TRIGGER_TYPES.includes(updates.triggerType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid triggerType. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate sensor type if provided
    if (updates.sensorType && !VALID_SENSOR_TYPES.includes(updates.sensorType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid sensorType. Must be one of: ${VALID_SENSOR_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate actions if provided
    if (updates.actions) {
      if (!Array.isArray(updates.actions) || updates.actions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'At least one action is required' },
          },
          { status: 400 },
        );
      }
      const actionValidation = validateActions(updates.actions);
      if (!actionValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: actionValidation.error },
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

    const updated = await updateRule(user.tenantId, id, safeUpdates);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[OccupancyTriggers] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update occupancy trigger' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: Delete a rule
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

    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'devices.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule id is required (query param)' } },
        { status: 400 },
      );
    }

    const deleted = await deleteRule(user.tenantId, ruleId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted: true, id: ruleId });
  } catch (error) {
    console.error('[OccupancyTriggers] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete occupancy trigger' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Action validation
// ---------------------------------------------------------------------------

function validateActions(
  actions: OccupancyTriggerAction[],
): { valid: boolean; error?: string } {
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    if (!VALID_ACTION_TYPES.includes(action.type)) {
      return {
        valid: false,
        error: `Action ${i}: Invalid type "${action.type}". Must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
      };
    }

    switch (action.type) {
      case 'set_room_status': {
        const status = action.params?.status;
        if (!status || !VALID_ROOM_STATUSES.includes(status as any)) {
          return {
            valid: false,
            error: `Action ${i} (set_room_status): Invalid status. Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
          };
        }
        break;
      }

      case 'create_housekeeping_task': {
        const priority = action.params?.priority;
        if (!priority || !VALID_TASK_PRIORITIES.includes(priority as any)) {
          return {
            valid: false,
            error: `Action ${i} (create_housekeeping_task): Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`,
          };
        }
        break;
      }

      case 'adjust_thermostat': {
        const mode = action.params?.mode;
        if (!mode || !VALID_THERMOSTAT_MODES.includes(mode as any)) {
          return {
            valid: false,
            error: `Action ${i} (adjust_thermostat): Invalid mode. Must be one of: ${VALID_THERMOSTAT_MODES.join(', ')}`,
          };
        }
        if (action.params.temperature !== undefined) {
          if (typeof action.params.temperature !== 'number' || action.params.temperature < 10 || action.params.temperature > 35) {
            return {
              valid: false,
              error: `Action ${i} (adjust_thermostat): Temperature must be between 10 and 35`,
            };
          }
        }
        break;
      }

      case 'toggle_lights': {
        const state = action.params?.state;
        if (!state || !VALID_LIGHT_STATES.includes(state as any)) {
          return {
            valid: false,
            error: `Action ${i} (toggle_lights): Invalid state. Must be one of: ${VALID_LIGHT_STATES.join(', ')}`,
          };
        }
        break;
      }

      case 'send_notification': {
        const message = action.params?.message;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return {
            valid: false,
            error: `Action ${i} (send_notification): A non-empty message is required`,
          };
        }
        break;
      }

      case 'update_energy_mode': {
        const mode = action.params?.mode;
        if (!mode || !VALID_ENERGY_MODES.includes(mode as any)) {
          return {
            valid: false,
            error: `Action ${i} (update_energy_mode): Invalid mode. Must be one of: ${VALID_ENERGY_MODES.join(', ')}`,
          };
        }
        break;
      }
    }
  }

  return { valid: true };
}

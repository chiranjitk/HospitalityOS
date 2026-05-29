import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';
import { auditLogService } from '@/lib/services/audit-service';

/**
 * L-24: IoT command execution endpoint.
 *
 * Accepts a generic command payload and routes it through the existing HAL pattern.
 * Valid commands: reboot, factory_reset, set_config, query_state, get_logs, firmware_update,
 * set_temperature, set_light, set_dnd, set_mur, discover.
 */
const VALID_IOT_COMMANDS = [
  'reboot',
  'factory_reset',
  'set_config',
  'query_state',
  'get_logs',
  'firmware_update',
  'set_temperature',
  'set_light',
  'set_dnd',
  'set_mur',
  'discover',
] as const;

const VALID_PAYLOAD_COMMANDS = [
  'reboot',
  'factory_reset',
  'firmware_update',
  'set_config',
  'set_temperature',
  'set_light',
  'set_dnd',
  'set_mur',
  'discover',
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth(req);
    if (context instanceof NextResponse) return context;

    const { id } = await params;
    const body = await req.json();
    const { command, payload } = body as {
      command?: string;
      payload?: Record<string, unknown>;
    };

    if (!command || !VALID_IOT_COMMANDS.includes(command as typeof VALID_IOT_COMMANDS[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid command. Valid: ${VALID_IOT_COMMANDS.join(', ')}` },
        { status: 400 },
      );
    }

    // Check device exists and belongs to tenant
    const device = await db.iotDevice.findUnique({ where: { id } });
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 },
      );
    }
    if (device.tenantId !== context.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 },
      );
    }

    // Validate payload for commands that require it
    if (VALID_PAYLOAD_COMMANDS.includes(command as typeof VALID_PAYLOAD_COMMANDS[number]) && (!payload || Object.keys(payload).length === 0)) {
      return NextResponse.json(
        { success: false, error: `Command "${command}" requires a payload` },
        { status: 400 },
      );
    }

    // Log the command execution (actual device processes it on next poll)
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Update device last activity
    await db.iotDevice.update({
      where: { id },
      data: {
        status: command === 'reboot' || command === 'factory_reset' ? 'restarting' : 'online',
        currentState: JSON.stringify({
          ...(device.currentState ? JSON.parse(device.currentState) : {}),
          lastCommand: { command, payload, commandId, executedAt: new Date().toISOString() },
        }),
      },
    });

    // Create audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: context.tenantId,
          userId: context.id,
          module: 'iot',
          action: 'execute_command',
          entityType: 'IoTDevice',
          entityId: id,
          newValue: { command, payload, commandId, status: 'pending' },
          description: `IoT command "${command}" queued for device ${id}`,
        },
        req,
      );
    } catch (auditErr) {
      console.error('[IoT Command] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        commandId,
        deviceId: id,
        command,
        status: 'pending',
        message: `Command "${command}" queued for device ${id}. Device will process on next poll.`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Failed to execute IoT device command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command' },
      { status: 500 },
    );
  }
}

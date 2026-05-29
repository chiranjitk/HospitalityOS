import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

/**
 * L-26: POST /api/iot/locks/[id]/command
 *
 * Smart lock command endpoint. Accepts { command, params } and routes
 * through the HAL (Hardware Abstraction Layer) registry.
 *
 * Valid commands: lock, unlock, status, timed_unlock, emergency_unlock
 */

const VALID_LOCK_COMMANDS = ['lock', 'unlock', 'status', 'timed_unlock', 'emergency_unlock'] as const;
type LockCommand = (typeof VALID_LOCK_COMMANDS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAuth(req);
    if (context instanceof NextResponse) return context;

    const { id: lockId } = await params;
    const body = await req.json();
    const { command, params: cmdParams } = body as {
      command?: string;
      params?: Record<string, unknown>;
    };

    // Validate command
    if (!command || !VALID_LOCK_COMMANDS.includes(command as LockCommand)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid command. Valid commands: ${VALID_LOCK_COMMANDS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Verify the IoT device exists and belongs to the tenant
    const device = await db.iotDevice.findUnique({ where: { id: lockId } });
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'IoT lock device not found' },
        { status: 404 },
      );
    }
    if (device.tenantId !== context.tenantId) {
      return NextResponse.json(
        { success: false, error: 'IoT lock device not found' },
        { status: 404 },
      );
    }

    // For 'status' command, return current device state without queuing a command
    if (command === 'status') {
      return NextResponse.json({
        success: true,
        data: {
          lockId,
          command: 'status',
          status: device.status,
          lastSeenAt: device.lastActiveAt ?? device.updatedAt,
          metadata: device.metadata,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Queue the command via audit log (the device polls for pending commands)
    const auditLog = await db.auditLog.create({
      data: {
        action: `iot_lock_command:${command}`,
        entityType: 'IoTDevice',
        entityId: lockId,
        details: {
          command,
          params: cmdParams ?? {},
          deviceId: lockId,
          status: 'pending',
        },
        userId: context.userId,
      },
    });

    // For timed_unlock, validate durationSeconds
    if (command === 'timed_unlock') {
      const duration = cmdParams?.durationSeconds as number | undefined;
      if (!duration || duration <= 0 || duration > 3600) {
        return NextResponse.json(
          { success: false, error: 'durationSeconds must be between 1 and 3600 for timed_unlock' },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        commandId: auditLog.id,
        lockId,
        command,
        params: cmdParams ?? {},
        status: 'pending',
        message: `Lock command '${command}' queued. Device will process on next poll.`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[IoT Locks] Error processing lock command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process lock command' },
      { status: 500 },
    );
  }
}

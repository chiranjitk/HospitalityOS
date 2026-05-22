import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth required ──
    const context = await requireAuth(req);
    if (context instanceof NextResponse) return context;

    const { id } = await params;
    const body = await req.json();
    const { command, payload } = body;

    const validCommands = ['lock', 'unlock', 'set_temperature', 'set_light', 'set_dnd', 'set_mur'];

    if (!command || !validCommands.includes(command)) {
      return NextResponse.json(
        { success: false, error: `Invalid command. Valid: ${validCommands.join(', ')}` },
        { status: 400 }
      );
    }

    // Check device exists
    const device = await db.iotDevice.findUnique({ where: { id } });
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    // Store command in audit log (the actual IoT device would poll for pending commands)
    const auditLog = await db.auditLog.create({
      data: {
        action: `iot_device_command:${command}`,
        entityType: 'IoTDevice',
        entityId: id,
        details: { command, payload, deviceId: id, status: 'pending' },
        userId: body.userId || 'system',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        commandId: auditLog.id,
        deviceId: id,
        command,
        status: 'pending',
        message: `Command '${command}' queued for device ${id}. The device will process it on next poll.`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Failed to send IoT device command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command' },
      { status: 500 }
    );
  }
}

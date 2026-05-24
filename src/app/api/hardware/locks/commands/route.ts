import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { hardwareRegistry } from '@/lib/hardware';
import { logHardwareOperation } from '@/lib/hardware/audit-logger';
import type { LockCommandRequest } from '@/lib/hardware/types';

/** Valid lock commands accepted by this endpoint. */
const VALID_COMMANDS = [
  'lock',
  'unlock',
  'timed_unlock',
  'emergency_unlock',
  'privacy_mode',
] as const;

type ValidCommand = (typeof VALID_COMMANDS)[number];

// ---------------------------------------------------------------------------
// POST — Execute a lock command via HAL
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.locks.command', 'smart_locks.manage'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      propertyId,
      lockId,
      vendorLockId,
      command,
      durationSeconds,
      reason,
    } = body as {
      propertyId?: string;
      lockId?: string;
      vendorLockId?: string;
      command?: string;
      durationSeconds?: number;
      reason?: string;
    };

    // --- Validation ---
    if (!propertyId || !lockId || !command) {
      return NextResponse.json(
        { success: false, error: 'propertyId, lockId, and command are required' },
        { status: 400 },
      );
    }

    if (!VALID_COMMANDS.includes(command as ValidCommand)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid command. Must be one of: ${VALID_COMMANDS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // timed_unlock requires a duration
    if (command === 'timed_unlock' && (!durationSeconds || durationSeconds <= 0)) {
      return NextResponse.json(
        { success: false, error: 'durationSeconds is required for timed_unlock command' },
        { status: 400 },
      );
    }

    // --- Resolve the HardwareAdapter for this property ---
    const adapterConfig = await db.hardwareAdapter.findFirst({
      where: { propertyId, category: 'lock', enabled: true, tenantId: user.tenantId },
    });

    if (!adapterConfig) {
      return NextResponse.json(
        { success: false, error: 'No active lock adapter configured for this property' },
        { status: 404 },
      );
    }

    // --- Build the HAL LockCommandRequest ---
    const correlationId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const halRequest: LockCommandRequest = {
      commandType: command as LockCommandRequest['commandType'],
      lockId,
      vendorLockId,
      correlationId,
      payload: {
        providerId: adapterConfig.providerId,
        durationSeconds,
        reason,
        initiatedBy: user.id,
      },
    };

    // --- Execute via registry ---
    const startMs = Date.now();

    const result = await hardwareRegistry.executeLockCommand(propertyId, halRequest);

    // --- Write audit log (registry logs internally, but we add initiatedBy) ---
    try {
      await logHardwareOperation({
        propertyId,
        tenantId: user.tenantId,
        adapterId: adapterConfig.id,
        providerId: adapterConfig.providerId,
        category: 'lock',
        operation: command,
        targetId: lockId,
        vendorTargetId: vendorLockId,
        success: result.success,
        errorCode: result.error,
        initiatedBy: user.id,
        durationMs: Date.now() - startMs,
        correlationId,
        requestJson: JSON.stringify({ command, durationSeconds, reason }),
        responseJson: result.data ? JSON.stringify(result.data) : undefined,
      });
    } catch (auditErr) {
      // Audit logging failure should not break the response
      console.error('[HAL:API] Audit log write failed:', auditErr);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Lock command failed', data: result.data },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[HAL:API] Error executing lock command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute lock command' },
      { status: 500 },
    );
  }
}

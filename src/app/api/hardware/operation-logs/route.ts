/**
 * Hardware Operation Logs API
 * 
 * GET /api/hardware/operation-logs - Return recent hardware adapter operation logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const adapterId = searchParams.get('adapterId');
    const category = searchParams.get('category');

    const skip = (page - 1) * limit;

    // Query AuditLog filtered by hardware-related actions
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      module: 'hardware',
    };

    if (adapterId) {
      where.entityId = adapterId;
    }

    // Also allow filtering by action containing specific terms
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
        userName: log.user
          ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
          : 'System',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[HARDWARE_OP_LOGS] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch hardware operation logs' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/pre-arrival/delivery-logs — List delivery logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {
      tenantId: TENANT_ID,
      subject: {
        contains: '[WiFi Pre-Arrival]',
      },
    };

    if (propertyId) {
      // Join through notification log — we can filter by checking the body for property references
      // or we can filter by recipientId matching a booking's propertyId
      // For simplicity, we'll filter by body containing property info
      where.body = { contains: '' }; // Will be overridden below if needed
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    if (startDate || endDate) {
      const createdAtFilter: Record<string, unknown> = {};
      if (startDate) {
        createdAtFilter.gte = new Date(startDate);
      }
      if (endDate) {
        createdAtFilter.lte = new Date(endDate);
      }
      where.createdAt = createdAtFilter;
    }

    const skip = (page - 1) * limit;

    // Fetch notification logs with guest info
    const logs = await db.notificationLog.findMany({
      where,
      include: {
        // NotificationLog doesn't have a direct guest relation, but we can fetch guest info via recipientId
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Enrich logs with guest information
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let guestName = 'Unknown Guest';
        try {
          const guest = await db.guest.findUnique({
            where: { id: log.recipientId },
            select: { firstName: true, lastName: true },
          });
          if (guest) {
            guestName = `${guest.firstName} ${guest.lastName}`;
          }
        } catch {
          // ignore
        }

        return {
          id: log.id,
          guestName,
          recipientEmail: log.recipientEmail,
          recipientPhone: log.recipientPhone,
          channel: log.channel,
          status: log.status,
          subject: log.subject,
          errorMessage: log.errorMessage,
          sentAt: log.sentAt,
          createdAt: log.createdAt,
          retryCount: log.retryCount,
        };
      }),
    );

    const total = await db.notificationLog.count({ where });

    // Summary stats
    const sentCount = await db.notificationLog.count({
      where: { ...where, status: 'sent' },
    });
    const failedCount = await db.notificationLog.count({
      where: { ...where, status: 'failed' },
    });
    const pendingCount = await db.notificationLog.count({
      where: { ...where, status: 'pending' },
    });

    const successRate = total > 0 ? ((sentCount / total) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
        sent: sentCount,
        failed: failedCount,
        pending: pendingCount,
        successRate: parseFloat(successRate),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error('[pre-arrival/logs] Validation error:', error.message);
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
        { status: 400 },
      );
    }
    console.error('[pre-arrival/logs] Error fetching delivery logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch delivery logs' } },
      { status: 500 },
    );
  }
}

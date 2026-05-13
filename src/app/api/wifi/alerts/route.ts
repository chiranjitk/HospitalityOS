import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Hardcoded tenant for development ──────────────────────────────────────────
const TENANT_ID = 'tenant_01';

// ─── Valid alert types and severities ──────────────────────────────────────────
const VALID_TYPES = [
  'ap_down',
  'latency',
  'capacity',
  'auth_failure',
  'radius_error',
  'bandwidth_exhaustion',
  'nas_offline',
] as const;

const VALID_SEVERITIES = ['critical', 'warning', 'info'] as const;
const VALID_STATUSES = ['active', 'acknowledged', 'resolved'] as const;

// ─── GET /api/wifi/alerts ─────────────────────────────────────────────────────
// List WiFi alerts with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { tenantId: TENANT_ID };

    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      where.status = status;
    }
    if (severity && VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
      where.severity = severity;
    }
    if (type && VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      where.type = type;
    }
    if (propertyId) {
      where.propertyId = propertyId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    // Fetch alerts with pagination
    const [alerts, total] = await Promise.all([
      db.wiFiAlert.findMany({
        where,
        include: {
          property: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.wiFiAlert.count({ where }),
    ]);

    // Count stats
    const countWhere = { tenantId: TENANT_ID };
    const [activeCount, acknowledgedCount, resolvedCount, criticalCount, warningCount, infoCount] =
      await Promise.all([
        db.wiFiAlert.count({ where: { ...countWhere, status: 'active' } }),
        db.wiFiAlert.count({ where: { ...countWhere, status: 'acknowledged' } }),
        db.wiFiAlert.count({ where: { ...countWhere, status: 'resolved' } }),
        db.wiFiAlert.count({ where: { ...countWhere, severity: 'critical', status: { in: ['active', 'acknowledged'] } } }),
        db.wiFiAlert.count({ where: { ...countWhere, severity: 'warning', status: { in: ['active', 'acknowledged'] } } }),
        db.wiFiAlert.count({ where: { ...countWhere, severity: 'info', status: { in: ['active', 'acknowledged'] } } }),
      ]);

    return NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        active: activeCount,
        acknowledged: acknowledgedCount,
        resolved: resolvedCount,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
      },
    });
  } catch (error: any) {
    console.error('[WiFi Alerts API] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi alerts' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/wifi/alerts ────────────────────────────────────────────────────
// Create a new WiFi alert (for programmatic alert creation from health checks)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, type, severity, title, message, source, metadata } = body;

    // Validate required fields
    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: type, title, message' } },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (severity && !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Create the alert
    const alert = await db.wiFiAlert.create({
      data: {
        tenantId: TENANT_ID,
        propertyId: propertyId || null,
        type,
        severity: severity || 'warning',
        title,
        message,
        source: source || null,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        status: 'active',
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: alert, message: 'Alert created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[WiFi Alerts API] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi alert' } },
      { status: 500 }
    );
  }
}

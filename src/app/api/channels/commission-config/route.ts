import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/commission-config - List commission configs with filtering
// Supports action=summary for per-channel summary
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const isActive = searchParams.get('isActive');
    const action = searchParams.get('action');

    const tenantId = ctx.tenantId;

    // Handle summary action
    if (action === 'summary') {
      const configs = await db.channelCommissionConfig.findMany({
        where: { tenantId },
      });

      // Aggregate per-channel stats using CommissionRecord
      const channelCodes = [...new Set(configs.map(c => c.channelCode))];

      const summaries = channelCodes.map(code => {
        const channelConfigs = configs.filter(c => c.channelCode === code);
        const activeConfigs = channelConfigs.filter(c => c.isActive);
        const avgRate = activeConfigs.length > 0
          ? activeConfigs.reduce((sum, c) => sum + c.baseCommission, 0) / activeConfigs.length
          : 0;

        return {
          channelCode: code,
          totalConfigs: channelConfigs.length,
          activeConfigs: activeConfigs.length,
          avgCommissionRate: Math.round(avgRate * 100) / 100,
        };
      });

      return NextResponse.json({ success: true, data: summaries });
    }

    // Standard list
    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const configs = await db.channelCommissionConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with connection data
    const connectionIds = [...new Set(configs.map(c => c.connectionId))] as string[];
    const connections = connectionIds.length > 0
      ? await db.channelConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, displayName: true, channel: true, status: true },
        })
      : [];

    const connectionMap = new Map(
      connections.map(c => [c.id, { displayName: c.displayName || c.channel, channel: c.channel, status: c.status }])
    );

    // Get commission stats per connection using CommissionRecord
    const recordAgg = await db.commissionRecord.groupBy({
      by: ['channelCode', 'status'],
      where: { tenantId },
      _sum: { commissionAmount: true, bookingAmount: true },
      _count: true,
    });

    const statsMap = new Map<string, { accrued: number; invoiced: number; paid: number; waived: number; totalBookings: number }>();
    for (const row of recordAgg) {
      const key = row.channelCode;
      const existing = statsMap.get(key) || { accrued: 0, invoiced: 0, paid: 0, waived: 0, totalBookings: 0 };
      const amount = row._sum.commissionAmount || 0;
      switch (row.status) {
        case 'accrued': existing.accrued += amount; break;
        case 'invoiced': existing.invoiced += amount; break;
        case 'paid': existing.paid += amount; break;
        case 'waived': existing.waived += amount; break;
      }
      existing.totalBookings += row._count;
      statsMap.set(key, existing);
    }

    const enrichedConfigs = configs.map(config => {
      const conn = connectionMap.get(config.connectionId);
      const stats = statsMap.get(config.channelCode) || { accrued: 0, invoiced: 0, paid: 0, waived: 0, totalBookings: 0 };

      return {
        ...config,
        connectionDisplayName: conn?.displayName || config.channelCode,
        connectionChannel: conn?.channel || config.channelCode,
        connectionStatus: conn?.status || 'unknown',
        totalAccrued: stats.accrued,
        totalInvoiced: stats.invoiced,
        totalPaid: stats.paid,
        totalPending: stats.accrued + stats.invoiced - stats.paid,
      };
    });

    const total = await db.channelCommissionConfig.count({ where });

    return NextResponse.json({
      success: true,
      data: enrichedConfigs,
      pagination: { total },
    });
  } catch (error) {
    console.error('Error fetching commission configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch commission configs' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/commission-config - Create config or perform actions
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { action, ...data } = body;

    // Handle calculate action
    if (action === 'calculate') {
      const { configId, bookingAmount } = body;
      if (!configId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'configId is required' } },
          { status: 400 }
        );
      }
      if (!bookingAmount || bookingAmount < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingAmount must be a positive number' } },
          { status: 400 }
        );
      }

      const config = await db.channelCommissionConfig.findUnique({ where: { id: configId } });
      if (!config) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Commission config not found' } },
          { status: 404 }
        );
      }

      // Calculate commission based on type
      let commissionAmount = 0;
      let breakdown: Record<string, unknown> = {};

      switch (config.commissionType) {
        case 'percentage':
          commissionAmount = bookingAmount * (config.baseCommission / 100);
          breakdown = {
            type: 'percentage',
            rate: config.baseCommission,
            calculation: `${bookingAmount.toFixed(2)} × ${config.baseCommission}% = ${commissionAmount.toFixed(2)}`,
          };
          break;
        case 'fixed_amount':
          commissionAmount = config.baseCommission;
          breakdown = {
            type: 'fixed_amount',
            amount: config.baseCommission,
            calculation: `Fixed commission: ${config.baseCommission.toFixed(2)} ${config.currency}`,
          };
          break;
        case 'tiered':
          // Simple tiered: base commission + a graduated portion
          const basePortion = Math.min(bookingAmount, 500) * (config.baseCommission / 100);
          const tierPortion = Math.max(0, bookingAmount - 500) * (config.baseCommission * 1.5 / 100);
          commissionAmount = basePortion + tierPortion;
          breakdown = {
            type: 'tiered',
            tier1Rate: config.baseCommission,
            tier2Rate: config.baseCommission * 1.5,
            tier1Amount: Math.min(bookingAmount, 500),
            tier2Amount: Math.max(0, bookingAmount - 500),
            tier1Commission: basePortion,
            tier2Commission: tierPortion,
            calculation: `(min(${bookingAmount.toFixed(2)}, 500) × ${config.baseCommission}%) + (max(${bookingAmount.toFixed(2)} - 500, 0) × ${(config.baseCommission * 1.5).toFixed(2)}%) = ${commissionAmount.toFixed(2)}`,
          };
          break;
        default:
          commissionAmount = bookingAmount * (config.baseCommission / 100);
          breakdown = { type: config.commissionType, rate: config.baseCommission };
      }

      // Apply min/max
      let minApplied = false;
      let maxApplied = false;
      if (config.minCommission !== null && commissionAmount < config.minCommission) {
        commissionAmount = config.minCommission;
        minApplied = true;
      }
      if (config.maxCommission !== null && commissionAmount > config.maxCommission) {
        commissionAmount = config.maxCommission;
        maxApplied = true;
      }

      // Calculate VAT
      let vatAmount = 0;
      if (config.vatApplicable && config.vatRate > 0) {
        vatAmount = commissionAmount * (config.vatRate / 100);
      }

      const totalOwed = commissionAmount + vatAmount;
      const netToHotel = bookingAmount - totalOwed;

      return NextResponse.json({
        success: true,
        data: {
          configId: config.id,
          channelCode: config.channelCode,
          bookingAmount,
          commissionAmount: Math.round(commissionAmount * 100) / 100,
          breakdown,
          vatApplicable: config.vatApplicable,
          vatRate: config.vatRate,
          vatAmount: Math.round(vatAmount * 100) / 100,
          totalOwed: Math.round(totalOwed * 100) / 100,
          netToHotel: Math.round(netToHotel * 100) / 100,
          currency: config.currency,
          commissionModel: config.commissionModel,
          minApplied,
          maxApplied,
          includedInRate: config.includedInRate,
        },
      });
    }

    // Handle clone action
    if (action === 'clone') {
      const { sourceConfigId, targetConnectionId, newChannelCode } = body;
      if (!sourceConfigId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'sourceConfigId is required' } },
          { status: 400 }
        );
      }
      if (!targetConnectionId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'targetConnectionId is required' } },
          { status: 400 }
        );
      }

      const source = await db.channelCommissionConfig.findUnique({ where: { id: sourceConfigId } });
      if (!source) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Source config not found' } },
          { status: 404 }
        );
      }

      // Check if target already has a config
      const existing = await db.channelCommissionConfig.findUnique({
        where: { tenantId_connectionId: { tenantId: source.tenantId, connectionId: targetConnectionId } },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: 'Target connection already has a commission config' } },
          { status: 409 }
        );
      }

      // Get target connection channel code
      let targetChannelCode = newChannelCode || source.channelCode;
      if (!newChannelCode) {
        const targetConn = await db.channelConnection.findUnique({
          where: { id: targetConnectionId },
          select: { channel: true },
        });
        if (targetConn) targetChannelCode = targetConn.channel;
      }

      const cloned = await db.channelCommissionConfig.create({
        data: {
          tenantId: source.tenantId,
          propertyId: source.propertyId,
          connectionId: targetConnectionId,
          channelCode: targetChannelCode,
          commissionType: source.commissionType,
          baseCommission: source.baseCommission,
          currency: source.currency,
          commissionModel: source.commissionModel,
          billingCycle: source.billingCycle,
          paymentTerms: source.paymentTerms,
          vatApplicable: source.vatApplicable,
          vatRate: source.vatRate,
          includedInRate: source.includedInRate,
          minCommission: source.minCommission,
          maxCommission: source.maxCommission,
          isActive: true,
        },
      });

      return NextResponse.json({ success: true, data: cloned }, { status: 201 });
    }

    // Default: create new commission config
    const {
      tenantId,
      propertyId,
      connectionId,
      channelCode,
      commissionType,
      baseCommission,
      currency,
      commissionModel,
      billingCycle,
      paymentTerms,
      vatApplicable,
      vatRate,
      includedInRate,
      minCommission,
      maxCommission,
      isActive,
      effectiveFrom,
      effectiveTo,
    } = body;

    // Validate required fields
    if (!tenantId || !connectionId || !channelCode) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId, connectionId, and channelCode are required' } },
        { status: 400 }
      );
    }

    // Validate commission type
    const validTypes = ['percentage', 'fixed_amount', 'tiered'];
    if (commissionType && !validTypes.includes(commissionType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid commissionType. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    const validModels = ['gross', 'net', 'hybrid'];
    if (commissionModel && !validModels.includes(commissionModel)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid commissionModel. Must be one of: ${validModels.join(', ')}` } },
        { status: 400 }
      );
    }

    const validCycles = ['monthly', 'bi_weekly', 'weekly', 'per_booking'];
    if (billingCycle && !validCycles.includes(billingCycle)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid billingCycle. Must be one of: ${validCycles.join(', ')}` } },
        { status: 400 }
      );
    }

    const config = await db.channelCommissionConfig.create({
      data: {
        tenantId,
        propertyId: propertyId || null,
        connectionId,
        channelCode,
        commissionType: commissionType || 'percentage',
        baseCommission: baseCommission !== undefined && baseCommission !== null ? parseFloat(String(baseCommission)) : 0,
        currency: currency || 'USD',
        commissionModel: commissionModel || 'gross',
        billingCycle: billingCycle || 'monthly',
        paymentTerms: paymentTerms !== undefined ? parseInt(String(paymentTerms), 10) : 30,
        vatApplicable: vatApplicable || false,
        vatRate: vatRate !== undefined && vatRate !== null ? parseFloat(String(vatRate)) : 0,
        includedInRate: includedInRate || false,
        minCommission: minCommission !== undefined && minCommission !== null ? parseFloat(String(minCommission)) : null,
        maxCommission: maxCommission !== undefined && maxCommission !== null ? parseFloat(String(maxCommission)) : null,
        isActive: isActive !== undefined ? isActive : true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error) {
    console.error('Error in commission-config POST:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/commission-config - Update a commission config
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelCommissionConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Commission config not found' } },
        { status: 404 }
      );
    }

    const ALLOWED_FIELDS = [
      'channelCode', 'commissionType', 'baseCommission', 'currency', 'commissionModel',
      'billingCycle', 'paymentTerms', 'vatApplicable', 'vatRate', 'includedInRate',
      'minCommission', 'maxCommission', 'isActive', 'effectiveFrom', 'effectiveTo',
      'propertyId',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updates) {
        if (field === 'effectiveFrom' || field === 'effectiveTo') {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else if (field === 'minCommission' || field === 'maxCommission') {
          updateData[field] = updates[field] !== undefined && updates[field] !== null ? parseFloat(String(updates[field])) : null;
        } else if (field === 'baseCommission' || field === 'vatRate') {
          updateData[field] = parseFloat(String(updates[field])) || 0;
        } else if (field === 'paymentTerms') {
          updateData[field] = parseInt(String(updates[field]), 10) || 30;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const config = await db.channelCommissionConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error updating commission config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update commission config' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/commission-config - Delete a commission config
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelCommissionConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Commission config not found' } },
        { status: 404 }
      );
    }

    await db.channelCommissionConfig.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Commission config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting commission config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete commission config' } },
      { status: 500 }
    );
  }
}

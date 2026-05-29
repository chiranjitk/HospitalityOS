/**
 * Housekeeping Task Optimization API
 * 
 * GET: Get optimized task assignments
 * POST: Run optimization algorithm
 * PUT: Apply suggested assignments
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { taskOptimizationService } from '@/lib/services/task-optimization-service';
import { applyHousekeepingRateLimit, rateLimitResponse } from '@/app/api/housekeeping/rate-limit';

// GET /api/housekeeping/optimization - Get optimized task assignments
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }, { status: 401 });
    }

    // Permission check
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view optimization' },
      }, { status: 403 });
    }

    // M-62: Rate limiting
    const rlResult = await applyHousekeepingRateLimit(request, 'optimization_get');
    if (!rlResult.allowed) return rateLimitResponse(rlResult.retryAfter);

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || undefined;
    const excludeAssigned = searchParams.get('excludeAssigned') !== 'false';

    // Use authenticated user's tenant
    const tenantId = user.tenantId;

    // Get existing pending suggestions (without eager-loading all tenant users)
    const existingSuggestions = await db.taskAssignmentSuggestion.findMany({
      where: {
        tenantId,
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
    });

    // If there are valid pending suggestions, return them
    if (existingSuggestions.length > 0) {
      // M-63: Only fetch the specific users referenced by suggestions
      const suggestedUserIds = [...new Set(existingSuggestions.map(s => s.suggestedUserId))];
      const users = await db.user.findMany({
        where: { id: { in: suggestedUserIds }, tenantId },
        select: { id: true, firstName: true, lastName: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      const suggestions = existingSuggestions.map(s => {
        const suggestionUser = userMap.get(s.suggestedUserId);
        return {
          id: s.id,
          taskId: s.taskId,
          score: s.score,
          reason: s.reason,
          factors: JSON.parse(s.factors),
          suggestedUser: suggestionUser ? {
            id: suggestionUser.id,
            name: `${suggestionUser.firstName} ${suggestionUser.lastName}`,
          } : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          suggestions,
          cached: true,
        },
      });
    }

    // Otherwise, compute new optimization
    const result = await taskOptimizationService.getOptimizedAssignments(
      tenantId,
      propertyId,
      { excludeAssigned }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in optimization GET:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get optimized assignments' },
    }, { status: 500 });
  }
}

// POST /api/housekeeping/optimization - Run optimization algorithm
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }, { status: 401 });
    }

    // Permission check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.manage')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to run optimization' },
      }, { status: 403 });
    }

    // M-62: Rate limiting
    const rlPostResult = await applyHousekeepingRateLimit(request, 'optimization_post');
    if (!rlPostResult.allowed) return rateLimitResponse(rlPostResult.retryAfter);

    const body = await request.json();
    const { propertyId } = body;

    // Use authenticated user's tenant
    const tenantId = user.tenantId;

    // Run optimization and store suggestions
    const result = await taskOptimizationService.runOptimization(tenantId, propertyId);

    return NextResponse.json({
      success: true,
      data: {
        suggestionsCreated: result.suggestionsCreated,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    console.error('Error in optimization POST:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to run optimization' },
    }, { status: 500 });
  }
}

// PUT /api/housekeeping/optimization - Apply suggested assignments
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }, { status: 401 });
    }

    // Permission check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.manage')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to apply suggestions' },
      }, { status: 403 });
    }

    // M-62: Rate limiting
    const rlPutResult = await applyHousekeepingRateLimit(request, 'optimization_put');
    if (!rlPutResult.allowed) return rateLimitResponse(rlPutResult.retryAfter);

    const body = await request.json();
    const { suggestionIds, applyAll } = body;

    // Use authenticated user's tenant
    const tenantId = user.tenantId;

    // Apply suggestions
    const result = await taskOptimizationService.applySuggestions(
      tenantId,
      applyAll ? undefined : suggestionIds
    );

    return NextResponse.json({
      success: true,
      data: {
        applied: result.applied,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Error in optimization PUT:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to apply suggestions' },
    }, { status: 500 });
  }
}

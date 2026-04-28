import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experiences — List experiences with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'experiences.view') && !hasPermission(user, 'experience.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const category = sp.get('category');
    const status = sp.get('status');
    const search = sp.get('search');
    const rawPage = sp.get('page');
    const rawLimit = sp.get('limit');

    const page = Math.max(1, parseInt(rawPage || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit || '50') || 50));
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search } },
      ];
    }

    // Parallel queries
    const [data, total, statusCounts, totalRevenueResult, avgRatingResult] = await Promise.all([
      db.experience.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      db.experience.count({ where }),
      db.experience.groupBy({
        by: ['status'],
        where: { tenantId: user.tenantId, deletedAt: null },
        _count: { id: true },
      }),
      db.experience.aggregate({
        where: { tenantId: user.tenantId, deletedAt: null, status: 'active' },
        _sum: { basePrice: true },
      }),
      db.experience.aggregate({
        where: { tenantId: user.tenantId, deletedAt: null, rating: { gt: 0 } },
        _avg: { rating: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => {
      statusMap[s.status] = s._count.id;
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
      },
      stats: {
        total,
        active: statusMap['active'] || 0,
        totalRevenue: totalRevenueResult._sum.basePrice || 0,
        avgRating: avgRatingResult._avg.rating || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch experiences' } },
      { status: 500 },
    );
  }
}

// POST /api/experiences — Create a new experience
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'experiences.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      categoryId,
      category,
      duration,
      maxParticipants,
      basePrice,
      imageUrl,
      status,
      tags,
      highlights,
      whatToBring,
      cancellationPolicy,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 },
      );
    }

    if (duration !== undefined && (typeof duration !== 'number' || duration <= 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Duration must be greater than 0' } },
        { status: 400 },
      );
    }

    if (basePrice !== undefined && (typeof basePrice !== 'number' || basePrice < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Base price must be 0 or greater' } },
        { status: 400 },
      );
    }

    // Build tags data
    let tagsData = tags;
    if (tags && typeof tags === 'string') {
      tagsData = JSON.stringify(tags.split(',').map((t: string) => t.trim()).filter(Boolean));
    } else if (Array.isArray(tags)) {
      tagsData = JSON.stringify(tags);
    }

    // Build highlights data
    let highlightsData = highlights;
    if (highlights && typeof highlights === 'string') {
      highlightsData = JSON.stringify(highlights.split('\n').map((h: string) => h.trim()).filter(Boolean));
    } else if (Array.isArray(highlights)) {
      highlightsData = JSON.stringify(highlights);
    }

    // Build whatToBring data
    let whatToBringData = whatToBring;
    if (whatToBring && typeof whatToBring === 'string') {
      whatToBringData = JSON.stringify(whatToBring.split('\n').map((w: string) => w.trim()).filter(Boolean));
    } else if (Array.isArray(whatToBring)) {
      whatToBringData = JSON.stringify(whatToBring);
    }

    const experience = await db.experience.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        description: description || null,
        categoryId: categoryId || null,
        category: category || null,
        duration: typeof duration === 'number' ? duration : 60,
        maxParticipants: typeof maxParticipants === 'number' ? maxParticipants : 10,
        basePrice: typeof basePrice === 'number' ? basePrice : 0,
        imageUrl: imageUrl || null,
        status: status || 'active',
        tags: tagsData || null,
        highlights: highlightsData || null,
        whatToBring: whatToBringData || null,
        cancellationPolicy: cancellationPolicy || null,
      },
    });

    return NextResponse.json({ success: true, data: experience }, { status: 201 });
  } catch (error) {
    console.error('Error creating experience:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create experience' } },
      { status: 500 },
    );
  }
}

// PUT /api/experiences — Update an experience
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'experiences.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Experience ID is required' } },
        { status: 400 },
      );
    }

    // Validate ownership
    const existing = await db.experience.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 },
      );
    }

    // Validate name
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
          { status: 400 },
        );
      }
      data.name = data.name.trim();
    }

    // Validate duration
    if (data.duration !== undefined) {
      if (typeof data.duration !== 'number' || data.duration <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Duration must be greater than 0' } },
          { status: 400 },
        );
      }
    }

    // Validate basePrice
    if (data.basePrice !== undefined) {
      if (typeof data.basePrice !== 'number' || data.basePrice < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Base price must be 0 or greater' } },
          { status: 400 },
        );
      }
    }

    // Process list fields — convert string to JSON
    if (data.tags !== undefined && typeof data.tags === 'string') {
      data.tags = JSON.stringify(data.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
    }
    if (data.highlights !== undefined && typeof data.highlights === 'string') {
      data.highlights = JSON.stringify(data.highlights.split('\n').map((h: string) => h.trim()).filter(Boolean));
    }
    if (data.whatToBring !== undefined && typeof data.whatToBring === 'string') {
      data.whatToBring = JSON.stringify(data.whatToBring.split('\n').map((w: string) => w.trim()).filter(Boolean));
    }

    const updated = await db.experience.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating experience:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update experience' } },
      { status: 500 },
    );
  }
}

// DELETE /api/experiences — Soft delete (archive) an experience
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'experiences.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Experience ID is required' } },
        { status: 400 },
      );
    }

    // Validate ownership
    const existing = await db.experience.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Experience not found' } },
        { status: 404 },
      );
    }

    // Check for active bookings if status is active
    if (existing.status === 'active' && existing.totalBookings > 0) {
      // Count active bookings
      const activeBookings = await db.experienceBooking.count({
        where: {
          experienceId: id,
          status: { in: ['pending', 'confirmed'] },
        },
      });

      if (activeBookings > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ACTIVE_BOOKINGS',
              message: `Cannot delete experience with ${activeBookings} active booking(s). Please cancel the bookings or set the experience to inactive first.`,
            },
          },
          { status: 400 },
        );
      }
    }

    // Soft delete — set deletedAt and archive status
    const archived = await db.experience.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'archived',
      },
    });

    return NextResponse.json({ success: true, data: archived });
  } catch (error) {
    console.error('Error deleting experience:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete experience' } },
      { status: 500 },
    );
  }
}

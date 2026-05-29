import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { subDays, getDay, getMonth } from 'date-fns';
import ZAI from 'z-ai-web-dev-sdk';

// GET /api/revenue/ai-suggestions - Get AI revenue suggestions
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    // Get recent booking trends (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentBookings = await db.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        roomType: { select: { name: true, id: true } },
      },
    });

    // Get rooms for occupancy calculation - filter by tenant via property IDs
    const tenantProperties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const tenantPropertyIds = tenantProperties.map(p => p.id);

    const rooms = await db.room.findMany({
      where: {
        propertyId: { in: tenantPropertyIds },
        deletedAt: null,
      },
      select: { status: true, roomTypeId: true },
    });

    const totalRooms = rooms.length || 1;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const currentOccupancyRate = occupiedRooms / totalRooms;

    // Get rate plans for pricing analysis
    const ratePlans = await db.ratePlan.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomType: { select: { name: true, id: true } },
      },
    });

    // Get pricing rules
    const pricingRules = await db.pricingRule.findMany({
      where: { tenantId, isActive: true },
    });

    // Get existing AI suggestions from database
    const existingSuggestions = await db.aISuggestion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build a summary context for AI
    const avgRate = ratePlans.length > 0
      ? ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length
      : 0;
    const totalRevenue = recentBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const contextSummary = {
      totalRooms,
      occupiedRooms,
      currentOccupancyRate: Math.round(currentOccupancyRate * 100),
      totalBookings30d: recentBookings.length,
      avgRate,
      totalRevenue30d: totalRevenue,
      ratePlanCount: ratePlans.length,
      activePricingRules: pricingRules.length,
      roomTypes: ratePlans.map(rp => ({
        name: rp.roomType?.name || 'Unknown',
        basePrice: rp.basePrice,
      })),
      bookingSources: recentBookings.reduce<Record<string, number>>((acc, b) => {
        const src = b.source || 'direct';
        acc[src] = (acc[src] || 0) + 1;
        return acc;
      }, {}),
    };

    // ── Try AI-enhanced suggestions first ──
    let aiSuggestions: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      impact: string;
      potentialRevenue: number;
      confidence: number;
      status: string;
      createdAt: string;
    }> = [];
    let isAIEnhanced = false;

    try {
      const zai = await ZAI.create();

      const aiPrompt = `You are a hotel revenue management AI advisor. Analyze the following data and generate 3-5 specific, actionable revenue optimization suggestions.

Data:
- Total Rooms: ${contextSummary.totalRooms}
- Current Occupancy: ${contextSummary.currentOccupancyRate}%
- Bookings (30d): ${contextSummary.totalBookings30d}
- Average Rate: $${contextSummary.avgRate.toFixed(2)}
- Revenue (30d): $${contextSummary.totalRevenue30d.toFixed(2)}
- Rate Plans: ${contextSummary.ratePlanCount}
- Active Pricing Rules: ${contextSummary.activePricingRules}
- Room Types: ${JSON.stringify(contextSummary.roomTypes)}
- Booking Sources: ${JSON.stringify(contextSummary.bookingSources)}

Return ONLY a JSON array of suggestions with this exact shape:
[{
  "type": "pricing" | "marketing" | "revenue" | "operations",
  "title": "Brief title (max 60 chars)",
  "description": "Detailed explanation with specific numbers",
  "impact": "high" | "medium" | "low",
  "potentialRevenue": number (estimated monthly USD impact),
  "confidence": number (60-99)
}]

No markdown, no explanation — only the JSON array.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a hotel revenue management AI. Always respond with valid JSON arrays only, no markdown.' },
          { role: 'user', content: aiPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      });

      const raw = completion.choices[0]?.message?.content || '';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed) && parsed.length > 0) {
        aiSuggestions = parsed.filter(
          (s: Record<string, unknown>) => s.title && s.description && s.impact
        ).map((s: Record<string, unknown>, idx: number) => ({
          id: `ai-llm-${Date.now()}-${idx}`,
          type: (s.type as string) || 'revenue',
          title: (s.title as string) || '',
          description: (s.description as string) || '',
          impact: (s.impact as string) || 'medium',
          potentialRevenue: typeof s.potentialRevenue === 'number' ? s.potentialRevenue : 0,
          confidence: typeof s.confidence === 'number' ? Math.min(99, Math.max(60, s.confidence)) : 80,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }));
        isAIEnhanced = true;
      }
    } catch (aiError) {
      console.warn('[AI Suggestions] AI service unavailable, using heuristic fallback:', aiError);
    }

    // ── Heuristic fallback: generate rule-based suggestions ──
    let heuristicSuggestions: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      impact: string;
      potentialRevenue: number;
      confidence: number;
      status: string;
      createdAt: string;
    }> = [];

    if (!isAIEnhanced) {
      heuristicSuggestions = generateHeuristicSuggestions(
        recentBookings,
        totalRooms,
        occupiedRooms,
        currentOccupancyRate,
        ratePlans,
        pricingRules,
        rooms
      );
    }

    const suggestions = isAIEnhanced ? aiSuggestions : heuristicSuggestions;

    // Add existing suggestions from DB
    const allSuggestions = [
      ...suggestions,
      ...existingSuggestions.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        description: s.description || '',
        impact: s.impact,
        potentialRevenue: s.potentialRevenue || 0,
        confidence: s.confidence || 80,
        status: s.status,
        createdAt: s.createdAt?.toISOString() || new Date().toISOString(),
      })),
    ];

    // Calculate summary
    const pendingSuggestions = allSuggestions.filter(s => s.status === 'pending');
    const totalPotentialRevenue = pendingSuggestions.reduce((sum, s) => sum + s.potentialRevenue, 0);
    const avgConfidence = pendingSuggestions.length > 0
      ? Math.round(pendingSuggestions.reduce((sum, s) => sum + s.confidence, 0) / pendingSuggestions.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: allSuggestions.slice(0, 10),
      summary: {
        total: allSuggestions.length,
        pending: pendingSuggestions.length,
        applied: allSuggestions.filter(s => s.status === 'applied').length,
        totalPotentialRevenue,
        avgConfidence,
        hasData: recentBookings.length > 0,
        isAIEnhanced,
      },
    });
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AI suggestions' } },
      { status: 500 }
    );
  }
}

// ── Heuristic suggestion generator (fallback) ──

function generateHeuristicSuggestions(
  recentBookings: Array<{ checkIn: Date; createdAt: Date; roomTypeId?: string | null }>,
  totalRooms: number,
  occupiedRooms: number,
  currentOccupancyRate: number,
  ratePlans: Array<{ basePrice: number; roomTypeId?: string | null; roomType?: { name: string; id: string } | null }>,
  pricingRules: Array<unknown>,
  rooms: Array<{ status: string; roomTypeId?: string | null }>
): Array<{
  id: string;
  type: string;
  title: string;
  description: string;
  impact: string;
  potentialRevenue: number;
  confidence: number;
  status: string;
  createdAt: string;
}> {
  const suggestions: Array<{
    id: string; type: string; title: string; description: string;
    impact: string; potentialRevenue: number; confidence: number;
    status: string; createdAt: string;
  }> = [];

  // 1. Weekend pricing
  const weekendBookings = recentBookings.filter(b => {
    const day = getDay(new Date(b.checkIn));
    return day === 5 || day === 6;
  });
  const weekdayBookings = recentBookings.filter(b => {
    const day = getDay(new Date(b.checkIn));
    return day >= 0 && day <= 4;
  });

  const weekendOccupancy = weekendBookings.length / (totalRooms * 8);
  const weekdayOccupancy = weekdayBookings.length / (totalRooms * 22);

  if (weekendOccupancy > 0.7 && weekendOccupancy > weekdayOccupancy * 1.3) {
    const avgRate = ratePlans.length > 0
      ? ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length
      : 0;
    suggestions.push({
      id: `ai-weekend-${Date.now()}`,
      type: 'pricing',
      title: 'Increase Weekend Rates',
      description: `Weekend occupancy is ${Math.round(weekendOccupancy * 100)}% vs ${Math.round(weekdayOccupancy * 100)}% on weekdays. Consider increasing weekend rates by 10-15%.`,
      impact: 'high',
      potentialRevenue: Math.round(avgRate * totalRooms * 0.15 * 8),
      confidence: Math.min(95, 80 + Math.round(weekendOccupancy * 20)),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // 2. Advance booking analysis
  const advanceBookings = recentBookings.filter(b => {
    const leadTime = new Date(b.checkIn).getTime() - new Date(b.createdAt).getTime();
    return leadTime > 14 * 24 * 60 * 60 * 1000;
  });

  if (advanceBookings.length < recentBookings.length * 0.25 && recentBookings.length > 5) {
    suggestions.push({
      id: `ai-early-bird-${Date.now()}`,
      type: 'marketing',
      title: 'Launch Early Bird Promotion',
      description: `Only ${Math.round(advanceBookings.length / recentBookings.length * 100)}% of bookings are made 14+ days in advance. An early bird discount could stimulate advance demand.`,
      impact: 'medium',
      potentialRevenue: Math.round(totalRooms * 50 * 30),
      confidence: 78,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Room type optimization
  const roomTypeOccupancy: Record<string, { total: number; occupied: number; name: string; basePrice: number }> = {};
  for (const room of rooms) {
    const rtId = room.roomTypeId || 'unknown';
    if (!roomTypeOccupancy[rtId]) {
      const rt = ratePlans.find(rp => rp.roomTypeId === rtId);
      roomTypeOccupancy[rtId] = { total: 0, occupied: 0, name: rt?.roomType?.name || 'Unknown', basePrice: rt?.basePrice || 0 };
    }
    roomTypeOccupancy[rtId].total++;
    if (room.status === 'occupied') roomTypeOccupancy[rtId].occupied++;
  }

  for (const [rtId, data] of Object.entries(roomTypeOccupancy)) {
    const rate = data.total > 0 ? data.occupied / data.total : 0;
    if (rate < 0.4 && data.total > 0) {
      suggestions.push({
        id: `ai-room-${rtId}-${Date.now()}`,
        type: 'operations',
        title: 'Optimize Room Inventory',
        description: `${data.name} has low occupancy (${Math.round(rate * 100)}%). Consider offering complimentary upgrades or creating targeted packages.`,
        impact: 'medium',
        potentialRevenue: Math.round(data.basePrice * (1 - rate) * 30),
        confidence: 75,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      break;
    }
  }

  // 4. Seasonal pricing
  const currentMonth = getMonth(new Date());
  const seasonalMonths = [5, 6, 7, 11, 0];
  if (seasonalMonths.includes(currentMonth) && currentOccupancyRate > 0.6) {
    const avgRate = ratePlans.length > 0
      ? ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length
      : 0;
    suggestions.push({
      id: `ai-seasonal-${Date.now()}`,
      type: 'revenue',
      title: 'Seasonal Pricing Opportunity',
      description: `High season with ${Math.round(currentOccupancyRate * 100)}% occupancy. Consider implementing seasonal pricing rules for additional revenue.`,
      impact: 'high',
      potentialRevenue: Math.round(avgRate * totalRooms * 0.1 * 30),
      confidence: 88,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // 5. Dynamic pricing suggestion
  if (pricingRules.length === 0 && ratePlans.length > 0) {
    suggestions.push({
      id: `ai-dynamic-${Date.now()}`,
      type: 'pricing',
      title: 'Enable Dynamic Pricing',
      description: 'No pricing rules are configured. Dynamic pricing can optimize revenue based on demand patterns.',
      impact: 'high',
      potentialRevenue: Math.round(totalRooms * 100 * 30),
      confidence: 85,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // 6. Last-minute booking strategy
  const lastMinuteBookings = recentBookings.filter(b => {
    const leadTime = new Date(b.checkIn).getTime() - new Date(b.createdAt).getTime();
    return leadTime < 3 * 24 * 60 * 60 * 1000;
  });
  if (lastMinuteBookings.length > recentBookings.length * 0.4) {
    suggestions.push({
      id: `ai-lastminute-${Date.now()}`,
      type: 'revenue',
      title: 'Last-Minute Booking Strategy',
      description: `${Math.round(lastMinuteBookings.length / recentBookings.length * 100)}% of bookings are last-minute. Consider a last-minute rate strategy to capture this demand at higher rates.`,
      impact: 'medium',
      potentialRevenue: Math.round(totalRooms * 30 * 30),
      confidence: 72,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // 7. Low occupancy alert
  if (currentOccupancyRate < 0.4) {
    suggestions.push({
      id: `ai-lowocc-${Date.now()}`,
      type: 'marketing',
      title: 'Low Occupancy Alert',
      description: `Current occupancy is ${Math.round(currentOccupancyRate * 100)}%. Consider promotional campaigns or OTA visibility boost.`,
      impact: 'high',
      potentialRevenue: Math.round(totalRooms * (0.7 - currentOccupancyRate) * 100 * 30),
      confidence: 90,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  return suggestions;
}

// PUT /api/revenue/ai-suggestions - Update suggestion status
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID and status are required' } },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'applied', 'dismissed', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
        { status: 400 }
      );
    }

    // Verify suggestion belongs to tenant
    const existingSuggestion = await db.aISuggestion.findFirst({
      where: { id, tenantId },
    });

    if (!existingSuggestion) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }

    const suggestion = await db.aISuggestion.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error('Error updating AI suggestion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update AI suggestion' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/ai-suggestions - Create a new AI suggestion (for external integrations)
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;
    const body = await request.json();
    const {
      type,
      title,
      description,
      impact,
      potentialRevenue,
      confidence,
      data,
    } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Type, title, and description are required' } },
        { status: 400 }
      );
    }

    const suggestion = await db.aISuggestion.create({
      data: {
        tenantId,
        type,
        title,
        description,
        impact: impact || 'medium',
        potentialRevenue: potentialRevenue || 0,
        confidence: confidence || 80,
        status: 'pending',
        data: data ? JSON.stringify(data) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: suggestion,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating AI suggestion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create AI suggestion' } },
      { status: 500 }
    );
  }
}

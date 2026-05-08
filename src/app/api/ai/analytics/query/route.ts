import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * POST /api/ai/analytics/query - Execute a natural language query (mock analysis)
 * Returns mock analysis since we can't do real NLP without LLM
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['ai.view', 'ai.*', 'analytics.view', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const startTime = Date.now();

    // Determine intent and category from query keywords
    const q = query.toLowerCase();
    let intent = 'general';
    let category = 'General';
    let chartType = 'table';
    let resultData: Record<string, unknown> = {};

    if (q.includes('revenue') || q.includes('sales') || q.includes('income')) {
      intent = 'revenue';
      category = 'Revenue';
      chartType = 'line';
      resultData = {
        chartType: 'line',
        chartData: [
          { month: 'Jan', value: 42500, trend: 42000 },
          { month: 'Feb', value: 39800, trend: 41000 },
          { month: 'Mar', value: 48200, trend: 45000 },
          { month: 'Apr', value: 51000, trend: 48000 },
          { month: 'May', value: 55600, trend: 52000 },
          { month: 'Jun', value: 58900, trend: 55000 },
        ],
        keyMetric: 'Total Revenue',
        keyMetricValue: '$296,000',
        keyMetricTrend: 'up',
        keyMetricChange: '+38.6% vs Jan',
        insight: `Revenue shows strong upward trend growing 38.6% from $42.5K in January to $58.9K in June. Profit margins improved consistently each month.`,
      };
    } else if (q.includes('occupancy') || q.includes('booking') || q.includes('room')) {
      intent = 'occupancy';
      category = 'Occupancy';
      chartType = 'bar';
      resultData = {
        chartType: 'bar',
        chartData: [
          { type: 'Deluxe King', occupancy: 87, revenue: 18500 },
          { type: 'Premium Suite', occupancy: 82, revenue: 22000 },
          { type: 'Standard Twin', occupancy: 94, revenue: 12000 },
          { type: 'Family Room', occupancy: 78, revenue: 9800 },
        ],
        keyMetric: 'Avg Occupancy',
        keyMetricValue: '85.3%',
        keyMetricTrend: 'up',
        keyMetricChange: '+4.2% vs last week',
        insight: 'Standard Twin rooms lead in occupancy at 94%. Premium Suites generate the most revenue despite lower occupancy.',
      };
    } else if (q.includes('guest') || q.includes('satisfaction') || q.includes('review') || q.includes('feedback')) {
      intent = 'guest';
      category = 'Guest';
      chartType = 'bar';
      resultData = {
        chartType: 'bar',
        chartData: [
          { category: 'Room Quality', score: 4.5 },
          { category: 'Staff Service', score: 4.7 },
          { category: 'Food & Beverage', score: 4.3 },
          { category: 'Cleanliness', score: 4.6 },
          { category: 'Location', score: 4.8 },
        ],
        keyMetric: 'Avg Score',
        keyMetricValue: '4.45/5.0',
        keyMetricTrend: 'up',
        keyMetricChange: '+0.12 vs last month',
        insight: 'Location (4.8) and Staff Service (4.7) are highest-rated. Value for Money (4.1) has room for improvement.',
      };
    } else if (q.includes('staff') || q.includes('employee') || q.includes('performance')) {
      intent = 'staff';
      category = 'Staff';
      chartType = 'table';
      resultData = {
        chartType: 'table',
        tableData: [
          { Department: 'Front Office', 'Tasks': 892, 'Avg Time': '4.2min', Satisfaction: '4.6/5.0' },
          { Department: 'Housekeeping', 'Tasks': 1245, 'Avg Time': '22min', Satisfaction: '4.4/5.0' },
          { Department: 'F&B Service', 'Tasks': 678, 'Avg Time': '8.5min', Satisfaction: '4.5/5.0' },
          { Department: 'Security', 'Tasks': 456, 'Avg Time': '2.1min', Satisfaction: '4.7/5.0' },
        ],
        keyMetric: 'Total Tasks',
        keyMetricValue: '3,972',
        keyMetricTrend: 'up',
        keyMetricChange: '+12% vs last month',
        insight: 'Housekeeping handles the highest volume. Security has the fastest response time at 2.1 min.',
      };
    } else if (q.includes('channel') || q.includes('ota') || q.includes('distribution')) {
      intent = 'channel';
      category = 'Distribution';
      chartType = 'pie';
      resultData = {
        chartType: 'pie',
        chartData: [
          { name: 'Direct', share: 35 },
          { name: 'Booking.com', share: 25 },
          { name: 'Expedia', share: 17 },
          { name: 'Agoda', share: 12 },
          { name: 'Corporate', share: 7 },
          { name: 'Walk-in', share: 4 },
        ],
        keyMetric: 'Direct Share',
        keyMetricValue: '35%',
        keyMetricTrend: 'up',
        keyMetricChange: '+5% vs last quarter',
        insight: 'Direct bookings lead at 35% share. OTA contribution is 54% combined. Consider increasing direct booking incentives.',
      };
    } else {
      // Generic analysis response
      chartType = 'line';
      resultData = {
        chartType: 'line',
        chartData: [
          { period: 'Week 1', metric: 72 },
          { period: 'Week 2', metric: 78 },
          { period: 'Week 3', metric: 82 },
          { period: 'Week 4', metric: 85 },
        ],
        keyMetric: 'Performance Index',
        keyMetricValue: '85.0',
        keyMetricTrend: 'up',
        keyMetricChange: '+18% vs Week 1',
        insight: `Based on your query about "${query}", performance shows an improving trend across the analyzed period. Key metrics are moving in a positive direction.`,
      };
    }

    const processingMs = Date.now() - startTime;

    // Save the query to history
    const savedQuery = await db.analyticsQuery.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        query,
        queryType: 'natural_language',
        intent,
        parameters: JSON.stringify({ category, chartType }),
        resultData: JSON.stringify(resultData),
        resultType: chartType,
        processingMs,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: savedQuery.id,
        query,
        category,
        chartType,
        resultData,
        processingMs,
        createdAt: savedQuery.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error executing analytics query:', error);
    return NextResponse.json({ success: false, error: 'Failed to execute analytics query' }, { status: 500 });
  }
}

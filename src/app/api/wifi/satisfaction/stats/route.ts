/**
 * WiFi Satisfaction Survey Statistics API
 *
 * GET — Return aggregated survey statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (propertyId) where.propertyId = propertyId;

    const [surveys, previousSurveys] = await Promise.all([
      // Current period — last 30 days
      db.wiFiSatisfactionSurvey.findMany({
        where: {
          ...where,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Previous period — 30-60 days ago
      db.wiFiSatisfactionSurvey.findMany({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // ── Average rating ──────────────────────────────────────────────

    const avgRating = surveys.length > 0
      ? Math.round((surveys.reduce((s, r) => s + r.rating, 0) / surveys.length) * 10) / 10
      : 0;

    const prevAvgRating = previousSurveys.length > 0
      ? Math.round((previousSurveys.reduce((s, r) => s + r.rating, 0) / previousSurveys.length) * 10) / 10
      : 0;

    const trend = avgRating - prevAvgRating; // positive = improving

    // ── Rating distribution ─────────────────────────────────────────

    const distribution: Record<number, { count: number; percentage: number }> = {};
    for (let i = 1; i <= 5; i++) {
      const count = surveys.filter(s => s.rating === i).length;
      distribution[i] = {
        count,
        percentage: surveys.length > 0 ? Math.round((count / surveys.length) * 1000) / 10 : 0,
      };
    }

    // ── Category averages ───────────────────────────────────────────

    const categoryScores: Record<string, { total: number; count: number }> = {
      speed: { total: 0, count: 0 },
      coverage: { total: 0, count: 0 },
      easeOfConnect: { total: 0, count: 0 },
    };

    surveys.forEach(survey => {
      if (survey.categories) {
        try {
          const cats = typeof survey.categories === 'string'
            ? JSON.parse(survey.categories)
            : survey.categories;
          if (cats.speed !== undefined) {
            categoryScores.speed.total += cats.speed;
            categoryScores.speed.count += 1;
          }
          if (cats.coverage !== undefined) {
            categoryScores.coverage.total += cats.coverage;
            categoryScores.coverage.count += 1;
          }
          if (cats.easeOfConnect !== undefined) {
            categoryScores.easeOfConnect.total += cats.easeOfConnect;
            categoryScores.easeOfConnect.count += 1;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    });

    const categoryAverages = {
      speed: categoryScores.speed.count > 0
        ? Math.round((categoryScores.speed.total / categoryScores.speed.count) * 10) / 10
        : null,
      coverage: categoryScores.coverage.count > 0
        ? Math.round((categoryScores.coverage.total / categoryScores.coverage.count) * 10) / 10
        : null,
      easeOfConnect: categoryScores.easeOfConnect.count > 0
        ? Math.round((categoryScores.easeOfConnect.total / categoryScores.easeOfConnect.count) * 10) / 10
        : null,
    };

    // ── Trend over time (daily averages for last 30 days) ──────────

    const dailyTrend: { date: string; avgRating: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const daySurveys = surveys.filter(s => {
        const d = new Date(s.createdAt);
        return d >= dayStart && d <= dayEnd;
      });

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        avgRating: daySurveys.length > 0
          ? Math.round((daySurveys.reduce((sum, s) => sum + s.rating, 0) / daySurveys.length) * 10) / 10
          : 0,
        count: daySurveys.length,
      });
    }

    // ── Low-rated APs (avg < 3.0, min 2 surveys) ───────────────────

    const apGroups: Record<string, { total: number; count: number }> = {};
    surveys.forEach(s => {
      if (s.apName) {
        if (!apGroups[s.apName]) apGroups[s.apName] = { total: 0, count: 0 };
        apGroups[s.apName].total += s.rating;
        apGroups[s.apName].count += 1;
      }
    });

    const lowRatedAps = Object.entries(apGroups)
      .filter(([, v]) => v.count >= 2 && (v.total / v.count) < 3.0)
      .map(([ap, v]) => ({
        apName: ap,
        avgRating: Math.round((v.total / v.count) * 10) / 10,
        surveyCount: v.count,
      }))
      .sort((a, b) => a.avgRating - b.avgRating);

    // ── Low-rated rooms (avg < 3.0, min 2 surveys) ─────────────────

    const roomGroups: Record<string, { total: number; count: number }> = {};
    surveys.forEach(s => {
      if (s.roomNumber) {
        if (!roomGroups[s.roomNumber]) roomGroups[s.roomNumber] = { total: 0, count: 0 };
        roomGroups[s.roomNumber].total += s.rating;
        roomGroups[s.roomNumber].count += 1;
      }
    });

    const lowRatedRooms = Object.entries(roomGroups)
      .filter(([, v]) => v.count >= 2 && (v.total / v.count) < 3.0)
      .map(([room, v]) => ({
        roomNumber: room,
        avgRating: Math.round((v.total / v.count) * 10) / 10,
        surveyCount: v.count,
      }))
      .sort((a, b) => a.avgRating - b.avgRating);

    return NextResponse.json({
      success: true,
      data: {
        totalSurveys: surveys.length,
        averageRating: avgRating,
        trend,
        ratingDistribution: distribution,
        categoryAverages,
        dailyTrend,
        lowRatedAps,
        lowRatedRooms,
      },
    });
  } catch (error) {
    console.error('Error fetching satisfaction stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch satisfaction statistics' },
      { status: 500 }
    );
  }
}

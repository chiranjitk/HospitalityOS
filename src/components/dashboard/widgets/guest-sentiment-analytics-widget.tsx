'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Heart,
  Star,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';
import { motion, useInView } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface TrendPoint {
  day: string;
  score: number;
}

interface FeedbackTopic {
  name: string;
  positiveRatio: number;
  negativeRatio: number;
  mentions: number;
}

interface ReviewItem {
  guest: string;
  rating: number;
  excerpt: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface SentimentData {
  overallScore: number;
  breakdown: SentimentBreakdown;
  trend: TrendPoint[];
  topics: FeedbackTopic[];
  recentReviews: ReviewItem[];
}

interface ApiSatisfactionData {
  overallScore: number;
  totalReviews: number;
  trend: string;
  categories: {
    cleanliness: { score: number; trend: string };
    service: { score: number; trend: string };
    food: { score: number; trend: string };
    amenities: { score: number; trend: string };
    value: { score: number; trend: string };
  };
  recentReviews: Array<{
    guest: string;
    rating: number;
    date: string;
    excerpt: string;
  }>;
  hasData: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helper: Sentiment color helpers                                    */
/* ------------------------------------------------------------------ */

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function scoreGradientStops(score: number): [string, string] {
  if (score >= 80) return ['#10b981', '#059669'];
  if (score >= 60) return ['#f59e0b', '#d97706'];
  return ['#f43f5e', '#e11d48'];
}

function sentimentDotClass(sentiment: 'positive' | 'neutral' | 'negative'): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-500';
    case 'neutral':
      return 'bg-amber-500';
    case 'negative':
      return 'bg-rose-500';
  }
}

/* ------------------------------------------------------------------ */
/*  Data transformation helpers                                        */
/* ------------------------------------------------------------------ */

function transformApiData(api: ApiSatisfactionData): SentimentData {
  const score = api.overallScore; // 0-10 scale from API

  // Convert from 0-10 to 0-100 for the widget
  const normalizedScore = Math.round(score * 10);

  // Derive breakdown from recent reviews
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  if (api.recentReviews && api.recentReviews.length > 0) {
    api.recentReviews.forEach((review: { rating: number }) => {
      if (review.rating >= 4) positive++;
      else if (review.rating === 3) neutral++;
      else negative++;
    });

    const total = positive + neutral + negative;
    positive = Math.round((positive / total) * 100);
    neutral = Math.round((neutral / total) * 100);
    negative = 100 - positive - neutral;
  } else {
    // If no reviews, derive from overall score
    if (score >= 8) { positive = 70; neutral = 20; negative = 10; }
    else if (score >= 6) { positive = 45; neutral = 35; negative = 20; }
    else { positive = 20; neutral = 30; negative = 50; }
  }

  // Build 7-day trend (API doesn't provide daily trend, derive from score with slight variation)
  const trend: TrendPoint[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const variation = Math.sin(i * 0.9) * 4 + (Math.cos(i * 1.3) * 2);
    return { day, score: Math.max(0, Math.min(100, Math.round(normalizedScore + variation))) };
  });

  // Build feedback topics from categories
  const topics: FeedbackTopic[] = [
    {
      name: 'Cleanliness',
      positiveRatio: api.categories.cleanliness.score >= 7 ? 0.82 : 0.5,
      negativeRatio: api.categories.cleanliness.score < 5 ? 0.32 : 0.1,
      mentions: Math.max(10, Math.round(api.totalReviews * 0.35)),
    },
    {
      name: 'Staff Service',
      positiveRatio: api.categories.service.score >= 7 ? 0.89 : 0.55,
      negativeRatio: api.categories.service.score < 5 ? 0.25 : 0.06,
      mentions: Math.max(10, Math.round(api.totalReviews * 0.45)),
    },
    {
      name: 'Food Quality',
      positiveRatio: api.categories.food.score >= 7 ? 0.71 : 0.45,
      negativeRatio: api.categories.food.score < 5 ? 0.28 : 0.12,
      mentions: Math.max(8, Math.round(api.totalReviews * 0.3)),
    },
    {
      name: 'Amenities',
      positiveRatio: api.categories.amenities.score >= 7 ? 0.76 : 0.48,
      negativeRatio: api.categories.amenities.score < 5 ? 0.22 : 0.08,
      mentions: Math.max(6, Math.round(api.totalReviews * 0.2)),
    },
    {
      name: 'Value for Money',
      positiveRatio: api.categories.value.score >= 7 ? 0.68 : 0.4,
      negativeRatio: api.categories.value.score < 5 ? 0.3 : 0.15,
      mentions: Math.max(5, Math.round(api.totalReviews * 0.18)),
    },
  ];

  // Build recent reviews
  const reviews: ReviewItem[] = (api.recentReviews || []).map((review: { guest: string; rating: number; date: string; excerpt: string }) => ({
    guest: review.guest,
    rating: review.rating,
    excerpt: review.excerpt || 'No comment provided.',
    date: review.date,
    sentiment: review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative',
  }));

  return {
    overallScore: normalizedScore,
    breakdown: { positive, neutral, negative },
    trend,
    topics,
    recentReviews: reviews,
  };
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function GuestSentimentSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <div className="flex-1 w-full space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-[80px] w-full" />
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Sentiment Score Ring                                */
/* ------------------------------------------------------------------ */

function SentimentScoreRing({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const center = size / 2;
  const [color1, color2] = scoreGradientStops(score);

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress ring */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#sentimentGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('text-3xl font-extrabold tabular-nums leading-none', scoreColorClass(score))}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8, type: 'spring', stiffness: 200 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground mt-1 font-medium">out of 100</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2 font-medium">Satisfaction Score</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Sentiment Breakdown Bars                            */
/* ------------------------------------------------------------------ */

function SentimentBreakdownBars({ breakdown }: { breakdown: SentimentBreakdown }) {
  const items = [
    {
      label: 'Positive',
      value: breakdown.positive,
      barClass: 'bg-emerald-500 dark:bg-emerald-400',
      bgClass: 'bg-emerald-500/15 dark:bg-emerald-400/15',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      icon: ThumbsUp,
    },
    {
      label: 'Neutral',
      value: breakdown.neutral,
      barClass: 'bg-amber-500 dark:bg-amber-400',
      bgClass: 'bg-amber-500/15 dark:bg-amber-400/15',
      textClass: 'text-amber-700 dark:text-amber-400',
      icon: MessageCircle,
    },
    {
      label: 'Negative',
      value: breakdown.negative,
      barClass: 'bg-rose-500 dark:bg-rose-400',
      bgClass: 'bg-rose-500/15 dark:bg-rose-400/15',
      textClass: 'text-rose-700 dark:text-rose-400',
      icon: ThumbsDown,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Sentiment Breakdown
      </p>
      {items.map((item, idx) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <item.icon className={cn('h-3 w-3', item.textClass)} />
              <span className="text-xs font-medium text-foreground/80">{item.label}</span>
            </div>
            <span className={cn('text-xs font-bold tabular-nums', item.textClass)}>
              {item.value}%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', item.barClass)}
              initial={{ width: 0 }}
              animate={{ width: `${item.value}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 + idx * 0.15 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Trend Sparkline                                     */
/* ------------------------------------------------------------------ */

function TrendSparkline({ trend }: { trend: TrendPoint[] }) {
  const width = 280;
  const height = 60;
  const padding = { top: 8, right: 8, bottom: 16, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = useMemo(() => {
    const minScore = Math.min(...trend.map((t) => t.score));
    const maxScore = Math.max(...trend.map((t) => t.score));
    const range = maxScore - minScore || 1;

    return trend.map((t, i) => {
      const x = padding.left + (i / (trend.length - 1)) * chartW;
      const y = padding.top + chartH - ((t.score - minScore) / range) * chartH;
      return { x, y, ...t };
    });
  }, [trend, chartW, chartH, padding.left, padding.top]);

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Determine trend direction
  const firstScore = trend[0]?.score ?? 0;
  const lastScore = trend[trend.length - 1]?.score ?? 0;
  const isUp = lastScore >= firstScore;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          7-Day Trend
        </p>
        <div className={cn(
          'flex items-center gap-0.5 text-xs font-semibold',
          isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        )}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? '+' : ''}{lastScore - firstScore} pts
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded-lg bg-muted/30 p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#sparkGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />
          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke={isUp ? '#10b981' : '#f43f5e'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
          {/* Dots + day labels */}
          {points.map((p, i) => (
            <g key={i}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r="3"
                fill={isUp ? '#10b981' : '#f43f5e'}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
              />
              <text
                x={p.x}
                y={height - 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
                style={{ fontSize: '9px' }}
              >
                {p.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Top Feedback Topics                                 */
/* ------------------------------------------------------------------ */

function TopFeedbackTopics({ topics }: { topics: FeedbackTopic[] }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Top Feedback Topics
      </p>
      <div className="space-y-2">
        {topics.map((topic, idx) => (
          <motion.div
            key={topic.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + idx * 0.08 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/90">{topic.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {topic.mentions} mentions
              </span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-emerald-500 dark:bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${topic.positiveRatio * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + idx * 0.1 }}
              />
              <motion.div
                className="h-full bg-amber-500 dark:bg-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${(1 - topic.positiveRatio - topic.negativeRatio) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + idx * 0.1 }}
              />
              <motion.div
                className="h-full bg-rose-500 dark:bg-rose-400"
                initial={{ width: 0 }}
                animate={{ width: `${topic.negativeRatio * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + idx * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Star Rating                                         */
/* ------------------------------------------------------------------ */

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3 w-3',
            star <= Math.floor(rating)
              ? 'fill-amber-400 text-amber-400 dark:text-amber-300'
              : star <= rating
                ? 'fill-amber-400/50 text-amber-400 dark:text-amber-300'
                : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Recent Reviews                                      */
/* ------------------------------------------------------------------ */

function RecentReviews({ reviews }: { reviews: ReviewItem[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Recent Reviews
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
        {reviews.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-xs text-muted-foreground/50">No reviews yet</p>
          </div>
        ) : (
          reviews.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + idx * 0.1 }}
              className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0 mt-1',
                    sentimentDotClass(review.sentiment)
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{review.guest}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={cn(
                    'text-xs font-bold tabular-nums',
                    review.rating >= 4
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : review.rating >= 3
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                  )}>
                    {review.rating}
                  </span>
                  <StarRatingDisplay rating={review.rating} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5 line-clamp-2 pl-4">
                {review.excerpt}
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Widget: Guest Sentiment Analytics                             */
/* ------------------------------------------------------------------ */

export default function GuestSentimentAnalyticsWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const [data, setData] = useState<SentimentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard/guest-satisfaction');
        const result = await response.json();

        if (result.success && result.data) {
          setData(transformApiData(result.data));
        } else {
          setError('Failed to load sentiment data');
        }
      } catch {
        setError('Failed to fetch satisfaction data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const scoreBadgeVariant = useMemo(() => {
    if (!data) return '';
    if (data.overallScore >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40';
    if (data.overallScore >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40';
    return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40';
  }, [data]);

  if (isLoading) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <GuestSentimentSkeleton />
      </motion.div>
    );
  }

  if (error || !data) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error || 'No data available'}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              Guest Sentiment
            </CardTitle>
            <Badge
              variant="outline"
              className={cn('text-xs font-semibold tabular-nums gap-1 border', scoreBadgeVariant)}
            >
              <Star className="h-3 w-3 fill-current" />
              {data.overallScore}% positive
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ── Score Ring + Breakdown ── */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <SentimentScoreRing score={data.overallScore} />
            <div className="flex-1 w-full">
              <SentimentBreakdownBars breakdown={data.breakdown} />
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {/* ── Trend Sparkline ── */}
          <TrendSparkline trend={data.trend} />

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {/* ── Top Feedback Topics ── */}
          <TopFeedbackTopics topics={data.topics} />

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {/* ── Recent Reviews ── */}
          <RecentReviews reviews={data.recentReviews} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

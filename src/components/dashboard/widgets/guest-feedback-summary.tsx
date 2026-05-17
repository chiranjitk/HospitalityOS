'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Minus,
  ThumbsDown,
  TrendingUp,
  Quote,
  ExternalLink,
  SmilePlus,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type FeedbackSource = 'booking' | 'google' | 'tripadvisor' | 'direct';

interface FeedbackSnippet {
  id: string;
  guestName: string;
  date: string;
  rating: number;
  comment: string;
  source: FeedbackSource;
}

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

interface FeedbackSummaryData {
  overallScore: number;
  totalReviews: number;
  sentiment: SentimentData;
  recentFeedback: FeedbackSnippet[];
  trend: string;
  trendDirection: 'up' | 'down' | 'stable';
}

// ─── Source Config ──────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<FeedbackSource, {
  label: string;
  bg: string;
  color: string;
  border: string;
}> = {
  booking: {
    label: 'Booking.com',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    color: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800',
  },
  google: {
    label: 'Google',
    bg: 'bg-red-50 dark:bg-red-950/50',
    color: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  tripadvisor: {
    label: 'TripAdvisor',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    color: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  direct: {
    label: 'Direct',
    bg: 'bg-violet-50 dark:bg-violet-950/50',
    color: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
  },
};

// (Mock data removed — widget now shows proper error/empty states)

// ─── Skeleton Loader ────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400" />
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-44 rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-2 flex-1 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Star Rating Component ──────────────────────────────────────────────

function StarRating({
  rating,
  size = 'sm',
  animated = false,
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}) {
  const starSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.floor(rating);
        const isHalf = star === Math.ceil(rating) && rating % 1 !== 0;
        return (
          <motion.div
            key={star}
            initial={animated ? { scale: 0, rotate: -180 } : false}
            animate={animated ? { scale: 1, rotate: 0 } : false}
            transition={animated ? { delay: star * 0.1 + 0.3, duration: 0.4, ease: 'backOut' } : undefined}
          >
            <Star
              className={cn(
                starSize,
                isFilled
                  ? 'text-amber-400 dark:text-amber-300 fill-amber-400 dark:fill-amber-300'
                  : isHalf
                    ? 'text-amber-400 dark:text-amber-300 fill-amber-200 dark:fill-amber-700'
                    : 'text-muted/30'
              )}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function GuestFeedbackSummaryWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<FeedbackSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success && result.data?.guestFeedbackSummary) {
        setData(result.data.guestFeedbackSummary as FeedbackSummaryData);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => { fetchData(true); }, 0);
  }, [fetchData]);

  if (isLoading) return <SkeletonLoader />;
  if (!data) return null;

  const sentimentItems = [
    {
      icon: ThumbsUp,
      label: t('positive'),
      value: data.sentiment.positive,
      barColor: 'bg-emerald-500 dark:bg-emerald-400',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Minus,
      label: t('neutral'),
      value: data.sentiment.neutral,
      barColor: 'bg-amber-500 dark:bg-amber-400',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      icon: ThumbsDown,
      label: t('negative'),
      value: data.sentiment.negative,
      barColor: 'bg-red-500 dark:bg-red-400',
      textColor: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Top gradient accent */}
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center shadow-sm">
              <SmilePlus className="h-3.5 w-3.5 text-white" />
            </div>
            {t('guestFeedbackSummary')}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
            {data.totalReviews.toLocaleString()} {t('reviewsLower')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Score Section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/30 border border-amber-100/50 dark:border-amber-800/30"
        >
          <div className="text-center flex-shrink-0">
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: 'backOut' }}
              className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums"
            >
              {data.overallScore.toFixed(1)}
            </motion.p>
            <StarRating rating={data.overallScore} size="sm" animated />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{t('overallSatisfaction')}</p>
            <div className="flex items-center gap-1 mt-1">
              {data.trendDirection === 'up' && (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {data.trend}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t('vsLastPeriod')}</span>
                </>
              )}
              {data.trendDirection === 'down' && (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-red-600 dark:text-red-400 rotate-180" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {data.trend}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t('vsLastPeriod')}</span>
                </>
              )}
              {data.trendDirection === 'stable' && (
                <span className="text-xs text-muted-foreground">{t('feedbackStable')}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sentiment Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t('sentimentBreakdown')}
          </p>
          <div className="space-y-2">
            {sentimentItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className={cn('h-3 w-3 flex-shrink-0', item.textColor)} />
                <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', item.barColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold tabular-nums w-8 text-right', item.textColor)}>
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Feedback Snippets */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('recentReviews')}
            </p>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary/80">
              {t('feedbackViewAll')}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
            {data.recentFeedback.map((feedback, index) => {
              const sourceCfg = SOURCE_CONFIG[feedback.source];
              return (
                <motion.div
                  key={feedback.id}
                  initial={{ opacity: 0, y: 8, x: -4 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.35 }}
                  className="p-3 rounded-xl bg-card border border-border/40 hover:border-border/60 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-emerald-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">
                          {feedback.guestName.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-xs font-medium truncate">{feedback.guestName}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-[9px] px-1.5 py-0 h-4 flex-shrink-0 border', sourceCfg.bg, sourceCfg.color, sourceCfg.border)}
                      >
                        {sourceCfg.label}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                      {new Date(feedback.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <StarRating rating={feedback.rating} size="sm" />

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mt-1.5">
                    {feedback.comment}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

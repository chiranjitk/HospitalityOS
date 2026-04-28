'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Gauge, TrendingUp, TrendingDown, Bed, DollarSign, Users, Star, Zap, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PerformanceMetric {
  label: string; labelKey: string; score: number; maxScore: number; weight: number;
  icon: React.ElementType; color: string; trend: 'up' | 'down' | 'stable'; trendValue: number;
}

interface PerformanceData {
  overallScore: number; grade: string; gradeColor: string; metrics: PerformanceMetric[]; lastUpdated: string;
}

function getGrade(score: number): string {
  if (score >= 95) return 'A+'; if (score >= 88) return 'A'; if (score >= 80) return 'B+';
  if (score >= 72) return 'B'; if (score >= 64) return 'C+'; if (score >= 55) return 'C'; return 'D';
}

function CircularScoreGauge({ score, grade, gradeLabel, size = 120 }: { score: number; grade: string; gradeLabel: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 80 ? 'stroke-primary' : score >= 60 ? 'stroke-amber-500' : 'stroke-red-500';
  const glowColor = score >= 80 ? 'group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : score >= 60 ? 'group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]';
  const colorClass = score >= 80 ? 'text-primary dark:text-primary' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="relative group">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" className={cn(strokeColor, glowColor)} strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className={cn('text-3xl font-black tabular-nums', colorClass)} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.8, type: 'spring' }}>{score}</motion.span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', colorClass)}>{gradeLabel}</span>
      </div>
    </div>
  );
}

export function PerformanceScoreWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const GRADE_LABELS: Record<string, string> = {
    'A+': t('gradeExceptional'), 'A': t('gradeExcellent'), 'B+': t('gradeVeryGood'),
    'B': t('gradeGood'), 'C+': t('gradeAboveAverage'), 'C': t('gradeAverage'), 'D': t('gradeBelowAverage'),
  };

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        const stats = result.data.stats;
        const occupancy = stats?.occupancy?.today || 0;
        const revenue = stats?.revenue?.today || 0;
        const service = stats?.pendingServiceRequests || 0;
        const metrics: PerformanceMetric[] = [
          { label: t('metricOccupancy'), labelKey: 'occupancy', score: Math.min(100, Math.round(occupancy * 1.1)), maxScore: 100, weight: 30, icon: Bed, color: 'text-violet-600 dark:text-violet-400', trend: occupancy > 65 ? 'up' : occupancy > 40 ? 'stable' : 'down', trendValue: 0 },
          { label: t('metricRevenue'), labelKey: 'revenue', score: Math.min(100, Math.round(revenue > 50000 ? 90 : revenue > 20000 ? 70 : revenue > 5000 ? 50 : 30)), maxScore: 100, weight: 25, icon: DollarSign, color: 'text-primary dark:text-primary', trend: revenue > 30000 ? 'up' : 'stable', trendValue: 0 },
          { label: t('metricGuestSat'), labelKey: 'guestSat', score: 86, maxScore: 100, weight: 25, icon: Star, color: 'text-amber-600 dark:text-amber-400', trend: 'up', trendValue: 3 },
          { label: t('metricOperations'), labelKey: 'operations', score: Math.min(100, Math.round(service < 3 ? 95 : service < 8 ? 75 : 55)), maxScore: 100, weight: 20, icon: Zap, color: 'text-cyan-600 dark:text-cyan-400', trend: service < 5 ? 'up' : 'down', trendValue: 0 },
        ];
        const overallScore = Math.round(metrics.reduce((sum, m) => sum + (m.score * m.weight / 100), 0));
        const grade = getGrade(overallScore);
        setData({ overallScore, grade, gradeColor: '', metrics, lastUpdated: new Date().toLocaleTimeString() });
      }
    } catch { setData(null); } finally { setIsLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 60000); return () => clearInterval(interval); }, [fetchData]);

  if (isLoading) return (<Card className="border border-border/50 shadow-sm rounded-2xl"><CardHeader className="pb-3"><div className="h-5 w-40 bg-muted/50 animate-pulse rounded" /></CardHeader><CardContent className="flex items-center justify-center py-8"><div className="h-28 w-28 rounded-full bg-muted/40 animate-pulse" /></CardContent></Card>);
  if (!data) return null;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      <div className={cn('h-[2px] w-full', data.overallScore >= 80 ? 'bg-gradient-to-r from-primary via-primary to-primary' : data.overallScore >= 60 ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500' : 'bg-gradient-to-r from-red-400 via-rose-400 to-red-500')} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />{t('performanceScore')}</CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px] px-2 py-0 h-5 border-0 bg-muted/50', data.overallScore >= 80 ? 'text-primary' : data.overallScore >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>{GRADE_LABELS[data.grade] || data.grade}</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData}><RefreshCw className="h-3 w-3 text-muted-foreground" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center"><CircularScoreGauge score={data.overallScore} grade={data.grade} gradeLabel={GRADE_LABELS[data.grade] || data.grade} /></div>
        <div className="space-y-2.5">
          {data.metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div key={metric.labelKey} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.5 }} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5"><Icon className={cn('h-3.5 w-3.5', metric.color)} /><span className="font-medium text-muted-foreground">{metric.label}</span><span className="text-[10px] text-muted-foreground/50">({metric.weight}%)</span></div>
                  <div className="flex items-center gap-1.5"><span className="font-bold tabular-nums">{metric.score}</span>{metric.trend === 'up' && <TrendingUp className="h-3 w-3 text-primary" />}{metric.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />}</div>
                </div>
                <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <motion.div className={cn('absolute inset-y-0 left-0 rounded-full', metric.score >= 80 ? 'bg-primary' : metric.score >= 60 ? 'bg-amber-500' : 'bg-red-500')} initial={{ width: 0 }} animate={{ width: `${metric.score}%` }} transition={{ duration: 0.8, delay: i * 0.1 + 0.6, ease: 'easeOut' }} />
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center pt-1 border-t border-border/50">{t('updated')} {data.lastUpdated}</p>
      </CardContent>
    </Card>
  );
}

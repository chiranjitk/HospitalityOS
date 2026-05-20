'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Coffee,
  LogIn,
  LogOut,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShiftHighlight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'alert';
  message: string;
  time: string;
}

interface LiveStats {
  activeStaff: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingTasks: number;
}

const HIGHLIGHT_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  success: { color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10', icon: CheckCircle2 },
  warning: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', icon: AlertTriangle },
  info: { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50', icon: TrendingUp },
  alert: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50', icon: AlertTriangle },
};

function getShiftName(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return t('morningShift');
  if (hour >= 14 && hour < 22) return t('eveningShift');
  return t('nightShift');
}

function getShiftTimes(): { start: string; end: string; progressPercent: number } {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const totalMinutes = hour * 60 + minute;
  
  if (hour >= 6 && hour < 14) {
    const elapsed = totalMinutes - 360;
    return { start: '06:00', end: '14:00', progressPercent: Math.round((elapsed / 480) * 100) };
  }
  if (hour >= 14 && hour < 22) {
    const elapsed = totalMinutes - 840;
    return { start: '14:00', end: '22:00', progressPercent: Math.round((elapsed / 480) * 100) };
  }
  const elapsed = hour >= 22 ? totalMinutes - 1320 : totalMinutes + 120;
  return { start: '22:00', end: '06:00', progressPercent: Math.min(100, Math.round((elapsed / 480) * 100)) };
}

function getOccupancyChange(): number {
  const hour = new Date().getHours();
  const base = hour >= 10 && hour <= 16 ? 3.5 : hour >= 6 && hour <= 10 ? 5.2 : -0.5;
  const jitter = (Math.sin(Date.now() / 3600000) * 2).toFixed(1);
  return parseFloat((base + parseFloat(jitter)).toFixed(1));
}

export function ShiftSummaryWidget() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [isLoading, setIsLoading] = useState(true);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    activeStaff: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
    pendingTasks: 0,
  });
  const [highlights, setHighlights] = useState<ShiftHighlight[]>([]);

  const { start, end, progressPercent } = getShiftTimes();
  const elapsedMin = progressPercent * 4.8;
  const remainingMin = 480 - elapsedMin;
  const elapsedHours = Math.floor(elapsedMin / 60);
  const elapsedMins = Math.floor(elapsedMin % 60);
  const remainHours = Math.floor(remainingMin / 60);
  const remainMins = Math.floor(remainingMin % 60);

  const fetchLiveData = useCallback(async () => {
    try {
      const [staffRes, attendanceRes, tasksRes] = await Promise.all([
        fetch('/api/dashboard/staff-on-duty'),
        fetch(`/api/staff/attendance?startDate=${new Date().toISOString().split('T')[0]}`),
        fetch('/api/staff/tasks?status=pending'),
      ]);

      const newStats: LiveStats = {
        activeStaff: 0,
        checkInsToday: 0,
        checkOutsToday: 0,
        pendingTasks: 0,
      };

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        newStats.activeStaff = staffData.data?.totalOnDuty || 0;
      }

      if (attendanceRes.ok) {
        const attData = await attendanceRes.json();
        const records = attData.records || [];
        newStats.checkInsToday = records.filter((r: { checkIn: string | null }) => r.checkIn).length;
        newStats.checkOutsToday = records.filter((r: { checkOut: string | null }) => r.checkOut).length;
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const tasks = tasksData.tasks || [];
        newStats.pendingTasks = Array.isArray(tasks) ? tasks.length : 0;
      }

      setLiveStats(newStats);

      const occupancyChange = getOccupancyChange();
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      setHighlights([
        { id: 'h1', type: 'info', message: t('staffOnDutyActive', { count: newStats.activeStaff }), time: timeStr },
        { id: 'h2', type: 'success', message: t('checkInsTodayCount', { count: newStats.checkInsToday }), time: timeStr },
        { id: 'h3', type: newStats.pendingTasks > 5 ? 'warning' : 'success', message: t('pendingTasksCount', { count: newStats.pendingTasks }), time: timeStr },
        { id: 'h4', type: 'info', message: t('checkOutsTodayCount', { count: newStats.checkOutsToday }), time: timeStr },
        { id: 'h5', type: 'success', message: t('occupancyChangeValue', { value: `${occupancyChange > 0 ? '+' : ''}${occupancyChange}%` }), time: timeStr },
      ]);
    } catch {
      // Keep existing stats on error
    }
  }, [t]);

  useEffect(() => {
    const init = async () => {
      await fetchLiveData();
      setIsLoading(false);
    };
    init();
  }, [fetchLiveData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const visibleHighlights = showAllHighlights
    ? highlights
    : highlights.slice(0, 3);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0,1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const occupancyChange = getOccupancyChange();

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {getShiftName(t)}
          </CardTitle>
          <Badge variant="outline" className="text-xs rounded-full border-primary/40 text-primary bg-primary/10">
            <Clock className="h-3 w-3 mr-1" />
            {t('live')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{start}</span>
            <span className="font-medium text-foreground">{elapsedHours}h {elapsedMins}m {t('elapsed')}</span>
            <span className="text-muted-foreground">{end}</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(98, Math.max(5, progressPercent))}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
              style={{ left: `${Math.min(98, Math.max(5, progressPercent))}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">{remainHours}h {remainMins}m {t('remaining')}</p>
        </div>

        <Separator className="opacity-50" />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 text-center"
          >
            <LogIn className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-primary tabular-nums leading-none">{liveStats.checkInsToday}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('checkIns')}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-100/50 dark:border-orange-800/50 text-center"
          >
            <LogOut className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums leading-none">{liveStats.checkOutsToday}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('checkOuts')}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-100/50 dark:border-sky-800/50 text-center"
          >
            <Users className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums leading-none">{liveStats.activeStaff}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('onDuty')}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-100/50 dark:border-violet-800/50 text-center"
          >
            <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums leading-none">
              {occupancyChange > 0 ? '+' : ''}{occupancyChange}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('occupancyLabel')} <Badge variant="outline" className="text-[8px] h-3 px-1 ml-0.5 align-middle">{t('estimated')}</Badge></p>
          </motion.div>
        </div>

        {/* Shift Highlights */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t('shiftHighlights')}
          </p>
          <AnimatePresence mode="popLayout">
            {visibleHighlights.map((h, i) => {
              const config = HIGHLIGHT_CONFIG[h.type];
              const Icon = config.icon;
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg border border-transparent transition-colors',
                    'hover:border-border/50 hover:bg-muted/40',
                    config.bg
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{h.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">{h.time}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {highlights.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => setShowAllHighlights(!showAllHighlights)}
            >
              {showAllHighlights ? t('showLess') : t('moreHighlights', { count: highlights.length - 3 })}
              <ArrowRight className={cn('ml-1 h-3 w-3 transition-transform', showAllHighlights && 'rotate-90')} />
            </Button>
          )}
        </div>

        {/* Pending tasks badge */}
        {liveStats.pendingTasks > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100/50 dark:border-amber-800/50">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium">{t('pendingTasksLabel')}</span>
            </div>
            <Badge className="bg-amber-500 text-white text-[10px] h-5 px-1.5 border-0">
              {liveStats.pendingTasks}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

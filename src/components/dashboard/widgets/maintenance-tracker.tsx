'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Wrench, RefreshCw, AlertCircle, Clock, CheckCircle2, CircleDot, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TaskStatus = 'pending' | 'inProgress' | 'completed' | 'overdue';
type TaskPriority = 'high' | 'medium' | 'low';

interface MaintenanceTask { id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority; assignedTo: { initials: string; name: string }; progress: number; dueDate: string; location: string; }
interface MaintenanceData { totalTasks: number; lastUpdated: string; summary: { pending: number; inProgress: number; completed: number; overdue: number }; tasks: MaintenanceTask[]; }

const EMPTY_DATA: MaintenanceData = { totalTasks: 0, lastUpdated: new Date().toISOString(), summary: { pending: 0, inProgress: 0, completed: 0, overdue: 0 }, tasks: [] };

const AVATAR_COLORS = ['bg-violet-500', 'bg-sky-500', 'bg-teal-500', 'bg-orange-500', 'bg-rose-500'];
function getAvatarColor(initials: string): string { return AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length]; }

function SummaryBadge({ count, label, variant, t }: { count: number; label: string; variant: TaskStatus; t: (key: string) => string }) {
  const configs: Record<TaskStatus, { color: string; bg: string; border: string; icon: React.ElementType }> = {
    pending: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/40', border: 'border-amber-200 dark:border-amber-800', icon: Clock },
    inProgress: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/40', border: 'border-blue-200 dark:border-blue-800', icon: CircleDot },
    completed: { color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10', border: 'border-primary/20 dark:border-primary/20', icon: CheckCircle2 },
    overdue: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle },
  };
  const config = configs[variant];
  const Icon = config.icon;
  const labelMap: Record<TaskStatus, string> = { pending: 'pending', inProgress: 'active', completed: 'done', overdue: 'overdue' };
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg', config.bg, config.border, 'border')}>
      <Icon className={cn('h-3.5 w-3.5', config.color)} />
      <div className="flex flex-col leading-none"><span className={cn('text-sm font-bold', config.color)}>{count}</span><span className="text-[10px] text-muted-foreground">{t(labelMap[variant])}</span></div>
    </div>
  );
}

function TaskRow({ task, index, t }: { task: MaintenanceTask; index: number; t: (key: string) => string }) {
  const configs: Record<TaskStatus, { color: string; bg: string; border: string; labelKey: string }> = {
    pending: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/40', border: 'border-amber-200 dark:border-amber-800', labelKey: 'pending' },
    inProgress: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/40', border: 'border-blue-200 dark:border-blue-800', labelKey: 'inProgress' },
    completed: { color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10', border: 'border-primary/20 dark:border-primary/20', labelKey: 'done' },
    overdue: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-800', labelKey: 'overdue' },
  };
  const config = configs[task.status];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.3 }} className={cn('flex items-start gap-3 p-3 rounded-xl border transition-all duration-200', 'hover:shadow-sm hover:-translate-y-0.5', config.bg, config.border)}>
      <div className="flex-shrink-0 pt-1.5"><span className={cn('block h-2.5 w-2.5 rounded-full', task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-primary')} /></div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium truncate">{task.title}</span><Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0', config.color, config.border)}>{t(config.labelKey)}</Badge></div>
        <p className="text-xs text-muted-foreground truncate">{task.location}</p>
        {(task.status === 'inProgress' || task.status === 'overdue') && task.progress > 0 && (<div className="flex items-center gap-2"><Progress value={task.progress} className="h-1.5" /><span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{task.progress}%</span></div>)}
      </div>
      <div className="flex-shrink-0"><div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white', getAvatarColor(task.assignedTo.initials))} title={task.assignedTo.name}>{task.assignedTo.initials}</div></div>
    </motion.div>
  );
}

export function MaintenanceTrackerWidget() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true); setError(null);
    try {
      const response = await fetch('/api/dashboard/maintenance');
      const result = await response.json();
      if (result.success && result.data) { setData(result.data); setLastRefresh(new Date()); }
      else throw new Error(result.error?.message || t('failedToLoad'));
    } catch (err) {
      if (err instanceof Error && err.message !== 'Authentication required') console.error('[Maintenance] Fetch failed:', err.message);
      setError(null); setData(EMPTY_DATA); setLastRefresh(new Date());
    } finally { setIsLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(true); const interval = setInterval(() => fetchData(false), 3 * 60 * 1000); return () => clearInterval(interval); }, [fetchData]);

  const filteredTasks = data?.tasks.filter((task) => filter === 'all' || task.status === filter) ?? [];
  const filterOptions: { value: TaskStatus | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'all' }, { value: 'overdue', labelKey: 'overdue' }, { value: 'inProgress', labelKey: 'inProgress' }, { value: 'pending', labelKey: 'pending' }, { value: 'completed', labelKey: 'done' },
  ];

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2"><Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />{t('maintenanceTracker')}</CardTitle>
          <div className="flex items-center gap-1.5">
            {lastRefresh && !isLoading && <span className="text-[10px] text-muted-foreground">{lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchData(false)} disabled={isLoading}><RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="space-y-3"><div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center"><AlertCircle className="h-8 w-8 text-red-400 dark:text-red-300 mb-2" /><p className="text-sm text-muted-foreground">{t('failedToLoadMaintenance')}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>{t('retry')}</Button></div>
        ) : data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <SummaryBadge count={data.summary.overdue} label="overdue" variant="overdue" t={t} />
              <SummaryBadge count={data.summary.inProgress} label="active" variant="inProgress" t={t} />
              <SummaryBadge count={data.summary.pending} label="pending" variant="pending" t={t} />
              <SummaryBadge count={data.summary.completed} label="done" variant="completed" t={t} />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {filterOptions.map((opt) => <Button key={opt.value} variant={filter === opt.value ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-2.5 flex-shrink-0" onClick={() => setFilter(opt.value)}>{t(opt.labelKey)}</Button>)}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredTasks.length > 0 ? filteredTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} t={t} />) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">{t('noTasksInCategory')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

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
  Wrench,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowUpCircle,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type RequestPriority = 'critical' | 'high' | 'medium' | 'low';
type RequestStatus = 'inProgress' | 'pending' | 'completed';

interface MaintenanceRequest {
  id: string;
  roomNumber: string;
  issueType: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  assignedTechnician: string;
  createdAt: string;
  estimatedCompletion: string;
  progress: number;
}

interface MaintenanceStats {
  totalActive: number;
  critical: number;
  avgResolutionTime: string;
  completedToday: number;
  pendingToday: number;
}

interface MaintenanceProData {
  stats: MaintenanceStats;
  requests: MaintenanceRequest[];
}

// ─── Priority Config ───────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<RequestPriority, {
  color: string;
  bg: string;
  border: string;
  badge: string;
  label: string;
  icon: React.ElementType;
}> = {
  critical: {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-200 dark:border-red-800/60',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border-red-200 dark:border-red-800',
    label: 'Critical',
    icon: ShieldAlert,
  },
  high: {
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800/60',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    label: 'High',
    icon: Shield,
  },
  medium: {
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    border: 'border-teal-200 dark:border-teal-800/60',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    label: 'Medium',
    icon: Shield,
  },
  low: {
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700/60',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    label: 'Low',
    icon: ShieldCheck,
  },
};

const STATUS_CONFIG: Record<RequestStatus, {
  color: string;
  label: string;
  icon: React.ElementType;
  progressColor: string;
}> = {
  inProgress: {
    color: 'text-amber-600 dark:text-amber-400',
    label: 'In Progress',
    icon: Loader2,
    progressColor: 'bg-gradient-to-r from-amber-400 to-amber-500',
  },
  pending: {
    color: 'text-slate-500 dark:text-slate-400',
    label: 'Pending',
    icon: Clock,
    progressColor: 'bg-gradient-to-r from-slate-300 to-slate-400',
  },
  completed: {
    color: 'text-emerald-600 dark:text-emerald-400',
    label: 'Completed',
    icon: CheckCircle2,
    progressColor: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
  },
};

// ─── Skeleton Loader ────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-amber-400 to-teal-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  gradientFrom,
  gradientTo,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        'relative p-3 rounded-xl border border-border/40 overflow-hidden',
        'bg-card hover:shadow-md transition-shadow'
      )}
    >
      <div className={cn(
        'absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r',
        gradientFrom,
        gradientTo
      )} />
      <div className="flex items-center gap-2">
        <div className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
          gradientFrom,
          gradientTo,
          'shadow-sm'
        )}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Request Row ────────────────────────────────────────────────────────

function RequestRow({
  request,
  index,
  t,
  onEscalate,
  onComplete,
}: {
  request: MaintenanceRequest;
  index: number;
  t: (key: string) => string;
  onEscalate: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const statusCfg = STATUS_CONFIG[request.status];
  const PriorityIcon = priorityCfg.icon;
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className={cn(
        'p-3 rounded-xl border transition-all duration-200',
        'hover:shadow-sm hover:-translate-y-0.5',
        priorityCfg.bg,
        priorityCfg.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Priority indicator */}
        <div className="flex-shrink-0 mt-0.5">
          <PriorityIcon className={cn('h-4 w-4', priorityCfg.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-foreground">
                Room {request.roomNumber}
              </span>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0 border', priorityCfg.badge)}>
                {request.priority}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0 border', statusCfg.color, 'bg-background/50')}>
                <StatusIcon className={cn('h-2.5 w-2.5 mr-0.5', request.status === 'inProgress' && 'animate-spin')} />
                {t(`maintenancePro${request.status.charAt(0).toUpperCase() + request.status.slice(1)}` as keyof typeof t) || statusCfg.label}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground truncate">{request.description}</p>

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {request.issueType}
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span className="font-medium text-foreground/70">{request.assignedTechnician}</span>
          </div>

          {/* Progress bar (if in progress) */}
          {(request.status === 'inProgress' || request.status === 'completed') && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', statusCfg.progressColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${request.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.06 + 0.2 }}
                />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-8 text-right">
                {request.progress}%
              </span>
            </div>
          )}

          {/* Action buttons */}
          {request.status !== 'completed' && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/40"
                onClick={() => onEscalate(request.id)}
              >
                <ArrowUpCircle className="h-3 w-3 mr-1" />
                {t('maintenanceProEscalate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/40"
                onClick={() => onComplete(request.id)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('maintenanceProMarkComplete')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function MaintenanceTrackerProWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<MaintenanceProData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success && result.data?.maintenanceRequests) {
        setData(result.data.maintenanceRequests as MaintenanceProData);
      } else {
        setError(t('failedToLoadMaintenance'));
      }
    } catch {
      setError(t('failedToLoadMaintenance'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => { fetchData(true); }, 0);
    const interval = setInterval(() => fetchData(false), 120000); // Auto-refresh every 120s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleEscalate = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      const priorityOrder: RequestPriority[] = ['low', 'medium', 'high', 'critical'];
      return {
        ...prev,
        requests: prev.requests.map(r =>
          r.id === id
            ? { ...r, priority: priorityOrder[Math.min(priorityOrder.indexOf(r.priority) + 1, priorityOrder.length - 1)] }
            : r
        ),
      };
    });
  }, []);

  const handleComplete = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        requests: prev.requests.map(r =>
          r.id === id ? { ...r, status: 'completed' as RequestStatus, progress: 100 } : r
        ),
      };
    });
  }, []);

  const filteredRequests = data?.requests.filter(r => {
    const matchPriority = filter === 'all' || r.priority === filter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchPriority && matchStatus;
  }) ?? [];

  if (isLoading) return <SkeletonLoader />;

  if (error && !data) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm text-muted-foreground">{t('failedToLoadMaintenance')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(true)}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Top gradient accent */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-amber-400 to-teal-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Wrench className="h-3.5 w-3.5 text-white" />
            </div>
            {t('maintenanceTrackerPro')}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchData(false)}
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label={t('maintenanceProTotalActive')}
            value={data.stats.totalActive}
            icon={Wrench}
            gradientFrom="from-emerald-500"
            gradientTo="to-teal-500"
            delay={0.1}
          />
          <StatCard
            label={t('maintenanceProCritical')}
            value={data.stats.critical}
            icon={ShieldAlert}
            gradientFrom="from-red-500"
            gradientTo="to-rose-500"
            delay={0.2}
          />
          <StatCard
            label={t('maintenanceProAvgResTime')}
            value={data.stats.avgResolutionTime}
            icon={Clock}
            gradientFrom="from-amber-500"
            gradientTo="to-orange-500"
            delay={0.3}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-[10px] px-2 flex-shrink-0"
              onClick={() => setFilter('all')}
            >
              {t('all')}
            </Button>
            {(['critical', 'high', 'medium', 'low'] as RequestPriority[]).map(p => (
              <Button
                key={p}
                variant={filter === p ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 text-[10px] px-2 flex-shrink-0',
                  filter === p && PRIORITY_CONFIG[p].badge
                )}
                onClick={() => setFilter(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(['all', 'inProgress', 'pending', 'completed'] as const).map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-[10px] px-2 flex-shrink-0"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? t('all') : t(`maintenancePro${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof t) || s}
              </Button>
            ))}
          </div>
        </div>

        {/* Request List */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          <AnimatePresence mode="popLayout">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((request, index) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  index={index}
                  t={t}
                  onEscalate={handleEscalate}
                  onComplete={handleComplete}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-8 text-center"
              >
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('noTasksInCategory')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

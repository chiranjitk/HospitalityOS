'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn,
  LogOut,
  CreditCard,
  Sparkles,
  Wrench,
  MessageSquare,
  Wifi,
  Settings,
  ArrowRight,
  Clock,
  User,
  RoomService,
  Shield,
  RefreshCw,
  Filter,
  Activity,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  type: 'check_in' | 'check_out' | 'payment' | 'service' | 'maintenance' | 'message' | 'wifi' | 'system';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  room?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'info';
}

// ─── Icon & Style Maps ──────────────────────────────────────────────────

const typeConfig: Record<TimelineEvent['type'], {
  icon: typeof LogIn;
  gradient: string;
  bg: string;
  iconColor: string;
  dotColor: string;
  label: string;
}> = {
  check_in: {
    icon: LogIn,
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    label: 'Check-in',
  },
  check_out: {
    icon: LogOut,
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    label: 'Check-out',
  },
  payment: {
    icon: CreditCard,
    gradient: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    dotColor: 'bg-violet-500',
    label: 'Payment',
  },
  service: {
    icon: Sparkles,
    gradient: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    dotColor: 'bg-cyan-500',
    label: 'Service',
  },
  maintenance: {
    icon: Wrench,
    gradient: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    dotColor: 'bg-rose-500',
    label: 'Maintenance',
  },
  message: {
    icon: MessageSquare,
    gradient: 'from-sky-500 to-blue-500',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    dotColor: 'bg-sky-500',
    label: 'Message',
  },
  wifi: {
    icon: Wifi,
    gradient: 'from-primary to-teal-500',
    bg: 'bg-primary/10 dark:bg-primary/10',
    iconColor: 'text-primary',
    dotColor: 'bg-primary',
    label: 'WiFi',
  },
  system: {
    icon: Settings,
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    iconColor: 'text-slate-500 dark:text-slate-400',
    dotColor: 'bg-slate-400',
    label: 'System',
  },
};

const statusConfig: Record<TimelineEvent['status'], { label: string; badgeBg: string; badgeText: string }> = {
  completed: { label: 'Done', badgeBg: 'bg-emerald-100 dark:bg-emerald-950/50', badgeText: 'text-emerald-700 dark:text-emerald-400' },
  in_progress: { label: 'Active', badgeBg: 'bg-amber-100 dark:bg-amber-950/50', badgeText: 'text-amber-700 dark:text-amber-400' },
  pending: { label: 'Pending', badgeBg: 'bg-slate-100 dark:bg-slate-800/50', badgeText: 'text-slate-600 dark:text-slate-400' },
  info: { label: 'Info', badgeBg: 'bg-sky-100 dark:bg-sky-950/50', badgeText: 'text-sky-700 dark:text-sky-400' },
};

// ─── Utility: Relative time ─────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}



// ─── Skeleton Loader ────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="space-y-3 pl-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single Timeline Item ───────────────────────────────────────────────

function TimelineItem({ event, index }: { event: TimelineEvent; index: number }) {
  const config = typeConfig[event.type];
  const statusCfg = statusConfig[event.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      className="group relative flex gap-3 py-2"
    >
      {/* Timeline connector line */}
      <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border/40" />

      {/* Icon node */}
      <div className="relative z-10 flex-shrink-0">
        <div className={cn(
          "flex items-center justify-center h-8 w-8 rounded-lg shadow-sm transition-all duration-200",
          "bg-gradient-to-br group-hover:scale-110 group-hover:shadow-md",
          config.gradient
        )}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground truncate">{event.title}</h4>
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1.5 py-0 h-4 rounded-full border-transparent font-medium",
                  statusCfg.badgeBg, statusCfg.badgeText
                )}
              >
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Clock className="h-2.5 w-2.5" />
                {getRelativeTime(event.timestamp)}
              </span>
              {event.room && (
                <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
                  Rm {event.room}
                </span>
              )}
              {event.user && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                  <User className="h-2.5 w-2.5" />
                  {event.user}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function ActivityTimelineWidget() {
  const t = useTranslations('dashboard');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | TimelineEvent['type']>('all');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.recentActivity) {
          const mapped = json.data.recentActivity.slice(0, 8).map((a: any) => {
            const typeMap: Record<string, TimelineEvent['type']> = {
              booking: 'system', check_in: 'check_in', check_out: 'check_out', payment: 'payment',
            };
            return {
              id: a.id,
              type: typeMap[a.type] || 'system',
              title: a.title || 'Activity',
              description: `${a.guest?.name || 'Guest'} — ${a.description || a.room || ''}`,
              timestamp: a.timestamp || new Date().toISOString(),
              user: a.guest?.name,
              room: a.room,
              status: a.status === 'completed' ? 'completed' as const : 'info' as const,
            };
          });
          setEvents(mapped);
        } else {
          setEvents([]);
          setError(true);
        }
      } else {
        setEvents([]);
        setError(true);
      }
    } catch {
      setEvents([]);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchEvents, 0);
    const interval = setInterval(fetchEvents, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [fetchEvents]);

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter);

  const filterTypes: Array<{ value: typeof filter; icon: typeof LogIn; label: string }> = [
    { value: 'all', icon: Activity, label: 'All' },
    { value: 'check_in', icon: LogIn, label: 'Check-in' },
    { value: 'check_out', icon: LogOut, label: 'Check-out' },
    { value: 'service', icon: Sparkles, label: 'Service' },
    { value: 'payment', icon: CreditCard, label: 'Payment' },
  ];

  return (
    <Card className="border border-border/60 shadow-md rounded-2xl bg-card overflow-hidden">
      {/* Top accent gradient */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('activityTimeline')}</h3>
              <p className="text-[10px] text-muted-foreground/60">{t('activityTimelineDesc')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-muted/60 transition-all"
            onClick={fetchEvents}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 no-scrollbar">
          {filterTypes.map((ft) => (
            <button
              key={ft.value}
              onClick={() => setFilter(ft.value)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200",
                filter === ft.value
                  ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <ft.icon className="h-3 w-3" />
              {ft.label}
            </button>
          ))}
        </div>

        {/* Timeline content */}
        {isLoading ? (
          <TimelineSkeleton />
        ) : error && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-3 mb-2">
              <Shield className="h-6 w-6 text-red-400 dark:text-red-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Unable to load data.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setError(false); fetchEvents(); }}>Retry</Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted/50 p-3 mb-2">
              <Shield className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No activity found</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Events will appear here as they happen</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto pr-1">
            <AnimatePresence>
              {filteredEvents.map((event, index) => (
                <TimelineItem key={event.id} event={event} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

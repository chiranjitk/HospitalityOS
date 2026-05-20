'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import {
  Sun,
  Moon,
  CloudSun,
  Calendar,
  Bell,
  BellRing,
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle2,
  ArrowRight,
  Bed,
  Users,
  LogIn,
  LogOut,
  Building2,
  Zap,
  Radio,
  Coffee,
  Wrench,
  BarChart3,
  MessageSquare,
  Crown,
  Wifi,
  Activity,
  IndianRupee,
  CalendarPlus,
  Sparkles,
  DoorOpen,
  X,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KPICards } from './kpi-cards';
import { QuickActions } from './quick-actions';

import { UpcomingArrivals } from './upcoming-arrivals';
import { RoomStatusWidget } from './room-status-widget';
import { GuestSatisfactionWidget } from './guest-satisfaction-widget';
import { StaffOnDutyWidget } from './staff-on-duty';
import { RecentActivityFeed } from './recent-activity-feed';
import { TodaysSchedule } from './todays-schedule';
import { UpcomingEventsWidget } from './widgets/upcoming-events';
import { PerformanceScoreWidget } from './widgets/performance-score';

import GuestFeedbackWidget from './widgets/guest-feedback';
import { DashboardHeader } from './dashboard-header';
import { MiniCalendarWidget } from './widgets/mini-calendar';
import { ShiftSummaryWidget } from './widgets/shift-summary';
import { OperationsBoardWidget } from './widgets/operations-board';
import { MaintenanceTrackerWidget } from './widgets/maintenance-tracker';
import { LoyaltyWidget } from './widgets/loyalty-widget';

import { GuestSegmentsWidget } from './widgets/guest-segments';
import { GuestCommunicationWidget } from './widgets/guest-communication';
import StaffPerformanceWidget from './widgets/staff-performance';
import { ChannelPerformanceWidget } from './widgets/channel-performance-widget';
import { QuickNotesStickyWidget } from './widgets/quick-notes-widget';
import { TodaysTasksWidget } from './widgets/todays-tasks';
import { SystemHealthStatusWidget } from './widgets/system-health-widget';
import { WiFiLiveStatsWidget } from './widgets/wifi-live-stats-widget';
import { WiFiAnalyticsWidget } from './widgets/wifi-analytics-widget';
import { WeatherWidget } from './widgets/weather-widget';
import { TaskRemindersWidget } from './widgets/task-reminders-widget';
import { GuestJourneyPipelineWidget } from './widgets/guest-journey-pipeline';
import { DailyPerformanceScoreWidget } from './widgets/daily-performance-score';

import { PropertyPerformanceWidget } from './widgets/property-performance-widget';
import { QuickInsightsWidget } from './widgets/quick-insights';
import { PropertyStatusSummaryWidget } from './widgets/property-status-summary';
import { WelcomeBannerWidget } from './widgets/welcome-banner';
import { RoomOccupancyBreakdownWidget } from './widgets/room-occupancy-breakdown';
import { ActivityTimelineWidget } from './widgets/activity-timeline';
import { StaffDutyRosterWidget } from './widgets/staff-duty-roster';
import { RevenueForecastWidget } from './widgets/revenue-forecast';
import { GuestDemographicsWidget } from './widgets/guest-demographics';
import { MaintenanceTrackerProWidget } from './widgets/maintenance-tracker-pro';

import { GuestFeedbackSummaryWidget } from './widgets/guest-feedback-summary';
import GuestSentimentAnalyticsWidget from './widgets/guest-sentiment-analytics-widget';
import { WeatherForecastWidget } from './widgets/weather-forecast-widget';
import { LoyaltyTierWidget } from './widgets/loyalty-tier-widget';
import { MiniRevenueChart } from './widgets/mini-revenue-chart';
import { LazySection } from './lazy-section';
import { RoomFloorPlanWidget } from './widgets/room-floor-plan-widget';
import { RoomStatusOverview } from './room-status-overview';

const DashboardCharts = dynamic(
  () => import('@/components/dashboard/charts').then(m => ({ default: m.DashboardCharts ?? m.default })),
  { ssr: false, loading: () => <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /><div className="h-64 bg-muted rounded" /></div> }
);

const RevenueTrendWidget = dynamic(
  () => import('@/components/dashboard/revenue-trend-widget').then(m => ({ default: m.RevenueTrendWidget ?? m.default })),
  { ssr: false, loading: () => <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /><div className="h-64 bg-muted rounded" /></div> }
);

const RevenueBreakdownWidget = dynamic(
  () => import('@/components/dashboard/widgets/revenue-breakdown').then(m => ({ default: m.RevenueBreakdownWidget ?? m.default })),
  { ssr: false, loading: () => <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /><div className="h-48 bg-muted rounded" /></div> }
);

const RatePlanComparisonWidget = dynamic(
  () => import('@/components/dashboard/widgets/rate-plan-comparison').then(m => ({ default: m.RatePlanComparisonWidget ?? m.default })),
  { ssr: false, loading: () => <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /><div className="h-48 bg-muted rounded" /></div> }
);

const RevenueBreakdownDonutWidget = dynamic(
  () => import('@/components/dashboard/widgets/revenue-breakdown-donut').then(m => ({ default: m.RevenueBreakdownDonutWidget ?? m.default })),
  { ssr: false, loading: () => <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-4" /><div className="h-48 bg-muted rounded" /></div> }
);

const OccupancyHeatmap = dynamic(
  () => import('@/components/dashboard/occupancy-heatmap').then(m => ({ default: m.OccupancyHeatmap ?? m.default })),
  { ssr: false, loading: () => <div className="h-48 bg-muted/50 rounded-2xl animate-pulse" /> }
);

// ─── Types ──────────────────────────────────────────────────────────────

interface TodaySummary {
  date: string;
  dayName: string;
  currentTime: string;
  arrivals: number;
  departures: number;
  inHouse: number;
  availableRooms: number;
  occupancy: number;
  revenue: number;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
    action?: string;
    section?: string;
    read?: boolean;
  }>;
}

// ─── Count-up animation hook ────────────────────────────────────────────

function useCountUp(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasStarted) setHasStarted(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [hasStarted, target, duration]);

  return { count, ref };
}

// ─── Animated background mesh ───────────────────────────────────────────

function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-primary/12 to-primary/8 blur-3xl animate-[float1_8s_ease-in-out_infinite]" />
      <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-gradient-to-br from-amber-400/10 to-orange-400/6 blur-3xl animate-[float2_10s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-br from-violet-400/6 to-purple-400/5 blur-3xl animate-[float3_12s_ease-in-out_infinite]" />
    </div>
  );
}

// ─── Live Pulse ─────────────────────────────────────────────────────────

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2 ml-1">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-50" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
    </span>
  );
}

// ─── Today's Summary Card ───────────────────────────────────────────────

function TodaySummaryCard({ summary, isLoading }: { summary: TodaySummary | null; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();
  const t = useTranslations('dashboard');

  const arrivalsCount = useCountUp(summary?.arrivals || 0);
  const departuresCount = useCountUp(summary?.departures || 0);
  const inHouseCount = useCountUp(summary?.inHouse || 0);
  const availableCount = useCountUp(summary?.availableRooms || 0);

  if (isLoading || !summary) {
    return (
      <Card className="card-accent border border-border/60 rounded-2xl bg-card">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      label: t('arrivals'), count: arrivalsCount, icon: LogIn,
      gradient: 'from-emerald-500 to-teal-500',
      cardBg: 'bg-gradient-to-br from-emerald-50/50 via-white/80 to-teal-50/30 dark:from-emerald-950/20 dark:via-card/90 dark:to-teal-950/15',
      hoverBg: 'group-hover:from-emerald-50/80 group-hover:via-white group-hover:to-teal-50/50 dark:group-hover:from-emerald-950/40 dark:group-hover:via-card dark:group-hover:to-teal-950/30',
      borderColor: 'border-emerald-200/40 dark:border-emerald-800/30',
      hoverBorder: 'group-hover:border-emerald-300/70 dark:group-hover:border-emerald-700/50',
      section: 'frontdesk-checkin',
      glowColor: '0 0 25px -5px oklch(0.65 0.16 160 / 0.35)',
      textGradient: 'bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400',
      ringGradient: 'from-emerald-200/50 to-teal-200/50 dark:from-emerald-500/25 dark:to-teal-500/25',
    },
    {
      label: t('departures'), count: departuresCount, icon: LogOut,
      gradient: 'from-amber-500 to-orange-500',
      cardBg: 'bg-gradient-to-br from-amber-50/50 via-white/80 to-orange-50/30 dark:from-amber-950/20 dark:via-card/90 dark:to-orange-950/15',
      hoverBg: 'group-hover:from-amber-50/80 group-hover:via-white group-hover:to-orange-50/50 dark:group-hover:from-amber-950/40 dark:group-hover:via-card dark:group-hover:to-orange-950/30',
      borderColor: 'border-amber-200/40 dark:border-amber-800/30',
      hoverBorder: 'group-hover:border-amber-300/70 dark:group-hover:border-amber-700/50',
      section: 'frontdesk-checkout',
      glowColor: '0 0 25px -5px oklch(0.75 0.15 75 / 0.35)',
      textGradient: 'bg-gradient-to-r from-amber-600 to-orange-500 dark:from-amber-400 dark:to-orange-400',
      ringGradient: 'from-amber-200/50 to-orange-200/50 dark:from-amber-500/25 dark:to-orange-500/25',
    },
    {
      label: t('inHouse'), count: inHouseCount, icon: Users,
      gradient: 'from-violet-500 to-purple-500',
      cardBg: 'bg-gradient-to-br from-violet-50/50 via-white/80 to-purple-50/30 dark:from-violet-950/20 dark:via-card/90 dark:to-purple-950/15',
      hoverBg: 'group-hover:from-violet-50/80 group-hover:via-white group-hover:to-purple-50/50 dark:group-hover:from-violet-950/40 dark:group-hover:via-card dark:group-hover:to-purple-950/30',
      borderColor: 'border-violet-200/40 dark:border-violet-800/30',
      hoverBorder: 'group-hover:border-violet-300/70 dark:group-hover:border-violet-700/50',
      section: 'guests-list',
      glowColor: '0 0 25px -5px oklch(0.55 0.15 310 / 0.35)',
      textGradient: 'bg-gradient-to-r from-violet-600 to-purple-500 dark:from-violet-400 dark:to-purple-400',
      ringGradient: 'from-violet-200/50 to-purple-200/50 dark:from-violet-500/25 dark:to-purple-500/25',
    },
    {
      label: t('available'), count: availableCount, icon: Bed,
      gradient: 'from-cyan-500 to-teal-500',
      cardBg: 'bg-gradient-to-br from-cyan-50/50 via-white/80 to-teal-50/30 dark:from-cyan-950/20 dark:via-card/90 dark:to-teal-950/15',
      hoverBg: 'group-hover:from-cyan-50/80 group-hover:via-white group-hover:to-teal-50/50 dark:group-hover:from-cyan-950/40 dark:group-hover:via-card dark:group-hover:to-teal-950/30',
      borderColor: 'border-cyan-200/40 dark:border-cyan-800/30',
      hoverBorder: 'group-hover:border-cyan-300/70 dark:group-hover:border-cyan-700/50',
      section: 'frontdesk-room-grid',
      glowColor: '0 0 25px -5px oklch(0.65 0.16 190 / 0.35)',
      textGradient: 'bg-gradient-to-r from-cyan-600 to-teal-500 dark:from-cyan-400 dark:to-teal-400',
      ringGradient: 'from-cyan-200/50 to-teal-200/50 dark:from-cyan-500/25 dark:to-teal-500/25',
    },
  ];

  return (
    <Card className="card-accent border border-border/60 rounded-2xl bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('todaysOverview')}</h3>
            <LivePulse />
          </div>
          <Badge variant="outline" className="text-[11px] rounded-full border-primary/40 text-primary bg-primary/10 font-medium">
            {summary.dayName}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              ref={stat.count.ref as React.RefObject<HTMLDivElement>}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.04, y: -4 }}
              className={cn(
                "relative p-4 sm:p-5 rounded-xl cursor-pointer transition-all duration-300",
                "border overflow-hidden group",
                stat.cardBg,
                stat.borderColor,
                stat.hoverBorder,
                "hover:shadow-xl"
              )}
              style={{ '--stat-glow': stat.glowColor } as React.CSSProperties}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = stat.glowColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
              onClick={() => setActiveSection(stat.section)}
            >
              {/* Enhanced gradient background — always slightly visible, stronger on hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br transition-opacity duration-500",
                stat.cardBg,
                stat.hoverBg
              )} />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2.5">
                  {/* Icon with outer ring glow */}
                  <div className="relative">
                    <div className={cn(
                      "absolute -inset-[2px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-500",
                      "bg-gradient-to-br",
                      stat.ringGradient
                    )} />
                    <div className={cn(
                      "relative h-9 w-9 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-md",
                      "transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
                      "ring-1 ring-white/50 dark:ring-white/20",
                      stat.gradient
                    )}>
                      <stat.icon className="h-4 w-4 text-white drop-shadow-sm" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{stat.label}</p>
                <p className={cn("text-2xl font-extrabold font-mono tabular-nums bg-clip-text", stat.textGradient)} style={{ fontFeatureSettings: 'tnum', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {stat.count.count}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
        {summary.arrivals === 0 && summary.departures === 0 && summary.inHouse === 0 && summary.availableRooms === 0 && (
          <p className="text-center text-xs text-muted-foreground/50 mt-3">{t('noActivityToday')}</p>
        )}

      </CardContent>
    </Card>
  );
}

// ─── Section Divider ────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -12 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex items-center gap-3 py-1.5"
    >
      {/* Left decorative dot */}
      <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
      {/* Icon badge */}
      <div className="section-header-icon">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      {/* Title with gradient underline */}
      <h2 className="section-gradient-underline section-header-title">{title}</h2>
      {/* Animated gradient line */}
      <div className="section-header-line section-header-line-animated" />
      {/* Right decorative dot */}
      <span className="w-1 h-1 rounded-full bg-primary/25 shrink-0" />
    </motion.div>
  );
}

// ─── Animated Alert Icon ───────────────────────────────────────────────

function AnimatedAlertIcon({ type, className }: { type: string; className?: string }) {
  const iconMap: Record<string, { Icon: LucideIcon; color: string; animation: string }> = {
    error: {
      Icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      animation: 'animate-[alertShake_0.6s_ease-in-out_infinite]',
    },
    warning: {
      Icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      animation: 'animate-[alertPulse_2s_ease-in-out_infinite]',
    },
    info: {
      Icon: Info,
      color: 'text-sky-600 dark:text-sky-400',
      animation: 'animate-[alertFloat_3s_ease-in-out_infinite]',
    },
    success: {
      Icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      animation: 'animate-[alertCheck_0.8s_ease-in-out]',
    },
  };
  const config = iconMap[type] || iconMap.info;

  return (
    <motion.div
      className={cn("flex-shrink-0", config.color)}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.05 }}
    >
      <config.Icon className={cn("h-4 w-4", className, config.animation)} />
    </motion.div>
  );
}

// ─── Alerts Widget ──────────────────────────────────────────────────────

function AlertsWidget({ alerts, isLoading }: { alerts: TodaySummary['alerts']; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();
  const t = useTranslations('dashboard');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <Card className="card-accent border border-border/60 rounded-2xl bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertStyles: Record<string, { bg: string; iconBg: string; borderColor: string; ringColor: string }> = {
    error: { bg: 'bg-red-50 dark:bg-red-950/30', iconBg: 'bg-red-100 dark:bg-red-900/50', borderColor: 'border-l-red-500', ringColor: 'ring-red-500/20' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', iconBg: 'bg-amber-100 dark:bg-amber-900/50', borderColor: 'border-l-amber-500', ringColor: 'ring-amber-500/20' },
    info: { bg: 'bg-sky-50 dark:bg-sky-950/30', iconBg: 'bg-sky-100 dark:bg-sky-900/50', borderColor: 'border-l-sky-500', ringColor: 'ring-sky-500/20' },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50', borderColor: 'border-l-emerald-500', ringColor: 'ring-emerald-500/20' },
  };

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id)).slice(0, 5);
  const unreadCount = visibleAlerts.filter(a => !readIds.has(a.id) && !a.read).length;

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds(prev => new Set(prev).add(id));
  };

  const handleMarkRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReadIds(prev => new Set(prev).add(id));
  };

  const handleMarkAllRead = () => {
    setReadIds(prev => {
      const next = new Set(prev);
      visibleAlerts.forEach(a => next.add(a.id));
      return next;
    });
  };

  return (
    <Card className="card-accent border border-border/60 rounded-2xl bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <BellRing className="h-4 w-4 text-amber-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t('alerts')}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3 w-3" />
                <span className="hidden sm:inline">{t('markAllRead')}</span>
              </Button>
            )}
            {visibleAlerts.length > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[11px] font-semibold",
                  unreadCount > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                )}
              >
                {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
              </Badge>
            )}
          </div>
        </div>
        {visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="rounded-full bg-primary/10 dark:bg-primary/10 p-3 mb-2 ring-4 ring-primary/30"
            >
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </motion.div>
            <p className="text-sm font-semibold">{t('allClear')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('noPendingAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
            <AnimatePresence initial={false}>
              {visibleAlerts.map((alert, idx) => {
                const isRead = readIds.has(alert.id) || alert.read;
                const style = alertStyles[alert.type] || alertStyles.info;
                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, x: -16, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.9, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.03 }}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                      "hover:shadow-sm hover:-translate-y-0.5 border-l-[3px] group/alert",
                      style.bg,
                      style.borderColor,
                      isRead && "opacity-60"
                    )}
                    onClick={() => alert.section && setActiveSection(alert.section)}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ring-1",
                      style.iconBg,
                      style.ringColor
                    )}>
                      <AnimatedAlertIcon type={alert.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <p className={cn("text-sm truncate", isRead ? "font-medium text-muted-foreground" : "font-semibold text-foreground")}>
                          {alert.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.message}</p>
                      {/* Action buttons on hover */}
                      <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover/alert:opacity-100 transition-opacity">
                        {!isRead && (
                          <button
                            type="button"
                            onClick={handleMarkRead.bind(null, alert.id)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            <CheckCheck className="h-3 w-3" />
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDismiss.bind(null, alert.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 hover:bg-muted/60 transition-colors text-xs font-medium"
          onClick={() => setActiveSection('notifications')}
        >
          View All Alerts
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Floating Quick Actions Bar ─────────────────────────────────────────

const FLOATING_ACTIONS = [
  { label: 'New Booking', icon: CalendarPlus, gradient: 'from-primary to-emerald-500', section: 'bookings-calendar' },
  { label: 'Check-in Guest', icon: LogIn, gradient: 'from-teal-400 to-teal-600', section: 'frontdesk-checkin' },
  { label: 'Service Request', icon: Sparkles, gradient: 'from-cyan-400 to-teal-500', section: 'experience-requests' },
  { label: 'Room Status', icon: DoorOpen, gradient: 'from-slate-400 to-slate-600', section: 'frontdesk-room-grid' },
  { label: 'Reports', icon: BarChart3, gradient: 'from-violet-400 to-purple-500', section: 'reports-revenue' },
];

function FloatingQuickActionsBar() {
  const { setActiveSection } = useUIStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
        >
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-2xl",
            "bg-background/70 backdrop-blur-xl border border-border/50",
            "shadow-lg shadow-black/[0.08] shadow-primary/[0.04]"
          )}>
            {/* Gradient top accent */}
            <div className="absolute -top-px left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-primary/60 via-teal-400/40 to-amber-400/30" />
            {FLOATING_ACTIONS.map((action, i) => (
              <motion.div
                key={action.section}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.1 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActiveSection(action.section)}
                      className={cn(
                        "relative flex items-center justify-center w-10 h-10 rounded-xl",
                        "transition-all duration-200 hover:scale-110 active:scale-95",
                        "bg-gradient-to-br shadow-sm hover:shadow-md",
                        action.gradient
                      )}
                    >
                      <action.icon className="h-4.5 w-4.5 text-white" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="text-xs font-medium rounded-lg">
                    {action.label}
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Quick Stats Ticker ─────────────────────────────────────────────────

function QuickStatsTicker({ summary, isLoading }: { summary: TodaySummary | null; isLoading: boolean }) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (tickerRef.current) {
        setShouldScroll(tickerRef.current.scrollWidth > tickerRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [summary]);

  if (isLoading || !summary) {
    return (
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-amber-500/10 rounded-lg p-2.5">
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-20 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    {
      icon: Activity,
      label: 'Occupancy',
      value: `${summary.occupancy}%`,
      color: 'text-teal-600 dark:text-teal-400',
    },
    {
      icon: Users,
      label: 'Active Guests',
      value: `${summary.inHouse}`,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: IndianRupee,
      label: "Today's Revenue",
      value: `₹${summary.revenue.toLocaleString('en-IN')}`,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      icon: Bed,
      label: 'Available Rooms',
      value: `${summary.availableRooms}`,
      color: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      icon: Wrench,
      label: 'Service Requests',
      value: `${summary.alerts.length}`,
      color: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-amber-500/10 rounded-lg overflow-hidden"
    >
      <div
        ref={tickerRef}
        className={cn(
          "flex items-center gap-3 p-2.5 text-xs",
          shouldScroll && "overflow-x-auto scrollbar-none"
        )}
      >
        {metrics.map((metric, idx) => (
          <React.Fragment key={metric.label}>
            {idx > 0 && (
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
            )}
            <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <metric.icon className={cn("h-3 w-3 text-muted-foreground")} />
              <span className="text-muted-foreground hidden sm:inline">{metric.label}:</span>
              <span className={cn("font-semibold font-mono tabular-nums", metric.color)}>
                {metric.value}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Overview Dashboard ────────────────────────────────────────────

export default function OverviewDashboard() {
  const { data: dashboardData, isLoading, isRefreshing, lastUpdated, refresh } = useDashboardData();
  const t = useTranslations('dashboard');

  // Derive the TodaySummary from the shared dashboard data
  const summary = useMemo<TodaySummary | null>(() => {
    if (!dashboardData) return null;

    const alerts: TodaySummary['alerts'] = [];
    if (dashboardData.alerts) {
      for (const alert of dashboardData.alerts) {
        alerts.push({
          id: alert.id,
          type: alert.severity === 'critical' ? 'error' : alert.type === 'room' ? 'info' : 'warning',
          title: alert.title,
          message: alert.message,
          section: alert.type === 'inventory' ? 'inventory-stock' : alert.type === 'service' ? 'experience-requests' : 'housekeeping-status',
          action: 'View',
        });
      }
    }

    return {
      date: new Date().toISOString(),
      dayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      currentTime: new Date().toISOString(),
      arrivals: dashboardData.stats?.guests?.arriving ?? 0,
      departures: dashboardData.stats?.guests?.departing ?? 0,
      inHouse: dashboardData.stats?.guests?.checkedIn ?? 0,
      availableRooms: dashboardData.commandCenter?.rooms?.available ?? 0,
      occupancy: dashboardData.stats?.occupancy?.today ?? 0,
      revenue: dashboardData.stats?.revenue?.today ?? 0,
      alerts,
    };
  }, [dashboardData]);

  return (
    <>
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(12px, -8px) scale(1.05); }
          66% { transform: translate(-6px, 6px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-10px, 8px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(calc(-50% + 15px), calc(-50% - 10px)) scale(1.05); }
        }
        @keyframes wave {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
          60% { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientSlide {
          0%, 100% { opacity: 0.3; transform: translateX(-30%); }
          50% { opacity: 1; transform: translateX(30%); }
        }
        @keyframes alertShake {
          0%, 100% { transform: rotate(0deg); }
          10%, 50%, 90% { transform: rotate(-3deg); }
          30%, 70% { transform: rotate(3deg); }
        }
        @keyframes alertPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes alertFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes alertCheck {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[alertShake_0\\.6s_ease-in-out_infinite\\],
          .animate-\\[alertPulse_2s_ease-in-out_infinite\\],
          .animate-\\[alertFloat_3s_ease-in-out_infinite\\],
          .animate-\\[alertCheck_0\\.8s_ease-in-out\\] {
            animation: none !important;
          }
        }
      `}</style>

      <div className="space-y-5 relative">
        <MeshBackground />

        {/* ── Welcome Banner ── */}
        <div className="relative z-10">
          <WelcomeBannerWidget />
        </div>

        {/* ── Quick Stats Ticker ── */}
        <div className="relative z-10">
          <QuickStatsTicker summary={summary} isLoading={isLoading} />
        </div>

        {/* ── Live data bar ── */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-40" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
            </div>
            <span>{t('liveData')}</span>
          </div>
          <DashboardHeader
            onRefresh={refresh}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated || undefined}
          />
        </div>

        {/* ── KPI Cards ── */}
        <div className="relative z-10">
          <KPICards />
        </div>

        {/* ── Quick Actions ── */}
        <div className="relative z-10">
          <QuickActions />
        </div>

        {/* ── Today's Summary ── */}
        <div className="relative z-10">
          <TodaySummaryCard summary={summary} isLoading={isLoading} />
        </div>

        {/* ── Room Status Overview (Floor Map Grid) ── */}
        <div className="relative z-10">
          <RoomStatusOverview />
        </div>

        {/* ── Guest Journey Pipeline ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <GuestJourneyPipelineWidget />
        </div>

        {/* ── Quick Insights ── */}
        <div className="relative z-10">
          <QuickInsightsWidget />
        </div>

        {/* ── Operations Center ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={Radio} title={t('operationsCenter')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <ShiftSummaryWidget />
              <OperationsBoardWidget />
              <TaskRemindersWidget />
              <TodaysTasksWidget />
            </div>
          </div>
        </LazySection>

        {/* ── Network & Connectivity ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={Wifi} title={t('networkConnectivity')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
              <WiFiLiveStatsWidget />
              <SystemHealthStatusWidget />
              <WeatherForecastWidget />
            </div>
            <WiFiAnalyticsWidget />
          </div>
        </LazySection>

        {/* ── Front Desk & Rooms ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={Bed} title={t('frontDeskRooms')} />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <TodaysSchedule />
            <RoomStatusWidget />
          </div>
          <PropertyStatusSummaryWidget />
          <RoomFloorPlanWidget />
        </div>

        {/* ── Room Occupancy Breakdown ── */}
        <div className="relative z-10">
          <RoomOccupancyBreakdownWidget />
        </div>

        {/* ── Alerts, Activity & Staff ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={Bell} title={t('alertsActivity')} />
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
              <AlertsWidget alerts={summary?.alerts || []} isLoading={isLoading} />
              <RecentActivityFeed />
              <StaffOnDutyWidget />
            </div>
          </div>
        </LazySection>

        {/* ── Activity Timeline ── */}
        <LazySection>
          <div className="relative z-10">
            <ActivityTimelineWidget />
          </div>
        </LazySection>

        {/* ── Staff Duty Roster ── */}
        <LazySection>
          <div className="relative z-10">
            <StaffDutyRosterWidget />
          </div>
        </LazySection>

        {/* ── Maintenance & Guest Insights ── */}
        <LazySection>
          <div className="relative z-10 space-y-2">
            <SectionLabel icon={Wrench} title={t('maintenanceInsights')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <MaintenanceTrackerProWidget />
              <MaintenanceTrackerWidget />
            </div>
            <GuestSegmentsWidget />
          </div>
        </LazySection>

        {/* ── Revenue & Performance ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={Zap} title={t('revenuePerformance')} />
            <PropertyPerformanceWidget />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
              <DailyPerformanceScoreWidget />
              <div className="lg:col-span-2">
                <RevenueTrendWidget />
              </div>
            </div>
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
              <MiniRevenueChart />
              <RevenueBreakdownDonutWidget />
              <PerformanceScoreWidget />
              <RevenueBreakdownWidget />
            </div>
            <RatePlanComparisonWidget />
            <RevenueForecastWidget />
          </div>
        </LazySection>

        {/* ── Guest Intelligence ── */}
        <LazySection>
          <div className="relative z-10 space-y-2">
            <SectionLabel icon={Crown} title={t('guestIntelligence')} />
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              <LoyaltyWidget />
              <LoyaltyTierWidget />
              <StaffPerformanceWidget />
              <GuestDemographicsWidget />
            </div>
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <GuestSatisfactionWidget />
              <WeatherWidget />
            </div>
            <GuestSentimentAnalyticsWidget />
          </div>
        </LazySection>

        {/* ── Channel & Communication ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={MessageSquare} title={t('channelCommunication')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <ChannelPerformanceWidget />
              <GuestCommunicationWidget />
            </div>
          </div>
        </LazySection>

        {/* ── Upcoming ── */}
        <LazySection>
          <div className="relative z-10 space-y-2">
            <SectionLabel icon={Calendar} title={t('upcomingSection')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
              <UpcomingArrivals />
              <MiniCalendarWidget />
              <UpcomingEventsWidget />
            </div>
          </div>
        </LazySection>

        {/* ── Guest Feedback ── */}
        <LazySection>
          <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
            <SectionLabel icon={Users} title={t('guestFeedbackSection')} />
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <GuestFeedbackWidget />
              <GuestFeedbackSummaryWidget />
            </div>
          </div>
        </LazySection>

        {/* ── Analytics ── */}
        <LazySection>
          <div className="relative z-10 space-y-2">
            <SectionLabel icon={BarChart3} title={t('analytics')} />
            <DashboardCharts />
          </div>
        </LazySection>

        {/* ── Quick Sticky Notes ── */}
        <LazySection>
          <div className="relative z-10">
            <QuickNotesStickyWidget />
          </div>
        </LazySection>

        {/* ── Occupancy Heatmap ── */}
        <LazySection skeletonHeight="h-48">
          <div className="relative z-10">
            <OccupancyHeatmap />
          </div>
        </LazySection>

      </div>
    </>
  );
}

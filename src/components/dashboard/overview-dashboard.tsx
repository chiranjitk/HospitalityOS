'use client';

import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useUIStore, useAuthStore } from '@/store';
import { useTranslations } from 'next-intl';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import {
  Sun,
  Moon,
  CloudSun,
  Calendar,
  Clock,
  Bell,
  AlertTriangle,
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
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { KPICards } from './kpi-cards';
import { QuickActions } from './quick-actions';
import { DashboardCharts } from './charts';
import { UpcomingArrivals } from './upcoming-arrivals';
import { RoomStatusWidget } from './room-status-widget';
import { GuestSatisfactionWidget } from './guest-satisfaction-widget';
import { StaffOnDutyWidget } from './staff-on-duty';
import { RecentActivityFeed } from './recent-activity-feed';
import { TodaysSchedule } from './todays-schedule';
import { UpcomingEventsWidget } from './widgets/upcoming-events';
import { PerformanceScoreWidget } from './widgets/performance-score';
import { RevenueBreakdownWidget } from './widgets/revenue-breakdown';
import GuestFeedbackWidget from './widgets/guest-feedback';
import { DashboardHeader } from './dashboard-header';
import { MiniCalendarWidget } from './widgets/mini-calendar';
import { ShiftSummaryWidget } from './widgets/shift-summary';
import { OperationsBoardWidget } from './widgets/operations-board';
import { MaintenanceTrackerWidget } from './widgets/maintenance-tracker';
import { LoyaltyWidget } from './widgets/loyalty-widget';
import { RatePlanComparisonWidget } from './widgets/rate-plan-comparison';
import { GuestSegmentsWidget } from './widgets/guest-segments';
import { GuestCommunicationWidget } from './widgets/guest-communication';
import StaffPerformanceWidget from './widgets/staff-performance';
import { ChannelPerformanceWidget } from './widgets/channel-performance-widget';
import { QuickNotesStickyWidget } from './widgets/quick-notes-widget';
import { TodaysTasksWidget } from './widgets/todays-tasks';
import { SystemHealthStatusWidget } from './widgets/system-health-widget';
import { WiFiLiveStatsWidget } from './widgets/wifi-live-stats-widget';
import { WeatherWidget } from './widgets/weather-widget';
import { TaskRemindersWidget } from './widgets/task-reminders-widget';
import { GuestJourneyPipelineWidget } from './widgets/guest-journey-pipeline';
import { DailyPerformanceScoreWidget } from './widgets/daily-performance-score';
import { RevenueTrendWidget } from './revenue-trend-widget';
import { QuickInsightsWidget } from './widgets/quick-insights';
import { PropertyStatusSummaryWidget } from './widgets/property-status-summary';
import { WelcomeBannerWidget } from './widgets/welcome-banner';
import { RoomOccupancyBreakdownWidget } from './widgets/room-occupancy-breakdown';
import { ActivityTimelineWidget } from './widgets/activity-timeline';
import { StaffDutyRosterWidget } from './widgets/staff-duty-roster';
import { RevenueForecastWidget } from './widgets/revenue-forecast';
import { GuestDemographicsWidget } from './widgets/guest-demographics';
import { MaintenanceTrackerProWidget } from './widgets/maintenance-tracker-pro';
import { RevenueBreakdownDonutWidget } from './widgets/revenue-breakdown-donut';
import { GuestFeedbackSummaryWidget } from './widgets/guest-feedback-summary';
import { LazySection } from './lazy-section';

const OccupancyHeatmap = React.lazy(() => import('./occupancy-heatmap').then(m => ({ default: m.OccupancyHeatmap })));

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

// ─── Greeting Card ──────────────────────────────────────────────────────

function GreetingCard({ occupancy = 0, arrivals = 0, alertsCount = 0 }: {
  occupancy?: number; arrivals?: number; alertsCount?: number;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { formatTime } = useTimezone();
  const { currentProperty } = useAuthStore();
  const t = useTranslations('dashboard');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  let greeting: string;
  let Icon: LucideIcon;
  let accentColor = 'emerald';
  let gradient = 'from-primary to-primary';
  let iconBg = 'bg-gradient-to-br from-primary to-primary';
  let ringColor = 'ring-primary/40';
  let chipBg = 'bg-primary/10 dark:bg-primary/10';
  let chipText = 'text-primary dark:text-primary';
  let clockColor = 'text-primary dark:text-primary';

  if (hour >= 12 && hour < 17) {
    greeting = t('goodAfternoon'); Icon = CloudSun; accentColor = 'sky';
    gradient = 'from-sky-500 to-cyan-500';
    iconBg = 'bg-gradient-to-br from-sky-400 to-cyan-600';
    ringColor = 'ring-sky-400/40'; chipBg = 'bg-sky-50 dark:bg-sky-950/40';
    chipText = 'text-sky-700 dark:text-sky-400'; clockColor = 'text-sky-600 dark:text-sky-400';
  } else if (hour >= 17 && hour < 21) {
    greeting = t('goodEvening'); Icon = Moon; accentColor = 'violet';
    gradient = 'from-violet-500 to-purple-500';
    iconBg = 'bg-gradient-to-br from-violet-400 to-purple-600';
    ringColor = 'ring-violet-400/40'; chipBg = 'bg-violet-50 dark:bg-violet-950/40';
    chipText = 'text-violet-700 dark:text-violet-400'; clockColor = 'text-violet-600 dark:text-violet-400';
  } else if (hour >= 21 || hour < 5) {
    greeting = t('goodNight'); Icon = Moon; accentColor = 'slate';
    gradient = 'from-slate-600 to-slate-800';
    iconBg = 'bg-gradient-to-br from-slate-500 to-slate-700';
    ringColor = 'ring-slate-400/40'; chipBg = 'bg-slate-100 dark:bg-slate-800/40';
    chipText = 'text-slate-700 dark:text-slate-400'; clockColor = 'text-slate-500 dark:text-slate-400';
  } else {
    greeting = t('goodMorning'); Icon = Sun;
  }

  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 shadow-md hover-lift",
        "bg-card"
      )}>
        <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r", gradient)} />
        {/* Animated gradient border-bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] animate-[gradientSlide_4s_ease-in-out_infinite bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <CardContent className="p-4 sm:p-5 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Icon */}
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl shadow-md flex-shrink-0", iconBg)}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {greeting}<span className="inline-block animate-[wave_2s_ease-in-out_infinite] origin-[70%_70%]">!</span>
                  </h1>
                  <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-mono font-semibold tabular-nums", chipBg, chipText, "border-border/40")}>
                    <div className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
                    </div>
                    {formatTime(currentTime.toISOString())}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{dayName}, {monthDay}</span>
                  {currentProperty?.name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                      <Building2 className="h-3 w-3" />
                      {currentProperty.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", chipBg, chipText, "border-border/40")}>
                <Bed className="h-3 w-3" />
                {occupancy}%
              </span>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", chipBg, chipText, "border-border/40")}>
                <LogIn className="h-3 w-3" />
                {arrivals}
              </span>
              {alertsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200/50 dark:border-red-800/40">
                  <Bell className="h-3 w-3" />
                  {alertsCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
      <Card className="card-accent border border-border/60 shadow-md rounded-2xl bg-card">
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
      gradient: 'from-primary to-primary',
      lightBg: 'bg-primary/10 dark:bg-primary/10',
      section: 'frontdesk-checkin',
    },
    {
      label: t('departures'), count: departuresCount, icon: LogOut,
      gradient: 'from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50 dark:bg-amber-950/50',
      section: 'frontdesk-checkout',
    },
    {
      label: t('inHouse'), count: inHouseCount, icon: Users,
      gradient: 'from-violet-500 to-purple-500',
      lightBg: 'bg-violet-50 dark:bg-violet-950/50',
      section: 'guests-list',
    },
    {
      label: t('available'), count: availableCount, icon: Bed,
      gradient: 'from-cyan-500 to-teal-500',
      lightBg: 'bg-cyan-50 dark:bg-cyan-950/50',
      section: 'frontdesk-room-grid',
    },
  ];

  return (
    <Card className="card-accent border border-border/60 shadow-md rounded-2xl bg-card hover-lift">
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
              whileHover={{ scale: 1.04, y: -3 }}
              className={cn(
                "relative p-4 rounded-xl cursor-pointer transition-all duration-300",
                "bg-card border border-border/40 overflow-hidden group",
                "hover:shadow-lg hover:border-border/60"
              )}
              onClick={() => setActiveSection(stat.section)}
            >
              {/* Subtle gradient background on hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                stat.lightBg
              )} />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm", stat.gradient)}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{stat.label}</p>
                <p className="text-2xl font-extrabold tabular-nums text-foreground" style={{ fontFeatureSettings: 'tnum' }}>
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
  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Left decorative dot */}
      <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
      {/* Icon badge */}
      <div className="section-header-icon">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      {/* Title with gradient underline */}
      <h2 className="section-gradient-underline section-header-title">{title}</h2>
      {/* Gradient line */}
      <div className="section-header-line" />
      {/* Right decorative dot */}
      <span className="w-1 h-1 rounded-full bg-primary/25 shrink-0" />
    </div>
  );
}

// ─── Alerts Widget ──────────────────────────────────────────────────────

function AlertsWidget({ alerts, isLoading }: { alerts: TodaySummary['alerts']; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();
  const t = useTranslations('dashboard');

  if (isLoading) {
    return (
      <Card className="card-accent border border-border/60 shadow-md rounded-2xl bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertIcons: Record<string, LucideIcon> = { warning: AlertTriangle, error: AlertTriangle, info: Bell, success: CheckCircle2 };
  const alertStyles: Record<string, { bg: string; iconColor: string; dotColor: string }> = {
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
    error: { bg: 'bg-red-50 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
    info: { bg: 'bg-sky-50 dark:bg-sky-950/50', iconColor: 'text-sky-600 dark:text-sky-400', dotColor: 'bg-sky-500' },
    success: { bg: 'bg-primary/10 dark:bg-primary/10', iconColor: 'text-primary dark:text-primary', dotColor: 'bg-primary' },
  };

  const limitedAlerts = alerts.slice(0, 4);

  return (
    <Card className="card-accent border border-border/60 shadow-md rounded-2xl bg-card hover-lift">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">{t('alerts')}</h3>
          </div>
          {alerts.length > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[11px] font-semibold">
              {alerts.length}
            </Badge>
          )}
        </div>
        {limitedAlerts.length === 0 ? (
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
          <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
            {limitedAlerts.map((alert, idx) => {
              const Icon = alertIcons[alert.type] || Bell;
              const style = alertStyles[alert.type] || alertStyles.info;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    style.bg
                  )}
                  onClick={() => alert.section && setActiveSection(alert.section)}
                >
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", style.dotColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.message}</p>
                  </div>
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", style.iconColor)} />
                </motion.div>
              );
            })}
          </div>
        )}
        {alerts.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 hover:bg-muted/60 transition-colors text-xs font-medium"
            onClick={() => setActiveSection('dashboard-alerts')}
          >
            {t('viewAllAlerts')} ({alerts.length})
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
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
      `}</style>

      <div className="space-y-5 relative">
        <MeshBackground />

        {/* ── Welcome Banner ── */}
        <div className="relative z-10">
          <WelcomeBannerWidget />
        </div>

        {/* ── Greeting ── */}
        <GreetingCard
          occupancy={summary?.occupancy || 0}
          arrivals={summary?.arrivals || 0}
          alertsCount={summary?.alerts?.length || 0}
        />

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
              <WeatherWidget />
            </div>
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
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
              <DailyPerformanceScoreWidget />
              <div className="lg:col-span-2">
                <RevenueTrendWidget />
              </div>
            </div>
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
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
              <StaffPerformanceWidget />
              <GuestSatisfactionWidget />
              <GuestDemographicsWidget />
            </div>
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
            <Suspense fallback={<div className="h-48 bg-muted/50 rounded-2xl animate-pulse" />}>
              <OccupancyHeatmap />
            </Suspense>
          </div>
        </LazySection>

      </div>
    </>
  );
}

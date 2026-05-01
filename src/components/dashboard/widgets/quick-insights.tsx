'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/store';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  Zap,
  BarChart3,
  Sparkles,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type Severity = 'positive' | 'warning' | 'neutral';

interface Insight {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  severity: Severity;
  section: string;
}

interface DashboardStats {
  occupancy: { today: number; change: number };
  revenue: { today: number; change: number };
  guests: { checkedIn: number; arriving: number; departing: number };
  activeWifiSessions: number;
  pendingServiceRequests: number;
}

interface DashboardApiResponse {
  success: boolean;
  data?: {
    stats: DashboardStats;
  };
}

// ─── Severity Configs ───────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  Severity,
  {
    barColor: string;
    iconBg: string;
    iconColor: string;
    badgeVariant: 'success' | 'warning' | 'outline';
    badgeClass: string;
    hoverBorder: string;
  }
> = {
  positive: {
    barColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeVariant: 'success',
    badgeClass: '',
    hoverBorder: 'hover:border-emerald-200 dark:hover:border-emerald-800/60',
  },
  warning: {
    barColor: 'bg-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeVariant: 'warning',
    badgeClass: '',
    hoverBorder: 'hover:border-amber-200 dark:hover:border-amber-800/60',
  },
  neutral: {
    barColor: 'bg-slate-400',
    iconBg: 'bg-slate-50 dark:bg-slate-900/60',
    iconColor: 'text-slate-500 dark:text-slate-400',
    badgeVariant: 'outline',
    badgeClass: 'text-muted-foreground',
    hoverBorder: 'hover:border-slate-200 dark:hover:border-slate-700/60',
  },
};

// ─── Badge label map ────────────────────────────────────────────────────

function getBadgeLabel(severity: Severity, t: (key: string) => string): string {
  switch (severity) {
    case 'positive':
      return t('insightPositive');
    case 'warning':
      return t('insightWarning');
    case 'neutral':
      return t('insightNeutral');
  }
}

// ─── Insight Generation Logic ───────────────────────────────────────────

function generateInsights(stats: DashboardStats): Insight[] {
  const insights: Insight[] = [];

  // Occupancy insights
  if (stats.occupancy.today < 50) {
    insights.push({
      id: 'low-occupancy',
      icon: TrendingDown,
      title: 'Occupancy is below target',
      description: `Current occupancy at ${stats.occupancy.today}% — consider running promotions to boost bookings.`,
      severity: 'warning',
      section: 'bookings-calendar',
    });
  } else if (stats.occupancy.today > 85) {
    insights.push({
      id: 'high-demand',
      icon: TrendingUp,
      title: 'High demand period',
      description: `Occupancy at ${stats.occupancy.today}% — consider overbooking strategy for late cancellations.`,
      severity: 'positive',
      section: 'pms-overbooking',
    });
  }

  // Revenue insight
  if (stats.revenue.change > 0) {
    insights.push({
      id: 'revenue-up',
      icon: BarChart3,
      title: `Revenue trending up`,
      description: `Revenue increased by ${stats.revenue.change}% compared to the previous period.`,
      severity: 'positive',
      section: 'reports-revenue',
    });
  } else if (stats.revenue.change < 0) {
    insights.push({
      id: 'revenue-down',
      icon: TrendingDown,
      title: `Revenue trending down`,
      description: `Revenue decreased by ${Math.abs(stats.revenue.change)}% — review pricing and promotions.`,
      severity: 'warning',
      section: 'revenue-pricing',
    });
  }

  // WiFi sessions
  if (stats.activeWifiSessions > 0) {
    insights.push({
      id: 'wifi-active',
      icon: Wifi,
      title: 'Active WiFi usage',
      description: `${stats.activeWifiSessions} active WiFi session${stats.activeWifiSessions > 1 ? 's' : ''} currently connected across the property.`,
      severity: 'neutral',
      section: 'wifi-sessions',
    });
  }

  // Pending service requests
  if (stats.pendingServiceRequests > 0) {
    insights.push({
      id: 'pending-requests',
      icon: AlertTriangle,
      title: 'Pending service requests',
      description: `${stats.pendingServiceRequests} service request${stats.pendingServiceRequests > 1 ? 's' : ''} awaiting attention from housekeeping.`,
      severity: 'warning',
      section: 'experience-requests',
    });
  }

  // Checked-in guests insight
  if (stats.guests.checkedIn > 0) {
    insights.push({
      id: 'guests-checked-in',
      icon: Zap,
      title: 'Guests currently in-house',
      description: `${stats.guests.checkedIn} guest${stats.guests.checkedIn > 1 ? 's' : ''} checked in and on property right now.`,
      severity: 'neutral',
      section: 'frontdesk-room-grid',
    });
  }

  // Default fallback — only if no other insights generated
  if (insights.length === 0) {
    insights.push({
      id: 'all-systems-ok',
      icon: CheckCircle2,
      title: 'All systems operational',
      description: 'No critical alerts detected. All hotel metrics are within normal ranges.',
      severity: 'positive',
      section: 'dashboard-overview',
    });
  }

  return insights;
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

function QuickInsightsSkeleton() {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-amber-400 via-emerald-400 to-slate-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/30"
            >
              <Skeleton className="h-4 w-1 rounded-full flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Insight Card ───────────────────────────────────────────────────────

function InsightCard({
  insight,
  index,
  badgeLabel,
  onViewDetails,
}: {
  insight: Insight;
  index: number;
  badgeLabel: string;
  onViewDetails: (section: string) => void;
}) {
  const config = SEVERITY_CONFIG[insight.severity];
  const Icon = insight.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.015, y: -1 }}
      className={cn(
        'relative flex items-start gap-3 p-3 rounded-xl border border-border/40',
        'transition-all duration-300 cursor-pointer group',
        'hover:shadow-md',
        config.hoverBorder
      )}
      onClick={() => onViewDetails(insight.section)}
    >
      {/* Left color bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
          config.barColor
        )}
      />

      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center',
          'transition-transform duration-200 group-hover:scale-110',
          config.iconBg
        )}
      >
        <Icon className={cn('h-4 w-4', config.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5 pl-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground leading-snug truncate">
            {insight.title}
          </h4>
          <Badge
            variant={config.badgeVariant}
            className={cn(
              'text-[10px] px-2 py-0 h-5 flex-shrink-0',
              config.badgeClass
            )}
          >
            {badgeLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {insight.description}
        </p>
      </div>

      {/* Action chevron */}
      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
    </motion.div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function QuickInsightsWidget() {
  const t = useTranslations('dashboard');
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const loadRef = useRef<() => void>();

  const createLoader = useCallback(() => {
    return async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result: DashboardApiResponse = await response.json();
        if (result.success && result.data?.stats) {
          setInsights(generateInsights(result.data.stats));
        } else {
          setInsights(
            generateInsights({
              occupancy: { today: 0, change: 0 },
              revenue: { today: 0, change: 0 },
              guests: { checkedIn: 0, arriving: 0, departing: 0 },
              activeWifiSessions: 0,
              pendingServiceRequests: 0,
            })
          );
        }
      } catch {
        setIsError(true);
        setInsights(
          generateInsights({
            occupancy: { today: 0, change: 0 },
            revenue: { today: 0, change: 0 },
            guests: { checkedIn: 0, arriving: 0, departing: 0 },
            activeWifiSessions: 0,
            pendingServiceRequests: 0,
          })
        );
      } finally {
        setIsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    const loader = createLoader();
    loadRef.current = loader;
    loader();
    const interval = setInterval(loader, 60_000);
    return () => clearInterval(interval);
  }, [createLoader]);

  const handleViewDetails = (section: string) => {
    setActiveSection(section);
  };

  if (isLoading) {
    return <QuickInsightsSkeleton />;
  }

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-[2px] bg-gradient-to-r from-amber-400 via-emerald-400 to-slate-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-emerald-500 shadow-sm">
              <Lightbulb className="h-3.5 w-3.5 text-white" />
            </div>
            {t('quickInsights')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold rounded-full border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
            >
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              AI
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => loadRef.current?.()}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {insights.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={index}
                badgeLabel={getBadgeLabel(insight.severity, t)}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : null}

        {isError && (
          <p className="text-[11px] text-muted-foreground/60 mt-2 text-center">
            Showing fallback insights — could not reach the API.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default QuickInsightsWidget;

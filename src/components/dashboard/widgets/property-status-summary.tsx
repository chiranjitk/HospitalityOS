'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Building2,
  Bed,
  Users,
  Wrench,
  AlertOctagon,
  ChevronRight,
  DoorOpen,
  LogIn,
  SprayCan,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface RoomStatusCounts {
  available: number;
  occupied: number;
  maintenance: number;
  out_of_order: number;
  dirty: number;
}

interface DashboardRoomData {
  rooms: RoomStatusCounts;
  totalRooms: number;
}

interface PropertyData {
  id: string;
  name: string;
  totalRooms: number;
  _count?: {
    rooms: number;
    roomTypes: number;
  };
}

// ─── Status Color Config ───────────────────────────────────────────────

const STATUS_COLORS = {
  occupied: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-400 to-emerald-500',
  },
  available: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-400',
    dot: 'bg-teal-500',
    bar: 'bg-teal-500',
    border: 'border-teal-200 dark:border-teal-800',
    gradient: 'from-teal-400 to-teal-500',
  },
  maintenance: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-400 to-amber-500',
  },
  out_of_order: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800',
    gradient: 'from-red-400 to-red-500',
  },
} as const;

// ─── Metric Pill ───────────────────────────────────────────────────────

function MetricPill({
  icon: Icon,
  label,
  value,
  colorKey,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  colorKey: keyof typeof STATUS_COLORS;
  delay?: number;
}) {
  const colors = STATUS_COLORS[colorKey] || STATUS_COLORS.available;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium',
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </motion.div>
  );
}

// ─── Status Row ─────────────────────────────────────────────────────────

function StatusRow({
  icon: Icon,
  label,
  count,
  total,
  colorKey,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  colorKey: keyof typeof STATUS_COLORS;
  delay?: number;
}) {
  const colors = STATUS_COLORS[colorKey] || STATUS_COLORS.available;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-center gap-3 group"
    >
      <div
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
          colors.gradient
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground truncate">
            {label}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums',
              colors.bg,
              colors.text
            )}
          >
            {count} ({percentage}%)
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ delay: delay + 0.2, duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.bar)}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Action Button ─────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'w-full justify-between gap-2 h-9 text-xs font-medium',
          'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
          'transition-all duration-200 cursor-pointer',
          'border-border/60 bg-card'
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
      </Button>
    </motion.div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function PropertyStatusSummaryWidget() {
  const t = useTranslations('dashboard');
  const { currentProperty } = useAuthStore();

  const [dashboardData, setDashboardData] = useState<DashboardRoomData | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [dashRes, propRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/properties?limit=1'),
        ]);

        if (cancelled) return;
        if (!dashRes.ok || !propRes.ok) throw new Error('Failed to fetch');

        const dashJson = await dashRes.json();
        const propJson = await propRes.json();

        if (cancelled) return;

        if (dashJson.success && dashJson.data?.commandCenter) {
          setDashboardData({
            rooms: dashJson.data.commandCenter.rooms,
            totalRooms: dashJson.data.commandCenter.totalRooms,
          });
        }

        if (propJson.success && propJson.data?.length > 0) {
          setPropertyData(propJson.data[0]);
        }
      } catch {
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Derived values
  const propertyName = currentProperty?.name || propertyData?.name || '—';
  const totalRooms = dashboardData?.totalRooms ?? currentProperty?.totalRooms ?? propertyData?.totalRooms ?? 0;
  const rooms = dashboardData?.rooms ?? { available: 0, occupied: 0, maintenance: 0, out_of_order: 0, dirty: 0 };
  const occupied = rooms.occupied;
  const available = rooms.available;
  const maintenance = rooms.maintenance;
  const outOfOrder = rooms.out_of_order;
  const occupancyPercent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

  // ─── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // ─── Error ───────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Card className="border border-red-200 dark:border-red-800 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-red-400 to-red-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-red-400 to-red-500 shadow-sm">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-base font-semibold text-red-600 dark:text-red-400">
              {t('propertyStatus')}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{t('networkError')}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            {t('retry')}
          </button>
        </CardContent>
      </Card>
    );
  }

  // ─── Main Content ────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
        {/* Gradient top border */}
        <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground leading-tight">
                  {t('propertyStatus')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {propertyName}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-semibold rounded-full px-2.5 py-0.5',
                occupancyPercent >= 80
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : occupancyPercent >= 50
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              )}
            >
              {occupancyPercent}%
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ── Metric Pills ──────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            <MetricPill
              icon={Bed}
              label={t('totalRooms')}
              value={totalRooms}
              colorKey="available"
              delay={0.05}
            />
            <MetricPill
              icon={Users}
              label={t('occupied')}
              value={occupied}
              colorKey="occupied"
              delay={0.1}
            />
            <MetricPill
              icon={Bed}
              label={t('available')}
              value={available}
              colorKey="available"
              delay={0.15}
            />
            <MetricPill
              icon={Wrench}
              label={t('maintenance')}
              value={maintenance}
              colorKey="maintenance"
              delay={0.2}
            />
          </div>

          {/* ── Occupancy Progress Bar ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t('occupancy')}
              </span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {occupied} / {totalRooms}
              </span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
              {/* Available base bar */}
              <div className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-teal-400/30 to-teal-400/10" />
              {/* Occupied bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${occupancyPercent}%` }}
                transition={{ delay: 0.35, duration: 0.6, ease: 'easeOut' }}
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  'bg-gradient-to-r from-emerald-500 to-emerald-400',
                  'shadow-sm shadow-emerald-500/25'
                )}
              />
            </div>
          </motion.div>

          {/* ── Room Status Breakdown ────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('roomStatusOverview')}
            </p>
            <div className="space-y-3">
              <StatusRow
                icon={Users}
                label={t('occupied')}
                count={occupied}
                total={totalRooms}
                colorKey="occupied"
                delay={0.3}
              />
              <StatusRow
                icon={Bed}
                label={t('available')}
                count={available}
                total={totalRooms}
                colorKey="available"
                delay={0.35}
              />
              <StatusRow
                icon={Wrench}
                label={t('maintenance')}
                count={maintenance}
                total={totalRooms}
                colorKey="maintenance"
                delay={0.4}
              />
              <StatusRow
                icon={AlertOctagon}
                label={t('outOfOrder')}
                count={outOfOrder}
                total={totalRooms}
                colorKey="out_of_order"
                delay={0.45}
              />
            </div>
          </div>

          {/* ── Quick Action Buttons ─────────────────────────────────── */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('quickActions')}
            </p>
            <div className="grid grid-cols-1 gap-2">
              <ActionButton
                icon={DoorOpen}
                label={t('viewRooms')}
                delay={0.5}
              />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton
                  icon={LogIn}
                  label={t('checkin')}
                  delay={0.55}
                />
                <ActionButton
                  icon={SprayCan}
                  label={t('housekeeping')}
                  delay={0.6}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default PropertyStatusSummaryWidget;

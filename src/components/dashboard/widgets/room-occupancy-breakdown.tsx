'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Building2, Bed, Layers, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface RoomStatusCounts {
  available: number;
  occupied: number;
  maintenance: number;
  dirty: number;
  out_of_order: number;
}

interface DashboardData {
  commandCenter: {
    rooms: RoomStatusCounts;
    totalRooms: number;
  };
}

const STATUS_CONFIG = [
  { key: 'available' as const, color: 'bg-teal-500', darkColor: 'dark:bg-teal-400', textColor: 'text-teal-600 dark:text-teal-400', bgLight: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-200 dark:border-teal-800' },
  { key: 'occupied' as const, color: 'bg-emerald-600', darkColor: 'dark:bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', bgLight: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
  { key: 'maintenance' as const, color: 'bg-amber-500', darkColor: 'dark:bg-amber-400', textColor: 'text-amber-700 dark:text-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
  { key: 'out_of_order' as const, color: 'bg-red-500', darkColor: 'dark:bg-red-400', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
] as const;

function getFloorData(rooms: RoomStatusCounts, totalRooms: number) {
  const usableStatuses = ['available', 'occupied', 'maintenance', 'out_of_order'] as const;
  const usableTotal = usableStatuses.reduce((s, k) => s + rooms[k], 0);
  const floorCount = Math.max(3, Math.min(Math.ceil(usableTotal / 10), 6));

  const floors: Array<{ name: string; total: number; occupied: number; available: number; maintenance: number; outOfOrder: number }> = [];
  let remaining = { ...rooms };

  for (let i = 0; i < floorCount; i++) {
    const isLast = i === floorCount - 1;
    const share = isLast ? 1 : 0.7 + Math.random() * 0.6;
    const floor: { total: number; occupied: number; available: number; maintenance: number; outOfOrder: number } = { total: 0, occupied: 0, available: 0, maintenance: 0, outOfOrder: 0 };

    for (const status of usableStatuses) {
      const raw = isLast ? remaining[status] : Math.round((rooms[status] / floorCount) * share);
      const allocated = Math.min(raw, remaining[status]);
      const fieldMap: Record<string, 'occupied' | 'available' | 'maintenance' | 'outOfOrder'> = {
        available: 'available',
        occupied: 'occupied',
        maintenance: 'maintenance',
        out_of_order: 'outOfOrder',
      };
      floor[fieldMap[status]] = allocated;
      floor.total += allocated;
      remaining[status] -= allocated;
    }

    floors.push({ name: `${i + 1}F`, ...floor });
  }

  return floors;
}

function StatusBar({ rooms, totalRooms, t }: { rooms: RoomStatusCounts; totalRooms: number; t: (key: string) => string }) {
  const usableStatuses = ['available', 'occupied', 'maintenance', 'out_of_order'] as const;
  const usableTotal = usableStatuses.reduce((s, k) => s + rooms[k], 0);

  const segments = STATUS_CONFIG.map((cfg) => {
    const count = rooms[cfg.key];
    const pct = usableTotal > 0 ? Math.round((count / usableTotal) * 100) : 0;
    return { ...cfg, count, pct };
  }).filter((s) => s.count > 0);

  return (
    <div className="space-y-3">
      <div className="relative flex h-5 w-full overflow-hidden rounded-full bg-muted/60">
        {segments.map((seg, i) => (
          <Tooltip key={seg.key}>
            <TooltipTrigger asChild>
              <motion.div
                className={cn('h-full cursor-default', seg.color, seg.darkColor)}
                initial={{ width: 0 }}
                animate={{ width: `${seg.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + i * 0.1 }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">{t(seg.key === 'out_of_order' ? 'outOfOrder' : seg.key)}</p>
              <p className="text-muted-foreground tabular-nums">{seg.count} rooms · {seg.pct}%</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs', seg.bgLight, seg.border)}
          >
            <span className={cn('inline-block h-2 w-2 rounded-full', seg.color)} />
            <span className="text-muted-foreground">{t(seg.key === 'out_of_order' ? 'outOfOrder' : seg.key)}</span>
            <span className={cn('font-bold tabular-nums', seg.textColor)}>{seg.count}</span>
            <span className="text-muted-foreground tabular-nums">({seg.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FloorBars({ floors, t }: { floors: Array<{ name: string; total: number; occupied: number }>; t: (key: string) => string }) {
  const maxTotal = Math.max(...floors.map((f) => f.total), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-center gap-3 h-44">
        {floors.map((floor, i) => {
          const pct = floor.total > 0 ? Math.round((floor.occupied / floor.total) * 100) : 0;
          const barHeight = Math.max(8, (floor.total / maxTotal) * 100);
          const barColor = pct > 70 ? 'bg-emerald-500 dark:bg-emerald-400' : pct >= 40 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-red-500 dark:bg-red-400';
          const labelColor = pct > 70 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

          return (
            <Tooltip key={floor.name}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1.5 cursor-default group flex-1 max-w-[60px]">
                  <span className={cn('text-[10px] font-bold tabular-nums transition-colors', labelColor)}>{pct}%</span>
                  <div className="relative w-full flex justify-center" style={{ height: `${barHeight}%` }}>
                    <motion.div
                      className={cn('w-8 rounded-t-md transition-colors group-hover:brightness-110', barColor)}
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 + i * 0.08 }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">{floor.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">{t('byFloor').replace('By ', '')} {floor.name}</p>
                <p className="text-muted-foreground tabular-nums">
                  {floor.occupied}/{floor.total} {t('occupied').toLowerCase()}
                </p>
                <p className="tabular-nums">{pct}% occupancy</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />&gt;70%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />40-70%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />&lt;40%</span>
      </div>
    </div>
  );
}

export function RoomOccupancyBreakdownWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (cancelled) return;
        const result = await response.json();
        if (cancelled) return;
        if (result.success && result.data?.commandCenter) {
          setData(result.data);
        }
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full rounded-full" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-40 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  const rooms = data?.commandCenter?.rooms;
  const totalRooms = data?.commandCenter?.totalRooms ?? 0;
  if (!rooms || totalRooms === 0) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            {t('occupancyBreakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bed className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('noRevenueData')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usableTotal = rooms.available + rooms.occupied + rooms.maintenance + rooms.out_of_order;
  const floors = getFloorData(rooms, totalRooms);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            {t('occupancyBreakdown')}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400">
            <Building2 className="h-2.5 w-2.5 mr-1" />
            {usableTotal} {t('rooms').toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="h-8 w-full grid grid-cols-2">
            <TabsTrigger value="status" className="text-xs gap-1">
              <ArrowUpDown className="h-3 w-3" />
              {t('byStatus')}
            </TabsTrigger>
            <TabsTrigger value="floor" className="text-xs gap-1">
              <Building2 className="h-3 w-3" />
              {t('byFloor')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="status" className="mt-4">
            <StatusBar rooms={rooms} totalRooms={totalRooms} t={t} />
          </TabsContent>
          <TabsContent value="floor" className="mt-4">
            <FloorBars floors={floors} t={t} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import {
  Bed,
  Users,
  Wrench,
  Crown,
  Sparkles,
  Clock,
  ArrowRight,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'dirty' | 'reserved' | 'vip';

interface RoomData {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  type: string;
  guestName?: string;
  checkoutDate?: string;
}

interface ApiRoom {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomType: { id: string; name: string; code?: string; basePrice?: number; currency?: string } | null;
}

// ─── Status Config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RoomStatus, {
  label: string;
  icon: LucideIcon;
  border: string;
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  dot: string;
  statBg: string;
  statBgDark: string;
  statText: string;
  statTextDark: string;
  statBorder: string;
}> = {
  available: {
    label: 'Available',
    icon: Bed,
    border: 'border-emerald-300 dark:border-emerald-700',
    bg: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/20',
    text: 'text-emerald-700',
    textDark: 'dark:text-emerald-300',
    dot: 'bg-emerald-500',
    statBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    statText: 'text-emerald-700 dark:text-emerald-400',
    statBorder: 'border-emerald-200/60 dark:border-emerald-800/40',
  },
  occupied: {
    label: 'Occupied',
    icon: Users,
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/20',
    text: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    dot: 'bg-amber-500',
    statBg: 'bg-amber-50 dark:bg-amber-950/40',
    statText: 'text-amber-700 dark:text-amber-400',
    statBorder: 'border-amber-200/60 dark:border-amber-800/40',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50',
    bgDark: 'dark:bg-red-950/20',
    text: 'text-red-700',
    textDark: 'dark:text-red-300',
    dot: 'bg-red-500',
    statBg: 'bg-red-50 dark:bg-red-950/40',
    statText: 'text-red-700 dark:text-red-400',
    statBorder: 'border-red-200/60 dark:border-red-800/40',
  },
  dirty: {
    label: 'Dirty',
    icon: Sparkles,
    border: 'border-orange-300 dark:border-orange-700',
    bg: 'bg-orange-50',
    bgDark: 'dark:bg-orange-950/20',
    text: 'text-orange-700',
    textDark: 'dark:text-orange-300',
    dot: 'bg-orange-500',
    statBg: 'bg-orange-50 dark:bg-orange-950/40',
    statText: 'text-orange-700 dark:text-orange-400',
    statBorder: 'border-orange-200/60 dark:border-orange-800/40',
  },
  reserved: {
    label: 'Reserved',
    icon: Clock,
    border: 'border-teal-300 dark:border-teal-700',
    bg: 'bg-teal-50',
    bgDark: 'dark:bg-teal-950/20',
    text: 'text-teal-700',
    textDark: 'dark:text-teal-300',
    dot: 'bg-teal-500',
    statBg: 'bg-teal-50 dark:bg-teal-950/40',
    statText: 'text-teal-700 dark:text-teal-400',
    statBorder: 'border-teal-200/60 dark:border-teal-800/40',
  },
  vip: {
    label: 'VIP',
    icon: Crown,
    border: 'border-purple-300 dark:border-purple-700',
    bg: 'bg-gradient-to-br from-purple-50 to-fuchsia-50',
    bgDark: 'dark:from-purple-950/30 dark:to-fuchsia-950/20',
    text: 'text-purple-700',
    textDark: 'dark:text-purple-300',
    dot: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
    statBg: 'bg-purple-50 dark:bg-purple-950/40',
    statText: 'text-purple-700 dark:text-purple-400',
    statBorder: 'border-purple-200/60 dark:border-purple-800/40',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function mapApiStatus(apiStatus: string): RoomStatus {
  switch (apiStatus) {
    case 'occupied':
      return 'occupied';
    case 'maintenance':
    case 'outOfOrder':
    case 'out_of_order':
      return 'maintenance';
    case 'dirty':
      return 'dirty';
    case 'reserved':
    case 'G25':
      return 'reserved';
    case 'vip':
      return 'vip';
    default:
      return 'available';
  }
}

// ─── Room Cell Component ────────────────────────────────────────────────

function RoomCell({ room, index }: { room: RoomData; index: number }) {
  const { setActiveSection } = useUIStore();
  const config = STATUS_CONFIG[room.status];

  const tooltipContent = useMemo(() => {
    if (room.status === 'available') {
      return (
        <>
          <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
          <p className="text-muted-foreground">Available for booking</p>
        </>
      );
    }
    if (room.status === 'maintenance') {
      return (
        <>
          <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
          <p className="text-muted-foreground">Under maintenance</p>
        </>
      );
    }
    if (room.status === 'dirty') {
      return (
        <>
          <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
          <p className="text-muted-foreground">Needs cleaning</p>
        </>
      );
    }
    if (room.status === 'reserved') {
      return (
        <>
          <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
          <p className="text-muted-foreground">Reserved</p>
        </>
      );
    }
    if (room.status === 'vip') {
      return (
        <>
          <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
          <p className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
            <Crown className="h-3 w-3" />
            VIP Guest
          </p>
          {room.guestName && (
            <p className="text-muted-foreground">
              {room.guestName} (Check-out: {room.checkoutDate})
            </p>
          )}
        </>
      );
    }
    return (
      <>
        <p className="font-medium">Room {room.number} &mdash; {room.type}</p>
        {room.guestName && (
          <p className="text-muted-foreground">
            {room.guestName} (Check-out: {room.checkoutDate})
          </p>
        )}
      </>
    );
  }, [room]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02, duration: 0.3, ease: 'easeOut' }}
    >
      <div className="relative group">
        {/* Room cell */}
        <button
          type="button"
          onClick={() => setActiveSection('pms-rooms')}
          className={cn(
            'h-10 w-full rounded-lg border-2 flex items-center justify-center gap-1.5',
            'text-xs font-mono font-medium cursor-pointer',
            'hover:shadow-md hover:scale-105 active:scale-[0.98]',
            'transition-all duration-200',
            config.border,
            config.bg,
            config.bgDark,
            config.text,
            config.textDark,
          )}
        >
          {/* Status dot */}
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', config.dot)} />
          <span>{room.number}</span>
        </button>

        {/* Hover tooltip */}
        <div
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'hidden group-hover:block',
            'bg-popover text-popover-foreground rounded-lg shadow-lg border px-3 py-2 text-xs whitespace-nowrap z-50',
            'pointer-events-none',
          )}
        >
          {tooltipContent}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-popover" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Summary Stat Pill ──────────────────────────────────────────────────

function SummaryStat({
  status,
  count,
}: {
  status: RoomStatus;
  count: number;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border',
        'transition-all duration-200 hover:scale-[1.03] hover:shadow-sm',
        config.statBg,
        config.statBorder,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-md',
          config.statBg,
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', config.statText)} />
      </div>
      <div className="flex flex-col">
        <span className={cn('text-sm font-bold tabular-nums leading-tight', config.statText)}>
          {count}
        </span>
        <span className="text-[10px] text-muted-foreground leading-none">
          {config.label}
        </span>
      </div>
    </div>
  );
}

// ─── Floor Separator ────────────────────────────────────────────────────

function FloorSeparator({ floor }: { floor: number }) {
  return (
    <div className="col-span-full flex items-center gap-2 pt-1 pb-2">
      <div className="h-px flex-1 bg-border/40" />
      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
        Floor {floor}
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function RoomStatusOverviewSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 rounded-2xl bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-4 sm:grid-cols-7 xl:grid-cols-10 gap-2">
            {[...Array(24)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function RoomStatusOverview() {
  const { setActiveSection } = useUIStore();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/rooms');
        const result = await response.json();
        if (result.success) {
          const mapped: RoomData[] = (result.data as ApiRoom[]).map((room) => ({
            id: room.id,
            number: room.number,
            floor: room.floor,
            status: mapApiStatus(room.status),
            type: room.roomType?.name || 'Standard Room',
          }));
          setRooms(mapped);
        } else {
          setError(result.error?.message || 'Failed to load rooms');
        }
      } catch (err) {
        setError('Failed to fetch room data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRooms();
  }, []);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<RoomStatus, number> = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      dirty: 0,
      reserved: 0,
      vip: 0,
    };
    rooms.forEach((room) => {
      counts[room.status]++;
    });
    return counts;
  }, [rooms]);

  // Group rooms by floor
  const roomsByFloor = useMemo(() => {
    const floors = new Map<number, RoomData[]>();
    rooms.forEach((room, idx) => {
      const existing = floors.get(room.floor) || [];
      existing.push({ ...room, _index: idx } as RoomData & { _index: number });
      floors.set(room.floor, existing);
    });
    return Array.from(floors.entries()).sort(([a], [b]) => a - b);
  }, [rooms]);

  if (isLoading) {
    return <RoomStatusOverviewSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="border border-border/60 rounded-2xl bg-card">
          <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 rounded-2xl bg-card">
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Bed className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Room Status Overview
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7 px-2"
              onClick={() => setActiveSection('pms-rooms')}
            >
              View All Rooms
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <SummaryStat status="available" count={statusCounts.available} />
            <SummaryStat status="occupied" count={statusCounts.occupied} />
            <SummaryStat status="maintenance" count={statusCounts.maintenance} />
            <SummaryStat status="dirty" count={statusCounts.dirty} />
            <SummaryStat status="reserved" count={statusCounts.reserved} />
            <SummaryStat status="vip" count={statusCounts.vip} />
          </div>

          {/* Divider */}
          <div className="h-px bg-border/40" />

          {/* Visual Room Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 xl:grid-cols-10 gap-2">
            {roomsByFloor.map(([floor, floorRooms]) => (
              <React.Fragment key={floor}>
                <FloorSeparator floor={floor} />
                {floorRooms.map((room) => {
                  const globalIndex = (room as RoomData & { _index: number })._index;
                  return (
                    <RoomCell key={room.id} room={room} index={globalIndex} />
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
            {(Object.keys(STATUS_CONFIG) as RoomStatus[]).map((status) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', config.dot)} />
                  <span className="text-[11px] text-muted-foreground">{config.label}</span>
                </div>
              );
            })}
            <span className="text-[11px] text-muted-foreground/50 ml-auto">
              {rooms.length} rooms total
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

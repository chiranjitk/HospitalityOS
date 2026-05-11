'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import {
  Bed,
  Users,
  Wrench,
  Crown,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'vip';

interface RoomData {
  number: string;
  floor: number;
  status: RoomStatus;
  type: string;
  guestName?: string;
  checkoutDate?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────

const MOCK_ROOMS: RoomData[] = [
  { number: '101', floor: 1, status: 'available', type: 'Standard Room' },
  { number: '102', floor: 1, status: 'occupied', type: 'Deluxe Room', guestName: 'John Smith', checkoutDate: 'May 15' },
  { number: '103', floor: 1, status: 'vip', type: 'Royal Suite', guestName: 'Sarah Johnson', checkoutDate: 'May 18' },
  { number: '104', floor: 1, status: 'maintenance', type: 'Standard Room' },
  { number: '105', floor: 1, status: 'occupied', type: 'Deluxe Room', guestName: 'Michael Chen', checkoutDate: 'May 16' },
  { number: '106', floor: 1, status: 'available', type: 'Standard Room' },
  { number: '201', floor: 2, status: 'occupied', type: 'Premium Suite', guestName: 'Emily Davis', checkoutDate: 'May 20' },
  { number: '202', floor: 2, status: 'available', type: 'Deluxe Room' },
  { number: '203', floor: 2, status: 'vip', type: 'Presidential Suite', guestName: 'Robert Williams', checkoutDate: 'May 22' },
  { number: '204', floor: 2, status: 'occupied', type: 'Standard Room', guestName: 'Lisa Brown', checkoutDate: 'May 14' },
  { number: '205', floor: 2, status: 'maintenance', type: 'Deluxe Room' },
  { number: '206', floor: 2, status: 'available', type: 'Standard Room' },
  { number: '301', floor: 3, status: 'available', type: 'Standard Room' },
  { number: '302', floor: 3, status: 'occupied', type: 'Premium Suite', guestName: 'David Wilson', checkoutDate: 'May 17' },
  { number: '303', floor: 3, status: 'occupied', type: 'Deluxe Room', guestName: 'Jessica Taylor', checkoutDate: 'May 19' },
  { number: '304', floor: 3, status: 'available', type: 'Standard Room' },
  { number: '305', floor: 3, status: 'vip', type: 'Royal Suite', guestName: 'James Anderson', checkoutDate: 'May 25' },
  { number: '306', floor: 3, status: 'maintenance', type: 'Standard Room' },
  { number: '401', floor: 4, status: 'occupied', type: 'Deluxe Room', guestName: 'Amanda Martinez', checkoutDate: 'May 16' },
  { number: '402', floor: 4, status: 'available', type: 'Standard Room' },
  { number: '403', floor: 4, status: 'occupied', type: 'Premium Suite', guestName: 'Christopher Lee', checkoutDate: 'May 21' },
  { number: '404', floor: 4, status: 'available', type: 'Deluxe Room' },
  { number: '405', floor: 4, status: 'occupied', type: 'Standard Room', guestName: 'Rachel Garcia', checkoutDate: 'May 15' },
  { number: '406', floor: 4, status: 'available', type: 'Standard Room' },
];

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

// ─── Main Component ─────────────────────────────────────────────────────

export function RoomStatusOverview() {
  const { setActiveSection } = useUIStore();

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<RoomStatus, number> = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      vip: 0,
    };
    MOCK_ROOMS.forEach((room) => {
      counts[room.status]++;
    });
    return counts;
  }, []);

  // Group rooms by floor
  const roomsByFloor = useMemo(() => {
    const floors = new Map<number, RoomData[]>();
    MOCK_ROOMS.forEach((room) => {
      const existing = floors.get(room.floor) || [];
      existing.push(room);
      floors.set(room.floor, existing);
    });
    return Array.from(floors.entries()).sort(([a], [b]) => a - b);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 shadow-md rounded-2xl bg-card hover-lift">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryStat status="available" count={statusCounts.available} />
            <SummaryStat status="occupied" count={statusCounts.occupied} />
            <SummaryStat status="maintenance" count={statusCounts.maintenance} />
            <SummaryStat status="vip" count={statusCounts.vip} />
          </div>

          {/* Divider */}
          <div className="h-px bg-border/40" />

          {/* Visual Room Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 xl:grid-cols-10 gap-2">
            {roomsByFloor.map(([floor, rooms]) => (
              <React.Fragment key={floor}>
                <FloorSeparator floor={floor} />
                {rooms.map((room) => (
                  <RoomCell key={room.number} room={room} index={MOCK_ROOMS.indexOf(room)} />
                ))}
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
              {MOCK_ROOMS.length} rooms total
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

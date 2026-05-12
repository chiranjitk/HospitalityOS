'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Building2,
  Bed,
  Crown,
  Bath,
  ZoomIn,
  ZoomOut,
  Users,
  Wrench,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  User,
  CreditCard,
  Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'vip';
type RoomType = 'standard' | 'suite' | 'deluxe';

interface RoomData {
  id: string;
  number: string;
  type: RoomType;
  status: RoomStatus;
  floor: number;
  side: 'left' | 'right';
  position: number;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  plan?: string;
  phone?: string;
  notes?: string;
  maintenanceReason?: string;
}

// ─── Status Config ──────────────────────────────────────────────────────

const statusConfig: Record<RoomStatus, {
  label: string;
  bg: string;
  fill: string;
  stroke: string;
  text: string;
  badge: string;
  dot: string;
}> = {
  available: {
    label: 'Available',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    fill: '#10b981',
    stroke: '#059669',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    label: 'Occupied',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    fill: '#f59e0b',
    stroke: '#d97706',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  maintenance: {
    label: 'Maintenance',
    bg: 'bg-red-50 dark:bg-red-950/40',
    fill: '#ef4444',
    stroke: '#dc2626',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    dot: 'bg-red-500',
  },
  vip: {
    label: 'VIP',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    fill: '#8b5cf6',
    stroke: '#7c3aed',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
};

const roomTypeIcons: Record<RoomType, React.ElementType> = {
  standard: Bed,
  suite: Crown,
  deluxe: Bath,
};

// ─── Mock Data Generator ────────────────────────────────────────────────

function generateMockData(): RoomData[] {
  const rooms: RoomData[] = [];
  const guestNames = [
    'James Wilson', 'Maria Garcia', 'David Chen', 'Sarah Johnson',
    'Robert Kim', 'Emily Davis', 'Michael Brown', 'Lisa Anderson',
    'Thomas Lee', 'Jennifer Martinez', 'Daniel Taylor', 'Rachel White',
    'Christopher Moore', 'Amanda Clark', 'Matthew Hall', 'Stephanie Young',
    'Andrew King', 'Nicole Wright', 'Joshua Lopez', 'Samantha Hill',
    'Ryan Scott', 'Lauren Green', 'Brandon Adams', 'Megan Baker',
  ];
  const plans = ['Bed & Breakfast', 'Half Board', 'Full Board', 'All-Inclusive', 'Room Only'];
  const maintenanceReasons = [
    'Plumbing repair', 'AC maintenance', 'Deep cleaning', 'Carpet replacement', 'Window repair',
  ];

  const statusDistribution: RoomStatus[] = [
    'available', 'occupied', 'occupied', 'occupied', 'occupied', 'vip', 'maintenance',
    'available', 'occupied', 'occupied', 'vip', 'available',
    'occupied', 'occupied', 'available', 'maintenance', 'occupied', 'occupied',
    'available', 'occupied', 'occupied', 'available', 'occupied', 'vip',
    'available', 'available', 'occupied', 'occupied', 'maintenance', 'occupied',
    'occupied', 'vip', 'available', 'occupied', 'occupied', 'available',
  ];

  const roomTypes: RoomType[] = [
    'standard', 'standard', 'standard', 'deluxe', 'deluxe', 'suite',
    'standard', 'standard', 'deluxe', 'standard', 'suite', 'standard',
  ];

  for (let floor = 1; floor <= 3; floor++) {
    for (let pos = 0; pos < 6; pos++) {
      const idx = (floor - 1) * 12 + pos;
      const status = statusDistribution[idx % statusDistribution.length];
      const type = roomTypes[pos % roomTypes.length];
      const roomNum = `${floor}${String(pos + 1).padStart(2, '0')}`;

      const room: RoomData = {
        id: `room-${roomNum}`,
        number: roomNum,
        type,
        status,
        floor,
        side: 'left',
        position: pos,
      };

      if (status === 'occupied' || status === 'vip') {
        const guestIdx = idx % guestNames.length;
        room.guestName = guestNames[guestIdx];
        const ci = new Date();
        ci.setDate(ci.getDate() - (idx % 3 + 1));
        room.checkIn = ci.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const co = new Date();
        co.setDate(co.getDate() + (idx % 4 + 1));
        room.checkOut = co.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        room.plan = plans[idx % plans.length];
        room.phone = `+1 555-${String(1000 + idx).slice(1)}`;
      }

      if (status === 'maintenance') {
        room.maintenanceReason = maintenanceReasons[idx % maintenanceReasons.length];
      }

      rooms.push(room);
    }

    for (let pos = 0; pos < 6; pos++) {
      const idx = (floor - 1) * 12 + pos + 6;
      const status = statusDistribution[(idx + 3) % statusDistribution.length];
      const type = roomTypes[(pos + 2) % roomTypes.length];
      const roomNum = `${floor}${String(pos + 7).padStart(2, '0')}`;

      const room: RoomData = {
        id: `room-${roomNum}`,
        number: roomNum,
        type,
        status,
        floor,
        side: 'right',
        position: pos,
      };

      if (status === 'occupied' || status === 'vip') {
        const guestIdx = (idx + 5) % guestNames.length;
        room.guestName = guestNames[guestIdx];
        const ci = new Date();
        ci.setDate(ci.getDate() - (idx % 2 + 1));
        room.checkIn = ci.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const co = new Date();
        co.setDate(co.getDate() + (idx % 5 + 1));
        room.checkOut = co.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        room.plan = plans[(idx + 2) % plans.length];
        room.phone = `+1 555-${String(2000 + idx).slice(1)}`;
      }

      if (status === 'maintenance') {
        room.maintenanceReason = maintenanceReasons[(idx + 1) % maintenanceReasons.length];
      }

      rooms.push(room);
    }
  }

  return rooms;
}

// ─── Room SVG Component ─────────────────────────────────────────────────

function RoomRect({
  room,
  x,
  y,
  width,
  height,
  zoom,
  onClick,
  isSelected,
}: {
  room: RoomData;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  onClick: () => void;
  isSelected: boolean;
}) {
  const config = statusConfig[room.status];
  const TypeIcon = roomTypeIcons[room.type];
  const [isHovered, setIsHovered] = useState(false);

  const fillOpacity = isHovered ? 0.25 : 0.12;
  const strokeOpacity = isHovered ? 1 : 0.6;
  const strokeWidth = isSelected ? 2.5 : isHovered ? 2 : 1;

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Room rectangle */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill={config.fill}
        fillOpacity={fillOpacity}
        stroke={config.fill}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        className="transition-all duration-200"
      />

      {/* Selected indicator */}
      {isSelected && (
        <rect
          x={x - 1}
          y={y - 1}
          width={width + 2}
          height={height + 2}
          rx={5}
          ry={5}
          fill="none"
          stroke={config.fill}
          strokeWidth={2}
          strokeDasharray="4 2"
          className="animate-pulse"
        />
      )}

      {/* Room number */}
      <text
        x={x + width / 2}
        y={y + (zoom >= 0.8 ? 16 : height / 2 - 2)}
        textAnchor="middle"
        className="fill-foreground"
        fontSize={zoom >= 0.8 ? 11 : 9}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        {room.number}
      </text>

      {/* Type icon (only at higher zoom) */}
      {zoom >= 0.8 && (
        <g transform={`translate(${x + width / 2 - 6}, ${y + 22})`}>
          <foreignObject width={12} height={12}>
            <TypeIcon
              className="h-3 w-3"
              style={{ color: config.fill }}
            />
          </foreignObject>
        </g>
      )}

      {/* Status dot */}
      <circle
        cx={x + width - 6}
        cy={y + 6}
        r={2.5}
        fill={config.fill}
        className={room.status === 'available' ? 'animate-pulse' : ''}
      />

      {/* Hover tooltip area indicator */}
      {isHovered && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={4}
          ry={4}
          fill={config.fill}
          fillOpacity={0.08}
          className="pointer-events-none"
        />
      )}
    </g>
  );
}

// ─── Room Detail Card ───────────────────────────────────────────────────

function RoomDetailCard({
  room,
  onClose,
}: {
  room: RoomData;
  onClose: () => void;
}) {
  const config = statusConfig[room.status];
  const TypeIcon = roomTypeIcons[room.type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.2 }}
      className="absolute z-20 right-4 top-4 w-72"
    >
      <Card className={cn('border shadow-xl', `border-current/20`)}>
        <CardHeader className={cn('pb-3 relative', config.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: config.fill + '20' }}
              >
                <TypeIcon className="h-4 w-4" style={{ color: config.fill }} />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Room {room.number}</CardTitle>
                <p className="text-xs text-muted-foreground capitalize">{room.type} Room</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Badge className={cn('text-[10px] font-semibold mt-2 w-fit', config.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full mr-1', config.dot)} />
            {config.label}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {room.guestName && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{room.guestName}</span>
                {room.status === 'vip' && (
                  <Crown className="h-3.5 w-3.5 text-violet-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {room.checkIn} → {room.checkOut}
                </span>
              </div>
              {room.plan && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{room.plan}</span>
                </div>
              )}
              {room.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{room.phone}</span>
                </div>
              )}
            </div>
          )}

          {room.status === 'maintenance' && room.maintenanceReason && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
              <Wrench className="h-3.5 w-3.5 text-red-500 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Under Maintenance</p>
                <p className="text-[11px] text-red-600/70 dark:text-red-400/70">{room.maintenanceReason}</p>
              </div>
            </div>
          )}

          {room.status === 'available' && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <Bed className="h-3.5 w-3.5 text-emerald-500 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready for Check-in</p>
                <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Room is clean and available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function RoomFloorPlanWidget() {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);

  const allRooms = useMemo(() => generateMockData(), []);

  const floorRooms = useMemo(
    () => allRooms.filter((r) => r.floor === currentFloor),
    [allRooms, currentFloor]
  );

  const stats = useMemo(() => {
    const total = floorRooms.length;
    const available = floorRooms.filter((r) => r.status === 'available').length;
    const occupied = floorRooms.filter((r) => r.status === 'occupied').length;
    const maintenance = floorRooms.filter((r) => r.status === 'maintenance').length;
    const vip = floorRooms.filter((r) => r.status === 'vip').length;
    return { total, available, occupied, maintenance, vip };
  }, [floorRooms]);

  const leftRooms = useMemo(
    () => floorRooms.filter((r) => r.side === 'left').sort((a, b) => a.position - b.position),
    [floorRooms]
  );
  const rightRooms = useMemo(
    () => floorRooms.filter((r) => r.side === 'right').sort((a, b) => a.position - b.position),
    [floorRooms]
  );

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.15, 1.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.15, 0.5)), []);
  const handlePrevFloor = useCallback(() => {
    setSelectedRoom(null);
    setCurrentFloor((f) => Math.max(1, f - 1));
  }, []);
  const handleNextFloor = useCallback(() => {
    setSelectedRoom(null);
    setCurrentFloor((f) => Math.min(3, f + 1));
  }, []);

  // SVG dimensions
  const svgWidth = 700;
  const svgHeight = 400;
  const roomWidth = 90;
  const roomHeight = 50;
  const roomGapX = 10;
  const roomGapY = 14;
  const corridorY = 170;
  const corridorHeight = 60;
  const leftStartX = 30;
  const rightStartX = svgWidth - 30 - roomWidth;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 shadow-sm">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              Room Floor Plan
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Floor selector with arrows */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handlePrevFloor}
                  disabled={currentFloor <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Select
                  value={String(currentFloor)}
                  onValueChange={(v) => {
                    setCurrentFloor(Number(v));
                    setSelectedRoom(null);
                  }}
                >
                  <SelectTrigger className="h-7 w-[100px] text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Floor 1</SelectItem>
                    <SelectItem value="2">Floor 2</SelectItem>
                    <SelectItem value="3">Floor 3</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleNextFloor}
                  disabled={currentFloor >= 3}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1 border border-border/50 rounded-md p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleZoomIn}
                  disabled={zoom >= 1.5}
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total Rooms', value: stats.total, icon: Building2, color: 'text-foreground', bg: 'bg-muted/50' },
              { label: 'Available', value: stats.available, icon: Bed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Occupied', value: stats.occupied, icon: Users, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
              { label: 'Maintenance', value: stats.maintenance, icon: Wrench, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border border-border/30',
                  stat.bg
                )}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                <stat.icon className={cn('h-3.5 w-3.5 flex-shrink-0', stat.color)} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-bold tabular-nums leading-none', stat.color)}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                    {stat.label}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Floor Plan SVG */}
          <div className="relative rounded-lg border border-border/30 bg-background overflow-auto">
            <div
              className="relative"
              style={{
                minWidth: svgWidth * zoom,
                minHeight: svgHeight * zoom,
              }}
            >
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto"
                style={{
                  minWidth: svgWidth * zoom * 0.7,
                  transform: `scale(${Math.max(zoom, 0.7)})`,
                  transformOrigin: 'top left',
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background */}
                <rect
                  x={0}
                  y={0}
                  width={svgWidth}
                  height={svgHeight}
                  rx={8}
                  fill="var(--color-muted, #f1f5f9)"
                  fillOpacity={0.3}
                />

                {/* Floor label */}
                <text
                  x={svgWidth / 2}
                  y={22}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={12}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  Floor {currentFloor}
                </text>

                {/* Corridor */}
                <rect
                  x={20}
                  y={corridorY}
                  width={svgWidth - 40}
                  height={corridorHeight}
                  rx={4}
                  fill="var(--color-muted, #e2e8f0)"
                  fillOpacity={0.5}
                  stroke="var(--color-border, #cbd5e1)"
                  strokeWidth={0.5}
                  strokeDasharray="6 3"
                />
                <text
                  x={svgWidth / 2}
                  y={corridorY + corridorHeight / 2 + 4}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                  fontWeight="500"
                  fontFamily="system-ui, sans-serif"
                  opacity={0.5}
                >
                  ──── CORRIDOR ────
                </text>

                {/* Elevator / Stairs indicator */}
                <rect
                  x={svgWidth / 2 - 25}
                  y={corridorY + 12}
                  width={50}
                  height={corridorHeight - 24}
                  rx={4}
                  fill="var(--color-muted, #e2e8f0)"
                  stroke="var(--color-border, #cbd5e1)"
                  strokeWidth={0.5}
                />
                <text
                  x={svgWidth / 2}
                  y={corridorY + corridorHeight / 2 + 1}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={8}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  ELEV
                </text>

                {/* Left side rooms */}
                {leftRooms.map((room, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const x = leftStartX + col * (roomWidth + roomGapX);
                  const y = row === 0 ? 36 : corridorY + corridorHeight + 12;

                  return (
                    <Tooltip key={room.id}>
                      <TooltipTrigger asChild>
                        <g>
                          <RoomRect
                            room={room}
                            x={x}
                            y={y}
                            width={roomWidth}
                            height={roomHeight}
                            zoom={zoom}
                            onClick={() =>
                              setSelectedRoom(selectedRoom?.id === room.id ? null : room)
                            }
                            isSelected={selectedRoom?.id === room.id}
                          />
                        </g>
                      </TooltipTrigger>
                      <TooltipContent
                        side={row === 0 ? 'top' : 'bottom'}
                        className="text-xs max-w-[200px] p-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                statusConfig[room.status].dot
                              )}
                            />
                            <span className="font-semibold">Room {room.number}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1 py-0 h-4',
                                statusConfig[room.status].badge
                              )}
                            >
                              {statusConfig[room.status].label}
                            </Badge>
                          </div>
                          {room.guestName && (
                            <p className="text-muted-foreground">{room.guestName}</p>
                          )}
                          {room.checkIn && room.checkOut && (
                            <p className="text-muted-foreground text-[10px]">
                              {room.checkIn} → {room.checkOut}
                            </p>
                          )}
                          {room.plan && (
                            <p className="text-muted-foreground text-[10px]">{room.plan}</p>
                          )}
                          {room.maintenanceReason && (
                            <p className="text-red-500/80 text-[10px]">
                              {room.maintenanceReason}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Right side rooms */}
                {rightRooms.map((room, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const x = rightStartX - col * (roomWidth + roomGapX);
                  const y = row === 0 ? 36 : corridorY + corridorHeight + 12;

                  return (
                    <Tooltip key={room.id}>
                      <TooltipTrigger asChild>
                        <g>
                          <RoomRect
                            room={room}
                            x={x}
                            y={y}
                            width={roomWidth}
                            height={roomHeight}
                            zoom={zoom}
                            onClick={() =>
                              setSelectedRoom(selectedRoom?.id === room.id ? null : room)
                            }
                            isSelected={selectedRoom?.id === room.id}
                          />
                        </g>
                      </TooltipTrigger>
                      <TooltipContent
                        side={row === 0 ? 'top' : 'bottom'}
                        className="text-xs max-w-[200px] p-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                statusConfig[room.status].dot
                              )}
                            />
                            <span className="font-semibold">Room {room.number}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1 py-0 h-4',
                                statusConfig[room.status].badge
                              )}
                            >
                              {statusConfig[room.status].label}
                            </Badge>
                          </div>
                          {room.guestName && (
                            <p className="text-muted-foreground">{room.guestName}</p>
                          )}
                          {room.checkIn && room.checkOut && (
                            <p className="text-muted-foreground text-[10px]">
                              {room.checkIn} → {room.checkOut}
                            </p>
                          )}
                          {room.plan && (
                            <p className="text-muted-foreground text-[10px]">{room.plan}</p>
                          )}
                          {room.maintenanceReason && (
                            <p className="text-red-500/80 text-[10px]">
                              {room.maintenanceReason}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Door markers on corridor side */}
                {leftRooms.map((room, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const x = leftStartX + col * (roomWidth + roomGapX) + roomWidth / 2;
                  const y = row === 0 ? 36 + roomHeight : corridorY + corridorHeight + 12;

                  return (
                    <rect
                      key={`door-l-${room.id}`}
                      x={x - 4}
                      y={row === 0 ? y - 2 : y - 2}
                      width={8}
                      height={4}
                      rx={1}
                      fill={statusConfig[room.status].fill}
                      fillOpacity={0.4}
                    />
                  );
                })}
                {rightRooms.map((room, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const x = rightStartX - col * (roomWidth + roomGapX) + roomWidth / 2;
                  const y = row === 0 ? 36 + roomHeight : corridorY + corridorHeight + 12;

                  return (
                    <rect
                      key={`door-r-${room.id}`}
                      x={x - 4}
                      y={row === 0 ? y - 2 : y - 2}
                      width={8}
                      height={4}
                      rx={1}
                      fill={statusConfig[room.status].fill}
                      fillOpacity={0.4}
                    />
                  );
                })}
              </svg>

              {/* Room Detail Card Overlay */}
              <AnimatePresence>
                {selectedRoom && (
                  <RoomDetailCard
                    room={selectedRoom}
                    onClose={() => setSelectedRoom(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-3 flex-wrap">
              {(
                Object.entries(statusConfig) as [RoomStatus, typeof statusConfig[RoomStatus]][]
              ).map(([key, config]) => {
                const count = floorRooms.filter((r) => r.status === key).length;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', config.dot)} />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {config.label}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-foreground">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">Click a room for details</span>
              <AlertTriangle className="h-3 w-3 text-muted-foreground/30" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default RoomFloorPlanWidget;

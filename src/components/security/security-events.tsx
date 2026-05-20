'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert,
  Flame,
  Wrench,
  User,
  Car,
  Truck,
  CameraOff,
  Clock,
  Users,
  AlertTriangle,
  Eye,
  CheckCircle,
  Bell,
  BellOff,
  RefreshCw,
  Filter,
  Activity,
  Move,
  MapPin,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SecurityEvent {
  id: string;
  tenantId: string;
  cameraId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  thumbnail: string | null;
  recordingId: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  notes: string | null;
  camera: {
    id: string;
    name: string;
    location: string | null;
    status: string;
  };
}

interface EventStats {
  totalEvents: number;
  unacknowledgedCount: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

interface CameraOption {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

type SortOption = 'newest' | 'oldest' | 'severity';
type AckFilter = 'all' | 'unacknowledged' | 'acknowledged';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'motion_detected',
  'vehicle_entry',
  'unauthorized_access',
  'camera_offline',
  'intrusion',
  'tampering',
  'face_detected',
  'loitering',
  'crowd_detected',
  'fire_smoke',
  'vehicle_detected',
] as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  motion_detected: 'Motion Detected',
  vehicle_entry: 'Vehicle Entry',
  unauthorized_access: 'Unauthorized Access',
  camera_offline: 'Camera Offline',
  intrusion: 'Intrusion',
  tampering: 'Tampering',
  face_detected: 'Face Detected',
  loitering: 'Loitering',
  crowd_detected: 'Crowd Detected',
  fire_smoke: 'Fire / Smoke',
  vehicle_detected: 'Vehicle Detected',
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
  high: { label: 'High', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  medium: { label: 'Medium', color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' },
  low: { label: 'Low', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
} as const;

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Type icon mapping ──────────────────────────────────────────────────────

function getEventTypeIcon(type: string, className?: string) {
  const props = { className: className || 'h-4 w-4' };
  switch (type) {
    case 'motion_detected':
      return <Move {...props} />;
    case 'intrusion':
      return <ShieldAlert {...props} />;
    case 'fire_smoke':
      return <Flame {...props} />;
    case 'tampering':
      return <Wrench {...props} />;
    case 'face_detected':
      return <User {...props} />;
    case 'vehicle_detected':
      return <Car {...props} />;
    case 'camera_offline':
      return <CameraOff {...props} />;
    case 'loitering':
      return <Clock {...props} />;
    case 'crowd_detected':
      return <Users {...props} />;
    case 'vehicle_entry':
      return <Truck {...props} />;
    case 'unauthorized_access':
      return <AlertTriangle {...props} />;
    default:
      return <Activity {...props} />;
  }
}

// ─── Severity bar component ──────────────────────────────────────────────────

function SeverityBar({ stats }: { stats: Record<string, number> }) {
  const total = Object.values(stats).reduce((sum, v) => sum + v, 0);
  if (total === 0) return null;

  const entries = Object.entries(stats).sort(([a], [b]) => (SEVERITY_ORDER[a] ?? 4) - (SEVERITY_ORDER[b] ?? 4));

  return (
    <div className="flex rounded-full overflow-hidden h-3 bg-muted">
      {entries.map(([key, count]) => {
        const pct = (count / total) * 100;
        if (pct === 0) return null;
        const bgMap: Record<string, string> = {
          critical: 'bg-red-500',
          high: 'bg-orange-500',
          medium: 'bg-yellow-500',
          low: 'bg-emerald-500',
        };
        return (
          <div
            key={key}
            className={bgMap[key] || 'bg-gray-500'}
            style={{ width: `${pct}%` }}
            title={`${key}: ${count} (${Math.round(pct)}%)`}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SecurityEvents() {
  // ── State ──
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<EventStats>({
    totalEvents: 0,
    unacknowledgedCount: 0,
    byType: {},
    bySeverity: {},
  });
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());

  // Filters
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [ackFilter, setAckFilter] = useState<AckFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Dialogs
  const [acknowledgeEvent, setAcknowledgeEvent] = useState<SecurityEvent | null>(null);
  const [ackNotes, setAckNotes] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [detailEvent, setDetailEvent] = useState<SecurityEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Auto-refresh
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState(30);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/security/events?stats=true');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cameraFilter !== 'all') params.append('cameraId', cameraFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (ackFilter !== 'all') params.append('acknowledged', String(ackFilter === 'acknowledged'));
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', '50');
      params.append('offset', '0');

      const res = await fetch(`/api/security/events?${params}`);
      const json = await res.json();
      if (json.success) {
        const newEvents: SecurityEvent[] = json.data || [];
        // Detect new events
        const prevIds = knownIdsRef.current;
        const fresh = newEvents.filter((e: SecurityEvent) => !prevIds.has(e.id));
        if (fresh.length > 0) {
          const freshIds = new Set(fresh.map((e: SecurityEvent) => e.id));
          setNewEventIds((prev) => {
            const next = new Set(prev);
            freshIds.forEach((id) => next.add(id));
            return next;
          });
          // Clear highlight after 5 seconds
          setTimeout(() => {
            setNewEventIds((prev) => {
              const next = new Set(prev);
              freshIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 5000);
        }
        knownIdsRef.current = new Set(newEvents.map((e: SecurityEvent) => e.id));

        // Client-side sorting
        let sorted = [...newEvents];
        if (sortBy === 'oldest') {
          sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        } else if (sortBy === 'severity') {
          sorted.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));
        }
        // newest is default from API, but sort anyway for consistency
        if (sortBy === 'newest') {
          sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        setEvents(sorted);
        setLastUpdated(new Date());
      }
    } catch {
      // silent
    }
  }, [cameraFilter, typeFilter, severityFilter, ackFilter, startDate, endDate, sortBy]);

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/security/cameras');
      const json = await res.json();
      if (json.success && json.data?.cameras) {
        setCameras(json.data.cameras);
      }
    } catch {
      // silent
    }
  }, []);

  const refreshAll = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchEvents()]);
    setIsRefreshing(false);
    setCountdown(30);
  }, [fetchStats, fetchEvents]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchStats(), fetchEvents(), fetchCameras()]);
      setIsLoading(false);
    };
    init();
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshAll();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshAll]);

  // ── Acknowledge handler ──

  const handleAcknowledge = async () => {
    if (!acknowledgeEvent) return;
    setIsAcknowledging(true);
    try {
      const res = await fetch('/api/security/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: acknowledgeEvent.id,
          acknowledged: true,
          acknowledgedBy: 'current_user',
          notes: ackNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Event acknowledged', {
          description: `${EVENT_TYPE_LABELS[acknowledgeEvent.type] || acknowledgeEvent.type} event has been marked as reviewed.`,
        });
        setAcknowledgeEvent(null);
        setAckNotes('');
        refreshAll();
      } else {
        toast.error('Failed to acknowledge', {
          description: json.error?.message || 'Something went wrong.',
        });
      }
    } catch {
      toast.error('Failed to acknowledge', { description: 'Network error.' });
    } finally {
      setIsAcknowledging(false);
    }
  };

  // ── Format helpers ──

  const formatRelativeTime = (ts: string) => {
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return ts;
    }
  };

  // ── Has active filters ──

  const hasActiveFilters =
    cameraFilter !== 'all' ||
    typeFilter !== 'all' ||
    severityFilter !== 'all' ||
    ackFilter !== 'all' ||
    startDate ||
    endDate;

  const clearFilters = () => {
    setCameraFilter('all');
    setTypeFilter('all');
    setSeverityFilter('all');
    setAckFilter('all');
    setStartDate('');
    setEndDate('');
  };

  // ── Render ──

  return (
    <SectionGuard permission="surveillance.alerts">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Security Events
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor and manage surveillance alerts across all cameras
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  countdown <= 5 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                )}
              />
              Auto-refresh in {countdown}s
            </div>
            {lastUpdated && (
              <span className="hidden md:inline text-xs text-muted-foreground">
                Updated {formatRelativeTime(lastUpdated.toISOString())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAll(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(hasActiveFilters && 'border-primary text-primary')}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* ── Stats Overview Cards ── */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-7 w-16 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Total Events */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalEvents}</div>
                  <div className="text-xs text-muted-foreground">Total Events</div>
                </div>
              </div>
            </Card>

            {/* Unacknowledged */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 relative">
                  <Bell className="h-5 w-5 text-red-500 dark:text-red-400" />
                  {stats.unacknowledgedCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.unacknowledgedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Unacknowledged</div>
                </div>
              </div>
            </Card>

            {/* Critical + High */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ShieldAlert className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {(stats.bySeverity?.critical || 0) + (stats.bySeverity?.high || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Critical &amp; High</div>
                </div>
              </div>
            </Card>

            {/* Severity Breakdown */}
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Severity Breakdown</span>
                </div>
                <SeverityBar stats={stats.bySeverity || {}} />
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(stats.bySeverity || {}).map(([key, count]) => {
                    const cfg = SEVERITY_CONFIG[key as keyof typeof SEVERITY_CONFIG];
                    if (!cfg || count === 0) return null;
                    return (
                      <span key={key} className="text-xs text-muted-foreground">
                        <span className={cn('font-semibold', cfg.color.split(' ')[1])}>{count}</span>{' '}
                        {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Type Breakdown Badges ── */}
        {!isLoading && stats.byType && Object.keys(stats.byType).length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Events by Type
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      typeFilter === type
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'hover:bg-muted/80 border-border'
                    )}
                  >
                    {getEventTypeIcon(type, 'h-3 w-3')}
                    {EVENT_TYPE_LABELS[type] || type}
                    <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                      {count}
                    </Badge>
                  </button>
                ))}
            </div>
          </Card>
        )}

        {/* ── Filter Bar ── */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Filters</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                    <X className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {/* Camera */}
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger className="h-9">
                    <CameraOff className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Cameras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cameras</SelectItem>
                    {cameras.map((cam) => (
                      <SelectItem key={cam.id} value={cam.id}>
                        {cam.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Event Type */}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9">
                    <Activity className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Severity */}
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-9">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Acknowledged */}
                <Select
                  value={ackFilter}
                  onValueChange={(v) => setAckFilter(v as AckFilter)}
                >
                  <SelectTrigger className="h-9">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  </SelectContent>
                </Select>

                {/* Start Date */}
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pl-8 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {/* End Date */}
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pl-8 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Sort Bar ── */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''} found
          </span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="severity">Severity (High → Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Events List ── */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BellOff className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm font-medium">No events found</p>
                <p className="text-xs mt-1">Try adjusting your filters or wait for new events</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="divide-y">
                  {events.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isNew={newEventIds.has(event.id)}
                      onAcknowledge={() => setAcknowledgeEvent(event)}
                      onViewDetails={() => setDetailEvent(event)}
                      formatRelativeTime={formatRelativeTime}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* ── Acknowledge Dialog ── */}
        <Dialog open={!!acknowledgeEvent} onOpenChange={(open) => { if (!open) { setAcknowledgeEvent(null); setAckNotes(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Acknowledge Event
              </DialogTitle>
              <DialogDescription>
                Review and acknowledge this security event
              </DialogDescription>
            </DialogHeader>
            {acknowledgeEvent && (
              <div className="space-y-4">
                {/* Event summary */}
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventTypeIcon(acknowledgeEvent.type)}
                      <span className="font-medium text-sm">
                        {EVENT_TYPE_LABELS[acknowledgeEvent.type] || acknowledgeEvent.type}
                      </span>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', SEVERITY_CONFIG[acknowledgeEvent.severity]?.color)}>
                      {SEVERITY_CONFIG[acknowledgeEvent.severity]?.label || acknowledgeEvent.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {acknowledgeEvent.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {acknowledgeEvent.camera?.name || 'Unknown Camera'}
                    {acknowledgeEvent.camera?.location && ` — ${acknowledgeEvent.camera.location}`}
                  </div>
                </div>

                {/* Thumbnail */}
                {acknowledgeEvent.thumbnail && (
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={acknowledgeEvent.thumbnail}
                      alt="Event thumbnail"
                      className="w-full h-40 object-cover"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    value={ackNotes}
                    onChange={(e) => setAckNotes(e.target.value)}
                    placeholder="Add notes about how this event was handled..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => { setAcknowledgeEvent(null); setAckNotes(''); }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
              >
                {isAcknowledging ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Acknowledge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Event Detail Dialog ── */}
        <Dialog open={!!detailEvent} onOpenChange={(open) => { if (!open) setDetailEvent(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Event Details
              </DialogTitle>
            </DialogHeader>
            {detailEvent && (
              <div className="space-y-4">
                {/* Top: Type, Severity */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getEventTypeIcon(detailEvent.type, 'h-5 w-5')}
                    <span className="font-semibold">
                      {EVENT_TYPE_LABELS[detailEvent.type] || detailEvent.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(SEVERITY_CONFIG[detailEvent.severity]?.color)}>
                      {SEVERITY_CONFIG[detailEvent.severity]?.label}
                    </Badge>
                    {detailEvent.acknowledged ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Acknowledged
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <Bell className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Description
                  </span>
                  <p className="text-sm mt-1">{detailEvent.description}</p>
                </div>

                {/* Thumbnail */}
                {detailEvent.thumbnail && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Thumbnail
                    </span>
                    <div className="mt-1 rounded-lg overflow-hidden border">
                      <img
                        src={detailEvent.thumbnail}
                        alt="Event capture"
                        className="w-full h-52 object-cover"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Camera</span>
                    <p className="font-medium mt-0.5 flex items-center gap-1">
                      <CameraOff className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailEvent.camera?.name || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Location</span>
                    <p className="font-medium mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailEvent.camera?.location || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Timestamp</span>
                    <p className="font-medium mt-0.5">
                      {format(new Date(detailEvent.timestamp), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(detailEvent.timestamp)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Camera Status</span>
                    <Badge
                      variant={detailEvent.camera?.status === 'online' ? 'success' : 'destructive'}
                      className="mt-0.5"
                    >
                      {detailEvent.camera?.status || 'unknown'}
                    </Badge>
                  </div>
                </div>

                {/* Acknowledge Info */}
                {detailEvent.acknowledged && (
                  <>
                    <Separator />
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Acknowledged
                      </span>
                      <div className="mt-1 text-sm space-y-0.5">
                        <p>
                          By: <span className="font-medium">{detailEvent.acknowledgedBy || 'Unknown'}</span>
                        </p>
                        {detailEvent.acknowledgedAt && (
                          <p className="text-muted-foreground">
                            {format(new Date(detailEvent.acknowledgedAt), 'MMM d, yyyy HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Notes */}
                {detailEvent.notes && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Notes
                      </span>
                      <p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{detailEvent.notes}</p>
                    </div>
                  </>
                )}

                {/* Metadata */}
                {detailEvent.metadata && Object.keys(detailEvent.metadata).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Metadata
                        </span>
                      </div>
                      <pre className="text-xs bg-muted/80 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(detailEvent.metadata, null, 2)}
                      </pre>
                    </div>
                  </>
                )}

                {/* Action buttons */}
                {!detailEvent.acknowledged && (
                  <>
                    <Separator />
                    <Button
                      className="w-full"
                      onClick={() => {
                        setDetailEvent(null);
                        setAcknowledgeEvent(detailEvent);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Acknowledge Event
                    </Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SectionGuard>
  );
}

// ─── Event Row Component ─────────────────────────────────────────────────────

function EventRow({
  event,
  isNew,
  onAcknowledge,
  onViewDetails,
  formatRelativeTime,
}: {
  event: SecurityEvent;
  isNew: boolean;
  onAcknowledge: () => void;
  onViewDetails: () => void;
  formatRelativeTime: (ts: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'flex gap-3 p-3 sm:p-4 transition-all duration-500',
        isNew && 'bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-500',
        !event.acknowledged && !isNew && 'bg-orange-500/[0.02]',
        'hover:bg-muted/40'
      )}
    >
      {/* Thumbnail */}
      {event.thumbnail ? (
        <button
          onClick={onViewDetails}
          className="shrink-0 rounded-lg overflow-hidden border h-16 w-24 sm:h-20 sm:w-28 bg-muted cursor-pointer"
        >
          <img
            src={event.thumbnail}
            alt="Event"
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <button
          onClick={onViewDetails}
          className="shrink-0 rounded-lg border h-16 w-24 sm:h-20 sm:w-28 bg-muted/50 flex items-center justify-center cursor-pointer"
        >
          {getEventTypeIcon(event.type, 'h-6 w-6 text-muted-foreground')}
        </button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Event type with icon */}
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {getEventTypeIcon(event.type, 'h-3.5 w-3.5')}
              {EVENT_TYPE_LABELS[event.type] || event.type}
            </span>
            {/* Severity badge */}
            <Badge variant="outline" className={cn('text-[10px] h-5', SEVERITY_CONFIG[event.severity]?.color)}>
              {SEVERITY_CONFIG[event.severity]?.label}
            </Badge>
            {/* Ack status */}
            {event.acknowledged ? (
              <Badge variant="success" className="text-[10px] h-5 gap-0.5">
                <CheckCircle className="h-2.5 w-2.5" />
                Ack
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px] h-5 gap-0.5">
                <Bell className="h-2.5 w-2.5" />
                New
              </Badge>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Description */}
        <p className={cn(
          'text-sm text-muted-foreground mt-0.5',
          !expanded ? 'line-clamp-1' : ''
        )}>
          {event.description}
        </p>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.camera?.name || 'Unknown Camera'}
              {event.camera?.location && (
                <span> — {event.camera.location}</span>
              )}
            </p>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}
            </p>
            {event.notes && (
              <p className="mt-1 bg-muted/50 rounded p-1.5 italic">
                {event.notes}
              </p>
            )}
          </div>
        )}

        {/* Bottom row: camera + time + actions */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
            <span className="flex items-center gap-1 truncate">
              <CameraOff className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.camera?.name || 'Unknown'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!event.acknowledged && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={onAcknowledge}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Ack
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={onViewDetails}
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

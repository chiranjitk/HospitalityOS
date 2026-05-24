'use client';

/**
 * Live Sessions Component
 *
 * Real-time active sessions dashboard.
 * Mobile: card-based layout with prominent disconnect buttons.
 * Desktop: table view with inline actions.
 * Supports search/filter, session details, CoA disconnect, stats cards, auto-refresh.
 * v2: sessions deduplicated at state level + index-fallback keys to prevent duplicate React keys.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Wifi,
  Search,
  Loader2,
  Monitor,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Router,
  UserCircle,
  CircleDot,
  Zap,
  Unplug,
  Smartphone,
  Tablet,
  XCircle,
  Eye,
  AlertTriangle,
  Info,
  Timer,
  Moon,
  Hourglass,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface LiveSession {
  id: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  nasIp: string;
  nasIdentifier?: string;
  deviceType?: string;
  deviceName?: string;
  operatingSystem?: string;
  browser?: string;
  userAgent?: string;
  manufacturer?: string;
  bandwidthDown?: string;
  bandwidthUp?: string;
  bandwidthBurstDown?: string;
  bandwidthBurstUp?: string;
  sessionTime: number;
  dataDownload: number;
  dataUpload: number;
  status: 'active' | 'idle' | 'disconnecting';
  startedAt?: string;
  lastSeenAt?: string;
  sessionTimeout?: number;
  idleTimeout?: number;
  planName?: string;
  roomId?: string;
  guestName?: string;
  propertyName?: string;
  nasPortType?: string;
  avgSpeedDown?: number;
  avgSpeedUp?: number;
  liveSpeedDown?: number;
  liveSpeedUp?: number;
  // Auth method tracking — shows the RADIUS protocol used for authentication
  loginType?: string;   // 'portal' | 'auto_reauth' | 'voucher' | 'mac-auth' — HOW the user connected
  authProtocol?: string; // 'pap' | 'chap' | 'mschapv2' | 'eap-peap' | 'eap-ttls' | 'eap-tls' | 'eap-md5' | 'eap' — RADIUS auth protocol used
  authCount?: number;    // Total times this device has authenticated
}

interface LiveSessionStats {
  totalActive: number;
  peakToday: number;
  peakTodayTime?: string;
  perNas: { nasIp: string; nasIdentifier?: string; count: number }[];
  totalDownload: number;
  totalUpload: number;
}

// ─── Session Terms Info Components (declared outside render) ────────────────────

/** Rich popover content explaining Session Time, Idle Timeout, Session Timeout */
function SessionTermsInfoContent() {
  return (
    <div className="space-y-3 text-sm">
      {/* Session Time */}
      <div className="flex gap-2.5">
        <div className="shrink-0 mt-0.5">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Timer className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Session Time</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <li><span className="font-medium text-foreground/80">What:</span> Total duration since the user connected/logged in</li>
            <li><span className="font-medium text-foreground/80">Starts:</span> When RADIUS sends Access-Accept</li>
            <li><span className="font-medium text-foreground/80">Behavior:</span> Always counts up, never pauses or resets</li>
            <li className="pt-0.5"><span className="font-medium text-foreground/80">Example:</span> Login at 10:00 AM → at 10:30 AM = <span className="font-mono">30m 0s</span></li>
            <li className="italic text-muted-foreground/70">Like a stopwatch that starts when you enter a room</li>
          </ul>
        </div>
      </div>
      {/* Idle Timeout */}
      <div className="flex gap-2.5">
        <div className="shrink-0 mt-0.5">
          <div className="p-1.5 rounded-md bg-amber-500/10">
            <Moon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Idle Timeout</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <li><span className="font-medium text-foreground/80">What:</span> Max allowed inactivity before disconnect</li>
            <li><span className="font-medium text-foreground/80\">Starts:</span> Resets every time user sends/receives traffic</li>
            <li><span className="font-medium text-foreground/80\">Behavior:</span> No traffic for X duration → user disconnected</li>
            <li className="pt-0.5"><span className="font-medium text-foreground/80\">Example:</span> Idle Timeout = <span className="font-mono">5m 0s</span> → user stops browsing → kicked after 5 min</li>
            <li className="italic text-muted-foreground/70">Like a screensaver lock — inactivity triggers it</li>
          </ul>
        </div>
      </div>
      {/* Session Timeout */}
      <div className="flex gap-2.5">
        <div className="shrink-0 mt-0.5">
          <div className="p-1.5 rounded-md bg-rose-500/10">
            <Hourglass className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Session Timeout</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <li><span className="font-medium text-foreground/80">What:</span> Max total session duration regardless of activity</li>
            <li><span className="font-medium text-foreground/80">Behavior:</span> Even with active browsing, time limit enforced</li>
            <li className="pt-0.5"><span className="font-medium text-foreground/80">Example:</span> Timeout = <span className="font-mono">24h 0m</span> → user kicked at 24 hours even if active</li>
            <li className="italic text-muted-foreground/70">Like a parking meter — time runs out no matter what</li>
          </ul>
        </div>
      </div>
      {/* Quick comparison table */}
      <div className="border rounded-md overflow-hidden mt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-2 py-1.5 font-medium">Feature</th>
              <th className="text-left px-2 py-1.5 font-medium">Resets?</th>
              <th className="text-left px-2 py-1.5 font-medium">On Timeout</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-2 py-1.5 font-medium">Session Time</td>
              <td className="px-2 py-1.5 text-muted-foreground">Never</td>
              <td className="px-2 py-1.5 text-muted-foreground">Just a counter</td>
            </tr>
            <tr>
              <td className="px-2 py-1.5 font-medium">Idle Timeout</td>
              <td className="px-2 py-1.5 text-muted-foreground">On every packet</td>
              <td className="px-2 py-1.5 text-destructive font-medium">Disconnected</td>
            </tr>
            <tr>
              <td className="px-2 py-1.5 font-medium">Session Timeout</td>
              <td className="px-2 py-1.5 text-muted-foreground">Never</td>
              <td className="px-2 py-1.5 text-destructive font-medium">Disconnected</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Small circular info button that opens the session terms popover */
function SessionTermsInfoButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          aria-label="Session time terms explained"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="right" align="start" sideOffset={8}>
        <SessionTermsInfoContent />
      </PopoverContent>
    </Popover>
  );
}

/** Full-width dashed card with info button (shown in session details dialog) */
function SessionTermsInfoPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all text-xs group"
        >
          <Info className="h-4 w-4 shrink-0 group-hover:text-primary" />
          <span>What do Session Time, Idle Timeout &amp; Session Timeout mean?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="bottom" align="center" sideOffset={8}>
        <SessionTermsInfoContent />
      </PopoverContent>
    </Popover>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function LiveSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState<LiveSessionStats>({
    totalActive: 0,
    peakToday: 0,
    perNas: [],
    totalDownload: 0,
    totalUpload: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [nasFilter, setNasFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<LiveSession | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDisconnecting, setIsBulkDisconnecting] = useState(false);
  const [bulkDisconnectTarget, setBulkDisconnectTarget] = useState(false);

  // ─── Live Speed polling (Tier 2: real-time speed from live-speed-service) ──
  // Polls the live-speed mini-service every 3 seconds and merges live speed data
  // into sessions by matching on IP address. Falls back to avgSpeed when unavailable.
  const [liveSpeedMap, setLiveSpeedMap] = useState<Record<string, { speedDown: number; speedUp: number }>>({});

  useEffect(() => {
    let cancelled = false;
    const pollSpeeds = async () => {
      try {
        const res = await fetch('/api/wifi/radius?action=live-speeds');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data && !cancelled) {
          setLiveSpeedMap(data.data);
        }
      } catch { /* non-critical — avg speed fallback works */ }
    };
    pollSpeeds();
    const interval = setInterval(pollSpeeds, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Merge live speeds into session data
  const sessionsWithSpeed = useMemo(() => {
    return sessions.map(s => ({
      ...s,
      liveSpeedDown: liveSpeedMap[s.ipAddress]?.speedDown,
      liveSpeedUp: liveSpeedMap[s.ipAddress]?.speedUp,
    }));
  }, [sessions, liveSpeedMap]);

  // CRITICAL: Always deduplicate sessions by id before rendering.
  // Even though the backend uses DISTINCT ON + Map dedup, and fetchSessions()
  // also filters via Set, this useMemo is the final safety net to guarantee
  // no duplicate React keys regardless of any race condition or stale data.
  const uniqueSessions = useMemo(() => {
    const seen = new Map<string, LiveSession>();
    for (const s of sessionsWithSpeed) {
      if (!seen.has(s.id)) seen.set(s.id, s);
    }
    return Array.from(seen.values());
  }, [sessionsWithSpeed]);

  // ─── Debounce search query (300ms) ───────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Fetch Sessions ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (nasFilter !== 'all') params.append('nasIp', nasFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const [sessionRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=live-sessions-list&${params.toString()}`),
        fetch('/api/wifi/radius?action=live-sessions-stats'),
      ]);
      const sessionData = await sessionRes.json();
      const statsData = await statsRes.json();

      if (sessionData.success && sessionData.data) {
        const rawData = Array.isArray(sessionData.data) ? sessionData.data : [];
        // Deduplicate by id (safety net — backend also deduplicates via v_active_sessions)
        const seen = new Set<string>();
        const deduped = rawData.filter((s: { id: string }) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        setSessions(deduped);
      } else {
        setSessions([]);
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Failed to fetch live sessions:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, nasFilter, statusFilter]);

  // ─── Auto-refresh every 10s ───────────────────────────────────────────────

  useEffect(() => {
    fetchSessions();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchSessions(), 10000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchSessions, autoRefresh]);

  // ─── Disconnect ────────────────────────────────────────────────────────────

  const confirmDisconnect = (session: LiveSession) => {
    setDisconnectTarget(session);
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    const session = disconnectTarget;
    setDisconnectingId(session.id);
    setDisconnectTarget(null);

    // Extract acctSessionId from LiveSession id (format: "ls_<acctSessionId>")
    const acctSessionId = session.id.startsWith('ls_') ? session.id.slice(3) : session.id;

    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'live-sessions-disconnect',
          acctSessionId,
          username: session.username,
          nasIp: session.nasIp,
          framedIpAddress: session.ipAddress,
        }),
      });
      const data = await res.json();
      console.log('[disconnect] response:', data);
      if (data.success) {
        if (data.coa) {
          // RADIUS CoA succeeded — session terminated on NAS
          toast({ title: 'Disconnected', description: `${session.username} terminated via RADIUS CoA` });
        } else if (data.local) {
          // CoA unavailable (no radclient / NAS unreachable) — ended locally
          toast({
            title: 'Disconnected',
            description: `${session.username} session closed successfully.`,
          });
        } else {
          toast({ title: 'Disconnected', description: `${session.username} session ended.` });
        }
        fetchSessions();
      } else {
        toast({
          title: 'Disconnect Failed',
          description: data.message || data.localMessage || 'Could not disconnect session.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect session', variant: 'destructive' });
    } finally {
      setDisconnectingId(null);
    }
  };

  // ─── Select / Deselect ─────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === uniqueSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uniqueSessions.map(s => s.id)));
    }
  };

  const isAllSelected = uniqueSessions.length > 0 && selectedIds.size === uniqueSessions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < uniqueSessions.length;

  // ─── Bulk Disconnect ────────────────────────────────────────────────────

  const handleBulkDisconnect = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDisconnecting(true);
    setBulkDisconnectTarget(false);

    const targets = uniqueSessions.filter(s => selectedIds.has(s.id));
    let successCount = 0;
    let failCount = 0;

    // Fire all disconnect requests in parallel
    const promises = targets.map(async (session) => {
      const acctSessionId = session.id.startsWith('ls_') ? session.id.slice(3) : session.id;
      try {
        const res = await fetch('/api/wifi/radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'live-sessions-disconnect',
            acctSessionId,
            username: session.username,
            nasIp: session.nasIp,
          }),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    });

    await Promise.allSettled(promises);
    setIsBulkDisconnecting(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      toast({
        title: 'Bulk Disconnect Complete',
        description: `${successCount} session${successCount !== 1 ? 's' : ''} disconnected successfully.`,
      });
    } else {
      toast({
        title: 'Bulk Disconnect Partial',
        description: `${successCount} succeeded, ${failCount} failed.`,
        variant: 'destructive',
      });
    }
    fetchSessions();
  };

  // ─── Live Session Time counter (for details dialog) ────────────────
  const [liveSessionTime, setLiveSessionTime] = useState(0);

  useEffect(() => {
    if (!selectedSession?.startedAt) {
      setLiveSessionTime(selectedSession?.sessionTime || 0);
      return;
    }
    // Calculate from startedAt (overrides stale acctsessiontime)
    const calc = () => Math.max(
      Math.floor((Date.now() - new Date(selectedSession.startedAt!).getTime()) / 1000),
      selectedSession.sessionTime || 0
    );
    setLiveSessionTime(calc());
    const interval = setInterval(() => setLiveSessionTime(calc()), 1000);
    return () => clearInterval(interval);
  }, [selectedSession?.id, selectedSession?.startedAt, selectedSession?.sessionTime]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Get effective session time — prefers acctsessiontime from RADIUS,
   * falls back to calculating from startedAt (useful when accounting updates aren't flowing).
   */
  const getSessionTime = (session: LiveSession): number => {
    if (session.sessionTime > 0) return session.sessionTime;
    if (session.startedAt) {
      return Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    }
    return 0;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  /** Format speed in Mbps — shows up to 1 decimal place, uses Kbps for < 0.1 Mbps */
  const formatSpeed = (mbps: number): string => {
    if (mbps <= 0) return '0';
    if (mbps < 0.1) {
      const kbps = Math.round(mbps * 1000);
      return kbps > 0 ? `${kbps} Kbps` : '0';
    }
    return `${mbps.toFixed(1)} Mbps`;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <CircleDot className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (status === 'idle') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
          <Clock className="h-3 w-3 mr-1" />
          Idle
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Disconnecting
      </Badge>
    );
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === 'mobile' || deviceType === 'phone') return <Smartphone className="h-4 w-4" />;
    if (deviceType === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getLoginTypeBadge = (loginType?: string) => {
    switch (loginType) {
      case 'pap':
        return (
          <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0 text-[10px] px-1.5 py-0">
            PAP
          </Badge>
        );
      case 'chap':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] px-1.5 py-0">
            CHAP
          </Badge>
        );
      case 'mschapv2':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px] px-1.5 py-0">
            MS-CHAPv2
          </Badge>
        );
      case 'eap-peap':
        return (
          <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0 text-[10px] px-1.5 py-0">
            EAP-PEAP
          </Badge>
        );
      case 'eap-ttls':
        return (
          <Badge className="bg-pink-500 hover:bg-pink-600 text-white border-0 text-[10px] px-1.5 py-0">
            EAP-TTLS
          </Badge>
        );
      case 'eap-tls':
        return (
          <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0 text-[10px] px-1.5 py-0">
            EAP-TLS
          </Badge>
        );
      case 'eap-md5':
        return (
          <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-0 text-[10px] px-1.5 py-0">
            EAP-MD5
          </Badge>
        );
      case 'eap':
        return (
          <Badge className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white border-0 text-[10px] px-1.5 py-0">
            EAP
          </Badge>
        );
      case 'mac-auth':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-[10px] px-1.5 py-0">
            MAC-Auth
          </Badge>
        );
      case 'voucher':
        return (
          <Badge className="bg-teal-500 hover:bg-teal-600 text-white border-0 text-[10px] px-1.5 py-0">
            Voucher
          </Badge>
        );
      case 'auto_reauth':
        return (
          <Badge className="bg-violet-500 hover:bg-violet-600 text-white border-0 text-[10px] px-1.5 py-0">
            <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
            Auto ReAuth
          </Badge>
        );
      case 'portal':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 text-[10px] px-1.5 py-0">
            <Wifi className="h-2.5 w-2.5 mr-0.5" />
            Portal
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {loginType || 'Unknown'}
          </Badge>
        );
    }
  };

  /** Auth protocol badge — shows the RADIUS auth protocol (PAP, CHAP, MS-CHAPv2, etc.) */
  const getAuthProtocolBadge = (authProtocol?: string) => {
    switch (authProtocol) {
      case 'pap':
        return (
          <Badge className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-400 border border-sky-500/20 text-[9px] px-1 py-0 leading-tight">
            PAP
          </Badge>
        );
      case 'chap':
        return (
          <Badge className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[9px] px-1 py-0 leading-tight">
            CHAP
          </Badge>
        );
      case 'ms-chap-v2':
      case 'mschapv2':
      case 'ms-chapv2':
        return (
          <Badge className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[9px] px-1 py-0 leading-tight">
            MS-CHAPv2
          </Badge>
        );
      case 'eap-peap':
        return (
          <Badge className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-400 border border-purple-500/20 text-[9px] px-1 py-0 leading-tight">
            EAP-PEAP
          </Badge>
        );
      case 'eap-ttls':
        return (
          <Badge className="bg-pink-500/15 hover:bg-pink-500/25 text-pink-700 dark:text-pink-400 border border-pink-500/20 text-[9px] px-1 py-0 leading-tight">
            EAP-TTLS
          </Badge>
        );
      case 'eap-tls':
        return (
          <Badge className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[9px] px-1 py-0 leading-tight">
            EAP-TLS
          </Badge>
        );
      case 'eap-md5':
        return (
          <Badge className="bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-[9px] px-1 py-0 leading-tight">
            EAP-MD5
          </Badge>
        );
      case 'eap':
        return (
          <Badge className="bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-500/20 text-[9px] px-1 py-0 leading-tight">
            EAP
          </Badge>
        );
      default:
        return null;
    }
  };

  /** Combined login + auth protocol display — shows login type badge with auth protocol below */
  const getLoginWithAuthBadge = (loginType?: string, authProtocol?: string) => {
    const loginBadge = getLoginTypeBadge(loginType);
    const protocolBadge = getAuthProtocolBadge(authProtocol);
    if (!protocolBadge) return loginBadge;
    return (
      <div className="flex flex-col items-start gap-0.5">
        {loginBadge}
        {protocolBadge}
      </div>
    );
  };

  // Unique NAS list for filter
  const nasList = Array.from(new Set(uniqueSessions.map(s => s.nasIp).filter(Boolean)));

  // ─── Mobile Card for each session ─────────────────────────────────────────

  const SessionCard = ({ session }: { session: LiveSession }) => (
    <Card className={cn(
      'border',
      selectedIds.has(session.id) && 'border-primary ring-2 ring-primary/20',
      session.status === 'active' && !selectedIds.has(session.id) && 'border-primary/30 dark:border-primary/30',
      session.status === 'idle' && !selectedIds.has(session.id) && 'border-amber-200 dark:border-amber-800'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Row 0: Select checkbox + Login Type badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {getStatusBadge(session.status)}
            {getLoginWithAuthBadge(session.loginType, session.authProtocol)}
          </div>
          <Checkbox
            checked={selectedIds.has(session.id)}
            onCheckedChange={() => toggleSelect(session.id)}
            aria-label={`Select ${session.username}`}
          />
        </div>
        {/* Row 1: User info */}
        <div className="flex items-start gap-2">
          <UserCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{session.username}</p>
            <p className="font-mono text-xs text-muted-foreground">{session.ipAddress || '—'}</p>
            {session.guestName && (
              <p className="text-xs text-muted-foreground mt-0.5">{session.guestName}{session.roomId ? ` · Room ${session.roomId}` : ''}</p>
            )}
          </div>
        </div>

        {/* Row 2: Key info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">MAC</p>
            <p className="font-mono truncate">{session.macAddress || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Device</p>
            <div className="flex items-center gap-1">
              {getDeviceIcon(session.deviceType)}
              <span className="truncate">{session.deviceName || session.deviceType || '—'}</span>
            </div>
          </div>
          {session.nasPortType && (
            <div>
              <p className="text-muted-foreground mb-0.5">Port</p>
              <p className="truncate">{session.nasPortType}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground mb-0.5">Session</p>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(getSessionTime(session))}
            </p>
          </div>
        </div>

        {/* Row 2b: OS / Browser info (when available) */}
        {(session.operatingSystem || session.browser) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {session.operatingSystem && <span>{session.operatingSystem}</span>}
            {session.operatingSystem && session.browser && <span>·</span>}
            {session.browser && <span>{session.browser}</span>}
            {session.authCount ? (
              <>
                <span>·</span>
                <span className="text-violet-600 dark:text-violet-400">{session.authCount}x auth</span>
              </>
            ) : null}
          </div>
        )}

        {/* Row 3: Bandwidth + Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1">Bandwidth</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-primary">
                <ArrowDownToLine className="h-3 w-3" />
                {session.bandwidthDown || '—'}
                {session.bandwidthBurstDown && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">→ {session.bandwidthBurstDown}</span>
                )}
              </span>
              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <ArrowUpFromLine className="h-3 w-3" />
                {session.bandwidthUp || '—'}
                {session.bandwidthBurstUp && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">→ {session.bandwidthBurstUp}</span>
                )}
              </span>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1">Data Usage</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <ArrowDownToLine className="h-3 w-3 text-primary" />
                {formatBytes(session.dataDownload || 0)}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                {formatBytes(session.dataUpload || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Speed */}
        {(session.avgSpeedDown || session.liveSpeedDown) ? (
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Speed</p>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-0.5">
                <ArrowDownToLine className="h-3 w-3 text-primary" />
                {formatSpeed(session.liveSpeedDown ?? session.avgSpeedDown ?? 0)}
              </div>
              <div className="flex items-center gap-0.5">
                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                {formatSpeed(session.liveSpeedUp ?? session.avgSpeedUp ?? 0)}
              </div>
            </div>
          </div>
        ) : null}

        {/* Row 4: NAS info */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Router className="h-3 w-3" />
          <span>{session.nasIdentifier || session.nasIp}</span>
        </div>

        {/* Row 5: Action buttons */}
        <div className="flex gap-2 pt-1 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => setSelectedSession(session)}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Details
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => confirmDisconnect(session)}
            disabled={disconnectingId === session.id || isBulkDisconnecting}
          >
            {disconnectingId === session.id ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Disconnecting...</>
            ) : (
              <><Unplug className="h-3.5 w-3.5 mr-1.5" />Disconnect</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Active Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time active session monitoring with CoA disconnect
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDisconnectTarget(true)}
              disabled={isBulkDisconnecting}
            >
              {isBulkDisconnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disconnecting {selectedIds.size}...</>
              ) : (
                <><Unplug className="h-4 w-4 mr-2" />Disconnect {selectedIds.size} Selected</>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CircleDot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {stats.totalActive}
              </div>
              <div className="text-xs text-muted-foreground">Total Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.peakToday}
              </div>
              <div className="text-xs text-muted-foreground">Peak Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <ArrowDownToLine className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.totalDownload)}</div>
              <div className="text-xs text-muted-foreground">Total Download</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <ArrowUpFromLine className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.totalUpload)}</div>
              <div className="text-xs text-muted-foreground">Total Upload</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Per-NAS Breakdown — compact inline */}
      {stats.perNas && stats.perNas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="flex items-center gap-1 text-muted-foreground font-medium shrink-0">
            <Router className="h-3.5 w-3.5" />
            NAS
          </span>
          <span className="text-border">|</span>
          {stats.perNas.map((nas, idx) => (
            <Badge key={`${nas.nasIp}_${idx}`} variant="outline" className="text-xs gap-1 py-0 px-2 h-6">
              {nas.nasIdentifier || nas.nasIp}: <span className="font-semibold">{nas.count}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search User / IP / MAC / Device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm bg-background"
          />
        </div>
        <Select value={nasFilter} onValueChange={setNasFilter}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-sm bg-background">
            <SelectValue placeholder="All NAS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All NAS</SelectItem>
            {nasList.map(nas => (
              <SelectItem key={nas} value={nas}>{nas}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32 h-8 text-sm bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Auto (10s)</span>
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : uniqueSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="rounded-full bg-muted/50 p-4 mb-3">
            <Wifi className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">No active sessions</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Sessions will appear when users authenticate and go online
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="space-y-3 sm:hidden">
            {/* Mobile select all bar */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) (el as unknown as HTMLInputElement).indeterminate = isSomeSelected;
                  }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all sessions"
                />
                <span className="text-muted-foreground">Select All ({uniqueSessions.length})</span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              )}
            </div>
            {uniqueSessions.map((session, idx) => (
              <SessionCard key={`${session.id}_${idx}`} session={session} />
            ))}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) (el as unknown as HTMLInputElement).indeterminate = isSomeSelected;
                            }}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all sessions"
                          />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>User / IP</TableHead>
                        <TableHead>MAC</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead className="hidden lg:table-cell">Port Type</TableHead>
                        <TableHead>BW Down / Up</TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Time
                            <SessionTermsInfoButton />
                          </div>
                        </TableHead>
                        <TableHead>Data Down / Up</TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Speed
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniqueSessions.map((session, idx) => (
                        <TableRow key={`${session.id}_${idx}`} className={cn(
                          selectedIds.has(session.id) && 'bg-primary/5',
                          session.status === 'active' && !selectedIds.has(session.id) && 'bg-primary/5 dark:bg-primary/10',
                          session.status === 'idle' && !selectedIds.has(session.id) && 'bg-amber-50/30 dark:bg-amber-950/10'
                        )}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(session.id)}
                              onCheckedChange={() => toggleSelect(session.id)}
                              aria-label={`Select ${session.username}`}
                            />
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell>{getLoginWithAuthBadge(session.loginType, session.authProtocol)}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="font-medium text-sm truncate max-w-[120px]" title={session.username}>
                                  {session.username}
                                </p>
                              </div>
                              <p className="font-mono text-xs text-muted-foreground pl-5">
                                {session.ipAddress || '—'}
                              </p>
                              {session.guestName && (
                                <p className="text-[10px] text-muted-foreground pl-5">
                                  {session.guestName}{session.roomId ? ` · Room ${session.roomId}` : ''}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs text-muted-foreground">{session.macAddress || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {getDeviceIcon(session.deviceType)}
                                <span className="truncate max-w-[80px]">{session.deviceName || session.deviceType || '—'}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground pl-5">
                                {session.operatingSystem || ''}{session.browser ? ` · ${session.browser}` : ''}
                              </div>
                              {session.authCount ? (
                                <p className="text-[10px] text-violet-600 dark:text-violet-400 pl-5">{session.authCount}x auth</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell"><p className="text-xs text-muted-foreground">{session.nasPortType || '—'}</p></TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <ArrowDownToLine className="h-3 w-3 text-primary" />
                                <span>{session.bandwidthDown || '—'}</span>
                                {session.bandwidthBurstDown && (
                                  <span className="text-[10px] text-muted-foreground ml-0.5">→ {session.bandwidthBurstDown}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                <span>{session.bandwidthUp || '—'}</span>
                                {session.bandwidthBurstUp && (
                                  <span className="text-[10px] text-muted-foreground ml-0.5">→ {session.bandwidthBurstUp}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDuration(getSessionTime(session))}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <ArrowDownToLine className="h-3 w-3 text-primary" />
                                <span>{formatBytes(session.dataDownload || 0)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                <span>{formatBytes(session.dataUpload || 0)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5 tabular-nums">
                              <div className="flex items-center gap-1">
                                <ArrowDownToLine className="h-3 w-3 text-primary" />
                                <span>{formatSpeed(session.liveSpeedDown ?? session.avgSpeedDown ?? 0)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                <span>{formatSpeed(session.liveSpeedUp ?? session.avgSpeedUp ?? 0)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => setSelectedSession(session)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Details</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => confirmDisconnect(session)}
                                disabled={disconnectingId === session.id}
                              >
                                {disconnectingId === session.id ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /></>
                                ) : (
                                  <><Unplug className="h-3.5 w-3.5" /><span className="hidden lg:inline">Disconnect</span></>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>Detailed information for user session</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="grid gap-4 py-4 overflow-auto flex-1 -mx-6 px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium">{selectedSession.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {getStatusBadge(selectedSession.status)}
                    {getLoginTypeBadge(selectedSession.loginType)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedSession.ipAddress || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MAC Address</p>
                  <p className="text-sm font-mono">{selectedSession.macAddress || '—'}</p>
                </div>
              </div>
              {/* Guest info */}
              {(selectedSession.guestName || selectedSession.roomId || selectedSession.propertyName) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedSession.guestName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Guest</p>
                      <p className="text-sm">{selectedSession.guestName}</p>
                    </div>
                  )}
                  {selectedSession.roomId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Room</p>
                      <p className="text-sm">{selectedSession.roomId}</p>
                    </div>
                  )}
                  {selectedSession.propertyName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="text-sm truncate">{selectedSession.propertyName}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Device info from DeviceProfile */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Device & Browser</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Device</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getDeviceIcon(selectedSession.deviceType)}
                      <span className="text-sm">{selectedSession.deviceName || selectedSession.deviceType || 'Unknown'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">OS</p>
                    <p className="text-sm">{selectedSession.operatingSystem || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Browser</p>
                    <p className="text-sm">{selectedSession.browser || 'Unknown'}</p>
                  </div>
                </div>
                {selectedSession.userAgent && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 font-mono break-all" title={selectedSession.userAgent}>
                    UA: {selectedSession.userAgent.length > 100 ? selectedSession.userAgent.slice(0, 100) + '…' : selectedSession.userAgent}
                  </p>
                )}
                {selectedSession.authCount ? (
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Total authentications: {selectedSession.authCount}</p>
                ) : null}
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Bandwidth & Plan</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Download</p>
                    <p className="text-sm">{selectedSession.bandwidthDown || '—'}</p>
                    {selectedSession.bandwidthBurstDown && (
                      <p className="text-xs text-muted-foreground">Burst → {selectedSession.bandwidthBurstDown}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Upload</p>
                    <p className="text-sm">{selectedSession.bandwidthUp || '—'}</p>
                    {selectedSession.bandwidthBurstUp && (
                      <p className="text-xs text-muted-foreground">Burst → {selectedSession.bandwidthBurstUp}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="text-sm">{selectedSession.planName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Room</p>
                    <p className="text-sm">{selectedSession.roomId || '—'}</p>
                  </div>
                </div>
              </div>
              {/* Session Terms Info Popover */}
              <SessionTermsInfoPopover />
              <div className="border-t pt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Session Info</p>
                  <SessionTermsInfoButton />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Session Time</p>
                    <p className="text-sm font-medium tabular-nums">{formatDuration(liveSessionTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data Usage</p>
                    <p className="text-sm">
                      {formatBytes((selectedSession.dataDownload || 0) + (selectedSession.dataUpload || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Session Timeout</p>
                    <p className="text-sm">{selectedSession.sessionTimeout ? formatDuration(selectedSession.sessionTimeout) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Idle Timeout</p>
                    <p className="text-sm">{selectedSession.idleTimeout ? formatDuration(selectedSession.idleTimeout) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg ↓ Speed</p>
                    <p className="text-sm font-medium tabular-nums">{formatSpeed(selectedSession.avgSpeedDown ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg ↑ Speed</p>
                    <p className="text-sm font-medium tabular-nums">{formatSpeed(selectedSession.avgSpeedUp ?? 0)}</p>
                  </div>
                  {selectedSession.startedAt && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Started</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedSession.startedAt).toLocaleString()} ({formatDistanceToNow(selectedSession.startedAt)} ago)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Disconnect Confirmation Dialog */}
      <Dialog open={bulkDisconnectTarget} onOpenChange={(open) => { if (!open) setBulkDisconnectTarget(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-destructive" />
              Bulk Force Disconnect
            </DialogTitle>
            <DialogDescription>
              Disconnect all selected sessions immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-sm font-medium">{selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''} selected</p>
              <div className="mt-2 max-h-32 overflow-auto space-y-1">
                {uniqueSessions.filter(s => selectedIds.has(s.id)).map((s, idx) => (
                  <div key={`${s.id}_${idx}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.username}</span>
                    <span className="ml-auto font-mono shrink-0">{s.ipAddress || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                All selected users will lose internet access immediately. This sends RADIUS Disconnect Messages for each session.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDisconnectTarget(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDisconnect} disabled={isBulkDisconnecting || selectedIds.size === 0}>
              {isBulkDisconnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disconnecting {selectedIds.size}...</>
              ) : (
                <><Unplug className="h-4 w-4 mr-2" />Disconnect {selectedIds.size} Session{selectedIds.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-destructive" />
              Force Disconnect
            </DialogTitle>
            <DialogDescription>
              This will send a RADIUS Disconnect Message to terminate the user session immediately.
            </DialogDescription>
          </DialogHeader>
          {disconnectTarget && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{disconnectTarget.username}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {disconnectTarget.ipAddress || '—'} · {disconnectTarget.macAddress || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  The user will lose internet access immediately. This action sends a real RADIUS Disconnect Message to the NAS device.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={!!disconnectingId}>
              {disconnectingId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disconnecting...</>
              ) : (
                <><Unplug className="h-4 w-4 mr-2" />Disconnect Now</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

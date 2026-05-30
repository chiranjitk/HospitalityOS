'use client';

/**
 * WiFi Real-Time Activity Feed
 *
 * Live-updating activity feed showing recent WiFi events:
 * - Session starts, disconnects, auth failures, bandwidth warnings
 * - Polls every 15 seconds for latest events
 * - Timeline with icons and relative timestamps
 * - Collapsible with auto-scroll to latest
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Wifi,
  WifiOff,
  ShieldAlert,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Server,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActivityEventType =
  | 'session_start'
  | 'session_end'
  | 'disconnect'
  | 'auth_failure'
  | 'bandwidth_warning'
  | 'nas_offline';

interface ActivityEvent {
  type: ActivityEventType;
  timestamp: string;
  username: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  nasIpAddress: string | null;
  deviceName: string | null;
  details: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 5000) return 'just now';
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} min ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

function getEventIcon(type: ActivityEventType) {
  switch (type) {
    case 'session_start':
      return <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
    case 'session_end':
    case 'disconnect':
      return <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
    case 'auth_failure':
      return <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    case 'bandwidth_warning':
      return <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
    case 'nas_offline':
      return <Server className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    default:
      return <Wifi className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getEventBgColor(type: ActivityEventType) {
  switch (type) {
    case 'session_start':
      return 'bg-emerald-500/10 border-emerald-500/20';
    case 'session_end':
    case 'disconnect':
      return 'bg-amber-500/10 border-amber-500/20';
    case 'auth_failure':
    case 'nas_offline':
      return 'bg-red-500/10 border-red-500/20';
    case 'bandwidth_warning':
      return 'bg-amber-500/10 border-amber-500/20';
    default:
      return 'bg-muted/50 border-border/50';
  }
}

function getEventLabel(type: ActivityEventType) {
  switch (type) {
    case 'session_start':
      return 'Connected';
    case 'session_end':
      return 'Session Ended';
    case 'disconnect':
      return 'Disconnected';
    case 'auth_failure':
      return 'Auth Failed';
    case 'bandwidth_warning':
      return 'High Latency';
    case 'nas_offline':
      return 'NAS Offline';
    default:
      return 'Event';
  }
}

function getEventBadgeVariant(type: ActivityEventType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'session_start':
      return 'secondary';
    case 'auth_failure':
    case 'nas_offline':
      return 'destructive';
    default:
      return 'outline';
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WifiActivityFeed() {
  const [isOpen, setIsOpen] = useState(true);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const fetchEvents = useCallback(async (since?: string) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (since) params.set('since', since);

      const res = await fetch(`/api/wifi/activity-feed?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        const newEvents: ActivityEvent[] = data.data.map((e: Record<string, unknown>) => ({
          type: e.type as ActivityEventType,
          timestamp: e.timestamp as string,
          username: (e.username as string) || null,
          macAddress: (e.macAddress as string) || null,
          ipAddress: (e.ipAddress as string) || null,
          nasIpAddress: (e.nasIpAddress as string) || null,
          deviceName: (e.deviceName as string) || null,
          details: (e.details as string) || '',
        }));

        setEvents(prev => {
          // If we have existing events and got new ones, merge and deduplicate
          if (prev.length > 0 && since) {
            const existingIds = new Set(prev.map(p => `${p.type}-${p.timestamp}`));
            const unique = newEvents.filter(n => !existingIds.has(`${n.type}-${n.timestamp}`));
            return [...unique, ...prev].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ).slice(0, 50);
          }
          return newEvents;
        });

        setLastFetch(new Date().toISOString());
      }
    } catch {
      // non-critical, keep existing data
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Fetch fresh (no since param) to get all events
    fetchEvents();
  }, [fetchEvents]);

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => {
      if (lastFetch) {
        fetchEvents(lastFetch);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchEvents, lastFetch]);

  // Auto-scroll to top (newest) when new events arrive and user hasn't scrolled
  useEffect(() => {
    if (isOpen && shouldAutoScroll.current && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events.length, isOpen]);

  const handleScroll = () => {
    if (feedRef.current) {
      // If user is near the top, auto-scroll next time
      shouldAutoScroll.current = feedRef.current.scrollTop < 50;
    }
  };

  // Group events by time buckets for visual separation
  const grouped = events.reduce<Array<{ label: string; events: ActivityEvent[] }>>((acc, event) => {
    const date = new Date(event.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    let bucket: string;
    if (diffMin < 5) bucket = 'Just now';
    else if (diffMin < 15) bucket = 'Last 15 min';
    else if (diffMin < 60) bucket = 'Last hour';
    else if (diffMin < 1440) bucket = 'Today';
    else bucket = 'Earlier';

    const existing = acc.find(g => g.label === bucket);
    if (existing) {
      existing.events.push(event);
    } else {
      acc.push({ label: bucket, events: [event] });
    }
    return acc;
  }, []);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  aria-label={isOpen ? 'Collapse activity feed' : 'Expand activity feed'}
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ActivityIcon />
                Activity Feed
                {!isLoading && events.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium">
                    {events.length}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {lastFetch && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Updated {relativeTime(lastFetch)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="Refresh activity feed"
              >
                <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 bg-muted/50 rounded-lg" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Wifi className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">No recent activity</p>
                <p className="text-[10px] mt-1">Events will appear here as they happen</p>
              </div>
            ) : (
              <div
                ref={feedRef}
                onScroll={handleScroll}
                className="max-h-96 overflow-y-auto space-y-1 scrollbar-thin"
              >
                {grouped.map(group => (
                  <div key={group.label}>
                    {/* Time bucket header */}
                    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
                        {group.label}
                      </span>
                    </div>
                    {/* Events in this bucket */}
                    <div className="space-y-1">
                      {group.events.map((event, idx) => (
                        <ActivityEventRow key={`${event.type}-${event.timestamp}-${idx}`} event={event} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ActivityIcon() {
  return (
    <div className="relative">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Wifi className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    </div>
  );
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
  const [time, setTime] = useState(relativeTime(event.timestamp));

  // Update relative time every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(relativeTime(event.timestamp));
    }, 30000);
    return () => clearInterval(interval);
  }, [event.timestamp]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg border transition-colors hover:bg-muted/30',
        getEventBgColor(event.type)
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-background/80">
        {getEventIcon(event.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <Badge variant={getEventBadgeVariant(event.type)} className="text-[9px] px-1.5 py-0 h-4 font-medium shrink-0">
            {getEventLabel(event.type)}
          </Badge>
          {event.username && (
            <span className="text-xs font-medium truncate">{event.username}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{event.details}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
          {event.macAddress && (
            <span className="font-mono">{event.macAddress}</span>
          )}
          {event.ipAddress && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono">{event.ipAddress}</span>
            </>
          )}
          {event.nasIpAddress && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono">{event.nasIpAddress}</span>
            </>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
        <Clock className="h-2.5 w-2.5" />
        <span>{time}</span>
      </div>
    </div>
  );
}

export default WifiActivityFeed;

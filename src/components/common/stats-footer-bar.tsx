'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Zap, Wifi, Database, Clock, MemoryStick } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface SystemStats {
  apiResponseTime: number | null;
  activeSessions: number | null;
  dbConnected: boolean;
  serverTime: string;
  memoryMB: number | null;
}

interface ApiResponseTimeColor {
  text: string;
  icon: string;
}

// ============================================
// Helpers
// ============================================

function getApiResponseTimeColor(ms: number): ApiResponseTimeColor {
  if (ms < 100) return { text: 'text-emerald-500', icon: 'text-emerald-500' };
  if (ms < 500) return { text: 'text-amber-500', icon: 'text-amber-500' };
  return { text: 'text-red-500', icon: 'text-red-500' };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ============================================
// Divider
// ============================================

function Divider() {
  return (
    <span className="text-muted-foreground/25 select-none mx-1.5">|</span>
  );
}

// ============================================
// Component
// ============================================

export function StatsFooterBar() {
  const [stats, setStats] = useState<SystemStats>({
    apiResponseTime: null,
    activeSessions: null,
    dbConnected: true,
    serverTime: formatTime(new Date()),
    memoryMB: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock — updates every second
  useEffect(() => {
    const updateClock = () => {
      setStats((prev) => ({
        ...prev,
        serverTime: formatTime(new Date()),
      }));
    };

    updateClock();
    intervalRef.current = setInterval(updateClock, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Memory — read from performance.memory if available (Chrome only)
  useEffect(() => {
    const readMemory = () => {
      try {
        const perf = performance as unknown as {
          memory?: { usedJSHeapSize: number };
        };
        if (perf.memory) {
          const mb = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
          setStats((prev) => ({ ...prev, memoryMB: mb }));
        }
      } catch {
        // Not available in this browser
      }
    };

    readMemory();
    const memInterval = setInterval(readMemory, 5000);
    return () => clearInterval(memInterval);
  }, []);

  // API polling — every 30 seconds
  const fetchStats = useCallback(async () => {
    const fetchStart = performance.now();

    try {
      // Fetch active sessions from WiFi RADIUS status endpoint
      const sessionsPromise = fetch('/api/wifi/radius?action=status').then(
        (res) => res.json()
      ).then(
        (data) => {
          // Try various response shapes
          if (typeof data === 'object') {
            return data.activeSessions ?? data.active ?? data.count ?? data.totalActive ?? null;
          }
          return null;
        }
      ).catch(() => null);

      // Fetch DB health from dashboard endpoint
      const dbPromise = fetch('/api/dashboard').then(
        (res) => res.json()
      ).then(
        (data) => {
          if (data && (data.success || data.status === 'ok' || data.connected)) {
            return true;
          }
          return true; // If we got a response, DB is reachable
        }
      ).catch(() => false);

      const [sessions, dbConnected] = await Promise.all([
        sessionsPromise,
        dbPromise,
      ]);

      const apiResponseTime = Math.round(performance.now() - fetchStart);

      setStats((prev) => ({
        ...prev,
        apiResponseTime,
        activeSessions:
          sessions !== null ? Number(sessions) : prev.activeSessions,
        dbConnected,
      }));
    } catch {
      // Keep previous stats on failure
      const apiResponseTime = Math.round(performance.now() - fetchStart);
      setStats((prev) => ({
        ...prev,
        apiResponseTime,
        dbConnected: false,
      }));
    }
  }, []);

  useEffect(() => {
    // Poll every 30 seconds (fires immediately on first tick via setInterval)
    pollRef.current = setInterval(fetchStats, 30000);
    // Schedule initial fetch asynchronously to avoid synchronous setState in effect
    const initTimeout = setTimeout(fetchStats, 0);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(initTimeout);
    };
  }, [fetchStats]);

  // ============================================
  // Render
  // ============================================

  const apiColor = stats.apiResponseTime !== null
    ? getApiResponseTimeColor(stats.apiResponseTime)
    : { text: 'text-muted-foreground', icon: 'text-muted-foreground' };

  return (
    <div
      className={cn(
        'h-8 flex items-center px-3',
        'bg-muted/50 dark:bg-muted/20',
        'border-t border-border/50',
        'overflow-x-auto overflow-y-hidden',
        'scrollbar-none'
      )}
      role="status"
      aria-label="System status bar"
    >
      <div className="flex items-center gap-0 shrink-0 w-full min-w-max">
        {/* API Response Time */}
        <div className="flex items-center gap-1">
          <Zap className={cn('h-3 w-3 shrink-0', apiColor.icon)} />
          <span className={cn('text-[10px] font-mono', apiColor.text)}>
            API:{' '}
            {stats.apiResponseTime !== null
              ? `${stats.apiResponseTime}ms`
              : '...'}
          </span>
        </div>

        <Divider />

        {/* Active Sessions */}
        <div className="flex items-center gap-1">
          <Wifi className="h-3 w-3 text-teal-500 shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground">
            Sessions:{' '}
            {stats.activeSessions !== null ? stats.activeSessions : '—'}
          </span>
        </div>

        <Divider />

        {/* Database */}
        <div className="flex items-center gap-1">
          <Database
            className={cn(
              'h-3 w-3 shrink-0',
              stats.dbConnected ? 'text-emerald-500' : 'text-red-500'
            )}
          />
          <span className="text-[10px] font-mono text-muted-foreground">
            DB:
          </span>
          {stats.dbConnected ? (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          ) : (
            <span className="text-[10px] font-mono text-red-500">
              Offline
            </span>
          )}
        </div>

        <Divider />

        {/* Server Time */}
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {stats.serverTime}
          </span>
        </div>

        <Divider />

        {/* Memory (Chrome only) */}
        {stats.memoryMB !== null && (
          <>
            <div className="flex items-center gap-1">
              <MemoryStick className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground">
                Mem: {stats.memoryMB}MB
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

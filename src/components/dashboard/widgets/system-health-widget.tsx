'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Activity, Database, Wifi, Globe, Radio } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

interface ServiceInfo {
  name: string;
  port: number;
  type: string;
  status: 'healthy' | 'degraded' | 'down' | 'error';
  responseTime: string;
}

interface SystemHealthResponse {
  services: ServiceInfo[];
  timestamp: string;
}

// ─── Config ─────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ElementType> = {
  PostgreSQL: Database,
  FreeRADIUS: Radio,
  'Next.js': Globe,
  Realtime: Wifi,
};

const SERVICE_GRADIENTS: Record<string, string> = {
  database: 'from-emerald-400 to-teal-500',
  auth: 'from-amber-400 to-orange-500',
  web: 'from-violet-400 to-purple-500',
  websocket: 'from-rose-400 to-pink-500',
};

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  healthy: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Healthy',
  },
  degraded: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Degraded',
  },
  down: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    label: 'Down',
  },
  error: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    label: 'Error',
  },
};

// ─── Status Dot ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.down;
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
          config.dot
        )}
      />
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          config.dot
        )}
      />
    </span>
  );
}

// ─── Service Row ────────────────────────────────────────────────────────

function ServiceRow({ service, index }: { service: ServiceInfo; index: number }) {
  const Icon = SERVICE_ICONS[service.name] || Activity;
  const gradient = SERVICE_GRADIENTS[service.type] || 'from-gray-400 to-gray-500';
  const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.down;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02] cursor-default',
        'bg-card border-border/60'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
          gradient
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{service.name}</p>
          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
            :{service.port}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
              statusConfig.bg,
              statusConfig.text
            )}
          >
            {statusConfig.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {service.responseTime}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <StatusDot status={service.status} />
    </motion.div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

function SystemHealthLoadingSkeleton() {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function SystemHealthStatusWidget() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('--:--:--');

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/system-health');
        if (cancelled) return;
        if (!res.ok) throw new Error('Failed to fetch system health');
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setLastChecked(new Date().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }));
        setIsError(false);
      } catch {
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (isLoading) {
    return <SystemHealthLoadingSkeleton />;
  }

  if (isError || !data) {
    return (
      <Card className="border border-red-200 dark:border-red-800 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-red-400 to-red-500" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
            <Activity className="h-4 w-4" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Unable to check service status.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            Try Again
          </button>
        </CardContent>
      </Card>
    );
  }

  const healthyCount = data.services.filter((s) => s.status === 'healthy').length;
  const totalServices = data.services.length;
  const overallStatus = healthyCount === totalServices ? 'healthy' : healthyCount >= totalServices / 2 ? 'degraded' : 'error';
  const overallConfig = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.down;

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold rounded-full border',
                overallConfig.bg,
                overallConfig.text,
                overallStatus === 'healthy' ? 'border-emerald-200 dark:border-emerald-800' :
                overallStatus === 'degraded' ? 'border-amber-200 dark:border-amber-800' :
                'border-red-200 dark:border-red-800'
              )}
            >
              <StatusDot status={overallStatus} />
              <span className="ml-1">{healthyCount}/{totalServices} OK</span>
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-muted-foreground/50">Last checked: {lastChecked}</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-muted-foreground/50">Auto-refresh: 30s</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {data.services.map((service, index) => (
            <ServiceRow key={service.name} service={service} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemHealthStatusWidget;

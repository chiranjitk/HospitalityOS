'use client';

/**
 * Network Health Dashboard
 *
 * Comprehensive network health overview with:
 * - Overall health score (0-100) as large animated gauge
 * - Individual health scores for RADIUS, DNS, DHCP, Captive Portal, Firewall
 * - Each sub-score shown as a small card with icon and status
 * - Uptime tracking and response time monitoring
 * - Active health alerts panel
 * - Auto-refresh every 30 seconds
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Globe,
  HardDrive,
  Shield,
  Wifi,
  RefreshCw,
  Zap,
  TrendingUp,
  Info,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  score: number;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime: number;
  lastCheck: string;
  details: string;
}

interface HealthAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: string;
}

interface NetworkHealthData {
  overallScore: number;
  services: ServiceHealth[];
  alerts: HealthAlert[];
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-800';
  if (score >= 60) return 'bg-amber-500/10 border-amber-200 dark:border-amber-800';
  return 'bg-red-500/10 border-red-200 dark:border-red-800';
}

function statusBadge(status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'healthy': return { label: 'Healthy', variant: 'default' };
    case 'degraded': return { label: 'Degraded', variant: 'secondary' };
    case 'down': return { label: 'Down', variant: 'destructive' };
    default: return { label: 'Unknown', variant: 'outline' };
  }
}

function serviceIcon(name: string) {
  switch (name) {
    case 'RADIUS Server': return Server;
    case 'DNS Server': return Globe;
    case 'DHCP Server': return HardDrive;
    case 'Captive Portal': return Wifi;
    case 'Firewall': return Shield;
    default: return Activity;
  }
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'info': return <Info className="h-4 w-4 text-primary" />;
    default: return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function severityBg(severity: string) {
  switch (severity) {
    case 'critical': return 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800';
    case 'warning': return 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800';
    case 'info': return 'border-primary/20 bg-primary/5 dark:bg-primary/5';
    default: return '';
  }
}

// ─── Large Animated Gauge (Semicircle) ────────────────────────────────────────

function HealthGauge({ score, animated }: { score: number; animated: boolean }) {
  const strokeWidth = 12;
  const size = 180;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2 + radius / 2 + 8;
  const displayScore = animated ? score : 0;

  const clampedScore = Math.max(0, Math.min(100, displayScore));
  const angle = Math.PI * (1 - clampedScore / 100);

  const startX = centerX - radius;
  const startY = centerY;
  const endX = centerX - radius * Math.cos(angle);
  const endY = centerY - radius * Math.sin(angle);
  const largeArc = clampedScore > 50 ? 1 : 0;

  const bgPath = `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${centerX + radius} ${startY}`;
  const valuePath = clampedScore > 0
    ? `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`
    : '';

  const color = clampedScore >= 80 ? '#10b981' : clampedScore >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 16}
        viewBox={`0 0 ${size} ${size / 2 + 16}`}
      >
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-muted/20"
        />
        {/* Score arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'all 1.5s ease-in-out' }}
          />
        )}
        {/* Score text */}
        <text
          x={centerX}
          y={centerY - 2}
          textAnchor="middle"
          className={cn('font-bold', scoreColor(score))}
          style={{ fontSize: size * 0.2, fill: 'currentColor' }}
        >
          {animated ? score : 0}
        </text>
      </svg>
      <span className={cn('text-lg font-bold -mt-2', scoreColor(score))}>
        {animated ? (score >= 80 ? 'Excellent' : score >= 60 ? 'Fair' : 'Poor') : '—'}
      </span>
    </div>
  );
}

// ─── Mini Gauge for Service Cards ──────────────────────────────────────────────

function MiniGauge({ score }: { score: number }) {
  const size = 36;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-muted/20"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
      />
    </svg>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center py-8">
        <Skeleton className="h-40 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function NetworkHealthDashboard() {
  const [data, setData] = useState<NetworkHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/network-health');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setError(null);
        // Trigger animation after data loads
        setTimeout(() => setAnimated(true), 100);
      } else {
        setError(result.error?.message || 'Failed to fetch health data');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to load health data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={fetchHealth}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Network Health</span>
          <Badge variant="outline" className="text-xs">
            Updated {new Date(data.timestamp).toLocaleTimeString()}
          </Badge>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          onClick={fetchHealth}
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Overall Health Gauge */}
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <HealthGauge score={data.overallScore} animated={animated} />

          {/* Quick Stats Row */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span>{data.services.filter(s => s.status === 'healthy').length} healthy</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{data.services.filter(s => s.status === 'degraded').length} degraded</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{data.services.filter(s => s.status === 'down').length} down</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {data.services.map((service) => {
          const Icon = serviceIcon(service.name);
          const status = statusBadge(service.status);
          return (
            <Card key={service.name} className={cn('p-4 border transition-all', scoreBg(service.score))}>
              <div className="flex items-start justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-background/80">
                  <Icon className="h-4 w-4" />
                </div>
                <Badge variant={status.variant} className="text-[10px]">
                  {status.label}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{service.name}</span>
                  <span className={cn('text-sm font-bold font-mono', scoreColor(service.score))}>
                    {service.score}
                  </span>
                </div>

                {/* Mini gauge */}
                <div className="flex justify-center">
                  <div className="relative">
                    <MiniGauge score={service.score} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {service.score}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Uptime:</span>
                    <span className="font-mono font-medium">{service.uptime}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Resp:</span>
                    <span className="font-mono font-medium">{service.responseTime}ms</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground truncate" title={service.details}>
                  {service.details}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Active Alerts */}
      {data.alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Active Health Alerts
              <Badge variant="secondary" className="text-xs">{data.alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                    severityBg(alert.severity)
                  )}
                >
                  {severityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.service} · {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge
                    variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'outline'}
                    className="text-[10px] shrink-0"
                  >
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Alerts */}
      {data.alerts.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              All services are healthy — no active alerts
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

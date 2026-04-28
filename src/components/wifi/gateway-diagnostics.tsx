'use client';

/**
 * Gateway Diagnostics Page
 *
 * Comprehensive diagnostic toolkit for WiFi RADIUS gateway.
 * Each tool is an independent card that runs a specific diagnostic
 * (service health, port check, database, DNS, system info, NAS ping, config check).
 *
 * Data source: /api/wifi/diagnostics?action=<tool>
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileCheck2,
  Globe,
  HardDrive,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Server,
  Settings2,
  Shield,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DiagnosticResult {
  success: boolean;
  duration_ms: number;
  data: Record<string, unknown>;
  error?: string;
}

type ToolStatus = 'idle' | 'loading' | 'success' | 'error';

interface ToolState {
  status: ToolStatus;
  result: DiagnosticResult | null;
}

// ─── Helper: format bytes ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function GatewayDiagnostics() {
  const { toast } = useToast();

  // Per-tool state
  const [tools, setTools] = useState<Record<string, ToolState>>({
    'service-health': { status: 'idle', result: null },
    'port-check': { status: 'idle', result: null },
    'database-check': { status: 'idle', result: null },
    'dns-resolve': { status: 'idle', result: null },
    'system-info': { status: 'idle', result: null },
    'nas-ping': { status: 'idle', result: null },
    'config-check': { status: 'idle', result: null },
  });

  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [dnsHostname, setDnsHostname] = useState('');

  // ─── Run a diagnostic tool ──────────────────────────────────────────────────

  const runDiagnostic = useCallback(async (action: string, params?: Record<string, string>) => {
    setTools(prev => ({ ...prev, [action]: { status: 'loading', result: null } }));

    try {
      const qs = new URLSearchParams({ action });
      if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      }

      const res = await fetch(`/api/wifi/diagnostics?${qs.toString()}`);
      const result = await res.json();

      const toolResult: DiagnosticResult = {
        success: result.success !== false,
        duration_ms: result.duration_ms || 0,
        data: result.data || {},
        error: result.error,
      };

      setTools(prev => ({
        ...prev,
        [action]: {
          status: toolResult.success ? 'success' : 'error',
          result: toolResult,
        },
      }));

      if (toolResult.success) {
        toast({ title: 'Diagnostics Complete', description: `${action} finished in ${toolResult.duration_ms}ms` });
      } else {
        toast({ title: 'Diagnostics Failed', description: result.error || `Failed to run ${action}`, variant: 'destructive' });
      }
    } catch (err) {
      setTools(prev => ({
        ...prev,
        [action]: {
          status: 'error',
          result: { success: false, duration_ms: 0, data: {}, error: 'Network error' },
        },
      }));
      toast({ title: 'Error', description: 'Failed to connect to diagnostics service', variant: 'destructive' });
    }
  }, [toast]);

  const runAll = useCallback(() => {
    const actions = ['service-health', 'port-check', 'database-check', 'system-info', 'config-check', 'nas-ping'];
    for (const action of actions) {
      runDiagnostic(action);
    }
  }, [runDiagnostic]);

  // ─── Tool definitions ───────────────────────────────────────────────────────

  const toolDefs = [
    {
      id: 'service-health',
      title: 'RADIUS Service Health',
      description: 'Check FreeRADIUS process status, version, uptime, and active session count',
      icon: Radio,
      gradient: 'from-teal-500 to-emerald-600',
      bg: 'bg-teal-500/10',
      accent: 'text-teal-500',
    },
    {
      id: 'port-check',
      title: 'Port Scanner',
      description: 'Test RADIUS auth (1812), accounting (1813), and CoA (1814) ports',
      icon: Shield,
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-500/10',
      accent: 'text-amber-500',
    },
    {
      id: 'database-check',
      title: 'Database Health',
      description: 'Check PostgreSQL connectivity, table integrity, and record counts',
      icon: Database,
      gradient: 'from-cyan-500 to-teal-600',
      bg: 'bg-cyan-500/10',
      accent: 'text-cyan-500',
    },
    {
      id: 'system-info',
      title: 'System Information',
      description: 'Host OS, memory, CPU load, and FreeRADIUS installation paths',
      icon: HardDrive,
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-500/10',
      accent: 'text-rose-500',
    },
    {
      id: 'nas-ping',
      title: 'NAS Connectivity',
      description: 'TCP reachability check to all configured NAS devices',
      icon: Wifi,
      gradient: 'from-emerald-500 to-cyan-600',
      bg: 'bg-emerald-500/10',
      accent: 'text-emerald-500',
    },
    {
      id: 'config-check',
      title: 'Configuration Audit',
      description: 'Verify FreeRADIUS config files exist and are readable',
      icon: FileCheck2,
      gradient: 'from-orange-500 to-amber-600',
      bg: 'bg-orange-500/10',
      accent: 'text-orange-500',
    },
    {
      id: 'dns-resolve',
      title: 'DNS Resolver',
      description: 'Resolve hostnames to IP addresses for NAS and service endpoints',
      icon: Globe,
      gradient: 'from-slate-500 to-gray-600',
      bg: 'bg-slate-500/10',
      accent: 'text-slate-500',
    },
  ];

  // ─── Status badge renderer ─────────────────────────────────────────────────

  const getStatusBadge = (status: ToolStatus) => {
    switch (status) {
      case 'idle':
        return <Badge variant="outline" className="text-muted-foreground text-[10px] uppercase tracking-wider">Ready</Badge>;
      case 'loading':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px] uppercase tracking-wider">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case 'success':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Passed
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  // ─── Detail renderers per tool ─────────────────────────────────────────────

  const renderServiceHealthDetail = (data: Record<string, unknown>) => {
    const svc = (data.service as Record<string, unknown>) || {};
    const stats = (data.statistics as Record<string, unknown>) || {};
    const running = svc.running === true;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
            <p className={cn('text-sm font-semibold mt-1', running ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {running ? 'Running' : 'Stopped'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Version</p>
            <p className="text-sm font-semibold mt-1 font-mono">{String(svc.version || 'N/A')}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Uptime</p>
            <p className="text-sm font-semibold mt-1">{String(svc.uptime || 'N/A')}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">RADIUS Users</p>
            <p className="text-sm font-semibold mt-1 tabular-nums">{String(stats.totalUsers ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">NAS Clients</p>
            <p className="text-sm font-semibold mt-1 tabular-nums">{String(stats.totalNas ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Active Sessions</p>
            <p className="text-sm font-semibold mt-1 tabular-nums">{String(stats.activeSessions ?? 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> Auth Port: 1812</span>
          <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Acct Port: 1813</span>
          {svc.pid && <span className="font-mono">PID: {String(svc.pid)}</span>}
        </div>
      </div>
    );
  };

  const renderPortCheckDetail = (data: Record<string, unknown>) => {
    const ports = Array.isArray(data.ports) ? data.ports as Array<Record<string, unknown>> : [];
    return (
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Host</TableHead>
              <TableHead className="text-xs">Port</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ports.map((p, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{String(p.host || 'localhost')}</TableCell>
                <TableCell className="text-xs font-semibold">{String(p.port)}</TableCell>
                <TableCell>
                  {p.status === 'open' ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Open
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">
                      <WifiOff className="h-3 w-3 mr-1" /> Closed
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {p.latency_ms != null ? `${p.latency_ms}ms` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderDatabaseCheckDetail = (data: Record<string, unknown>) => {
    const tables = Array.isArray(data.tables) ? data.tables as Array<Record<string, unknown>> : [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Connection</p>
            <p className="text-sm font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
              {data.connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Database Size</p>
            <p className="text-sm font-semibold mt-1">{String(data.databaseSize || 'N/A')}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Tables</p>
            <p className="text-sm font-semibold mt-1">{tables.length}</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Table</TableHead>
              <TableHead className="text-xs text-right">Records</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No table data returned</TableCell>
              </TableRow>
            ) : tables.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{String(t.table)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums font-semibold">{String(t.count ?? 0)}</TableCell>
                <TableCell>
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">OK</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderSystemInfoDetail = (data: Record<string, unknown>) => {
    const mem = (data.memory as Record<string, unknown>) || {};
    const up = (data.uptime as Record<string, unknown>) || {};
    const nodejs = (data.nodejs as Record<string, unknown>) || {};
    const freeradius = (data.freeradius as Record<string, unknown>) || {};
    const memPct = typeof mem.utilizationPercent === 'number' ? mem.utilizationPercent : null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Hostname', value: String(data.hostname || 'N/A') },
            { label: 'Platform', value: String(data.platform || 'N/A') },
            { label: 'Architecture', value: String(data.arch || 'N/A') },
            { label: 'Node.js', value: String(nodejs.version || 'N/A') },
            { label: 'Total Memory', value: String(mem.total || 'N/A') },
            { label: 'Free Memory', value: String(mem.free || 'N/A') },
          ].map((item, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
              <p className="text-sm font-semibold mt-1 font-mono">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">System Uptime</p>
            <p className="text-sm font-semibold mt-1">{String(up.formatted || 'N/A')}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Memory Usage</p>
            {memPct != null ? (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">{String(memPct)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      memPct > 80 ? 'bg-red-500' :
                      memPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(memPct, 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold mt-1">N/A</p>
            )}
          </div>
        </div>
        {freeradius.configDirectory && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">FreeRADIUS Config Dir</p>
            <p className="text-sm font-mono mt-1">{String(freeradius.configDirectory)}</p>
          </div>
        )}
      </div>
    );
  };

  const renderNasPingDetail = (data: Record<string, unknown>) => {
    const results = Array.isArray(data.nas) ? data.nas as Array<Record<string, unknown>> : [];
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Reachable: {results.filter(r => r.status === 'open').length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Unreachable: {results.filter(r => r.status !== 'open').length}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Timeout: 2s
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">NAS Device</TableHead>
              <TableHead className="text-xs">IP Address</TableHead>
              <TableHead className="text-xs">Port 1812</TableHead>
              <TableHead className="text-xs text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No NAS devices configured</TableCell>
              </TableRow>
            ) : results.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{String(r.nasName || 'Unknown')}</TableCell>
                <TableCell className="font-mono text-xs">{String(r.nasIp)}</TableCell>
                <TableCell>
                  {r.status === 'open' ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">
                      <Wifi className="h-3 w-3 mr-1" /> Reachable
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">
                      <WifiOff className="h-3 w-3 mr-1" /> Unreachable
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {r.latency_ms != null ? `${r.latency_ms}ms` : 'timeout'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderConfigCheckDetail = (data: Record<string, unknown>) => {
    const files = Array.isArray(data.configs) ? data.configs as Array<Record<string, unknown>> : [];
    const allOk = files.every(f => f.exists && f.readable);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {allOk ? (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> All Config Files OK
            </Badge>
          ) : (
            <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Issues Found
            </Badge>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Config File</TableHead>
              <TableHead className="text-xs">Exists</TableHead>
              <TableHead className="text-xs">Readable</TableHead>
              <TableHead className="text-xs text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-[11px] break-all max-w-[300px]">{String(f.path || 'unknown')}</TableCell>
                <TableCell>
                  <Badge className={cn('border-0 text-[10px]', f.exists ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
                    {f.exists ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border-0 text-[10px]', f.readable ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white')}>
                    {f.readable ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {f.size != null ? formatBytes(Number(f.size)) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderDnsResolveDetail = (data: Record<string, unknown>) => {
    // Backend returns either { hostname, addresses } (single) or { resolved: [{ nasname, nasipaddress, addresses }] } (bulk)
    const isSingle = !!(data.hostname && Array.isArray(data.addresses));
    const bulkResults = Array.isArray(data.resolved) ? data.resolved as Array<Record<string, unknown>> : [];
    const rows = isSingle
      ? [{ hostname: data.hostname, addresses: data.addresses, error: data.error }]
      : bulkResults.map(r => ({ hostname: r.nasname || r.nasipaddress || 'unknown', addresses: r.addresses, error: r.error }));

    return (
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Hostname</TableHead>
              <TableHead className="text-xs">IP Addresses</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No results — enter a hostname or run to resolve NAS hostnames</TableCell>
              </TableRow>
            ) : rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{String(r.hostname || 'unknown')}</TableCell>
                <TableCell className="text-xs">
                  {Array.isArray(r.addresses) && r.addresses.length > 0
                    ? (r.addresses as string[]).map(a => (
                        <Badge key={a} variant="outline" className="mr-1 mb-1 text-[10px] font-mono">{a}</Badge>
                      ))
                    : <span className="text-muted-foreground">—</span>
                  }
                </TableCell>
                <TableCell>
                  {r.error ? (
                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {String(r.error)}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolved
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // ─── Render detail content for expanded tool ───────────────────────────────

  const renderToolDetail = (toolId: string, data: Record<string, unknown>) => {
    switch (toolId) {
      case 'service-health': return renderServiceHealthDetail(data);
      case 'port-check': return renderPortCheckDetail(data);
      case 'database-check': return renderDatabaseCheckDetail(data);
      case 'system-info': return renderSystemInfoDetail(data);
      case 'nas-ping': return renderNasPingDetail(data);
      case 'config-check': return renderConfigCheckDetail(data);
      case 'dns-resolve': return renderDnsResolveDetail(data);
      default: return <p className="text-sm text-muted-foreground">No detail view available</p>;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Gateway Diagnostics
          </h2>
          <p className="text-sm text-muted-foreground">
            Run diagnostic tools to troubleshoot and verify your RADIUS gateway health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runAll}>
            <Play className="h-4 w-4 mr-2" />
            Run All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTools(Object.fromEntries(Object.keys(tools).map(k => [k, { status: 'idle' as ToolStatus, result: null }])));
              setExpandedTool(null);
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tools:</span>
              <span className="font-semibold">{toolDefs.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground">Passed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {Object.values(tools).filter(t => t.status === 'success').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-muted-foreground">Failed:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {Object.values(tools).filter(t => t.status === 'error').length}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {Object.values(tools).filter(t => t.status === 'loading').length > 0 && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {toolDefs.map((tool) => {
          const Icon = tool.icon;
          const toolState = tools[tool.id];
          const isLoading = toolState.status === 'loading';

          return (
            <div
              key={tool.id}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
                toolState.status === 'success' && 'ring-1 ring-emerald-400/40 dark:ring-emerald-500/30',
                toolState.status === 'error' && 'ring-1 ring-red-400/40 dark:ring-red-500/30',
              )}
            >
              {/* Top gradient bar */}
              <div className={cn(
                'h-1 w-full bg-gradient-to-r',
                isLoading ? 'animate-pulse bg-muted' : tool.gradient
              )} />

              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shadow-sm bg-gradient-to-br', tool.gradient)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{tool.title}</h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{tool.description}</p>
                    </div>
                  </div>
                </div>

                {/* Status + Duration */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(toolState.status)}
                  {toolState.result && (
                    <span className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {toolState.result.duration_ms}ms
                    </span>
                  )}
                </div>

                {/* DNS input for dns-resolve tool */}
                {tool.id === 'dns-resolve' && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter hostname (e.g., nas.local)"
                      value={dnsHostname}
                      onChange={(e) => setDnsHostname(e.target.value)}
                      className="h-8 text-xs bg-muted/40 border-muted-foreground/10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && dnsHostname.trim()) {
                          runDiagnostic('dns-resolve', { hostname: dnsHostname.trim() });
                        }
                      }}
                    />
                  </div>
                )}

                {/* Error message */}
                {toolState.status === 'error' && toolState.result?.error && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                    {toolState.result.error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs rounded-lg"
                    disabled={isLoading}
                    onClick={() => {
                      if (tool.id === 'dns-resolve' && dnsHostname.trim()) {
                        runDiagnostic('dns-resolve', { hostname: dnsHostname.trim() });
                      } else {
                        runDiagnostic(tool.id);
                      }
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1.5" />
                    )}
                    {isLoading ? 'Running...' : 'Run'}
                  </Button>
                  {toolState.result && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                    >
                      <ChevronRight className={cn(
                        'h-4 w-4 transition-transform',
                        expandedTool === tool.id && 'rotate-90'
                      )} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Detail Dialog */}
      <Dialog open={expandedTool !== null} onOpenChange={(open) => { if (!open) setExpandedTool(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            {expandedTool && (
              <>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const def = toolDefs.find(t => t.id === expandedTool);
                    if (!def) return null;
                    const Icon = def.icon;
                    return (
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br', def.gradient)}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                    );
                  })()}
                  {toolDefs.find(t => t.id === expandedTool)?.title}
                </DialogTitle>
                <DialogDescription>
                  Detailed results for {toolDefs.find(t => t.id === expandedTool)?.description}
                </DialogDescription>
              </>
            )}
          </DialogHeader>
          {expandedTool && tools[expandedTool]?.result && (
            <div className="py-2">
              {tools[expandedTool].status === 'loading' ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                renderToolDetail(expandedTool, tools[expandedTool].result!.data)
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

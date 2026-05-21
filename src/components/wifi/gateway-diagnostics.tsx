'use client';

/**
 * Gateway Diagnostics — Real network troubleshooting tools
 *
 * Tools modelled after Cisco, MikroTik, FortiGate, pfSense diagnostics:
 *   Phase 1: Ping, Traceroute, DNS Lookup, ARP Table
 *   Phase 2: Network Scan
 *   Phase 3: Packet Capture, Speed Test, Port Check, Connection Table
 *
 * API: /api/wifi/diagnostics?action=<tool>&host=...&...
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Trash2,
  Download,
  Gauge,
  Globe,
  HardDrive,
  Hash,
  Loader2,
  Network,
  Play,
  Plus,
  Radar,
  Route,
  Search,
  Shield,
  Terminal,
  Upload,
  XCircle,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════════════════
// Shared Types & Helpers
// ═══════════════════════════════════════════════════════════════════

interface ToolResult {
  success: boolean;
  duration_ms: number;
  data: Record<string, unknown>;
  error?: string;
}

type RunState = 'idle' | 'loading' | 'done';

function ToolHeader({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm',
          gradient,
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function TerminalOutput({
  content,
  label,
  maxHeight = 'max-h-80',
}: {
  content: string;
  label: string;
  maxHeight?: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={cn(
          'bg-slate-950 dark:bg-black rounded-lg border border-slate-800 overflow-auto',
          maxHeight,
        )}
      >
        <pre className="p-4 text-xs font-mono text-primary leading-relaxed whitespace-pre-wrap break-all">
          {content || '(no output)'}
        </pre>
      </div>
    </div>
  );
}

function SummaryBar({
  items,
}: {
  items: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/50 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {item.label}
          </p>
          <p
            className={cn(
              'text-sm font-semibold mt-1 tabular-nums',
              item.color || '',
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function RunButton({
  loading,
  onClick,
  label = 'Run',
}: {
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      size="sm"
      className="h-8 px-4"
      disabled={loading}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Play className="h-3.5 w-3.5 mr-1.5" />
      )}
      {loading ? 'Running...' : label}
    </Button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function DurationBadge({ ms }: { ms: number }) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums ml-2">
      {ms}ms
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 1: LIVE PING
// ═══════════════════════════════════════════════════════════════════

function PingTool() {
  const { toast } = useToast();
  const [host, setHost] = useState('8.8.8.8');
  const [count, setCount] = useState('4');
  const [timeout, setTimeout_] = useState('5');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    if (!host.trim()) return;
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'ping',
        host: host.trim(),
        count,
        timeout,
      });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        const d = r.data as Record<string, unknown>;
        const s = d.summary as Record<string, unknown> | undefined;
        toast({
          title: 'Ping Complete',
          description: `${String(s?.received ?? 0)}/${String(s?.transmitted ?? 0)} packets received`,
        });
      } else {
        toast({ title: 'Ping Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
      toast({ title: 'Error', description: 'Failed to connect', variant: 'destructive' });
    }
  }, [host, count, timeout, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const summary = data?.summary as Record<string, unknown> | undefined;
  const rtt = data?.rtt as Record<string, unknown> | undefined;
  const packets = (data?.packets as Array<Record<string, unknown>>) || [];
  const lossPct = summary ? Number(summary.lossPercent ?? 100) : 100;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={CircleDot} title="Live Ping" description="Send ICMP echo requests to test host reachability and measure latency" gradient="from-primary to-primary/70" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Target Host / IP</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="8.8.8.8 or google.com"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Packets</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['3', '4', '5', '10', '20', '50'].map((v) => (
                  <SelectItem key={v} value={v}>{v} packets</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Timeout (s)</Label>
            <Select value={timeout} onValueChange={setTimeout_}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '5', '10', '15', '30'].map((v) => (
                  <SelectItem key={v} value={v}>{v}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <RunButton loading={state === 'loading'} onClick={run} label="Start Ping" />
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && summary && (
          <>
            <SummaryBar
              items={[
                { label: 'Sent', value: String(summary.transmitted ?? '-') },
                { label: 'Received', value: String(summary.received ?? '-') },
                {
                  label: 'Packet Loss',
                  value: `${lossPct}%`,
                  color: lossPct === 0
                    ? 'text-primary'
                    : lossPct < 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400',
                },
                { label: 'Avg RTT', value: rtt ? `${rtt.avg} ms` : '--' },
              ]}
            />
            {rtt && (
              <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
                <span>Min: {rtt.min} ms</span>
                <span>Avg: {rtt.avg} ms</span>
                <span>Max: {rtt.max} ms</span>
                <span>MDev: {rtt.mdev} ms</span>
              </div>
            )}
          </>
        )}

        {data?.rawOutput && (
          <TerminalOutput content={String(data.rawOutput)} label="Raw Output" />
        )}

        {packets.length > 0 && (
          <div className="mt-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-16">Seq</TableHead>
                  <TableHead className="text-xs">From</TableHead>
                  <TableHead className="text-xs w-16">TTL</TableHead>
                  <TableHead className="text-xs text-right">RTT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packets.map((p) => (
                  <TableRow key={p.seq}>
                    <TableCell className="font-mono text-xs">{p.seq}</TableCell>
                    <TableCell className="font-mono text-xs">{p.from || host}</TableCell>
                    <TableCell className="text-xs">{p.ttl ?? '--'}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-medium text-primary">
                      {p.rtt} ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 2: TRACEROUTE
// ═══════════════════════════════════════════════════════════════════

function TracerouteTool() {
  const { toast } = useToast();
  const [host, setHost] = useState('8.8.8.8');
  const [maxHops, setMaxHops] = useState('30');
  const [timeout, setTimeout_] = useState('5');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    if (!host.trim()) return;
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'traceroute',
        host: host.trim(),
        maxHops,
        timeout,
      });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({ title: 'Traceroute Complete', description: `${json.data?.hopCount || 0} hops traced` });
      } else {
        toast({ title: 'Traceroute Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [host, maxHops, timeout, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const hops = (data?.hops as Array<Record<string, unknown>>) || [];

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Network} title="Traceroute" description="Trace the network path to a destination, showing each hop and its latency" gradient="from-amber-500 to-orange-600" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Target Host / IP</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="8.8.8.8 or google.com"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Max Hops</Label>
            <Select value={maxHops} onValueChange={setMaxHops}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['10', '20', '30', '40', '64'].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Timeout (s)</Label>
            <Select value={timeout} onValueChange={setTimeout_}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '5', '10'].map((v) => (
                  <SelectItem key={v} value={v}>{v}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <RunButton loading={state === 'loading'} onClick={run} label="Trace Route" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {result?.success && (
            <Badge variant="outline" className="text-[10px] ml-2">
              {hops.length} hops
            </Badge>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {hops.length > 0 && (
          <div className="mt-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-14">Hop</TableHead>
                  <TableHead className="text-xs">Probe 1</TableHead>
                  <TableHead className="text-xs">Probe 2</TableHead>
                  <TableHead className="text-xs">Probe 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hops.map((hop) => {
                  const probes = (hop.probes as Array<Record<string, unknown>>) || [];
                  const allTimeout = probes.every((p) => p.ip === '*');
                  return (
                    <TableRow key={hop.hop}>
                      <TableCell className="font-mono text-xs font-medium">
                        {hop.hop}
                      </TableCell>
                      {[0, 1, 2].map((i) => {
                        const probe = probes[i];
                        if (!probe) return <TableCell key={i} className="text-xs text-muted-foreground">--</TableCell>;
                        if (probe.ip === '*')
                          return (
                            <TableCell key={i} className="text-xs text-muted-foreground">
                              * * *
                            </TableCell>
                          );
                        return (
                          <TableCell key={i} className="text-xs">
                            <span className="font-mono">{probe.ip}</span>
                            <span className="text-muted-foreground ml-1">{probe.rtt} ms</span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
        )}

        {data?.rawOutput && (
          <TerminalOutput content={String(data.rawOutput)} label="Raw Output" />
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 3: DNS LOOKUP
// ═══════════════════════════════════════════════════════════════════

function DnsLookupTool() {
  const { toast } = useToast();
  const [hostname, setHostname] = useState('google.com');
  const [type, setType] = useState('A');
  const [server, setServer] = useState('');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    if (!hostname.trim()) return;
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'dns-lookup',
        hostname: hostname.trim(),
        type,
      });
      if (server.trim()) qs.set('server', server.trim());
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({ title: 'DNS Lookup Complete', description: `${json.data?.count || 0} records found` });
      } else {
        toast({ title: 'DNS Lookup Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [hostname, type, server, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const records = data?.records;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Globe} title="DNS Lookup" description="Query DNS records (A, AAAA, CNAME, MX, NS, TXT, SOA) from any DNS server" gradient="from-primary to-primary/70" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Hostname</Label>
            <Input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="google.com"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Record Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">DNS Server (optional)</Label>
            <Input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="8.8.8.8"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <RunButton loading={state === 'loading'} onClick={run} label="Lookup" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {result?.success && data?.server && (
            <Badge variant="outline" className="text-[10px] ml-2">
              via {String(data.server)}
            </Badge>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && records && (
          <div className="mt-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(records) && records.length > 0 ? (
                  records.map((rec, i) => {
                    if (typeof rec === 'object' && rec !== null) {
                      const obj = rec as Record<string, unknown>;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {Object.entries(obj)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-mono">{String(rec)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">
                      No records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 4: ARP TABLE
// ═══════════════════════════════════════════════════════════════════

function ArpTableTool() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addIp, setAddIp] = useState('');
  const [addMac, setAddMac] = useState('');
  const [addDevice, setAddDevice] = useState('');
  const [addingStatic, setAddingStatic] = useState(false);
  const [flushing, setFlushing] = useState(false);

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({ action: 'arp-table' });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({ title: 'ARP Table Loaded', description: `${json.data?.total || 0} entries` });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [search, toast]);

  const flushArp = useCallback(async () => {
    setFlushing(true);
    try {
      const qs = new URLSearchParams({ action: 'arp-flush' });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      if (json.success) {
        toast({ title: 'ARP Cache Flushed', description: 'ARP cache cleared successfully' });
        run();
      } else {
        toast({ title: 'Flush Failed', description: json.error || 'Failed to flush ARP cache', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error flushing ARP', variant: 'destructive' });
    }
    setFlushing(false);
  }, [toast, run]);

  const addStaticEntry = useCallback(async () => {
    if (!addIp.trim() || !addMac.trim()) {
      toast({ title: 'Validation Error', description: 'IP and MAC are required', variant: 'destructive' });
      return;
    }
    setAddingStatic(true);
    try {
      const qs = new URLSearchParams({ action: 'arp-add-static' });
      qs.set('ip', addIp.trim());
      qs.set('mac', addMac.trim());
      if (addDevice.trim()) qs.set('device', addDevice.trim());
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Static Entry Added', description: `${addIp.trim()} → ${addMac.trim()}` });
        setAddIp('');
        setAddMac('');
        setAddDevice('');
        setShowAddForm(false);
        run();
      } else {
        toast({ title: 'Add Failed', description: json.error || 'Failed to add static entry', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error adding static entry', variant: 'destructive' });
    }
    setAddingStatic(false);
  }, [addIp, addMac, addDevice, toast, run]);

  const data = result?.data as Record<string, unknown> | undefined;
  const entries = (data?.entries as Array<Record<string, unknown>>) || [];

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Hash} title="ARP Table" description="View the system ARP cache — MAC to IP address mappings from the gateway" gradient="from-primary to-primary/70" />

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px] max-w-sm">
            <Label className="text-xs">Filter (IP / MAC / Device)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="192.168 or eth0"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <RunButton loading={state === 'loading'} onClick={run} label="Refresh ARP" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800"
            disabled={flushing}
            onClick={flushArp}
          >
            {flushing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            Flush ARP Cache
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 border-primary/30 text-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/5"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Static Entry
          </Button>
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {showAddForm && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium mb-3">Add Static ARP Entry</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">IP Address *</Label>
                <Input
                  value={addIp}
                  onChange={(e) => setAddIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">MAC Address *</Label>
                <Input
                  value={addMac}
                  onChange={(e) => setAddMac(e.target.value)}
                  placeholder="aa:bb:cc:dd:ee:ff"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Device (optional)</Label>
                <Input
                  value={addDevice}
                  onChange={(e) => setAddDevice(e.target.value)}
                  placeholder="eth0"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs px-3" disabled={addingStatic || !addIp.trim() || !addMac.trim()} onClick={addStaticEntry}>
                {addingStatic ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
                Submit
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {result?.error && <ErrorBox message={result.error} />}

        {entries.length > 0 && (
          <div className="mt-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">IP Address</TableHead>
                  <TableHead className="text-xs">MAC Address</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Flags</TableHead>
                  <TableHead className="text-xs">Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{String(e.ip)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(e.mac)}</TableCell>
                    <TableCell className="text-xs">{String(e.hwType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {String(e.flags)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{String(e.device)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}

        {state === 'done' && entries.length === 0 && !result?.error && (
          <div className="mt-4 text-center py-8 text-xs text-muted-foreground">
            <Hash className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No ARP entries found
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 5: NETWORK SCAN
// ═══════════════════════════════════════════════════════════════════

function NetworkScanTool() {
  const { toast } = useToast();
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [timeout, setTimeout_] = useState('2');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    if (!subnet.trim()) return;
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'network-scan',
        subnet: subnet.trim(),
        timeout,
      });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({
          title: 'Scan Complete',
          description: `${json.data?.totalFound || 0} hosts alive`,
        });
      } else {
        toast({ title: 'Scan Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [subnet, timeout, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const aliveHosts = (data?.aliveHosts as string[]) || [];

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Radar} title="Network Scan" description="Scan a local subnet to discover alive hosts using fast parallel ping (fping)" gradient="from-rose-500 to-pink-600" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Subnet (CIDR)</Label>
            <Input
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="192.168.1.0/24"
              className="mt-1 h-8 text-xs font-mono"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Timeout (s)</Label>
            <Select value={timeout} onValueChange={setTimeout_}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '5', '10'].map((v) => (
                  <SelectItem key={v} value={v}>{v}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <RunButton loading={state === 'loading'} onClick={run} label="Start Scan" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {state === 'loading' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning {subnet}...
            </span>
          )}
          {result?.success && data?.method && (
            <Badge variant="outline" className="text-[10px] ml-2">
              via {String(data.method)}
            </Badge>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {aliveHosts.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">{aliveHosts.length} hosts alive</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {aliveHosts.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-mono text-xs">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 6: PACKET CAPTURE
// ═══════════════════════════════════════════════════════════════════

function PacketCaptureTool() {
  const { toast } = useToast();
  const [iface, setIface] = useState('any');
  const [filter, setFilter] = useState('');
  const [duration, setDuration] = useState('10');
  const [count, setCount] = useState('100');
  const [savePcap, setSavePcap] = useState(false);
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'packet-capture',
        interface: iface,
        duration,
        count,
      });
      if (filter.trim()) qs.set('filter', filter.trim());
      if (savePcap) qs.set('savePcap', 'true');
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({
          title: 'Capture Complete',
          description: `${json.data?.totalCaptured || 0} packets captured`,
        });
      } else {
        toast({ title: 'Capture Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [iface, filter, duration, count, savePcap, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const packets = (data?.packets as string[]) || [];
  const captureId = data?.captureId as string | undefined;
  const pcapSaved = data?.pcapSaved as boolean | undefined;
  const analysis = data?.analysis as Record<string, unknown> | undefined;
  const protocolBreakdown = (analysis?.protocolBreakdown as Record<string, number>) || {};
  const topSourceIps = (analysis?.topSourceIps as Array<Record<string, unknown>>) || [];
  const topDestIps = (analysis?.topDestIps as Array<Record<string, unknown>>) || [];
  const topDestPorts = (analysis?.topDestPorts as Array<Record<string, unknown>>) || [];

  const protoColors: Record<string, string> = {
    TCP: 'bg-primary',
    UDP: 'bg-cyan-500',
    ICMP: 'bg-amber-500',
    ARP: 'bg-orange-500',
    DNS: 'bg-violet-500',
    Other: 'bg-slate-400',
  };

  const totalProto = Object.values(protocolBreakdown).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Shield} title="Packet Capture" description="Capture live network traffic using tcpdump with BPF filter support" gradient="from-violet-500 to-purple-600" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Interface</Label>
            <Input
              value={iface}
              onChange={(e) => setIface(e.target.value)}
              placeholder="eth0"
              className="mt-1 h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">BPF Filter (optional)</Label>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="port 53 or host 8.8.8.8"
              className="mt-1 h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Duration (s)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['5', '10', '15', '30', '60'].map((v) => (
                  <SelectItem key={v} value={v}>{v}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Max Packets</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['50', '100', '250', '500', '1000'].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Checkbox
              id="save-pcap"
              checked={savePcap}
              onCheckedChange={(v) => setSavePcap(v === true)}
            />
            <Label htmlFor="save-pcap" className="text-xs cursor-pointer select-none">Save PCAP</Label>
          </div>
          <RunButton loading={state === 'loading'} onClick={run} label="Start Capture" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {state === 'loading' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Capturing on {iface}...
            </span>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && (
          <SummaryBar
            items={[
              { label: 'Interface', value: String(data?.interface || iface) },
              { label: 'Filter', value: String(data?.filter || 'none') },
              { label: 'Captured', value: `${packets.length} packets` },
              ...(pcapSaved ? [{ label: 'PCAP', value: 'Saved', color: 'text-primary' }] : []),
            ]}
          />
        )}

        {/* PCAP Download */}
        {result?.success && pcapSaved && captureId && (
          <div className="mt-4">
            <a
              href={`/api/wifi/diagnostics?action=pcap-download&captureId=${encodeURIComponent(captureId)}`}
              download
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download PCAP
            </a>
          </div>
        )}

        {/* Analysis Panel */}
        {result?.success && analysis && Object.keys(analysis).length > 0 && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Capture Analysis
              </span>
            </div>

            {/* Protocol Breakdown Bar Chart */}
            {Object.keys(protocolBreakdown).length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium mb-3">Protocol Breakdown</p>
                <div className="space-y-2">
                  {Object.entries(protocolBreakdown).sort(([, a], [, b]) => b - a).map(([proto, cnt]) => {
                    const pct = totalProto > 0 ? (cnt / totalProto) * 100 : 0;
                    return (
                      <div key={proto} className="flex items-center gap-3">
                        <span className="text-[11px] font-mono w-10 shrink-0 text-right">{proto}</span>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div
                            className={cn('h-full rounded transition-all duration-500', protoColors[proto] || protoColors.Other)}
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums w-16 shrink-0">{cnt} ({pct.toFixed(1)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Talkers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Top Source IPs */}
              {topSourceIps.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-medium mb-2">Top Source IPs</p>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px]">IP</TableHead>
                        <TableHead className="text-[10px] text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topSourceIps.slice(0, 5).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-[11px]">{String(item.ip)}</TableCell>
                          <TableCell className="text-[11px] text-right tabular-nums">{String(item.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}

              {/* Top Dest IPs */}
              {topDestIps.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-medium mb-2">Top Dest IPs</p>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px]">IP</TableHead>
                        <TableHead className="text-[10px] text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDestIps.slice(0, 5).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-[11px]">{String(item.ip)}</TableCell>
                          <TableCell className="text-[11px] text-right tabular-nums">{String(item.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}

              {/* Top Dest Ports */}
              {topDestPorts.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-medium mb-2">Top Dest Ports</p>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px]">Port</TableHead>
                        <TableHead className="text-[10px] text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDestPorts.slice(0, 5).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-[11px]">{String(item.port)}</TableCell>
                          <TableCell className="text-[11px] text-right tabular-nums">{String(item.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {packets.length > 0 && (
          <TerminalOutput
            content={packets.join('\n')}
            label="Captured Packets"
            maxHeight="max-h-96"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 7: SPEED TEST — Real bandwidth test with animated SVG gauge
// ═══════════════════════════════════════════════════════════════════
// Tests actual bandwidth between browser and server (gateway).
// Download: fetches random data from /api/wifi/speedtest-probe
// Upload: POSTs random data to /api/wifi/speedtest-probe
// Ping: small XHR round-trip measurements
//
// Also provides links to external speed test services for internet speed.

const GAUGE_SCALES = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];

function getAutoScale(speed: number, current: number): number {
  if (speed > current * 0.8) {
    for (const s of GAUGE_SCALES) {
      if (s > speed * 1.3) return s;
    }
    return 5000;
  }
  return current;
}

function getScaleSteps(max: number): number[] {
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  let interval = 1;
  for (const s of nice) {
    if (max / s <= 6) { interval = s; break; }
  }
  const marks: number[] = [];
  for (let i = 0; i <= max + 0.001; i += interval) {
    marks.push(Math.min(Math.round(i), max));
  }
  if (marks[marks.length - 1] < max) marks.push(max);
  return marks;
}

function SpeedGauge({
  speed,
  maxScale,
  phase,
  pingMs,
}: {
  speed: number;
  maxScale: number;
  phase: string;
  pingMs?: number | null;
}) {
  const CX = 150;
  const CY = 150;
  const R = 108;
  const STROKE = 8;
  const CIRC = 2 * Math.PI * R;
  const ARC = Math.PI * R;

  const ratio = Math.min(Math.max(speed, 0) / maxScale, 1);
  const offset = ARC * (1 - ratio);

  const phaseColor: Record<string, string> = {
    starting: 'rgb(148 163 184)',
    ping: 'rgb(6 182 212)',
    download: 'rgb(20 184 166)',
    upload: 'rgb(249 115 22)',
    complete: 'rgb(16 185 129)',
    error: 'rgb(239 68 68)',
  };
  const color = phaseColor[phase] || phaseColor.starting;

  const steps = getScaleSteps(maxScale);
  const pos = (t: number, r = R) => {
    const a = Math.PI * (1 - t);
    return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
  };

  const isPing = phase === 'ping';
  const centerNum = isPing ? (pingMs != null ? pingMs.toFixed(1) : '...') : speed.toFixed(2);
  const centerUnit = isPing ? 'ms' : 'Mbps';

  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-xs mx-auto" aria-label="Speed gauge">
      <defs>
        <filter id="g-glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`grad-${phase}`} x1="0%" y1="0%" x2="100%" y2="0%">
          {phase === 'download' && (
            <>
              <stop offset="0%" stopColor="rgb(20 184 166)" />
              <stop offset="100%" stopColor="rgb(16 185 129)" />
            </>
          )}
          {phase === 'upload' && (
            <>
              <stop offset="0%" stopColor="rgb(249 115 22)" />
              <stop offset="100%" stopColor="rgb(239 68 68)" />
            </>
          )}
          {phase !== 'download' && phase !== 'upload' && (
            <stop offset="0%" stopColor={color} />
          )}
        </linearGradient>
      </defs>

      {/* Background arc */}
      <circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke="rgb(148 163 184)" strokeWidth={STROKE}
        strokeDasharray={`${ARC} ${CIRC}`}
        strokeLinecap="round"
        transform={`rotate(180 ${CX} ${CY})`}
        opacity={0.15}
      />

      {/* Minor ticks */}
      {Array.from({ length: 21 }, (_, idx) => idx / 20).map((t, idx) => {
        const o = pos(t, R + 3);
        const inner = pos(t, R - 4);
        return (
          <line key={`m${idx}`} x1={inner.x} y1={inner.y} x2={o.x} y2={o.y}
            stroke="rgb(148 163 184)" strokeWidth={1} opacity={0.25} />
        );
      })}

      {/* Active arc with glow */}
      {ratio > 0.005 && (
        <circle
          cx={CX} cy={CY} r={R} fill="none"
          stroke={`url(#grad-${phase})`} strokeWidth={STROKE}
          strokeDasharray={`${ARC} ${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(180 ${CX} ${CY})`}
          filter="url(#g-glow)"
          style={{ transition: 'stroke-dashoffset 0.35s ease-out' }}
        />
      )}

      {/* Scale labels */}
      {steps.map((v, i) => {
        const t = v / maxScale;
        const p = pos(t, R + 18);
        return (
          <text key={`l${i}`} x={p.x} y={p.y + 3} textAnchor="middle"
            fill="rgb(100 116 139)" fontSize={9} fontFamily="ui-monospace,monospace">
            {v}
          </text>
        );
      })}

      {/* Center speed number */}
      <text x={CX} y={CY - 42} textAnchor="middle"
        fill="currentColor" fontSize={38} fontWeight="700"
        fontFamily="ui-monospace,monospace"
        style={{ transition: 'all 0.15s ease-out' }}>
        {centerNum}
      </text>
      <text x={CX} y={CY - 18} textAnchor="middle"
        fill="rgb(100 116 139)" fontSize={13} fontWeight="500">
        {centerUnit}
      </text>
    </svg>
  );
}

/** External speed test services for internet speed testing */
const EXTERNAL_SPEED_TESTS = [
  { name: 'Fast.com', url: 'https://fast.com/', icon: Activity, gradient: 'from-red-500 to-rose-600' },
  { name: 'Speedtest.net', url: 'https://www.speedtest.net/', icon: Zap, gradient: 'from-sky-500 to-indigo-600' },
  { name: 'Cloudflare', url: 'https://speed.cloudflare.com/', icon: Globe, gradient: 'from-orange-500 to-amber-600' },
  { name: 'LibreSpeed', url: 'https://speed.librespeed.org/', icon: Gauge, gradient: 'from-teal-500 to-emerald-600' },
];

/** AbortController ref to cancel the running test */
const abortRef = { current: null as AbortController | null };

function SpeedTestTool() {
  const { toast } = useToast();

  // State
  const [phase, setPhase] = useState<string>('idle');
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [maxScale, setMaxScale] = useState(100);
  const [progress, setProgress] = useState(0);
  const [pingData, setPingData] = useState<{ latency: number; jitter: number } | null>(null);
  const [finalResult, setFinalResult] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs
  const animRef = useRef<number | null>(null);
  const currentSpeedRef = useRef(0);
  const targetSpeedRef = useRef(0);
  const maxScaleRef = useRef(100);
  const lastSpeedTimeRef = useRef<number>(Date.now());
  const isDecayingRef = useRef(false);
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth animation loop — interpolates toward target speed at 60fps
  useEffect(() => {
    const running = ['starting', 'ping', 'download', 'upload'].includes(phase);
    if (!running) {
      setDisplaySpeed(targetSpeedRef.current);
      currentSpeedRef.current = targetSpeedRef.current;
      return;
    }
    const animate = () => {
      const diff = targetSpeedRef.current - currentSpeedRef.current;
      if (Math.abs(diff) < 0.02) {
        currentSpeedRef.current = targetSpeedRef.current;
        setDisplaySpeed(targetSpeedRef.current);
      } else {
        currentSpeedRef.current += diff * 0.12;
        setDisplaySpeed(currentSpeedRef.current);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase]);

  // Stale speed detector: decays gauge after 1.5s of no speed updates during active test
  useEffect(() => {
    const running = ['download', 'upload'].includes(phase);
    if (!running) {
      if (staleCheckRef.current) { clearInterval(staleCheckRef.current); staleCheckRef.current = null; }
      isDecayingRef.current = false;
      setIsTransitioning(false);
      return;
    }
    isDecayingRef.current = false;
    setIsTransitioning(false);
    staleCheckRef.current = setInterval(() => {
      const elapsed = Date.now() - lastSpeedTimeRef.current;
      if (elapsed > 1500 && !isDecayingRef.current && currentSpeedRef.current > 1) {
        isDecayingRef.current = true;
        targetSpeedRef.current = 0;
        setIsTransitioning(true);
      }
    }, 500);
    return () => { if (staleCheckRef.current) { clearInterval(staleCheckRef.current); staleCheckRef.current = null; } };
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (staleCheckRef.current) clearInterval(staleCheckRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ── Helper: measure single ping ──
  const measurePing = async (signal: AbortSignal): Promise<number> => {
    const start = performance.now();
    const res = await fetch('/api/wifi/speedtest-probe?action=ping', {
      signal,
      cache: 'no-store',
    });
    await res.text();
    return performance.now() - start;
  };

  // ── Helper: run download test ──
  const runDownloadTest = async (
    signal: AbortSignal,
    onSpeed: (mbps: number, prog: number) => void,
  ): Promise<{ mbps: number; bytes: number; elapsed: number }> => {
    // Progressive download: 100KB → 1MB → 5MB → 10MB → 25MB
    const sizes = [100_000, 1_000_000, 5_000_000, 10_000_000, 25_000_000];
    let totalBytes = 0;
    const startTime = performance.now();
    let peakSpeed = 0;

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const res = await fetch(`/api/wifi/speedtest-probe?action=download&bytes=${size}`, {
        signal,
        cache: 'no-store',
      });

      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

      const reader = res.body.getReader();
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        totalBytes += value.byteLength;

        const elapsed = (performance.now() - startTime) / 1000;
        const speed = (totalBytes * 8) / (elapsed * 1_000_000);
        if (speed > peakSpeed) peakSpeed = speed;

        // Report speed periodically
        if (totalBytes % 500_000 < value.byteLength) {
          onSpeed(speed, (i + received / size) / sizes.length);
        }
      }

      onSpeed(peakSpeed, (i + 1) / sizes.length);
    }

    const elapsed = (performance.now() - startTime) / 1000;
    return {
      mbps: parseFloat(peakSpeed.toFixed(2)),
      bytes: totalBytes,
      elapsed: parseFloat(elapsed.toFixed(1)),
    };
  };

  // ── Helper: run upload test ──
  // FIX: Use 60KB chunks (well under 65536 byte browser crypto limit)
  // Previous code used 256KB which caused: "Failed to execute 'getRandomValues'"
  const runUploadTest = async (
    signal: AbortSignal,
    onSpeed: (mbps: number, prog: number) => void,
  ): Promise<{ mbps: number; bytes: number; elapsed: number }> => {
    // Progressive upload: 100KB → 1MB → 5MB → 10MB → 25MB
    const sizes = [100_000, 1_000_000, 5_000_000, 10_000_000, 25_000_000];
    const CHUNK_SIZE = 60_000; // 60KB — safely under the 65536 byte crypto.getRandomValues limit
    const chunk = new Uint8Array(CHUNK_SIZE);
    crypto.getRandomValues(chunk);

    let totalBytes = 0;
    const startTime = performance.now();
    let peakSpeed = 0;

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      let sent = 0;

      while (sent < size) {
        const blockSize = Math.min(chunk.length, size - sent);
        const data = blockSize < chunk.length ? chunk.subarray(0, blockSize) : chunk;

        const res = await fetch('/api/wifi/speedtest-probe?action=upload', {
          method: 'POST',
          body: data,
          signal,
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        sent += blockSize;
        totalBytes += blockSize;

        const elapsed = (performance.now() - startTime) / 1000;
        const speed = (totalBytes * 8) / (elapsed * 1_000_000);
        if (speed > peakSpeed) peakSpeed = speed;

        onSpeed(speed, (i + sent / size) / sizes.length);
      }

      onSpeed(peakSpeed, (i + 1) / sizes.length);
    }

    const elapsed = (performance.now() - startTime) / 1000;
    return {
      mbps: parseFloat(peakSpeed.toFixed(2)),
      bytes: totalBytes,
      elapsed: parseFloat(elapsed.toFixed(1)),
    };
  };

  const startTest = useCallback(async () => {
    // Reset state
    setPhase('starting');
    targetSpeedRef.current = 0;
    currentSpeedRef.current = 0;
    setDisplaySpeed(0);
    maxScaleRef.current = 100;
    setMaxScale(100);
    setProgress(0);
    setPingData(null);
    setFinalResult(null);
    setErrorMsg(null);
    lastSpeedTimeRef.current = Date.now();
    isDecayingRef.current = false;

    // Cancel any previous test
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    try {
      // ── Phase 1: Ping Test (10 samples) ──
      setPhase('ping');
      const pings: number[] = [];
      for (let i = 0; i < 10; i++) {
        if (signal.aborted) return;
        const ms = await measurePing(signal);
        pings.push(ms);
        const avg = pings.reduce((a, b) => a + b, 0) / pings.length;
        setProgress((i + 1) / 10);
        setPingData({
          latency: avg,
          jitter: pings.length > 1
            ? pings.slice(1).reduce((sum, v, idx) => sum + Math.abs(v - pings[idx]), 0) / (pings.length - 1)
            : 0,
        });
      }

      const pingResult = {
        latency: parseFloat((pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(1)),
        jitter: parseFloat(pings.slice(1).reduce((sum, v, idx) => sum + Math.abs(v - pings[idx]), 0) / (pings.length - 1).toFixed(1)),
      };

      if (signal.aborted) return;

      // ── Phase 2: Download Test ──
      setPhase('download');
      targetSpeedRef.current = 0;
      currentSpeedRef.current = 0;
      lastSpeedTimeRef.current = Date.now();

      const dlResult = await runDownloadTest(signal, (mbps, prog) => {
        if (mbps > 0) {
          targetSpeedRef.current = mbps;
          lastSpeedTimeRef.current = Date.now();
          isDecayingRef.current = false;
          setIsTransitioning(false);
          const newMax = getAutoScale(mbps, maxScaleRef.current);
          if (newMax !== maxScaleRef.current) {
            maxScaleRef.current = newMax;
            setMaxScale(newMax);
          }
        }
        setProgress(prog);
      });

      if (signal.aborted) return;

      // Transition: decay gauge to zero
      targetSpeedRef.current = 0;
      setIsTransitioning(true);
      await new Promise(r => setTimeout(r, 600));
      if (signal.aborted) return;

      // ── Phase 3: Upload Test ──
      setPhase('upload');
      targetSpeedRef.current = 0;
      currentSpeedRef.current = 0;
      lastSpeedTimeRef.current = Date.now();
      setIsTransitioning(false);
      setProgress(0);

      const ulResult = await runUploadTest(signal, (mbps, prog) => {
        if (mbps > 0) {
          targetSpeedRef.current = mbps;
          lastSpeedTimeRef.current = Date.now();
          isDecayingRef.current = false;
          setIsTransitioning(false);
        }
        setProgress(prog);
      });

      if (signal.aborted) return;

      // ── Complete ──
      setPhase('complete');
      setProgress(1);
      targetSpeedRef.current = dlResult.mbps;

      const result = {
        download: {
          megabitsPerSecond: dlResult.mbps,
          totalMB: parseFloat((dlResult.bytes / 1_048_576).toFixed(2)),
          elapsed: dlResult.elapsed,
        },
        upload: {
          megabitsPerSecond: ulResult.mbps,
          totalMB: parseFloat((ulResult.bytes / 1_048_576).toFixed(2)),
          elapsed: ulResult.elapsed,
        },
        ping: pingResult,
        server: { name: 'Local Gateway', location: window.location.hostname },
      };
      setFinalResult(result);

      toast({
        title: 'Speed Test Complete',
        description: `↓ ${dlResult.mbps} Mbps | ↑ ${ulResult.mbps} Mbps | ⚡ ${pingResult.latency} ms`,
      });
    } catch (err: unknown) {
      if (signal.aborted) return;
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Speed test failed';
      setErrorMsg(msg);
      toast({ title: 'Speed Test Failed', description: msg, variant: 'destructive' });
    }
  }, [toast]);

  const isRunning = ['starting', 'ping', 'download', 'upload'].includes(phase);
  const isComplete = phase === 'complete';

  const phaseLabel: Record<string, string> = {
    starting: 'Initializing...',
    ping: 'Testing Ping',
    download: 'Testing Download',
    upload: 'Testing Upload',
    complete: 'Complete',
    error: 'Error',
    idle: '',
  };

  const download = finalResult?.download as Record<string, unknown> | null;
  const upload = finalResult?.upload as Record<string, unknown> | null;
  const ping = finalResult?.ping as Record<string, unknown> | null;
  const server = finalResult?.server as Record<string, unknown> | null;
  const dlMbps = download ? Number(download.megabitsPerSecond ?? 0) : 0;
  const ulMbps = upload ? Number(upload.megabitsPerSecond ?? 0) : 0;
  const pingLat = ping ? Number(ping.latency ?? 0) : 0;
  const pingJit = ping ? Number(ping.jitter ?? 0) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Gauge} title="Speed Test" description="Real-time bandwidth test — measures browser ↔ gateway speed" gradient="from-orange-500 to-red-500" />

        <div className="flex items-center gap-3">
          <RunButton loading={isRunning} onClick={startTest} label={isRunning ? 'Testing...' : 'Start Speed Test'} disabled={isRunning} />
          {isComplete && <Badge variant="outline" className="text-[10px] ml-1">Gateway Bandwidth Test</Badge>}
        </div>

        {errorMsg && <ErrorBox message={errorMsg} />}

        {/* ── Live Gauge ── */}
        {(isRunning || isComplete) && (
          <div className="mt-6">
            <SpeedGauge
              speed={displaySpeed}
              maxScale={maxScale}
              phase={phase}
              pingMs={pingData?.latency}
            />

            {/* Phase badge */}
            <div className="text-center mt-1">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs transition-colors',
                  phase === 'download' && !isTransitioning && 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
                  phase === 'upload' && !isTransitioning && 'border-orange-500/50 text-orange-600 dark:text-orange-400',
                  phase === 'ping' && 'border-cyan-500/50 text-cyan-600 dark:text-cyan-400',
                  phase === 'complete' && 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
                  isTransitioning && 'border-amber-500/50 text-amber-600 dark:text-amber-400',
                )}
              >
                {isTransitioning ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {phase === 'download' ? 'Finishing download...' : 'Preparing upload...'}
                  </span>
                ) : (
                  <>
                    {phase === 'ping' && '⚡ '}{phase === 'download' && '↓ '}{phase === 'upload' && '↑ '}
                    {phaseLabel[phase] || ''}
                    {isRunning && phase !== 'starting' && phase !== 'idle' && ` — ${Math.round(progress * 100)}%`}
                  </>
                )}
              </Badge>
            </div>

            {/* Ping info */}
            {pingData && !isComplete && (
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Ping: <strong className="text-foreground tabular-nums">{pingData.latency.toFixed(1)} ms</strong></span>
                <span>Jitter: <strong className="text-foreground tabular-nums">{pingData.jitter.toFixed(1)} ms</strong></span>
              </div>
            )}
          </div>
        )}

        {/* ── Final Results ── */}
        {isComplete && finalResult && !errorMsg && (
          <div className="mt-6 space-y-5">
            {/* 3-card metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Download</span>
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{dlMbps.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">Mbps</span>
                </div>
                {download && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-mono tabular-nums">
                    {String(download.totalMB)} MB in {String(download.elapsed)}s
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Upload className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload</span>
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{ulMbps.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">Mbps</span>
                </div>
                {upload && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-mono tabular-nums">
                    {String(upload.totalMB)} MB in {String(upload.elapsed)}s
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ping</span>
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-3xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{pingLat.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">ms</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 font-mono tabular-nums">
                  Jitter: {pingJit.toFixed(1)} ms
                </p>
              </div>
            </div>

            {/* Server info */}
            {server && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Test Server</p>
                    <p className="text-xs font-medium mt-1 truncate">{String(server.name)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{String(server.location)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Test Type</p>
                    <p className="text-xs font-medium mt-1">Browser ↔ Gateway</p>
                    <p className="text-[10px] text-muted-foreground">Measures actual guest WiFi bandwidth</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── External Speed Tests (for internet speed) ── */}
        <Separator className="my-5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            External Internet Speed Tests
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Test your gateway&apos;s internet connection speed with these real-world services. Opens in a new tab.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXTERNAL_SPEED_TESTS.map((svc) => {
              const Icon = svc.icon;
              return (
                <Button
                  key={svc.name}
                  size="sm"
                  variant="outline"
                  className={cn('h-8 text-xs gap-1.5')}
                  asChild
                >
                  <a href={svc.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {svc.name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 8: PORT CHECK
// ═══════════════════════════════════════════════════════════════════

function PortCheckTool() {
  const { toast } = useToast();
  const [host, setHost] = useState('8.8.8.8');
  const [port, setPort] = useState('443');
  const [timeout, setTimeout_] = useState('3');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    if (!host.trim() || !port.trim()) return;
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({
        action: 'port-check',
        host: host.trim(),
        port: port.trim(),
        timeout,
      });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        const d = r.data as Record<string, unknown>;
        toast({
          title: `Port ${d.port}: ${String(d.status).toUpperCase()}`,
          description: `Latency: ${d.latency_ms}ms`,
        });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [host, port, timeout, toast]);

  const data = result?.data as Record<string, unknown> | undefined;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Zap} title="Port Check" description="Test TCP connectivity to any host and port — check if a service is reachable" gradient="from-amber-500 to-yellow-500" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Host / IP</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="8.8.8.8"
              className="mt-1 h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Port</Label>
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="443"
              className="mt-1 h-8 text-xs font-mono"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">Timeout (s)</Label>
            <Select value={timeout} onValueChange={setTimeout_}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '5', '10'].map((v) => (
                  <SelectItem key={v} value={v}>{v}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <RunButton loading={state === 'loading'} onClick={run} label="Check Port" />
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && data && (
          <div className="mt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 rounded-xl border bg-muted/30 p-6 text-center">
                {data.status === 'open' ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-2" />
                    <p className="font-semibold text-sm text-primary">
                      OPEN
                    </p>
                  </>
                ) : data.status === 'timeout' ? (
                  <>
                    <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
                    <p className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                      TIMEOUT
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-10 w-10 mx-auto text-red-500 mb-2" />
                    <p className="font-semibold text-sm text-red-600 dark:text-red-400">
                      CLOSED
                    </p>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {String(data.host)}:{String(data.port)}
                </p>
              </div>
              <div className="flex-1 rounded-xl border bg-muted/30 p-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Latency</p>
                <p className="text-2xl font-bold tabular-nums">{data.latency_ms}<span className="text-sm ml-1 font-normal">ms</span></p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 9: CONNECTION TABLE (/proc/net/tcp + tcp6 + udp + udp6)
// ═══════════════════════════════════════════════════════════════════

function ConntrackTool() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [viewTab, setViewTab] = useState<'tcp' | 'udp'>('tcp');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({ action: 'conntrack' });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({ title: 'Connection Table Loaded', description: `${json.data?.total || 0} total connections` });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [search, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const allConnections = (data?.connections as Array<Record<string, unknown>>) || [];
  const udpConnections = (data?.udpConnections as Array<Record<string, unknown>>) || [];
  const stateCounts = (data?.stateCounts as Record<string, number>) || {};

  const VISIBLE_STATES = ['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'LISTEN', 'SYN_RECV', 'SYN_SENT'];

  // Get combined list based on tab
  const getBaseRows = () => {
    if (viewTab === 'tcp') return allConnections;
    return udpConnections;
  };

  // Apply filters
  const getFilteredRows = () => {
    let rows = getBaseRows();

    // State filter: only show visible states
    rows = rows.filter((r) => VISIBLE_STATES.includes(String(r.state || '').toUpperCase()));

    // State dropdown filter
    if (stateFilter !== 'all') {
      rows = rows.filter((r) => String(r.state).toUpperCase() === stateFilter);
    }

    return rows;
  };

  const displayRows = getFilteredRows();

  const getStateBadge = (connState: string) => {
    switch (connState) {
      case 'ESTABLISHED': return <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-[10px]">{connState}</Badge>;
      case 'LISTEN': return <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-[10px]">{connState}</Badge>;
      case 'TIME_WAIT': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px]">{connState}</Badge>;
      case 'CLOSE_WAIT': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-[10px]">{connState}</Badge>;
      case 'SYN_SENT': case 'SYN_RECV': return <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white border-0 text-[10px]">{connState}</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{connState}</Badge>;
    }
  };

  // Top talkers: aggregate by source IP
  const topTalkers = (() => {
    const map: Record<string, number> = {};
    const baseRows = getBaseRows();
    for (const row of baseRows) {
      const ip = String(row.localAddress);
      map[ip] = (map[ip] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  })();

  // Connection state bar
  const totalConns = (data?.total as number) || allConnections.length + udpConnections.length;
  const established = stateCounts.ESTABLISHED || 0;
  const listening = stateCounts.LISTEN || 0;
  const timeWait = stateCounts.TIME_WAIT || 0;
  const closeWait = stateCounts.CLOSE_WAIT || 0;
  const synRecv = stateCounts.SYN_RECV || 0;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Activity} title="Connection Table" description="Active TCP + UDP connections — SonicWall-style view with state analysis" gradient="from-slate-500 to-gray-600" />

        {/* Filter bar */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px] max-w-sm">
            <Label className="text-xs">Filter (IP / Port)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="192.168 or :443"
              className="mt-1 h-8 text-xs font-mono"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="mt-1 h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {VISIBLE_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RunButton loading={state === 'loading'} onClick={run} label="Load Connections" />
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && (
          <>
            {/* Header Summary Bar */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs px-3 py-1">
                <span className="text-muted-foreground mr-1">Total</span>
                <span className="font-bold tabular-nums">{totalConns}</span>
              </Badge>
              <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-xs px-3 py-1">
                ESTABLISHED: {established}
              </Badge>
              <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-xs px-3 py-1">
                LISTEN: {listening}
              </Badge>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs px-3 py-1">
                TIME_WAIT: {timeWait}
              </Badge>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-xs px-3 py-1">
                CLOSE_WAIT: {closeWait}
              </Badge>
              <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white border-0 text-xs px-3 py-1">
                SYN_RECV: {synRecv}
              </Badge>
            </div>

            {/* Utilization Bar */}
            <div className="mt-3 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium mb-3">State Distribution</p>
              <div className="flex h-6 rounded overflow-hidden bg-muted">
                {totalConns > 0 && (
                  <>
                    {established > 0 && (
                      <div className="bg-primary h-full transition-all" style={{ width: `${(established / totalConns) * 100}%` }} title={`ESTABLISHED: ${established}`} />
                    )}
                    {listening > 0 && (
                      <div className="bg-primary h-full transition-all" style={{ width: `${(listening / totalConns) * 100}%` }} title={`LISTEN: ${listening}`} />
                    )}
                    {timeWait > 0 && (
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${(timeWait / totalConns) * 100}%` }} title={`TIME_WAIT: ${timeWait}`} />
                    )}
                    {closeWait > 0 && (
                      <div className="bg-orange-500 h-full transition-all" style={{ width: `${(closeWait / totalConns) * 100}%` }} title={`CLOSE_WAIT: ${closeWait}`} />
                    )}
                    {synRecv > 0 && (
                      <div className="bg-cyan-500 h-full transition-all" style={{ width: `${(synRecv / totalConns) * 100}%` }} title={`SYN_RECV: ${synRecv}`} />
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <span className="text-[10px] flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> ESTABLISHED</span>
                <span className="text-[10px] flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> LISTEN</span>
                <span className="text-[10px] flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> TIME_WAIT</span>
                <span className="text-[10px] flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> CLOSE_WAIT</span>
                <span className="text-[10px] flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500" /> SYN_RECV</span>
              </div>
            </div>

            {/* Summary Stats */}
            <SummaryBar
              items={[
                { label: 'Total TCP', value: String(data?.totalTcp ?? allConnections.length) },
                { label: 'Total UDP', value: String(data?.totalUdp ?? udpConnections.length) },
                { label: 'Source', value: String(data?.source ?? '—') },
              ]}
            />

            {/* TCP/UDP Toggle */}
            <div className="flex gap-2 mt-4">
              <Button variant={viewTab === 'tcp' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => { setViewTab('tcp'); setStateFilter('all'); }}>TCP ({allConnections.length})</Button>
              <Button variant={viewTab === 'udp' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => { setViewTab('udp'); setStateFilter('all'); }}>UDP ({udpConnections.length})</Button>
            </div>

            {/* Connection Table */}
            {displayRows.length > 0 ? (
              <div className="mt-3">
                <div className="rounded-lg border overflow-auto max-h-[500px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] w-14">Proto</TableHead>
                        <TableHead className="text-[10px]">Source IP</TableHead>
                        <TableHead className="text-[10px] w-16">Src Port</TableHead>
                        <TableHead className="text-[10px]">Dest IP</TableHead>
                        <TableHead className="text-[10px] w-16">Dst Port</TableHead>
                        <TableHead className="text-[10px] w-28">State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] font-mono font-medium">{String(e.protocol)}</TableCell>
                          <TableCell className="font-mono text-[11px]">{String(e.localAddress)}</TableCell>
                          <TableCell className="font-mono text-[11px] text-right">{String(e.localPort)}</TableCell>
                          <TableCell className="font-mono text-[11px]">{String(e.remoteAddress)}</TableCell>
                          <TableCell className="font-mono text-[11px] text-right">{String(e.remotePort)}</TableCell>
                          <TableCell>{getStateBadge(String(e.state))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Showing {displayRows.length} filtered {viewTab} connections
                </p>
              </div>
            ) : (
              <div className="mt-4 text-center py-6 text-xs text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No {viewTab} connections found{search ? ` matching "${search}"` : ''}{stateFilter !== 'all' ? ` in ${stateFilter} state` : ''}
              </div>
            )}

            {/* Top Talkers */}
            {topTalkers.length > 0 && (
              <div className="mt-5 rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium mb-3">Top Talkers (by Source IP)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {topTalkers.map(([ip, count], i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                      <span className="font-mono text-[11px] flex-1 truncate">{ip}</span>
                      <Badge variant="outline" className="text-[10px] tabular-nums">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 10: ROUTE TABLE
// ═══════════════════════════════════════════════════════════════════

function RouteTableTool() {
  const { toast } = useToast();
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({ action: 'route-table' });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        toast({ title: 'Route Table Loaded', description: `${json.data?.total || 0} routes` });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const routes = (data?.routes as Array<Record<string, unknown>>) || [];
  const rawOutput = data?.rawOutput as string | undefined;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Route} title="Route Table" description="Display the system routing table — kernel IP routing table entries" gradient="from-primary to-primary/70" />

        <div className="flex items-center gap-2">
          <RunButton loading={state === 'loading'} onClick={run} label="Show Routes" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {result?.success && routes.length > 0 && (
            <Badge variant="outline" className="text-[10px] ml-2">
              {routes.length} routes
            </Badge>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && routes.length > 0 && (
          <div className="mt-4">
            <div className="rounded-lg border overflow-auto max-h-[500px]">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px]">Destination</TableHead>
                    <TableHead className="text-[10px]">Gateway</TableHead>
                    <TableHead className="text-[10px]">Protocol</TableHead>
                    <TableHead className="text-[10px]">Priority/Scope</TableHead>
                    <TableHead className="text-[10px]">Dev</TableHead>
                    <TableHead className="text-[10px] text-right">Metric</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-[11px]">{String(r.destination)}</TableCell>
                      <TableCell className="font-mono text-[11px]">{String(r.gateway || '*')}</TableCell>
                      <TableCell className="text-[11px]">
                        <Badge variant="outline" className="text-[10px]">{String(r.protocol || '—')}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px]">{String(r.scope || '—')}</TableCell>
                      <TableCell className="font-mono text-[11px]">{String(r.dev || r.interface || '—')}</TableCell>
                      <TableCell className="text-[11px] text-right tabular-nums">{String(r.metric ?? '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {result?.success && routes.length === 0 && rawOutput && (
          <TerminalOutput content={rawOutput} label="Route Table Output" />
        )}

        {state === 'done' && routes.length === 0 && !rawOutput && !result?.error && (
          <div className="mt-4 text-center py-8 text-xs text-muted-foreground">
            <Route className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No route table data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 11: INTERFACE STATS
// ═══════════════════════════════════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function InterfaceStatsTool() {
  const { toast } = useToast();
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({ action: 'interface-stats' });
      const res = await fetch(`/api/wifi/diagnostics?${qs}`);
      const json = await res.json();
      const r: ToolResult = {
        success: json.success !== false,
        duration_ms: json.duration_ms || 0,
        data: json.data || {},
        error: json.error,
      };
      setResult(r);
      setState('done');
      if (r.success) {
        const ifaces = json.data?.interfaces as Array<Record<string, unknown>> | undefined;
        toast({ title: 'Interface Stats Loaded', description: `${ifaces?.length || 0} interfaces` });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const hostname = data?.hostname as string | undefined;
  const interfaces = (data?.interfaces as Array<Record<string, unknown>>) || [];

  // Calculate total bytes for bandwidth bars
  const totalRx = interfaces.reduce((sum, iface) => sum + Number(iface.rxBytes || 0), 0);
  const totalTx = interfaces.reduce((sum, iface) => sum + Number(iface.txBytes || 0), 0);

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={HardDrive} title="Interface Stats" description="Network interface statistics — RX/TX bytes, packets, errors, and drops" gradient="from-primary to-primary/70" />

        <div className="flex items-center gap-2">
          <RunButton loading={state === 'loading'} onClick={run} label="Refresh Stats" />
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && hostname && (
          <div className="mt-4">
            <Badge variant="outline" className="text-xs px-3 py-1">
              <span className="text-muted-foreground mr-1">Hostname:</span>
              <span className="font-mono">{hostname}</span>
            </Badge>
          </div>
        )}

        {result?.success && interfaces.length > 0 && (
          <div className="mt-4 space-y-4">
            {interfaces
              .filter((iface) => String(iface.name) !== 'lo')
              .map((iface, i) => {
                const rxBytes = Number(iface.rxBytes || 0);
                const txBytes = Number(iface.txBytes || 0);
                const rxPackets = Number(iface.rxPackets || 0);
                const txPackets = Number(iface.txPackets || 0);
                const rxErrors = Number(iface.rxErrors || 0);
                const txErrors = Number(iface.txErrors || 0);
                const rxDrops = Number(iface.rxDrops || 0);
                const txDrops = Number(iface.txDrops || 0);

                const rxPct = totalRx > 0 ? (rxBytes / totalRx) * 100 : 0;
                const txPct = totalTx > 0 ? (txBytes / totalTx) * 100 : 0;

                return (
                  <div key={i} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold font-mono">{String(iface.name)}</span>
                      {iface.operstate && (
                        <Badge variant={String(iface.operstate) === 'UP' ? 'default' : 'outline'} className="text-[10px] ml-1">
                          {String(iface.operstate)}
                        </Badge>
                      )}
                    </div>

                    {/* Bandwidth bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* RX */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                          RX (Receive)
                        </p>
                        <div className="space-y-1.5">
                          <div>
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span className="text-muted-foreground">Bytes</span>
                              <span className="font-mono tabular-nums">{formatBytes(rxBytes)}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(rxPct, 0.5)}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                            <div><span className="text-muted-foreground">Packets:</span> <span className="font-mono tabular-nums">{rxPackets.toLocaleString()}</span></div>
                            <div><span className="text-muted-foreground">Errors:</span> <span className={cn('font-mono tabular-nums', rxErrors > 0 ? 'text-red-500' : '')}>{rxErrors}</span></div>
                            <div><span className="text-muted-foreground">Drops:</span> <span className={cn('font-mono tabular-nums', rxDrops > 0 ? 'text-red-500' : '')}>{rxDrops}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* TX */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                          TX (Transmit)
                        </p>
                        <div className="space-y-1.5">
                          <div>
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span className="text-muted-foreground">Bytes</span>
                              <span className="font-mono tabular-nums">{formatBytes(txBytes)}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.max(txPct, 0.5)}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                            <div><span className="text-muted-foreground">Packets:</span> <span className="font-mono tabular-nums">{txPackets.toLocaleString()}</span></div>
                            <div><span className="text-muted-foreground">Errors:</span> <span className={cn('font-mono tabular-nums', txErrors > 0 ? 'text-red-500' : '')}>{txErrors}</span></div>
                            <div><span className="text-muted-foreground">Drops:</span> <span className={cn('font-mono tabular-nums', txDrops > 0 ? 'text-red-500' : '')}>{txDrops}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {result?.success && interfaces.length === 0 && (
          <div className="mt-4 text-center py-8 text-xs text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No interface data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tool 12: SERVER CONSOLE (WebSocket + xterm.js)
// ═══════════════════════════════════════════════════════════════════

function ServerConsoleTool() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null);
  const termInstanceRef = useRef<import('@xterm/xterm').Terminal | null>(null);

  const connectTerminal = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true);

    try {
      // Dynamic imports for xterm
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { io } = await import('socket.io-client');

      // Import xterm CSS
      await import('@xterm/xterm/css/xterm.css');

      // Clear existing terminal
      if (termRef.current) {
        termRef.current.innerHTML = '';
      }

      // Create terminal
      const term = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#d4d4d8',
          cursor: '#10b981',
          cursorAccent: '#0a0a0f',
          selectionBackground: 'rgba(20, 184, 166, 0.3)',
          black: '#0a0a0f',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#d4d4d8',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#f4f4f5',
        },
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      termInstanceRef.current = term;

      if (termRef.current) {
        term.open(termRef.current);
        // Delay fit slightly to ensure container is sized
        setTimeout(() => fitAddon.fit(), 100);
      }

      term.writeln('\x1b[90mConnecting to server console...\x1b[0m');

      // Connect socket.io
      const socket = io('/?XTransformPort=3025', {
        transports: ['websocket'],
        reconnection: false,
        timeout: 10000,
      });
      socketRef.current = socket as ReturnType<typeof import('socket.io-client').io>;

      socket.on('connect', () => {
        setConnected(true);
        setConnecting(false);
        term.writeln('\x1b[32m✓ Connected to server console\x1b[0m\r\n');

        // Send initial resize
        setTimeout(() => {
          try {
            fitAddon.fit();
            socket.emit('resize', { cols: term.cols, rows: term.rows });
          } catch { /* ignore */ }
        }, 200);
      });

      socket.on('output', (data: string) => {
        term.write(data);
      });

      socket.on('exit', (code: number) => {
        term.writeln(`\r\n\x1b[33m⚠ Shell exited with code ${code}\x1b[0m`);
        setConnected(false);
        socket.disconnect();
      });

      socket.on('disconnect', (reason: string) => {
        term.writeln(`\r\n\x1b[31m✗ Disconnected: ${reason}\x1b[0m`);
        setConnected(false);
      });

      socket.on('connect_error', (err: Error) => {
        term.writeln(`\r\n\x1b[31m✗ Connection failed: ${err.message}\x1b[0m`);
        setConnected(false);
        setConnecting(false);
      });

      // User input → send to server
      term.onData((input: string) => {
        if (socket.connected) {
          socket.emit('input', input);
        }
      });

      // Handle resize
      term.onResize(({ cols, rows }) => {
        if (socket.connected) {
          socket.emit('resize', { cols, rows });
        }
      });

      // Handle window resize
      const handleResize = () => {
        try { fitAddon.fit(); } catch { /* ignore */ }
      };
      window.addEventListener('resize', handleResize);

      // Store cleanup
      (termRef.current as unknown as Record<string, unknown>).__cleanup = () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
        socket.disconnect();
      };
    } catch (err) {
      setConnecting(false);
      console.error('Failed to connect terminal:', err);
    }
  }, [connected, connecting]);

  const disconnectTerminal = useCallback(() => {
    if (termRef.current && (termRef.current as unknown as Record<string, unknown>).__cleanup) {
      (termRef.current as unknown as Record<string, unknown>).__cleanup();
    }
    socketRef.current?.disconnect();
    termInstanceRef.current?.dispose();
    setConnected(false);
  }, []);

  const reconnectTerminal = useCallback(() => {
    disconnectTerminal();
    setTimeout(() => connectTerminal(), 300);
  }, [disconnectTerminal, connectTerminal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (termRef.current && (termRef.current as unknown as Record<string, unknown>).__cleanup) {
        (termRef.current as unknown as Record<string, unknown>).__cleanup();
      }
      socketRef.current?.disconnect();
      termInstanceRef.current?.dispose();
    };
  }, []);

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Terminal} title="Server Console" description="WebSocket-based terminal with real-time shell access to the gateway" gradient="from-slate-700 to-slate-900" />

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="h-8 px-4"
            disabled={connected || connecting}
            onClick={connectTerminal}
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Connect
              </>
            )}
          </Button>
          {connected && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={reconnectTerminal}
            >
              Reconnect
            </Button>
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] ml-1',
              connected && 'border-primary/50 text-primary bg-primary/5 dark:bg-primary/5',
              connecting && 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20',
              !connected && !connecting && 'border-slate-400/50 text-slate-500',
            )}
          >
            <span className={cn(
              'h-1.5 w-1.5 rounded-full mr-1.5',
              connected && 'bg-emerald-500',
              connecting && 'bg-amber-500 animate-pulse',
              !connected && !connecting && 'bg-slate-400',
            )} />
            {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
          </Badge>
        </div>

        <div className="mt-4">
          <div
            ref={termRef}
            className="w-full rounded-lg border border-slate-800 overflow-hidden"
            style={{
              height: '400px',
              minHeight: '400px',
              background: '#0a0a0f',
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Component — Tabbed interface
// ═══════════════════════════════════════════════════════════════════

const TOOLS = [
  { id: 'ping', label: 'Ping', icon: CircleDot },
  { id: 'traceroute', label: 'Traceroute', icon: Network },
  { id: 'dns-lookup', label: 'DNS Lookup', icon: Globe },
  { id: 'arp-table', label: 'ARP Table', icon: Hash },
  { id: 'network-scan', label: 'Network Scan', icon: Radar },
  { id: 'packet-capture', label: 'Packet Capture', icon: Shield },
  { id: 'speed-test', label: 'Speed Test', icon: Gauge },
  { id: 'port-check', label: 'Port Check', icon: Zap },
  { id: 'connections', label: 'Connections', icon: Activity },
  { id: 'route-table', label: 'Route Table', icon: Route },
  { id: 'interface-stats', label: 'Interfaces', icon: HardDrive },
  { id: 'server-console', label: 'Console', icon: Terminal },
];

export default function GatewayDiagnostics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Gateway Diagnostics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Network troubleshooting tools — ping, traceroute, DNS, ARP, packet capture, speed test, console
        </p>
      </div>

      {/* Tool Tabs */}
      <Tabs defaultValue="ping" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <TabsTrigger
                key={tool.id}
                value={tool.id}
                className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tool.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab: Ping */}
        <TabsContent value="ping" className="mt-4">
          <PingTool />
        </TabsContent>

        {/* Tab: Traceroute */}
        <TabsContent value="traceroute" className="mt-4">
          <TracerouteTool />
        </TabsContent>

        {/* Tab: DNS Lookup */}
        <TabsContent value="dns-lookup" className="mt-4">
          <DnsLookupTool />
        </TabsContent>

        {/* Tab: ARP Table */}
        <TabsContent value="arp-table" className="mt-4">
          <ArpTableTool />
        </TabsContent>

        {/* Tab: Network Scan */}
        <TabsContent value="network-scan" className="mt-4">
          <NetworkScanTool />
        </TabsContent>

        {/* Tab: Packet Capture */}
        <TabsContent value="packet-capture" className="mt-4">
          <PacketCaptureTool />
        </TabsContent>

        {/* Tab: Speed Test */}
        <TabsContent value="speed-test" className="mt-4">
          <SpeedTestTool />
        </TabsContent>

        {/* Tab: Port Check */}
        <TabsContent value="port-check" className="mt-4">
          <PortCheckTool />
        </TabsContent>

        {/* Tab: Connections */}
        <TabsContent value="connections" className="mt-4">
          <ConntrackTool />
        </TabsContent>

        {/* Tab: Route Table */}
        <TabsContent value="route-table" className="mt-4">
          <RouteTableTool />
        </TabsContent>

        {/* Tab: Interface Stats */}
        <TabsContent value="interface-stats" className="mt-4">
          <InterfaceStatsTool />
        </TabsContent>

        {/* Tab: Server Console */}
        <TabsContent value="server-console" className="mt-4">
          <ServerConsoleTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}

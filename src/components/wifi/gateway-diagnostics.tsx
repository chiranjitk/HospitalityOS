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

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
  Download,
  Gauge,
  Globe,
  Hash,
  Loader2,
  Network,
  Play,
  Radar,
  Search,
  Shield,
  Terminal,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
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
        <pre className="p-4 text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap break-all">
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
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <ToolHeader icon={CircleDot} title="Live Ping" description="Send ICMP echo requests to test host reachability and measure latency" gradient="from-teal-500 to-emerald-600" />

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
                    ? 'text-emerald-600 dark:text-emerald-400'
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
                    <TableCell className="text-right text-xs tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                      {p.rtt} ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        <ToolHeader icon={Globe} title="DNS Lookup" description="Query DNS records (A, AAAA, CNAME, MX, NS, TXT, SOA) from any DNS server" gradient="from-cyan-500 to-teal-600" />

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

  const data = result?.data as Record<string, unknown> | undefined;
  const entries = (data?.entries as Array<Record<string, unknown>>) || [];

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Hash} title="ARP Table" description="View the system ARP cache — MAC to IP address mappings from the gateway" gradient="from-emerald-500 to-cyan-600" />

        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
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
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {entries.length > 0 && (
          <div className="mt-4">
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
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium">{aliveHosts.length} hosts alive</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
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
  }, [iface, filter, duration, count, toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const packets = (data?.packets as string[]) || [];

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

        <div className="flex items-center gap-2 mt-4">
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
            ]}
          />
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
// Tool 7: SPEED TEST — Upload + Download
// ═══════════════════════════════════════════════════════════════════

function SpeedTestTool() {
  const { toast } = useToast();
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const qs = new URLSearchParams({ action: 'speed-test' });
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
        const dl = (json.data?.download as Record<string, unknown>) || null;
        const ul = (json.data?.upload as Record<string, unknown>) || null;
        const parts: string[] = [];
        if (dl && !dl.error) parts.push(`↓ ${dl.megabitsPerSecond} Mbps`);
        if (ul && !ul.error) parts.push(`↑ ${ul.megabitsPerSecond} Mbps`);
        toast({ title: 'Speed Test Complete', description: parts.length > 0 ? parts.join(' | ') : 'No results' });
      } else {
        toast({ title: 'Speed Test Failed', description: r.error, variant: 'destructive' });
      }
    } catch {
      setState('done');
      setResult({ success: false, duration_ms: 0, data: {}, error: 'Network error' });
    }
  }, [toast]);

  const data = result?.data as Record<string, unknown> | undefined;
  const download = data?.download as Record<string, unknown> | null;
  const upload = data?.upload as Record<string, unknown> | null;
  const dlMbps = download ? Number(download.megabitsPerSecond ?? 0) : 0;
  const ulMbps = upload ? Number(upload.megabitsPerSecond ?? 0) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Gauge} title="Speed Test" description="Real upload + download throughput measurement from public test servers" gradient="from-orange-500 to-red-500" />

        <div className="flex items-center gap-3">
          <RunButton loading={state === 'loading'} onClick={run} label="Start Speed Test" />
          {result && <DurationBadge ms={result.duration_ms} />}
          {state === 'loading' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Testing download + upload...
            </span>
          )}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {state === 'loading' && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><Download className="h-3 w-3" /> Download</span>
                <span className="font-medium">Testing...</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><Upload className="h-3 w-3" /> Upload</span>
                <span className="font-medium">Testing...</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {result?.success && (download || upload) && (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Download */}
              <div className="rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="h-4 w-4 text-teal-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Download</span>
                  {download?.error ? <Badge variant="destructive" className="text-[10px] ml-auto">Failed</Badge> : null}
                </div>
                {download && !download.error ? (
                  <>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold tabular-nums text-teal-600 dark:text-teal-400">{dlMbps.toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground mb-0.5">Mbps</span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex justify-between"><span>Downloaded</span><span className="font-mono tabular-nums">{String(download.totalMB)} MB</span></div>
                      <div className="flex justify-between"><span>Time</span><span className="font-mono tabular-nums">{download.durationSeconds}s</span></div>
                      <div className="flex justify-between"><span>Server</span><span>{String(download.server)}</span></div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-red-500">{String(download?.error || 'Download test unavailable')}</p>
                )}
              </div>

              {/* Upload */}
              <div className="rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload</span>
                  {upload?.error ? <Badge variant="destructive" className="text-[10px] ml-auto">Failed</Badge> : null}
                </div>
                {upload && !upload.error ? (
                  <>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{ulMbps.toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground mb-0.5">Mbps</span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex justify-between"><span>Uploaded</span><span className="font-mono tabular-nums">{String(upload.totalMB)} MB</span></div>
                      <div className="flex justify-between"><span>Time</span><span className="font-mono tabular-nums">{upload.durationSeconds}s</span></div>
                      <div className="flex justify-between"><span>Server</span><span>{String(upload.server)}</span></div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-red-500">{String(upload?.error || 'Upload test unavailable')}</p>
                )}
              </div>
            </div>
          </div>
        )}
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
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
                    <p className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
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
  const connections = (data?.connections as Array<Record<string, unknown>>) || [];
  const udpConnections = (data?.udpConnections as Array<Record<string, unknown>>) || [];
  const stateCounts = (data?.stateCounts as Record<string, number>) || {};

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'ESTABLISHED': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">{state}</Badge>;
      case 'LISTEN': return <Badge className="bg-teal-500 hover:bg-teal-600 text-white border-0 text-[10px]">{state}</Badge>;
      case 'TIME_WAIT': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px]">{state}</Badge>;
      case 'CLOSE_WAIT': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-[10px]">{state}</Badge>;
      case 'SYN_SENT': case 'SYN_RECV': return <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white border-0 text-[10px]">{state}</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{state}</Badge>;
    }
  };

  const displayRows = viewTab === 'tcp' ? connections : udpConnections;
  const maxRows = 200;
  const shownRows = displayRows.slice(0, maxRows);

  return (
    <Card>
      <CardContent className="p-5">
        <ToolHeader icon={Activity} title="Connection Table" description="All active TCP + UDP connections from /proc/net (no root required)" gradient="from-slate-500 to-gray-600" />

        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <Label className="text-xs">Filter (IP / Port / State)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="192.168 or ESTABLISHED or :443"
              className="mt-1 h-8 text-xs font-mono"
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <RunButton loading={state === 'loading'} onClick={run} label="Load Connections" />
          {result && <DurationBadge ms={result.duration_ms} />}
        </div>

        {result?.error && <ErrorBox message={result.error} />}

        {result?.success && (
          <>
            <SummaryBar
              items={[
                { label: 'TCP', value: String(data?.totalTcp ?? 0) },
                { label: 'UDP', value: String(data?.totalUdp ?? 0) },
                { label: 'Total', value: String(data?.total ?? 0) },
                { label: 'Source', value: String(data?.source ?? '—') },
              ]}
            />

            {Object.keys(stateCounts).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stateCounts).map(([state, count]) => (
                  <Badge key={state} variant="outline" className="text-[10px]">{state}: {count}</Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button variant={viewTab === 'tcp' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setViewTab('tcp')}>TCP ({connections.length})</Button>
              <Button variant={viewTab === 'udp' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setViewTab('udp')}>UDP ({udpConnections.length})</Button>
            </div>

            {shownRows.length > 0 ? (
              <div className="mt-3">
                <div className="rounded-lg border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px]">Proto</TableHead>
                        <TableHead className="text-[10px]">Local</TableHead>
                        <TableHead className="text-[10px]">Remote</TableHead>
                        <TableHead className="text-[10px]">State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shownRows.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] font-mono font-medium">{String(e.protocol)}</TableCell>
                          <TableCell className="font-mono text-[11px]">{String(e.localAddress)}:{String(e.localPort)}</TableCell>
                          <TableCell className="font-mono text-[11px]">{String(e.remoteAddress)}:{String(e.remotePort)}</TableCell>
                          <TableCell>{getStateBadge(String(e.state))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {displayRows.length > maxRows && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Showing {maxRows} of {displayRows.length} {viewTab} connections. Use filter to narrow down.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center py-6 text-xs text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No {viewTab} connections found{search ? ` matching "${search}"` : ''}
              </div>
            )}
          </>
        )}
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
  { id: 'conntrack', label: 'Connections', icon: Activity },
];

export default function GatewayDiagnostics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Gateway Diagnostics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Network troubleshooting tools — ping, traceroute, DNS, ARP, packet capture, speed test
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

        {/* Tab: Conntrack */}
        <TabsContent value="conntrack" className="mt-4">
          <ConntrackTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}

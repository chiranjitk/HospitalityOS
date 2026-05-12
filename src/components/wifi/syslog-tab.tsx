'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
// Table components available: Table, TableBody, TableCell, TableHead, TableHeader, TableRow
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Server,
  Plus,
  Pencil,
  Trash2,
  Send,
  Radio,
  Wifi,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ==================== TYPES ====================

interface SyslogServer {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'udp' | 'tcp' | 'tls';
  format: string;
  formatRaw: string;
  facility: string;
  severity: string;
  categories: string[];
  status: 'connected' | 'disconnected';
  enabled: boolean;
  tlsVerify: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SyslogEntry {
  id: string;
  timestamp: string;
  severity: string;
  facility: string;
  host: string;
  app: string;
  message: string;
  raw: string;
}

// API may return entries as strings (raw syslog lines) or objects
function normalizeEntries(raw: any[]): SyslogEntry[] {
  return raw.map((e, i) => {
    if (typeof e === 'string') {
      return { id: `entry-${i}`, timestamp: '', severity: 'info', facility: '', host: '', app: '', message: '', raw: e };
    }
    return {
      id: e.id || `entry-${i}`,
      timestamp: e.timestamp || '',
      severity: e.severity || '',
      facility: e.facility || '',
      host: e.host || '',
      app: e.app || '',
      message: e.message || '',
      raw: e.raw || e.message || JSON.stringify(e),
    };
  });
}

interface ServerFormData {
  name: string;
  host: string;
  port: number;
  protocol: 'udp' | 'tcp' | 'tls';
  formatRaw: string;
  facility: string;
  severity: string;
  categories: string[];
  enabled: boolean;
}

interface BridgeHealth {
  status: string;
  uptime: string;
  version: string;
  connections: number;
}

// ==================== CONSTANTS ====================

const EMPTY_FORM: ServerFormData = {
  name: '',
  host: '',
  port: 514,
  protocol: 'udp',
  formatRaw: 'ietf',
  facility: 'local0',
  severity: 'info',
  categories: ['nat'],
  enabled: true,
};

const PROTOCOL_OPTIONS = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'ietf', label: 'RFC 5424 (IETF)' },
  { value: 'bsd', label: 'RFC 3164 (BSD)' },
  { value: 'json', label: 'JSON' },
] as const;

const FACILITY_OPTIONS = [
  { value: 'local0', label: 'LOCAL0' },
  { value: 'local1', label: 'LOCAL1' },
  { value: 'local2', label: 'LOCAL2' },
  { value: 'local3', label: 'LOCAL3' },
  { value: 'local4', label: 'LOCAL4' },
  { value: 'local5', label: 'LOCAL5' },
  { value: 'local6', label: 'LOCAL6' },
  { value: 'local7', label: 'LOCAL7' },
  { value: 'auth', label: 'AUTH' },
  { value: 'daemon', label: 'DAEMON' },
  { value: 'user', label: 'USER' },
  { value: 'syslog', label: 'SYSLOG' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'emerg', label: 'Emergency (0)' },
  { value: 'alert', label: 'Alert (1)' },
  { value: 'crit', label: 'Critical (2)' },
  { value: 'error', label: 'Error (3)' },
  { value: 'warning', label: 'Warning (4)' },
  { value: 'notice', label: 'Notice (5)' },
  { value: 'info', label: 'Informational (6)' },
  { value: 'debug', label: 'Debug (7)' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'nat', label: 'NAT Logs', description: 'Source/destination NAT, bytes, packets, connection tracking' },
  { value: 'sni', label: 'SNI / DNS', description: 'Domain names from TLS SNI and DNS queries' },
  { value: 'auth', label: 'Auth', description: 'RADIUS authentication & authorization events' },
  { value: 'firewall', label: 'Firewall', description: 'Firewall rule hit/allow/deny events' },
  { value: 'dhcp', label: 'DHCP', description: 'DHCP lease requests, renewals, releases' },
  { value: 'portal', label: 'Portal', description: 'Captive portal login/logout events' },
  { value: 'system', label: 'System', description: 'Gateway health, service status, errors' },
] as const;

const FORMAT_DISPLAY: Record<string, string> = {
  ietf: 'RFC5424',
  bsd: 'RFC3164',
  json: 'JSON',
};

const SEVERITY_COLORS: Record<string, string> = {
  emerg: 'bg-red-600 text-white',
  alert: 'bg-red-500 text-white',
  crit: 'bg-orange-500 text-white',
  error: 'bg-red-400 text-white',
  warning: 'bg-amber-500 text-white',
  notice: 'bg-sky-500 text-white',
  info: 'bg-slate-500 text-white',
  debug: 'bg-gray-400 text-white',
};

// ==================== PROTOCOL BADGE ====================

function ProtocolBadge({ protocol }: { protocol: string }) {
  switch (protocol) {
    case 'udp':
      return (
        <Badge variant="outline" className="text-xs font-medium">
          UDP
        </Badge>
      );
    case 'tcp':
      return (
        <Badge variant="default" className="text-xs font-medium bg-slate-700 hover:bg-slate-700">
          TCP
        </Badge>
      );
    case 'tls':
      return (
        <Badge variant="secondary" className="text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">
          <Lock className="h-3 w-3 mr-1" />
          TLS
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{protocol.toUpperCase()}</Badge>;
  }
}

// ==================== FORMAT BADGE ====================

function FormatBadge({ format }: { format: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-mono font-medium',
        format === 'json' && 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
        format === 'bsd' && 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
        format === 'ietf' && 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
      )}
    >
      {FORMAT_DISPLAY[format] || format}
    </Badge>
  );
}

// ==================== MAIN COMPONENT ====================

export default function SyslogTab() {
  const { toast } = useToast();

  // Data state
  const [servers, setServers] = useState<SyslogServer[]>([]);
  const [entries, setEntries] = useState<SyslogEntry[]>([]);
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<SyslogServer | null>(null);
  const [deletingServer, setDeletingServer] = useState<SyslogServer | null>(null);

  // Form state
  const [formData, setFormData] = useState<ServerFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null);

  // Syslog entries visibility
  const [showEntries, setShowEntries] = useState(false);

  // ==================== FETCH DATA ====================

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const res = await fetch('/api/wifi/reports/syslog');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setServers(result.data?.servers || []);
        setEntries(normalizeEntries(result.data?.entries || []));
      } else {
        toast({
          title: 'Failed to load syslog data',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to fetch syslog data:', err);
      toast({
        title: 'Connection Error',
        description: 'Could not reach the syslog API. The conntrack-bridge may be offline.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [toast]);

  const fetchBridgeHealth = useCallback(async () => {
    try {
      const res = await fetch('/?XTransformPort=3020/api/health');
      if (!res.ok) return;
      const result = await res.json();
      setBridgeHealth(result);
    } catch {
      setBridgeHealth(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/wifi/reports/syslog');
        if (cancelled || !res.ok) return;
        const result = await res.json();
        if (cancelled) return;
        if (result.success) {
          setServers(result.data?.servers || []);
          setEntries(normalizeEntries(result.data?.entries || []));
        }
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const res = await fetch('/?XTransformPort=3020/api/health');
        if (cancelled || !res.ok) return;
        const result = await res.json();
        if (!cancelled) setBridgeHealth(result);
      } catch {
        // Bridge health is non-critical
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ==================== COMPUTED VALUES ====================

  const activeServers = servers.filter((s) => s.enabled);
  const isForwardingActive = activeServers.length > 0;

  // ==================== FORM HANDLERS ====================

  function openAddDialog() {
    setEditingServer(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setShowAddDialog(true);
  }

  function openEditDialog(server: SyslogServer) {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      formatRaw: server.formatRaw,
      facility: server.facility,
      severity: server.severity,
      categories: server.categories || [],
      enabled: server.enabled,
    });
    setFormErrors({});
    setShowAddDialog(true);
  }

  function openDeleteDialog(server: SyslogServer) {
    setDeletingServer(server);
    setShowDeleteDialog(true);
  }

  function updateForm<K extends keyof ServerFormData>(key: K, value: ServerFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function toggleCategory(cat: string) {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Server name is required';
    if (!formData.host.trim()) errors.host = 'Host is required';
    if (formData.port < 1 || formData.port > 65535) errors.port = 'Port must be 1-65535';
    if (formData.categories.length === 0) errors.categories = 'Select at least one category';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: formData.port,
        protocol: formData.protocol,
        format: formData.formatRaw,
        facility: formData.facility,
        severity: formData.severity,
        categories: formData.categories,
        enabled: formData.enabled,
      };

      let res: Response;
      if (editingServer) {
        res = await fetch(`/api/wifi/reports/syslog/${editingServer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/wifi/reports/syslog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.success) {
        toast({
          title: editingServer ? 'Server updated' : 'Server created',
          description: `"${formData.name}" has been ${editingServer ? 'updated' : 'added'} successfully.`,
        });
        setShowAddDialog(false);
        setEditingServer(null);
        setFormData(EMPTY_FORM);
        await fetchData();
      } else {
        toast({
          title: 'Operation failed',
          description: result.error || 'Could not save server configuration',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to save server:', err);
      toast({
        title: 'Connection Error',
        description: 'Could not save server configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingServer) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/wifi/reports/syslog/${deletingServer.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        toast({
          title: 'Server deleted',
          description: `"${deletingServer.name}" has been removed.`,
        });
        setShowDeleteDialog(false);
        setDeletingServer(null);
        await fetchData();
      } else {
        toast({
          title: 'Delete failed',
          description: result.error || 'Could not delete server',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to delete server:', err);
      toast({
        title: 'Connection Error',
        description: 'Could not delete server',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleEnabled(server: SyslogServer) {
    try {
      const res = await fetch(`/api/wifi/reports/syslog/${server.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        toast({
          title: server.enabled ? 'Server disabled' : 'Server enabled',
          description: `"${server.name}" is now ${server.enabled ? 'inactive' : 'active'}.`,
        });
        await fetchData();
      } else {
        toast({
          title: 'Toggle failed',
          description: result.error || 'Could not toggle server state',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to toggle server:', err);
      toast({
        title: 'Connection Error',
        description: 'Could not toggle server state',
        variant: 'destructive',
      });
    }
  }

  async function handleTestConnection(server: SyslogServer) {
    setTestingId(server.id);
    try {
      const res = await fetch('/?XTransformPort=3020/api/syslog-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: server.host,
          port: server.port,
          protocol: server.protocol,
          format: server.formatRaw,
          facility: server.facility,
          severity: server.severity,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        toast({
          title: 'Connection successful',
          description: `Test message sent to ${server.host}:${server.port}`,
        });
      } else {
        toast({
          title: 'Connection failed',
          description: result.error || result.message || `Could not reach ${server.host}:${server.port}`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Test connection failed:', err);
      toast({
        title: 'Test failed',
        description: `Could not connect to ${server.host}:${server.port}. The conntrack-bridge may be offline.`,
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  }

  // ==================== RENDER: LOADING STATE ====================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading syslog configuration...</p>
      </div>
    );
  }

  // ==================== RENDER: MAIN ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-2xl font-bold tracking-tight">Syslog Forwarding</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Forward NAT connection logs to external syslog collectors for SIEM integration and IPDR compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchData(true); fetchBridgeHealth(); }}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Servers */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Active Servers</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {activeServers.length}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Servers */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Server className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Total Servers</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                {servers.length}
              </p>
            </div>
          </div>
        </Card>

        {/* Forwarding Status */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-lg',
              isForwardingActive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-gray-500/10 text-gray-400'
            )}>
              <Wifi className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Forwarding Status</p>
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-lg font-bold',
                  isForwardingActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400'
                )}>
                  {isForwardingActive ? 'Active' : 'Inactive'}
                </p>
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  isForwardingActive ? 'bg-emerald-500' : 'bg-gray-300'
                )} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bridge Health Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              bridgeHealth?.status === 'ok'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}>
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Conntrack-Bridge</p>
              <p className="text-xs text-muted-foreground">
                {bridgeHealth?.status === 'ok'
                  ? `Healthy · Uptime ${bridgeHealth.uptime || '—'} · v${bridgeHealth.version || '?'}`
                  : 'Offline or unreachable'}
              </p>
            </div>
          </div>
          {bridgeHealth?.status === 'ok' && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {!bridgeHealth && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
              <XCircle className="h-3 w-3 mr-1" />
              Unreachable
            </Badge>
          )}
        </div>
      </Card>

      {/* Server Cards Grid */}
      {servers.length === 0 ? (
        /* Empty State */
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                <Server className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <Wifi className="h-3 w-3 text-muted-foreground/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-medium text-muted-foreground">
                No syslog servers configured
              </h3>
              <p className="text-sm text-muted-foreground/70 max-w-sm">
                Add a syslog server to start forwarding NAT and connection tracking logs to your SIEM or log collector.
              </p>
            </div>
            <Button onClick={openAddDialog} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Your First Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              testingId={testingId}
              onToggle={() => handleToggleEnabled(server)}
              onEdit={() => openEditDialog(server)}
              onDelete={() => openDeleteDialog(server)}
              onTest={() => handleTestConnection(server)}
            />
          ))}
        </div>
      )}

      {/* Sample Syslog Entries Section */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowEntries(!showEntries)}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Sample Syslog Entries
              </CardTitle>
              <CardDescription>
                {showEntries
                  ? 'Click to collapse'
                  : `${entries.length} recent entries — click to expand`}
              </CardDescription>
            </div>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform duration-200',
                showEntries && 'rotate-180'
              )}
            />
          </div>
        </CardHeader>
        {showEntries && (
          <CardContent>
            {entries.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No sample entries available yet. Entries appear once forwarding is active.
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {entries.slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.id || idx}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {entry.timestamp}
                        </span>
                        {entry.severity && (
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              SEVERITY_COLORS[entry.severity] || 'bg-gray-400 text-white'
                            )}
                          >
                            {entry.severity.toUpperCase()}
                          </Badge>
                        )}
                        {entry.facility && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {entry.facility}
                          </span>
                        )}
                        {entry.host && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {entry.host}
                          </span>
                        )}
                      </div>
                      <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap break-all leading-relaxed bg-background/60 rounded p-2 mt-1.5 border">
                        {entry.raw || entry.message || JSON.stringify(entry, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </Card>

      {/* ==================== ADD/EDIT DIALOG ==================== */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open && saving) return;
        setShowAddDialog(open);
        if (!open) {
          setEditingServer(null);
          setFormErrors({});
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingServer ? (
                <>
                  <Pencil className="h-4 w-4" />
                  Edit Syslog Server
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Syslog Server
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingServer
                ? `Update configuration for "${editingServer.name}"`
                : 'Configure a new syslog server to forward logs to'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="syslog-name">
                  Server Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="syslog-name"
                  placeholder="e.g., Splunk Collector"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className={cn(formErrors.name && 'border-red-400 dark:border-red-600')}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>

              {/* Host and Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="syslog-host">
                    Host <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="syslog-host"
                    placeholder="syslog.example.com or 192.168.1.100"
                    value={formData.host}
                    onChange={(e) => updateForm('host', e.target.value)}
                    className={cn(formErrors.host && 'border-red-400 dark:border-red-600')}
                  />
                  {formErrors.host && (
                    <p className="text-xs text-red-500">{formErrors.host}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="syslog-port">Port</Label>
                  <Input
                    id="syslog-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => updateForm('port', parseInt(e.target.value) || 514)}
                    className={cn(formErrors.port && 'border-red-400 dark:border-red-600')}
                  />
                  {formErrors.port && (
                    <p className="text-xs text-red-500">{formErrors.port}</p>
                  )}
                </div>
              </div>

              {/* Protocol */}
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select
                  value={formData.protocol}
                  onValueChange={(v) => updateForm('protocol', v as ServerFormData['protocol'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select protocol" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          {opt.value === 'tls' && <Lock className="h-3 w-3" />}
                          {opt.label}
                          {opt.value === 'udp' && ' (unencrypted)'}
                          {opt.value === 'tcp' && ' (reliable)'}
                          {opt.value === 'tls' && ' (encrypted)'}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <Label>Log Format</Label>
                <Select
                  value={formData.formatRaw}
                  onValueChange={(v) => updateForm('formatRaw', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Facility */}
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select
                  value={formData.facility}
                  onValueChange={(v) => updateForm('facility', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label>Minimum Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => updateForm('severity', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select minimum severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    Log Categories <span className="text-red-500">*</span>
                  </Label>
                  {formData.categories.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formData.categories.length} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <label
                      key={cat.value}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors',
                        formData.categories.includes(cat.value)
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                      )}
                    >
                      <Checkbox
                        checked={formData.categories.includes(cat.value)}
                        onCheckedChange={() => toggleCategory(cat.value)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium leading-none">{cat.label}</span>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          {cat.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {formErrors.categories && (
                  <p className="text-xs text-red-500">{formErrors.categories}</p>
                )}
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Enable forwarding</Label>
                  <p className="text-xs text-muted-foreground">
                    Start sending logs to this server immediately
                  </p>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => updateForm('enabled', checked)}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {editingServer ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {editingServer ? 'Update Server' : 'Create Server'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open && deleting) return;
        setShowDeleteDialog(open);
        if (!open) setDeletingServer(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Delete Syslog Server
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>Are you sure you want to delete this server?</p>
              <div className="rounded-lg border bg-muted/50 p-3 mt-2">
                <p className="font-medium text-sm">
                  {deletingServer?.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {deletingServer?.host}:{deletingServer?.port}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. All logs for this server will stop forwarding.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletingServer(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Server
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== SERVER CARD ====================

function ServerCard({
  server,
  testingId,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}: {
  server: SyslogServer;
  testingId: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const isTesting = testingId === server.id;

  return (
    <Card className={cn(
      'relative transition-all',
      !server.enabled && 'opacity-60'
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header: Name + Status + Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Status indicator */}
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full flex-shrink-0',
                server.status === 'connected' && server.enabled
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : server.enabled
                    ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                    : 'bg-gray-300'
              )}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{server.name}</h3>
              <p className="text-xs font-mono text-muted-foreground truncate">
                {server.host}:{server.port}
              </p>
            </div>
          </div>
          <Switch
            checked={server.enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${server.name}`}
          />
        </div>

        {/* Protocol + Format badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <ProtocolBadge protocol={server.protocol} />
          <FormatBadge format={server.formatRaw} />
          {server.tlsVerify && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Shield className="h-2.5 w-2.5" />
              TLS Verify
            </Badge>
          )}
        </div>

        {/* Facility + Severity */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Facility:</span>
            <span className="font-mono font-medium">{server.facility}</span>
          </div>
          <Separator orientation="vertical" className="h-3" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Severity:</span>
            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0',
                SEVERITY_COLORS[server.severity] || 'bg-gray-400 text-white'
              )}
            >
              {server.severity.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Categories */}
        {server.categories && server.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {server.categories.map((cat) => {
              const catConfig = CATEGORY_OPTIONS.find((c) => c.value === cat);
              const isNat = cat === 'nat';
              return (
                <Badge
                  key={cat}
                  variant="outline"
                  className={cn(
                    'text-[10px] font-medium',
                    isNat
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                      : 'text-muted-foreground'
                  )}
                >
                  {catConfig?.label || cat}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onTest}
            disabled={isTesting || !server.enabled}
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Send className="h-3 w-3 mr-1" />
            )}
            Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

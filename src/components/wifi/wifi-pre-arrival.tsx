'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  MessageSquare,
  Wifi,
  Clock,
  QrCode,
  Settings,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  Power,
  Zap,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
}

interface PreArrivalConfig {
  id: string;
  tenantId: string;
  propertyId: string;
  enabled: boolean;
  hoursBeforeArrival: number;
  sendEmail: boolean;
  sendSms: boolean;
  emailTemplateId: string | null;
  smsTemplate: string | null;
  includeQrCode: boolean;
  autoGenerateCreds: boolean;
  planId: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
    logo: string | null;
  };
  plan: WiFiPlan | null;
}

interface DeliveryLog {
  id: string;
  guestName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: string;
  status: string;
  subject: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  retryCount: number;
}

interface DeliverySummary {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const HOUR_OPTIONS = [
  { value: 6, label: '6 hours before' },
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
];

const DEFAULT_SMS_TEMPLATE =
  'Your WiFi at {{hotel_name}}: Network: {{ssid}}, Username: {{username}}, Password: {{password}}';

const TEMPLATE_VARIABLES = [
  { key: '{{hotel_name}}', desc: 'Property name' },
  { key: '{{guest_first_name}}', desc: 'Guest first name' },
  { key: '{{guest_last_name}}', desc: 'Guest last name' },
  { key: '{{ssid}}', desc: 'WiFi network name' },
  { key: '{{username}}', desc: 'WiFi username' },
  { key: '{{password}}', desc: 'WiFi password' },
  { key: '{{plan_name}}', desc: 'WiFi plan name' },
  { key: '{{check_in}}', desc: 'Check-in date' },
  { key: '{{check_out}}', desc: 'Check-out date' },
  { key: '{{confirmation_code}}', desc: 'Booking reference' },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function WifiPreArrival() {
  const { toast } = useToast();

  // Data state
  const [configs, setConfigs] = useState<PreArrivalConfig[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // config id being saved

  // Delivery logs state
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsSummary, setLogsSummary] = useState<DeliverySummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logChannelFilter, setLogChannelFilter] = useState<string>('all');

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<PreArrivalConfig | null>(null);

  // ─── Fetch Data ───────────────────────────────────────────────────────

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/pre-arrival');
      const result = await res.json();
      if (result.success) {
        setConfigs(result.data);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast({ title: 'Error', description: 'Failed to load pre-arrival configs', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/plans?status=active');
      const result = await res.json();
      if (result.success) {
        setPlans(result.data);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(logsPage));
      params.append('limit', '15');
      if (logStatusFilter !== 'all') params.append('status', logStatusFilter);
      if (logChannelFilter !== 'all') params.append('channel', logChannelFilter);

      const res = await fetch(`/api/wifi/pre-arrival/delivery-logs?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setLogs(result.data);
        setLogsSummary(result.summary);
        setLogsTotalPages(result.pagination?.totalPages ?? 1);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logStatusFilter, logChannelFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { if (!cancelled) await fetchConfigs(); } catch { /* ignore */ }
      try { if (!cancelled) await fetchPlans(); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchConfigs, fetchPlans]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { if (!cancelled) await fetchLogs(); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchLogs]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleToggleEnabled = async (config: PreArrivalConfig) => {
    setIsSaving(config.id);
    try {
      const res = await fetch(`/api/wifi/pre-arrival/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const result = await res.json();
      if (result.success) {
        setConfigs((prev) =>
          prev.map((c) => (c.id === config.id ? { ...c, enabled: !config.enabled } : c)),
        );
        toast({
          title: config.enabled ? 'Feature Disabled' : 'Feature Enabled',
          description: `Pre-arrival WiFi delivery ${!config.enabled ? 'enabled' : 'disabled'} for ${config.property.name}`,
        });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update config', variant: 'destructive' });
    } finally {
      setIsSaving(null);
    }
  };

  const handleSaveConfig = async (config: PreArrivalConfig, updates: Partial<PreArrivalConfig>) => {
    setIsSaving(config.id);
    try {
      const res = await fetch(`/api/wifi/pre-arrival/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      if (result.success) {
        setConfigs((prev) =>
          prev.map((c) => (c.id === config.id ? { ...c, ...updates } : c)),
        );
        toast({ title: 'Saved', description: `Settings updated for ${config.property.name}` });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save config', variant: 'destructive' });
    } finally {
      setIsSaving(null);
    }
  };

  const handlePreview = (config: PreArrivalConfig) => {
    setPreviewConfig(config);
    setPreviewOpen(true);
  };

  const renderPreviewText = (template: string) => {
    const sampleVars: Record<string, string> = {
      hotel_name: 'Grand Horizon Hotel',
      guest_first_name: 'John',
      guest_last_name: 'Smith',
      ssid: 'GrandHorizon_Guest',
      username: 'guest_john_BK2024X',
      password: 'kT7mNp2qRw',
      plan_name: 'Premium',
      check_in: 'Jun 15',
      check_out: 'Jun 18, 2025',
      confirmation_code: 'BK2024X',
    };
    let result = template;
    for (const [key, value] of Object.entries(sampleVars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  };

  // ─── Stats ────────────────────────────────────────────────────────────

  const totalEnabled = configs.filter((c) => c.enabled).length;
  const totalConfigs = configs.length;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            Pre-Arrival WiFi Credentials
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically send WiFi credentials to guests before check-in
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchConfigs(); fetchLogs(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="p-4 border-0 shadow-sm bg-primary/5 dark:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {logsSummary?.sent ?? 0}
              </div>
              <div className="text-xs text-primary/60 font-medium">
                Total Deliveries Sent
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm bg-primary/5 dark:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {logsSummary?.successRate ?? 0}%
              </div>
              <div className="text-xs text-primary/60 font-medium">
                Delivery Success Rate
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15">
              <Power className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
                {totalEnabled}
                <span className="text-sm font-normal text-cyan-500/70 dark:text-cyan-400/60">
                  /{totalConfigs}
                </span>
              </div>
              <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70 font-medium">
                Properties Enabled
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Configuration Cards ────────────────────────────────────── */}
      {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : configs.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="rounded-full bg-muted/50 p-4 mb-4">
              <Settings className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground">No Pre-Arrival Configs Found</h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-md">
              Configure pre-arrival WiFi credential delivery for each property. Guests will receive their WiFi credentials before check-in.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <PropertyConfigCard
              key={config.id}
              config={config}
              plans={plans}
              isSaving={isSaving === config.id}
              onToggleEnabled={() => handleToggleEnabled(config)}
              onSave={(updates) => handleSaveConfig(config, updates)}
              onPreview={() => handlePreview(config)}
            />
          ))}
        </div>
      )}

      {/* ── Delivery Logs ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Delivery Logs
              </CardTitle>
              <CardDescription className="mt-1">
                Recent pre-arrival credential delivery attempts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={logChannelFilter} onValueChange={setLogChannelFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-3 mb-3">
                <Mail className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">No delivery logs found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Logs will appear here after credentials are sent</p>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-96">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="transition-colors hover:bg-muted/60">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{log.guestName}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.channel === 'email' ? log.recipientEmail : log.recipientPhone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {log.channel === 'email' ? (
                              <Mail className="h-3.5 w-3.5 text-blue-500" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span className="text-sm capitalize">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell>
                          {log.sentAt ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(log.sentAt), 'MMM d, HH:mm')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.errorMessage ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-red-500 dark:text-red-400 cursor-default">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-xs truncate max-w-[180px]">{log.errorMessage}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[300px]">
                                <p className="text-xs">{log.errorMessage}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {logsPage} of {logsTotalPages}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={logsPage <= 1}
                      onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={logsPage >= logsTotalPages}
                      onClick={() => setLogsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Message Preview
            </DialogTitle>
            <DialogDescription>
              Preview how the credential message will look for guests
            </DialogDescription>
          </DialogHeader>
          {previewConfig && (
            <div className="space-y-4 py-2">
              {/* Email Preview */}
              {previewConfig.sendEmail && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-blue-500" />
                    Email Preview
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Subject: Your WiFi Credentials for {previewConfig.property.name}</p>
                    <Separator />
                    <p className="text-sm whitespace-pre-wrap">
                      Dear John,
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {renderPreviewText(previewConfig.smsTemplate || DEFAULT_SMS_TEMPLATE)}
                    </p>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      Enjoy your stay at {previewConfig.property.name}!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Check-in: Jun 15 &middot; Check-out: Jun 18, 2025 &middot; Confirmation: BK2024X
                    </p>
                    {previewConfig.includeQrCode && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        <QrCode className="h-4 w-4" />
                        <span>WiFi QR Code will be attached</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SMS Preview */}
              {previewConfig.sendSms && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    SMS Preview
                  </div>
                  <div className="rounded-lg border bg-primary/5 dark:bg-primary/5 p-4">
                    <div className="rounded-lg bg-white dark:bg-muted p-3 shadow-sm border">
                      <p className="text-sm whitespace-pre-wrap">
                        {renderPreviewText(previewConfig.smsTemplate || DEFAULT_SMS_TEMPLATE)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 text-right">
                        — {previewConfig.property.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Property Config Card ──────────────────────────────────────────────────

interface PropertyConfigCardProps {
  config: PreArrivalConfig;
  plans: WiFiPlan[];
  isSaving: boolean;
  onToggleEnabled: () => void;
  onSave: (updates: Partial<PreArrivalConfig>) => void;
  onPreview: () => void;
}

function PropertyConfigCard({
  config,
  plans,
  isSaving,
  onToggleEnabled,
  onSave,
  onPreview,
}: PropertyConfigCardProps) {
  const [localConfig, setLocalConfig] = useState({ ...config });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync local state from prop
    setLocalConfig({ ...config });
    setHasChanges(false);
  }, [config]);

  const handleChange = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: Partial<PreArrivalConfig> = {};
    if (localConfig.hoursBeforeArrival !== config.hoursBeforeArrival) updates.hoursBeforeArrival = localConfig.hoursBeforeArrival;
    if (localConfig.sendEmail !== config.sendEmail) updates.sendEmail = localConfig.sendEmail;
    if (localConfig.sendSms !== config.sendSms) updates.sendSms = localConfig.sendSms;
    if (localConfig.includeQrCode !== config.includeQrCode) updates.includeQrCode = localConfig.includeQrCode;
    if (localConfig.autoGenerateCreds !== config.autoGenerateCreds) updates.autoGenerateCreds = localConfig.autoGenerateCreds;
    if (localConfig.planId !== config.planId) updates.planId = localConfig.planId;
    if (localConfig.smsTemplate !== config.smsTemplate) updates.smsTemplate = localConfig.smsTemplate;
    onSave(updates);
    setHasChanges(false);
  };

  const hourOption = HOUR_OPTIONS.find((o) => o.value === localConfig.hoursBeforeArrival);

  return (
    <Card className={cn(
      'border transition-all',
      config.enabled
        ? 'border-primary/20 dark:border-primary/20 shadow-sm'
        : 'border-border',
    )}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              config.enabled
                ? 'bg-gradient-to-br from-primary to-primary/70'
                : 'bg-muted',
            )}>
              <Building2 className={cn('h-5 w-5', config.enabled ? 'text-white' : 'text-muted-foreground')} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {config.property.name}
                <StatusBadge status={config.enabled ? 'enabled' : 'disabled'} />
              </CardTitle>
              <CardDescription className="text-xs">
                Created {format(new Date(config.createdAt), 'MMM d, yyyy')}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor={`enabled-${config.id}`} className="text-sm font-medium cursor-pointer">
              {config.enabled ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id={`enabled-${config.id}`}
              checked={config.enabled}
              onCheckedChange={onToggleEnabled}
              disabled={isSaving}
            />
          </div>
        </div>
      </CardHeader>

      {config.enabled && (
        <CardContent className="pt-0 space-y-4">
          <Separator />

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hours Before Arrival */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Hours Before Arrival
              </Label>
              <Select
                value={String(localConfig.hoursBeforeArrival)}
                onValueChange={(v) => handleChange('hoursBeforeArrival', parseInt(v, 10))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default WiFi Plan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" />
                Default WiFi Plan
              </Label>
              <Select
                value={localConfig.planId || 'none'}
                onValueChange={(v) => handleChange('planId', v === 'none' ? null : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use guest default</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.downloadSpeed}/{plan.uploadSpeed} Mbps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ToggleSetting
              icon={<Mail className="h-4 w-4 text-blue-500" />}
              label="Email"
              checked={localConfig.sendEmail}
              onChange={(v) => handleChange('sendEmail', v)}
              disabled={isSaving}
            />
            <ToggleSetting
              icon={<MessageSquare className="h-4 w-4 text-primary" />}
              label="SMS"
              checked={localConfig.sendSms}
              onChange={(v) => handleChange('sendSms', v)}
              disabled={isSaving}
            />
            <ToggleSetting
              icon={<QrCode className="h-4 w-4 text-purple-500" />}
              label="QR Code"
              checked={localConfig.includeQrCode}
              onChange={(v) => handleChange('includeQrCode', v)}
              disabled={isSaving}
            />
            <ToggleSetting
              icon={<Zap className="h-4 w-4 text-amber-500" />}
              label="Auto-Generate"
              checked={localConfig.autoGenerateCreds}
              onChange={(v) => handleChange('autoGenerateCreds', v)}
              disabled={isSaving}
            />
          </div>

          {/* SMS Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                SMS / Email Template
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Available Variables:</p>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <p key={v.key} className="text-xs">
                        <code className="bg-muted px-1 rounded">{v.key}</code> — {v.desc}
                      </p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={localConfig.smsTemplate || ''}
              onChange={(e) => handleChange('smsTemplate', e.target.value)}
              placeholder={DEFAULT_SMS_TEMPLATE}
              rows={2}
              className="text-sm resize-none font-mono"
            />
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.slice(0, 5).map((v) => (
                <Badge key={v.key} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                  {v.key}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="text-primary hover:text-primary/80 gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview Message
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Toggle Setting ───────────────────────────────────────────────────────

function ToggleSetting({
  icon,
  label,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    sent: {
      color: 'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground',
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
    },
    enabled: {
      color: 'bg-primary text-primary-foreground',
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
    },
    failed: {
      color: 'bg-gradient-to-r from-red-500 to-rose-500 text-white',
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
    },
    pending: {
      color: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
      icon: <Clock className="h-3 w-3 mr-1" />,
    },
    disabled: {
      color: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
      icon: <EyeOff className="h-3 w-3 mr-1" />,
    },
  };

  const variant = variants[status] || variants.pending;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge variant="secondary" className={cn('text-[11px] gap-0.5 px-2 py-0.5', variant.color)}>
      {variant.icon}
      {label}
    </Badge>
  );
}

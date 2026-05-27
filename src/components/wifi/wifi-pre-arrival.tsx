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
  AlertCircle,
  Loader2,
  Building2,
  RefreshCw,
  Eye,
  BarChart3,
  TrendingUp,
  Power,
  Zap,
  Info,
  CheckCircle2,
  Smartphone,
  Plus,
  ChevronDown,
  ChevronUp,
  Users,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
}

interface PropertyInfo {
  id: string;
  name: string;
  logo: string | null;
  city?: string | null;
  country?: string | null;
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
  property: PropertyInfo;
  plan: WiFiPlan | null;
}

interface PropertyWithConfig {
  property: PropertyInfo;
  config: PreArrivalConfig | null;
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

interface AdapterStatus {
  email: { configured: boolean; provider: string | null; name: string | null };
  sms: { configured: boolean; provider: string | null; name: string | null };
}

interface EligibleBooking {
  id: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  propertyName: string;
  wifiUser: { username: string; status: string } | null;
}

interface EligibleBookingsData {
  eligible: EligibleBooking[];
  alreadySent: { id: string; confirmationCode: string; guestName: string; wifiUser: { username: string } | null }[];
  deliveryWindow: { hoursBefore: number; from: string; to: string };
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
  const [properties, setProperties] = useState<PropertyWithConfig[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  // Adapter status state
  const [adapterStatus, setAdapterStatus] = useState<AdapterStatus | null>(null);

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

  // Send Now dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogProperty, setSendDialogProperty] = useState<PreArrivalConfig | null>(null);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleBookingsData | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [sendingBookingId, setSendingBookingId] = useState<string | null>(null);

  // ─── Derived Stats ────────────────────────────────────────────────────

  const configuredProperties = properties.filter((p) => p.config !== null);
  const enabledProperties = properties.filter((p) => p.config?.enabled);
  const unconfiguredProperties = properties.filter((p) => p.config === null);

  // ─── Fetch Data ───────────────────────────────────────────────────────

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/pre-arrival');
      const result = await res.json();
      if (result.success) {
        setProperties(result.data);
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

  const fetchAdapterStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/pre-arrival/adapter-status');
      const result = await res.json();
      if (result.success) {
        setAdapterStatus(result.data);
      }
    } catch (error) {
      console.error('Error fetching adapter status:', error);
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
      try { if (!cancelled) await fetchAdapterStatus(); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchConfigs, fetchPlans, fetchAdapterStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { if (!cancelled) await fetchLogs(); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchLogs]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleCreateConfig = async (propertyId: string) => {
    setCreatingFor(propertyId);
    try {
      const res = await fetch('/api/wifi/pre-arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          enabled: true,
          hoursBeforeArrival: 24,
          sendEmail: true,
          sendSms: true,
          includeQrCode: true,
          autoGenerateCreds: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Config Created', description: 'Pre-arrival delivery enabled for this property' });
        await fetchConfigs();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create config', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create config', variant: 'destructive' });
    } finally {
      setCreatingFor(null);
    }
  };

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
        setProperties((prev) =>
          prev.map((p) =>
            p.config?.id === config.id
              ? { ...p, config: { ...p.config!, enabled: !config.enabled } }
              : p,
          ),
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
        setProperties((prev) =>
          prev.map((p) =>
            p.config?.id === config.id
              ? { ...p, config: { ...p.config!, ...updates } }
              : p,
          ),
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

  // ─── Send Now Logic ──────────────────────────────────────────────────

  const openSendDialog = async (config: PreArrivalConfig) => {
    setSendDialogProperty(config);
    setSendDialogOpen(true);
    setEligibleBookings(null);
    setEligibleLoading(true);

    try {
      const res = await fetch(`/api/wifi/pre-arrival/eligible-bookings?propertyId=${config.propertyId}`);
      const result = await res.json();
      if (result.success) {
        setEligibleBookings(result.data);
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to load bookings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching eligible bookings:', error);
      toast({ title: 'Error', description: 'Failed to load eligible bookings', variant: 'destructive' });
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleSendNow = async (bookingId: string, propertyId: string) => {
    setSendingBookingId(bookingId);
    try {
      const res = await fetch('/api/wifi/pre-arrival/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, propertyId }),
      });
      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Credentials Sent!',
          description: result.message || `Delivered via ${result.data.results.map((r: { channel: string; status: string }) => r.channel).join(' + ')}`,
        });
        // Refresh eligible bookings and logs
        if (sendDialogProperty) {
          await openSendDialog(sendDialogProperty);
        }
        await fetchLogs();
        await fetchConfigs();
      } else {
        toast({
          title: 'Send Failed',
          description: result.error?.message || result.message || 'Failed to send credentials',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to trigger send', variant: 'destructive' });
    } finally {
      setSendingBookingId(null);
    }
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

  // ─── Render ────────────────────────────────────────────────────────────

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
                {enabledProperties.length}
                <span className="text-sm font-normal text-cyan-500/70 dark:text-cyan-400/60">
                  /{configuredProperties.length}
                </span>
              </div>
              <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70 font-medium">
                Properties Enabled
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Communication Adapter Status ────────────────────────────── */}
      {adapterStatus && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Communication Providers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email Provider */}
              <div className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                adapterStatus.email.configured
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
              )}>
                {adapterStatus.email.configured ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Info className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Email</span>
                  </div>
                  {adapterStatus.email.configured ? (
                    <span className="text-xs text-muted-foreground truncate block">
                      {adapterStatus.email.name || adapterStatus.email.provider}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 truncate block">
                      Using mock (dev) — emails logged to console
                    </span>
                  )}
                </div>
              </div>

              {/* SMS Provider */}
              <div className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                adapterStatus.sms.configured
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
              )}>
                {adapterStatus.sms.configured ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Info className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">SMS / OTP</span>
                  </div>
                  {adapterStatus.sms.configured ? (
                    <span className="text-xs text-muted-foreground truncate block">
                      {adapterStatus.sms.name || adapterStatus.sms.provider}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 truncate block">
                      Using mock (dev) — SMS/OTP logged to console
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Property Configuration Cards ────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Properties ({properties.length})
        </h3>

        {isLoading ? (
          <Card className="p-8">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {properties.map((item) =>
              item.config ? (
                <PropertyConfigCard
                  key={item.property.id}
                  config={item.config}
                  plans={plans}
                  isSaving={isSaving === item.config.id}
                  adapterStatus={adapterStatus}
                  onToggleEnabled={() => handleToggleEnabled(item.config!)}
                  onSave={(updates) => handleSaveConfig(item.config!, updates)}
                  onPreview={() => handlePreview(item.config!)}
                  onSendNow={() => openSendDialog(item.config!)}
                />
              ) : (
                <UnconfiguredPropertyCard
                  key={item.property.id}
                  property={item.property}
                  isCreating={creatingFor === item.property.id}
                  onCreate={() => handleCreateConfig(item.property.id)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Delivery Logs ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
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
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS / OTP</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
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
              <p className="text-xs text-muted-foreground/60 mt-1">Click &quot;Send Now&quot; on a property card to send credentials</p>
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
                    <p className="text-sm whitespace-pre-wrap">Dear John,</p>
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
                    SMS / OTP Preview
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

      {/* ── Send Now Dialog ────────────────────────────────────────── */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => { setSendDialogOpen(open); if (!open) setEligibleBookings(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send WiFi Credentials — {sendDialogProperty?.property.name}
            </DialogTitle>
            <DialogDescription>
              Select a booking to manually send WiFi credentials to the guest
            </DialogDescription>
          </DialogHeader>

          {eligibleLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading eligible bookings...</span>
            </div>
          ) : eligibleBookings ? (
            <div className="space-y-4">
              {/* Delivery Window Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Delivery window: next {eligibleBookings.deliveryWindow.hoursBefore}h
                  (from {format(new Date(eligibleBookings.deliveryWindow.from), 'MMM d, HH:mm')} to{' '}
                  {format(new Date(eligibleBookings.deliveryWindow.to), 'MMM d, HH:mm')})
                </span>
              </div>

              {/* Config summary */}
              {sendDialogProperty && (
                <div className="flex flex-wrap gap-2">
                  {sendDialogProperty.sendEmail && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Badge>
                  )}
                  {sendDialogProperty.sendSms && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <MessageSquare className="h-3 w-3" /> SMS / OTP
                    </Badge>
                  )}
                  {sendDialogProperty.includeQrCode && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <QrCode className="h-3 w-3" /> QR Code
                    </Badge>
                  )}
                  {sendDialogProperty.autoGenerateCreds && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Zap className="h-3 w-3" /> Auto-Generate
                    </Badge>
                  )}
                </div>
              )}

              {/* Eligible Bookings */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Eligible Bookings ({eligibleBookings.eligible.length})
                </h4>
                {eligibleBookings.eligible.length === 0 ? (
                  <div className="text-center py-8 rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground">No eligible bookings in the delivery window</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Bookings must be confirmed and within {eligibleBookings.deliveryWindow.hoursBefore}h of check-in
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[280px]">
                    <div className="space-y-2">
                      {eligibleBookings.eligible.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{booking.guestName}</p>
                              <Badge variant="secondary" className="text-[10px]">
                                {booking.confirmationCode}
                              </Badge>
                              {booking.wifiUser && (
                                <Badge variant="outline" className="text-[10px] text-green-600">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                  {booking.wifiUser.username}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(booking.checkIn), 'MMM d, HH:mm')} — {format(new Date(booking.checkOut), 'MMM d')}
                              </span>
                              {booking.hasEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-blue-500" />
                                  {booking.guestEmail}
                                </span>
                              )}
                              {booking.hasPhone && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {booking.guestPhone}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSendNow(booking.id, sendDialogProperty!.propertyId)}
                            disabled={sendingBookingId === booking.id}
                            className="shrink- ml-2 h-8 text-xs"
                          >
                            {sendingBookingId === booking.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Send Now
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Already Sent */}
              {eligibleBookings.alreadySent.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Already Sent ({eligibleBookings.alreadySent.length})
                  </h4>
                  <ScrollArea className="max-h-[120px]">
                    <div className="space-y-1">
                      {eligibleBookings.alreadySent.map((b) => (
                        <div key={b.id} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                          <span className="text-muted-foreground">
                            {b.guestName} ({b.confirmationCode})
                          </span>
                          {b.wifiUser && (
                            <span className="text-green-600 font-mono">{b.wifiUser.username}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Unconfigured Property Card ─────────────────────────────────────────

function UnconfiguredPropertyCard({
  property,
  isCreating,
  onCreate,
}: {
  property: PropertyInfo;
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/30 transition-colors">
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{property.name}</p>
              {property.city && (
                <p className="text-xs text-muted-foreground">{property.city}{property.country ? `, ${property.country}` : ''}</p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] ml-2">Not Configured</Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onCreate}
            disabled={isCreating}
            className="h-8"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Enable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Property Config Card ──────────────────────────────────────────────────

interface PropertyConfigCardProps {
  config: PreArrivalConfig;
  plans: WiFiPlan[];
  isSaving: boolean;
  adapterStatus: AdapterStatus | null;
  onToggleEnabled: () => void;
  onSave: (updates: Partial<PreArrivalConfig>) => void;
  onPreview: () => void;
  onSendNow: () => void;
}

function PropertyConfigCard({
  config,
  plans,
  isSaving,
  adapterStatus,
  onToggleEnabled,
  onSave,
  onPreview,
  onSendNow,
}: PropertyConfigCardProps) {
  const [localConfig, setLocalConfig] = useState({ ...config });
  const [expanded, setExpanded] = useState(config.enabled);

  useEffect(() => {
    setLocalConfig({ ...config });
    setExpanded(config.enabled);
  }, [config]);

  const handleChange = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
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
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
  };

  const hasChanges = [
    localConfig.hoursBeforeArrival !== config.hoursBeforeArrival,
    localConfig.sendEmail !== config.sendEmail,
    localConfig.sendSms !== config.sendSms,
    localConfig.includeQrCode !== config.includeQrCode,
    localConfig.autoGenerateCreds !== config.autoGenerateCreds,
    localConfig.planId !== config.planId,
    localConfig.smsTemplate !== config.smsTemplate,
  ].some(Boolean);

  return (
    <Card className={cn(
      'border transition-all',
      config.enabled
        ? 'border-primary/20 dark:border-primary/20 shadow-sm'
        : 'border-border',
    )}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-3 text-left flex-1 min-w-0"
            onClick={() => setExpanded(!expanded)}
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              config.enabled
                ? 'bg-gradient-to-br from-primary to-primary/70'
                : 'bg-muted',
            )}>
              <Building2 className={cn('h-5 w-5', config.enabled ? 'text-white' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                {config.property.name}
                <StatusBadge status={config.enabled ? 'enabled' : 'disabled'} />
              </CardTitle>
              <CardDescription className="text-xs">
                {config.enabled
                  ? `${localConfig.hoursBeforeArrival}h before arrival · ${localConfig.sendEmail ? 'Email' : ''}${localConfig.sendEmail && localConfig.sendSms ? ' + ' : ''}${localConfig.sendSms ? 'SMS/OTP' : ''}${localConfig.includeQrCode ? ' · QR' : ''}`
                  : 'Click to expand'}
              </CardDescription>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {config.enabled && (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSendNow(); }}
                className="h-8 text-xs gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send Now
              </Button>
            )}
            <Label htmlFor={`enabled-${config.id}`} className="text-sm font-medium cursor-pointer">
              {config.enabled ? 'On' : 'Off'}
            </Label>
            <Switch
              id={`enabled-${config.id}`}
              checked={config.enabled}
              onCheckedChange={onToggleEnabled}
              disabled={isSaving}
            />
            <button
              type="button"
              className="p-1 h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
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
                <SelectContent position="popper" sideOffset={4}>
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
                <SelectContent position="popper" sideOffset={4}>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ToggleSetting
              icon={<Mail className="h-4 w-4 text-blue-500" />}
              label="Email"
              checked={localConfig.sendEmail}
              onChange={(v) => handleChange('sendEmail', v)}
              disabled={isSaving}
            />
            <ToggleSetting
              icon={<MessageSquare className="h-4 w-4 text-primary" />}
              label="SMS / OTP"
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
                Message Template (Email Body + SMS/OTP)
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
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPreview}
                className="text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>
              {config.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendNow}
                  className="text-xs gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send to Guests
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="text-xs"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    enabled: { label: 'Enabled', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
    disabled: { label: 'Disabled', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
    sent: { label: 'Sent', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  };

  const c = config[status] || config.disabled;

  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-2 py-0', c.className)}>
      {c.label}
    </Badge>
  );
}

// ─── Toggle Setting ────────────────────────────────────────────────────────

function ToggleSetting({
  icon,
  label,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between rounded-lg border p-3 transition-colors',
      checked
        ? 'border-primary/20 bg-primary/5'
        : 'border-border',
      disabled && 'opacity-50',
    )}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

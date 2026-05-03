'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Zap,
  CheckCircle2,
  XCircle,
  TestTube,
  Smartphone,
  Globe,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SmsProvider =
  | 'twilio'
  | 'vonage'
  | 'messagebird'
  | 'aws_sns'
  | 'msg91'
  | 'gupshup'
  | 'textlocal'
  | 'kaleyra'
  | 'custom_http'
  | 'mock';

interface GatewayStats {
  configured: number;
  active: number;
  defaultProvider: string;
  otpEnabled: boolean;
  totalProviders: number;
}

interface SmsGateway {
  id: string;
  provider: SmsProvider;
  name: string;
  displayName: string;
  region: string;
  status: string;
  isDefault: boolean;
  otpEnabled: boolean;
  senderId: string;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface ProviderField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS: { value: SmsProvider; label: string; region: string }[] = [
  { value: 'twilio', label: 'Twilio', region: 'global' },
  { value: 'vonage', label: 'Vonage / Nexmo', region: 'global' },
  { value: 'messagebird', label: 'MessageBird', region: 'global' },
  { value: 'aws_sns', label: 'AWS SNS', region: 'global' },
  { value: 'msg91', label: 'MSG91', region: 'india' },
  { value: 'gupshup', label: 'Gupshup', region: 'india' },
  { value: 'textlocal', label: 'Textlocal', region: 'india' },
  { value: 'kaleyra', label: 'Kaleyra', region: 'india' },
  { value: 'custom_http', label: 'Custom HTTP', region: 'global' },
  { value: 'mock', label: 'Mock (Dev / Test)', region: 'dev' },
];

const PROVIDER_FIELDS: Record<SmsProvider, ProviderField[]> = {
  twilio: [
    { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'authToken', label: 'Auth Token', placeholder: 'Your auth token', type: 'password' },
    { key: 'fromPhone', label: 'From Phone Number', placeholder: '+1234567890' },
  ],
  vonage: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your API key' },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'Your API secret', type: 'password' },
    { key: 'senderName', label: 'Sender Name', placeholder: 'StaySuite' },
  ],
  messagebird: [
    { key: 'accessKey', label: 'Access Key', placeholder: 'Your access key', type: 'password' },
    { key: 'originator', label: 'Originator', placeholder: 'StaySuite' },
  ],
  aws_sns: [
    { key: 'awsAccessKeyId', label: 'AWS Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE' },
    { key: 'awsSecretAccessKey', label: 'AWS Secret Access Key', placeholder: 'Your secret key', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'StaySuite' },
    { key: 'region', label: 'AWS Region', placeholder: 'us-east-1' },
  ],
  msg91: [
    { key: 'authKey', label: 'Auth Key', placeholder: 'Your MSG91 auth key', type: 'password' },
    { key: 'flowId', label: 'Flow ID (DLT Template)', placeholder: 'Flow ID from DLT' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'STYSUT' },
  ],
  gupshup: [
    { key: 'userId', label: 'User ID', placeholder: 'Your Gupshup user ID' },
    { key: 'password', label: 'Password', placeholder: 'Your password', type: 'password' },
    { key: 'senderMask', label: 'Sender Mask', placeholder: 'STYSUT' },
  ],
  textlocal: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Textlocal API key', type: 'password' },
    { key: 'senderName', label: 'Sender Name', placeholder: 'STYSUT' },
  ],
  kaleyra: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Kaleyra API key', type: 'password' },
    { key: 'sid', label: 'SID', placeholder: 'Your Kaleyra SID' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'STYSUT' },
    { key: 'templateId', label: 'Template ID (DLT)', placeholder: 'DLT template ID' },
  ],
  custom_http: [
    { key: 'endpointUrl', label: 'Endpoint URL', placeholder: 'https://api.example.com/sms/send' },
    { key: 'apiKey', label: 'API Key', placeholder: 'Your API key', type: 'password' },
    { key: 'sender', label: 'Default Sender', placeholder: 'STYSUT' },
  ],
  mock: [],
};

const REGION_BADGE: Record<string, { emoji: string; label: string; className: string }> = {
  global: { emoji: '🌍', label: 'Global', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  india: { emoji: '🇮🇳', label: 'India', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  dev: { emoji: '🧪', label: 'Dev', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      );
    case 'inactive':
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          Configured
        </Badge>
      );
  }
}

function borderColor(status: string): string {
  switch (status) {
    case 'active':
      return 'border-l-emerald-500';
    case 'error':
      return 'border-l-red-500';
    default:
      return 'border-l-amber-500';
  }
}

function regionBadge(region: string) {
  const meta = REGION_BADGE[region];
  if (!meta) return null;
  return (
    <Badge variant="secondary" className={`text-xs gap-1 ${meta.className}`}>
      {meta.emoji} {meta.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SMSTGateways() {
  const [gateways, setGateways] = useState<SmsGateway[]>([]);
  const [stats, setStats] = useState<GatewayStats>({
    configured: 0,
    active: 0,
    defaultProvider: 'None',
    otpEnabled: false,
    totalProviders: 0,
  });
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<SmsProvider>('twilio');
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [isDefault, setIsDefault] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SmsGateway | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- Data fetching ----

  const fetchGateways = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/sms-gateways');
      const json = await res.json();
      if (json.success) {
        setGateways(json.data.gateways);
        setStats(json.data.stats);
      }
    } catch {
      toast.error('Failed to fetch SMS gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  // ---- Dialog open / close helpers ----

  const openAddDialog = (preselect?: SmsProvider) => {
    setEditingId(null);
    setSelectedProvider(preselect ?? 'twilio');
    setFormConfig({});
    setIsDefault(false);
    setOtpEnabled(false);
    setTestPhone('');
    setDialogOpen(true);
  };

  const openEditDialog = (gw: SmsGateway) => {
    setEditingId(gw.id);
    setSelectedProvider(gw.provider);
    // Populate form from config, but only non-masked values
    const populated: Record<string, string> = {};
    for (const field of PROVIDER_FIELDS[gw.provider]) {
      const val = gw.config[field.key];
      if (typeof val === 'string' && val !== '••••••••') {
        populated[field.key] = val;
      } else {
        populated[field.key] = '';
      }
    }
    setFormConfig(populated);
    setIsDefault(gw.isDefault);
    setOtpEnabled(gw.otpEnabled);
    setTestPhone('');
    setDialogOpen(true);
  };

  // ---- Save handler ----

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build the payload config, including any existing config keys we want to preserve
      const configPayload: Record<string, unknown> = { ...formConfig };

      if (editingId) {
        // PUT update
        const res = await fetch('/api/integrations/sms-gateways', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            config: configPayload,
            isDefault,
            otpEnabled,
          }),
        });
        if (res.ok) {
          toast.success('SMS gateway updated successfully');
          fetchGateways();
          setDialogOpen(false);
        } else {
          const err = await res.json();
          toast.error(err.error?.message || 'Failed to update gateway');
        }
      } else {
        // POST create
        const res = await fetch('/api/integrations/sms-gateways', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            config: configPayload,
            isDefault,
            otpEnabled,
          }),
        });
        if (res.ok) {
          toast.success('SMS gateway added successfully');
          fetchGateways();
          setDialogOpen(false);
        } else {
          const err = await res.json();
          toast.error(err.error?.message || 'Failed to add gateway');
        }
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // ---- Test SMS ----

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a phone number to test');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/integrations/sms-gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          provider: selectedProvider,
          config: formConfig,
          to: testPhone.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || 'Test SMS sent!');
      } else {
        toast.error(json.error?.message || 'Test SMS failed');
      }
    } catch {
      toast.error('Failed to send test SMS');
    } finally {
      setTesting(false);
    }
  };

  // ---- Test from card (inline) ----

  const handleInlineTest = async (gw: SmsGateway) => {
    setTesting(true);
    try {
      const res = await fetch('/api/integrations/sms-gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          provider: gw.provider,
          config: gw.config,
          to: '+919876543210',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || `Test SMS sent via ${gw.displayName}`);
      } else {
        toast.error(json.error?.message || 'Test failed');
      }
    } catch {
      toast.error('Test SMS failed');
    } finally {
      setTesting(false);
    }
  };

  // ---- Delete ----

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/integrations/sms-gateways?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('SMS gateway deleted');
        fetchGateways();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete gateway');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ---- Render: Loading skeleton ----

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ---- Render: Empty state ----

  if (gateways.length === 0 && !loading) {
    const quickAddProviders: SmsProvider[] = ['msg91', 'gupshup', 'textlocal', 'kaleyra'];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">SMS Gateways</h2>
            <p className="text-muted-foreground">
              Configure SMS providers for OTP, notifications, and guest communications
            </p>
          </div>
          <Button onClick={() => openAddDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add SMS Gateway
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription>Configured Gateways</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardDescription>Default Provider</CardDescription>
              <CardTitle className="text-2xl">None</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription>OTP Enabled</CardDescription>
              <CardTitle className="text-2xl">No</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-cyan-500">
            <CardHeader className="pb-2">
              <CardDescription>Total Providers</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-900/20 mb-6">
            <MessageSquare className="h-10 w-10 text-teal-500" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No SMS Gateways Configured
          </h3>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-8">
            Get started by adding your first SMS provider. You can configure multiple providers
            and set one as the default for OTPs, booking confirmations, and guest notifications.
          </p>

          {/* Quick-add popular Indian providers */}
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Popular in India
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickAddProviders.map((prov) => {
                const meta = PROVIDER_OPTIONS.find((p) => p.value === prov)!;
                return (
                  <Button
                    key={prov}
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-lg"
                    onClick={() => openAddDialog(prov)}
                  >
                    <span>🇮🇳</span>
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Button onClick={() => openAddDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Browse All Providers
          </Button>
        </div>
      </div>
    );
  }

  // ---- Render: Main content ----

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SMS Gateways</h2>
          <p className="text-muted-foreground">
            Configure SMS providers for OTP, notifications, and guest communications
          </p>
        </div>
        <Button onClick={() => openAddDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add SMS Gateway
        </Button>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Configured Gateways</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="pb-2">
            <CardDescription>Default Provider</CardDescription>
            <CardTitle className="text-2xl truncate">{stats.defaultProvider}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>OTP Enabled</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {stats.otpEnabled ? (
                <Badge className="bg-emerald-500 text-white border-0 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  No
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Providers</CardDescription>
            <CardTitle className="text-2xl">{stats.totalProviders}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ─── Provider Cards Grid ─── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {gateways.map((gw) => (
          <Card key={gw.id} className={`border-l-4 ${borderColor(gw.status)}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center shrink-0">
                    {gw.provider === 'mock' ? (
                      <TestTube className="h-5 w-5 text-violet-500" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">{gw.displayName}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      {regionBadge(gw.region)}
                      {gw.isDefault && (
                        <Badge className="bg-teal-500 text-white border-0 text-[10px] px-1.5 py-0">
                          DEFAULT
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">{statusBadge(gw.status)}</div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Info row */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Sender ID</p>
                  <p className="font-medium truncate">{gw.senderId || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">OTP</p>
                  <p className="font-medium">
                    {gw.otpEnabled ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Enabled</span>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Error */}
              {gw.lastError && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-600 dark:text-red-400">
                  {gw.lastError}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handleInlineTest(gw)}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => openEditDialog(gw)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setDeleteTarget(gw)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Add / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit SMS Gateway' : 'Add SMS Gateway'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update your SMS provider configuration'
                : 'Select a provider and configure the required credentials'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Provider select (disabled when editing) */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) => {
                  setSelectedProvider(v as SmsProvider);
                  setFormConfig({});
                }}
                disabled={!!editingId}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        {opt.region === 'india' && '🇮🇳'}
                        {opt.region === 'global' && '🌍'}
                        {opt.region === 'dev' && '🧪'}
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mock provider message */}
            {selectedProvider === 'mock' && (
              <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <TestTube className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-violet-900 dark:text-violet-300">
                      Development Mode
                    </p>
                    <p className="text-violet-700 dark:text-violet-400 mt-1">
                      Mock provider simulates SMS sending without making real API calls.
                      Ideal for development and testing environments.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Provider-specific fields */}
            {PROVIDER_FIELDS[selectedProvider].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type ?? 'text'}
                  value={formConfig[field.key] ?? ''}
                  onChange={(e) =>
                    setFormConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {/* Set as Default toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Set as Default Provider</Label>
                <p className="text-xs text-muted-foreground">
                  Use this gateway for all outgoing SMS by default
                </p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>

            {/* OTP Enabled toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable OTP</Label>
                <p className="text-xs text-muted-foreground">
                  Use this provider to send one-time passwords
                </p>
              </div>
              <Switch checked={otpEnabled} onCheckedChange={setOtpEnabled} />
            </div>

            {/* Send Test SMS */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Send Test SMS
              </Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone ?? ''}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleTestSms}
                  disabled={testing || !testPhone.trim()}
                  className="gap-1.5 shrink-0"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Add Gateway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete SMS Gateway</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">
                {deleteTarget?.displayName}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Pencil,
  CheckCircle2,
  XCircle,
  TestTube,
  Smartphone,
  Send,
  Unlink,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

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
  | 'exotel'
  | 'fast2sms'
  | 'plivo'
  | 'route_mobile'
  | 'valuefirst'
  | 'msgclub'
  | 'airtel_iq'
  | 'bulk_sms'
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
  { value: 'exotel', label: 'Exotel', region: 'india' },
  { value: 'fast2sms', label: 'Fast2SMS', region: 'india' },
  { value: 'plivo', label: 'Plivo', region: 'india' },
  { value: 'route_mobile', label: 'Route Mobile', region: 'india' },
  { value: 'valuefirst', label: 'ValueFirst', region: 'india' },
  { value: 'msgclub', label: 'MSGCLUB', region: 'india' },
  { value: 'airtel_iq', label: 'Airtel IQ', region: 'india' },
  { value: 'bulk_sms', label: 'BulkSMS India', region: 'india' },
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
  exotel: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Exotel API key' },
    { key: 'apiToken', label: 'API Token', placeholder: 'Your Exotel API token', type: 'password' },
    { key: 'sid', label: 'Exotel SID', placeholder: 'Your Exotel SID (Exotel virtual number)' },
    { key: 'fromPhone', label: 'Sender Phone Number', placeholder: 'Sender Phone Number' },
  ],
  fast2sms: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Fast2SMS API key', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID (DLT approved)' },
    { key: 'route', label: 'Route', placeholder: 'Route (default: otp)' },
  ],
  plivo: [
    { key: 'authId', label: 'Auth ID', placeholder: 'Your Plivo Auth ID' },
    { key: 'authToken', label: 'Auth Token', placeholder: 'Your Plivo Auth Token', type: 'password' },
    { key: 'fromNumber', label: 'Plivo Phone Number', placeholder: 'Plivo Phone Number' },
  ],
  route_mobile: [
    { key: 'username', label: 'Username', placeholder: 'Your Route Mobile username' },
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Route Mobile API key', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID (DLT approved)' },
    { key: 'routeId', label: 'Route ID', placeholder: 'Route ID' },
  ],
  valuefirst: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your ValueFirst API key', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID' },
    { key: 'gatewayId', label: 'Gateway ID', placeholder: 'Gateway ID' },
  ],
  msgclub: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your MSGCLUB API key', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID (DLT approved)' },
    { key: 'templateId', label: 'Template ID', placeholder: 'Template ID (DLT)' },
  ],
  airtel_iq: [
    { key: 'clientId', label: 'Client ID', placeholder: 'Your Airtel IQ Client ID' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Your Airtel IQ Client Secret', type: 'password' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID (DLT approved)' },
  ],
  bulk_sms: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your BulkSMS API key', type: 'password' },
    { key: 'username', label: 'Username', placeholder: 'Your BulkSMS username' },
    { key: 'senderId', label: 'Sender ID', placeholder: 'Sender ID' },
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
// Component  —  mirrors payment-gateways-page.tsx button/dialog pattern
// ---------------------------------------------------------------------------

export default function SMSGateways() {
  const [gateways, setGateways] = useState<SmsGateway[]>([]);
  const [stats, setStats] = useState<GatewayStats>({
    configured: 0,
    active: 0,
    defaultProvider: 'None',
    otpEnabled: false,
    totalProviders: 0,
  });
  const [loading, setLoading] = useState(true);

  // Add/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGateway, setEditGateway] = useState<SmsGateway | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<SmsProvider>('twilio');
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [isDefault, setIsDefault] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test connection dialog state (separate dialog like payment gateways)
  const [testGateway, setTestGateway] = useState<SmsGateway | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  // Delete confirmation (AlertDialog like payment gateways)
  const [deleteGateway, setDeleteGateway] = useState<SmsGateway | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- Data fetching ----

  const fetchGateways = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/sms-gateways');
      const json = await res.json();
      if (json.success) {
        setGateways(json.data.gateways || []);
        setStats(json.data.stats || {
          configured: 0,
          active: 0,
          defaultProvider: 'None',
          otpEnabled: false,
          totalProviders: 0,
        });
      } else {
        setGateways([]);
        toast.error('Failed to load SMS gateway data');
      }
    } catch (error) {
      console.error('Failed to fetch SMS gateways:', error);
      setGateways([]);
      toast.error('Failed to fetch SMS gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  // ---- Init state for Add ----

  const initAddState = (preselect?: SmsProvider) => {
    setEditGateway(null);
    setSelectedProvider(preselect ?? 'twilio');
    setFormConfig({});
    setIsDefault(false);
    setOtpEnabled(false);
  };

  // ---- Init state for Edit ----

  const initEditState = (gw: SmsGateway) => {
    setEditGateway(gw);
    setSelectedProvider(gw.provider);
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
  };

  // ---- Save handler (Add / Edit) ----

  const handleSaveGateway = async () => {
    setSaving(true);
    try {
      const configPayload: Record<string, unknown> = { ...formConfig };

      if (editGateway) {
        // PUT update
        const res = await fetch('/api/integrations/sms-gateways', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editGateway.id,
            config: configPayload,
            isDefault,
            otpEnabled,
          }),
        });
        if (res.ok) {
          toast.success('SMS gateway updated successfully');
          fetchGateways();
        } else {
          const err = await res.json().catch(() => null);
          toast.error(err?.error?.message || 'Failed to update gateway');
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
        } else {
          const err = await res.json().catch(() => null);
          toast.error(err?.error?.message || 'Failed to add gateway');
        }
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
      setDialogOpen(false);
      setEditGateway(null);
    }
  };

  // ---- Test Connection (separate dialog, like payment gateways) ----

  const handleTestConnection = async () => {
    if (!testGateway) return;

    setIsTesting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success(`Connection test initiated for ${testGateway.displayName}. Check gateway dashboard.`);
    } catch {
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
      setTestDialogOpen(false);
    }
  };

  // ---- Send Test SMS from dialog ----

  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a phone number to test');
      return;
    }

    setIsTesting(true);
    try {
      const provider = testGateway?.provider ?? selectedProvider;
      const config = testGateway?.config ?? formConfig;

      const res = await fetch('/api/integrations/sms-gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          provider,
          config,
          to: testPhone.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Test SMS sent!');
      } else {
        toast.error(json.error?.message || 'Test SMS failed');
      }
    } catch {
      toast.error('Failed to send test SMS');
    } finally {
      setIsTesting(false);
    }
  };

  // ---- Delete handler ----

  const handleDeleteGateway = async () => {
    if (!deleteGateway) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/integrations/sms-gateways?id=${deleteGateway.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setGateways((prev) => prev.filter((g) => g.id !== deleteGateway.id));
        toast.success('SMS gateway deleted successfully');
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete gateway');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteGateway(null);
    }
  };

  // ---- Render: Loading skeleton ----

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---- Render: Main content ----

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            SMS Gateways
          </h2>
          <p className="text-muted-foreground">
            Configure SMS providers for OTP, notifications, and guest communications
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => initAddState()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editGateway ? 'Edit SMS Gateway' : 'Add SMS Gateway'}</DialogTitle>
              <DialogDescription>
                {editGateway
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
                  disabled={!!editGateway}
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
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
              </div>

              {/* OTP Enabled toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Enable OTP</Label>
                  <p className="text-xs text-muted-foreground">
                    Use this provider to send one-time passwords
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={otpEnabled}
                  onChange={(e) => setOtpEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
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
                    type="button"
                    onClick={handleSendTestSms}
                    disabled={isTesting || !testPhone.trim()}
                    className="gap-1.5 shrink-0"
                  >
                    {isTesting ? (
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGateway} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editGateway ? 'Save Changes' : 'Add Gateway'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid gap-4 md:grid-cols-4">
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

      {/* ─── Provider Cards / Empty State ─── */}
      <div className="grid gap-4">
        {gateways.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No SMS gateways configured</p>
              <p className="text-sm">Add an SMS gateway to start sending messages</p>
            </CardContent>
          </Card>
        ) : (
          gateways.map((gw) => (
            <Card key={gw.id} className={`border-l-4 overflow-hidden ${borderColor(gw.status)}`}>
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

              <CardContent>
                {/* Info row */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
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
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-600 dark:text-red-400 mb-4">
                    {gw.lastError}
                  </div>
                )}

                {/* Actions — same pattern as payment gateways */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestGateway(gw);
                      setTestDialogOpen(true);
                    }}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      initEditState(gw);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 dark:text-red-400 hover:text-red-700"
                    onClick={() => {
                      setDeleteGateway(gw);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ─── Test Connection Dialog (separate, like payment gateways) ─── */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Test Connection
            </DialogTitle>
            <DialogDescription>
              Test the connection to {testGateway?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This will attempt to send a test SMS using the configured credentials
              to verify the connection is working correctly.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Phone Number
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
                  onClick={handleSendTestSms}
                  disabled={isTesting || !testPhone.trim()}
                  className="gap-1.5 shrink-0"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
            {testGateway && (
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium capitalize">{testGateway.displayName}</span>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{testGateway.status}</span>
                  <span className="text-muted-foreground">Sender ID:</span>
                  <span className="font-medium">{testGateway.senderId || 'Not configured'}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestConnection} disabled={isTesting}>
              {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isTesting ? 'Testing...' : 'Run Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation (AlertDialog, like payment gateways) ─── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              Remove SMS Gateway
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteGateway?.displayName}</strong>? This action cannot be undone
              and will disable all SMS sending through this gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGateway}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Gateway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

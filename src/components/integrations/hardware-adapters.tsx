'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Lock,
  CreditCard,
  Activity,
  Webhook,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  HeartPulse,
  Clock,
  ExternalLink,
  Trash2,
  Copy,
  Zap,
  Shield,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HardwareProviderId =
  | 'simulator'
  | 'assa-abloy-visionline'
  | 'salto-ks'
  | 'dormakaba-saflok'
  | 'nuki'
  | 'seam'
  | 'stripe-terminal'
  | 'square-terminal'
  | 'adyen-terminal'
  | 'verifone-engage'
  | 'ingenico';

type HardwareCategory = 'lock' | 'terminal';

interface HardwareAdapter {
  id: string;
  tenantId: string;
  propertyId: string;
  providerId: string;
  category: string;
  displayName: string;
  config: string;
  credentials?: string;
  enabled: boolean;
  healthStatus: string;
  lastHealthyAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  propertyName?: string;
}

interface OperationLog {
  id: string;
  providerId: string;
  category: string;
  operation: string;
  targetId: string | null;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  providerId: string;
  vendorEventId: string;
  eventType: string;
  receivedAt: string;
  processingStatus: string;
  errorMessage: string | null;
}

interface HealthData {
  adapters: Array<{
    providerId: string;
    propertyId: string;
    status: string;
    lastHealthyAt: string | null;
    lastCheckedAt: string | null;
    message: string | null;
    consecutiveFailures: number;
    latencyMs: number | null;
  }>;
  total: number;
  healthy: number;
  unhealthy: number;
}

interface Property {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

const LOCK_PROVIDERS: Array<{
  id: HardwareProviderId;
  name: string;
  description: string;
  features: string[];
  docsUrl: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'assa-abloy-visionline',
    name: 'ASSA ABLOY Visionline',
    description: 'Enterprise-grade RFID door locks with BLE mobile key support and real-time status monitoring for large hotel chains.',
    features: ['Remote lock/unlock', 'Key card encoding', 'Battery monitoring', 'Access audit trails', 'BLE mobile keys'],
    docsUrl: 'https://developer.assaabloy.com/visionline',
    icon: <Lock className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
  },
  {
    id: 'salto-ks',
    name: 'SALTO KS',
    description: 'Cloud-based smart access platform with SALTO Virtual Network for wireless updates and real-time audit trails.',
    features: ['Cloud management', 'Virtual network', 'Mobile keys', 'PIN codes', 'Real-time updates'],
    docsUrl: 'https://developers.saltoks.com',
    icon: <Lock className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
  },
  {
    id: 'dormakaba-saflok',
    name: 'Dormakaba SAFLOK',
    description: 'High-security electronic locks with RFID/NFC and mobile credentials via dormakaba mobile access.',
    features: ['RFID/NFC', 'Mobile credentials', 'High-security encryption', 'Multiple access modes'],
    docsUrl: 'https://www.dormakaba.com/saflok',
    icon: <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: 'nuki',
    name: 'Nuki',
    description: 'Smart lock retrofit solution with Bridge API for remote control and integration with existing lock hardware.',
    features: ['Retrofit installation', 'Bridge API', 'Auto-unlock', 'Activity log', 'PIN codes'],
    docsUrl: 'https://developer.nuki.io',
    icon: <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  },
  {
    id: 'seam',
    name: 'Seam',
    description: 'Unified hardware platform connecting multiple lock brands through a single API for simplified management.',
    features: ['Multi-brand support', 'Unified API', 'Access codes', 'Webhooks', 'Automatic sync'],
    docsUrl: 'https://docs.seam.co',
    icon: <Lock className="h-5 w-5 text-teal-600 dark:text-teal-400" />,
  },
  {
    id: 'simulator',
    name: 'Lock Simulator',
    description: 'Built-in simulator for development and testing with configurable latency, failure rates, and 10 seeded locks.',
    features: ['Simulated locks', 'Configurable latency', 'Failure injection', 'Full CRUD operations'],
    docsUrl: '#',
    icon: <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />,
  },
];

const TERMINAL_PROVIDERS: Array<{
  id: HardwareProviderId;
  name: string;
  description: string;
  features: string[];
  docsUrl: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'stripe-terminal',
    name: 'Stripe Terminal',
    description: 'End-to-end payment processing with Stripe readers, SDK, and pre-certified reader models for seamless checkout.',
    features: ['In-person payments', 'Tipping support', 'Refunds', 'Webhooks', 'Reader management'],
    docsUrl: 'https://stripe.com/docs/terminal',
    icon: <CreditCard className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
  },
  {
    id: 'square-terminal',
    name: 'Square Terminal',
    description: 'All-in-one card payment terminal with Square Checkout API for creating and managing payment sessions.',
    features: ['Checkout API', 'Refunds', 'Multi-location', 'Inventory sync', 'Webhooks'],
    docsUrl: 'https://developer.squareup.com/docs/terminal-api',
    icon: <CreditCard className="h-5 w-5 text-teal-600 dark:text-teal-400" />,
  },
  {
    id: 'adyen-terminal',
    name: 'Adyen Terminal',
    description: 'Enterprise POS cloud integration with Nexo/ISO 20022 protocol and multi-region terminal support.',
    features: ['POS Cloud', 'Multi-region', 'Nexo protocol', 'Multi-currency', 'Tokenization'],
    docsUrl: 'https://docs.adyen.com/point-of-sale',
    icon: <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  },
  {
    id: 'verifone-engage',
    name: 'Verifone Engage',
    description: 'Modern payment terminal platform with Engage API for integrated commerce solutions.',
    features: ['Engage API', 'EMV support', 'NFC payments', 'Multi-PIN', 'Merchant management'],
    docsUrl: 'https://developer.verifone.com',
    icon: <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: 'ingenico',
    name: 'Ingenico',
    description: 'Global payment terminal provider with Telium 2 and Lane/3000 series support for hospitality environments.',
    features: ['Telium 2', 'Lane/3000 series', 'Host integration', 'Multi-PIN', 'Hospitality modes'],
    docsUrl: 'https://developer.ingenico.com',
    icon: <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
  },
  {
    id: 'simulator',
    name: 'Terminal Simulator',
    description: 'Built-in simulator for development and testing with 3 seeded terminals and configurable payment scenarios.',
    features: ['Simulated terminals', 'Payment simulation', 'Configurable failure rate', '3s payment delay'],
    docsUrl: '#',
    icon: <CreditCard className="h-5 w-5 text-slate-500 dark:text-slate-400" />,
  },
];

// ---------------------------------------------------------------------------
// Provider-specific credential fields
// ---------------------------------------------------------------------------

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'number';
  required: boolean;
}

const PROVIDER_CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  'salto-ks': [
    { key: 'customerId', label: 'Customer ID', placeholder: 'Customer UUID', required: true },
    { key: 'siteId', label: 'Site ID', placeholder: 'Site UUID', required: true },
    { key: 'clientId', label: 'Client ID', placeholder: 'OAuth2 Client ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth2 Client Secret', type: 'password', required: true },
  ],
  'assa-abloy-visionline': [
    { key: 'serviceUrl', label: 'Service URL', placeholder: 'https://visionline-api.example.com', required: true },
    { key: 'username', label: 'Username', placeholder: 'API username', required: true },
    { key: 'password', label: 'Password', placeholder: 'API password', type: 'password', required: true },
  ],
  'nuki': [
    { key: 'apiToken', label: 'API Token', placeholder: 'Nuki API token', type: 'password', required: true },
    { key: 'bridgeIp', label: 'Bridge IP', placeholder: '192.168.1.100 (optional)', required: false },
  ],
  'seam': [
    { key: 'apiKey', label: 'API Key', placeholder: 'seam_api_...', type: 'password', required: true },
    { key: 'workspaceId', label: 'Workspace ID', placeholder: 'Workspace UUID', required: true },
  ],
  'dormakaba-saflok': [],
  'stripe-terminal': [
    { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password', required: true },
    { key: 'stripeAccountId', label: 'Stripe Account ID', placeholder: 'acct_... (optional)', required: false },
  ],
  'square-terminal': [
    { key: 'accessToken', label: 'Access Token', placeholder: 'EAAA...', type: 'password', required: true },
    { key: 'locationId', label: 'Location ID', placeholder: 'Location UUID', required: true },
  ],
  'adyen-terminal': [
    { key: 'apiKey', label: 'API Key', placeholder: 'AQEy...', type: 'password', required: true },
    { key: 'merchantAccountCode', label: 'Merchant Account Code', placeholder: 'YourMerchantAccount', required: true },
  ],
  'verifone-engage': [
    { key: 'clientId', label: 'Client ID', placeholder: 'Verifone Client ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Verifone Client Secret', type: 'password', required: true },
    { key: 'merchantId', label: 'Merchant ID', placeholder: 'Merchant UUID', required: true },
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.verifone.com', required: true },
  ],
  'ingenico': [],
  'simulator': [
    { key: 'latencyMs', label: 'Simulated Latency (ms)', placeholder: '500', type: 'number', required: false },
    { key: 'failureRate', label: 'Failure Rate (0-1)', placeholder: '0.1', type: 'number', required: false },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function connectionStatusBadge(status: string) {
  switch (status) {
    case 'connected':
    case 'healthy':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <Wifi className="h-3 w-3" /> Connected
        </Badge>
      );
    case 'disconnected':
    case 'unhealthy':
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" /> Disconnected
        </Badge>
      );
    case 'degraded':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <AlertTriangle className="h-3 w-3" /> Degraded
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 gap-1">
          <WifiOff className="h-3 w-3" /> Unknown
        </Badge>
      );
  }
}

function healthStatusBadge(status: string) {
  switch (status) {
    case 'healthy':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Healthy
        </Badge>
      );
    case 'degraded':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <AlertTriangle className="h-3 w-3" /> Degraded
        </Badge>
      );
    case 'unhealthy':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Unhealthy
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 gap-1">
          <WifiOff className="h-3 w-3" /> Unknown
        </Badge>
      );
  }
}

function categoryBadge(category: string) {
  if (category === 'lock') {
    return (
      <Badge variant="secondary" className="bg-slate-700 text-slate-100 dark:bg-slate-300 dark:text-slate-900">
        <Lock className="h-3 w-3 mr-1" /> Lock
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-slate-700 text-slate-100 dark:bg-slate-300 dark:text-slate-900">
      <CreditCard className="h-3 w-3 mr-1" /> Terminal
    </Badge>
  );
}

function getProviderIcon(providerId: string, category: string) {
  const isLock = category === 'lock';
  if (isLock) return <Lock className="h-6 w-6 text-slate-600 dark:text-slate-400" />;
  return <CreditCard className="h-6 w-6 text-slate-600 dark:text-slate-400" />;
}

function getProviderDisplayName(providerId: string): string {
  const all = [...LOCK_PROVIDERS, ...TERMINAL_PROVIDERS];
  const found = all.find((p) => p.id === providerId);
  return found?.name ?? providerId;
}

function getProviderCategory(providerId: string): HardwareCategory {
  const lockIds = LOCK_PROVIDERS.map((p) => p.id);
  return lockIds.includes(providerId as HardwareProviderId) ? 'lock' : 'terminal';
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-8 w-12" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HardwareAdapters() {
  // ── Data state ──
  const [adapters, setAdapters] = useState<HardwareAdapter[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdapter, setEditingAdapter] = useState<HardwareAdapter | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingLocks, setSyncingLocks] = useState<string | null>(null);

  // ── Form state ──
  const [formProvider, setFormProvider] = useState<string>('');
  const [formProperty, setFormProperty] = useState<string>('');
  const [formLabel, setFormLabel] = useState<string>('');
  const [formCredentials, setFormCredentials] = useState<Record<string, string>>({});
  const [formWebhookUrl, setFormWebhookUrl] = useState<string>('');
  const [formWebhookSecret, setFormWebhookSecret] = useState<string>('');

  // ── Filters for logs ──
  const [logFilterProvider, setLogFilterProvider] = useState<string>('all');
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
  const [logFilterStatus, setLogFilterStatus] = useState<string>('all');

  // ── Computed ──
  const autoCategory = useMemo(() => getProviderCategory(formProvider), [formProvider]);
  const autoWebhookUrl = useMemo(
    () => (formProvider ? `/api/hardware/webhooks/${formProvider}` : ''),
    [formProvider],
  );

  const credentialFields = useMemo(
    () => PROVIDER_CREDENTIAL_FIELDS[formProvider] ?? [],
    [formProvider],
  );

  const stats = useMemo(() => {
    const total = adapters.length;
    const connected = adapters.filter(
      (a) => a.healthStatus === 'healthy' || a.healthStatus === 'connected',
    ).length;
    const healthy = adapters.filter((a) => a.healthStatus === 'healthy').length;
    const unhealthy = adapters.filter(
      (a) => a.healthStatus === 'unhealthy' || a.healthStatus === 'disconnected',
    ).length;
    return { total, connected, healthy, unhealthy };
  }, [adapters]);

  const filteredLogs = useMemo(() => {
    let result = operationLogs;
    if (logFilterProvider !== 'all') {
      result = result.filter((l) => l.providerId === logFilterProvider);
    }
    if (logFilterCategory !== 'all') {
      result = result.filter((l) => l.category === logFilterCategory);
    }
    if (logFilterStatus !== 'all') {
      if (logFilterStatus === 'success') {
        result = result.filter((l) => l.success);
      } else {
        result = result.filter((l) => !l.success);
      }
    }
    return result.slice(0, 100);
  }, [operationLogs, logFilterProvider, logFilterCategory, logFilterStatus]);

  // ── Data fetchers ──

  const fetchAdapters = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/adapters');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setAdapters(json.data ?? []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch adapters');
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/health');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setHealthData(json.data);
    } catch {
      // silently fail — health is optional
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/properties');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProperties(json.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/hardware/operation-logs?limit=100');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setOperationLogs(json.data ?? []);
      }
    } catch {
      toast.error('Failed to fetch operation logs');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchWebhookLogs = useCallback(async () => {
    setLoadingWebhooks(true);
    try {
      const res = await fetch('/api/hardware/webhook-logs?limit=100');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setWebhookLogs(json.data ?? []);
      }
    } catch {
      toast.error('Failed to fetch webhook logs');
    } finally {
      setLoadingWebhooks(false);
    }
  }, []);

  // ── Initial load ──

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchAdapters(), fetchHealth(), fetchProperties()]);
      setLoading(false);
    }
    load();
  }, [fetchAdapters, fetchHealth, fetchProperties]);

  // Load logs when tab is selected (via ref flag to avoid re-triggering)
  const logsLoadedRef = useRef(false);
  const webhooksLoadedRef = useRef(false);

  useEffect(() => {
    if (activeTab === 'logs' && !logsLoadedRef.current) {
      logsLoadedRef.current = true;
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'webhooks' && !webhooksLoadedRef.current) {
      webhooksLoadedRef.current = true;
      fetchWebhookLogs();
    }
  }, [activeTab, fetchWebhookLogs]);

  // ── Handlers ──

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAdapters(), fetchHealth()]);
    if (activeTab === 'logs') await fetchLogs();
    if (activeTab === 'webhooks') await fetchWebhookLogs();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleOpenDialog = (adapter?: HardwareAdapter) => {
    if (adapter) {
      setEditingAdapter(adapter);
      setFormProvider(adapter.providerId);
      setFormProperty(adapter.propertyId);
      setFormLabel(adapter.displayName);
      setFormWebhookUrl('');
      setFormWebhookSecret('');
      // Parse existing config for webhookUrl
      try {
        const cfg = JSON.parse(adapter.config || '{}');
        setFormWebhookUrl(cfg.webhookUrl || '');
      } catch {
        setFormWebhookUrl('');
      }
      setFormCredentials({});
    } else {
      setEditingAdapter(null);
      setFormProvider('');
      setFormProperty('');
      setFormLabel('');
      setFormCredentials({});
      setFormWebhookUrl('');
      setFormWebhookSecret('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAdapter(null);
  };

  const handleSave = async () => {
    if (!formProvider || !formProperty) {
      toast.error('Provider and Property are required');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        propertyId: formProperty,
        providerId: formProvider,
        category: autoCategory,
        label: formLabel || getProviderDisplayName(formProvider),
        configJson: {
          webhookUrl: formWebhookUrl || autoWebhookUrl,
        },
        credentialsJson: { ...formCredentials },
        webhookSecret: formWebhookSecret || undefined,
      };

      // Remove empty values
      if (!payload.webhookSecret) delete payload.webhookSecret;

      const url = editingAdapter
        ? `/api/hardware/adapters/${editingAdapter.id}`
        : '/api/hardware/adapters';
      const method = editingAdapter ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(
          editingAdapter
            ? 'Adapter updated successfully'
            : 'Adapter created successfully',
        );
        handleCloseDialog();
        await fetchAdapters();
      } else {
        toast.error(json.error || `Failed to save adapter (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save adapter');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (adapterId: string) => {
    setTestingConnection(true);
    try {
      const res = await fetch(`/api/hardware/adapters/${adapterId}/health`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success('Health check passed');
        } else {
          toast.error(json.error || 'Health check failed');
        }
      } else {
        toast.error(`Health check failed (${res.status})`);
      }
      // Refresh adapters and health data
      await Promise.all([fetchAdapters(), fetchHealth()]);
    } catch {
      toast.error('Failed to run health check');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncLocks = async (adapterId: string) => {
    setSyncingLocks(adapterId);
    try {
      const res = await fetch('/api/hardware/locks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId }),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data || {};
        toast.success(
          `Sync complete: ${d.discovered ?? 0} discovered, ${d.created ?? 0} created, ${d.updated ?? 0} updated`,
        );
      } else {
        toast.error(json.error || 'Sync failed');
      }
    } catch {
      toast.error('Failed to sync locks');
    } finally {
      setSyncingLocks(null);
    }
  };

  const handleDeleteAdapter = async (adapterId: string) => {
    try {
      const res = await fetch(`/api/hardware/adapters/${adapterId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Adapter removed');
        await fetchAdapters();
      } else {
        toast.error('Failed to remove adapter');
      }
    } catch {
      toast.error('Failed to remove adapter');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Failed to copy'),
    );
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6" />
            Hardware Adapters
          </h2>
          <p className="text-muted-foreground">
            Configure and manage hardware adapters for smart locks and payment terminals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Adapter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {editingAdapter ? 'Edit Hardware Adapter' : 'Add Hardware Adapter'}
                </DialogTitle>
                <DialogDescription>
                  Configure a hardware adapter for lock or terminal integration
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={formProvider} onValueChange={setFormProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5" /> Lock Providers
                        </SelectLabel>
                        {LOCK_PROVIDERS.filter((p) => p.id !== 'simulator').map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" /> Terminal Providers
                        </SelectLabel>
                        {TERMINAL_PROVIDERS.filter((p) => p.id !== 'simulator').map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5" /> Simulators
                        </SelectLabel>
                        <SelectItem value="simulator">Simulator (Lock & Terminal)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {formProvider && (
                    <p className="text-xs text-muted-foreground">
                      Category: <span className="font-medium capitalize">{autoCategory}</span>
                    </p>
                  )}
                </div>

                {/* Property Selection */}
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={formProperty} onValueChange={setFormProperty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Label */}
                <div className="space-y-2">
                  <Label htmlFor="adapter-label">Display Label</Label>
                  <Input
                    id="adapter-label"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder={formProvider ? getProviderDisplayName(formProvider) : 'My Adapter'}
                  />
                </div>

                {/* Vendor-specific credentials */}
                {credentialFields.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="h-4 w-4" /> Provider Credentials
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {credentialFields.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={`cred-${field.key}`}>
                              {field.label}
                              {!field.required && (
                                <span className="text-muted-foreground font-normal"> (optional)</span>
                              )}
                            </Label>
                            <Input
                              id={`cred-${field.key}`}
                              type={field.type || 'text'}
                              value={formCredentials[field.key] || ''}
                              onChange={(e) =>
                                setFormCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Webhook Configuration */}
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Webhook className="h-4 w-4" /> Webhook Configuration
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="webhook-url"
                        value={formWebhookUrl || autoWebhookUrl}
                        onChange={(e) => setFormWebhookUrl(e.target.value)}
                        placeholder={autoWebhookUrl || '/api/hardware/webhooks/{provider}'}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(formWebhookUrl || autoWebhookUrl)}
                        disabled={!formWebhookUrl && !autoWebhookUrl}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-generated: {autoWebhookUrl || 'Select a provider first'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Webhook Secret</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      value={formWebhookSecret}
                      onChange={(e) => setFormWebhookSecret(e.target.value)}
                      placeholder="Webhook signing secret (optional)"
                    />
                  </div>
                </div>

                {/* Info box */}
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Credentials are encrypted at rest and never exposed via the API. Webhook
                      secrets are used to verify the authenticity of vendor callbacks.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                {editingAdapter && (
                  <Button
                    variant="outline"
                    onClick={() => handleTestConnection(editingAdapter.id)}
                    disabled={testingConnection || !editingAdapter.id}
                  >
                    {testingConnection ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <HeartPulse className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving || !formProvider || !formProperty}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAdapter ? 'Update Adapter' : 'Create Adapter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-slate-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Server className="h-4 w-4" /> Total Adapters
              </CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Across {new Set(adapters.map((a) => a.propertyId)).size} properties
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Wifi className="h-4 w-4" /> Connected
              </CardDescription>
              <CardTitle className="text-2xl">{stats.connected}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.connected / stats.total) * 100).toFixed(1)}% online`
                  : 'No adapters'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-600">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Healthy
              </CardDescription>
              <CardTitle className="text-2xl">{stats.healthy}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Passing health checks
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Unhealthy
              </CardDescription>
              <CardTitle className="text-2xl">{stats.unhealthy}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5">
            <Server className="h-4 w-4 hidden sm:block" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="locks" className="gap-1.5">
            <Lock className="h-4 w-4 hidden sm:block" />
            <span className="hidden sm:inline">Lock Providers</span>
            <span className="sm:hidden">Locks</span>
          </TabsTrigger>
          <TabsTrigger value="terminals" className="gap-1.5">
            <CreditCard className="h-4 w-4 hidden sm:block" />
            <span className="hidden sm:inline">Terminal Providers</span>
            <span className="sm:hidden">Terminals</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Activity className="h-4 w-4 hidden sm:block" />
            <span className="hidden sm:inline">Operation Logs</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-4 w-4 hidden sm:block" />
            <span className="hidden sm:inline">Webhooks</span>
            <span className="sm:hidden">Hooks</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Overview ─── */}
        <TabsContent value="overview" className="mt-6">
          {loading ? (
            <CardGridSkeleton />
          ) : adapters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Server className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-muted-foreground">No hardware adapters configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a hardware adapter to connect locks or payment terminals
                </p>
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Adapter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adapters.map((adapter) => (
                <Card key={adapter.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-400/20 flex items-center justify-center shrink-0">
                          {getProviderIcon(adapter.providerId, adapter.category)}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {adapter.displayName}
                          </CardTitle>
                          <CardDescription className="text-xs truncate">
                            {getProviderDisplayName(adapter.providerId)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {categoryBadge(adapter.category)}
                        {connectionStatusBadge(adapter.healthStatus)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Health Status</p>
                        {healthStatusBadge(adapter.healthStatus)}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Property</p>
                        <p className="text-sm font-medium truncate">{adapter.propertyName || adapter.propertyId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Last Check</p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(adapter.lastCheckedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant={adapter.enabled ? 'default' : 'secondary'}>
                          {adapter.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(adapter.id)}
                        disabled={testingConnection}
                      >
                        {testingConnection ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <HeartPulse className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Health
                      </Button>
                      {adapter.category === 'lock' && adapter.healthStatus === 'healthy' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncLocks(adapter.id)}
                          disabled={syncingLocks === adapter.id}
                        >
                          {syncingLocks === adapter.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Sync Locks
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(adapter)}
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-700"
                        onClick={() => handleDeleteAdapter(adapter.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab: Lock Providers ─── */}
        <TabsContent value="locks" className="mt-6 space-y-4">
          {LOCK_PROVIDERS.map((provider) => {
            const activeAdapters = adapters.filter(
              (a) => a.providerId === provider.id && a.category === 'lock',
            );
            return (
              <Card key={provider.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-400/20 flex items-center justify-center shrink-0">
                        {provider.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="mt-1">{provider.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeAdapters.length > 0 && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          {activeAdapters.length} configured
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormProvider(provider.id);
                          handleOpenDialog();
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1.5" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {provider.features.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                  {provider.docsUrl && provider.docsUrl !== '#' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        {provider.docsUrl}
                      </a>
                    </div>
                  )}
                  {activeAdapters.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Active Instances:</p>
                      {activeAdapters.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="truncate">{a.displayName}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {connectionStatusBadge(a.healthStatus)}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleOpenDialog(a)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── Tab: Terminal Providers ─── */}
        <TabsContent value="terminals" className="mt-6 space-y-4">
          {TERMINAL_PROVIDERS.filter((p) => p.id !== 'simulator').map((provider) => {
            const activeAdapters = adapters.filter(
              (a) => a.providerId === provider.id && a.category === 'terminal',
            );
            return (
              <Card key={provider.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-400/20 flex items-center justify-center shrink-0">
                        {provider.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="mt-1">{provider.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeAdapters.length > 0 && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          {activeAdapters.length} configured
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormProvider(provider.id);
                          handleOpenDialog();
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1.5" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {provider.features.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                  {provider.docsUrl && provider.docsUrl !== '#' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        {provider.docsUrl}
                      </a>
                    </div>
                  )}
                  {activeAdapters.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Active Instances:</p>
                      {activeAdapters.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="truncate">{a.displayName}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {connectionStatusBadge(a.healthStatus)}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleOpenDialog(a)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── Tab: Operation Logs ─── */}
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Hardware Operation Logs</CardTitle>
                  <CardDescription>Recent hardware adapter operations and their results</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={logFilterProvider} onValueChange={setLogFilterProvider}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {[...LOCK_PROVIDERS, ...TERMINAL_PROVIDERS].map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={logFilterCategory} onValueChange={setLogFilterCategory}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="lock">Lock</SelectItem>
                    <SelectItem value="terminal">Terminal</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={logFilterStatus} onValueChange={setLogFilterStatus}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingLogs ? (
                <TableSkeleton rows={8} />
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-muted-foreground">No operation logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Logs will appear as hardware operations are performed
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[480px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead className="hidden md:table-cell">Target</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className={!log.success ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}
                        >
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getProviderDisplayName(log.providerId)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {categoryBadge(log.category)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.operation}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                            {log.targetId || '—'}
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" /> Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="h-3 w-3" /> Fail
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Webhook Status ─── */}
        <TabsContent value="webhooks" className="mt-6">
          <div className="space-y-4">
            {/* Configured Webhook URLs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configured Webhook Endpoints</CardTitle>
                <CardDescription>
                  Webhook URLs configured for each active adapter
                </CardDescription>
              </CardHeader>
              <CardContent>
                {adapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No adapters configured yet
                  </p>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {adapters.map((adapter) => {
                        let webhookUrl = autoWebhookUrl;
                        try {
                          const cfg = JSON.parse(adapter.config || '{}');
                          if (cfg.webhookUrl) webhookUrl = cfg.webhookUrl;
                        } catch {
                          // ignore
                        }
                        return (
                          <div
                            key={adapter.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-muted/50 p-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{adapter.displayName}</span>
                                {categoryBadge(adapter.category)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <code className="text-xs text-muted-foreground truncate">
                                  {webhookUrl}
                                </code>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => copyToClipboard(webhookUrl)}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              Copy
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Recent Webhook Events */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Recent Webhook Events</CardTitle>
                    <CardDescription>
                      Incoming vendor webhook events and processing status
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchWebhookLogs}
                    disabled={loadingWebhooks}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingWebhooks ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingWebhooks ? (
                  <TableSkeleton rows={6} />
                ) : webhookLogs.length === 0 ? (
                  <div className="py-12 text-center">
                    <Webhook className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-muted-foreground">No webhook events received</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Events will appear here when vendors send callbacks
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Event Type</TableHead>
                          <TableHead className="hidden sm:table-cell">Vendor Event ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(log.receivedAt)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {getProviderDisplayName(log.providerId)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{log.eventType}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                              {log.vendorEventId}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  log.processingStatus === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : log.processingStatus === 'failed'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }
                              >
                                {log.processingStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[150px]">
                              {log.errorMessage || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default HardwareAdapters;

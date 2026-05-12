'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Edit,
  ArrowRightLeft,
  History,
  TrendingUp,
  Calculator,
  MoreVertical,
  Clock,
  Activity,
  Currency,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface CurrencyConfig {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string;
  channelCode: string;
  sourceCurrency: string;
  targetCurrency: string;
  conversionType: string;
  exchangeRate: number;
  markupPercent: number;
  roundingMethod: string;
  lastRateUpdate: string | null;
  rateProvider: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string;
  connectionChannel: string | null;
  history?: CurrencyHistoryEntry[];
}

interface CurrencyHistoryEntry {
  id: string;
  tenantId: string;
  configId: string;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedBy: string | null;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  data: CurrencyConfig[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    currenciesUsed: number;
    currenciesList: string[];
    lastUpdate: string | null;
  };
}

// ============================================
// CONSTANTS
// ============================================

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
];

const currencyMap = new Map(CURRENCIES.map((c) => [c.code, c]));

function getCurrencyInfo(code: string) {
  return currencyMap.get(code) || { code, name: code, symbol: code, flag: '🏳️' };
}

const CHANNEL_COLORS: Record<string, string> = {
  booking_com: '#003580',
  expedia: '#FBAF17',
  airbnb: '#FF5A5F',
  agoda: '#4A2B82',
  tripadvisor: '#34E0A1',
  vrbo: '#3E2D6F',
  google_hotels: '#4285F4',
  makemytrip: '#E40046',
  default: '#6B7280',
};

// ============================================
// DEMO TENANT
// ============================================
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRelativeTime(date: string | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return d.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

function getChannelColor(channelCode: string): string {
  return CHANNEL_COLORS[channelCode] || CHANNEL_COLORS.default;
}

function getStatusBadgeStyle(isActive: boolean) {
  return isActive
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
}

function getConversionTypeBadge(type: string) {
  const map: Record<string, string> = {
    manual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    auto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    fixed_rate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CurrencyConfig() {
  const t = useTranslations('channels');
  const isMobile = useIsMobile();

  // State
  const [configs, setConfigs] = useState<CurrencyConfig[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    currenciesUsed: 0,
    currenciesList: [] as string[],
    lastUpdate: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('configs');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showConverterDialog, setShowConverterDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<CurrencyConfig | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Converter state
  const [converterConfigId, setConverterConfigId] = useState<string>('');
  const [converterBaseRate, setConverterBaseRate] = useState<string>('');
  const [converterResult, setConverterResult] = useState<{
    baseRate: number;
    convertedRate: number;
    sourceCurrency: string;
    targetCurrency: string;
    exchangeRate: number;
  } | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    connectionId: '',
    channelCode: '',
    sourceCurrency: 'USD',
    targetCurrency: 'EUR',
    conversionType: 'manual',
    exchangeRate: '1',
    markupPercent: '0',
    roundingMethod: 'nearest',
    rateProvider: 'manual',
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connections for create dialog
  const [connections, setConnections] = useState<Array<{ id: string; displayName: string | null; channel: string }>>([]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/channels/currency?tenantId=${DEMO_TENANT}&include=history`);
      const data: ApiResponse = await response.json();
      if (data.success) {
        setConfigs(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching currency configs:', error);
      toast.error('Failed to load currency configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch connections for create dialog
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/channels/connections?tenantId=${DEMO_TENANT}`);
      const data = await res.json();
      if (data.success) {
        setConnections(
          data.data.map((c: { id: string; displayName: string | null; channel: string }) => ({
            id: c.id,
            displayName: c.displayName,
            channel: c.channel,
          }))
        );
      }
    } catch {
      // Silently fail - connections are optional for prefill
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchConnections();
  }, [fetchData, fetchConnections]);

  // Handle create
  const handleCreate = async () => {
    if (!formData.connectionId) {
      toast.error('Please select a channel connection');
      return;
    }

    setIsSubmitting(true);
    try {
      const connection = connections.find((c) => c.id === formData.connectionId);
      const payload = {
        tenantId: DEMO_TENANT,
        connectionId: formData.connectionId,
        channelCode: formData.channelCode || connection?.channel || '',
        sourceCurrency: formData.sourceCurrency,
        targetCurrency: formData.targetCurrency,
        conversionType: formData.conversionType,
        exchangeRate: parseFloat(formData.exchangeRate) || 1,
        markupPercent: parseFloat(formData.markupPercent) || 0,
        roundingMethod: formData.roundingMethod,
        rateProvider: formData.rateProvider,
        isActive: formData.isActive,
      };

      const res = await fetch('/api/channels/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Currency configuration created successfully');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to create configuration');
      }
    } catch {
      toast.error('Failed to create configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!selectedConfig) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/channels/currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedConfig.id,
          sourceCurrency: formData.sourceCurrency,
          targetCurrency: formData.targetCurrency,
          conversionType: formData.conversionType,
          exchangeRate: parseFloat(formData.exchangeRate) || 1,
          markupPercent: parseFloat(formData.markupPercent) || 0,
          roundingMethod: formData.roundingMethod,
          rateProvider: formData.rateProvider,
          isActive: formData.isActive,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Currency configuration updated');
        setShowEditDialog(false);
        setSelectedConfig(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update configuration');
      }
    } catch {
      toast.error('Failed to update configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const confirmDelete = async () => {
    if (!deleteItemId) return;
    try {
      const res = await fetch('/api/channels/currency', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteItemId }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Configuration deleted');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete configuration');
    } finally {
      setDeleteItemId(null);
    }
  };

  // Handle convert
  const handleConvert = async () => {
    if (!converterConfigId || !converterBaseRate) {
      toast.error('Please select a config and enter a base rate');
      return;
    }
    setIsConverting(true);
    setConverterResult(null);
    try {
      const res = await fetch('/api/channels/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert',
          configId: converterConfigId,
          baseRate: parseFloat(converterBaseRate),
          tenantId: DEMO_TENANT,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setConverterResult(result.data);
      } else {
        toast.error(result.error?.message || 'Conversion failed');
      }
    } catch {
      toast.error('Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (config: CurrencyConfig) => {
    try {
      const res = await fetch('/api/channels/currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: config.id, isActive: !config.isActive }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(config.isActive ? 'Configuration deactivated' : 'Configuration activated');
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  // Open edit dialog
  const openEditDialog = (config: CurrencyConfig) => {
    setSelectedConfig(config);
    setFormData({
      connectionId: config.connectionId,
      channelCode: config.channelCode,
      sourceCurrency: config.sourceCurrency,
      targetCurrency: config.targetCurrency,
      conversionType: config.conversionType,
      exchangeRate: String(config.exchangeRate),
      markupPercent: String(config.markupPercent),
      roundingMethod: config.roundingMethod,
      rateProvider: config.rateProvider || 'manual',
      isActive: config.isActive,
    });
    setShowEditDialog(true);
  };

  const openHistoryDialog = (config: CurrencyConfig) => {
    setSelectedConfig(config);
    setShowHistoryDialog(true);
  };

  const resetForm = () => {
    setFormData({
      connectionId: '',
      channelCode: '',
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      conversionType: 'manual',
      exchangeRate: '1',
      markupPercent: '0',
      roundingMethod: 'nearest',
      rateProvider: 'manual',
      isActive: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============================================
  // STATS CARDS
  // ============================================
  const StatsCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Configs</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.active}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Currency className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Currencies Used</p>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{stats.currenciesUsed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last Update</p>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {stats.lastUpdate ? formatRelativeTime(stats.lastUpdate) : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================
  // CONFIG TABLE
  // ============================================
  const ConfigTable = () => {
    if (configs.length === 0) {
      return (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Currency Configurations</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Configure per-channel currency conversion rules to sell rooms in different currencies on different channels.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Currency Config
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Currency Configurations</CardTitle>
              <CardDescription>
                Manage currency conversion rules for each channel
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConverterDialog(true)} className="gap-2">
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Converter</span>
              </Button>
              <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Config</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Channel</th>
                  <th className="text-left p-3 font-medium">Conversion</th>
                  <th className="text-left p-3 font-medium">Rate</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Markup</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Type</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Last Updated</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const src = getCurrencyInfo(config.sourceCurrency);
                  const tgt = getCurrencyInfo(config.targetCurrency);
                  return (
                    <tr
                      key={config.id}
                      className={cn(
                        'border-b hover:bg-muted/30 transition-colors',
                        !config.isActive && 'opacity-60'
                      )}
                    >
                      {/* Channel */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: getChannelColor(config.channelCode) }}
                          >
                            {config.channelCode.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[140px]">
                              {config.connectionDisplayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {config.channelCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Conversion */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1">
                                <span className="text-base">{src.flag}</span>
                                <span className="font-medium">{config.sourceCurrency}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{src.name}</TooltipContent>
                          </Tooltip>
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1">
                                <span className="text-base">{tgt.flag}</span>
                                <span className="font-medium">{config.targetCurrency}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{tgt.name}</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="p-3">
                        <span className="font-mono font-semibold">{config.exchangeRate}</span>
                      </td>

                      {/* Markup */}
                      <td className="p-3 hidden md:table-cell">
                        {config.markupPercent > 0 ? (
                          <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            +{config.markupPercent}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="p-3 hidden lg:table-cell">
                        <Badge className={cn('text-xs', getConversionTypeBadge(config.conversionType))}>
                          {config.conversionType.replace('_', ' ')}
                        </Badge>
                      </td>

                      {/* Last Updated */}
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(config.lastRateUpdate)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={cn('text-xs cursor-pointer', getStatusBadgeStyle(config.isActive))}
                          onClick={() => handleToggleActive(config)}
                        >
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(config)} className="gap-2">
                              <Edit className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHistoryDialog(config)} className="gap-2">
                              <History className="h-4 w-4" />
                              Rate History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteItemId(config.id);
                                setShowDeleteDialog(true);
                              }}
                              className="gap-2 text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================
  // CREATE / EDIT FORM
  // ============================================
  const CurrencyForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="space-y-4 py-2">
      {/* Connection selection (create only) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label>Channel Connection *</Label>
          <Select
            value={formData.connectionId}
            onValueChange={(val) => {
              const conn = connections.find((c) => c.id === val);
              setFormData((prev) => ({
                ...prev,
                connectionId: val,
                channelCode: conn?.channel || '',
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a channel connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.length === 0 ? (
                <SelectItem value="none" disabled>
                  No connections available
                </SelectItem>
              ) : (
                connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.displayName || conn.channel}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Currencies row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Source Currency</Label>
          <Select
            value={formData.sourceCurrency}
            onValueChange={(val) => setFormData((prev) => ({ ...prev, sourceCurrency: val }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Target Currency *</Label>
          <Select
            value={formData.targetCurrency}
            onValueChange={(val) => setFormData((prev) => ({ ...prev, targetCurrency: val }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Exchange Rate *</Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={formData.exchangeRate}
            onChange={(e) => setFormData((prev) => ({ ...prev, exchangeRate: e.target.value }))}
            placeholder="1.0000"
          />
          <p className="text-xs text-muted-foreground">
            1 {formData.sourceCurrency} = X {formData.targetCurrency}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Markup (%)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.markupPercent}
            onChange={(e) => setFormData((prev) => ({ ...prev, markupPercent: e.target.value }))}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Added on top of converted rate
          </p>
        </div>
      </div>

      {/* Conversion Type & Rounding */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Conversion Type</Label>
          <Select
            value={formData.conversionType}
            onValueChange={(val) => setFormData((prev) => ({ ...prev, conversionType: val }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="auto">Auto (Live Rates)</SelectItem>
              <SelectItem value="fixed_rate">Fixed Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rounding</Label>
          <Select
            value={formData.roundingMethod}
            onValueChange={(val) => setFormData((prev) => ({ ...prev, roundingMethod: val }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest Cent</SelectItem>
              <SelectItem value="up">Round Up</SelectItem>
              <SelectItem value="down">Round Down</SelectItem>
              <SelectItem value="none">No Rounding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rate Provider */}
      <div className="space-y-2">
        <Label>Rate Provider</Label>
        <Select
          value={formData.rateProvider}
          onValueChange={(val) => setFormData((prev) => ({ ...prev, rateProvider: val }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual Entry</SelectItem>
            <SelectItem value="ecb">European Central Bank</SelectItem>
            <SelectItem value="open_exchange">Open Exchange Rates</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div>
          <Label>Active</Label>
          <p className="text-xs text-muted-foreground">Enable this currency conversion rule</p>
        </div>
        <Switch
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
        />
      </div>

      {/* Preview */}
      {formData.exchangeRate && parseFloat(formData.exchangeRate) > 0 && (
        <Alert className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">Preview</AlertTitle>
          <AlertDescription className="text-sm">
            A rate of <span className="font-mono font-semibold">{formData.sourceCurrency} 100.00</span> converts to{' '}
            <span className="font-mono font-semibold">
              {formData.targetCurrency}{' '}
              {(100 * parseFloat(formData.exchangeRate) * (1 + parseFloat(formData.markupPercent || '0') / 100)).toFixed(2)}
            </span>{' '}
            with {formData.markupPercent !== '0' ? `${formData.markupPercent}% markup and ` : ''}
            {formData.roundingMethod} rounding.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  // ============================================
  // CONVERTER PANEL
  // ============================================
  const ConverterPanel = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Calculator className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Currency Converter Preview</CardTitle>
            <CardDescription>Test currency conversion with your configured rules</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Config selector */}
          <div className="space-y-2">
            <Label>Configuration</Label>
            <Select value={converterConfigId} onValueChange={setConverterConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a currency config" />
              </SelectTrigger>
              <SelectContent>
                {configs.filter(c => c.isActive).length === 0 ? (
                  <SelectItem value="none" disabled>No active configs</SelectItem>
                ) : (
                  configs
                    .filter((c) => c.isActive)
                    .map((c) => {
                      const src = getCurrencyInfo(c.sourceCurrency);
                      const tgt = getCurrencyInfo(c.targetCurrency);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {src.flag} {c.sourceCurrency} → {tgt.flag} {c.targetCurrency} ({c.connectionDisplayName})
                        </SelectItem>
                      );
                    })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Base rate input */}
          <div className="space-y-2">
            <Label>
              Base Rate{' '}
              {converterConfigId && configs.find((c) => c.id === converterConfigId) && (
                <span className="text-muted-foreground font-normal">
                  ({configs.find((c) => c.id === converterConfigId)!.sourceCurrency})
                </span>
              )}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={converterBaseRate}
              onChange={(e) => setConverterBaseRate(e.target.value)}
              placeholder="100.00"
            />
          </div>

          {/* Convert button */}
          <div className="space-y-2">
            <Label className="opacity-0">Action</Label>
            <Button
              onClick={handleConvert}
              disabled={isConverting || !converterConfigId || !converterBaseRate}
              className="w-full gap-2"
            >
              {isConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Convert
            </Button>
          </div>
        </div>

        {/* Result */}
        {converterResult && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Base Rate</p>
                <p className="text-2xl font-bold">
                  {getCurrencyInfo(converterResult.sourceCurrency).flag}{' '}
                  {converterResult.baseRate.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{converterResult.sourceCurrency}</p>
              </div>
              <div className="flex flex-col items-center gap-1 px-4">
                <ArrowRightLeft className="h-5 w-5 text-violet-500" />
                <p className="text-xs text-muted-foreground">×{converterResult.exchangeRate}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Converted Rate</p>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                  {getCurrencyInfo(converterResult.targetCurrency).flag}{' '}
                  {converterResult.convertedRate.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{converterResult.targetCurrency}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ============================================
  // RATE HISTORY TIMELINE
  // ============================================
  const HistoryTimeline = () => {
    if (!selectedConfig || !selectedConfig.history || selectedConfig.history.length === 0) {
      return (
        <div className="text-center py-8">
          <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No rate history available for this configuration</p>
        </div>
      );
    }

    const src = getCurrencyInfo(selectedConfig.sourceCurrency);
    const tgt = getCurrencyInfo(selectedConfig.targetCurrency);

    return (
      <div className="space-y-1 py-2">
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50">
          <span className="text-lg">{src.flag}</span>
          <span className="font-medium">{selectedConfig.sourceCurrency}</span>
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg">{tgt.flag}</span>
          <span className="font-medium">{selectedConfig.targetCurrency}</span>
          <Badge className={cn('text-xs ml-auto', getConversionTypeBadge(selectedConfig.conversionType))}>
            {selectedConfig.conversionType}
          </Badge>
        </div>

        <div className="relative space-y-0">
          {selectedConfig.history.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-3 pb-4">
              {/* Timeline line */}
              {index < selectedConfig.history!.length - 1 && (
                <div className="absolute left-[9px] top-5 w-0.5 bg-border" style={{ height: 'calc(100% - 4px)' }} />
              )}
              {/* Timeline dot */}
              <div
                className={cn(
                  'mt-1 h-[18px] w-[18px] rounded-full border-2 flex-shrink-0 z-10',
                  !entry.effectiveTo
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-background border-muted-foreground/30'
                )}
              />
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-mono font-semibold text-sm">{entry.exchangeRate}</p>
                  {!entry.effectiveTo && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  From: {formatDate(entry.effectiveFrom)}
                  {entry.effectiveTo && ` → To: ${formatDate(entry.effectiveTo)}`}
                </p>
                {entry.changedBy && (
                  <p className="text-xs text-muted-foreground">Changed by: {entry.changedBy}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================
  // MOBILE SHEETS
  // ============================================
  const MobileCreateSheet = () => (
    <Sheet open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <SheetContent side="bottom" className="h-[90vh] px-0 flex flex-col">
        <SheetHeader className="px-4 flex-shrink-0">
          <SheetTitle>Add Currency Configuration</SheetTitle>
          <SheetDescription>
            Configure currency conversion for a channel
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4" style={{ height: 'calc(90vh - 160px)' }}>
          <CurrencyForm isEdit={false} />
        </ScrollArea>
        <SheetFooter className="px-4 py-4 border-t bg-background flex-shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  const MobileEditSheet = () => (
    <Sheet open={showEditDialog} onOpenChange={setShowEditDialog}>
      <SheetContent side="bottom" className="h-[90vh] px-0 flex flex-col">
        <SheetHeader className="px-4 flex-shrink-0">
          <SheetTitle>Edit Currency Configuration</SheetTitle>
          <SheetDescription>
            Update currency conversion settings
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4" style={{ height: 'calc(90vh - 160px)' }}>
          <CurrencyForm isEdit={true} />
        </ScrollArea>
        <SheetFooter className="px-4 py-4 border-t bg-background flex-shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  const MobileHistorySheet = () => (
    <Sheet open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
      <SheetContent side="bottom" className="h-[70vh] px-0 flex flex-col">
        <SheetHeader className="px-4 flex-shrink-0">
          <SheetTitle>Rate History</SheetTitle>
          <SheetDescription>
            Timeline of exchange rate changes
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4" style={{ height: 'calc(70vh - 140px)' }}>
          <HistoryTimeline />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Globe className="h-5 w-5 text-violet-500" />
              Currency Configuration
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure per-channel currency conversion rules for different markets
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Config
            </Button>
          </div>
        </div>

        {/* Stats */}
        <StatsCards />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="configs" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Configurations
            </TabsTrigger>
            <TabsTrigger value="converter" className="gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Converter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configs" className="mt-4 space-y-4">
            <ConfigTable />
          </TabsContent>

          <TabsContent value="converter" className="mt-4">
            <ConverterPanel />
          </TabsContent>
        </Tabs>

        {/* Desktop: Create Dialog */}
        {!isMobile && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Currency Configuration</DialogTitle>
                <DialogDescription>
                  Configure currency conversion for a channel connection
                </DialogDescription>
              </DialogHeader>
              <CurrencyForm isEdit={false} />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Configuration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Desktop: Edit Dialog */}
        {!isMobile && (
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Currency Configuration</DialogTitle>
                <DialogDescription>
                  Update the currency conversion settings
                </DialogDescription>
              </DialogHeader>
              <CurrencyForm isEdit={true} />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Desktop: History Dialog */}
        {!isMobile && (
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Rate History</DialogTitle>
                <DialogDescription>
                  Timeline of exchange rate changes for this configuration
                </DialogDescription>
              </DialogHeader>
              <HistoryTimeline />
            </DialogContent>
          </Dialog>
        )}

        {/* Mobile: Sheets */}
        {isMobile && <MobileCreateSheet />}
        {isMobile && <MobileEditSheet />}
        {isMobile && <MobileHistorySheet />}

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Currency Configuration</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this currency configuration? This action cannot be undone and
                all associated rate history will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

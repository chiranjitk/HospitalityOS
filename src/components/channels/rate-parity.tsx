'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  CalendarDays,
  Building2,
  Settings2,
  Zap,
  ArrowDown,
  ArrowUp,
  Minus,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Property {
  id: string;
  name: string;
  city?: string;
  currency?: string;
}

interface ChannelParityCheck {
  channelName: string;
  channelId: string;
  connectionId: string;
  pmsRate: number;
  channelRate: number;
  deviationPercent: number;
  deviationAmount: number;
  parityStatus: 'matched' | 'undercut' | 'overpriced';
  recommendedRate: number;
  strategyApplied: string;
}

interface ParityReport {
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  pmsBaseRate: number;
  pmsCurrency: string;
  threshold: number;
  strategy: string;
  channels: ChannelParityCheck[];
  overallStatus: 'matched' | 'undercut' | 'overpriced';
  lowestRate: number;
  highestRate: number;
  averageRate: number;
  recommendedRate: number;
  priceFloor?: number;
  checkedAt: string;
}

interface ParitySummary {
  totalChecks: number;
  matched: number;
  undercut: number;
  overpriced: number;
  avgDeviation: number;
  totalRevenueImpact: number;
}

interface CorrectionResult {
  corrected: number;
  skipped: number;
  errors: number;
  details: {
    channelId: string;
    channelName: string;
    roomTypeId: string;
    date: string;
    oldRate: number;
    newRate: number;
  }[];
}

type PricingStrategy = 'match_lowest' | 'price_floor' | 'match_pms';

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number, currency?: string): string {
  const c = currency || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: c,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${c} ${amount.toFixed(0)}`;
  }
}

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getFutureDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const strategyLabels: Record<PricingStrategy, string> = {
  match_lowest: 'Match Lowest',
  price_floor: 'Price Floor',
  match_pms: 'Match PMS',
};

const strategyDescriptions: Record<PricingStrategy, string> = {
  match_lowest: 'Match the lowest rate across all channels',
  price_floor: 'Ensure no channel goes below the price floor',
  match_pms: 'All channels match the PMS base rate',
};

// ============================================
// COMPONENT
// ============================================

export default function RateParityDashboard() {
  // State: properties
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);

  // State: filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [endDate, setEndDate] = useState<string>(getFutureDateString(7));
  const [threshold, setThreshold] = useState<number>(5);
  const [strategy, setStrategy] = useState<PricingStrategy>('match_lowest');

  // State: parity data
  const [reports, setReports] = useState<ParityReport[]>([]);
  const [summary, setSummary] = useState<ParitySummary | null>(null);
  const [parityLoading, setParityLoading] = useState(false);
  const [parityFetched, setParityFetched] = useState(false);

  // State: corrections
  const [applyingCorrections, setApplyingCorrections] = useState(false);
  const [correctionDialog, setCorrectionDialog] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);

  // State: expansion
  const [expandedReportIndex, setExpandedReportIndex] = useState<number | null>(null);

  // State: status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'undercut' | 'overpriced'>('all');

  // ============================================
  // FETCH PROPERTIES
  // ============================================
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchProperties() {
      try {
        const res = await fetch('/api/properties', { signal: controller.signal });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          const mapped: Property[] = data.data.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            city: p.city as string | undefined,
            currency: p.currency as string | undefined,
          }));
          setProperties(mapped);
          if (mapped.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(mapped[0].id);
          }
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          console.error('Error fetching properties:', err);
        }
      } finally {
        if (!cancelled) setPropertiesLoading(false);
      }
    }

    fetchProperties();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // ============================================
  // FETCH PARITY DATA
  // ============================================
  const fetchParityData = useCallback(async () => {
    if (!selectedPropertyId) return;

    setParityLoading(true);
    setParityFetched(true);
    try {
      const params = new URLSearchParams({
        propertyId: selectedPropertyId,
        startDate,
        endDate,
        threshold: String(threshold),
        strategy,
      });
      const res = await fetch(`/api/channel-manager/parity?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        setReports(data.data.reports || []);
        setSummary(data.data.summary || null);
      } else {
        toast.error(data.error?.message || 'Failed to fetch parity data');
        setReports([]);
        setSummary(null);
      }
    } catch {
      toast.error('Network error fetching parity data');
      setReports([]);
      setSummary(null);
    } finally {
      setParityLoading(false);
    }
  }, [selectedPropertyId, startDate, endDate, threshold, strategy]);

  // Reset parity state when property changes (via fetchParityData beginning)
  // State is cleared inside fetchParityData before the API call

  // ============================================
  // APPLY CORRECTIONS
  // ============================================
  const handleApplyCorrections = async () => {
    if (!selectedPropertyId) return;

    setApplyingCorrections(true);
    try {
      const res = await fetch('/api/channel-manager/parity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          strategy,
          threshold,
          dateRange: { start: startDate, end: endDate },
        }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setCorrectionResult(data.data.summary || null);
        toast.success(data.data.message || 'Corrections applied successfully');
        setCorrectionDialog(true);
        // Refresh data
        fetchParityData();
      } else {
        toast.error(data.error?.message || 'Failed to apply corrections');
      }
    } catch {
      toast.error('Network error applying corrections');
    } finally {
      setApplyingCorrections(false);
    }
  };

  // ============================================
  // FILTERED REPORTS
  // ============================================
  const filteredReports = statusFilter === 'all'
    ? reports
    : reports.filter(r => r.overallStatus === statusFilter);

  // ============================================
  // STATUS BADGES
  // ============================================
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" />Matched
          </Badge>
        );
      case 'undercut':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
            <TrendingDown className="h-3 w-3" />Undercut
          </Badge>
        );
      case 'overpriced':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1">
            <TrendingUp className="h-3 w-3" />Overpriced
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDeviationIcon = (deviation: number) => {
    if (deviation < 0) return <ArrowDown className="h-3 w-3 text-red-500" />;
    if (deviation > 0) return <ArrowUp className="h-3 w-3 text-amber-500" />;
    return <Minus className="h-3 w-3 text-emerald-500" />;
  };

  const getDeviationColor = (deviation: number) => {
    if (deviation < 0) return 'text-red-600 dark:text-red-400';
    if (deviation > 0) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (propertiesLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Rate Parity Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and maintain rate consistency across all distribution channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchParityData}
            disabled={parityLoading || !selectedPropertyId}
          >
            {parityLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Check Parity
          </Button>
          <Button
            onClick={handleApplyCorrections}
            disabled={applyingCorrections || !selectedPropertyId || reports.length === 0}
          >
            {applyingCorrections ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Apply Corrections
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Parity Check Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Property Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Property
              </Label>
              <Select
                value={selectedPropertyId}
                onValueChange={(val) => {
                  setSelectedPropertyId(val);
                  setParityFetched(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.city ? `, ${p.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Start Date
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                End Date
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Strategy
              </Label>
              <Select
                value={strategy}
                onValueChange={(val) => setStrategy(val as PricingStrategy)}
              >
                <SelectTrigger className="w-full">
                  <ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(strategyLabels) as PricingStrategy[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {strategyLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Threshold Slider */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Deviation Threshold
              </Label>
              <span className="text-sm font-semibold tabular-nums">{threshold}%</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(val) => setThreshold(val[0])}
              min={0}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>0% (strict)</span>
              <span>Rates within {threshold}% are considered matched</span>
              <span>50% (lenient)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-500/20">
                  <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{summary.totalChecks}</p>
                  <p className="text-xs text-muted-foreground">Total Checks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {summary.matched}
                  </p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                    {summary.undercut}
                  </p>
                  <p className="text-xs text-muted-foreground">Undercut</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    {summary.overpriced}
                  </p>
                  <p className="text-xs text-muted-foreground">Overpriced</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Parity Health Summary */}
      {summary && summary.totalChecks > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Parity Health:</span>
                <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((summary.matched / summary.totalChecks) * 100)}%`,
                      backgroundColor: summary.matched / summary.totalChecks >= 0.8
                        ? 'rgb(16 185 129)'
                        : summary.matched / summary.totalChecks >= 0.5
                          ? 'rgb(245 158 11)'
                          : 'rgb(239 68 68)',
                    }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {Math.round((summary.matched / summary.totalChecks) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Avg Deviation:</span>
                <span className="text-sm font-semibold tabular-nums">
                  {summary.avgDeviation}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Revenue Impact:</span>
                <span className={`text-sm font-semibold tabular-nums ${summary.totalRevenueImpact < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {summary.totalRevenueImpact < 0 ? '' : '+'}{formatCurrency(summary.totalRevenueImpact)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Strategy:</span>
                <Badge variant="secondary" className="text-xs">{strategyLabels[strategy]}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state for parity data */}
      {parityLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      )}

      {/* Empty state: no property selected */}
      {!selectedPropertyId && !parityLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Building2 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Property Selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Select a property from the dropdown above to begin checking rate parity across your distribution channels.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state: property selected but not yet checked */}
      {selectedPropertyId && !parityLoading && !parityFetched && reports.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to Check Parity</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Configure your parameters above and click &quot;Check Parity&quot; to scan rate consistency across all connected channels for{' '}
              {properties.find(p => p.id === selectedPropertyId)?.name}.
            </p>
            <Button onClick={fetchParityData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Parity Check
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No parity issues found */}
      {parityFetched && !parityLoading && reports.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
              <ShieldCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All Rates Match!</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No parity issues detected for the selected period and parameters. All channel rates are within the {threshold}% threshold.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status Filter Tabs */}
      {reports.length > 0 && !parityLoading && (
        <div className="flex items-center gap-2">
          {(['all', 'matched', 'undercut', 'overpriced'] as const).map((status) => {
            const count = status === 'all'
              ? reports.length
              : reports.filter(r => r.overallStatus === status).length;
            const isActive = statusFilter === status;
            return (
              <Button
                key={status}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="gap-1.5"
              >
                {status === 'all' && 'All'}
                {status === 'matched' && <CheckCircle2 className="h-3 w-3" />}
                {status === 'undercut' && <TrendingDown className="h-3 w-3" />}
                {status === 'overpriced' && <TrendingUp className="h-3 w-3" />}
                <span className="text-xs">{count}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Parity Report Table */}
      {filteredReports.length > 0 && !parityLoading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Rate Parity Report
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {filteredReports.length} of {reports.length} checks
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">PMS Rate</TableHead>
                    <TableHead className="text-right">Channel Rates</TableHead>
                    <TableHead className="text-right">Spread</TableHead>
                    <TableHead className="text-right">Avg Deviation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recommended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report, idx) => {
                    const isExpanded = expandedReportIndex === idx;
                    const currency = report.pmsCurrency;
                    const spread = report.highestRate - report.lowestRate;
                    const avgDeviation = report.channels.length > 0
                      ? report.channels.reduce((s, c) => s + Math.abs(c.deviationPercent), 0) / report.channels.length
                      : 0;

                    return (
                      <>
                        <TableRow
                          key={`${report.roomTypeId}-${report.date}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedReportIndex(isExpanded ? null : idx)}
                        >
                          <TableCell className="px-2">
                            <span className={`transition-transform duration-200 inline-block ${isExpanded ? 'rotate-90' : ''}`}>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{report.roomTypeName}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(report.date)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(report.pmsBaseRate, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs text-muted-foreground">
                                {report.channels.length} channel{report.channels.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs tabular-nums">
                                {formatCurrency(report.lowestRate, currency)} – {formatCurrency(report.highestRate, currency)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium tabular-nums ${spread > 0 ? getDeviationColor(spread) : 'text-muted-foreground'}`}>
                              {spread > 0 ? formatCurrency(spread, currency) : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium tabular-nums ${avgDeviation > threshold ? getDeviationColor(avgDeviation) : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {avgDeviation.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(report.overallStatus)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(report.recommendedRate, currency)}
                          </TableCell>
                        </TableRow>
                        {/* Expanded: Channel Rate Comparison */}
                        {isExpanded && (
                          <TableRow key={`detail-${report.roomTypeId}-${report.date}`}>
                            <TableCell colSpan={9} className="bg-muted/30 px-6 py-4">
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <DollarSign className="h-3 w-3" />
                                  Channel Rate Comparison — {report.roomTypeName} on {formatDate(report.date)}
                                </h4>

                                {/* Visual Rate Comparison Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {/* PMS Rate Card */}
                                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-primary">PMS (Base)</span>
                                      <Badge variant="outline" className="text-[10px]">Reference</Badge>
                                    </div>
                                    <p className="text-lg font-bold text-primary tabular-nums">
                                      {formatCurrency(report.pmsBaseRate, currency)}
                                    </p>
                                  </div>

                                  {/* Channel Rate Cards */}
                                  {report.channels.map((ch) => (
                                    <div
                                      key={ch.channelId}
                                      className={`rounded-lg border p-3 transition-colors ${
                                        ch.parityStatus === 'matched'
                                          ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                                          : ch.parityStatus === 'undercut'
                                            ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                                            : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                                          {ch.channelName}
                                        </span>
                                        {getStatusBadge(ch.parityStatus)}
                                      </div>
                                      <p className="text-lg font-bold tabular-nums">
                                        {formatCurrency(ch.channelRate, currency)}
                                      </p>
                                      <div className="flex items-center gap-1 mt-1">
                                        {getDeviationIcon(ch.deviationPercent)}
                                        <span className={`text-xs font-medium tabular-nums ${getDeviationColor(ch.deviationPercent)}`}>
                                          {ch.deviationPercent > 0 ? '+' : ''}{ch.deviationPercent.toFixed(1)}%
                                        </span>
                                        <span className="text-[10px] text-muted-foreground ml-auto">
                                          Rec: {formatCurrency(ch.recommendedRate, currency)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Channel Details Table */}
                                {report.channels.length > 0 && (
                                  <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Channel</TableHead>
                                        <TableHead className="text-right">Channel Rate</TableHead>
                                        <TableHead className="text-right">PMS Rate</TableHead>
                                        <TableHead className="text-right">Deviation</TableHead>
                                        <TableHead className="text-right">Amount Diff</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Recommended</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {report.channels.map((ch) => (
                                        <TableRow key={ch.channelId}>
                                          <TableCell className="font-medium">{ch.channelName}</TableCell>
                                          <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(ch.channelRate, currency)}
                                          </TableCell>
                                          <TableCell className="text-right text-muted-foreground tabular-nums">
                                            {formatCurrency(ch.pmsRate, currency)}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${getDeviationColor(ch.deviationPercent)}`}>
                                              {getDeviationIcon(ch.deviationPercent)}
                                              {ch.deviationPercent > 0 ? '+' : ''}{ch.deviationPercent.toFixed(2)}%
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            <span className={getDeviationColor(ch.deviationAmount)}>
                                              {ch.deviationAmount > 0 ? '+' : ''}{formatCurrency(ch.deviationAmount, currency)}
                                            </span>
                                          </TableCell>
                                          <TableCell>{getStatusBadge(ch.parityStatus)}</TableCell>
                                          <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(ch.recommendedRate, currency)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  </div>
                                )}

                                {/* Summary */}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                                  <span className="flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Strategy: {strategyLabels[report.strategy as PricingStrategy] || report.strategy}
                                  </span>
                                  <span>Threshold: {report.threshold}%</span>
                                  <span>
                                    Spread: {formatCurrency(report.highestRate - report.lowestRate, currency)}
                                  </span>
                                  {report.priceFloor != null && (
                                    <span>Price Floor: {formatCurrency(report.priceFloor, currency)}</span>
                                  )}
                                  <span>
                                    Checked: {new Date(report.checkedAt).toLocaleString('en-IN', {
                                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Impact Summary */}
      {summary && reports.length > 0 && !parityLoading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Total Revenue Impact
                </p>
                <p className={`text-xl font-bold tabular-nums ${summary.totalRevenueImpact < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {summary.totalRevenueImpact < 0 ? '' : '+'}{formatCurrency(summary.totalRevenueImpact)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.totalRevenueImpact < 0
                    ? 'Channels are on average lower than PMS rates'
                    : 'Channels are on average higher than PMS rates'}
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Parity Health Score
                </p>
                <p className={`text-xl font-bold tabular-nums ${
                  summary.matched / summary.totalChecks >= 0.8
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : summary.matched / summary.totalChecks >= 0.5
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {Math.round((summary.matched / summary.totalChecks) * 100)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.matched} of {summary.totalChecks} checks are within threshold
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Issues Requiring Action
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {summary.undercut + summary.overpriced}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.undercut} undercut + {summary.overpriced} overpriced
                </p>
              </div>
            </div>

            {/* Strategy info */}
            <div className="mt-4 rounded-lg bg-muted/50 border p-3 flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Current strategy: {strategyLabels[strategy]}</span>
                {' — '}{strategyDescriptions[strategy]}
                {strategy === 'match_lowest' && ' This ensures competitive pricing across all platforms.'}
                {strategy === 'price_floor' && ' This prevents channels from devaluing your rooms.'}
                {strategy === 'match_pms' && ' This ensures brand consistency on pricing.'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Correction Result Dialog */}
      <Dialog open={correctionDialog} onOpenChange={setCorrectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Corrections Applied
            </DialogTitle>
            <DialogDescription>
              Rate parity corrections have been applied using the &quot;{strategyLabels[strategy]}&quot; strategy.
            </DialogDescription>
          </DialogHeader>
          {correctionResult && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {correctionResult.corrected}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium uppercase">Corrected</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    {correctionResult.skipped}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase">Skipped</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                    {correctionResult.errors}
                  </p>
                  <p className="text-[10px] text-red-500 font-medium uppercase">Errors</p>
                </div>
              </div>

              {correctionResult.details && correctionResult.details.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Changes Applied
                  </p>
                  <div className="space-y-1.5">
                    {correctionResult.details.slice(0, 10).map((detail, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{detail.channelName}</span>
                          <span className="text-muted-foreground">{formatDate(detail.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                          <span className="text-red-600 dark:text-red-400 line-through">
                            {formatCurrency(detail.oldRate)}
                          </span>
                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(detail.newRate)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {correctionResult.details.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ...and {correctionResult.details.length - 10} more changes
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCorrectionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

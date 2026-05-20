'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ShieldAlert, TrendingUp, TrendingDown, DollarSign, Calendar,
  BarChart3, Zap, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Play, CheckCircle, XCircle, Activity, Target,
  Layers, ChevronRight, Minus,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface CancellationPrediction {
  id: string;
  bookingId: string;
  confirmationCode: string;
  riskScore: number;
  riskLevel: string;
  factors: string[];
  predictedAt: string;
}

interface RiskSummary {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  avgRiskScore: number;
}

interface ElasticityResult {
  roomTypeId: string;
  roomTypeName: string;
  period: string;
  elasticityCoefficient: number;
  optimalPrice: number;
  priceFloor: number;
  priceCeiling: number;
  currentAvgRate: number;
  currentOccupancy: number;
  demandSensitivity: string;
  historicalDataPoints: number;
  confidenceScore: number;
  recommendations: string[];
}

interface RevPARSuggestion {
  date: string;
  dayOfWeek: string;
  currentAdr: number;
  currentOccupancy: number;
  currentRevpar: number;
  suggestedRateChange: number;
  suggestedNewRate: number;
  expectedOccupancy: number;
  expectedRevpar: number;
  expectedRevenueImpact: number;
  reasoning: string;
  priority: string;
  factors: string[];
}

interface LosTier {
  id: string;
  minNights: number;
  maxNights: number | null;
  label: string;
  discountPercent: number;
  isActive: boolean;
}

interface SchedulerRun {
  id: string;
  status: string;
  propertyId: string;
  rulesEvaluated: number;
  rulesApplied: number;
  rulesSkipped: number;
  totalRevenueImpact: number;
  startedAt: string;
  completedAt: string | null;
  errorDetails?: string;
}

// ============================================================
// Risk Level Helpers
// ============================================================

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const SENSITIVITY_COLORS: Record<string, string> = {
  elastic: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  normal: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  inelastic: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

// ============================================================
// Main Component
// ============================================================

export default function RevenueManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue Management</h2>
        <p className="text-muted-foreground">Advanced analytics, pricing optimization, and revenue intelligence</p>
      </div>

      <Tabs defaultValue="cancellation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="cancellation" className="text-xs sm:text-sm gap-1">
            <ShieldAlert className="h-4 w-4 hidden sm:block" />
            <span className="truncate">Cancel Risk</span>
          </TabsTrigger>
          <TabsTrigger value="elasticity" className="text-xs sm:text-sm gap-1">
            <BarChart3 className="h-4 w-4 hidden sm:block" />
            <span className="truncate">Elasticity</span>
          </TabsTrigger>
          <TabsTrigger value="revpar" className="text-xs sm:text-sm gap-1">
            <Target className="h-4 w-4 hidden sm:block" />
            <span className="truncate">RevPAR</span>
          </TabsTrigger>
          <TabsTrigger value="los-pricing" className="text-xs sm:text-sm gap-1">
            <Layers className="h-4 w-4 hidden sm:block" />
            <span className="truncate">LOS Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="auto-apply" className="text-xs sm:text-sm gap-1">
            <Zap className="h-4 w-4 hidden sm:block" />
            <span className="truncate">Auto-Apply</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cancellation" className="space-y-4">
          <CancellationPredictionTab />
        </TabsContent>
        <TabsContent value="elasticity" className="space-y-4">
          <PriceElasticityTab />
        </TabsContent>
        <TabsContent value="revpar" className="space-y-4">
          <RevPAROptimizationTab />
        </TabsContent>
        <TabsContent value="los-pricing" className="space-y-4">
          <LosPricingTab />
        </TabsContent>
        <TabsContent value="auto-apply" className="space-y-4">
          <AutoApplyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Tab 1: Cancellation Prediction
// ============================================================

function CancellationPredictionTab() {
  const [predictions, setPredictions] = useState<CancellationPrediction[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/revenue/cancellation-predictions${filterRisk !== 'all' ? `?riskLevel=${filterRisk}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setPredictions(data.data || []);
        setSummary(data.summary || null);
      }
    } catch {
      toast.error('Failed to load predictions');
    } finally {
      setIsLoading(false);
    }
  }, [filterRisk]);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  const handleAutoRun = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/revenue/cancellation-predictions?auto-run=true');
      const data = await res.json();
      if (data.success) {
        toast.success(`Predicted ${data.data.processed} bookings`);
        fetchPredictions();
      } else {
        toast.error('Failed to run predictions');
      }
    } catch {
      toast.error('Failed to run predictions');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPredictions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleAutoRun} disabled={isRunning} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run for All Bookings'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total Predictions</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Low Risk</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{summary.low}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400">Medium Risk</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{summary.medium}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-orange-700 dark:text-orange-400">High Risk</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{summary.high}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-red-700 dark:text-red-400">Critical</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{summary.critical}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Average Risk Score */}
      {summary && summary.avgRiskScore > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Average Risk Score</span>
              <span className="text-sm text-muted-foreground">{(summary.avgRiskScore * 100).toFixed(1)}%</span>
            </div>
            <Progress value={summary.avgRiskScore * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Predictions Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Cancellation Risk Predictions</CardTitle>
          <CardDescription>ML-powered risk analysis for upcoming bookings</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : predictions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No predictions yet</p>
              <p className="text-sm">Click &quot;Run for All Bookings&quot; to generate predictions</p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead className="hidden md:table-cell">Factors</TableHead>
                    <TableHead className="hidden lg:table-cell">Predicted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.confirmationCode}</TableCell>
                      <TableCell>
                        <Badge className={RISK_COLORS[p.riskLevel] || ''}>{p.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Progress value={p.riskScore * 100} className="h-1.5" />
                          </div>
                          <span className="text-sm font-medium">{(p.riskScore * 100).toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[300px]">
                        <div className="flex flex-wrap gap-1">
                          {(typeof p.factors === 'string' ? JSON.parse(p.factors) : p.factors).slice(0, 3).map((f: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{f}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(p.predictedAt), 'MMM d, HH:mm')}
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
    </div>
  );
}

// ============================================================
// Tab 2: Price Elasticity Analysis
// ============================================================

function PriceElasticityTab() {
  const [analyses, setAnalyses] = useState<ElasticityResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('last_30_days');
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // Fetch room types
    (async () => {
      try {
        const res = await fetch('/api/pms/room-types');
        const data = await res.json();
        if (data.success && data.data) {
          setRoomTypes(data.data.map((rt: { id: string; name: string }) => ({ id: rt.id, name: rt.name })));
          if (data.data.length > 0) setSelectedRoomType(data.data[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = selectedRoomType ? `?roomTypeId=${selectedRoomType}` : '';
      const res = await fetch(`/api/revenue/price-elasticity${params}`);
      const data = await res.json();
      if (data.success) setAnalyses(data.data || []);
    } catch {
      toast.error('Failed to load elasticity data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomType]);

  useEffect(() => { if (selectedRoomType) fetchAnalyses(); }, [selectedRoomType, fetchAnalyses]);

  const handleAnalyze = async () => {
    if (!selectedRoomType) return toast.error('Select a room type');
    setIsAnalyzing(true);
    try {
      // Try with propertyId from first available
      const res = await fetch('/api/revenue/price-elasticity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: roomTypes[0]?.id, roomTypeId: selectedRoomType, period: selectedPeriod }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Price elasticity analysis complete');
        fetchAnalyses();
      } else {
        toast.error(data.error || 'Analysis failed');
      }
    } catch {
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const latest = analyses[0];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Room Type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing || !selectedRoomType} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <BarChart3 className="h-4 w-4" />
          {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      ) : latest ? (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-violet-700 dark:text-violet-400">Elasticity Coefficient</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{latest.elasticityCoefficient.toFixed(2)}</p>
                <Badge className={SENSITIVITY_COLORS[latest.demandSensitivity] || ''} variant="outline">
                  {latest.demandSensitivity}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Optimal Price</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">${latest.optimalPrice.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">
                  Floor: ${latest.priceFloor.toFixed(0)} | Ceiling: ${latest.priceCeiling.toFixed(0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-amber-700 dark:text-amber-400">Current Avg Rate</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">${latest.currentAvgRate.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Occupancy: {latest.currentOccupancy.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-sky-700 dark:text-sky-400">Confidence</p>
                <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{(latest.confidenceScore * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{latest.historicalDataPoints} data points</p>
              </CardContent>
            </Card>
          </div>

          {/* Price Range Visualization */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Price Sensitivity Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Price Floor</span>
                    <span className="font-medium">${latest.priceFloor.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Current Rate</span>
                    <span className="font-medium">${latest.currentAvgRate.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Optimal Price</span>
                    <span className="font-medium text-emerald-600">${latest.optimalPrice.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Price Ceiling</span>
                    <span className="font-medium">${latest.priceCeiling.toFixed(0)}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recommendations</p>
                  {latest.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">No analysis data yet</p>
            <p className="text-sm">Select a room type and run analysis</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Tab 3: RevPAR Optimization
// ============================================================

function RevPAROptimizationTab() {
  const [suggestions, setSuggestions] = useState<RevPARSuggestion[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const defaultStart = format(new Date(), 'yyyy-MM-dd');
  const defaultEnd = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = `?propertyId=default&startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(`/api/revenue/revpar-optimize${params}`);
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data || []);
        setSummary(data.summary || null);
      }
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/revenue/revpar-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: 'default', startDate, endDate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Generated ${data.summary?.totalSuggestions || 0} optimization suggestions`);
        fetchSuggestions();
      }
    } catch {
      toast.error('Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const totalImpact = summary?.totalRevenueImpact || 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">From</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[150px]" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">To</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[150px]" />
          </div>
        </div>
        <Button size="sm" onClick={handleOptimize} disabled={isOptimizing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Target className="h-4 w-4" />
          {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Suggestions</p>
              <p className="text-2xl font-bold">{summary.totalSuggestions || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-red-700 dark:text-red-400">Urgent Actions</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{summary.urgentCount || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-orange-700 dark:text-orange-400">High Priority</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{summary.highCount || 0}</p>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${totalImpact > 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : ''}`}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Revenue Impact</p>
              <p className={`text-2xl font-bold ${totalImpact >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
                ${Math.abs(totalImpact).toFixed(0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Suggestions Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Rate Optimization Suggestions</CardTitle>
          <CardDescription>AI-powered suggestions to maximize RevPAR</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No suggestions available</p>
              <p className="text-sm">Run optimization to generate suggestions</p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Suggested</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead className="hidden md:table-cell">RevPAR Impact</TableHead>
                    <TableHead className="hidden lg:table-cell">Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{s.dayOfWeek}</p>
                          <p className="text-xs text-muted-foreground">{s.date}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_COLORS[s.priority] || ''}>{s.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">${s.currentAdr.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground">{s.currentOccupancy.toFixed(0)}% occ</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">${s.suggestedNewRate.toFixed(0)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {s.suggestedRateChange > 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                          )}
                          <span className={`text-sm font-medium ${s.suggestedRateChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {s.suggestedRateChange > 0 ? '+' : ''}{s.suggestedRateChange.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`text-sm font-medium ${s.expectedRevenueImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.expectedRevenueImpact >= 0 ? '+' : ''}{s.expectedRevenueImpact.toFixed(0)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {s.reasoning}
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
    </div>
  );
}

// ============================================================
// Tab 4: LOS Pricing
// ============================================================

function LosPricingTab() {
  const [tiers, setTiers] = useState<LosTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pms/room-types');
        const data = await res.json();
        if (data.success && data.data) {
          setRoomTypes(data.data.map((rt: { id: string; name: string }) => ({ id: rt.id, name: rt.name })));
          if (data.data.length > 0) setSelectedRoomType(data.data[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const fetchTiers = useCallback(async () => {
    if (!selectedRoomType) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/revenue/los-pricing?propertyId=default&roomTypeId=${selectedRoomType}`);
      const data = await res.json();
      if (data.success) setTiers(data.data || []);
    } catch {
      toast.error('Failed to load LOS tiers');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomType]);

  useEffect(() => { fetchTiers(); }, [selectedRoomType, fetchTiers]);

  const handleUpdateDiscount = (index: number, value: number) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], discountPercent: value };
    setTiers(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/revenue/los-pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'default',
          roomTypeId: selectedRoomType,
          tiers: tiers.map(t => ({
            minNights: t.minNights,
            maxNights: t.maxNights,
            label: t.label,
            discountPercent: t.discountPercent,
            isActive: t.isActive,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('LOS pricing tiers updated');
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const basePrice = 150; // Display base price for illustration

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Room Type" />
          </SelectTrigger>
          <SelectContent>
            {roomTypes.map(rt => (
              <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={isSaving || !selectedRoomType} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Layers className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Tiers'}
        </Button>
      </div>

      {/* Info */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-teal-700 dark:text-teal-300 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-teal-900 dark:text-teal-100">Length-of-Stay Pricing</p>
              <p className="text-xs text-teal-700 dark:text-teal-400 mt-1">
                Graduated discounts are automatically applied by the pricing engine when calculating booking rates. 
                Longer stays receive larger discounts to encourage extended bookings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tiers Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <Card key={tier.id || index} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tier.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {tier.minNights}{tier.maxNights ? `-${tier.maxNights}` : '+'} nights
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">
                      {tier.discountPercent > 0 ? `-${tier.discountPercent}%` : 'Standard'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Discount %</label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={tier.discountPercent}
                    onChange={e => handleUpdateDiscount(index, parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Example rate:</span>
                    <span className="font-medium">
                      ${(basePrice * (1 - tier.discountPercent / 100)).toFixed(0)}/night
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 5: Auto-Apply Scheduler
// ============================================================

function AutoApplyTab() {
  const [runs, setRuns] = useState<SchedulerRun[]>([]);
  const [lastRun, setLastRun] = useState<SchedulerRun | null>(null);
  const [nextScheduledRun, setNextScheduledRun] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/revenue/auto-apply');
      const data = await res.json();
      if (data.success) {
        setRuns(data.data?.runs || []);
        setLastRun(data.data?.lastRun || null);
        setNextScheduledRun(data.data?.nextScheduledRun || null);
      }
    } catch {
      toast.error('Failed to load scheduler status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch('/api/revenue/auto-apply', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Scheduler completed: ${data.data.rulesApplied} rules applied`);
        fetchRuns();
      } else {
        toast.error(data.error || 'Scheduler failed');
      }
    } catch {
      toast.error('Failed to trigger scheduler');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Automatically evaluate pricing rules and apply rate changes based on occupancy, seasonality, and demand signals.
          </p>
        </div>
        <Button size="sm" onClick={handleTrigger} disabled={isTriggering} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Play className="h-4 w-4" />
          {isTriggering ? 'Running...' : 'Trigger Now'}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Last Run</span>
            </div>
            {lastRun ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {lastRun.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-lg font-bold capitalize">{lastRun.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(lastRun.startedAt), 'MMM d, yyyy HH:mm')}
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-600">{lastRun.rulesApplied} applied</span>
                  <span className="text-amber-600">{lastRun.rulesSkipped} skipped</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No runs yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Next Scheduled Run</span>
            </div>
            {nextScheduledRun ? (
              <div>
                <p className="text-lg font-bold">{format(new Date(nextScheduledRun), 'MMM d, HH:mm')}</p>
                <p className="text-xs text-muted-foreground">Auto-run interval: every 6 hours</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not scheduled</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Revenue Impact</span>
            </div>
            {lastRun ? (
              <div>
                <p className={`text-2xl font-bold ${lastRun.totalRevenueImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ${lastRun.totalRevenueImpact.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastRun.rulesEvaluated} rules evaluated
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No runs yet</p>
              <p className="text-sm">Click &quot;Trigger Now&quot; to run the scheduler</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Evaluated</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Revenue Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(run.startedAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.completedAt ? format(new Date(run.completedAt), 'HH:mm:ss') : '—'}
                      </TableCell>
                      <TableCell>{run.rulesEvaluated}</TableCell>
                      <TableCell className="text-emerald-600 font-medium">{run.rulesApplied}</TableCell>
                      <TableCell className="text-amber-600">{run.rulesSkipped}</TableCell>
                      <TableCell className={`font-medium ${run.totalRevenueImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ${run.totalRevenueImpact.toFixed(0)}
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
    </div>
  );
}

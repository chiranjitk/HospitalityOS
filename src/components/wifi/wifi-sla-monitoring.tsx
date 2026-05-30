'use client';

/**
 * WiFi SLA Monitoring — F23
 *
 * Service level agreement compliance tracking with compliance cards,
 * property configs, breach history, and trend charts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wifi,
  Gauge,
  Activity,
  Clock,
  Settings,
  Edit,
  Trash2,
  Plus,
  BarChart3,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clampPositive } from '@/lib/wifi/validation';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PropertyRef {
  id: string;
  name: string;
}

interface SLAMetric {
  id: string;
  periodStart: string;
  periodEnd: string;
  actualUptime: number | null;
  avgSpeedDown: number | null;
  avgSpeedUp: number | null;
  avgLatency: number | null;
  totalSessions: number;
  totalBandwidth: number;
  breached: boolean;
  breachTypes: string[];
}

interface SLAConfig {
  id: string;
  propertyId: string;
  property: PropertyRef;
  uptimeTarget: number;
  speedTargetDown: number;
  speedTargetUp: number;
  latencyTarget: number;
  measurementInterval: number;
  alertOnBreach: boolean;
  breachDuration: number;
  createdAt: string;
  updatedAt: string;
  metrics: SLAMetric[];
  _count?: { metrics: number };
}

interface OverallCompliance {
  uptimeCompliance: number | null;
  speedDownCompliance: number | null;
  speedUpCompliance: number | null;
  latencyCompliance: number | null;
  overallScore: number | null;
}

interface BreachSummary {
  totalBreaches: number;
  byType: Record<string, number>;
  trend: { date: string; count: number }[];
}

interface PropertyCompliance {
  propertyId: string;
  propertyName: string;
  configId?: string;
  uptimeTarget: number;
  speedTargetDown: number;
  speedTargetUp: number;
  latencyTarget: number;
  actualUptime: number | null;
  actualSpeedDown: number | null;
  actualSpeedUp: number | null;
  actualLatency: number | null;
  uptimeCompliant: boolean | null;
  speedDownCompliant: boolean | null;
  speedUpCompliant: boolean | null;
  latencyCompliant: boolean | null;
  breachCount: number;
  totalPeriods?: number;
}

interface ComplianceData {
  overallCompliance: OverallCompliance;
  breachSummary: BreachSummary;
  propertyCompliance: PropertyCompliance[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getComplianceColor(compliant: boolean | null): string {
  if (compliant === null) return 'bg-gray-400';
  return compliant ? 'bg-primary' : 'bg-red-500';
}

function getComplianceBadgeVariant(compliant: boolean | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (compliant === null) return 'secondary';
  return compliant ? 'outline' : 'destructive';
}

function getGradientClass(compliant: boolean | null): string {
  if (compliant === null) return '';
  return compliant
    ? 'bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/20 dark:to-emerald-950/10'
    : 'bg-gradient-to-br from-red-50 to-red-50/30 dark:from-red-950/20 dark:to-red-950/10';
}

function getComplianceStatusBadge(compliant: boolean | null) {
  if (compliant === null) {
    return <Badge variant="secondary" className="text-[10px]">N/A</Badge>;
  }
  return compliant ? (
    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] gap-1"><CheckCircle className="h-2.5 w-2.5" />Compliant</Badge>
  ) : (
    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] gap-1"><XCircle className="h-2.5 w-2.5" />Breach</Badge>
  );
}

function ComplianceIndicator({
  label,
  actual,
  target,
  unit,
  inverse = false,
}: {
  label: string;
  actual: number | null;
  target: number;
  unit?: string;
  inverse?: boolean; // true for latency (lower is better)
}) {
  const compliant = actual !== null
    ? inverse ? actual <= target : actual >= target
    : null;

  const percentage = actual !== null
    ? inverse
      ? target > 0 ? Math.min((actual / target) * 100, 100) : 100
      : target > 0 ? Math.min((actual / target) * 100, 120) : 100
    : 0;

  const displayPercentage = Math.min(percentage, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          {compliant !== null && (
            compliant ? (
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums">{actual !== null ? actual.toFixed(1) : '—'}</span>
        <span className="text-xs text-muted-foreground">{unit || ''}</span>
        <span className="text-xs text-muted-foreground ml-1">(target: {target}{unit || ''})</span>
      </div>
      <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getComplianceColor(compliant)}`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiSLAMonitoring() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SLAConfig[]>([]);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SLAConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPropertyId, setCreatePropertyId] = useState('');
  const [availableProperties, setAvailableProperties] = useState<PropertyRef[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<SLAConfig | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    uptimeTarget: 99.9,
    speedTargetDown: 50,
    speedTargetUp: 10,
    latencyTarget: 20,
    measurementInterval: 5,
    alertOnBreach: true,
    breachDuration: 15,
  });

  // ─── Fetch data ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const [configsRes, complianceRes] = await Promise.all([
          fetch('/api/wifi/sla', { signal: controller.signal }),
          fetch('/api/wifi/sla/compliance', { signal: controller.signal }),
        ]);

        const [configsJson, complianceJson] = await Promise.all([configsRes.json(), complianceRes.json()]);

        if (cancelled) return;

        if (configsJson.success) setConfigs(configsJson.data);
        if (complianceJson.success) setComplianceData(complianceJson.data);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch SLA data:', error);
        toast({ title: 'Error', description: 'Failed to load SLA data', variant: 'destructive' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [fetchKey, toast]);

  // ─── Latest metrics for overall compliance cards ──────────────────

  const latestMetrics = useMemo(() => {
    const props = complianceData?.propertyCompliance || [];
    if (props.length === 0) return null;
    // Average across all properties
    const uptimeVals = props.filter(p => p.actualUptime !== null).map(p => p.actualUptime!);
    const speedDownVals = props.filter(p => p.actualSpeedDown !== null).map(p => p.actualSpeedDown!);
    const speedUpVals = props.filter(p => p.actualSpeedUp !== null).map(p => p.actualSpeedUp!);
    const latencyVals = props.filter(p => p.actualLatency !== null).map(p => p.actualLatency!);

    const avgTargets = {
      uptime: props.length > 0 ? props.reduce((s, p) => s + p.uptimeTarget, 0) / props.length : 99.9,
      speedDown: props.length > 0 ? props.reduce((s, p) => s + p.speedTargetDown, 0) / props.length : 50,
      speedUp: props.length > 0 ? props.reduce((s, p) => s + p.speedTargetUp, 0) / props.length : 10,
      latency: props.length > 0 ? props.reduce((s, p) => s + p.latencyTarget, 0) / props.length : 20,
    };

    return {
      actualUptime: uptimeVals.length > 0 ? uptimeVals.reduce((s, v) => s + v, 0) / uptimeVals.length : null,
      actualSpeedDown: speedDownVals.length > 0 ? speedDownVals.reduce((s, v) => s + v, 0) / speedDownVals.length : null,
      actualSpeedUp: speedUpVals.length > 0 ? speedUpVals.reduce((s, v) => s + v, 0) / speedUpVals.length : null,
      actualLatency: latencyVals.length > 0 ? latencyVals.reduce((s, v) => s + v, 0) / latencyVals.length : null,
      targets: avgTargets,
    };
  }, [complianceData]);

  // ─── Dialog handlers ──────────────────────────────────────────────

  const openEdit = (config: SLAConfig) => {
    setEditingConfig(config);
    setFormData({
      uptimeTarget: config.uptimeTarget,
      speedTargetDown: config.speedTargetDown,
      speedTargetUp: config.speedTargetUp,
      latencyTarget: config.latencyTarget,
      measurementInterval: config.measurementInterval,
      alertOnBreach: config.alertOnBreach,
      breachDuration: config.breachDuration,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/wifi/sla/${editingConfig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'SLA config updated' });
        setEditDialogOpen(false);
        setEditingConfig(null);
        setFetchKey(k => k + 1);
      } else {
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update SLA config', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openCreate = async () => {
    setFormData({
      uptimeTarget: 99.9,
      speedTargetDown: 50,
      speedTargetUp: 10,
      latencyTarget: 20,
      measurementInterval: 5,
      alertOnBreach: true,
      breachDuration: 15,
    });
    setCreatePropertyId('');
    setCreateDialogOpen(true);
    // Fetch available properties (those without a config)
    setLoadingProperties(true);
    try {
      const res = await fetch('/api/wifi/sla/available-properties');
      const data = await res.json();
      if (data.success) {
        setAvailableProperties(data.data);
        if (data.data.length === 1) {
          setCreatePropertyId(data.data[0].id);
        }
      }
    } catch {
      toast({ title: 'Warning', description: 'Could not load available properties', variant: 'destructive' });
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleCreate = async (propertyId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/wifi/sla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, ...formData }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: data.message || 'SLA config created' });
        setCreateDialogOpen(false);
        setFetchKey(k => k + 1);
      } else {
        toast({ title: 'Error', description: data.error || 'Creation failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create SLA config', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;
    try {
      const res = await fetch(`/api/wifi/sla/${deletingConfig.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'SLA config deleted' });
        setDeleteDialogOpen(false);
        setDeletingConfig(null);
        setFetchKey(k => k + 1);
      } else {
        toast({ title: 'Error', description: data.error || 'Delete failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete SLA config', variant: 'destructive' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            WiFi SLA Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Track service level agreement compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFetchKey(k => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Config
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="configs" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configs
          </TabsTrigger>
          <TabsTrigger value="breaches" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Breaches
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* SLA Compliance Cards */}
          {latestMetrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={`border-0 shadow-sm ${getGradientClass(latestMetrics.actualUptime !== null ? latestMetrics.actualUptime >= latestMetrics.targets.uptime : null)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Wifi className="h-3.5 w-3.5" /> Uptime
                    </span>
                    {latestMetrics.actualUptime !== null && latestMetrics.actualUptime >= latestMetrics.targets.uptime && (
                      <ArrowUp className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                  <ComplianceIndicator
                    label=""
                    actual={latestMetrics.actualUptime}
                    target={latestMetrics.targets.uptime}
                    unit="%"
                  />
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-sm ${getGradientClass(latestMetrics.actualSpeedDown !== null ? latestMetrics.actualSpeedDown >= latestMetrics.targets.speedDown : null)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5" /> Download Speed
                    </span>
                    {latestMetrics.actualSpeedDown !== null && latestMetrics.actualSpeedDown >= latestMetrics.targets.speedDown && (
                      <ArrowUp className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                  <ComplianceIndicator
                    label=""
                    actual={latestMetrics.actualSpeedDown}
                    target={latestMetrics.targets.speedDown}
                    unit="Mbps"
                  />
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-sm ${getGradientClass(latestMetrics.actualSpeedUp !== null ? latestMetrics.actualSpeedUp >= latestMetrics.targets.speedUp : null)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" /> Upload Speed
                    </span>
                    {latestMetrics.actualSpeedUp !== null && latestMetrics.actualSpeedUp >= latestMetrics.targets.speedUp && (
                      <ArrowUp className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                  <ComplianceIndicator
                    label=""
                    actual={latestMetrics.actualSpeedUp}
                    target={latestMetrics.targets.speedUp}
                    unit="Mbps"
                  />
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-sm ${getGradientClass(latestMetrics.actualLatency !== null ? latestMetrics.actualLatency <= latestMetrics.targets.latency : null)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Latency
                    </span>
                    {latestMetrics.actualLatency !== null && latestMetrics.actualLatency <= latestMetrics.targets.latency && (
                      <ArrowDown className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                  <ComplianceIndicator
                    label=""
                    actual={latestMetrics.actualLatency}
                    target={latestMetrics.targets.latency}
                    unit="ms"
                    inverse
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No SLA configs configured</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Create an SLA config for a property to get started</p>
              </CardContent>
            </Card>
          )}

          {/* Overall Compliance Score */}
          {complianceData?.overallCompliance && complianceData.overallCompliance.overallScore !== null && (
            <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/8 via-primary/5 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Overall SLA Compliance</p>
                    <div className="flex items-center gap-3">
                      <p className="text-4xl font-bold tabular-nums text-primary">
                        {complianceData.overallCompliance.overallScore}%
                      </p>
                      <div className="relative">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        <div className="absolute inset-0 h-3 w-3 rounded-full bg-primary animate-ping opacity-75" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {complianceData.breachSummary?.totalBreaches ?? 0} breach events in last 30 days
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Uptime', val: complianceData.overallCompliance.uptimeCompliance },
                      { label: 'Download', val: complianceData.overallCompliance.speedDownCompliance },
                      { label: 'Upload', val: complianceData.overallCompliance.speedUpCompliance },
                      { label: 'Latency', val: complianceData.overallCompliance.latencyCompliance },
                    ].map(item => (
                      <div key={item.label} className="text-center p-3 rounded-lg bg-white/60 dark:bg-gray-900/40">
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                        <p className={`text-lg font-bold tabular-nums ${
                          item.val !== null && item.val >= 90 ? 'text-primary' :
                          item.val !== null && item.val >= 70 ? 'text-amber-600' :
                          item.val !== null ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {item.val !== null ? `${item.val}%` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SLA Trend Chart (simplified bar chart) */}
          {complianceData?.breachSummary?.trend && complianceData.breachSummary.trend.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Breach Trend (Last 30 Days)</CardTitle>
                <CardDescription className="text-xs">Daily breach event count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-[3px] h-[120px]">
                  {complianceData.breachSummary.trend.map((day, i) => {
                    const maxBreaches = Math.max(...complianceData.breachSummary.trend.map(d => d.count), 1);
                    const height = (day.count / maxBreaches) * 100;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center justify-end"
                        title={`${day.date}: ${day.count} breaches`}
                      >
                        <div
                          className={`w-full rounded-t-sm min-h-[2px] ${
                            day.count === 0 ? 'bg-primary/60' :
                            day.count <= 2 ? 'bg-amber-400' :
                            'bg-red-400'
                          }`}
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        {i % 5 === 0 && (
                          <span className="text-[7px] text-muted-foreground mt-1">
                            {day.date.slice(5)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                    <span className="text-[10px] text-muted-foreground">No breaches</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-muted-foreground">1-2 breaches</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-[10px] text-muted-foreground">3+ breaches</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Configs Tab ───────────────────────────────────────── */}
        <TabsContent value="configs" className="space-y-4">
          {configs.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Settings className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No SLA configs configured</p>
                <Button size="sm" className="mt-3" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Config
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => {
                const latestMetric = config.metrics?.[0];
                return (
                  <Card key={config.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2">
                                <Shield className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{config.property.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Updated {new Date(config.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(config)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => { setDeletingConfig(config); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Uptime Target</p>
                              <p className="text-sm font-semibold tabular-nums">{config.uptimeTarget}%</p>
                              {latestMetric?.actualUptime !== undefined && (
                                <Badge variant={getComplianceBadgeVariant(latestMetric.actualUptime >= config.uptimeTarget)} className="text-[10px] mt-1">
                                  {latestMetric.actualUptime.toFixed(1)}% {latestMetric.actualUptime >= config.uptimeTarget ? '✓' : '✗'}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Download Target</p>
                              <p className="text-sm font-semibold tabular-nums">{config.speedTargetDown} Mbps</p>
                              {latestMetric?.avgSpeedDown !== undefined && latestMetric?.avgSpeedDown !== null && (
                                <Badge variant={getComplianceBadgeVariant(latestMetric.avgSpeedDown >= config.speedTargetDown)} className="text-[10px] mt-1">
                                  {latestMetric.avgSpeedDown.toFixed(1)} Mbps {latestMetric.avgSpeedDown >= config.speedTargetDown ? '✓' : '✗'}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Upload Target</p>
                              <p className="text-sm font-semibold tabular-nums">{config.speedTargetUp} Mbps</p>
                              {latestMetric?.avgSpeedUp !== undefined && latestMetric?.avgSpeedUp !== null && (
                                <Badge variant={getComplianceBadgeVariant(latestMetric.avgSpeedUp >= config.speedTargetUp)} className="text-[10px] mt-1">
                                  {latestMetric.avgSpeedUp.toFixed(1)} Mbps {latestMetric.avgSpeedUp >= config.speedTargetUp ? '✓' : '✗'}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Latency Target</p>
                              <p className="text-sm font-semibold tabular-nums">{config.latencyTarget} ms</p>
                              {latestMetric?.avgLatency !== undefined && latestMetric?.avgLatency !== null && (
                                <Badge variant={getComplianceBadgeVariant(latestMetric.avgLatency <= config.latencyTarget)} className="text-[10px] mt-1">
                                  {latestMetric.avgLatency.toFixed(0)} ms {latestMetric.avgLatency <= config.latencyTarget ? '✓' : '✗'}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span>Interval: {config.measurementInterval}m</span>
                            <span>Breach alert: {config.alertOnBreach ? `${config.breachDuration}m` : 'disabled'}</span>
                            <span>Metrics: {config._count?.metrics || 0}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Breaches Tab ──────────────────────────────────────── */}
        <TabsContent value="breaches" className="space-y-4">
          {/* Breach History Table */}
          {complianceData && complianceData.propertyCompliance.length > 0 ? (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Property Breach Summary</CardTitle>
                <CardDescription className="text-xs">Breach counts and compliance per property</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold">Property</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Uptime</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Download</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Upload</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Latency</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Breaches</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceData.propertyCompliance.map((prop) => (
                      <TableRow key={prop.propertyId} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <span className="text-sm font-medium">{prop.propertyName}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getComplianceStatusBadge(prop.uptimeCompliant)}
                          {prop.actualUptime !== null && <p className="text-[10px] text-muted-foreground mt-0.5">{prop.actualUptime.toFixed(1)}%</p>}
                        </TableCell>
                        <TableCell className="text-center">
                          {getComplianceStatusBadge(prop.speedDownCompliant)}
                          {prop.actualSpeedDown !== null && <p className="text-[10px] text-muted-foreground mt-0.5">{prop.actualSpeedDown.toFixed(1)} Mbps</p>}
                        </TableCell>
                        <TableCell className="text-center">
                          {getComplianceStatusBadge(prop.speedUpCompliant)}
                          {prop.actualSpeedUp !== null && <p className="text-[10px] text-muted-foreground mt-0.5">{prop.actualSpeedUp.toFixed(1)} Mbps</p>}
                        </TableCell>
                        <TableCell className="text-center">
                          {getComplianceStatusBadge(prop.latencyCompliant)}
                          {prop.actualLatency !== null && <p className="text-[10px] text-muted-foreground mt-0.5">{prop.actualLatency.toFixed(0)} ms</p>}
                        </TableCell>
                        <TableCell className="text-center">
                          {getComplianceStatusBadge(prop.breachCount === 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={prop.breachCount > 5 ? 'bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]' : prop.breachCount > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px]' : 'bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]'}
                          >
                            {prop.breachCount}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle className="h-10 w-10 text-primary/40 mb-3" />
                <p className="text-sm text-muted-foreground">No breach data available</p>
              </CardContent>
            </Card>
          )}

          {/* Breach by Type */}
          {complianceData?.breachSummary?.byType && Object.keys(complianceData.breachSummary.byType).length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Breach Breakdown by Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(complianceData.breachSummary.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-xs font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                      <Badge variant={count > 10 ? 'destructive' : 'outline'} className="text-[10px]">
                        {count} events
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Edit SLA Config Dialog ────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit SLA Targets</DialogTitle>
            <DialogDescription>Update service level agreement targets for {editingConfig?.property.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Uptime Target (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="90"
                  max="100"
                  value={formData.uptimeTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, uptimeTarget: clampPositive(parseFloat(e.target.value), 90, 100, 99.9) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Latency Target (ms)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="1000"
                  value={formData.latencyTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, latencyTarget: clampPositive(parseInt(e.target.value), 1, 1000, 20) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Download Target (Mbps)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.speedTargetDown}
                  onChange={(e) => setFormData(prev => ({ ...prev, speedTargetDown: clampPositive(parseFloat(e.target.value), 1, 10000, 50) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Upload Target (Mbps)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.speedTargetUp}
                  onChange={(e) => setFormData(prev => ({ ...prev, speedTargetUp: clampPositive(parseFloat(e.target.value), 1, 10000, 10) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Measurement Interval (min)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.measurementInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, measurementInterval: clampPositive(parseInt(e.target.value), 1, 1440, 5) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Breach Duration (min)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.breachDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, breachDuration: clampPositive(parseInt(e.target.value), 1, 10080, 15) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Alert on Breach</p>
                <p className="text-[10px] text-muted-foreground">Send notification when SLA is breached</p>
              </div>
              <Switch
                checked={formData.alertOnBreach}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alertOnBreach: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create SLA Config Dialog ───────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create SLA Config</DialogTitle>
            <DialogDescription>Set up service level targets for a property</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              {loadingProperties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading properties...
                </div>
              ) : availableProperties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available properties found. All properties already have SLA configs.</p>
              ) : (
                <Select value={createPropertyId} onValueChange={setCreatePropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Uptime Target (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.uptimeTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, uptimeTarget: clampPositive(parseFloat(e.target.value), 90, 100, 99.9) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Latency Target (ms)</Label>
                <Input
                  type="number"
                  step="1"
                  value={formData.latencyTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, latencyTarget: clampPositive(parseInt(e.target.value), 1, 1000, 20) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Download Target (Mbps)</Label>
                <Input
                  type="number"
                  step="1"
                  value={formData.speedTargetDown}
                  onChange={(e) => setFormData(prev => ({ ...prev, speedTargetDown: clampPositive(parseFloat(e.target.value), 1, 10000, 50) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Upload Target (Mbps)</Label>
                <Input
                  type="number"
                  step="1"
                  value={formData.speedTargetUp}
                  onChange={(e) => setFormData(prev => ({ ...prev, speedTargetUp: clampPositive(parseFloat(e.target.value), 1, 10000, 10) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Alert on Breach</p>
                <p className="text-[10px] text-muted-foreground">Send notification when SLA is breached</p>
              </div>
              <Switch
                checked={formData.alertOnBreach}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alertOnBreach: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (createPropertyId) handleCreate(createPropertyId); }} disabled={saving || !createPropertyId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete SLA Config</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the SLA config for <strong>{deletingConfig?.property.name}</strong>?
              This will also remove all associated metrics.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

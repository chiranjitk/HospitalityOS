'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Hotel, ArrowUpDown, Clock, Zap, Shield, Play, RefreshCw,
  Plus, Trash2, Edit3, ToggleLeft, ToggleRight, AlertTriangle,
  TrendingUp, TrendingDown, Send, PackageOpen, CheckCircle, XCircle,
  Calendar, BarChart3, Layers, Activity, Settings, Info,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface OverbookingConfig {
  id: string;
  enabled: boolean;
  maxOverbookPercent: number;
  minCancellationRisk: number;
  allowedRoomTypes: string[];
  upgradePaths: Array<{ fromRoomTypeId: string; toRoomTypeId: string }>;
  blacklistDates: string[];
  bufferDays: number;
}

interface OverbookingStatusItem {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  confirmedBookings: number;
  activeSlots: number;
  usedSlots: number;
  availableExtra: number;
  confidence: number;
  status: string;
}

interface OverbookingSummary {
  roomTypesWithSlots: number;
  totalActiveSlots: number;
  totalUsedSlots: number;
  totalAvailable: number;
  avgConfidence: number;
  overbookingEnabled: boolean;
}

interface OverbookingSlotResult {
  roomTypeId: string;
  roomTypeName: string;
  maxExtraRooms: number;
  confidence: number;
  expectedCancellations: number;
  totalRooms: number;
}

interface LastMinuteTrigger {
  id: string;
  name: string;
  enabled: boolean;
  triggerHoursBeforeCheckin: number;
  action: 'increase_rate' | 'decrease_rate' | 'send_offer' | 'release_inventory';
  value: number;
  minOccupancy: number;
  maxOccupancy: number;
  channelScope: 'all' | 'direct_only' | 'ota_only';
  roomTypeIds: string[];
  repeatOnDays: number[];
}

interface TriggerLog {
  id: string;
  triggerId: string;
  triggerName: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  action: string;
  value: number;
  result: Record<string, unknown>;
  createdAt: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ACTION_COLORS: Record<string, string> = {
  increase_rate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  decrease_rate: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  send_offer: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  release_inventory: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  increase_rate: <TrendingUp className="h-4 w-4" />,
  decrease_rate: <TrendingDown className="h-4 w-4" />,
  send_offer: <Send className="h-4 w-4" />,
  release_inventory: <PackageOpen className="h-4 w-4" />,
};

const SCOPE_LABELS: Record<string, string> = {
  all: 'All Channels',
  direct_only: 'Direct Only',
  ota_only: 'OTA Only',
};

// ============================================================
// Main Component
// ============================================================

export default function RevenueAutomation() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue Automation</h2>
        <p className="text-muted-foreground">
          Auto-overbooking engine and last-minute pricing triggers — AioSell-grade revenue intelligence
        </p>
      </div>

      <Tabs defaultValue="overbooking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overbooking" className="gap-1.5">
            <Hotel className="h-4 w-4 hidden sm:block" />
            <span>Auto-Overbooking</span>
          </TabsTrigger>
          <TabsTrigger value="last-minute" className="gap-1.5">
            <Clock className="h-4 w-4 hidden sm:block" />
            <span>Last-Minute Triggers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overbooking" className="space-y-4">
          <AutoOverbookingTab />
        </TabsContent>
        <TabsContent value="last-minute" className="space-y-4">
          <LastMinuteTriggersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Tab 1: Auto-Overbooking
// ============================================================

function AutoOverbookingTab() {
  const [config, setConfig] = useState<OverbookingConfig | null>(null);
  const [status, setStatus] = useState<OverbookingStatusItem[]>([]);
  const [summary, setSummary] = useState<OverbookingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Editable config state
  const [editMaxPercent, setEditMaxPercent] = useState(5);
  const [editMinRisk, setEditMinRisk] = useState(15);
  const [editBufferDays, setEditBufferDays] = useState(1);
  const [editEnabled, setEditEnabled] = useState(false);

  const propertyId = 'default';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/revenue/overbooking?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) {
        setConfig(data.data.config);
        setStatus(data.data.status || []);
        setSummary(data.data.summary || null);
        if (data.data.config) {
          setEditMaxPercent(data.data.config.maxOverbookPercent);
          setEditMinRisk(Math.round(data.data.config.minCancellationRisk * 100));
          setEditBufferDays(data.data.config.bufferDays);
          setEditEnabled(data.data.config.enabled);
        }
      }
    } catch {
      toast.error('Failed to load overbooking data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const res = await fetch('/api/revenue/overbooking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const slots = data.data.slots || [];
        const created = data.data.totalSlotsCreated || 0;
        const updated = data.data.totalSlotsUpdated || 0;
        toast.success(`Overbooking calculated: ${created} new, ${updated} updated slots`);
        fetchData();
      } else {
        toast.error(data.error || 'Calculation failed');
      }
    } catch {
      toast.error('Failed to calculate overbooking');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/revenue/overbooking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          enabled: editEnabled,
          maxOverbookPercent: editMaxPercent,
          minCancellationRisk: editMinRisk / 100,
          bufferDays: editBufferDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Overbooking configuration saved');
        setShowConfig(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {config?.enabled ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 gap-1">
              <ToggleRight className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <ToggleLeft className="h-3 w-3" /> Inactive
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} disabled={isLoading} className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configure
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCalculate} disabled={isCalculating || !config?.enabled} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Zap className="h-4 w-4" />
            {isCalculating ? 'Calculating...' : 'Calculate Overbooking'}
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && config && (
        <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overbooking Configuration</CardTitle>
            <CardDescription>Configure how the auto-overbooking engine operates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Auto-Overbooking</Label>
                <p className="text-xs text-muted-foreground">Allow the system to overbook rooms based on cancellation predictions</p>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Max Overbooking %</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={editMaxPercent}
                  onChange={e => setEditMaxPercent(parseInt(e.target.value) || 5)}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Max extra rooms as % of total</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Min Cancel Risk %</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editMinRisk}
                  onChange={e => setEditMinRisk(parseInt(e.target.value) || 15)}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Only overbook if avg risk exceeds this</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Buffer Days</Label>
                <Input
                  type="number"
                  min={0}
                  max={7}
                  value={editBufferDays}
                  onChange={e => setEditBufferDays(parseInt(e.target.value) || 1)}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Stop overbooking N days before check-in</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveConfig} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
                How Auto-Overbooking Works
              </p>
              <p className="text-xs text-teal-700 dark:text-teal-400 mt-1">
                The engine analyzes cancellation predictions for confirmed bookings. When expected cancellations
                support it, virtual overbooking slots are created. These slots get absorbed when actual cancellations
                occur. If rooms are overbooked at check-in, guests are auto-upgraded based on configured upgrade paths.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                {summary.overbookingEnabled ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-lg font-bold">{summary.overbookingEnabled ? 'Active' : 'Inactive'}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-sky-700 dark:text-sky-400">Room Types</p>
              <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{summary.roomTypesWithSlots}</p>
              <p className="text-[10px] text-sky-600 dark:text-sky-400">with active slots</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Active Slots</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{summary.totalActiveSlots}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{summary.totalUsedSlots} used</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-violet-700 dark:text-violet-400">Available</p>
              <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{summary.totalAvailable}</p>
              <p className="text-[10px] text-violet-600 dark:text-violet-400">extra rooms</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-2xl font-bold">{(summary.avgConfidence * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">prediction coverage</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overbooking Status Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overbooking Status by Room Type</CardTitle>
          <CardDescription>Current overbooking slots and usage for today</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : status.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Hotel className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No overbooking data yet</p>
              <p className="text-sm">
                {config?.enabled
                  ? 'Click "Calculate Overbooking" to generate slots'
                  : 'Enable auto-overbooking in configuration first'}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Total Rooms</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Active Slots</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="hidden md:table-cell">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.roomTypeName}</TableCell>
                      <TableCell>{s.totalRooms}</TableCell>
                      <TableCell>{s.confirmedBookings}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950">
                          {s.activeSlots}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.usedSlots}</TableCell>
                      <TableCell>
                        <Badge className={s.availableExtra > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}>
                          {s.availableExtra}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-12">
                            <Progress value={s.confidence * 100} className="h-1.5" />
                          </div>
                          <span className="text-xs">{(s.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 2: Last-Minute Triggers
// ============================================================

function LastMinuteTriggersTab() {
  const [triggers, setTriggers] = useState<LastMinuteTrigger[]>([]);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [summary, setSummary] = useState<{ total: number; enabled: number; disabled: number; actionBreakdown: Record<string, number> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<LastMinuteTrigger | null>(null);
  const [evalResults, setEvalResults] = useState<unknown[] | null>(null);

  const propertyId = 'default';

  // Create form state
  const [formName, setFormName] = useState('');
  const [formHours, setFormHours] = useState(48);
  const [formAction, setFormAction] = useState<'increase_rate' | 'decrease_rate' | 'send_offer' | 'release_inventory'>('decrease_rate');
  const [formValue, setFormValue] = useState(10);
  const [formMinOcc, setFormMinOcc] = useState(0);
  const [formMaxOcc, setFormMaxOcc] = useState(100);
  const [formScope, setFormScope] = useState<'all' | 'direct_only' | 'ota_only'>('all');

  const resetForm = () => {
    setFormName('');
    setFormHours(48);
    setFormAction('decrease_rate');
    setFormValue(10);
    setFormMinOcc(0);
    setFormMaxOcc(100);
    setFormScope('all');
    setEditingTrigger(null);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/revenue/last-minute-triggers?propertyId=${propertyId}&logs=true`);
      const data = await res.json();
      if (data.success) {
        setTriggers(data.data.triggers || []);
        setLogs(data.data.logs || []);
        setSummary(data.data.summary || null);
      }
    } catch {
      toast.error('Failed to load triggers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!formName.trim()) return toast.error('Name is required');
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: formName.trim(),
          enabled: true,
          triggerHoursBeforeCheckin: formHours,
          action: formAction,
          value: formValue,
          minOccupancy: formMinOcc,
          maxOccupancy: formMaxOcc,
          channelScope: formScope,
          roomTypeIds: [],
          repeatOnDays: [0, 1, 2, 3, 4, 5, 6],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Trigger created');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create trigger');
    }
  };

  const handleUpdate = async () => {
    if (!editingTrigger) return;
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId: editingTrigger.id,
          name: formName.trim(),
          triggerHoursBeforeCheckin: formHours,
          action: formAction,
          value: formValue,
          minOccupancy: formMinOcc,
          maxOccupancy: formMaxOcc,
          channelScope: formScope,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Trigger updated');
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update trigger');
    }
  };

  const handleDelete = async (triggerId: string) => {
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Trigger deleted');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete trigger');
    }
  };

  const handleToggle = async (trigger: LastMinuteTrigger) => {
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId: trigger.id, enabled: !trigger.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(trigger.enabled ? 'Trigger disabled' : 'Trigger enabled');
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle trigger');
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvalResults(null);
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', propertyId }),
      });
      const data = await res.json();
      if (data.success) {
        setEvalResults(data.data.results || []);
        toast.info(`${data.data.wouldFire || 0} triggers would fire, ${data.data.wouldSkip || 0} skipped`);
      }
    } catch {
      toast.error('Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/revenue/last-minute-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', propertyId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data.processed} trigger actions executed`);
        fetchData();
      }
    } catch {
      toast.error('Run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const startEdit = (trigger: LastMinuteTrigger) => {
    setEditingTrigger(trigger);
    setFormName(trigger.name);
    setFormHours(trigger.triggerHoursBeforeCheckin);
    setFormAction(trigger.action);
    setFormValue(trigger.value);
    setFormMinOcc(trigger.minOccupancy);
    setFormMaxOcc(trigger.maxOccupancy);
    setFormScope(trigger.channelScope);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {summary && (
            <>
              <Badge variant="outline">{summary.total} triggers</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                {summary.enabled} active
              </Badge>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4" />
                New Trigger
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Last-Minute Trigger</DialogTitle>
                <DialogDescription>
                  Configure automated pricing action before check-in
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Trigger Name</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 48hr Flash Sale" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hours Before Check-in</Label>
                    <Select value={String(formHours)} onValueChange={v => setFormHours(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="6">6 hours</SelectItem>
                        <SelectItem value="3">3 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Action</Label>
                    <Select value={formAction} onValueChange={v => setFormAction(v as typeof formAction)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase_rate">Increase Rate</SelectItem>
                        <SelectItem value="decrease_rate">Decrease Rate</SelectItem>
                        <SelectItem value="send_offer">Send Offer</SelectItem>
                        <SelectItem value="release_inventory">Release Inventory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Value %</Label>
                    <Input type="number" min={1} max={50} value={formValue} onChange={e => setFormValue(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min Occ %</Label>
                    <Input type="number" min={0} max={100} value={formMinOcc} onChange={e => setFormMinOcc(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Occ %</Label>
                    <Input type="number" min={0} max={100} value={formMaxOcc} onChange={e => setFormMaxOcc(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Channel Scope</Label>
                  <Select value={formScope} onValueChange={v => setFormScope(v as typeof formScope)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="direct_only">Direct Only</SelectItem>
                      <SelectItem value="ota_only">OTA Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!formName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleEvaluate} disabled={isEvaluating} className="gap-1.5">
            <Activity className="h-4 w-4" />
            {isEvaluating ? 'Evaluating...' : 'Dry Run'}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Execute All'}
          </Button>
        </div>
      </div>

      {/* Evaluation Results */}
      {evalResults && Array.isArray(evalResults) && evalResults.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-sky-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dry Run Results</CardTitle>
            <CardDescription>Preview of what would happen if triggers ran now</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(evalResults as Array<Record<string, unknown>>).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{String(r.triggerName)}</TableCell>
                      <TableCell className="text-sm">{String(r.roomTypeName)}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[String(r.action)] || ''}>{String(r.action)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{String(r.currentOccupancy)}%</TableCell>
                      <TableCell>
                        {r.fired ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Fires</Badge>
                        ) : (
                          <Badge variant="outline">Skipped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Triggers List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configured Triggers</CardTitle>
          <CardDescription>Last-minute pricing automation rules (48hr, 24hr, 12hr, 6hr, 3hr windows)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : triggers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No triggers configured</p>
              <p className="text-sm">Create a trigger to automate last-minute pricing decisions</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {t.triggerHoursBeforeCheckin}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[t.action] || ''}>
                          {ACTION_ICONS[t.action]}
                          <span className="ml-1 capitalize">{t.action.replace('_', ' ')}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {t.value}%
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.minOccupancy}-{t.maxOccupancy}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {SCOPE_LABELS[t.channelScope]}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(t)}
                          className="h-7 px-2"
                        >
                          {t.enabled ? (
                            <ToggleRight className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(t)}
                            className="h-7 px-2"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(t.id)}
                            className="h-7 px-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTrigger} onOpenChange={() => resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Trigger</DialogTitle>
            <DialogDescription>Update trigger configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Hours Before</Label>
                <Select value={String(formHours)} onValueChange={v => setFormHours(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">48h</SelectItem>
                    <SelectItem value="24">24h</SelectItem>
                    <SelectItem value="12">12h</SelectItem>
                    <SelectItem value="6">6h</SelectItem>
                    <SelectItem value="3">3h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Action</Label>
                <Select value={formAction} onValueChange={v => setFormAction(v as typeof formAction)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase_rate">Increase Rate</SelectItem>
                    <SelectItem value="decrease_rate">Decrease Rate</SelectItem>
                    <SelectItem value="send_offer">Send Offer</SelectItem>
                    <SelectItem value="release_inventory">Release Inv.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Value %</Label>
                <Input type="number" min={1} max={50} value={formValue} onChange={e => setFormValue(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min Occ %</Label>
                <Input type="number" min={0} max={100} value={formMinOcc} onChange={e => setFormMinOcc(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Occ %</Label>
                <Input type="number" min={0} max={100} value={formMaxOcc} onChange={e => setFormMaxOcc(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!formName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Log */}
      {logs.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Execution Log</CardTitle>
            <CardDescription>Recent trigger firings and results</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="hidden md:table-cell">Result</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm font-medium">{log.triggerName}</TableCell>
                      <TableCell className="text-sm">{log.roomTypeName}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[log.action] || ''}>{log.action.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.value}%</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.result).slice(0, 50)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {log.createdAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

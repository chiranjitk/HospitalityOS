'use client';

/**
 * WiFi Health Alerts — Standalone Page
 *
 * Comprehensive alert management for WiFi hardware monitoring.
 * Accessed from the WiFi sidebar menu item "Health Alerts" (wifi-health-alerts).
 *
 * Features:
 *  - Property selector (Hardware Box Location) to scope alerts
 *  - Alert Rules table with CRUD and enable/disable toggle
 *  - Add Rule dialog with metric, operator, threshold, cooldown, label
 *  - Active Alerts panel with acknowledge button
 *  - Alert History panel showing resolved alerts
 *  - 15-second auto-poll for live alert state
 *
 * API endpoints:
 *  - GET  /api/wifi/health?action=alerts          — rules, active, history, properties
 *  - GET  /api/wifi/health?action=metrics          — system metrics (interface list)
 *  - POST /api/wifi/health?action=set-alert-rules  — save/toggle rules
 *  - POST /api/wifi/health?action=delete-alert-rule — delete rule
 *  - POST /api/wifi/health?action=acknowledge-alert — acknowledge alert
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Settings,
  History,
  Check,
  Building2,
  Loader2,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  label: string;
  cooldownSec: number;
  enabled: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  propertyId?: string;
  interfaceName?: string;
}

interface ActiveAlert {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  value: number;
  label?: string;
  interfaceName?: string;
  triggeredAt: string;
  status: 'active' | 'acknowledged';
  ruleId?: string;
}

interface HistoryAlert {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  label?: string;
  interfaceName?: string;
  triggeredAt: string;
  resolvedAt: string;
  value?: number;
  ruleId?: string;
}

interface AlertProperty {
  id: string;
  name: string;
  city?: string;
}

interface NewRuleForm {
  metric: string;
  operator: string;
  threshold: string;
  label: string;
  cooldownSec: number;
  interfaceName: string;
  notifyEmail: boolean;
  notifySms: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const METRIC_OPTIONS = [
  { value: 'cpu', label: 'CPU Usage (%)' },
  { value: 'memory', label: 'Memory Usage (%)' },
  { value: 'disk', label: 'Disk Usage (%)' },
  { value: 'interface_rx', label: 'Interface RX (bytes/s)' },
  { value: 'interface_tx', label: 'Interface TX (bytes/s)' },
  { value: 'active_sessions', label: 'Active Sessions' },
  { value: 'auth_reject_rate', label: 'Auth Reject Rate (%)' },
  { value: 'radius_health', label: 'RADIUS Health (%)' },
] as const;

const OPERATOR_OPTIONS = [
  { value: '>', label: '> (Greater than)' },
  { value: '>=', label: '>= (Greater or equal)' },
  { value: '<', label: '< (Less than)' },
  { value: '<=', label: '<= (Less or equal)' },
] as const;

const DEFAULT_NEW_RULE: NewRuleForm = {
  metric: 'cpu',
  operator: '>',
  threshold: '',
  label: '',
  cooldownSec: 300,
  interfaceName: '',
  notifyEmail: true,
  notifySms: false,
};

const POLL_INTERVAL_MS = 15_000;

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiHealthAlerts() {
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────────────────

  // Data
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<HistoryAlert[]>([]);
  const [alertProperties, setAlertProperties] = useState<AlertProperty[]>([]);
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([]);

  // UI
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Add Rule dialog
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<NewRuleForm>(DEFAULT_NEW_RULE);

  // ─── Fetch alerts (rules + active + history + properties) ─────────────────

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'alerts' });
      if (selectedProperty) params.set('propertyId', selectedProperty);

      const res = await fetch(`/api/wifi/health?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        const d = result.data;
        setAlertRules(d?.rules || []);
        setActiveAlerts(d?.active || []);
        setAlertHistory(d?.history || []);
        setAlertProperties(d?.properties || []);
      }
    } catch {
      // silent — will retry on next poll
    } finally {
      setIsLoading(false);
    }
  }, [selectedProperty]);

  // Initial load + 15-second polling
  useEffect(() => {
    setIsLoading(true);
    fetchAlerts();

    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // ─── Acknowledge alert ────────────────────────────────────────────────────

  const handleAckAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/wifi/health?action=acknowledge-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      const result = await res.json();

      if (result.success) {
        // Optimistic update — mark as acknowledged in local state
        setActiveAlerts(prev =>
          prev.map(a => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)),
        );
        toast({ title: 'Alert Acknowledged' });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to acknowledge alert',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    }
  };

  // ─── Save new rule ────────────────────────────────────────────────────────

  const handleSaveRule = async () => {
    if (!newRule.threshold || isNaN(parseFloat(newRule.threshold))) {
      toast({ title: 'Validation Error', description: 'Please enter a valid threshold number', variant: 'destructive' });
      return;
    }

    const cooldownSec = Math.max(30, newRule.cooldownSec || 300);

    setIsSaving(true);
    try {
      const rulePayload: Record<string, unknown> = {
        metric: newRule.metric,
        operator: newRule.operator,
        threshold: parseFloat(newRule.threshold),
        label: newRule.label || undefined,
        cooldownSec,
        enabled: true,
        notifyEmail: newRule.notifyEmail,
        notifySms: newRule.notifySms,
      };

      // Attach property if selected
      if (selectedProperty) rulePayload.propertyId = selectedProperty;

      // Only include interface name for interface metrics
      if (
        (newRule.metric === 'interface_rx' || newRule.metric === 'interface_tx') &&
        newRule.interfaceName
      ) {
        rulePayload.interfaceName = newRule.interfaceName;
      }

      const res = await fetch('/api/wifi/health?action=set-alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: [...alertRules, rulePayload] }),
      });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Rule Created', description: 'Alert rule has been saved successfully' });
        setShowAddRule(false);
        setNewRule(DEFAULT_NEW_RULE);
        fetchAlerts();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save rule',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save rule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Toggle rule enabled/disabled ─────────────────────────────────────────

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/wifi/health?action=set-alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: alertRules.map(r => (r.id === ruleId ? { ...r, enabled } : r)),
        }),
      });
      const result = await res.json();

      if (result.success) {
        setAlertRules(prev =>
          prev.map(r => (r.id === ruleId ? { ...r, enabled } : r)),
        );
      }
    } catch {
      // silent
    }
  };

  // ─── Delete rule ──────────────────────────────────────────────────────────

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch('/api/wifi/health?action=delete-alert-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Rule Deleted' });
        fetchAlerts();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete rule',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  // ─── Open Add Rule dialog (fetch interfaces for metric select) ────────────

  const handleOpenAddRule = async () => {
    setNewRule(DEFAULT_NEW_RULE);

    // Fetch metrics to get interface list
    try {
      const res = await fetch('/api/wifi/health?action=metrics');
      const result = await res.json();
      if (result.success && result.data?.interfaces) {
        setAvailableInterfaces(
          (result.data.interfaces as Array<{ name: string }>)
            .map(i => i.name)
            .filter(n => n !== 'lo'),
        );
      }
    } catch {
      // silent — interfaces will remain empty
    }

    setShowAddRule(true);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const formatCooldown = (seconds: number): string => {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
    return `${seconds}s`;
  };

  const formatTimestamp = (ts: string): string => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  };

  const unacknowledgedCount = activeAlerts.filter(a => a.status !== 'acknowledged').length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Health Alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor WiFi hardware metrics and manage alert thresholds for all properties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {unacknowledgedCount} Unacknowledged
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Property Filter Card ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Hardware Box Location:</span>
            </div>
            <Select
              value={selectedProperty || '__all__'}
              onValueChange={v => setSelectedProperty(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Properties</SelectItem>
                {alertProperties.map((p: AlertProperty) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.city ? ` — ${p.city}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {selectedProperty
                ? 'Showing alerts for selected property'
                : 'Showing alerts across all properties'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Loading State ─── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading health alerts&hellip;</p>
        </div>
      ) : (
        <>
          {/* ─── Alert Rules Card ─── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Alert Rules
                  <span className="text-xs text-muted-foreground font-normal">
                    ({alertRules.length} rule{alertRules.length !== 1 ? 's' : ''})
                  </span>
                </CardTitle>
                <Button size="sm" onClick={handleOpenAddRule}>
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <div className="max-h-96 overflow-x-auto overflow-y-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">Metric</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Condition</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-right">Threshold</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Label</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Notify</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Cooldown</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Enabled</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Settings className="h-6 w-6 text-muted-foreground/40" />
                            <span>
                              No alert rules configured for this{' '}
                              {selectedProperty ? 'property' : 'scope'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1"
                              onClick={handleOpenAddRule}
                            >
                              <Plus className="h-3 w-3 mr-1.5" />
                              Create First Rule
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      alertRules.map((rule: AlertRule) => (
                        <TableRow
                          key={rule.id}
                          className={cn(!rule.enabled && 'opacity-50')}
                        >
                          {/* Metric */}
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="capitalize">
                                {rule.metric.replace(/_/g, ' ')}
                              </span>
                              {rule.interfaceName && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 font-mono"
                                >
                                  {rule.interfaceName}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Condition */}
                          <TableCell className="font-mono text-sm">
                            {rule.operator}
                          </TableCell>

                          {/* Threshold */}
                          <TableCell className="text-right font-mono tabular-nums">
                            {rule.threshold}
                          </TableCell>

                          {/* Label */}
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {rule.label || '—'}
                          </TableCell>

                          {/* Notification channels */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div title={rule.notifyEmail ? 'Email enabled' : 'Email disabled'}>
                                <Badge
                                  variant={rule.notifyEmail ? 'default' : 'outline'}
                                  className={cn(
                                    'text-[10px] px-1.5 py-0 gap-0.5 cursor-default',
                                    !rule.notifyEmail && 'opacity-30',
                                  )}
                                >
                                  <Mail className="h-2.5 w-2.5" />
                                </Badge>
                              </div>
                              <div title={rule.notifySms ? 'SMS enabled' : 'SMS disabled'}>
                                <Badge
                                  variant={rule.notifySms ? 'default' : 'outline'}
                                  className={cn(
                                    'text-[10px] px-1.5 py-0 gap-0.5 cursor-default',
                                    !rule.notifySms && 'opacity-30',
                                  )}
                                >
                                  <MessageSquare className="h-2.5 w-2.5" />
                                </Badge>
                              </div>
                            </div>
                          </TableCell>

                          {/* Cooldown */}
                          <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                            {formatCooldown(rule.cooldownSec)}
                          </TableCell>

                          {/* Enabled */}
                          <TableCell className="text-center">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) =>
                                handleToggleRule(rule.id, checked)
                              }
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ─── Active Alerts Card ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Active Alerts
                {activeAlerts.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {activeAlerts.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  All clear — no active alerts
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activeAlerts.map((alert: ActiveAlert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                        alert.status === 'acknowledged'
                          ? 'border-slate-200 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-700'
                          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700',
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          'h-4 w-4 shrink-0',
                          alert.status === 'acknowledged'
                            ? 'text-muted-foreground'
                            : 'text-amber-500 dark:text-amber-400',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {alert.label ||
                            `${alert.metric} ${alert.operator} ${alert.threshold}`}
                          {alert.interfaceName && (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                              [{alert.interfaceName}]
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Current:{' '}
                          <span className="font-mono tabular-nums">
                            {alert.value}
                          </span>
                          {' · '}
                          Threshold: <span className="font-mono">{alert.threshold}</span>
                          {alert.triggeredAt && (
                            <span className="ml-2">
                              {formatTimestamp(alert.triggeredAt)}
                            </span>
                          )}
                        </p>
                      </div>
                      {alert.status !== 'acknowledged' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => handleAckAlert(alert.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Ack
                        </Button>
                      )}
                      {alert.status === 'acknowledged' && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        >
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Alert History Card ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Alert History
                {alertHistory.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({alertHistory.length} resolved)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertHistory.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <History className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No resolved alerts in history
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Resolved alerts will appear here
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-1.5">
                    {alertHistory.map((item: HistoryAlert, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 text-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate">
                            {item.label ||
                              `${item.metric} ${item.operator} ${item.threshold}`}
                            {item.interfaceName && (
                              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                [{item.interfaceName}]
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Triggered:{' '}
                            {item.triggeredAt
                              ? formatTimestamp(item.triggeredAt)
                              : '—'}
                            {item.resolvedAt && (
                              <span>
                                {' · '}
                                Resolved: {formatTimestamp(item.resolvedAt)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Add Rule Dialog ─── */}
      <Dialog
        open={showAddRule}
        onOpenChange={(open) => {
          setShowAddRule(open);
          if (!open) setNewRule(DEFAULT_NEW_RULE);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Alert Rule
            </DialogTitle>
            <DialogDescription>
              Configure a new alert threshold for system monitoring. Alerts fire when
              the metric crosses the threshold and cooldown has elapsed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Metric */}
            <div className="grid gap-2">
              <Label htmlFor="rule-metric">Metric</Label>
              <Select
                value={newRule.metric}
                onValueChange={(v) =>
                  setNewRule(prev => ({
                    ...prev,
                    metric: v,
                    interfaceName: '',
                  }))
                }
              >
                <SelectTrigger id="rule-metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interface (conditional — only for interface_rx / interface_tx) */}
            {(newRule.metric === 'interface_rx' ||
              newRule.metric === 'interface_tx') && (
              <div className="grid gap-2">
                <Label htmlFor="rule-interface">Interface</Label>
                {availableInterfaces.length > 0 ? (
                  <Select
                    value={newRule.interfaceName}
                    onValueChange={(v) =>
                      setNewRule(prev => ({ ...prev, interfaceName: v }))
                    }
                  >
                    <SelectTrigger id="rule-interface">
                      <SelectValue placeholder="Select interface" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInterfaces.map(name => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="rule-interface"
                    placeholder="e.g. eth0, wlan0"
                    value={newRule.interfaceName}
                    onChange={(e) =>
                      setNewRule(prev => ({
                        ...prev,
                        interfaceName: e.target.value,
                      }))
                    }
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {availableInterfaces.length > 0
                    ? 'Select from detected network interfaces'
                    : 'No interfaces detected — type the interface name manually'}
                </p>
              </div>
            )}

            {/* Operator */}
            <div className="grid gap-2">
              <Label htmlFor="rule-operator">Condition</Label>
              <Select
                value={newRule.operator}
                onValueChange={(v) =>
                  setNewRule(prev => ({ ...prev, operator: v }))
                }
              >
                <SelectTrigger id="rule-operator">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Threshold */}
            <div className="grid gap-2">
              <Label htmlFor="rule-threshold">Threshold</Label>
              <Input
                id="rule-threshold"
                type="number"
                step="any"
                placeholder="e.g. 80"
                value={newRule.threshold}
                onChange={(e) =>
                  setNewRule(prev => ({ ...prev, threshold: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                The numeric value that triggers the alert when the condition is met.
              </p>
            </div>

            {/* Cooldown */}
            <div className="grid gap-2">
              <Label htmlFor="rule-cooldown">Cooldown (seconds)</Label>
              <Input
                id="rule-cooldown"
                type="number"
                min={30}
                step={30}
                placeholder="300"
                value={newRule.cooldownSec || ''}
                onChange={(e) =>
                  setNewRule(prev => ({
                    ...prev,
                    cooldownSec: parseInt(e.target.value) || 300,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between repeated alerts for this rule (minimum 30s).
              </p>
            </div>

            {/* Label */}
            <div className="grid gap-2">
              <Label htmlFor="rule-label">
                Label{' '}
                <span className="text-xs text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="rule-label"
                placeholder="e.g. High CPU on primary gateway"
                value={newRule.label}
                onChange={(e) =>
                  setNewRule(prev => ({ ...prev, label: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                A human-readable description for this alert rule.
              </p>
            </div>

            {/* Notification Channels */}
            <div className="rounded-lg border p-3 space-y-3">
              <Label className="text-sm font-medium">Notification Channels</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Choose how to be notified when this alert fires. Requires email/SMS configured in Settings.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Email</span>
                  <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                </div>
                <Switch
                  checked={newRule.notifyEmail}
                  onCheckedChange={(checked) =>
                    setNewRule(prev => ({ ...prev, notifyEmail: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">SMS</span>
                  <Badge variant="secondary" className="text-[10px]">For critical alerts</Badge>
                </div>
                <Switch
                  checked={newRule.notifySms}
                  onCheckedChange={(checked) =>
                    setNewRule(prev => ({ ...prev, notifySms: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddRule(false);
                setNewRule(DEFAULT_NEW_RULE);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={!newRule.threshold || isNaN(parseFloat(newRule.threshold)) || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving&hellip;
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Create Rule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

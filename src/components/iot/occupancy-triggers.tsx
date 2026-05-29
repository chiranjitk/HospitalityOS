'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Activity,
  Plus,
  Edit,
  Trash2,
  Zap,
  Thermometer,
  Lightbulb,
  Bell,
  ToggleLeft,
  Clock,
  Settings,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────

interface OccupancyTriggerAction {
  type:
    | 'set_room_status'
    | 'create_housekeeping_task'
    | 'adjust_thermostat'
    | 'toggle_lights'
    | 'send_notification'
    | 'update_energy_mode';
  params: Record<string, unknown>;
}

interface OccupancyTriggerRule {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId?: string;
  name: string;
  description?: string;
  triggerType:
    | 'room_occupied'
    | 'room_vacant'
    | 'occupancy_threshold'
    | 'no_motion_timeout';
  sensorType: 'motion' | 'co2' | 'door' | 'infrared' | 'pressure';
  thresholdValue?: number;
  actions: OccupancyTriggerAction[];
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Property {
  id: string;
  name: string;
}

// ─── Config ─────────────────────────────────────────────────────────

const TRIGGER_TYPE_CONFIG: Record<
  OccupancyTriggerRule['triggerType'],
  { label: string; color: string }
> = {
  room_occupied: { label: 'Room Occupied', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  room_vacant: { label: 'Room Vacant', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' },
  occupancy_threshold: { label: 'Occupancy Threshold', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  no_motion_timeout: { label: 'No Motion Timeout', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

const SENSOR_TYPE_CONFIG: Record<
  OccupancyTriggerRule['sensorType'],
  { label: string; icon: typeof Zap }
> = {
  motion: { label: 'Motion Sensor', icon: Activity },
  co2: { label: 'CO₂ Sensor', icon: Thermometer },
  door: { label: 'Door Sensor', icon: ToggleLeft },
  infrared: { label: 'Infrared', icon: Thermometer },
  pressure: { label: 'Pressure Mat', icon: Settings },
};

const ACTION_TYPE_CONFIG: Record<
  OccupancyTriggerAction['type'],
  { label: string; icon: typeof Zap }
> = {
  set_room_status: { label: 'Set Room Status', icon: Settings },
  create_housekeeping_task: { label: 'Create HK Task', icon: ToggleLeft },
  adjust_thermostat: { label: 'Adjust Thermostat', icon: Thermometer },
  toggle_lights: { label: 'Toggle Lights', icon: Lightbulb },
  send_notification: { label: 'Send Notification', icon: Bell },
  update_energy_mode: { label: 'Update Energy Mode', icon: Zap },
};

const ACTION_PARAM_FIELDS: Record<
  OccupancyTriggerAction['type'],
  Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }>
> = {
  set_room_status: [
    { key: 'status', label: 'Status', type: 'select', options: ['occupied', 'vacant', 'maintenance', 'cleaning'] },
  ],
  create_housekeeping_task: [
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
    { key: 'taskType', label: 'Task Type', type: 'select', options: ['cleaning', 'maintenance', 'inspection', 'restock'] },
  ],
  adjust_thermostat: [
    { key: 'temperature', label: 'Temperature (°C)', type: 'number' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['auto', 'heat', 'cool', 'off'] },
  ],
  toggle_lights: [
    { key: 'state', label: 'State', type: 'select', options: ['on', 'off', 'dim'] },
    { key: 'brightness', label: 'Brightness %', type: 'number' },
  ],
  send_notification: [
    { key: 'recipient', label: 'Recipient', type: 'select', options: ['housekeeping', 'front_desk', 'manager', 'guest'] },
    { key: 'message', label: 'Message', type: 'text' },
  ],
  update_energy_mode: [
    { key: 'mode', label: 'Energy Mode', type: 'select', options: ['eco', 'comfort', 'away', 'sleep'] },
  ],
};

interface ActionFormState {
  type: OccupancyTriggerAction['type'];
  params: Record<string, unknown>;
}

interface RuleFormState {
  name: string;
  description: string;
  triggerType: OccupancyTriggerRule['triggerType'];
  sensorType: OccupancyTriggerRule['sensorType'];
  thresholdValue: string;
  actions: ActionFormState[];
  cooldownMinutes: string;
  isActive: boolean;
}

const DEFAULT_FORM: RuleFormState = {
  name: '',
  description: '',
  triggerType: 'room_occupied',
  sensorType: 'motion',
  thresholdValue: '0.5',
  actions: [{ type: 'set_room_status', params: {} }],
  cooldownMinutes: '30',
  isActive: true,
};

// ─── Component ──────────────────────────────────────────────────────

export default function OccupancyTriggers() {
  const { user } = useAuth();
  const [rules, setRules] = useState<OccupancyTriggerRule[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OccupancyTriggerRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);

  // ── Fetch properties ──
  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchProperties = async () => {
      try {
        const res = await fetch(`/api/pms/properties?tenantId=${user.tenantId}`);
        if (res.ok) {
          const json = await res.json();
          const items = json.data ?? json.properties ?? json.items ?? [];
          setProperties(
            (Array.isArray(items) ? items : []).map((p: Record<string, unknown>) => ({
              id: p.id as string,
              name: p.name as string,
            }))
          );
        }
      } catch {
        // silently ignore
      }
    };
    fetchProperties();
  }, [user?.tenantId]);

  // ── Fetch rules ──
  const fetchRules = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') {
        params.append('propertyId', selectedPropertyId);
      }
      const res = await fetch(`/api/iot/occupancy-triggers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const items = json.data?.rules ?? json.rules ?? json.data ?? [];
        setRules(Array.isArray(items) ? items : []);
      }
    } catch {
      toast.error('Failed to fetch occupancy trigger rules');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, selectedPropertyId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ── Computed ──
  const activeRules = rules.filter((r) => r.isActive);
  const totalActions = rules.reduce((sum, r) => sum + r.actions.length, 0);

  // ── Form helpers ──
  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: OccupancyTriggerRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      triggerType: rule.triggerType,
      sensorType: rule.sensorType,
      thresholdValue: rule.thresholdValue != null ? String(rule.thresholdValue) : '0.5',
      actions: rule.actions.length > 0
        ? rule.actions.map((a) => ({ type: a.type, params: { ...a.params } }))
        : [{ type: 'set_room_status', params: {} }],
      cooldownMinutes: String(rule.cooldownMinutes),
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const updateForm = (updates: Partial<RuleFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const addAction = () => {
    updateForm({
      actions: [...form.actions, { type: 'set_room_status', params: {} }],
    });
  };

  const removeAction = (index: number) => {
    updateForm({
      actions: form.actions.filter((_, i) => i !== index),
    });
  };

  const updateAction = (index: number, updates: Partial<ActionFormState>) => {
    const newActions = [...form.actions];
    newActions[index] = { ...newActions[index], ...updates };
    updateForm({ actions: newActions });
  };

  const updateActionParam = (actionIndex: number, key: string, value: unknown) => {
    const newActions = [...form.actions];
    newActions[actionIndex] = {
      ...newActions[actionIndex],
      params: { ...newActions[actionIndex].params, [key]: value },
    };
    updateForm({ actions: newActions });
  };

  // ── Save handler ──
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (!user?.tenantId) return;

    const targetPropertyId =
      selectedPropertyId !== 'all' ? selectedPropertyId : properties[0]?.id;

    if (!targetPropertyId) {
      toast.error('Please select a property first');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        propertyId: targetPropertyId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        triggerType: form.triggerType,
        sensorType: form.sensorType,
        thresholdValue:
          form.triggerType === 'occupancy_threshold'
            ? parseFloat(form.thresholdValue) || 0.5
            : undefined,
        actions: form.actions.map((a) => ({ type: a.type, params: a.params })),
        cooldownMinutes: parseInt(form.cooldownMinutes, 10) || 30,
        isActive: form.isActive,
      };

      if (editingRule) {
        body.id = editingRule.id;
      }

      const res = await fetch('/api/iot/occupancy-triggers', {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
        setDialogOpen(false);
        fetchRules();
      } else {
        toast.error(json.error || 'Failed to save rule');
      }
    } catch {
      toast.error('Network error: Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handler ──
  const confirmDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/iot/occupancy-triggers?id=${deletingId}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (json.success) {
        toast.success('Rule deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingId(null);
        fetchRules();
      } else {
        toast.error(json.error || 'Failed to delete rule');
      }
    } catch {
      toast.error('Network error: Failed to delete rule');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──
  const handleToggleActive = async (rule: OccupancyTriggerRule) => {
    try {
      const res = await fetch('/api/iot/occupancy-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Rule "${rule.name}" ${!rule.isActive ? 'activated' : 'deactivated'}`);
        fetchRules();
      } else {
        toast.error(json.error || 'Failed to update rule');
      }
    } catch {
      toast.error('Network error: Failed to update rule');
    }
  };

  // ── Format helpers ──
  const formatDate = (ts: string) => {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (type: OccupancyTriggerAction['type']) => {
    const Icon = ACTION_TYPE_CONFIG[type]?.icon || Zap;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const getSensorIcon = (type: OccupancyTriggerRule['sensorType']) => {
    const Icon = SENSOR_TYPE_CONFIG[type]?.icon || Activity;
    return <Icon className="h-3.5 w-3.5" />;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400 mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading occupancy triggers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Occupancy Triggers</h1>
          <p className="text-muted-foreground">
            Manage automated IoT trigger rules based on room occupancy and sensor data
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchRules}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Property Selector & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
              <div className="p-3 rounded-full bg-teal-100 dark:bg-teal-900/30">
                <Activity className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {activeRules.length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold">{totalActions}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Settings className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Rules Table
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Overview
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Rules Table ── */}
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-5 w-5" />
                Occupancy Trigger Rules
                <Badge variant="outline" className="ml-2">{rules.length} rules</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Trigger Type</TableHead>
                        <TableHead>Sensor Type</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                        <TableHead>Cooldown</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead className="text-right">Operations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {rules.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Activity className="h-8 w-8" />
                                <p className="text-sm font-medium">No trigger rules found</p>
                                <p className="text-xs">
                                  Create your first occupancy trigger rule to automate room actions
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          rules.map((rule) => (
                            <motion.tr
                              key={rule.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.2 }}
                              className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                            >
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{rule.name}</span>
                                  {rule.description && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {rule.description}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${TRIGGER_TYPE_CONFIG[rule.triggerType].color}`}>
                                  {TRIGGER_TYPE_CONFIG[rule.triggerType].label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {getSensorIcon(rule.sensorType)}
                                  <span className="text-sm">{SENSOR_TYPE_CONFIG[rule.sensorType].label}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {rule.actions.map((action, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs px-1.5 py-0 gap-0.5"
                                    >
                                      {getActionIcon(action.type)}
                                      {ACTION_TYPE_CONFIG[action.type].label}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {rule.cooldownMinutes} min
                                </div>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={rule.isActive}
                                  onCheckedChange={() => handleToggleActive(rule)}
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              </TableCell>
                              <TableCell>
                                {rule.lastTriggeredAt ? (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(rule.lastTriggeredAt)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Never</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(rule)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                                    onClick={() => {
                                      setDeletingId(rule.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Trigger Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rules by Trigger Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, config]) => {
                    const count = rules.filter((r) => r.triggerType === key).length;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Sensor Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rules by Sensor Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(SENSOR_TYPE_CONFIG).map(([key, config]) => {
                    const count = rules.filter((r) => r.sensorType === key).length;
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{config.label}</span>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Action Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => {
                    const count = rules.reduce(
                      (sum, r) => sum + r.actions.filter((a) => a.type === key).length,
                      0
                    );
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{config.label}</span>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Inactive Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Inactive Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rules.filter((r) => !r.isActive).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      All rules are active
                    </div>
                  ) : (
                    rules
                      .filter((r) => !r.isActive)
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {TRIGGER_TYPE_CONFIG[rule.triggerType].label}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleToggleActive(rule)}
                          >
                            Activate
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Trigger Rule' : 'Create Trigger Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Update the occupancy trigger rule configuration.'
                : 'Define a new automated rule that triggers actions based on sensor data.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">
                Rule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-name"
                placeholder="e.g., Auto-vacant when no motion for 15min"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Input
                id="rule-description"
                placeholder="Optional description of the rule purpose"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trigger Type */}
              <div className="space-y-2">
                <Label>
                  Trigger Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(v) =>
                    updateForm({ triggerType: v as OccupancyTriggerRule['triggerType'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sensor Type */}
              <div className="space-y-2">
                <Label>
                  Sensor Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.sensorType}
                  onValueChange={(v) =>
                    updateForm({ sensorType: v as OccupancyTriggerRule['sensorType'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SENSOR_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Threshold (only for occupancy_threshold) */}
            {form.triggerType === 'occupancy_threshold' && (
              <div className="space-y-2">
                <Label htmlFor="threshold-value">Threshold Value (0.0 - 1.0)</Label>
                <Input
                  id="threshold-value"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0.5"
                  value={form.thresholdValue}
                  onChange={(e) => updateForm({ thresholdValue: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Set the occupancy level threshold that will trigger the rule (0.0 = empty, 1.0 = full)
                </p>
              </div>
            )}

            <Separator />

            {/* Actions Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Actions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={addAction}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Action
                </Button>
              </div>

              <AnimatePresence>
                {form.actions.map((action, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border rounded-lg p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Action {index + 1}
                      </span>
                      {form.actions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 dark:text-red-400"
                          onClick={() => removeAction(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Action Type Select */}
                    <div className="space-y-2">
                      <Label className="text-xs">Action Type</Label>
                      <Select
                        value={action.type}
                        onValueChange={(v) => {
                          const newParams: Record<string, unknown> = {};
                          const fields = ACTION_PARAM_FIELDS[v as OccupancyTriggerAction['type']];
                          if (fields) {
                            fields.forEach((f) => {
                              if (f.type === 'select' && f.options?.length) {
                                newParams[f.key] = f.options[0];
                              } else if (f.type === 'number') {
                                newParams[f.key] = 0;
                              } else {
                                newParams[f.key] = '';
                              }
                            });
                          }
                          updateAction(index, {
                            type: v as OccupancyTriggerAction['type'],
                            params: newParams,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <config.icon className="h-4 w-4" />
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dynamic Params */}
                    {(ACTION_PARAM_FIELDS[action.type] || []).map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        {field.type === 'select' && field.options ? (
                          <Select
                            value={String(action.params[field.key] ?? '')}
                            onValueChange={(v) => updateActionParam(index, field.key, v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === 'number' ? (
                          <Input
                            type="number"
                            value={String(action.params[field.key] ?? '')}
                            onChange={(e) =>
                              updateActionParam(
                                index,
                                field.key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        ) : (
                          <Input
                            type="text"
                            value={String(action.params[field.key] ?? '')}
                            onChange={(e) =>
                              updateActionParam(index, field.key, e.target.value)
                            }
                          />
                        )}
                      </div>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cooldown */}
              <div className="space-y-2">
                <Label htmlFor="cooldown-minutes">Cooldown (minutes)</Label>
                <Input
                  id="cooldown-minutes"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={form.cooldownMinutes}
                  onChange={(e) => updateForm({ cooldownMinutes: e.target.value })}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable or disable this rule
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateForm({ isActive: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeletingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Trigger Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              The rule will be permanently removed and will no longer trigger any automated actions.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingId(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

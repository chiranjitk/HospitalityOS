'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Timer,
  Plus,
  Edit,
  Trash2,
  Zap,
  Thermometer,
  Lightbulb,
  TrendingDown,
  Calendar,
  Clock,
  Sun,
  Moon,
  Snowflake,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Data Types ───────────────────────────────────────────────────────

interface ScheduleEntry {
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
  mode: 'eco' | 'comfort' | 'off';
  targetTemp?: number; // 10-35
  lightingLevel?: number; // 0-100
}

interface EnergySchedule {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  type: 'thermostat_schedule' | 'lighting_schedule' | 'hvac_optimization' | 'peak_shaving';
  scheduleEntries: ScheduleEntry[];
  roomTypeId?: string;
  occupancyOverride: boolean;
  isActive: boolean;
  estimatedSavingsPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleSummary {
  totalEstimatedSavingsPercent: number;
  averageSavingsPercent: number;
}

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SCHEDULE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  thermostat_schedule: { label: 'Thermostat', icon: Thermometer, color: 'bg-teal-500' },
  lighting_schedule: { label: 'Lighting', icon: Lightbulb, color: 'bg-amber-500' },
  hvac_optimization: { label: 'HVAC', icon: Snowflake, color: 'bg-cyan-500' },
  peak_shaving: { label: 'Peak Shaving', icon: Zap, color: 'bg-emerald-500' },
};

const MODE_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string }> = {
  comfort: {
    label: 'Comfort',
    color: '#10b981',
    bgClass: 'bg-emerald-500/10 text-emerald-600',
    textClass: 'text-emerald-600',
  },
  eco: {
    label: 'Eco',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10 text-amber-600',
    textClass: 'text-amber-600',
  },
  off: {
    label: 'Off',
    color: '#64748b',
    bgClass: 'bg-slate-500/10 text-slate-500',
    textClass: 'text-slate-500',
  },
};

const DEFAULT_ENTRY: ScheduleEntry = {
  dayOfWeek: 0,
  startHour: 8,
  endHour: 18,
  mode: 'eco',
  targetTemp: 22,
  lightingLevel: 80,
};

const HOURS_LABELS = Array.from({ length: 24 }, (_, i) => `${i}`);

// ─── Helper Functions ────────────────────────────────────────────────

function buildHeatmapGrid(entries: ScheduleEntry[]) {
  const grid: Record<number, Record<number, 'comfort' | 'eco' | 'off' | null>> = {};
  for (let day = 0; day < 7; day++) {
    grid[day] = {};
    for (let hour = 0; hour < 24; hour++) {
      grid[day][hour] = null;
    }
  }

  for (const entry of entries) {
    const start = Math.min(entry.startHour, entry.endHour);
    const end = Math.max(entry.startHour, entry.endHour);
    for (let hour = start; hour <= end; hour++) {
      grid[entry.dayOfWeek][hour] = entry.mode;
    }
  }

  return grid;
}

// ─── Sub-Components (outside main component to avoid re-creation) ──

function TypeIcon({ type }: { type: string }) {
  const cfg = SCHEDULE_TYPE_CONFIG[type] || SCHEDULE_TYPE_CONFIG.thermostat_schedule;
  const Icon = cfg.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

function WeeklyHeatmap({ entries, compact = false }: { entries: ScheduleEntry[]; compact?: boolean }) {
  const grid = buildHeatmapGrid(entries);
  const hasData = entries.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        No schedule entries configured
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn("min-w-[500px]", !compact && "min-w-[640px]")}>
        {/* Hour labels */}
        <div className="flex">
          <div className={cn(!compact ? "w-16" : "w-10", "flex-shrink-0")} />
          <div className="flex-1 grid grid-cols-24 gap-px">
            {HOURS_LABELS.filter((_, i) => compact ? i % 3 === 0 : i % 2 === 0).map((_, idx) => {
              const hourIdx = compact ? idx * 3 : idx * 2;
              return (
                <div key={hourIdx} className="text-center text-[9px] text-muted-foreground leading-tight">
                  {hourIdx < 24 ? hourIdx : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day rows */}
        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} className="flex items-stretch">
            <div className={cn(
              !compact ? "w-16" : "w-10",
              "flex-shrink-0 flex items-center text-[10px] font-medium text-muted-foreground pr-2"
            )}>
              {DAYS_SHORT[day]}
            </div>
            <div className="flex-1 grid grid-cols-24 gap-px">
              {Array.from({ length: 24 }, (_, hour) => {
                const mode = grid[day][hour];
                const cfg = mode ? MODE_CONFIG[mode] : null;
                return (
                  <motion.div
                    key={hour}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (day * 24 + hour) * 0.001 }}
                    className={cn(
                      'aspect-square rounded-sm',
                      compact ? 'min-h-[10px]' : 'min-h-[14px]',
                      cfg
                        ? cn(cfg.bgClass, 'cursor-default')
                        : 'bg-muted/30'
                    )}
                    title={
                      cfg
                        ? `${DAYS_SHORT[day]} ${hour}:00 - ${hour + 1}:00: ${cfg.label}`
                        : `${DAYS_SHORT[day]} ${hour}:00: No schedule`
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3">
        {Object.entries(MODE_CONFIG).map(([mode, cfg]) => (
          <div key={mode} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-sm', cfg.bgClass)} />
            <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function EnergySchedule() {
  const { user } = useAuth();

  // Data state
  const [schedules, setSchedules] = useState<EnergySchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [summary, setSummary] = useState<ScheduleSummary>({ totalEstimatedSavingsPercent: 0, averageSavingsPercent: 0 });
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EnergySchedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<EnergySchedule | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<string>('thermostat_schedule');
  const [formEntries, setFormEntries] = useState<ScheduleEntry[]>([{ ...DEFAULT_ENTRY }]);
  const [formRoomTypeId, setFormRoomTypeId] = useState<string>('');
  const [formOccupancyOverride, setFormOccupancyOverride] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formEstimatedSavings, setFormEstimatedSavings] = useState('');

  // ─── Data Fetching ─────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const params = new URLSearchParams();
      params.append('tenantId', user.tenantId);
      const res = await fetch(`/api/pms/properties?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const props = Array.isArray(json.data) ? json.data : json.data.properties || [];
          setProperties(props);
          if (props.length > 0 && selectedProperty === 'all') {
            setSelectedProperty(props[0].id);
          }
        }
      }
    } catch {
      // silently ignore property fetch errors
    }
  }, [user?.tenantId]);

  const fetchSchedules = useCallback(async () => {
    if (!user?.tenantId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProperty !== 'all') {
        params.append('propertyId', selectedProperty);
      }
      const res = await fetch(`/api/iot/energy/schedule?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSchedules(json.data.schedules || []);
          setTotal(json.data.total || 0);
          setActiveCount(json.data.activeCount || 0);
          setSummary(json.data.summary || { totalEstimatedSavingsPercent: 0, averageSavingsPercent: 0 });
        }
      }
    } catch {
      toast.error('Failed to fetch energy schedules');
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId, selectedProperty]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // ─── Form Helpers ──────────────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormType('thermostat_schedule');
    setFormEntries([{ ...DEFAULT_ENTRY }]);
    setFormRoomTypeId('');
    setFormOccupancyOverride(false);
    setFormIsActive(true);
    setFormEstimatedSavings('');
    setEditingSchedule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (schedule: EnergySchedule) => {
    setEditingSchedule(schedule);
    setFormName(schedule.name);
    setFormType(schedule.type);
    setFormEntries(schedule.scheduleEntries.length > 0 ? schedule.scheduleEntries : [{ ...DEFAULT_ENTRY }]);
    setFormRoomTypeId(schedule.roomTypeId || '');
    setFormOccupancyOverride(schedule.occupancyOverride);
    setFormIsActive(schedule.isActive);
    setFormEstimatedSavings(schedule.estimatedSavingsPercent ? String(schedule.estimatedSavingsPercent) : '');
    setDialogOpen(true);
  };

  const addEntry = () => {
    setFormEntries([...formEntries, { ...DEFAULT_ENTRY, dayOfWeek: formEntries.length % 7 }]);
  };

  const removeEntry = (index: number) => {
    if (formEntries.length <= 1) return;
    setFormEntries(formEntries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ScheduleEntry, value: string | number | boolean) => {
    const updated = [...formEntries];
    updated[index] = { ...updated[index], [field]: value };
    setFormEntries(updated);
  };

  const applyToAllDays = (entryIndex: number) => {
    const sourceEntry = formEntries[entryIndex];
    const newEntries: ScheduleEntry[] = [];
    for (let day = 0; day < 7; day++) {
      if (formEntries.some(e => e.dayOfWeek === day)) {
        newEntries.push(
          ...formEntries.filter(e => e.dayOfWeek === day).map(e => ({
            ...e,
            startHour: sourceEntry.startHour,
            endHour: sourceEntry.endHour,
            mode: sourceEntry.mode,
            targetTemp: sourceEntry.targetTemp,
            lightingLevel: sourceEntry.lightingLevel,
          }))
        );
      } else {
        newEntries.push({ ...sourceEntry, dayOfWeek: day });
      }
    }
    setFormEntries(newEntries);
  };

  // ─── CRUD Handlers ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user?.tenantId || !formName.trim()) {
      toast.error('Please fill in the schedule name');
      return;
    }

    if (formEntries.length === 0) {
      toast.error('Please add at least one schedule entry');
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        propertyId: selectedProperty !== 'all' ? selectedProperty : properties[0]?.id,
        name: formName.trim(),
        type: formType,
        scheduleEntries: formEntries.map(e => ({
          ...e,
          targetTemp: e.mode !== 'off' ? (e.targetTemp ?? undefined) : undefined,
          lightingLevel: e.mode !== 'off' ? (e.lightingLevel ?? undefined) : undefined,
        })),
        occupancyOverride: formOccupancyOverride,
        isActive: formIsActive,
        estimatedSavingsPercent: formEstimatedSavings ? parseFloat(formEstimatedSavings) : undefined,
      };

      if (formRoomTypeId) {
        body.roomTypeId = formRoomTypeId;
      }

      const url = '/api/iot/energy/schedule';
      const method = editingSchedule ? 'PUT' : 'POST';

      if (editingSchedule) {
        body.id = editingSchedule.id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success(editingSchedule ? 'Schedule updated successfully' : 'Schedule created successfully');
          setDialogOpen(false);
          resetForm();
          fetchSchedules();
        } else {
          toast.error(json.error?.message || 'Failed to save schedule');
        }
      } else {
        toast.error('Failed to save schedule');
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;
    setIsSaving(true);
    try {
      const params = new URLSearchParams();
      params.append('id', deletingSchedule.id);
      const res = await fetch(`/api/iot/energy/schedule?${params.toString()}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success('Schedule deleted successfully');
          setDeleteDialogOpen(false);
          setDeletingSchedule(null);
          fetchSchedules();
        } else {
          toast.error(json.error?.message || 'Failed to delete schedule');
        }
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch {
      toast.error('Failed to delete schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (schedule: EnergySchedule) => {
    try {
      const res = await fetch('/api/iot/energy/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schedule.id, isActive: !schedule.isActive }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success(schedule.isActive ? 'Schedule deactivated' : 'Schedule activated');
          fetchSchedules();
        } else {
          toast.error('Failed to toggle schedule status');
        }
      } else {
        toast.error('Failed to toggle schedule status');
      }
    } catch {
      toast.error('Failed to toggle schedule status');
    }
  };

  // ─── Loading State ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Timer className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              Energy Optimization Schedules
            </h1>
            <p className="text-muted-foreground">
              Manage IoT energy schedules for thermostat, lighting, HVAC, and peak shaving
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchSchedules(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Property Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Property</Label>
            </div>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-[220px]">
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
        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold">{total}</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Timer className="h-3.5 w-3.5 mr-1" />
                  All energy schedules
                </div>
              </div>
              <div className="p-3 rounded-full bg-teal-500/10">
                <Timer className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Schedules</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Sun className="h-3.5 w-3.5 mr-1" />
                  Currently running
                </div>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Sun className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Est. Energy Savings</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.averageSavingsPercent.toFixed(1)}%
                </p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5 mr-1" />
                  Avg. savings across all schedules
                </div>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">
            <Clock className="h-4 w-4 mr-1.5" />
            Schedule List
          </TabsTrigger>
          <TabsTrigger value="heatmap">
            <Calendar className="h-4 w-4 mr-1.5" />
            Weekly Overview
          </TabsTrigger>
        </TabsList>

        {/* ─── Table View ──────────────────────────────────────────── */}
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-teal-600" />
                All Energy Schedules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Timer className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No energy schedules found</p>
                  <p className="text-sm mt-1">Create a schedule to optimize energy usage</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Entries</TableHead>
                        <TableHead className="text-center">Savings %</TableHead>
                        <TableHead className="text-center">Occupancy Override</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {schedules.map((schedule) => {
                          const typeCfg = SCHEDULE_TYPE_CONFIG[schedule.type] || SCHEDULE_TYPE_CONFIG.thermostat_schedule;
                          return (
                            <motion.tr
                              key={schedule.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="hover:bg-muted/50 border-b"
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium">{schedule.name}</p>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {schedule.scheduleEntries.slice(0, 3).map((entry, i) => {
                                      const modeCfg = MODE_CONFIG[entry.mode];
                                      return (
                                        <span
                                          key={i}
                                          className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium', modeCfg.bgClass)}
                                        >
                                          {DAYS_SHORT[entry.dayOfWeek]} {entry.startHour}-{entry.endHour}h
                                        </span>
                                      );
                                    })}
                                    {schedule.scheduleEntries.length > 3 && (
                                      <span className="text-[9px] text-muted-foreground">
                                        +{schedule.scheduleEntries.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn('text-white text-xs gap-1', typeCfg.color)}>
                                  <TypeIcon type={schedule.type} />
                                  {typeCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-medium">{schedule.scheduleEntries.length}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-sm font-medium text-emerald-600">
                                    {schedule.estimatedSavingsPercent}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {schedule.occupancyOverride ? (
                                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                    Enabled
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Disabled
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Switch
                                    checked={schedule.isActive}
                                    onCheckedChange={() => handleToggleActive(schedule)}
                                    aria-label={`Toggle ${schedule.name}`}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8"
                                    onClick={() => openEditDialog(schedule)}
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                    onClick={() => {
                                      setDeletingSchedule(schedule);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Heatmap View ─────────────────────────────────────────── */}
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-600" />
                Weekly Schedule Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No schedules to display</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
                  {schedules.map((schedule) => {
                    const typeCfg = SCHEDULE_TYPE_CONFIG[schedule.type] || SCHEDULE_TYPE_CONFIG.thermostat_schedule;
                    return (
                      <motion.div
                        key={schedule.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={cn('text-white text-xs gap-1', typeCfg.color)}>
                              <TypeIcon type={schedule.type} />
                              {typeCfg.label}
                            </Badge>
                            <span className="text-sm font-medium">{schedule.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {schedule.isActive ? (
                              <Badge className="bg-emerald-500 text-white text-xs">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                            )}
                          </div>
                        </div>
                        <WeeklyHeatmap entries={schedule.scheduleEntries} compact={false} />
                        <Separator />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create / Edit Dialog ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSchedule ? (
                <>
                  <Edit className="h-5 w-5 text-teal-600" />
                  Edit Energy Schedule
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-teal-600" />
                  Create Energy Schedule
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="schedule-name">Schedule Name *</Label>
              <Input
                id="schedule-name"
                placeholder="e.g., Summer Comfort Mode"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Type and Room Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule Type *</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCHEDULE_TYPE_CONFIG).map(([value, cfg]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <cfg.icon className="h-4 w-4" />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Room Type (optional)</Label>
                <Select value={formRoomTypeId || '__none__'} onValueChange={(v) => setFormRoomTypeId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All room types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Room Types</SelectItem>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimated Savings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Savings % (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g., 15.5"
                  value={formEstimatedSavings}
                  onChange={(e) => setFormEstimatedSavings(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Schedule Entries Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Schedule Entries</Label>
                <Button size="sm" variant="outline" onClick={addEntry} className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Entry
                </Button>
              </div>

              <ScrollArea className="max-h-64">
                <AnimatePresence>
                  {formEntries.map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 mb-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Entry #{index + 1}</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => applyToAllDays(index)}
                            title="Apply this entry's settings to all days"
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            Apply All Days
                          </Button>
                          {formEntries.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-600"
                              onClick={() => removeEntry(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Day of Week */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Day</Label>
                          <Select
                            value={String(entry.dayOfWeek)}
                            onValueChange={(v) => updateEntry(index, 'dayOfWeek', parseInt(v))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, i) => (
                                <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Start Hour */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Start Hour</Label>
                          <Select
                            value={String(entry.startHour)}
                            onValueChange={(v) => updateEntry(index, 'startHour', parseInt(v))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS_LABELS.map((_, i) => (
                                <SelectItem key={i} value={String(i)}>{`${i}:00`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* End Hour */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">End Hour</Label>
                          <Select
                            value={String(entry.endHour)}
                            onValueChange={(v) => updateEntry(index, 'endHour', parseInt(v))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS_LABELS.map((_, i) => (
                                <SelectItem key={i} value={String(i)}>{`${i}:00`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Mode */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Mode</Label>
                          <Select
                            value={entry.mode}
                            onValueChange={(v) => updateEntry(index, 'mode', v as 'eco' | 'comfort' | 'off')}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="comfort">
                                <div className="flex items-center gap-1.5">
                                  <Sun className="h-3 w-3 text-emerald-500" />
                                  Comfort
                                </div>
                              </SelectItem>
                              <SelectItem value="eco">
                                <div className="flex items-center gap-1.5">
                                  <Moon className="h-3 w-3 text-amber-500" />
                                  Eco
                                </div>
                              </SelectItem>
                              <SelectItem value="off">
                                <div className="flex items-center gap-1.5">
                                  <Snowflake className="h-3 w-3 text-slate-400" />
                                  Off
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Conditional fields based on type */}
                      {(formType === 'thermostat_schedule' || formType === 'hvac_optimization') && entry.mode !== 'off' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Target Temp (°C)</Label>
                            <Input
                              type="number"
                              min="10"
                              max="35"
                              className="h-8 text-xs"
                              value={entry.targetTemp ?? ''}
                              onChange={(e) => updateEntry(index, 'targetTemp', parseInt(e.target.value) || undefined)}
                            />
                          </div>
                        </div>
                      )}

                      {(formType === 'lighting_schedule') && entry.mode !== 'off' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Lighting Level (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="h-8 text-xs"
                              value={entry.lightingLevel ?? ''}
                              onChange={(e) => updateEntry(index, 'lightingLevel', parseInt(e.target.value) || undefined)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Entry summary badge */}
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', MODE_CONFIG[entry.mode].bgClass)}>
                          {MODE_CONFIG[entry.mode].label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {DAYS_SHORT[entry.dayOfWeek]} {entry.startHour}:00 - {entry.endHour}:00
                          {entry.targetTemp ? ` | ${entry.targetTemp}°C` : ''}
                          {entry.lightingLevel ? ` | ${entry.lightingLevel}%` : ''}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </ScrollArea>
            </div>

            <Separator />

            {/* Weekly Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-600" />
                Weekly Preview
              </Label>
              <div className="rounded-lg border p-3 bg-muted/20">
                <WeeklyHeatmap entries={formEntries} compact={true} />
              </div>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-sm">Occupancy Override</Label>
                  <p className="text-[10px] text-muted-foreground">Adjust schedule based on room occupancy</p>
                </div>
                <Switch
                  checked={formOccupancyOverride}
                  onCheckedChange={setFormOccupancyOverride}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-sm">Active</Label>
                  <p className="text-[10px] text-muted-foreground">Enable this schedule immediately</p>
                </div>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => { resetForm(); setDialogOpen(false); }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) setDeletingSchedule(null); setDeleteDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the schedule{' '}
              <span className="font-semibold text-foreground">&ldquo;{deletingSchedule?.name}&rdquo;</span>?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All schedule entries will be permanently removed.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setDeletingSchedule(null); }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

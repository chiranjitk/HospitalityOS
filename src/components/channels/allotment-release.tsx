'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Timer,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Eye,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownToLine,
  ChevronDown,
  CalendarDays,
  BarChart3,
  List,
  Settings2,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface ReleaseStep {
  daysBefore: number;
  releasePercent: number;
}

interface ReleaseRule {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  roomTypeId: string | null;
  releaseType: string;
  releaseSchedule: string;
  releaseAllDays: number;
  releasePercentPerDay: number;
  startReleaseFrom: string | null;
  endReleaseAt: string | null;
  minAllotment: number;
  autoRelease: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReleaseLog {
  id: string;
  tenantId: string;
  ruleId: string;
  connectionId: string;
  channelCode: string;
  roomTypeId: string | null;
  date: string;
  roomsReleased: number;
  roomsBefore: number;
  roomsAfter: number;
  releaseType: string;
  daysBeforeArrival: number;
  triggeredBy: string;
  createdAt: string;
}

interface PreviewItem {
  date: string;
  daysBeforeArrival: number;
  releasePercent: number;
  currentAllotment: number;
  estimatedRelease: number;
  estimatedAfter: number;
}

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string;
  status: string;
}

interface RoomTypeItem {
  id: string;
  name: string;
  code: string;
}

interface Stats {
  totalRules: number;
  activeRules: number;
  totalReleased: number;
  pendingRelease: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseReleaseSchedule(scheduleStr: string): ReleaseStep[] {
  try {
    const parsed = JSON.parse(scheduleStr);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function getReleaseTypeLabel(type: string): string {
  switch (type) {
    case 'graduated': return 'Graduated';
    case 'fixed': return 'Fixed Cutoff';
    case 'percentage': return 'Daily Percentage';
    default: return type;
  }
}

function getReleaseTypeDescription(type: string): string {
  switch (type) {
    case 'graduated': return 'Release rooms in percentage steps as arrival approaches';
    case 'fixed': return 'Release all rooms N days before arrival';
    case 'percentage': return 'Release X% of rooms per day as arrival approaches';
    default: return type;
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function AllotmentRelease() {
  // Core state
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<ReleaseRule[]>([]);
  const [logs, setLogs] = useState<ReleaseLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState('rules');

  // Reference data
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ReleaseRule | null>(null);
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
  const [previewRuleInfo, setPreviewRuleInfo] = useState<{ ruleId: string; channelCode: string; releaseType: string } | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [processingReleases, setProcessingReleases] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Form state
  const [formChannelCode, setFormChannelCode] = useState('');
  const [formConnectionId, setFormConnectionId] = useState('');
  const [formRoomTypeId, setFormRoomTypeId] = useState('');
  const [formReleaseType, setFormReleaseType] = useState('graduated');
  const [formReleaseSteps, setFormReleaseSteps] = useState<ReleaseStep[]>([
    { daysBefore: 30, releasePercent: 20 },
    { daysBefore: 14, releasePercent: 50 },
    { daysBefore: 7, releasePercent: 100 },
  ]);
  const [formReleaseAllDays, setFormReleaseAllDays] = useState(7);
  const [formReleasePercentPerDay, setFormReleasePercentPerDay] = useState(10);
  const [formMinAllotment, setFormMinAllotment] = useState(0);
  const [formAutoRelease, setFormAutoRelease] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preview date range
  const [previewStartDate, setPreviewStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [previewEndDate, setPreviewEndDate] = useState(
    new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  );

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, statsRes, connectionsRes, roomTypesRes] = await Promise.all([
        fetch('/api/channels/allotment-release').then(r => r.json()),
        fetch('/api/channels/allotment-release?action=stats').then(r => r.json()),
        fetch('/api/channels/connections').then(r => r.json()),
        fetch('/api/channels/allocations').then(r => r.json()),
      ]);

      if (rulesRes.success) setRules(rulesRes.data.rules || []);
      if (statsRes.success) setStats(statsRes.data);
      if (connectionsRes.success) {
        setConnections((connectionsRes.data || []).filter((c: ChannelConnection) => c.status === 'active'));
      }
      if (roomTypesRes.success && roomTypesRes.data?.allocations) {
        const rtMap = new Map<string, RoomTypeItem>();
        for (const a of roomTypesRes.data.allocations) {
          if (!rtMap.has(a.roomTypeId)) {
            rtMap.set(a.roomTypeId, { id: a.roomTypeId, name: a.roomTypeName, code: a.roomTypeCode });
          }
        }
        setRoomTypes(Array.from(rtMap.values()));
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page: number) => {
    try {
      const res = await fetch(`/api/channels/allotment-release?action=logs&page=${page}&limit=50`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs || []);
        setTotalLogs(json.data.total || 0);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs(logsPage);
  }, [activeTab, logsPage, fetchLogs]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormChannelCode('');
    setFormConnectionId('');
    setFormRoomTypeId('');
    setFormReleaseType('graduated');
    setFormReleaseSteps([
      { daysBefore: 30, releasePercent: 20 },
      { daysBefore: 14, releasePercent: 50 },
      { daysBefore: 7, releasePercent: 100 },
    ]);
    setFormReleaseAllDays(7);
    setFormReleasePercentPerDay(10);
    setFormMinAllotment(0);
    setFormAutoRelease(true);
    setFormIsActive(true);
    setEditingRule(null);
  }, []);

  // Open create dialog
  const handleOpenCreate = useCallback(() => {
    resetForm();
    setShowCreateDialog(true);
  }, [resetForm]);

  // Open edit dialog
  const handleOpenEdit = useCallback((rule: ReleaseRule) => {
    setEditingRule(rule);
    setFormChannelCode(rule.channelCode);
    setFormConnectionId(rule.connectionId || '');
    setFormRoomTypeId(rule.roomTypeId || '');
    setFormReleaseType(rule.releaseType);
    setFormReleaseSteps(parseReleaseSchedule(rule.releaseSchedule));
    setFormReleaseAllDays(rule.releaseAllDays);
    setFormReleasePercentPerDay(rule.releasePercentPerDay);
    setFormMinAllotment(rule.minAllotment);
    setFormAutoRelease(rule.autoRelease);
    setFormIsActive(rule.isActive);
    setShowCreateDialog(true);
  }, []);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!formChannelCode) {
      toast.error('Channel is required');
      return;
    }

    setSaving(true);
    try {
      const body = {
        action: editingRule ? 'update' : 'create',
        ...(editingRule ? { id: editingRule.id } : {}),
        channelCode: formChannelCode,
        connectionId: formConnectionId || undefined,
        roomTypeId: formRoomTypeId || undefined,
        releaseType: formReleaseType,
        releaseSchedule: JSON.stringify(formReleaseSteps),
        releaseAllDays: formReleaseAllDays,
        releasePercentPerDay: formReleasePercentPerDay,
        minAllotment: formMinAllotment,
        autoRelease: formAutoRelease,
        isActive: formIsActive,
      };

      const res = await fetch('/api/channels/allotment-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to save rule');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [editingRule, formChannelCode, formConnectionId, formRoomTypeId, formReleaseType, formReleaseSteps, formReleaseAllDays, formReleasePercentPerDay, formMinAllotment, formAutoRelease, formIsActive, fetchData, resetForm]);

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/channels/allotment-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Rule deleted');
        setShowDeleteDialog(null);
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchData]);

  // Toggle active
  const handleToggleActive = useCallback(async (rule: ReleaseRule) => {
    try {
      const res = await fetch('/api/channels/allotment-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: rule.id, isActive: !rule.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(rule.isActive ? 'Rule deactivated' : 'Rule activated');
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle rule');
    }
  }, [fetchData]);

  // Preview releases
  const handlePreview = useCallback(async () => {
    if (!editingRule && !previewRuleInfo) {
      toast.error('Select a rule to preview');
      return;
    }

    const ruleId = editingRule?.id || previewRuleInfo?.ruleId;
    if (!ruleId) return;

    try {
      const res = await fetch('/api/channels/allotment-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          ruleId,
          startDate: previewStartDate,
          endDate: previewEndDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPreviewData(json.data.preview || []);
        setPreviewRuleInfo({
          ruleId: json.data.ruleId,
          channelCode: json.data.channelCode,
          releaseType: json.data.releaseType,
        });
        setShowPreviewDialog(true);
      } else {
        toast.error(json.error?.message || 'Preview failed');
      }
    } catch {
      toast.error('Network error');
    }
  }, [editingRule, previewRuleInfo, previewStartDate, previewEndDate]);

  // Process all releases
  const handleProcessReleases = useCallback(async () => {
    setProcessingReleases(true);
    try {
      const res = await fetch('/api/channels/allotment-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-releases' }),
      });
      const json = await res.json();
      if (json.success) {
        const count = json.data.processed || 0;
        const total = json.data.totalRoomsReleased || 0;
        if (count > 0) {
          toast.success(`Processed ${count} release(s), ${total} rooms released back to general pool`);
          fetchData();
          fetchLogs(1);
        } else {
          toast.info('No releases were needed at this time');
        }
      } else {
        toast.error(json.error?.message || 'Failed to process releases');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessingReleases(false);
    }
  }, [fetchData, fetchLogs]);

  // Release schedule step management
  const addStep = useCallback(() => {
    setFormReleaseSteps(prev => [...prev, { daysBefore: 1, releasePercent: 100 }]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setFormReleaseSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateStep = useCallback((index: number, field: keyof ReleaseStep, value: number) => {
    setFormReleaseSteps(prev => prev.map((step, i) => i === index ? { ...step, [field]: value } : step));
  }, []);

  // Get channel display name
  const getChannelDisplayName = useCallback((code: string): string => {
    const conn = connections.find(c => c.channel === code);
    return conn?.displayName || code;
  }, [connections]);

  // Get room type name
  const getRoomTypeName = useCallback((id: string | null): string => {
    if (!id) return 'All Room Types';
    const rt = roomTypes.find(r => r.id === id);
    return rt?.name || id;
  }, [roomTypes]);

  // Computed: log pages
  const logPages = Math.ceil(totalLogs / 50);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Allotment Release</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically release unsold allotment rooms back to the general pool before arrival
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleProcessReleases} disabled={processingReleases}>
              <Play className="h-4 w-4 mr-1" />
              {processingReleases ? 'Processing...' : 'Process Releases'}
            </Button>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" /> New Rule
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2.5 dark:bg-violet-950/40">
                  <Settings2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Rules</p>
                  <p className="text-2xl font-bold">{stats?.totalRules || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active Rules</p>
                  <p className="text-2xl font-bold">{stats?.activeRules || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                  <ArrowDownToLine className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Released</p>
                  <p className="text-2xl font-bold">{stats?.totalReleased || 0}</p>
                  <p className="text-xs text-muted-foreground">rooms returned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Auto-Release</p>
                  <p className="text-2xl font-bold">{stats?.pendingRelease || 0}</p>
                  <p className="text-xs text-muted-foreground">pending rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rules">
              <List className="h-4 w-4 mr-1.5" /> Release Rules
            </TabsTrigger>
            <TabsTrigger value="logs">
              <BarChart3 className="h-4 w-4 mr-1.5" /> Release Logs
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <CalendarDays className="h-4 w-4 mr-1.5" /> Timeline
            </TabsTrigger>
          </TabsList>

          {/* ============ RULES TAB ============ */}
          <TabsContent value="rules" className="mt-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <Timer className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-lg font-medium">No release rules configured</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create a rule to automatically release unsold allotment rooms before arrival
                    </p>
                  </div>
                  <Button onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-1" /> Create First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead>Room Type</TableHead>
                          <TableHead>Release Type</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Min Allotment</TableHead>
                          <TableHead>Auto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((rule) => {
                          const steps = parseReleaseSchedule(rule.releaseSchedule);
                          return (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {rule.channelCode.substring(0, 2).toUpperCase()}
                                  </div>
                                  {getChannelDisplayName(rule.channelCode)}
                                </div>
                              </TableCell>
                              <TableCell>{getRoomTypeName(rule.roomTypeId)}</TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary">{getReleaseTypeLabel(rule.releaseType)}</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{getReleaseTypeDescription(rule.releaseType)}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px]">
                                  {rule.releaseType === 'graduated' && steps.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {steps.sort((a, b) => a.daysBefore - b.daysBefore).map((step, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                          {step.daysBefore}d: {step.releasePercent}%
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : rule.releaseType === 'fixed' ? (
                                    <span className="text-sm">{rule.releaseAllDays} days before</span>
                                  ) : (
                                    <span className="text-sm">{rule.releasePercentPerDay}%/day</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{rule.minAllotment}</TableCell>
                              <TableCell>
                                <Badge variant={rule.autoRelease ? 'default' : 'secondary'} className="text-[10px]">
                                  {rule.autoRelease ? 'Yes' : 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <button onClick={() => handleToggleActive(rule)} className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                  <span className="text-xs">{rule.isActive ? 'Active' : 'Inactive'}</span>
                                </button>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditingRule(rule); handlePreview(); }}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Preview Releases</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenEdit(rule)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Rule</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => setShowDeleteDialog(rule.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Rule</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ LOGS TAB ============ */}
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Release History</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <BarChart3 className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No release logs yet</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Room Type</TableHead>
                            <TableHead>Days Before</TableHead>
                            <TableHead>Released</TableHead>
                            <TableHead>Before</TableHead>
                            <TableHead>After</TableHead>
                            <TableHead>Triggered By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{formatDate(log.date)}</TableCell>
                              <TableCell>{getChannelDisplayName(log.channelCode)}</TableCell>
                              <TableCell>{getRoomTypeName(log.roomTypeId)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.daysBeforeArrival}d</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  -{log.roomsReleased}
                                </span>
                              </TableCell>
                              <TableCell>{log.roomsBefore}</TableCell>
                              <TableCell>{log.roomsAfter}</TableCell>
                              <TableCell>
                                <Badge variant={log.triggeredBy === 'auto' ? 'secondary' : 'default'} className="text-[10px]">
                                  {log.triggeredBy}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {/* Pagination */}
                    {logPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <span className="text-xs text-muted-foreground">
                          {totalLogs} total logs
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline" size="sm"
                            disabled={logsPage <= 1}
                            onClick={() => setLogsPage(p => p - 1)}
                          >
                            Previous
                          </Button>
                          <span className="text-sm">Page {logsPage} of {logPages}</span>
                          <Button
                            variant="outline" size="sm"
                            disabled={logsPage >= logPages}
                            onClick={() => setLogsPage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TIMELINE TAB ============ */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Visual Release Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <CalendarDays className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Create rules to see the release timeline</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {rules.map((rule) => {
                      const steps = parseReleaseSchedule(rule.releaseSchedule);
                      if (rule.releaseType !== 'graduated' || steps.length === 0) {
                        return (
                          <div key={rule.id} className="p-4 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge>{getChannelDisplayName(rule.channelCode)}</Badge>
                                <span className="text-sm text-muted-foreground">{getRoomTypeName(rule.roomTypeId)}</span>
                              </div>
                              <Badge variant="outline">{getReleaseTypeLabel(rule.releaseType)}</Badge>
                            </div>
                            {rule.releaseType === 'fixed' && (
                              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-full"
                                  style={{ width: `${Math.max(5, 100 - (rule.releaseAllDays / 30) * 100)}%` }}
                                />
                                <div className="absolute inset-y-0 right-0 bg-red-500/30 rounded-full"
                                  style={{ width: `${Math.min(100, (rule.releaseAllDays / 30) * 100)}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                  Full release at {rule.releaseAllDays} days before arrival
                                </div>
                              </div>
                            )}
                            {rule.releaseType === 'percentage' && (
                              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/30 rounded-full w-full" />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                  {rule.releasePercentPerDay}% released per day starting {rule.releaseAllDays} days before
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const sortedSteps = [...steps].sort((a, b) => a.daysBefore - b.daysBefore);
                      const maxDays = sortedSteps[0]?.daysBefore || 30;

                      return (
                        <div key={rule.id} className="p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge>{getChannelDisplayName(rule.channelCode)}</Badge>
                              <span className="text-sm text-muted-foreground">{getRoomTypeName(rule.roomTypeId)}</span>
                            </div>
                            <Badge variant="outline">{getReleaseTypeLabel(rule.releaseType)}</Badge>
                          </div>
                          {/* Timeline bar */}
                          <div className="relative">
                            <div className="h-12 bg-muted rounded-lg overflow-hidden relative">
                              {/* Gradient segments */}
                              {sortedSteps.map((step, i) => {
                                const nextStep = sortedSteps[i + 1];
                                const endPercent = nextStep ? ((maxDays - nextStep.daysBefore) / maxDays) * 100 : 100;
                                const startPercent = ((maxDays - step.daysBefore) / maxDays) * 100;
                                const width = endPercent - startPercent;
                                return (
                                  <div
                                    key={i}
                                    className="absolute inset-y-0 bg-emerald-500/20 transition-all"
                                    style={{
                                      left: `${startPercent}%`,
                                      width: `${width}%`,
                                      opacity: step.releasePercent / 100,
                                    }}
                                  />
                                );
                              })}
                              {/* Day markers */}
                              <div className="absolute inset-0 flex items-end px-1">
                                {sortedSteps.map((step, i) => {
                                  const left = ((maxDays - step.daysBefore) / maxDays) * 100;
                                  return (
                                    <div
                                      key={i}
                                      className="absolute bottom-0 flex flex-col items-center"
                                      style={{ left: `${Math.min(left, 95)}%` }}
                                    >
                                      <div className="w-0.5 h-4 bg-emerald-600 dark:bg-emerald-400" />
                                      <div className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                        {step.daysBefore}d
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Center label */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                                  {maxDays} days → Arrival
                                </span>
                              </div>
                            </div>
                            {/* Step details below */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {sortedSteps.map((step, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-1 rounded">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span><strong>{step.daysBefore}d</strong> before: release <strong>{step.releasePercent}%</strong></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ============ CREATE/EDIT DIALOG ============ */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Release Rule' : 'Create Release Rule'}</DialogTitle>
              <DialogDescription>
                Configure when unsold allotment rooms should be released back to the general pool
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Channel */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel *</Label>
                  <Select value={formChannelCode} onValueChange={(val) => setFormChannelCode(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.channel}>
                          {conn.displayName || conn.channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select value={formRoomTypeId} onValueChange={(val) => setFormRoomTypeId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Room Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Room Types</SelectItem>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>
                          {rt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Release Type */}
              <div className="space-y-2">
                <Label>Release Type *</Label>
                <Select value={formReleaseType} onValueChange={setFormReleaseType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="graduated">Graduated - Step-based percentage releases</SelectItem>
                    <SelectItem value="fixed">Fixed Cutoff - Release all at once</SelectItem>
                    <SelectItem value="percentage">Daily Percentage - Release X% per day</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {getReleaseTypeDescription(formReleaseType)}
                </p>
              </div>

              {/* Release Schedule Builder (Graduated) */}
              {formReleaseType === 'graduated' && (
                <div className="space-y-2">
                  <Label>Release Schedule</Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {formReleaseSteps.map((step, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Days Before</Label>
                            <Input
                              type="number"
                              min={1}
                              value={step.daysBefore}
                              onChange={(e) => updateStep(index, 'daysBefore', parseInt(e.target.value) || 1)}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Release %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={step.releasePercent}
                              onChange={(e) => updateStep(index, 'releasePercent', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 mt-4"
                          onClick={() => removeStep(index)}
                          disabled={formReleaseSteps.length <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={addStep}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
                    </Button>
                    {/* Visual timeline preview */}
                    {formReleaseSteps.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Schedule Preview:</p>
                        <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                          {formReleaseSteps
                            .sort((a, b) => a.daysBefore - b.daysBefore)
                            .map((step, i, arr) => {
                              const maxD = arr[0]?.daysBefore || 30;
                              const nextStep = arr[i + 1];
                              const endP = nextStep ? ((maxD - nextStep.daysBefore) / maxD) * 100 : 100;
                              const startP = ((maxD - step.daysBefore) / maxD) * 100;
                              return (
                                <div
                                  key={i}
                                  className="absolute inset-y-0 bg-emerald-500/30"
                                  style={{ left: `${startP}%`, width: `${endP - startP}%`, opacity: step.releasePercent / 100 }}
                                />
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fixed Type */}
              {formReleaseType === 'fixed' && (
                <div className="space-y-2">
                  <Label>Release All Rooms (Days Before Arrival)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formReleaseAllDays}
                    onChange={(e) => setFormReleaseAllDays(parseInt(e.target.value) || 7)}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    All unsold allotment rooms will be released back to the pool {formReleaseAllDays} days before arrival
                  </p>
                </div>
              )}

              {/* Percentage Type */}
              {formReleaseType === 'percentage' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Releasing (Days Before)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formReleaseAllDays}
                      onChange={(e) => setFormReleaseAllDays(parseInt(e.target.value) || 7)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Release % Per Day</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={formReleasePercentPerDay}
                      onChange={(e) => setFormReleasePercentPerDay(parseInt(e.target.value) || 10)}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Starting {formReleaseAllDays} days before arrival, release {formReleasePercentPerDay}% of remaining allotment per day
                  </p>
                </div>
              )}

              {/* Min Allotment */}
              <div className="space-y-2">
                <Label>Minimum Allotment (Never Release Below)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formMinAllotment}
                  onChange={(e) => setFormMinAllotment(parseInt(e.target.value) || 0)}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  At least this many rooms will always remain allocated to the channel
                </p>
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Release</Label>
                  <p className="text-xs text-muted-foreground">Automatically process releases</p>
                </div>
                <Switch checked={formAutoRelease} onCheckedChange={setFormAutoRelease} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Enable this rule</p>
                </div>
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formChannelCode}>
                {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ PREVIEW DIALOG ============ */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Release Preview</DialogTitle>
              <DialogDescription>
                {previewRuleInfo && (
                  <>Channel: <strong>{previewRuleInfo.channelCode}</strong> &middot; Type: <strong>{getReleaseTypeLabel(previewRuleInfo.releaseType)}</strong></>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                <Label>From</Label>
                <Input type="date" value={previewStartDate} onChange={(e) => setPreviewStartDate(e.target.value)} className="w-40 h-8" />
                <Label>To</Label>
                <Input type="date" value={previewEndDate} onChange={(e) => setPreviewEndDate(e.target.value)} className="w-40 h-8" />
                <Button size="sm" variant="outline" onClick={handlePreview}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {previewData && previewData.length > 0 ? (
                <ScrollArea className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Days Before</TableHead>
                        <TableHead>Release %</TableHead>
                        <TableHead>Current Alloc</TableHead>
                        <TableHead>Est. Release</TableHead>
                        <TableHead>Est. After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{formatDateShort(item.date)}</TableCell>
                          <TableCell>
                            <Badge variant={item.daysBeforeArrival <= 7 ? 'destructive' : item.daysBeforeArrival <= 14 ? 'default' : 'secondary'}>
                              {item.daysBeforeArrival}d
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-amber-500"
                                  style={{ width: `${Math.min(item.releasePercent, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm">{item.releasePercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{item.currentAllotment}</TableCell>
                          <TableCell className="text-emerald-600 dark:text-emerald-400 font-medium">
                            -{item.estimatedRelease}
                          </TableCell>
                          <TableCell className="font-medium">{item.estimatedAfter}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Eye className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No releases to preview in this date range</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ DELETE CONFIRMATION DIALOG ============ */}
        <Dialog open={!!showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Release Rule</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this release rule? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default AllotmentRelease;

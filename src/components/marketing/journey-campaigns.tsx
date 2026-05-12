'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  Mail,
  MessageSquare,
  Send,
  Users,
  MousePointerClick,
  ArrowRightLeft,
  GripVertical,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Zap,
  BarChart3,
  Target,
  TrendingUp,
  FileText,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface JourneyAction {
  id: string;
  actionType: string;
  subject: string | null;
  content: string | null;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  convertedCount: number;
  sortOrder: number;
}

interface Journey {
  id: string;
  name: string;
  description: string | null;
  journeyType: string;
  triggerEvent: string;
  targetSegments: string;
  status: string;
  totalContacts: number;
  convertedCount: number;
  revenue: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  actions: JourneyAction[];
}

// ============================================================
// Constants
// ============================================================

const JOURNEY_TYPES = [
  { value: 'pre_arrival', label: 'Pre-Arrival', icon: '✈️' },
  { value: 'in_stay', label: 'In-Stay', icon: '🏨' },
  { value: 'post_stay', label: 'Post-Stay', icon: '⭐' },
  { value: 'win_back', label: 'Win-Back', icon: '🔄' },
  { value: 'onboarding', label: 'Onboarding', icon: '👋' },
];

const TRIGGER_EVENTS = [
  'booking_confirmed',
  'pre_arrival_7d',
  'pre_arrival_1d',
  'check_in',
  'mid_stay',
  'check_out',
  'post_stay_1d',
  'post_stay_7d',
  'review_submitted',
  'loyalty_signup',
  'no_activity_30d',
  'abandoned_booking',
];

const ACTION_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'push', label: 'Push', icon: Send },
  { value: 'wait', label: 'Wait / Delay', icon: Clock },
  { value: 'tag', label: 'Add Tag', icon: FileText },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  completed: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
};

// ============================================================
// Component
// ============================================================

export default function JourneyCampaigns() {
  const { toast } = useToast();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, totalContacts: 0, totalConverted: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('list');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('pre_arrival');
  const [formTrigger, setFormTrigger] = useState('booking_confirmed');
  const [formActions, setFormActions] = useState([{ actionType: 'email', subject: '', content: '', delay: 0 }]);

  const fetchJourneys = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterType !== 'all') params.set('journeyType', filterType);
      const res = await fetch(`/api/marketing/journeys?${params}`);
      const json = await res.json();
      if (json.success) {
        setJourneys(json.data.journeys || []);
        setStats(json.data.stats || { total: 0, active: 0, draft: 0, totalContacts: 0, totalConverted: 0, totalRevenue: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load journeys', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, toast]);

  useEffect(() => { fetchJourneys(); }, [fetchJourneys]);

  const filtered = journeys.filter((j) =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    j.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    setEditingJourney(null);
    setFormName('');
    setFormDesc('');
    setFormType('pre_arrival');
    setFormTrigger('booking_confirmed');
    setFormActions([{ actionType: 'email', subject: '', content: '', delay: 0 }]);
    setDialogOpen(true);
  };

  const handleEdit = (journey: Journey) => {
    setEditingJourney(journey);
    setFormName(journey.name);
    setFormDesc(journey.description || '');
    setFormType(journey.journeyType);
    setFormTrigger(journey.triggerEvent);
    setFormActions(
      journey.actions.length > 0
        ? journey.actions.map((a) => ({ actionType: a.actionType, subject: a.subject || '', content: a.content || '', delay: 0 }))
        : [{ actionType: 'email', subject: '', content: '', delay: 0 }]
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Validation Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    try {
      const body = {
        name: formName,
        description: formDesc || null,
        journeyType: formType,
        triggerEvent: formTrigger,
        actions: formActions.map((a) => ({ actionType: a.actionType, subject: a.subject, content: a.content })),
      };

      if (editingJourney) {
        const res = await fetch(`/api/marketing/journeys/${editingJourney.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) toast({ title: 'Success', description: 'Journey updated' });
        else toast({ title: 'Error', description: json.error, variant: 'destructive' });
      } else {
        const res = await fetch('/api/marketing/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) toast({ title: 'Success', description: 'Journey created' });
        else toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
      setDialogOpen(false);
      fetchJourneys();
    } catch {
      toast({ title: 'Error', description: 'Failed to save journey', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/marketing/journeys/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) toast({ title: 'Deleted', description: 'Journey deleted' });
      else toast({ title: 'Error', description: json.error, variant: 'destructive' });
      fetchJourneys();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleExecute = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/marketing/journeys/${id}/execute`, { method: 'POST' });
      const json = await res.json();
      if (json.success) toast({ title: 'Triggered', description: `"${name}" execution started` });
      else toast({ title: 'Error', description: json.error, variant: 'destructive' });
      fetchJourneys();
    } catch {
      toast({ title: 'Error', description: 'Failed to execute', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (journey: Journey) => {
    const newStatus = journey.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/marketing/journeys/${journey.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      const json = await res.json();
      if (json.success) toast({ title: 'Updated', description: `Journey ${newStatus}` });
      fetchJourneys();
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const addAction = () => setFormActions([...formActions, { actionType: 'email', subject: '', content: '', delay: 0 }]);
  const removeAction = (i: number) => setFormActions(formActions.filter((_, idx) => idx !== i));
  const moveAction = (i: number, dir: number) => {
    const arr = [...formActions];
    const target = i + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[i], arr[target]] = [arr[target], arr[i]];
    setFormActions(arr);
  };

  const getJourneyTypeLabel = (type: string) => JOURNEY_TYPES.find((t) => t.value === type)?.label || type;

  const getActionIcon = (type: string) => {
    const found = ACTION_TYPES.find((a) => a.value === type);
    const Icon = found?.icon || Mail;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-violet-600" />
            Journey Campaign Automation
          </h2>
          <p className="text-muted-foreground">Build automated guest communication journeys with stages and actions</p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          New Journey
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Total Journeys</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{stats.total}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">{stats.active} active, {stats.draft} drafts</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Target className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-700 dark:text-sky-400">Total Contacts</p>
                <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{stats.totalContacts.toLocaleString()}</p>
                <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Across all journeys</p>
              </div>
              <div className="p-3 rounded-full bg-sky-200 dark:bg-sky-800">
                <Users className="h-6 w-6 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Conversions</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalConverted.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.totalContacts > 0 ? `${((stats.totalConverted / stats.totalContacts) * 100).toFixed(1)}% rate` : 'N/A'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <MousePointerClick className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Revenue</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">${stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">From campaign conversions</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <TrendingUp className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search journeys..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Journey Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {JOURNEY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Journeys Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />Journey Campaigns</CardTitle>
          <CardDescription>{filtered.length} journey{filtered.length !== 1 ? 's' : ''} found</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading journeys...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No journeys found. Create one to get started.</div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Actions</TableHead>
                    <TableHead className="text-right">Contacts</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Conversions</TableHead>
                    <TableHead className="w-[120px]">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j) => {
                    const totalSent = j.actions.reduce((s, a) => s + a.sentCount, 0);
                    const totalOpened = j.actions.reduce((s, a) => s + a.openedCount, 0);
                    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
                    return (
                      <TableRow key={j.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{j.name}</p>
                            {j.description && <p className="text-xs text-muted-foreground max-w-[200px] truncate">{j.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {JOURNEY_TYPES.find((t) => t.value === j.journeyType)?.icon} {getJourneyTypeLabel(j.journeyType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{j.triggerEvent}</code>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[j.status] || ''} text-xs capitalize`}>{j.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BarChart3 className="h-3 w-3" />
                            {j.actions.length} steps · {openRate}% open rate
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{j.totalContacts.toLocaleString()}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell font-medium text-emerald-600">{j.convertedCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(j)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                            {j.status === 'active' ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(j)} title="Pause"><Pause className="h-3.5 w-3.5" /></Button>
                            ) : j.status !== 'completed' ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => handleExecute(j.id, j.name)} title="Execute"><Play className="h-3.5 w-3.5" /></Button>
                            ) : null}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(j.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJourney ? 'Edit Journey' : 'Create Journey Campaign'}</DialogTitle>
            <DialogDescription>Define the journey type, trigger event, and communication actions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Pre-Arrival Welcome Series" />
              </div>
              <div className="space-y-2">
                <Label>Journey Type *</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOURNEY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Trigger Event *</Label>
              <Select value={formTrigger} onValueChange={setFormTrigger}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((ev) => (
                    <SelectItem key={ev} value={ev}>
                      <code className="text-xs">{ev}</code>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Journey Actions (Stages)</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={addAction}><Plus className="h-3.5 w-3.5" /> Add Step</Button>
              </div>
              <p className="text-xs text-muted-foreground">Drag or use arrows to reorder. Each action sends in sequence.</p>

              <div className="space-y-2">
                {formActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button onClick={() => moveAction(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button onClick={() => moveAction(i, 1)} disabled={i === formActions.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-3">
                      <Select value={action.actionType} onValueChange={(v) => { const a = [...formActions]; a[i] = { ...a[i], actionType: v }; setFormActions(a); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((at) => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={action.subject} onChange={(e) => { const a = [...formActions]; a[i] = { ...a[i], subject: e.target.value }; setFormActions(a); }} placeholder="Subject line" />
                      <Input value={action.content} onChange={(e) => { const a = [...formActions]; a[i] = { ...a[i], content: e.target.value }; setFormActions(a); }} placeholder="Brief content..." />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 mt-1 shrink-0" onClick={() => removeAction(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingJourney ? 'Update' : 'Create'} Journey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

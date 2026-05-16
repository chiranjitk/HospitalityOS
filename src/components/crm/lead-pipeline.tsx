'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Phone, Mail, Globe, Megaphone, Building2, Calendar,
  ArrowRight, Loader2, TrendingUp, Target, Clock, AlertTriangle,
  Search, CheckCircle, XCircle, Star, Tag, UserPlus, Briefcase, Heart,
  PartyPopper, Hotel, Timer, GripVertical, MessageSquare, Video,
  FileText, ArrowUpRight, DollarSign, BarChart3, Filter, X, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: 'bg-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'qualification', label: 'Qualification', color: 'bg-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'proposal', label: 'Proposal', color: 'bg-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-950/30' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  { id: 'closing', label: 'Closing', color: 'bg-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'lost', label: 'Lost' },
  { value: 'converted', label: 'Converted' },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500', contacted: 'bg-sky-500', qualified: 'bg-amber-500',
  proposal_sent: 'bg-violet-500', negotiation: 'bg-orange-500',
  confirmed: 'bg-emerald-500', lost: 'bg-red-500', converted: 'bg-green-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  cold: 'bg-slate-400 text-white', warm: 'bg-amber-500 text-white',
  hot: 'bg-orange-500 text-white', urgent: 'bg-red-500 text-white',
};

const SOURCE_ICONS: Record<string, string> = {
  website: '🌐', phone: '📞', email: '📧', walk_in: '🚶', referral: '🤝',
  google_ads: '🔍', meta_ads: '📱', ota: '🏨', travel_agent: '🧳',
  corporate: '🏢', event: '🎉', whatsapp: '💬',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  meeting: <Video className="h-3.5 w-3.5" />,
  proposal: <FileText className="h-3.5 w-3.5" />,
  follow_up: <Clock className="h-3.5 w-3.5" />,
  note: <MessageSquare className="h-3.5 w-3.5" />,
  status_change: <ArrowUpRight className="h-3.5 w-3.5" />,
  assignment: <UserPlus className="h-3.5 w-3.5" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  meeting: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  proposal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  follow_up: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  note: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  status_change: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  assignment: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

// ─── Types ──────────────────────────────────────────────────────────

interface LeadData {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCompany?: string;
  source: string;
  type: string;
  status: string;
  priority: string;
  pipeline: string;
  score: number;
  estimatedRevenue?: number;
  roomCount?: number;
  guestCount?: number;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  notes?: string;
  tags?: string[];
  assignedTo?: string;
  createdAt: string;
  followUpDate?: string;
  convertedBookingId?: string;
  lossReason?: string;
}

interface ActivityData {
  id: string;
  type: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

interface Analytics {
  total: number;
  newLeads: number;
  activeLeads: number;
  conversionRate: number;
  avgScore: number;
  avgDealSize: number;
  avgResponseTimeHours: number;
  totalEstimatedRevenue: number;
  convertedRevenue: number;
  overdueFollowUps: number;
  todayLeads: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  pipelineValueByStage: Record<string, number>;
  winRateBySource: Record<string, number>;
}

// ─── Component ──────────────────────────────────────────────────────

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Record<string, LeadData[]>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyId] = useState('preview-property');

  // Drag and drop state
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string>('');

  // Create form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formSource, setFormSource] = useState('website');
  const [formType, setFormType] = useState('general');
  const [formPriority, setFormPriority] = useState('warm');
  const [formNotes, setFormNotes] = useState('');
  const [formArrival, setFormArrival] = useState('');
  const [formDeparture, setFormDeparture] = useState('');
  const [formRooms, setFormRooms] = useState('');
  const [formGuests, setFormGuests] = useState('');
  const [formRevenue, setFormRevenue] = useState('');

  // Activity form
  const [activityType, setActivityType] = useState('note');
  const [activityContent, setActivityContent] = useState('');

  // Convert form
  const [convertRoomTypeId, setConvertRoomTypeId] = useState('');
  const [convertGuestId, setConvertGuestId] = useState('');
  const [convertCheckIn, setConvertCheckIn] = useState('');
  const [convertCheckOut, setConvertCheckOut] = useState('');
  const [convertSpecialRequests, setConvertSpecialRequests] = useState('');

  // ─── Data fetching ─────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ propertyId, view });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterSource !== 'all') params.set('source', filterSource);
      if (filterType !== 'all') params.set('type', filterType);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/crm/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        if (json.view === 'pipeline') {
          setLeads(json.data);
        } else {
          setLeads({ all: json.data });
        }
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId, view, filterStatus, filterSource, filterType, searchQuery]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/leads/analytics?propertyId=${propertyId}`);
      const json = await res.json();
      if (json.success) setAnalytics(json.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [propertyId]);

  useEffect(() => { fetchLeads(); fetchAnalytics(); }, [fetchLeads, fetchAnalytics]);

  const fetchActivities = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activities?limit=50`);
      const json = await res.json();
      if (json.success) setActivities(json.data);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────

  const openDetail = (lead: LeadData) => {
    setSelectedLead(lead);
    setShowDetailDialog(true);
    fetchActivities(lead.id);
  };

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPhone) {
      toast.error('Name, email, and phone are required');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId, contactName: formName, contactEmail: formEmail, contactPhone: formPhone,
          contactCompany: formCompany || undefined, source: formSource, type: formType,
          priority: formPriority, notes: formNotes || undefined,
          estimatedArrival: formArrival || undefined, estimatedDeparture: formDeparture || undefined,
          roomCount: formRooms ? parseInt(formRooms) : undefined, guestCount: formGuests ? parseInt(formGuests) : undefined,
          estimatedRevenue: formRevenue ? parseFloat(formRevenue) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Lead created successfully!');
        setShowCreateDialog(false);
        resetForm();
        fetchLeads();
        fetchAnalytics();
      } else {
        toast.error(json.error?.message || 'Failed to create lead');
      }
    } catch {
      toast.error('Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: string, lossReason?: string) => {
    try {
      const body: Record<string, string> = { status: newStatus };
      if (lossReason) body.lossReason = lossReason;
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Lead moved to ${newStatus.replace(/_/g, ' ')}`);
        fetchLeads();
        fetchAnalytics();
        if (selectedLead?.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus });
          fetchActivities(leadId);
        }
      } else {
        toast.error(json.error?.message || 'Failed to update lead');
      }
    } catch {
      toast.error('Failed to update lead');
    }
  };

  const handleAddActivity = async () => {
    if (!selectedLead || !activityContent.trim()) return;
    try {
      setAddingActivity(true);
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activityType, content: activityContent.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Activity logged');
        setActivityContent('');
        fetchActivities(selectedLead.id);
        fetchLeads();
        fetchAnalytics();
        // Update the score shown in detail
        if (json.leadScore !== undefined && selectedLead) {
          setSelectedLead({ ...selectedLead, score: json.leadScore });
        }
      } else {
        toast.error(json.error?.message || 'Failed to add activity');
      }
    } catch {
      toast.error('Failed to add activity');
    } finally {
      setAddingActivity(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedLead || !convertRoomTypeId || !convertGuestId || !convertCheckIn || !convertCheckOut) {
      toast.error('Room type, guest, check-in, and check-out are required');
      return;
    }
    try {
      setConverting(true);
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: convertRoomTypeId,
          guestId: convertGuestId,
          checkIn: convertCheckIn,
          checkOut: convertCheckOut,
          specialRequests: convertSpecialRequests || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Lead converted! Booking: ${json.data.confirmationCode}`);
        setShowConvertDialog(false);
        setShowDetailDialog(false);
        fetchLeads();
        fetchAnalytics();
        resetConvertForm();
      } else {
        toast.error(json.error?.message || 'Failed to convert lead');
      }
    } catch {
      toast.error('Failed to convert lead');
    } finally {
      setConverting(false);
    }
  };

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany('');
    setFormSource('website'); setFormType('general'); setFormPriority('warm');
    setFormNotes(''); setFormArrival(''); setFormDeparture('');
    setFormRooms(''); setFormGuests(''); setFormRevenue('');
  };

  const resetConvertForm = () => {
    setConvertRoomTypeId(''); setConvertGuestId('');
    setConvertCheckIn(''); setConvertCheckOut('');
    setConvertSpecialRequests('');
  };

  // ─── Drag and drop ─────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead) return;

    // Map pipeline stage to suggested status
    const stageToStatus: Record<string, string> = {
      inquiry: 'contacted',
      qualification: 'qualified',
      proposal: 'proposal_sent',
      negotiation: 'negotiation',
      closing: 'confirmed',
    };

    const newStatus = stageToStatus[stageId];
    if (newStatus) {
      await handleUpdateStatus(draggedLead, newStatus);
    }

    setDraggedLead(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  // ─── Helpers ───────────────────────────────────────────────────

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const scoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const daysSinceCreation = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const filteredLeads = (stageLeads: LeadData[]) => {
    let result = stageLeads || [];
    if (filterStatus !== 'all') result = result.filter(l => l.status === filterStatus);
    if (filterSource !== 'all') result = result.filter(l => l.source === filterSource);
    if (filterType !== 'all') result = result.filter(l => l.type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.contactName.toLowerCase().includes(q) ||
        l.contactEmail.toLowerCase().includes(q) ||
        l.contactCompany?.toLowerCase().includes(q)
      );
    }
    return result;
  };

  const totalPipelineValue = analytics
    ? Object.values(analytics.pipelineValueByStage).reduce((s, v) => s + v, 0)
    : 0;

  // ─── Loading state ─────────────────────────────────────────────

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-teal-600" />
            Lead Pipeline
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Convert inquiries into bookings with automated scoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button size="sm" variant={view === 'pipeline' ? 'default' : 'ghost'} onClick={() => setView('pipeline')} className="h-8 text-xs">
              Pipeline
            </Button>
            <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} onClick={() => setView('list')} className="h-8 text-xs">
              List
            </Button>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="h-4 w-4" /> New Lead
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold">{analytics.total}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <UserPlus className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-[11px] text-muted-foreground">New</span>
            </div>
            <p className="text-xl font-bold">{analytics.newLeads}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-muted-foreground">Active</span>
            </div>
            <p className="text-xl font-bold">{analytics.activeLeads}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-muted-foreground">Conv. Rate</span>
            </div>
            <p className="text-xl font-bold">{analytics.conversionRate}%</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] text-muted-foreground">Avg Score</span>
            </div>
            <p className="text-xl font-bold">{analytics.avgScore}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-muted-foreground">Pipeline Value</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalPipelineValue)}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] text-muted-foreground">Avg Response</span>
            </div>
            <p className="text-xl font-bold">{analytics.avgResponseTimeHours}h</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[11px] text-muted-foreground">Overdue</span>
            </div>
            <p className="text-xl font-bold text-red-600">{analytics.overdueFollowUps}</p>
          </Card>
        </div>
      )}

      {/* Pipeline Value Bar */}
      {analytics && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Pipeline Value by Stage</span>
            <span className="text-sm text-muted-foreground">Total: {formatCurrency(totalPipelineValue)}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {PIPELINE_STAGES.map(stage => {
              const value = analytics.pipelineValueByStage[stage.id] || 0;
              const pct = totalPipelineValue > 0 ? (value / totalPipelineValue) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={stage.id}
                  className={cn('rounded-full transition-all', stage.color)}
                  style={{ width: `${pct}%` }}
                  title={`${stage.label}: ${formatCurrency(value)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.id} className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', stage.color)} />
                <span className="text-[10px] text-muted-foreground">{stage.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchQuery('')}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="website">🌐 Website</SelectItem>
            <SelectItem value="phone">📞 Phone</SelectItem>
            <SelectItem value="email">📧 Email</SelectItem>
            <SelectItem value="corporate">🏢 Corporate</SelectItem>
            <SelectItem value="travel_agent">🧳 Travel Agent</SelectItem>
            <SelectItem value="google_ads">🔍 Google Ads</SelectItem>
            <SelectItem value="meta_ads">📱 Meta Ads</SelectItem>
            <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
            <SelectItem value="walk_in">🚶 Walk-in</SelectItem>
            <SelectItem value="referral">🤝 Referral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="group_booking">Group Booking</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
            <SelectItem value="wedding">Wedding</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="banquet">Banquet</SelectItem>
            <SelectItem value="long_stay">Long Stay</SelectItem>
          </SelectContent>
        </Select>
        {(filterSource !== 'all' || filterType !== 'all' || searchQuery) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFilterSource('all'); setFilterType('all'); setSearchQuery(''); }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* ─── Pipeline Kanban View ──────────────────────────────── */}
      {view === 'pipeline' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-[1000px]">
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = filteredLeads(leads[stage.id] || []);
              const stageValue = analytics?.pipelineValueByStage[stage.id] || 0;
              const isDragOver = dragOverStage === stage.id;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex-1 min-w-[190px] max-w-[260px] rounded-xl transition-all',
                    isDragOver && stage.bgColor
                  )}
                  onDragOver={e => handleDragOver(e, stage.id)}
                  onDrop={e => handleDrop(e, stage.id)}
                  onDragLeave={() => setDragOverStage(null)}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn('w-2.5 h-2.5 rounded-full', stage.color)} />
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <Badge variant="secondary" className="text-[10px] ml-auto">{stageLeads.length}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatCurrency(stageValue)}</span>
                  </div>

                  {/* Cards */}
                  <ScrollArea className="h-[calc(100vh-400px)] min-h-[200px]">
                    <div className="space-y-2 pr-1">
                      {stageLeads.map(lead => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={e => handleDragStart(e, lead.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openDetail(lead)}
                          className={cn(
                            'p-3 rounded-lg border bg-card hover:shadow-md transition-all duration-200 space-y-2 cursor-grab active:cursor-grabbing',
                            draggedLead === lead.id && 'opacity-50 scale-95',
                            lead.status === 'lost' && 'opacity-70 border-red-200 dark:border-red-900/50',
                            lead.status === 'converted' && 'border-emerald-200 dark:border-emerald-900/50'
                          )}
                        >
                          {/* Top row: name + score */}
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm truncate flex-1">{lead.contactName}</p>
                            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', scoreColor(lead.score))}>
                              {lead.score}
                            </span>
                          </div>

                          {/* Company / email */}
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.contactCompany || lead.contactEmail}
                          </p>

                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs">{SOURCE_ICONS[lead.source] || '📌'}</span>
                            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[lead.priority])}>
                              {lead.priority}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {lead.type.replace(/_/g, ' ')}
                            </Badge>
                            {(lead.status === 'lost' || lead.status === 'converted') && (
                              <Badge className={cn('text-[10px] px-1.5 py-0 text-white', STATUS_COLORS[lead.status])}>
                                {lead.status}
                              </Badge>
                            )}
                          </div>

                          {/* Revenue */}
                          {lead.estimatedRevenue ? (
                            <p className="text-xs font-semibold text-emerald-600">
                              {formatCurrency(lead.estimatedRevenue)}
                            </p>
                          ) : null}

                          {/* Footer: days */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {daysSinceCreation(lead.createdAt)}d ago
                            </span>
                            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        </div>
                      ))}

                      {stageLeads.length === 0 && (
                        <div className={cn(
                          'p-6 text-center text-xs text-muted-foreground border rounded-lg border-dashed',
                          isDragOver && 'border-primary border-solid bg-primary/5'
                        )}>
                          {isDragOver ? 'Drop here' : 'No leads'}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── List View ──────────────────────────────────────────── */}
      {view === 'list' && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {filteredLeads(leads['all'] || []).map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => openDetail(lead)}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-4"
                  >
                    <div className={cn('w-2 h-10 rounded-full shrink-0', STATUS_COLORS[lead.status] || 'bg-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{lead.contactName}</p>
                        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[lead.priority])}>
                          {lead.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {lead.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{lead.contactEmail} • {lead.contactCompany || lead.source}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      {lead.estimatedRevenue ? (
                        <p className="text-sm font-semibold text-emerald-600">{formatCurrency(lead.estimatedRevenue)}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{daysSinceCreation(lead.createdAt)}d ago</p>
                    </div>
                    <div className="text-center w-12 hidden sm:block">
                      <p className={cn('text-lg font-bold', scoreColor(lead.score))}>{lead.score}</p>
                      <p className="text-[10px] text-muted-foreground">score</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
                {filteredLeads(leads['all'] || []).length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No leads found</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ─── Create Lead Dialog ─────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Contact Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Smith" className="mt-1" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="john@company.com" className="mt-1" />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+1 555 123 4567" className="mt-1" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="Company name" className="mt-1" />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={formSource} onValueChange={setFormSource}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">🌐 Website</SelectItem>
                    <SelectItem value="phone">📞 Phone</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="walk_in">🚶 Walk-in</SelectItem>
                    <SelectItem value="referral">🤝 Referral</SelectItem>
                    <SelectItem value="corporate">🏢 Corporate</SelectItem>
                    <SelectItem value="travel_agent">🧳 Travel Agent</SelectItem>
                    <SelectItem value="google_ads">🔍 Google Ads</SelectItem>
                    <SelectItem value="meta_ads">📱 Meta Ads</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="group_booking">Group Booking</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="banquet">Banquet</SelectItem>
                    <SelectItem value="long_stay">Long Stay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Est. Arrival</Label>
                <Input type="date" value={formArrival} onChange={e => setFormArrival(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Est. Departure</Label>
                <Input type="date" value={formDeparture} onChange={e => setFormDeparture(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Rooms</Label>
                <Input type="number" value={formRooms} onChange={e => setFormRooms(e.target.value)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Guests</Label>
                <Input type="number" value={formGuests} onChange={e => setFormGuests(e.target.value)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Est. Revenue ($)</Label>
                <Input type="number" value={formRevenue} onChange={e => setFormRevenue(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Additional notes..." className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-teal-600 hover:bg-teal-700 text-white">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Lead Detail Dialog ─────────────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedLead && (
            <>
              <DialogHeader className="pb-3">
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  {selectedLead.contactName}
                  <Badge className={cn('text-xs', PRIORITY_COLORS[selectedLead.priority])}>{selectedLead.priority}</Badge>
                  <Badge variant="outline" className="text-xs">{selectedLead.type.replace(/_/g, ' ')}</Badge>
                  <Badge className={cn('text-xs text-white', STATUS_COLORS[selectedLead.status])}>{selectedLead.status.replace(/_/g, ' ')}</Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Created {new Date(selectedLead.createdAt).toLocaleDateString()} • {daysSinceCreation(selectedLead.createdAt)} days ago
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="flex-1 overflow-hidden">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="activities" className="text-xs">Activities</TabsTrigger>
                  <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-3 overflow-y-auto max-h-[50vh]">
                  <div className="space-y-4">
                    {/* Contact info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{selectedLead.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.contactPhone}</span>
                      </div>
                      {selectedLead.contactCompany && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedLead.contactCompany}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span>{SOURCE_ICONS[selectedLead.source]}</span>
                        <span className="text-muted-foreground">via {selectedLead.source.replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className={cn('text-xl font-bold', scoreColor(selectedLead.score))}>{selectedLead.score}</p>
                        <p className="text-[10px] text-muted-foreground">Score</p>
                      </div>
                      {selectedLead.roomCount ? (
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <p className="text-xl font-bold">{selectedLead.roomCount}</p>
                          <p className="text-[10px] text-muted-foreground">Rooms</p>
                        </div>
                      ) : null}
                      {selectedLead.guestCount ? (
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <p className="text-xl font-bold">{selectedLead.guestCount}</p>
                          <p className="text-[10px] text-muted-foreground">Guests</p>
                        </div>
                      ) : null}
                      {selectedLead.estimatedRevenue ? (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-center">
                          <p className="text-lg font-bold text-emerald-700">{formatCurrency(selectedLead.estimatedRevenue)}</p>
                          <p className="text-[10px] text-muted-foreground">Est. Revenue</p>
                        </div>
                      ) : null}
                    </div>

                    {/* Dates */}
                    {(selectedLead.estimatedArrival || selectedLead.estimatedDeparture || selectedLead.followUpDate) && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {selectedLead.estimatedArrival && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span>Arrival: {new Date(selectedLead.estimatedArrival).toLocaleDateString()}</span>
                          </div>
                        )}
                        {selectedLead.estimatedDeparture && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span>Departure: {new Date(selectedLead.estimatedDeparture).toLocaleDateString()}</span>
                          </div>
                        )}
                        {selectedLead.followUpDate && (
                          <div className="flex items-center gap-2">
                            <Clock className={cn('h-4 w-4', new Date(selectedLead.followUpDate) < new Date() ? 'text-red-500' : 'text-muted-foreground')} />
                            <span className={new Date(selectedLead.followUpDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                              Follow-up: {new Date(selectedLead.followUpDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {selectedLead.notes && (
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs font-semibold mb-1 text-muted-foreground">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{selectedLead.notes}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {selectedLead.tags && selectedLead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedLead.tags.map((tag: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs gap-1"><Tag className="h-2 w-2" />{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Loss reason */}
                    {selectedLead.status === 'lost' && selectedLead.lossReason && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
                        <p className="text-xs font-semibold text-red-600 mb-1">Loss Reason</p>
                        <p className="text-sm text-red-700">{selectedLead.lossReason}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activities" className="mt-3 overflow-y-auto max-h-[50vh]">
                  {/* Add activity form */}
                  <div className="flex gap-2 mb-4 p-3 rounded-lg bg-muted">
                    <Select value={activityType} onValueChange={setActivityType}>
                      <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">📞 Call</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="meeting">🎥 Meeting</SelectItem>
                        <SelectItem value="note">💬 Note</SelectItem>
                        <SelectItem value="follow_up">⏰ Follow-up</SelectItem>
                        <SelectItem value="proposal">📄 Proposal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Add activity note..."
                      value={activityContent}
                      onChange={e => setActivityContent(e.target.value)}
                      className="flex-1 h-9 text-sm"
                      onKeyDown={e => { if (e.key === 'Enter') handleAddActivity(); }}
                    />
                    <Button size="sm" onClick={handleAddActivity} disabled={addingActivity || !activityContent.trim()} className="bg-teal-600 hover:bg-teal-700 text-white h-9">
                      {addingActivity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {/* Activity timeline */}
                  <div className="space-y-1">
                    {activities.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">No activities yet</div>
                    )}
                    {activities.map((activity, idx) => (
                      <div key={activity.id} className="flex gap-3 py-2">
                        <div className="flex flex-col items-center">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', ACTIVITY_COLORS[activity.type] || 'bg-slate-100')}>
                            {ACTIVITY_ICONS[activity.type] || <MessageSquare className="h-3.5 w-3.5" />}
                          </div>
                          {idx < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold capitalize">{activity.type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{activity.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="mt-3 overflow-y-auto max-h-[50vh]">
                  <div className="space-y-4">
                    {/* Status transitions */}
                    <div>
                      <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Move to Status</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map(opt => {
                          const isCurrent = selectedLead.status === opt.value;
                          const isTerminal = opt.value === 'converted' || opt.value === 'lost';
                          return (
                            <Button
                              key={opt.value}
                              size="sm"
                              variant={isCurrent ? 'default' : 'outline'}
                              onClick={() => !isCurrent && handleUpdateStatus(selectedLead.id, opt.value)}
                              disabled={isCurrent || (selectedLead.status === 'converted') || (selectedLead.status === 'lost')}
                              className={cn(
                                'text-xs h-7',
                                isCurrent && 'text-white',
                                isTerminal && !isCurrent && 'border-red-200 text-red-600 hover:bg-red-50'
                              )}
                            >
                              {opt.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Convert to booking */}
                    {selectedLead.status !== 'converted' && selectedLead.status !== 'lost' && (
                      <div>
                        <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Convert to Booking</p>
                        <Button
                          onClick={() => {
                            if (selectedLead.estimatedArrival) setConvertCheckIn(selectedLead.estimatedArrival.split('T')[0]);
                            if (selectedLead.estimatedDeparture) setConvertCheckOut(selectedLead.estimatedDeparture.split('T')[0]);
                            setShowConvertDialog(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                          <CheckCircle className="h-4 w-4" /> Convert to Booking
                        </Button>
                      </div>
                    )}

                    <Separator />

                    {/* Score progress */}
                    <div>
                      <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Lead Score</p>
                      <div className="flex items-center gap-3">
                        <Progress value={selectedLead.score} className="flex-1 h-2" />
                        <span className={cn('text-sm font-bold', scoreColor(selectedLead.score))}>{selectedLead.score}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Based on source, type, revenue estimate, and engagement activity
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Convert to Booking Dialog ──────────────────────────── */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead to Booking</DialogTitle>
            <DialogDescription>
              Create a confirmed booking from this lead inquiry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {selectedLead && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <p className="font-semibold">{selectedLead.contactName}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedLead.contactEmail} • {selectedLead.contactCompany || selectedLead.type.replace(/_/g, ' ')}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label>Room Type ID *</Label>
                <Input
                  value={convertRoomTypeId}
                  onChange={e => setConvertRoomTypeId(e.target.value)}
                  placeholder="Enter room type ID"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Guest ID *</Label>
                <Input
                  value={convertGuestId}
                  onChange={e => setConvertGuestId(e.target.value)}
                  placeholder="Enter guest ID"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Check-in *</Label>
                  <Input type="date" value={convertCheckIn} onChange={e => setConvertCheckIn(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Check-out *</Label>
                  <Input type="date" value={convertCheckOut} onChange={e => setConvertCheckOut(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Special Requests</Label>
                <Textarea value={convertSpecialRequests} onChange={e => setConvertSpecialRequests(e.target.value)} placeholder="Any special requests..." className="mt-1" rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
            <Button
              onClick={handleConvert}
              disabled={converting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Convert & Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

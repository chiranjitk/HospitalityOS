'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Flame,
  Thermometer,
  Snowflake,
  DollarSign,
  TrendingUp,
  Target,
  UserPlus,
  Mail,
  Globe,
  Phone,
  Star,
  Loader2,
  RefreshCw,
  Trash2,
  ArrowRight,
  XCircle,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Edit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// ─── Types ──────────────────────────────────────────────────────

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'confirmed' | 'converted' | 'lost';
type LeadPriority = 'cold' | 'warm' | 'hot' | 'urgent';
type LeadSource = 'website' | 'phone' | 'email' | 'walk_in' | 'referral' | 'google_ads' | 'meta_ads' | 'ota' | 'travel_agent' | 'corporate' | 'event' | 'whatsapp';
type LeadType = 'group_booking' | 'corporate' | 'wedding' | 'event' | 'banquet' | 'long_stay' | 'general';

interface Lead {
  id: string;
  tenantId: string;
  propertyId: string;
  source: LeadSource;
  type: LeadType;
  status: LeadStatus;
  priority: LeadPriority;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCompany?: string;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  roomCount?: number;
  guestCount?: number;
  estimatedRevenue?: number;
  assignedTo?: string;
  notes: string;
  followUpDate?: string;
  lossReason?: string;
  convertedBookingId?: string;
  tags: string[];
  pipeline: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

interface LeadActivity {
  id: string;
  leadId: string;
  type: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: { key: LeadStatus; label: string; color: string; icon: typeof Users }[] = [
  { key: 'new', label: 'New', color: 'from-sky-500 to-sky-600', icon: UserPlus },
  { key: 'contacted', label: 'Contacted', color: 'from-cyan-500 to-cyan-600', icon: Phone },
  { key: 'qualified', label: 'Qualified', color: 'from-amber-500 to-amber-600', icon: Thermometer },
  { key: 'proposal_sent', label: 'Proposal', color: 'from-orange-500 to-orange-600', icon: Mail },
  { key: 'negotiation', label: 'Negotiation', color: 'from-violet-500 to-purple-600', icon: Target },
  { key: 'confirmed', label: 'Confirmed', color: 'from-teal-500 to-teal-600', icon: CheckCircle2 },
  { key: 'converted', label: 'Won', color: 'from-emerald-500 to-green-600', icon: Star },
  { key: 'lost', label: 'Lost', color: 'from-gray-400 to-gray-500', icon: XCircle },
];

const SOURCE_OPTIONS: { value: LeadSource; label: string; icon: typeof Globe }[] = [
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'walk_in', label: 'Walk-in', icon: Users },
  { value: 'referral', label: 'Referral', icon: Users },
  { value: 'google_ads', label: 'Google Ads', icon: TrendingUp },
  { value: 'meta_ads', label: 'Meta Ads', icon: TrendingUp },
  { value: 'ota', label: 'OTA', icon: Globe },
  { value: 'travel_agent', label: 'Travel Agent', icon: Building2 },
  { value: 'corporate', label: 'Corporate', icon: Building2 },
  { value: 'event', label: 'Event', icon: Calendar },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

const TYPE_OPTIONS: { value: LeadType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'group_booking', label: 'Group Booking' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'event', label: 'Event' },
  { value: 'banquet', label: 'Banquet' },
  { value: 'long_stay', label: 'Long Stay' },
];

const PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: 'cold', label: 'Cold' },
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
  { value: 'urgent', label: 'Urgent' },
];

const VALID_TRANSITIONS: Record<string, LeadStatus[]> = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['qualified', 'proposal_sent', 'lost'],
  qualified: ['proposal_sent', 'negotiation', 'lost'],
  proposal_sent: ['negotiation', 'confirmed', 'lost'],
  negotiation: ['confirmed', 'proposal_sent', 'lost'],
  confirmed: ['converted', 'lost'],
  lost: [],
  converted: [],
};

const getScoreBadge = (score: number) => {
  if (score >= 80) return { label: 'Hot', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: Flame };
  if (score >= 50) return { label: 'Warm', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Thermometer };
  return { label: 'Cold', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300', icon: Snowflake };
};

const getSourceIcon = (source: string) => {
  return SOURCE_OPTIONS.find(s => s.value === source)?.icon || Globe;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? t('lpJustNow') : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ─── Component ──────────────────────────────────────────────────

export default function LeadPipeline() {
  const t = useTranslations('crm');
  const { toast } = useToast();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isMoveStageOpen, setIsMoveStageOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [moveToStatus, setMoveToStatus] = useState<LeadStatus | ''>('');
  const [lossReason, setLossReason] = useState('');

  // Add lead form
  const [addForm, setAddForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactCompany: '',
    source: 'website' as LeadSource,
    type: 'general' as LeadType,
    priority: 'warm' as LeadPriority,
    estimatedRevenue: '',
    roomCount: '',
    guestCount: '',
    estimatedArrival: '',
    estimatedDeparture: '',
    notes: '',
    followUpDate: '',
  });

  // Activity form
  const [activityForm, setActivityForm] = useState({
    type: 'note' as string,
    content: '',
  });

  // Fetch property
  useEffect(() => {
    let cancelled = false;
    fetch('/api/properties?limit=1')
      .then(res => res.json())
      .then(result => {
        if (!cancelled && result.success && result.data?.length > 0) {
          setPropertyId(result.data[0].id);
        }
      })
      .catch((error) => { console.error('Context: fetching initial property:', error); });
    return () => { cancelled = true; };
  }, []);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ propertyId, limit: '200' });
      if (searchQuery.length >= 2) params.append('search', searchQuery);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setLeads(result.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, searchQuery, selectedStatus, toast]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(), 300);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  // Fetch lead details + activities
  const fetchLeadDetail = async (leadId: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`);
      const result = await res.json();
      if (result.success) {
        setSelectedLead(result.data);
        setLeadActivities(result.activities || []);
      }
    } catch (error) { console.error('Context: fetching lead detail:', error); }
  };

  // Create lead
  const handleCreateLead = async () => {
    if (!addForm.contactName || !addForm.contactEmail || !addForm.contactPhone) {
      toast({ title: t('lpValidationError'), description: t('lpNameEmailPhoneRequired'), variant: 'destructive' });
      return;
    }
    if (!propertyId) {
      toast({ title: 'Error', description: t('lpNoPropertySelected'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          contactName: addForm.contactName,
          contactEmail: addForm.contactEmail,
          contactPhone: addForm.contactPhone,
          contactCompany: addForm.contactCompany || undefined,
          source: addForm.source,
          type: addForm.type,
          priority: addForm.priority,
          estimatedRevenue: addForm.estimatedRevenue ? parseFloat(addForm.estimatedRevenue) : undefined,
          roomCount: addForm.roomCount ? parseInt(addForm.roomCount) : undefined,
          guestCount: addForm.guestCount ? parseInt(addForm.guestCount) : undefined,
          estimatedArrival: addForm.estimatedArrival || undefined,
          estimatedDeparture: addForm.estimatedDeparture || undefined,
          notes: addForm.notes,
          followUpDate: addForm.followUpDate || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('lpLeadCreated'), description: t('lpAddedToPipeline', { name: addForm.contactName }) });
        setIsAddOpen(false);
        setAddForm({ contactName: '', contactEmail: '', contactPhone: '', contactCompany: '', source: 'website', type: 'general', priority: 'warm', estimatedRevenue: '', roomCount: '', guestCount: '', estimatedArrival: '', estimatedDeparture: '', notes: '', followUpDate: '' });
        fetchLeads();
      } else {
        toast({ title: 'Error', description: result.error?.message || t('lpFailedToCreate'), variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: t('lpFailedToCreate'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Move lead stage
  const handleMoveStage = async () => {
    if (!selectedLead || !moveToStatus) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: moveToStatus, lossReason: moveToStatus === 'lost' ? lossReason || 'No response' : undefined }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('lpLeadUpdated'), description: `Moved to ${STATUS_CONFIG.find(s => s.key === moveToStatus)?.label || moveToStatus}` });
        setIsMoveStageOpen(false);
        setMoveToStatus('');
        setLossReason('');
        fetchLeads();
        if (isDetailOpen) fetchLeadDetail(selectedLead.id);
      } else {
        toast({ title: 'Error', description: result.error?.message || t('lpFailedToUpdate'), variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: t('lpFailedToUpdate'), variant: 'destructive', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Archive lead
  const handleArchive = async (leadId: string) => {
    if (!confirm(t('lpArchiveConfirm'))) return;
    try {
      const res = await fetch(`/api/crm/leads?id=${leadId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('lpLeadArchived') });
        setIsDetailOpen(false);
        setSelectedLead(null);
        fetchLeads();
      } else {
        toast({ title: 'Error', description: result.error?.message || t('lpFailedToArchive'), variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to archive lead', variant: 'destructive' });
    }
  };

  // Add activity
  const handleAddActivity = async () => {
    if (!selectedLead || !activityForm.content.trim()) {
      toast({ title: 'Validation', description: t('lpActivityRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activityForm.type, content: activityForm.content.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('lpActivityAdded') });
        setActivityForm({ type: 'note', content: '' });
        fetchLeadDetail(selectedLead.id);
        fetchLeads();
      } else {
        toast({ title: 'Error', description: result.error?.message || t('lpFailedToAddActivity'), variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add activity', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const hotLeads = leads.filter(l => l.score >= 80).length;
  const warmLeads = leads.filter(l => l.score >= 50 && l.score < 80).length;
  const coldLeads = leads.filter(l => l.score < 50).length;
  const totalPipelineValue = leads.filter(l => !['converted', 'lost'].includes(l.status)).reduce((s, l) => s + (l.estimatedRevenue || 0), 0);
  const wonValue = leads.filter(l => l.status === 'converted').reduce((s, l) => s + (l.estimatedRevenue || 0), 0);

  // Group by status
  const leadsByStatus = STATUS_CONFIG.map(cfg => ({
    ...cfg,
    leads: leads.filter(l => l.status === cfg.key),
    totalValue: leads.filter(l => l.status === cfg.key).reduce((s, l) => s + (l.estimatedRevenue || 0), 0),
  }));

  const filteredByStatus = selectedStatus === 'all' ? leadsByStatus : leadsByStatus.filter(s => s.key === selectedStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Lead Pipeline
          </h2>
          <p className="text-muted-foreground text-sm">
            Track and manage sales leads through your conversion funnel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLeads} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-red-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpHot')}</p>
            </div>
            <p className="text-xl font-bold">{hotLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpWarm')}</p>
            </div>
            <p className="text-xl font-bold">{warmLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/50 dark:to-sky-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpCold')}</p>
            </div>
            <p className="text-xl font-bold">{coldLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-violet-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpPipeline')}</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalPipelineValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-emerald-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpWon')}</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(wonValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/50 dark:to-cyan-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-teal-500" />
              <p className="text-xs font-medium text-muted-foreground">{t('lpTotal')}</p>
            </div>
            <p className="text-xl font-bold">{leads.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Input
            placeholder={t('lpSearchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-4"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('all')}
            className={selectedStatus === 'all' ? 'bg-teal-600 hover:bg-teal-700' : ''}
          >
            All ({leads.length})
          </Button>
          {STATUS_CONFIG.map((cfg) => {
            const StageIcon = cfg.icon;
            const count = leads.filter(l => l.status === cfg.key).length;
            return (
              <Button
                key={cfg.key}
                variant={selectedStatus === cfg.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus(cfg.key)}
                className={selectedStatus === cfg.key ? 'bg-teal-600 hover:bg-teal-700' : ''}
              >
                <StageIcon className="h-3 w-3 mr-1" />
                {cfg.label} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Pipeline Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">{t('lpNoLeadsYet')}</p>
            <p className="text-sm mt-1">{t('lpNoLeadsHint')}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredByStatus.map((stage) => {
            const StageIcon = stage.icon;
            return (
              <Card key={stage.key} className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-gradient-to-r", stage.color)}>
                        <StageIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{stage.label}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {stage.leads.length} lead{stage.leads.length !== 1 ? 's' : ''} · {formatCurrency(stage.totalValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {stage.leads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('lpNoLeadsInStage')}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {stage.leads.map((lead) => {
                        const scoreInfo = getScoreBadge(lead.score);
                        const SourceIcon = getSourceIcon(lead.source);
                        return (
                          <div
                            key={lead.id}
                            className="p-4 rounded-lg border hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all cursor-pointer"
                            onClick={() => {
                              fetchLeadDetail(lead.id);
                              setIsDetailOpen(true);
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{lead.contactName}</p>
                                <p className="text-xs text-muted-foreground truncate">{lead.contactCompany || lead.contactEmail}</p>
                              </div>
                              <Badge className={cn("shrink-0 ml-2", scoreInfo.className)}>
                                <scoreInfo.icon className="h-3 w-3 mr-1" />
                                {lead.score}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                <SourceIcon className="h-3 w-3 mr-1" />
                                {lead.source.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {lead.type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {lead.estimatedRevenue ? formatCurrency(lead.estimatedRevenue) : '—'}
                              </span>
                              <span className="text-xs text-muted-foreground">{timeAgo(lead.createdAt)}</span>
                            </div>
                            {lead.followUpDate && new Date(lead.followUpDate) < new Date() && lead.status !== 'converted' && lead.status !== 'lost' && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                Follow-up overdue
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ADD LEAD DIALOG
          ═══════════════════════════════════════════ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New Lead
            </DialogTitle>
            <DialogDescription>{t('lpEnterLeadDetails')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('lpContactName')}</Label>
                <Input value={addForm.contactName} onChange={e => setAddForm(p => ({ ...p, contactName: e.target.value }))} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpCompany')}</Label>
                <Input value={addForm.contactCompany} onChange={e => setAddForm(p => ({ ...p, contactCompany: e.target.value }))} placeholder="Acme Corp" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('lpEmail')}</Label>
                <Input type="email" value={addForm.contactEmail} onChange={e => setAddForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="john@acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpPhone')}</Label>
                <Input value={addForm.contactPhone} onChange={e => setAddForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+1 555-0123" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t('lpSource')}</Label>
                <Select value={addForm.source} onValueChange={v => setAddForm(p => ({ ...p, source: v as LeadSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpType')}</Label>
                <Select value={addForm.type} onValueChange={v => setAddForm(p => ({ ...p, type: v as LeadType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpPriority')}</Label>
                <Select value={addForm.priority} onValueChange={v => setAddForm(p => ({ ...p, priority: v as LeadPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t('lpEstRevenue')}</Label>
                <Input type="number" value={addForm.estimatedRevenue} onChange={e => setAddForm(p => ({ ...p, estimatedRevenue: e.target.value }))} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpRooms')}</Label>
                <Input type="number" value={addForm.roomCount} onChange={e => setAddForm(p => ({ ...p, roomCount: e.target.value }))} placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpGuests')}</Label>
                <Input type="number" value={addForm.guestCount} onChange={e => setAddForm(p => ({ ...p, guestCount: e.target.value }))} placeholder="10" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('lpEstArrival')}</Label>
                <Input type="date" value={addForm.estimatedArrival} onChange={e => setAddForm(p => ({ ...p, estimatedArrival: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('lpEstDeparture')}</Label>
                <Input type="date" value={addForm.estimatedDeparture} onChange={e => setAddForm(p => ({ ...p, estimatedDeparture: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('lpFollowUpDate')}</Label>
              <Input type="date" value={addForm.followUpDate} onChange={e => setAddForm(p => ({ ...p, followUpDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('lpNotes')}</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('lpAdditionalNotes')} rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4 shrink-0">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t('lpCancel')}</Button>
            <Button onClick={handleCreateLead} disabled={isSaving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          LEAD DETAIL DIALOG
          ═══════════════════════════════════════════ */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedLead?.contactName}
            </DialogTitle>
            <DialogDescription>
              {selectedLead?.contactCompany || 'Lead Details'}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 space-y-4">
              {/* Status + Score Row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("text-white", STATUS_CONFIG.find(s => s.key === selectedLead.status)?.color)}>
                  {STATUS_CONFIG.find(s => s.key === selectedLead.status)?.label || selectedLead.status}
                </Badge>
                <Badge className={cn(getScoreBadge(selectedLead.score).className)}>
                  Score: {selectedLead.score}
                </Badge>
                <Badge variant="outline" className="capitalize">{selectedLead.priority}</Badge>
                <Badge variant="outline" className="capitalize">{selectedLead.source.replace('_', ' ')}</Badge>
                <Badge variant="outline" className="capitalize">{selectedLead.type.replace('_', ' ')}</Badge>
              </div>

              {/* Contact Info */}
              <Card className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedLead.contactEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedLead.contactPhone}</span>
                  </div>
                  {selectedLead.contactCompany && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{selectedLead.contactCompany}</span>
                    </div>
                  )}
                  {selectedLead.estimatedRevenue && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedLead.estimatedRevenue)}</span>
                    </div>
                  )}
                  {selectedLead.estimatedArrival && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{formatDate(selectedLead.estimatedArrival)} → {formatDate(selectedLead.estimatedDeparture)}</span>
                    </div>
                  )}
                  {selectedLead.roomCount && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{selectedLead.roomCount} room{selectedLead.roomCount !== 1 ? 's' : ''} · {selectedLead.guestCount || '?'} guest{(selectedLead.guestCount || 0) !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {selectedLead.followUpDate && (
                    <div className="flex items-center gap-2 col-span-full">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>Follow-up: {formatDate(selectedLead.followUpDate)}</span>
                      {new Date(selectedLead.followUpDate) < new Date() && selectedLead.status !== 'converted' && selectedLead.status !== 'lost' && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">{t('lpOverdue')}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* Notes */}
              {selectedLead.notes && (
                <Card className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('lpNotesLabel')}</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedLead.notes}</p>
                </Card>
              )}

              {/* Move Stage */}
              {selectedLead.status !== 'converted' && selectedLead.status !== 'lost' && (
                <Card className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('lpMoveToNextStage')}</p>
                  <div className="flex flex-wrap gap-2">
                    {VALID_TRANSITIONS[selectedLead.status]?.map(nextStatus => {
                      const cfg = STATUS_CONFIG.find(s => s.key === nextStatus);
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <Button
                          key={nextStatus}
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (nextStatus === 'lost') {
                              setMoveToStatus(nextStatus);
                              setIsMoveStageOpen(true);
                            } else {
                              setIsSaving(true);
                              try {
                                const res = await fetch(`/api/crm/leads/${selectedLead.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: nextStatus }),
                                });
                                const result = await res.json();
                                if (result.success) {
                                  toast({ title: t('lpLeadUpdated'), description: t('lpMovedTo', { status: cfg.label }) });
                                  fetchLeadDetail(selectedLead.id);
                                  fetchLeads();
                                } else {
                                  toast({ title: 'Error', description: result.error?.message, variant: 'destructive' });
                                }
                              } catch {
                                toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          disabled={isSaving}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Activity Log */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('lpActivityLog')}</p>
                  <Button variant="outline" size="sm" onClick={() => setIsActivityOpen(true)}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {t('lpAddActivity')}
                  </Button>
                </div>
                {leadActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">{t('lpNoActivitiesYet')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {leadActivities.slice(0, 10).map(act => (
                      <div key={act.id} className="flex items-start gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs capitalize shrink-0 mt-0.5">{act.type.replace('_', ' ')}</Badge>
                        <div className="min-w-0">
                          <p className="truncate">{act.content}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(act.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedLead.status === 'confirmed' && (
                  <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white" disabled>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('lpConvertToBooking')}
                  </Button>
                )}
                {selectedLead.status !== 'lost' && selectedLead.status !== 'converted' && (
                  <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleArchive(selectedLead.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('lpArchive')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          ADD ACTIVITY DIALOG
          ═══════════════════════════════════════════ */}
      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('lpLogActivity')}
            </DialogTitle>
            <DialogDescription>{t('lpLogActivityDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>{t('lpType')}</Label>
              <Select value={activityForm.type} onValueChange={v => setActivityForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">{t('lpNote')}</SelectItem>
                  <SelectItem value="call">{t('lpCall')}</SelectItem>
                  <SelectItem value="email">{t('lpEmailAct')}</SelectItem>
                  <SelectItem value="meeting">{t('lpMeeting')}</SelectItem>
                  <SelectItem value="proposal">{t('lpProposalSent')}</SelectItem>
                  <SelectItem value="follow_up">{t('lpFollowUpAct')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('lpContentRequired')}</Label>
              <Textarea value={activityForm.content} onChange={e => setActivityForm(p => ({ ...p, content: e.target.value }))} placeholder={t('lpDescribeActivity')} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityOpen(false)}>{t('lpCancel')}</Button>
            <Button onClick={handleAddActivity} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('lpSaveActivity')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          MARK AS LOST DIALOG
          ═══════════════════════════════════════════ */}
      <Dialog open={isMoveStageOpen} onOpenChange={setIsMoveStageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('lpMarkAsLost')}
            </DialogTitle>
            <DialogDescription>{t('lpMarkAsLostDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Loss Reason</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger><SelectValue placeholder={t('lpSelectReason')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="No response">{t('lpNoResponse')}</SelectItem>
                  <SelectItem value="Budget mismatch">{t('lpBudgetMismatch')}</SelectItem>
                  <SelectItem value="Chose competitor">{t('lpChoseCompetitor')}</SelectItem>
                  <SelectItem value="Dates unavailable">{t('lpDatesUnavailable')}</SelectItem>
                  <SelectItem value="Project cancelled">{t('lpProjectCancelled')}</SelectItem>
                  <SelectItem value="Other">{t('lpOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsMoveStageOpen(false); setMoveToStatus(''); setLossReason(''); }}>{t('lpCancel')}</Button>
            <Button variant="destructive" onClick={handleMoveStage} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              {t('lpMarkAs Lost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

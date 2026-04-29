'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Target,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Circle,
  ArrowUpRight,
  Loader2,
  Search,
  Filter,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface Goal {
  id: string;
  assignedTo: string | null;
  type: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  deadline: string | null;
  estimatedDuration: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  completionNotes: string | null;
  assignee: { id: string; firstName: string; lastName: string; department: string } | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

/* ─── Constants ─── */
const GOAL_CATEGORIES = [
  { value: 'operational', label: 'Operational', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'development', label: 'Development', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  { value: 'revenue', label: 'Revenue', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'guest_satisfaction', label: 'Guest Satisfaction', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
];

const GOAL_STATUSES = [
  { value: 'not_started', label: 'Not Started', icon: Circle, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  { value: 'on_track', label: 'On Track', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'at_risk', label: 'At Risk', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-primary/15 text-primary' },
  { value: 'missed', label: 'Missed', icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
];

const PRIORITY_WEIGHTS = ['low', 'medium', 'high', 'critical'];
const WEIGHT_LABELS: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4, critical_5: 5 };

function getStatusMeta(status: string) {
  return GOAL_STATUSES.find((s) => s.value === status) || GOAL_STATUSES[0];
}

function getCategoryMeta(category: string) {
  return GOAL_CATEGORIES.find((c) => c.value === category) || GOAL_CATEGORIES[0];
}

/* ─── Main Component ─── */
export default function GoalsTracking() {
  const t = useTranslations('staff');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState({
    assignedTo: '',
    title: '',
    description: '',
    category: 'operational',
    priority: 'medium',
    status: 'not_started',
    deadline: '',
    estimatedDuration: '',
    weight: '3',
  });

  const resetForm = () => {
    setFormData({
      assignedTo: '',
      title: '',
      description: '',
      category: 'operational',
      priority: 'medium',
      status: 'not_started',
      deadline: '',
      estimatedDuration: '',
      weight: '3',
    });
    setSelectedGoal(null);
  };

  const fetchGoals = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ action: 'goals' });
      const res = await fetch(`/api/staff/performance?${params}`);
      const result = await res.json();
      if (result.success) {
        setGoals(result.data || []);
      }
    } catch {
      toast.error('Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/users');
      const result = await res.json();
      if (result.users) {
        setStaff(
          result.users.map((u: any) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            department: u.department || 'General',
          }))
        );
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchGoals(), fetchStaff()]);
    };
    void init();
  }, []);

  // Computed summary stats
  const summaryStats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.status === 'completed').length;
    const inProgress = goals.filter((g) => ['in_progress', 'on_track'].includes(g.status)).length;
    const atRisk = goals.filter((g) => g.status === 'at_risk').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, atRisk, completionRate };
  }, [goals]);

  // Filtered goals
  const filteredGoals = useMemo(() => {
    let filtered = goals;
    if (filterStatus !== 'all') {
      filtered = filtered.filter((g) => g.status === filterStatus);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter((g) => g.category === filterCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.assignee?.firstName?.toLowerCase().includes(q) ||
          g.assignee?.lastName?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [goals, filterStatus, filterCategory, searchQuery]);

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (goal: Goal) => {
    setSelectedGoal(goal);
    setFormData({
      assignedTo: goal.assignedTo || '',
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      priority: goal.priority,
      status: goal.status,
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
      estimatedDuration: goal.estimatedDuration ? String(goal.estimatedDuration) : '',
      weight: '3', // Default since not stored directly
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Goal title is required');
      return;
    }
    if (!formData.assignedTo) {
      toast.error('Please assign the goal to a staff member');
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedGoal) {
        // Update
        const res = await fetch('/api/staff/performance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'goal',
            id: selectedGoal.id,
            title: formData.title,
            description: formData.description || null,
            category: formData.category,
            priority: formData.priority,
            status: formData.status,
            deadline: formData.deadline || null,
            estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Failed to update');
        }

        toast.success('Goal updated');
      } else {
        // Create
        const res = await fetch('/api/staff/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'goal',
            assignedTo: formData.assignedTo,
            title: formData.title,
            description: formData.description || null,
            category: formData.category,
            priority: formData.priority,
            status: formData.status,
            deadline: formData.deadline || null,
            estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Failed to create');
        }

        toast.success('Goal created');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchGoals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Using task update to mark as "missed" since there's no delete API for goals
      const res = await fetch('/api/staff/performance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'goal', id: deleteId, status: 'missed' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Goal marked as missed');
      fetchGoals();
    } catch {
      toast.error('Failed to update goal');
    } finally {
      setDeleteId(null);
    }
  };

  const handleQuickStatusChange = async (goalId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/staff/performance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'goal', id: goalId, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const statusMeta = getStatusMeta(newStatus);
      toast.success(`Goal marked as "${statusMeta.label}"`);
      fetchGoals();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const getProgressFromStatus = (status: string): number => {
    switch (status) {
      case 'not_started': return 0;
      case 'in_progress': return 25;
      case 'on_track': return 60;
      case 'at_risk': return 40;
      case 'completed': return 100;
      case 'missed': return 0;
      default: return 0;
    }
  };

  const isOverdue = (deadline: string | null, status: string): boolean => {
    if (!deadline || status === 'completed') return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Goals & OKR Tracking</h3>
          <p className="text-sm text-muted-foreground">
            Set, track, and manage team goals with SMART criteria
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Goals</p>
                <p className="text-xl font-bold">{summaryStats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                <Target className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completion Rate</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {summaryStats.completionRate}%
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                <p className="text-xl font-bold text-sky-600 dark:text-sky-400">
                  {summaryStats.inProgress}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">At Risk</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {summaryStats.atRisk}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {GOAL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {GOAL_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Goals List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
      ) : filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">No goals found</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create SMART goals to track team performance and development
            </p>
            <Button variant="outline" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {filteredGoals.map((goal) => {
              const statusMeta = getStatusMeta(goal.status);
              const catMeta = getCategoryMeta(goal.category);
              const progress = getProgressFromStatus(goal.status);
              const overdue = isOverdue(goal.deadline, goal.status);
              const StatusIcon = statusMeta.icon;

              return (
                <Card
                  key={goal.id}
                  className={cn(
                    'hover:shadow-md transition-shadow',
                    overdue && 'border-red-300 dark:border-red-800'
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className={cn('mt-0.5 p-1.5 rounded-md', statusMeta.color)}>
                            <StatusIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-sm leading-tight">{goal.title}</h4>
                            {goal.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {goal.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 pl-9">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', catMeta.color)}>
                            {catMeta.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0', statusMeta.color)}
                          >
                            {statusMeta.label}
                          </Badge>
                          {goal.priority && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {goal.priority}
                            </Badge>
                          )}
                          {goal.assignee && (
                            <span className="text-xs text-muted-foreground">
                              {goal.assignee.firstName} {goal.assignee.lastName}
                            </span>
                          )}
                          {goal.deadline && (
                            <span className={cn(
                              'text-xs flex items-center gap-1',
                              overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'
                            )}>
                              <Calendar className="h-3 w-3" />
                              {new Date(goal.deadline).toLocaleDateString()}
                              {overdue && ' (overdue)'}
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="pl-9">
                          <div className="flex items-center gap-3">
                            <Progress
                              value={progress}
                              className={cn(
                                'h-1.5 flex-1',
                                overdue && '[&>div]:bg-red-500'
                              )}
                            />
                            <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {goal.status !== 'completed' && goal.status !== 'missed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            onClick={() => handleQuickStatusChange(goal.id, 'completed')}
                            title="Mark complete"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(goal)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => setDeleteId(goal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              {selectedGoal
                ? 'Update the goal details and progress.'
                : 'Define a SMART goal for your team member.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title *</Label>
              <Input
                id="goal-title"
                placeholder="e.g., Complete Front Desk Certification"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="goal-desc">Description (SMART Criteria)</Label>
              <Textarea
                id="goal-desc"
                rows={3}
                placeholder="Specific, Measurable, Achievable, Relevant, Time-bound goal description..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Assignee & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned To *</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, assignedTo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status, Priority, Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_WEIGHTS.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Weight (1-5)</Label>
                <Select
                  value={formData.weight}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, weight: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((w) => (
                      <SelectItem key={w} value={String(w)}>{w} - {w === 1 ? 'Low' : w === 2 ? 'Below Avg' : w === 3 ? 'Average' : w === 4 ? 'Important' : 'Critical'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Deadline</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Days</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 30"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData((prev) => ({ ...prev, estimatedDuration: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : selectedGoal ? (
                  'Update Goal'
                ) : (
                  'Create Goal'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Goal as Missed</DialogTitle>
            <DialogDescription>
              This will change the goal status to &quot;Missed&quot;. This action can be reversed by editing the goal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Mark as Missed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

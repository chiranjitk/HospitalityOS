'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ListChecks,
  X,
  AlertTriangle,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type TaskPriority = 'urgent' | 'normal' | 'low';
type TaskType = 'checkin-prep' | 'room-inspection' | 'guest-request' | 'maintenance-followup';
type FilterTab = 'all' | 'urgent' | 'normal' | 'completed';

interface Task {
  id: string;
  title: string;
  assignee: string;
  dueTime: string;
  priority: TaskPriority;
  type: TaskType;
  completed: boolean;
}

// ─── Priority config ────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string; dotColor: string }> = {
  urgent: {
    label: 'Urgent',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-200/60 dark:border-rose-800/40',
    dotColor: 'bg-rose-500',
  },
  normal: {
    label: 'Normal',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    border: 'border-teal-200/60 dark:border-teal-800/40',
    dotColor: 'bg-teal-500',
  },
  low: {
    label: 'Low',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200/60 dark:border-slate-700/40',
    dotColor: 'bg-slate-400',
  },
};

// ─── Task type config ───────────────────────────────────────────────────

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string }> = {
  'checkin-prep': { label: 'Check-in Prep', icon: '🔑' },
  'room-inspection': { label: 'Room Inspection', icon: '🔍' },
  'guest-request': { label: 'Guest Request', icon: '🛎️' },
  'maintenance-followup': { label: 'Maintenance', icon: '🔧' },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function mapApiPriority(apiPriority: string): TaskPriority {
  switch (apiPriority) {
    case 'urgent': return 'urgent';
    case 'high': return 'urgent';
    case 'low': return 'low';
    default: return 'normal';
  }
}

function mapApiType(apiType: string): TaskType {
  switch (apiType) {
    case 'cleaning':
    case 'checkin-prep': return 'checkin-prep';
    case 'inspection':
    case 'room-inspection': return 'room-inspection';
    case 'guest-request':
    case 'service': return 'guest-request';
    case 'maintenance':
    case 'maintenance-followup': return 'maintenance-followup';
    default: return 'guest-request';
  }
}

function formatDueTime(scheduledAt: string | null): string {
  if (!scheduledAt) return '--:--';
  const date = new Date(scheduledAt);
  const hour = date.getHours();
  const min = date.getMinutes().toString().padStart(2, '0');
  if (hour === 0) return `12:${min} AM`;
  if (hour < 12) return `${hour}:${min} AM`;
  if (hour === 12) return `12:${min} PM`;
  return `${hour - 12}:${min} PM`;
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function TodaysTasksSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-16 rounded-full" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Today's Tasks Widget ──────────────────────────────────────────────

export function TodaysTasksWidget() {
  const t = useTranslations('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newType, setNewType] = useState<TaskType>('guest-request');

  // Fetch tasks from API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const params = new URLSearchParams({
          scheduledFrom: today.toISOString(),
          scheduledTo: tomorrow.toISOString(),
          limit: '20',
        });

        const response = await fetch(`/api/tasks?${params}`);
        const result = await response.json();

        if (result.success) {
          const apiTasks = result.data || [];
          const mapped: Task[] = apiTasks.map((apiTask: {
            id: string;
            title: string;
            priority: string;
            type: string;
            status: string;
            scheduledAt: string | null;
            assignee: { firstName: string; lastName: string } | null;
          }) => ({
            id: apiTask.id,
            title: apiTask.title,
            assignee: apiTask.assignee
              ? `${apiTask.assignee.firstName} ${apiTask.assignee.lastName}`
              : 'Unassigned',
            dueTime: formatDueTime(apiTask.scheduledAt),
            priority: mapApiPriority(apiTask.priority),
            type: mapApiType(apiTask.type),
            completed: apiTask.status === 'completed',
          }));
          setTasks(mapped);
        } else {
          setError('Failed to load tasks');
        }
      } catch {
        setError('Failed to fetch tasks');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Derived stats
  const totalCount = tasks.length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filter tabs config
  const filterTabs: { key: FilterTab; label: string; count: number }[] = useMemo(() => [
    { key: 'all', label: t('todaysTasksFilterAll'), count: totalCount },
    { key: 'urgent', label: t('todaysTasksUrgent'), count: tasks.filter((task) => task.priority === 'urgent' && !task.completed).length },
    { key: 'normal', label: t('todaysTasksNormal'), count: tasks.filter((task) => task.priority === 'normal' && !task.completed).length },
    { key: 'completed', label: t('todaysTasksCompleted'), count: completedCount },
  ], [tasks, completedCount, totalCount, t]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'urgent':
        return tasks.filter((task) => task.priority === 'urgent' && !task.completed);
      case 'normal':
        return tasks.filter((task) => task.priority === 'normal' && !task.completed);
      case 'completed':
        return tasks.filter((task) => task.completed);
      default:
        return tasks.filter((task) => !task.completed);
    }
  }, [tasks, activeFilter]);

  // Toggle task completion
  const toggleTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    );
  }, []);

  // Add task
  const handleAddTask = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const now = new Date();
    const dueHour = now.getHours() + 1;
    const dueTimeStr = dueHour > 12
      ? `${dueHour - 12}:00 PM`
      : dueHour === 12
        ? '12:00 PM'
        : `${dueHour}:00 AM`;

    const newTask: Task = {
      id: `tt-${Date.now()}`,
      title: trimmed,
      assignee: 'You',
      dueTime: dueTimeStr,
      priority: newPriority,
      type: newType,
      completed: false,
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTitle('');
    setNewPriority('normal');
    setNewType('guest-request');
    setShowAddForm(false);
  }, [newTitle, newPriority, newType]);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setNewTitle('');
    setNewPriority('normal');
    setNewType('guest-request');
  }, []);

  if (isLoading) return <TodaysTasksSkeleton />;

  if (error) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" />
        <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {t('todaysTasksTitle')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 font-medium tabular-nums">
              {completedCount}/{totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 transition-colors',
                showAddForm
                  ? 'text-muted-foreground'
                  : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
              )}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('todaysTasksTotal'), value: totalCount, color: 'text-foreground', bg: 'bg-muted/60' },
            { label: t('todaysTasksDone'), value: completedCount, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
            { label: t('todaysTasksPending'), value: pendingCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('p-2.5 rounded-xl text-center border border-border/40', stat.bg)}
            >
              <p className={cn('text-lg font-bold tabular-nums leading-none', stat.color)}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Progress Bar ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('todaysTasksProgress')}</span>
            <span className="font-semibold text-foreground tabular-nums">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all',
                activeFilter === tab.key
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {tab.label}
              <span className="ml-1 tabular-nums opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* ── Add Task Form ── */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2.5">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder={t('todaysTasksPlaceholder')}
                  className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Priority selector */}
                  <div className="flex items-center gap-1.5">
                    {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
                      const config = PRIORITY_CONFIG[p];
                      return (
                        <button
                          key={p}
                          onClick={() => setNewPriority(p)}
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all',
                            newPriority === p
                              ? cn(config.color, config.bg, config.border)
                              : 'text-muted-foreground border-transparent hover:bg-muted'
                          )}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Type selector */}
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as TaskType)}
                      className="text-[10px] bg-transparent border border-border/60 rounded-md px-1.5 py-0.5 text-foreground outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      {(Object.keys(TASK_TYPE_CONFIG) as TaskType[]).map((type) => (
                        <option key={type} value={type}>{TASK_TYPE_CONFIG[type].label}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleAddTask}
                      disabled={!newTitle.trim()}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t('todaysTasksAddBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Task List ── */}
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task, idx) => {
              const config = PRIORITY_CONFIG[task.priority];
              const typeConfig = TASK_TYPE_CONFIG[task.type];
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25, ease: 'easeOut' }}
                  whileHover={{ scale: 1.005, x: 2 }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group border',
                    task.completed
                      ? 'bg-muted/20 border-transparent'
                      : 'border-border/30 hover:border-border/50 hover:bg-muted/30'
                  )}
                  onClick={() => toggleTask(task.id)}
                >
                  {/* Checkbox */}
                  <motion.div whileTap={{ scale: 0.8 }} className="flex-shrink-0 mt-0.5">
                    {task.completed ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                    ) : (
                      <Circle className="h-4.5 w-4.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    )}
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">{typeConfig.icon}</span>
                      <p
                        className={cn(
                          'text-sm leading-snug truncate transition-all',
                          task.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium'
                        )}
                      >
                        {task.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        {task.assignee}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {task.dueTime}
                      </span>
                    </div>
                  </div>

                  {/* Priority badge */}
                  {!task.completed && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 px-1.5 rounded-full border flex-shrink-0 font-medium mt-0.5',
                        config.color, config.bg, config.border
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full mr-1', config.dotColor)} />
                      {config.label}
                    </Badge>
                  )}

                  {/* Urgent icon */}
                  {!task.completed && task.priority === 'urgent' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Empty State ── */}
        {filteredTasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-6 text-center"
          >
            {activeFilter === 'completed' ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t('todaysTasksNoCompleted')}</p>
              </>
            ) : (
              <>
                <ListChecks className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t('todaysTasksNoTasks')}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{t('todaysTasksNoTasksDesc')}</p>
              </>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default TodaysTasksWidget;

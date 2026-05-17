'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Plus,
  ListTodo,
  X,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type TaskPriority = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  title: string;
  dueTime: string;
  priority: TaskPriority;
  completed: boolean;
}

// ─── Priority config ────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string; dotColor: string }> = {
  high: {
    label: 'High',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-200/60 dark:border-rose-800/40',
    dotColor: 'bg-rose-500',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    dotColor: 'bg-amber-500',
  },
  low: {
    label: 'Low',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    border: 'border-sky-200/60 dark:border-sky-800/40',
    dotColor: 'bg-sky-500',
  },
};

// ─── Types ──────────────────────────────────────────────────────────────
// FIX (M-7): Replaced mock tasks with API call

// ─── TaskRemindersWidget ────────────────────────────────────────────────

export function TaskRemindersWidget() {
  // FIX (M-7): Replaced mock tasks with API call
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');

  // Helper: format a date string into a readable time
  const formatTaskTime = (dateStr: string | undefined): string => {
    if (!dateStr) return 'No due time';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return String(dateStr);
    }
  };

  // Helper: map API priority to local priority type
  const mapPriority = (p: string | undefined): TaskPriority => {
    if (!p) return 'medium';
    const lower = String(p).toLowerCase();
    if (lower === 'high' || lower === 'urgent' || lower === 'critical') return 'high';
    if (lower === 'low' || lower === 'minor') return 'low';
    return 'medium';
  };

  // Fetch pending tasks from API
  useEffect(() => {
    let cancelled = false;
    const fetchTasks = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await fetch('/api/staff/tasks?status=pending&limit=10');
        if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
        const data = await res.json();
        if (cancelled) return;

        // Handle various API response shapes
        const rawTasks = data?.tasks ?? data?.data ?? data ?? [];
        if (!Array.isArray(rawTasks)) {
          setTasks([]);
          return;
        }

        // Map API fields to Task interface
        const mapped: Task[] = rawTasks.map((t: any) => ({
          id: t.id ?? `task-${Date.now()}-${Math.random()}`,
          title: t.title ?? t.name ?? t.description ?? 'Untitled Task',
          dueTime: t.dueTime ?? t.due_time ?? t.time ?? formatTaskTime(t.dueDate ?? t.due_at),
          priority: mapPriority(t.priority ?? t.urgency),
          completed: !!t.completed,
        }));
        setTasks(mapped);
      } catch (err: any) {
        if (!cancelled) {
          setFetchError(err?.message || 'Failed to load tasks');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchTasks();
    return () => { cancelled = true; };
  }, []);

  // Derived stats
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Toggle task completion
  const toggleTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  // Add a new task
  const handleAddTask = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const now = new Date();
    const dueHour = now.getHours() + 1;
    const dueTimeStr = dueHour > 12
      ? `${dueHour - 12}:00 PM`
      : dueHour === 12
        ? `12:00 PM`
        : `${dueHour}:00 AM`;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: trimmed,
      dueTime: dueTimeStr,
      priority: newPriority,
      completed: false,
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTitle('');
    setNewPriority('medium');
    setShowAddForm(false);
  }, [newTitle, newPriority]);

  // Cancel add form
  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setNewTitle('');
    setNewPriority('medium');
  }, []);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Tasks &amp; Reminders
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Completion badge */}
            <Badge variant="outline" className="text-xs rounded-full border-primary/40 text-primary bg-primary/10 font-medium tabular-nums">
              {completedCount}/{totalCount} done
            </Badge>
            {/* Add task button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                showAddForm
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
              )}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading tasks...</span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && fetchError && (
          <div className="flex flex-col items-center py-4 gap-2 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-xs text-muted-foreground">{fetchError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Task content - only show when not loading and no error */}
        {!isLoading && !fetchError && (
        <>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Today&apos;s Progress</span>
            <span className="font-semibold text-foreground tabular-nums">{progressPercent}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-colors",
                progressPercent === 100
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                  : "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Add task form (expandable) */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="New task description..."
                  className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  {/* Priority selector */}
                  <div className="flex items-center gap-1.5">
                    {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
                      const config = PRIORITY_CONFIG[p];
                      return (
                        <button
                          key={p}
                          onClick={() => setNewPriority(p)}
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all capitalize",
                            newPriority === p
                              ? cn(config.color, config.bg, config.border)
                              : "text-muted-foreground border-transparent hover:bg-muted"
                          )}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleAddTask}
                    disabled={!newTitle.trim()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task list */}
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
          <AnimatePresence mode="popLayout">
            {tasks.map((task, idx) => {
              const config = PRIORITY_CONFIG[task.priority];
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  whileHover={{ scale: 1.005, x: 2 }}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
                    "border border-transparent hover:border-border/50",
                    task.completed
                      ? "bg-muted/30"
                      : "hover:bg-muted/40"
                  )}
                  onClick={() => toggleTask(task.id)}
                >
                  {/* Checkbox */}
                  <motion.div whileTap={{ scale: 0.85 }} className="flex-shrink-0">
                    {task.completed ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                    ) : (
                      <Circle className="h-4.5 w-4.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                    )}
                  </motion.div>

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm leading-snug truncate transition-all",
                        task.completed
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                      <span className={cn(
                        "text-[11px] tabular-nums",
                        task.completed ? "text-muted-foreground/50" : "text-muted-foreground"
                      )}>
                        {task.dueTime}
                      </span>
                    </div>
                  </div>

                  {/* Priority badge */}
                  {!task.completed && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-5 px-1.5 rounded-full border flex-shrink-0 font-medium",
                        config.color,
                        config.bg,
                        config.border
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1", config.dotColor)} />
                      {config.label}
                    </Badge>
                  )}

                  {/* High priority icon for incomplete tasks */}
                  {!task.completed && task.priority === 'high' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        </>
        )}

        {/* All tasks completed state */}
        {completedCount === totalCount && totalCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-2 text-center"
          >
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1" />
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              All tasks completed! 🎉
            </p>
          </motion.div>
        )}

        {/* Empty state - no pending tasks from API */}
        {!isLoading && !fetchError && totalCount === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mb-2" />
            <p className="text-sm text-muted-foreground">No pending tasks</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">All tasks are completed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TaskRemindersWidget;

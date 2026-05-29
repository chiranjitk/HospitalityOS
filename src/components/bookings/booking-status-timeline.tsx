'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Check,
  Circle,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  CalendarCheck,
  FileCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineAuditEntry {
  id: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  performedBy: string | null;
  performedAt: string;
}

export interface BookingStatusTimelineProps {
  /** Current booking status from the API */
  status: string;
  /** ISO date string — booking.createdAt */
  createdAt: string;
  /** ISO date string — booking.actualCheckIn */
  actualCheckIn?: string | null;
  /** ISO date string — booking.actualCheckOut */
  actualCheckOut?: string | null;
  /** User who checked the guest in */
  checkedInBy?: string | null;
  /** User who checked the guest out */
  checkedOutBy?: string | null;
  /** ISO date string — booking.cancelledAt */
  cancelledAt?: string | null;
  /** User who cancelled */
  cancelledBy?: string | null;
  /** Cancellation reason */
  cancellationReason?: string | null;
  /** Booking ID for fetching audit logs */
  bookingId?: string;
  /** Confirmation code for display */
  confirmationCode?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

// ─── Pipeline Step Definition ────────────────────────────────────────────────

interface PipelineStep {
  key: string;
  label: string;
  /** Map of booking statuses that count as this step being "completed" */
  completedByStatuses: string[];
  /** The status values that mean this is the CURRENT active step */
  activeStatuses: string[];
  /** Date source from booking props */
  getDate: (props: BookingStatusTimelineProps) => string | undefined;
  /** User source from booking props */
  getUser: (props: BookingStatusTimelineProps) => string | undefined;
  /** Icon to show when completed */
  CompletedIcon: React.ElementType;
  /** Accent color for active state */
  accentColor: string;
  /** Accent bg for active state */
  accentBg: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: 'created',
    label: 'Created',
    completedByStatuses: ['draft', 'confirmed', 'checked_in', 'checked_out', 'no_show'],
    activeStatuses: ['draft'],
    getDate: (p) => p.createdAt,
    getUser: () => 'System',
    CompletedIcon: FileCheck,
    accentColor: 'text-slate-600 dark:text-slate-400',
    accentBg: 'bg-slate-500',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    completedByStatuses: ['confirmed', 'checked_in', 'checked_out'],
    activeStatuses: ['confirmed'],
    getDate: (p) => p.createdAt, // We'll use audit logs for more precise date
    getUser: () => undefined,
    CompletedIcon: CalendarCheck,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-500',
  },
  {
    key: 'checked_in',
    label: 'Checked In',
    completedByStatuses: ['checked_in', 'checked_out'],
    activeStatuses: ['checked_in'],
    getDate: (p) => p.actualCheckIn || undefined,
    getUser: (p) => p.checkedInBy || undefined,
    CompletedIcon: LogIn,
    accentColor: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-500',
  },
  {
    key: 'checked_out',
    label: 'Checked Out',
    completedByStatuses: ['checked_out'],
    activeStatuses: ['checked_out'],
    getDate: (p) => p.actualCheckOut || undefined,
    getUser: (p) => p.checkedOutBy || undefined,
    CompletedIcon: LogOut,
    accentColor: 'text-teal-600 dark:text-teal-400',
    accentBg: 'bg-teal-500',
  },
  {
    key: 'completed',
    label: 'Completed',
    completedByStatuses: [],
    activeStatuses: [],
    getDate: () => undefined,
    getUser: () => undefined,
    CompletedIcon: Check,
    accentColor: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-500',
  },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function getStepState(
  step: PipelineStep,
  status: string,
  stepIndex: number,
  allSteps: PipelineStep[],
  auditMap: Map<string, TimelineAuditEntry>,
  bookingProps: BookingStatusTimelineProps,
): 'completed' | 'active' | 'current' | 'future' {
  // Check if cancelled or no-show — these terminate the pipeline
  if (status === 'cancelled' || status === 'no_show') {
    if (step.completedByStatuses.includes(status)) {
      return 'completed';
    }
    if (step.activeStatuses.includes(status)) {
      return 'active';
    }
    return 'future';
  }

  // If this step's statuses include the current status, check if active or completed
  if (step.activeStatuses.includes(status)) {
    return 'active';
  }

  if (step.completedByStatuses.includes(status)) {
    return 'completed';
  }

  // Check if any subsequent step is active/completed
  for (let i = stepIndex + 1; i < allSteps.length; i++) {
    const futureStep = allSteps[i];
    if (futureStep.completedByStatuses.includes(status) || futureStep.activeStatuses.includes(status)) {
      return 'completed';
    }
  }

  return 'future';
}

function getStepTimestamp(
  step: PipelineStep,
  bookingProps: BookingStatusTimelineProps,
  auditMap: Map<string, TimelineAuditEntry>,
): string | undefined {
  // First try audit logs for precise timestamps
  const auditEntry = auditMap.get(step.key);
  if (auditEntry) {
    return auditEntry.performedAt;
  }

  // Fall back to booking fields
  return step.getDate(bookingProps);
}

function getStepUser(
  step: PipelineStep,
  bookingProps: BookingStatusTimelineProps,
  auditMap: Map<string, TimelineAuditEntry>,
): string | undefined {
  // First try audit logs
  const auditEntry = auditMap.get(step.key);
  if (auditEntry?.performedBy) {
    return auditEntry.performedBy;
  }

  // Fall back to booking fields
  return step.getUser(bookingProps);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BookingStatusTimeline({
  status,
  createdAt,
  actualCheckIn,
  actualCheckOut,
  checkedInBy,
  checkedOutBy,
  cancelledAt,
  cancelledBy,
  cancellationReason,
  bookingId,
  confirmationCode,
  compact = false,
}: BookingStatusTimelineProps) {
  const [auditLogs, setAuditLogs] = useState<TimelineAuditEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [auditMap, setAuditMap] = useState<Map<string, TimelineAuditEntry>>(new Map());

  const bookingProps: BookingStatusTimelineProps = {
    status,
    createdAt,
    actualCheckIn,
    actualCheckOut,
    checkedInBy,
    checkedOutBy,
    cancelledAt,
    cancelledBy,
    cancellationReason,
    bookingId,
    confirmationCode,
    compact,
  };

  // Fetch audit logs for enriched timeline data
  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;

    (async () => {
      setIsLoadingLogs(true);
      try {
        const response = await fetch(`/api/bookings/audit-logs?bookingId=${bookingId}&limit=20`);
        const result = await response.json();
        if (cancelled) return;

        if (result.success && result.data) {
          const logs: TimelineAuditEntry[] = result.data;
          setAuditLogs(logs);

          // Build a map of step key → audit entry for quick lookup
          const map = new Map<string, TimelineAuditEntry>();
          for (const log of logs) {
            const action = log.action;
            const newStatus = log.newStatus;
            if (action === 'created') {
              map.set('created', log);
            } else if (action === 'status_change') {
              if (newStatus === 'confirmed') map.set('confirmed', log);
              if (newStatus === 'checked_in') map.set('checked_in', log);
              if (newStatus === 'checked_out') map.set('checked_out', log);
              if (newStatus === 'cancelled') map.set('cancelled', log);
              if (newStatus === 'no_show') map.set('no_show', log);
            } else if (action === 'status_change' && newStatus === 'confirmed') {
              map.set('confirmed', log);
            }
          }
          // Map "created" action
          const createdLog = logs.find(l => l.action === 'created');
          if (createdLog) map.set('created', createdLog);
          setAuditMap(map);
        }
      } catch (error) {
      } finally {
        if (!cancelled) setIsLoadingLogs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookingId]);

  const isCancelled = status === 'cancelled';
  const isNoShow = status === 'no_show';

  // Find the active step index for the gradient line
  const stepStates = PIPELINE_STEPS.map((step, idx) =>
    getStepState(step, status, idx, PIPELINE_STEPS, auditMap, bookingProps),
  );

  return (
    <div className={cn('w-full', compact ? 'py-1' : 'py-3')}>
      {/* Cancellation / No-Show Banner */}
      {(isCancelled || isNoShow) && (
        <div
          className={cn(
            'flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border text-sm',
            isCancelled
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400',
          )}
        >
          {isCancelled ? (
            <XCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium">
              {isCancelled ? 'Booking Cancelled' : 'No Show'}
            </span>
            {cancelledAt && (
              <span className="ml-2 text-xs opacity-75">
                {formatDateTime(cancelledAt)}
              </span>
            )}
            {cancellationReason && (
              <span className="ml-2 text-xs opacity-75">
                — {cancellationReason}
              </span>
            )}
          </div>
          {cancelledBy && (
            <Badge variant="outline" className="text-xs shrink-0">
              by {cancelledBy}
            </Badge>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative flex items-start justify-between">
        {/* Connecting Line Background (gray track) */}
        <div
          className={cn(
            'absolute top-3 left-4 right-4 h-0.5 bg-muted rounded-full',
            compact && 'top-2.5',
          )}
        />

        {/* Connecting Line Progress (gradient fill for completed portion) */}
        <div
          className="absolute top-3 left-4 h-0.5 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `calc(${(stepStates.filter(s => s === 'completed' || s === 'active').length / PIPELINE_STEPS.length) * 100}% - ${(4 / PIPELINE_STEPS.length) * 100}%)`,
            background: isCancelled
              ? 'linear-gradient(90deg, #94a3b8, #ef4444)'
              : isNoShow
                ? 'linear-gradient(90deg, #94a3b8, #f59e0b)'
                : 'linear-gradient(90deg, #64748b, #10b981, #3b82f6, #14b8a6, #8b5cf6)',
            ...(compact && { top: '10px' }),
          }}
        />

        {PIPELINE_STEPS.map((step, index) => {
          const state = stepStates[index];
          const isActive = state === 'active';
          const isCompleted = state === 'completed';
          const isFuture = state === 'future';
          const CompletedIcon = step.CompletedIcon;
          const timestamp = getStepTimestamp(step, bookingProps, auditMap);
          const user = getStepUser(step, bookingProps, auditMap);

          return (
            <div
              key={step.key}
              className="relative flex flex-col items-center z-10 flex-1"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full border-2 transition-all duration-500 ease-out cursor-default',
                      compact ? 'w-5 h-5' : 'w-6 h-6',
                      // Active state — pulsing filled circle
                      isActive &&
                        `${step.accentBg} border-transparent shadow-md ring-4 ${step.accentBg}/20`,
                      // Completed state — filled with icon
                      isCompleted &&
                        `${step.accentBg} border-transparent text-white`,
                      // Future state — empty gray circle
                      isFuture &&
                        'bg-background border-muted-foreground/30 text-muted-foreground/40',
                    )}
                  >
                    {isCompleted ? (
                      <CompletedIcon
                        className={cn(
                          'transition-all duration-300',
                          compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
                        )}
                      />
                    ) : isActive ? (
                      <div
                        className={cn(
                          'rounded-full bg-white animate-pulse',
                          compact ? 'w-2 h-2' : 'w-2.5 h-2.5',
                        )}
                      />
                    ) : (
                      <Circle
                        className={cn(
                          'transition-all duration-300',
                          compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
                        )}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{step.label}</span>
                    {timestamp && (
                      <span className="text-muted-foreground">
                        {formatDateTime(timestamp)}
                      </span>
                    )}
                    {user && (
                      <span className="text-muted-foreground">by {user}</span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Step Label */}
              <span
                className={cn(
                  'mt-1.5 text-[10px] leading-tight text-center max-w-[64px] truncate transition-all duration-300',
                  isActive && 'font-semibold text-foreground',
                  isCompleted && 'text-muted-foreground',
                  isFuture && 'text-muted-foreground/50',
                  compact && 'mt-1 text-[9px]',
                )}
              >
                {step.label}
              </span>

              {/* Timestamp below label (non-compact mode) */}
              {!compact && timestamp && (isCompleted || isActive) && (
                <span className="mt-0.5 text-[9px] text-muted-foreground/70 text-center max-w-[72px] leading-tight">
                  {formatDateTime(timestamp)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Audit Log Trail (non-compact mode) */}
      {!compact && auditLogs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Activity Trail
            </span>
            {isLoadingLogs && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground/80">
                    {formatActionLabel(log.action, log.oldStatus, log.newStatus)}
                  </span>
                  <span className="mx-1.5 opacity-40">&middot;</span>
                  <span>{formatDateTime(log.performedAt)}</span>
                  {log.performedBy && (
                    <>
                      <span className="mx-1.5 opacity-40">&middot;</span>
                      <span>by {log.performedBy}</span>
                    </>
                  )}
                  {log.notes && (
                    <span className="ml-1 opacity-60">({log.notes})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatActionLabel(
  action: string,
  oldStatus: string | null,
  newStatus: string | null,
): string {
  if (action === 'created') return 'Booking Created';
  if (action === 'status_change') {
    if (oldStatus && newStatus) {
      return `${formatStatusLabel(oldStatus)} → ${formatStatusLabel(newStatus)}`;
    }
    if (newStatus) return `Status → ${formatStatusLabel(newStatus)}`;
    return 'Status Changed';
  }
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };
  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

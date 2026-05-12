'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  BellRing,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
} from 'lucide-react';
import { useNotificationsStore } from '@/store';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================
// Types
// =============================================

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  action?: { label: string; section: string };
}

interface NotificationPopoverProps {
  collapsed?: boolean;
}

// =============================================
// Icon mapping for notification types
// =============================================

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  info: {
    icon: Info,
    colorClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-500/10',
  },
  success: {
    icon: CheckCircle,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  error: {
    icon: XCircle,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/10',
  },
  alert: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  booking: {
    icon: CheckCircle,
    colorClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-500/10',
  },
  housekeeping: {
    icon: Info,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10',
  },
  system: {
    icon: Info,
    colorClass: 'text-slate-500 dark:text-slate-400',
    bgClass: 'bg-slate-500/10',
  },
};

const DEFAULT_TYPE_CONFIG = {
  icon: Info,
  colorClass: 'text-muted-foreground',
  bgClass: 'bg-muted/50',
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || DEFAULT_TYPE_CONFIG;
}

// =============================================
// Relative time formatter
// =============================================

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes === 1) return '1 min ago';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

// =============================================
// Single notification row
// =============================================

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: ApiNotification;
  onMarkRead: (id: string) => void;
}) {
  const config = getTypeConfig(notification.type);
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => !notification.read && onMarkRead(notification.id)}
      className={cn(
        'w-full group relative flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
        'hover:bg-accent/50',
        !notification.read && 'bg-primary/[0.03]'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          config.bgClass,
          config.colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-[13px] leading-tight truncate',
              !notification.read
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/70'
            )}
          >
            {notification.title}
          </p>
          {/* Unread indicator dot */}
          {!notification.read && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
          {notification.description}
        </p>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums mt-1 block">
          {formatRelativeTime(notification.timestamp)}
        </span>
      </div>
    </button>
  );
}

// =============================================
// Empty state
// =============================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        No new notifications
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        You're all caught up!
      </p>
    </div>
  );
}

// =============================================
// Notification Popover Content (the dropdown)
// =============================================

function NotificationPopoverContent() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
  } = useNotificationsStore();

  const [apiNotifications, setApiNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch notifications from API + polling
  useEffect(() => {
    let cancelled = false;

    async function fetchNotifications() {
      if (cancelled) return;
      try {
        setLoading(true);
        const res = await fetch('/api/notifications/list?limit=20');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          const notifs: ApiNotification[] = json.data.notifications || [];
          setApiNotifications(notifs);

          // Sync unreadCount to store
          const apiUnread = json.data.unreadCount || 0;

          // Also push new notifications into the store so badge stays in sync
          const storeNotifs = useNotificationsStore.getState();
          const currentIds = new Set(storeNotifs.notifications.map(n => n.id));

          // Add any new ones from API that aren't in the store
          notifs.forEach((n: ApiNotification) => {
            if (!currentIds.has(n.id) && !n.read) {
              addNotification({
                type: (['info', 'success', 'warning', 'error'].includes(n.type)
                  ? n.type
                  : 'info') as 'info' | 'success' | 'warning' | 'error',
                title: n.title,
                message: n.description,
              });
            }
          });

          // Update unread count from API if it's authoritative
          if (apiUnread !== storeNotifs.unreadCount) {
            if (apiUnread === 0 && storeNotifs.unreadCount > 0) {
              useNotificationsStore.getState().markAllAsRead();
            }
          }
        }
      } catch {
        // Silently fail - store data remains
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNotifications();

    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [addNotification]);

  // Handle mark single as read
  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch {
        // Continue with optimistic update
      }

      // Optimistic update
      setApiNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      markAsRead(id);
    },
    [markAsRead]
  );

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // Continue with optimistic update
    }

    setApiNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllAsRead();
    setMarkingAll(false);
  }, [markAllAsRead]);

  // Merge API notifications (authoritative) with store notifications as fallback
  const displayNotifications = apiNotifications.length > 0
    ? apiNotifications
    : notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.message,
        timestamp: n.createdAt,
        read: n.read,
      }));

  const displayUnreadCount = apiNotifications.length > 0
    ? apiNotifications.filter(n => !n.read).length
    : unreadCount;

  return (
    <div className="w-[340px] max-w-[calc(100vw-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground leading-none">
              Notifications
            </h3>
            {displayUnreadCount > 0 && (
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {displayUnreadCount} unread
              </span>
            )}
          </div>
        </div>
        {displayUnreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3" />
            )}
            Mark all read
          </Button>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-border/40" />

      {/* Notification list */}
      <ScrollArea className="max-h-80">
        <div className="py-1">
          {loading && displayNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
            </div>
          ) : displayNotifications.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence initial={false}>
              {displayNotifications.map((notification, idx) => (
                <React.Fragment key={notification.id}>
                  {idx > 0 && (
                    <div className="mx-3 my-0.5 border-t border-border/15" />
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <NotificationRow
                      notification={notification}
                      onMarkRead={handleMarkRead}
                    />
                  </motion.div>
                </React.Fragment>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {displayNotifications.length > 0 && (
        <>
          <div className="border-t border-border/30" />
          <div className="px-4 py-2.5">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors py-1 rounded-md hover:bg-emerald-500/5"
              onClick={() => {
                useNotificationsStore.getState().setNotificationsPanelOpen(true);
              }}
            >
              View all notifications
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================
// Main NotificationPopover Component
// =============================================

export function NotificationPopover({ collapsed }: NotificationPopoverProps) {
  const { unreadCount } = useNotificationsStore();

  // Collapsed mode: compact bell icon with tooltip
  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex items-center justify-center h-9 w-9 mx-auto rounded-xl bg-sidebar-accent/20 hover:bg-sidebar-accent/35 transition-all duration-200 group/bell"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-3.5 w-3.5 text-sidebar-foreground group-hover/bell:scale-110 transition-transform duration-200" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 shadow-sm shadow-red-500/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          sideOffset={12}
          align="start"
          className="w-[340px] max-w-[calc(100vw-2rem)] p-0 rounded-xl border border-border/40 shadow-2xl shadow-black/[0.12] bg-background/95 backdrop-blur-xl"
        >
          <NotificationPopoverContent />
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded mode: bell icon in header area
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center h-7 w-7 rounded-lg text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-all duration-200 group/bell focus-visible:ring-2 focus-visible:ring-sidebar-primary/30"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-3.5 w-3.5 group-hover/bell:scale-110 transition-transform duration-200" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 shadow-sm shadow-red-500/30">
              {unreadCount > 99 ? '99+' : unreadCount}
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        sideOffset={8}
        align="start"
        className="w-[340px] max-w-[calc(100vw-2rem)] p-0 rounded-xl border border-border/40 shadow-2xl shadow-black/[0.12] bg-background/95 backdrop-blur-xl"
      >
        <NotificationPopoverContent />
      </PopoverContent>
    </Popover>
  );
}

export default NotificationPopover;

'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellRing,
  AlertTriangle,
  CalendarPlus,
  SprayCan,
  Shield,
  Clock,
  CheckCheck,
  X,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type NotificationCategory = 'all' | 'alerts' | 'bookings' | 'housekeeping' | 'system';

type NotificationType = 'alert' | 'booking' | 'housekeeping' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// ============================================
// Category config mapping
// ============================================

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; colorClass: string; dotColor: string }
> = {
  all: {
    icon: Bell,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  alerts: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  bookings: {
    icon: CalendarPlus,
    colorClass: 'text-teal-600 dark:text-teal-400',
    dotColor: 'bg-teal-500',
  },
  housekeeping: {
    icon: SprayCan,
    colorClass: 'text-violet-600 dark:text-violet-400',
    dotColor: 'bg-violet-500',
  },
  system: {
    icon: Shield,
    colorClass: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-500',
  },
};

const TYPE_TO_ICON: Record<NotificationType, React.ElementType> = {
  alert: AlertTriangle,
  booking: CalendarPlus,
  housekeeping: SprayCan,
  system: Shield,
};

const TYPE_TO_COLOR: Record<NotificationType, string> = {
  alert: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  booking: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  housekeeping: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  system: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

const TYPE_TO_BADGE_VARIANT: Record<NotificationType, 'default' | 'warning' | 'destructive' | 'secondary'> = {
  alert: 'warning',
  booking: 'default',
  housekeeping: 'secondary',
  system: 'secondary',
};

// ============================================
// Relative time formatter
// ============================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const VALID_TYPES = new Set<NotificationType>(['alert', 'booking', 'housekeeping', 'system']);

function mapApiNotification(n: { id: string; type: string; title: string; description?: string; timestamp: string; read: boolean }): Notification | null {
  const type = n.type as NotificationType;
  if (!VALID_TYPES.has(type)) return null;
  return {
    id: n.id,
    type,
    title: n.title,
    message: n.description || '',
    timestamp: new Date(n.timestamp),
    read: n.read,
  };
}

// ============================================
// Empty state component
// ============================================

function EmptyState() {
  const t = useTranslations('notifications');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Inbox className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {t('noNotifications')}
      </p>
    </motion.div>
  );
}

// ============================================
// Single notification row
// ============================================

function NotificationRow({ notification }: { notification: Notification }) {
  const Icon = TYPE_TO_ICON[notification.type];
  const colorClass = TYPE_TO_COLOR[notification.type];
  const badgeVariant = TYPE_TO_BADGE_VARIANT[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 cursor-pointer rounded-lg mx-1',
        !notification.read && 'bg-primary/[0.02]'
      )}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5">
          <span className="block h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className={cn(
              'text-sm truncate',
              !notification.read
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/80'
            )}
          >
            {notification.title}
          </p>
          <Badge
            variant={badgeVariant}
            className="shrink-0 text-[10px] h-4 px-1.5 font-medium uppercase tracking-wider"
          >
            {notification.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground/70 tabular-nums">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Main NotificationPanel component
// ============================================

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const t = useTranslations('notifications');
  const panelRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');

  // Fetch notifications from API
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    fetch('/api/notifications/list?limit=50')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.data?.notifications)) {
          const mapped = data.data.notifications
            .map((n: Record<string, unknown>) => mapApiNotification(n as Parameters<typeof mapApiNotification>[0]))
            .filter(Boolean) as Notification[];
          setNotifications(mapped);
        } else {
          setNotifications([]);
        }
      })
      .catch(() => setNotifications([]))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((n) => n.type === activeCategory);
  }, [notifications, activeCategory]);

  // Unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Category tabs
  const categories: { key: NotificationCategory; labelKey: string }[] = [
    { key: 'all', labelKey: 'all' },
    { key: 'alerts', labelKey: 'alerts' },
    { key: 'bookings', labelKey: 'bookings' },
    { key: 'housekeeping', labelKey: 'housekeeping' },
    { key: 'system', labelKey: 'system' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Invisible backdrop to catch outside clicks on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 lg:hidden"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={t('title')}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              mass: 0.8,
            }}
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              'w-[400px] max-w-[calc(100vw-2rem)]',
              'rounded-xl overflow-hidden',
              'border border-border/40 shadow-2xl shadow-black/[0.12]',
              'bg-background/70 backdrop-blur-xl',
              'flex flex-col',
              'max-h-[min(520px,80vh)]'
            )}
          >
            {/* Top gradient accent bar */}
            <div className="relative h-1 shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-foreground leading-none">
                    {t('title')}
                  </h2>
                  {unreadCount > 0 && (
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      {unreadCount} {t('new').toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('markAllRead')}</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Category filter tabs */}
            <div className="px-3 pb-2 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.key;
                  const config = CATEGORY_CONFIG[cat.key];
                  const CatIcon = config.icon;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveCategory(cat.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200',
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                      )}
                      aria-pressed={isActive}
                    >
                      <CatIcon className={cn('h-3.5 w-3.5', isActive && config.colorClass)} />
                      {t(cat.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separator */}
            <div className="mx-3 border-t border-border/40" />

            {/* Notification list */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[340px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="py-1">
                    <AnimatePresence mode="popLayout">
                      {filteredNotifications.map((notification, idx) => (
                        <React.Fragment key={notification.id}>
                          {idx > 0 && (
                            <div className="mx-4 my-0.5 border-t border-border/20" />
                          )}
                          <NotificationRow notification={notification} />
                        </React.Fragment>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Footer */}
            {filteredNotifications.length > 0 && (
              <div className="border-t border-border/30 px-3 py-2 shrink-0 bg-muted/20">
                <p className="text-center text-[11px] text-muted-foreground/60">
                  {filteredNotifications.length}{' '}
                  {filteredNotifications.length === 1 ? 'notification' : 'notifications'}
                  {unreadCount > 0 && (
                    <span className="ml-1">
                      &middot; <span className="text-emerald-600 dark:text-emerald-400 font-medium">{unreadCount} unread</span>
                    </span>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationPanel;

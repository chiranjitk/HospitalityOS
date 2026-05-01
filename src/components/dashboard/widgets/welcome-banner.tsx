'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, HeadphonesIcon, SprayCan, Clock, Calendar } from 'lucide-react';
import { useTranslations } from '@/i18n/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ── Role Config ──────────────────────────────────────────────────────────────

interface RoleConfig {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
  tipKey: string;
  tipDefault: string;
}

const ROLE_MAP: Record<string, RoleConfig> = {
  admin: {
    label: 'Admin',
    icon: Shield,
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    tipKey: 'fullAccess',
    tipDefault: 'You have full system access',
  },
  front_desk: {
    label: 'Front Desk',
    icon: HeadphonesIcon,
    badgeClass: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    tipKey: 'guestFrontdesk',
    tipDefault: '3 guests expected today',
  },
  housekeeping: {
    label: 'Housekeeping',
    icon: SprayCan,
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    tipKey: 'housekeepingRole',
    tipDefault: '12 rooms scheduled for turnover',
  },
};

const DEFAULT_ROLE: RoleConfig = {
  label: 'Staff',
  icon: Shield,
  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  tipKey: 'fullAccess',
  tipDefault: 'Have a productive day!',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRoleConfig(roleName: string): RoleConfig {
  const key = roleName.toLowerCase();
  if (key.includes('admin')) return ROLE_MAP.admin;
  if (key.includes('front') || key.includes('desk') || key.includes('reception'))
    return ROLE_MAP.front_desk;
  if (key.includes('house') || key.includes('clean'))
    return ROLE_MAP.housekeeping;
  return DEFAULT_ROLE;
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Component ────────────────────────────────────────────────────────────────

export function WelcomeBannerWidget() {
  const t = useTranslations('dashboard');
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const role = getRoleConfig(user.roleName);
  const RoleIcon = role.icon;
  const initials = getInitials(user.firstName, user.lastName);
  const greeting = getGreeting();

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Card
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/50 shadow-sm',
          'bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60',
          'dark:from-emerald-950/30 dark:via-background dark:to-teal-950/20',
          'hover:shadow-md hover:-translate-y-[1px] transition-all duration-300'
        )}
      >
        {/* Top 2px gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 z-10" />

        {/* Subtle inner shadow for depth */}
        <div className="absolute inset-0 shadow-[inset_0_2px_6px_-2px_oklch(0_0_0/0.04)] dark:shadow-[inset_0_2px_8px_-2px_oklch(0_0_0/0.15)] pointer-events-none rounded-2xl" />

        {/* Gradient left border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-teal-500 to-emerald-600 z-10" />

        {/* Animated shimmer overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 6, repeat: Infinity, repeatDelay: 4, ease: 'linear' }}
        />

        <CardContent className="p-5 flex items-center gap-5 relative">
          {/* Avatar with gradient ring */}
          <div className="relative shrink-0">
            {/* Gradient ring around avatar */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-400 opacity-40 blur-[2px] animate-[breathe_2.5s_ease-in-out_infinite]" />
            <div
              className={cn(
                'relative flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-sm',
                'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 ring-2 ring-white/80 dark:ring-background/80'
              )}
            >
              {initials || '?'}
            </div>
            {/* Online status dot */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-white dark:ring-background" />
            </span>
          </div>

          {/* Greeting & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-semibold text-foreground truncate">
                {greeting}, {user.firstName}!
              </h2>
              <Badge
                variant="outline"
                className={cn('text-[11px] font-medium px-2 py-0 gap-1 border', role.badgeClass)}
              >
                <RoleIcon className="h-3 w-3" />
                {role.label}
              </Badge>
            </div>

            {/* Role-based tip */}
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <RoleIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
              {t(role.tipKey) || role.tipDefault}
            </p>
          </div>

          {/* Time & Date */}
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums font-medium">{formattedTime}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <span>{t('lastLogin')}</span>
              <span className="font-medium">2h ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

'use client';

import React from 'react';
import {
  CalendarPlus, LogIn, LogOut, Users, CreditCard, Sparkles, Wifi, MessageSquare,
  DoorOpen, SprayCan, BarChart3, Settings, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

interface QuickAction {
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  ring: string;
  glow: string;
  tooltipKey: string;
  section: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'newBooking', icon: CalendarPlus, gradient: 'from-primary via-amber-500 to-primary', ring: 'ring-primary/20', glow: 'shadow-primary/15', tooltipKey: 'newBookingTip', section: 'bookings-calendar' },
  { labelKey: 'checkIn', icon: LogIn, gradient: 'from-emerald-400 to-emerald-600', ring: 'ring-emerald-500/20', glow: 'shadow-emerald-500/15', tooltipKey: 'checkInTip', section: 'frontdesk-checkin' },
  { labelKey: 'checkOut', icon: LogOut, gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/20', glow: 'shadow-amber-500/15', tooltipKey: 'checkOutTip', section: 'frontdesk-checkout' },
  { labelKey: 'newGuest', icon: Users, gradient: 'from-violet-400 to-purple-600', ring: 'ring-violet-500/20', glow: 'shadow-violet-500/15', tooltipKey: 'newGuestTip', section: 'guests-list' },
  { labelKey: 'payment', icon: CreditCard, gradient: 'from-rose-400 to-pink-600', ring: 'ring-rose-500/20', glow: 'shadow-rose-500/15', tooltipKey: 'paymentTip', section: 'billing-payments' },
  { labelKey: 'service', icon: Sparkles, gradient: 'from-cyan-400 to-teal-500', ring: 'ring-cyan-500/20', glow: 'shadow-cyan-500/15', tooltipKey: 'serviceTip', section: 'experience-requests' },
  { labelKey: 'message', icon: MessageSquare, gradient: 'from-orange-400 to-amber-500', ring: 'ring-orange-500/20', glow: 'shadow-orange-500/15', tooltipKey: 'messageTip', section: 'experience-chat' },
  { labelKey: 'wifiPass', icon: Wifi, gradient: 'from-sky-400 to-blue-500', ring: 'ring-sky-500/20', glow: 'shadow-sky-500/15', tooltipKey: 'wifiPassTip', section: 'wifi-vouchers' },
  { labelKey: 'rooms', icon: DoorOpen, gradient: 'from-slate-400 to-slate-600', ring: 'ring-slate-500/20', glow: 'shadow-slate-500/10', tooltipKey: 'roomsTip', section: 'frontdesk-room-grid' },
  { labelKey: 'housekeeping', icon: SprayCan, gradient: 'from-teal-400 to-emerald-500', ring: 'ring-teal-500/20', glow: 'shadow-teal-500/15', tooltipKey: 'housekeepingTip', section: 'housekeeping-status' },
  { labelKey: 'reports', icon: BarChart3, gradient: 'from-purple-400 to-indigo-500', ring: 'ring-purple-500/20', glow: 'shadow-purple-500/15', tooltipKey: 'reportsTip', section: 'reports-revenue' },
  { labelKey: 'settings', icon: Settings, gradient: 'from-zinc-400 to-zinc-600', ring: 'ring-zinc-500/20', glow: 'shadow-zinc-500/10', tooltipKey: 'settingsTip', section: 'settings-general' },
];

export function QuickActions() {
  const t = useTranslations('dashboard');
  const { setActiveSection } = useUIStore();

  return (
    <div className="relative">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t('quickActions')}</h3>
      </div>

      {/* Action buttons grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.labelKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25, ease: 'easeOut' }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection(action.section)}
            className={cn(
              "group/action relative flex flex-col items-center gap-2.5 py-3.5 px-2 rounded-xl border border-border/30",
              "cursor-pointer transition-all duration-200 ease-out",
              "bg-background",
              "hover:bg-accent/50 hover:border-border/50",
              "active:scale-[0.97]",
            )}
            title={t(action.tooltipKey)}
          >
            {/* Icon container — gradient badge with ring and soft glow */}
            <div className="relative">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br shadow-md",
                "ring-1",
                "transition-all duration-200 ease-out",
                "group-hover/action:shadow-lg group-hover/action:scale-110",
                action.gradient,
                action.ring,
                action.glow,
              )}>
                <action.icon className="h-4.5 w-4.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" />
              </div>
            </div>

            {/* Label */}
            <span className={cn(
              "text-[11px] font-medium text-foreground/70 group-hover/action:text-foreground truncate leading-tight text-center",
              "transition-colors duration-200",
            )}>
              {t(action.labelKey)}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

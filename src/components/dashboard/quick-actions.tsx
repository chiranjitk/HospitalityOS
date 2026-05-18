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

const QUICK_ACTIONS = [
  { labelKey: 'newBooking', icon: CalendarPlus, accent: 'bg-primary/10 text-primary', tooltipKey: 'newBookingTip', subtitle: 'Create Booking', section: 'bookings-calendar' },
  { labelKey: 'checkIn', icon: LogIn, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', tooltipKey: 'checkInTip', subtitle: 'Guest Arrival', section: 'frontdesk-checkin' },
  { labelKey: 'checkOut', icon: LogOut, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', tooltipKey: 'checkOutTip', subtitle: 'Guest Departure', section: 'frontdesk-checkout' },
  { labelKey: 'newGuest', icon: Users, accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', tooltipKey: 'newGuestTip', subtitle: 'Add Guest', section: 'guests-list' },
  { labelKey: 'payment', icon: CreditCard, accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', tooltipKey: 'paymentTip', subtitle: 'Process Payment', section: 'billing-payments' },
  { labelKey: 'service', icon: Sparkles, accent: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', tooltipKey: 'serviceTip', subtitle: 'Guest Requests', section: 'experience-requests' },
  { labelKey: 'message', icon: MessageSquare, accent: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', tooltipKey: 'messageTip', subtitle: 'Live Chat', section: 'experience-chat' },
  { labelKey: 'wifiPass', icon: Wifi, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', tooltipKey: 'wifiPassTip', subtitle: 'Guest Network', section: 'wifi-vouchers' },
  { labelKey: 'rooms', icon: DoorOpen, accent: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', tooltipKey: 'roomsTip', subtitle: 'Room Grid', section: 'frontdesk-room-grid' },
  { labelKey: 'housekeeping', icon: SprayCan, accent: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', tooltipKey: 'housekeepingTip', subtitle: 'Cleaning Status', section: 'housekeeping-status' },
  { labelKey: 'reports', icon: BarChart3, accent: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', tooltipKey: 'reportsTip', subtitle: 'Revenue Insights', section: 'reports-revenue' },
  { labelKey: 'settings', icon: Settings, accent: 'bg-muted text-muted-foreground', tooltipKey: 'settingsTip', subtitle: 'System Config', section: 'settings-general' },
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
              "group/action relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl border border-border/30",
              "cursor-pointer transition-colors duration-150 ease-out",
              "bg-background",
              "hover:bg-accent/50 hover:border-border/50",
              "active:scale-[0.97]",
            )}
            title={t(action.tooltipKey)}
          >
            <div className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              "transition-transform duration-200 ease-out",
              "group-hover/action:scale-105",
              action.accent
            )}>
              <action.icon className="h-4 w-4" />
            </div>

            <span className={cn(
              "text-[11px] font-medium text-foreground/80 group-hover/action:text-foreground truncate leading-tight text-center",
              "transition-colors duration-150",
            )}>
              {t(action.labelKey)}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

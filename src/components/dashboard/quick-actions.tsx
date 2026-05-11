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
  { labelKey: 'newBooking', icon: CalendarPlus, iconGradient: 'from-primary to-emerald-500', cardBg: 'from-primary/5 to-emerald-500/5', hoverBg: 'from-primary/12 to-emerald-500/12', tooltipKey: 'newBookingTip', subtitle: 'Create Booking', section: 'bookings-calendar' },
  { labelKey: 'checkIn', icon: LogIn, iconGradient: 'from-teal-400 to-teal-600', cardBg: 'from-teal-400/5 to-teal-600/5', hoverBg: 'from-teal-400/12 to-teal-600/12', tooltipKey: 'checkInTip', subtitle: 'Guest Arrival', section: 'frontdesk-checkin' },
  { labelKey: 'checkOut', icon: LogOut, iconGradient: 'from-amber-400 to-orange-500', cardBg: 'from-amber-400/5 to-orange-500/5', hoverBg: 'from-amber-400/12 to-orange-500/12', tooltipKey: 'checkOutTip', subtitle: 'Guest Departure', section: 'frontdesk-checkout' },
  { labelKey: 'newGuest', icon: Users, iconGradient: 'from-violet-400 to-purple-500', cardBg: 'from-violet-400/5 to-purple-500/5', hoverBg: 'from-violet-400/12 to-purple-500/12', tooltipKey: 'newGuestTip', subtitle: 'Add Guest', section: 'guests-list' },
  { labelKey: 'payment', icon: CreditCard, iconGradient: 'from-pink-400 to-rose-500', cardBg: 'from-pink-400/5 to-rose-500/5', hoverBg: 'from-pink-400/12 to-rose-500/12', tooltipKey: 'paymentTip', subtitle: 'Process Payment', section: 'billing-payments' },
  { labelKey: 'service', icon: Sparkles, iconGradient: 'from-cyan-400 to-teal-500', cardBg: 'from-cyan-400/5 to-teal-500/5', hoverBg: 'from-cyan-400/12 to-teal-500/12', tooltipKey: 'serviceTip', subtitle: 'Guest Requests', section: 'experience-requests' },
  { labelKey: 'message', icon: MessageSquare, iconGradient: 'from-orange-400 to-amber-500', cardBg: 'from-orange-400/5 to-amber-500/5', hoverBg: 'from-orange-400/12 to-amber-500/12', tooltipKey: 'messageTip', subtitle: 'Live Chat', section: 'experience-chat' },
  { labelKey: 'wifiPass', icon: Wifi, iconGradient: 'from-primary to-cyan-500', cardBg: 'from-primary/5 to-cyan-500/5', hoverBg: 'from-primary/12 to-cyan-500/12', tooltipKey: 'wifiPassTip', subtitle: 'Guest Network', section: 'wifi-vouchers' },
  { labelKey: 'rooms', icon: DoorOpen, iconGradient: 'from-slate-400 to-slate-600', cardBg: 'from-slate-400/5 to-slate-600/5', hoverBg: 'from-slate-400/12 to-slate-600/12', tooltipKey: 'roomsTip', subtitle: 'Room Grid', section: 'frontdesk-room-grid' },
  { labelKey: 'housekeeping', icon: SprayCan, iconGradient: 'from-cyan-400 to-teal-500', cardBg: 'from-cyan-400/5 to-teal-500/5', hoverBg: 'from-cyan-400/12 to-teal-500/12', tooltipKey: 'housekeepingTip', subtitle: 'Cleaning Status', section: 'housekeeping-status' },
  { labelKey: 'reports', icon: BarChart3, iconGradient: 'from-violet-400 to-purple-500', cardBg: 'from-violet-400/5 to-purple-500/5', hoverBg: 'from-violet-400/12 to-purple-500/12', tooltipKey: 'reportsTip', subtitle: 'Revenue Insights', section: 'reports-revenue' },
  { labelKey: 'settings', icon: Settings, iconGradient: 'from-gray-400 to-gray-600', cardBg: 'from-gray-400/5 to-gray-600/5', hoverBg: 'from-gray-400/12 to-gray-600/12', tooltipKey: 'settingsTip', subtitle: 'System Config', section: 'settings-general' },
];

export function QuickActions() {
  const t = useTranslations('dashboard');
  const { setActiveSection } = useUIStore();

  return (
    <div className="relative">
      {/* Gradient top border */}
      <div className="absolute -top-px left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-primary/50 via-teal-400/40 to-amber-400/30" />

      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 pt-1">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t('quickActions')}</h3>
      </div>

      {/* Action buttons grid with better spacing */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.labelKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection(action.section)}
            className={cn(
              "group/action relative flex flex-col items-center gap-2 py-3 px-2.5 rounded-xl border border-border/40",
              "cursor-pointer transition-all duration-150 ease-out",
              "bg-gradient-to-br",
              action.cardBg,
              "hover:bg-accent/80 hover:shadow-md hover:border-border/60",
              "active:scale-[0.97]",
              "card-shine"
            )}
            title={t(action.tooltipKey)}
          >
            {/* Hover gradient overlay */}
            <div className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover/action:opacity-100 transition-opacity duration-300",
              action.hoverBg
            )} />

            <div className={cn(
              "relative h-9 w-9 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br",
              "transition-all duration-300 ease-out",
              "group-hover/action:shadow-lg group-hover/action:scale-110",
              action.iconGradient
            )}>
              <action.icon className="h-4 w-4 text-white" />
            </div>

            {/* Text with slide-up micro-interaction on hover */}
            <div className="relative flex flex-col items-center min-w-0 overflow-hidden h-8 justify-center">
              <span className={cn(
                "text-xs font-semibold text-foreground truncate leading-tight",
                "transition-all duration-300 ease-out",
                "group-hover/action:-translate-y-2.5 group-hover/action:opacity-0"
              )}>
                {t(action.labelKey)}
              </span>
              <span className={cn(
                "text-[10px] text-muted-foreground truncate leading-tight absolute",
                "translate-y-2.5 opacity-0",
                "transition-all duration-300 ease-out",
                "group-hover/action:translate-y-0 group-hover/action:opacity-70"
              )}>
                {action.subtitle}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

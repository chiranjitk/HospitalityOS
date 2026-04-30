'use client';

import React from 'react';
import {
  CalendarPlus, LogIn, LogOut, Users, CreditCard, Sparkles, Wifi, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

const QUICK_ACTIONS = [
  { labelKey: 'newBooking', icon: CalendarPlus, iconGradient: 'from-primary to-emerald-500', cardBg: 'from-primary/5 to-emerald-500/5 hover:from-primary/10 hover:to-emerald-500/10', tooltipKey: 'newBookingTip', section: 'bookings-calendar' },
  { labelKey: 'checkIn', icon: LogIn, iconGradient: 'from-teal-400 to-teal-600', cardBg: 'from-teal-400/5 to-teal-600/5 hover:from-teal-400/10 hover:to-teal-600/10', tooltipKey: 'checkInTip', section: 'frontdesk-checkin' },
  { labelKey: 'checkOut', icon: LogOut, iconGradient: 'from-amber-400 to-orange-500', cardBg: 'from-amber-400/5 to-orange-500/5 hover:from-amber-400/10 hover:to-orange-500/10', tooltipKey: 'checkOutTip', section: 'frontdesk-checkout' },
  { labelKey: 'newGuest', icon: Users, iconGradient: 'from-violet-400 to-purple-500', cardBg: 'from-violet-400/5 to-purple-500/5 hover:from-violet-400/10 hover:to-purple-500/10', tooltipKey: 'newGuestTip', section: 'guests-list' },
  { labelKey: 'payment', icon: CreditCard, iconGradient: 'from-pink-400 to-rose-500', cardBg: 'from-pink-400/5 to-rose-500/5 hover:from-pink-400/10 hover:to-rose-500/10', tooltipKey: 'paymentTip', section: 'billing-payments' },
  { labelKey: 'service', icon: Sparkles, iconGradient: 'from-cyan-400 to-teal-500', cardBg: 'from-cyan-400/5 to-teal-500/5 hover:from-cyan-400/10 hover:to-teal-500/10', tooltipKey: 'serviceTip', section: 'experience-requests' },
  { labelKey: 'message', icon: MessageSquare, iconGradient: 'from-orange-400 to-amber-500', cardBg: 'from-orange-400/5 to-amber-500/5 hover:from-orange-400/10 hover:to-amber-500/10', tooltipKey: 'messageTip', section: 'experience-chat' },
  { labelKey: 'wifiPass', icon: Wifi, iconGradient: 'from-primary to-cyan-500', cardBg: 'from-primary/5 to-cyan-500/5 hover:from-primary/10 hover:to-cyan-500/10', tooltipKey: 'wifiPassTip', section: 'wifi-vouchers' },
];

export function QuickActions() {
  const t = useTranslations('dashboard');
  const { setActiveSection } = useUIStore();

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('quickActions')}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.labelKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection(action.section)}
            className={cn(
              "group/action relative flex items-center gap-3 py-3 px-3 rounded-xl border border-border/40",
              "cursor-pointer transition-all duration-300 ease-out",
              "bg-gradient-to-br",
              action.cardBg,
              "hover:shadow-md hover:border-border/60",
              "active:shadow-sm"
            )}
            title={t(action.tooltipKey)}
          >
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br",
              "transition-all duration-300 ease-out",
              "group-hover/action:shadow-lg group-hover/action:scale-110",
              action.iconGradient
            )}>
              <action.icon className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover/action:text-foreground transition-colors truncate leading-tight">
                {t(action.labelKey)}
              </span>
              <span className="text-[10px] text-muted-foreground/60 group-hover/action:text-muted-foreground transition-colors truncate">
                {t(action.tooltipKey)}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

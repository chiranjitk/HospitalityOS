'use client';

import React from 'react';
import {
  CalendarPlus, LogIn, LogOut, Users, CreditCard, Sparkles, Wifi, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

export function QuickActions() {
  const t = useTranslations('dashboard');
  const { setActiveSection } = useUIStore();

  const quickActions = [
    { labelKey: 'newBooking', icon: CalendarPlus, gradient: 'from-primary to-primary', tooltipKey: 'newBookingTip', section: 'bookings-calendar' },
    { labelKey: 'checkIn', icon: LogIn, gradient: 'from-teal-400 to-teal-600', tooltipKey: 'checkInTip', section: 'frontdesk-checkin' },
    { labelKey: 'checkOut', icon: LogOut, gradient: 'from-amber-400 to-orange-500', tooltipKey: 'checkOutTip', section: 'frontdesk-checkout' },
    { labelKey: 'newGuest', icon: Users, gradient: 'from-violet-400 to-purple-500', tooltipKey: 'newGuestTip', section: 'guests-list' },
    { labelKey: 'payment', icon: CreditCard, gradient: 'from-pink-400 to-rose-500', tooltipKey: 'paymentTip', section: 'billing-payments' },
    { labelKey: 'service', icon: Sparkles, gradient: 'from-cyan-400 to-sky-500', tooltipKey: 'serviceTip', section: 'experience-requests' },
    { labelKey: 'message', icon: MessageSquare, gradient: 'from-orange-400 to-amber-500', tooltipKey: 'messageTip', section: 'experience-chat' },
    { labelKey: 'wifiPass', icon: Wifi, gradient: 'from-primary to-cyan-500', tooltipKey: 'wifiPassTip', section: 'wifi-vouchers' },
  ];

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('quickActions')}</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.labelKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            whileHover={{ y: -3, scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveSection(action.section)}
            className={cn(
              "group/action relative flex flex-col items-center gap-2 py-3 px-1 rounded-xl",
              "cursor-pointer transition-all duration-200",
              "hover:bg-muted/60 active:bg-muted/80"
            )}
            title={t(action.tooltipKey)}
          >
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-sm", "bg-gradient-to-br transition-all duration-300", "group-hover/action:shadow-md group-hover/action:scale-110", action.gradient)}>
              <action.icon className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground group-hover/action:text-foreground transition-colors text-center leading-tight">
              {t(action.labelKey)}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

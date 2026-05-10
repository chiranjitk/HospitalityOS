'use client';

import React, { useState, useCallback } from 'react';
import { Plus, CalendarPlus, UserPlus, LogIn, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface QuickAction {
  id: string;
  label: string;
  section: string;
  icon: React.ElementType;
  iconColor: string;
}

// ============================================
// Action Definitions
// ============================================

const actions: QuickAction[] = [
  {
    id: 'new-booking',
    label: 'New Booking',
    section: 'bookings-calendar',
    icon: CalendarPlus,
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'add-guest',
    label: 'Add Guest',
    section: 'guests-list',
    icon: UserPlus,
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'check-in',
    label: 'Check-In',
    section: 'frontdesk-checkin',
    icon: LogIn,
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'quick-report',
    label: 'Quick Report',
    section: 'reports-revenue',
    icon: BarChart3,
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
];

// ============================================
// Animation Variants
// ============================================

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const fabIconVariants = {
  closed: { rotate: 0 },
  open: { rotate: 45 },
};

const actionVariants = {
  hidden: { opacity: 0, scale: 0.3, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 22,
      delay: i * 0.06,
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    scale: 0.3,
    y: 10,
    transition: {
      duration: 0.15,
      delay: i * 0.03,
    },
  }),
};

const tooltipVariants = {
  hidden: { opacity: 0, x: 8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06 + 0.1, duration: 0.15 },
  }),
  exit: {
    opacity: 0,
    x: 8,
    transition: { duration: 0.1 },
  },
};

// ============================================
// Component
// ============================================

export function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleAction = useCallback(
    (section: string) => {
      useUIStore.getState().setActiveSection(section);
      setIsOpen(false);
    },
    []
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 xl:hidden">
      {/* Semi-transparent backdrop when expanded */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="fab-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40"
            onClick={close}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-14 right-0 flex flex-col-reverse items-end gap-2.5">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.id}
                  custom={index}
                  variants={actionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex items-center gap-2"
                >
                  {/* Tooltip label */}
                  <motion.span
                    custom={index}
                    variants={tooltipVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={cn(
                      'text-xs font-medium text-foreground whitespace-nowrap',
                      'bg-popover border border-border/60 rounded-md px-2 py-1',
                      'shadow-sm select-none'
                    )}
                  >
                    {action.label}
                  </motion.span>

                  {/* Action button */}
                  <button
                    onClick={() => handleAction(action.section)}
                    className={cn(
                      'h-10 w-10 rounded-full',
                      'bg-white dark:bg-popover',
                      'border border-border/50 shadow-md',
                      'flex items-center justify-center',
                      'hover:shadow-lg active:scale-95',
                      'transition-shadow duration-150'
                    )}
                    aria-label={action.label}
                  >
                    <Icon className={cn('h-4.5 w-4.5', action.iconColor)} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={toggle}
        className={cn(
          'relative h-12 w-12 rounded-full',
          'bg-teal-600 hover:bg-teal-700',
          'text-white shadow-lg shadow-teal-600/25',
          'flex items-center justify-center',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
          'active:scale-95'
        )}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <motion.div
          variants={fabIconVariants}
          animate={isOpen ? 'open' : 'closed'}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Plus className="h-5 w-5" />
        </motion.div>
      </motion.button>
    </div>
  );
}

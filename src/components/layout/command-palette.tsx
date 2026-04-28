'use client';

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Calendar,
  LogIn,
  LogOut,
  Users,
  Sparkles,
  Receipt,
  BarChart3,
  Settings,
  BedDouble,
  Megaphone,
  TrendingUp,
  CalendarPlus,
  UserPlus,
  CreditCard,
  Search,
} from 'lucide-react';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

const NAVIGATION_ITEMS: NavItem[] = [
  { id: 'dashboard-overview', label: 'Dashboard Overview', icon: LayoutDashboard, shortcut: 'D' },
  { id: 'bookings-calendar', label: 'Bookings Calendar', icon: Calendar, shortcut: 'B' },
  { id: 'frontdesk-checkin', label: 'Check-in', icon: LogIn },
  { id: 'frontdesk-checkout', label: 'Check-out', icon: LogOut },
  { id: 'guests-list', label: 'Guest List', icon: Users },
  { id: 'housekeeping-tasks', label: 'Housekeeping Tasks', icon: Sparkles },
  { id: 'billing-folios', label: 'Billing & Folios', icon: Receipt },
  { id: 'reports-revenue', label: 'Revenue Reports', icon: BarChart3 },
  { id: 'settings-general', label: 'Settings', icon: Settings },
  { id: 'pms-rooms', label: 'Room Management', icon: BedDouble },
  { id: 'crm-segments', label: 'CRM & Marketing', icon: Megaphone },
  { id: 'revenue-pricing', label: 'Revenue Management', icon: TrendingUp },
];

const ACTION_ITEMS: NavItem[] = [
  { id: 'bookings-calendar', label: 'New Booking', icon: CalendarPlus },
  { id: 'frontdesk-checkin', label: 'New Check-in', icon: LogIn },
  { id: 'frontdesk-checkout', label: 'New Check-out', icon: LogOut },
  { id: 'guests-list', label: 'Add Guest', icon: UserPlus },
  { id: 'billing-payments', label: 'Record Payment', icon: CreditCard },
];

export interface CommandPaletteHandle {
  open: () => void;
  close: () => void;
}

export const CommandPalette = forwardRef<CommandPaletteHandle>(
  function CommandPalette(_props, ref) {
    const [open, setOpen] = useState(false);
    const t = useTranslations('layout');
    const setActiveSection = useUIStore((s) => s.setActiveSection);

    // Expose open/close to parent via ref
    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));

    // Ctrl+K / Cmd+K keyboard shortcut
    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
      }
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSelect = useCallback(
      (sectionId: string) => {
        setActiveSection(sectionId);
        setOpen(false);
      },
      [setActiveSection]
    );

    return (
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('commandPalette')}
        description={t('searchNavigation')}
      >
        <CommandInput placeholder={t('searchModules')} />

        <CommandList className="max-h-[360px]">
          <CommandEmpty>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">{t('noResultsFound')}</p>
              <p className="text-xs mt-1">{t('tryDifferentSearch')}</p>
            </div>
          </CommandEmpty>

          <CommandGroup heading={t('navigationGroup')}>
            {NAVIGATION_ITEMS.map((item) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => handleSelect(item.id)}
                className="gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('actionsGroup')}>
            {ACTION_ITEMS.map((item) => (
              <CommandItem
                key={`action-${item.id}-${item.label}`}
                value={item.label}
                onSelect={() => handleSelect(item.id)}
                className="gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>

        {/* Footer with keyboard hints */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>{' '}
              {t('navigate')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>{' '}
              {t('select')}
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>{' '}
            {t('close')}
          </span>
        </div>
      </CommandDialog>
    );
  }
);

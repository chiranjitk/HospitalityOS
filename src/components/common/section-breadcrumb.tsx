'use client';

import React from 'react';
import { Home, ChevronRight } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import {
  Breadcrumb as ShBreadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb';
import { useUIStore } from '@/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { navigationConfig } from '@/config/navigation';
import { cn } from '@/lib/utils';

// =====================================================
// Types
// =====================================================

export interface BreadcrumbEntry {
  title: string;
  icon: LucideIcon;
  href: string;
}

// =====================================================
// Utility: getSectionBreadcrumb
// =====================================================

/**
 * Derive breadcrumb trail from a section ID by looking up
 * the navigation config. Returns an array of { title, icon, href } entries.
 *
 * Examples:
 *   "pms-rooms"     → [{ title: "PMS", icon: Building2 }, { title: "Rooms", icon: Key }]
 *   "bookings-calendar" → [{ title: "Bookings", icon: CalendarDays }, { title: "Calendar View", icon: CalendarDays }]
 *   "dashboard-overview" → [{ title: "Dashboard", icon: LayoutDashboard }, { title: "Overview", icon: LayoutDashboard }]
 */
export function getSectionBreadcrumb(sectionId: string): BreadcrumbEntry[] {
  // Check if sectionId directly matches a top-level section (e.g. "dashboard")
  const parentSection = navigationConfig.find((s) => s.id === sectionId);
  if (parentSection) {
    return [{ title: parentSection.title, icon: parentSection.icon, href: '#' + parentSection.id }];
  }

  // Look for the section within a parent's items
  for (const section of navigationConfig) {
    const item = section.items.find((i) => i.id === sectionId);
    if (item) {
      return [
        { title: section.title, icon: section.icon, href: '#' + section.id },
        { title: item.title, icon: item.icon, href: item.href },
      ];
    }
  }

  // Fallback: return a single entry derived from the ID
  return [
    {
      title: sectionId
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      icon: ChevronRight,
      href: '#' + sectionId,
    },
  ];
}

// =====================================================
// Section Breadcrumb Component
// =====================================================

interface SectionBreadcrumbProps {
  sectionId: string;
  className?: string;
}

export function SectionBreadcrumb({ sectionId, className }: SectionBreadcrumbProps) {
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const isMobile = useIsMobile();
  const entries = getSectionBreadcrumb(sectionId);

  const handleNavigate = (href: string) => {
    // Parse the href to get the section ID (e.g. "#pms-rooms" → "pms-rooms")
    const id = href.replace('#', '');
    if (id) {
      setActiveSection(id);
    }
  };

  // On mobile: show only last 2 entries with ellipsis prefix if > 2
  const visibleEntries = isMobile && entries.length > 2
    ? entries.slice(-2)
    : entries;
  const showEllipsis = isMobile && entries.length > 2;

  return (
    <ShBreadcrumb aria-label="Section breadcrumb" className={cn('text-sm', className)}>
      <BreadcrumbList>
        {/* Home / Dashboard */}
        <BreadcrumbItem>
          <BreadcrumbLink
            href="#dashboard-overview"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('#dashboard-overview');
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator>
          <ChevronRight className="h-3.5 w-3.5" />
        </BreadcrumbSeparator>

        {/* Ellipsis on mobile when there are hidden entries */}
        {showEllipsis && (
          <>
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5" />
            </BreadcrumbSeparator>
          </>
        )}

        {/* Breadcrumb entries */}
        {visibleEntries.map((entry, index) => {
          const isLast = index === visibleEntries.length - 1;
          const Icon = entry.icon;

          if (isLast) {
            return (
              <BreadcrumbItem key={entry.href}>
                <BreadcrumbPage className="inline-flex items-center gap-1.5 font-medium">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{entry.title}</span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            );
          }

          return (
            <React.Fragment key={entry.href}>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={entry.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate(entry.href);
                  }}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{entry.title}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </ShBreadcrumb>
  );
}

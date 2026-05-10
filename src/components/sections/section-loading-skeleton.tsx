'use client';

import React from 'react';
import {
  SkeletonLayout,
  sectionSkeletonMap,
} from '@/components/sections/section-skeleton-map';

/**
 * SectionLoadingSkeleton
 *
 * A context-aware loading skeleton that adapts its layout to the
 * section being loaded. Uses the sectionSkeletonMap to determine
 * the appropriate skeleton layout (dashboard, table, cards, form,
 * wifi, calendar, kanban, settings).
 *
 * Falls back to a generic cards layout when no section is provided
 * or the section is not mapped.
 */
export function SectionLoadingSkeleton({ section }: { section?: string }) {
  const layout: SkeletonLayout = section
    ? (sectionSkeletonMap[section] || 'cards')
    : 'cards';

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <SkeletonLayoutRenderer layout={layout} />
    </div>
  );
}

/**
 * Internal component that renders the correct skeleton based on layout type.
 * This is a single stable component declared at module level, avoiding
 * the "components created during render" ESLint issue.
 */
function SkeletonLayoutRenderer({ layout }: { layout: SkeletonLayout }) {
  switch (layout) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'table':
      return <TableSkeleton />;
    case 'form':
      return <FormSkeleton />;
    case 'wifi':
      return <WifiSkeleton />;
    case 'calendar':
      return <CalendarSkeleton />;
    case 'kanban':
      return <KanbanSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    case 'cards':
    default:
      return <CardsSkeleton />;
  }
}

// =====================================================
// SKELETON LAYOUT COMPONENTS (rendered by SkeletonLayoutRenderer)
// =====================================================

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A skeleton bar with a shimmer sweep overlay */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-muted/50', className)}
    >
      <div className="absolute inset-0 skeleton-shimmer-sweep" />
    </div>
  );
}

/** Section header skeleton (title + subtitle + actions) */
function SectionHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

// =====================================================
// DASHBOARD SKELETON
// =====================================================

function DashboardSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      {/* Metric cards row — 4 cols */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      {/* Wide content cards — 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <ShimmerBlock className="h-40 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Bottom row — 1 full-width card */}
      <div className="rounded-xl border border-border/30 p-5 space-y-3">
        <Skeleton className="h-5 w-28 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <ShimmerBlock key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// TABLE SKELETON
// =====================================================

function TableSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-9 rounded-full',
              i === 0 ? 'w-28' : i === 1 ? 'w-24' : i === 2 ? 'w-32' : 'w-20'
            )}
          />
        ))}
      </div>

      {/* Table container */}
      <div className="rounded-xl border border-border/30 overflow-hidden">
        {/* Table header */}
        <div className="bg-muted/40 px-4 py-2.5 grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-4 rounded-md" />
          ))}
        </div>

        {/* Table rows — 5 rows with alternating opacity */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'px-4 py-3 grid grid-cols-4 gap-4 border-t border-border/30',
              i % 2 === 1 ? 'bg-muted/20' : ''
            )}
          >
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-4 rounded-md" />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CARDS SKELETON
// =====================================================

function CardsSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      {/* Filter / tab bar */}
      <div className="flex flex-wrap items-center gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-8 rounded-full',
              i === 0 ? 'w-24' : i === 1 ? 'w-20' : i === 2 ? 'w-28' : 'w-16'
            )}
          />
        ))}
      </div>

      {/* Card grid — 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 space-y-3">
            {/* Card header bar */}
            <Skeleton className="h-5 w-32 rounded-lg" />
            {/* Text line 1 */}
            <Skeleton className="h-3 w-full rounded-md" />
            {/* Text line 2 */}
            <Skeleton className="h-3 w-4/5 rounded-md" />
            {/* Text line 3 */}
            <Skeleton className="h-3 w-3/5 rounded-md" />
            {/* Card action */}
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// FORM SKELETON
// =====================================================

function FormSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      <div className="max-w-2xl space-y-6">
        {/* Form title */}
        <Skeleton className="h-8 w-48 rounded-lg" />

        {/* Field group 1 */}
        <div className="rounded-xl border border-border/30 p-5 space-y-5">
          <Skeleton className="h-5 w-24 rounded-lg" />

          {/* Field row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Field row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Textarea field */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>

        {/* Field group 2 */}
        <div className="rounded-xl border border-border/30 p-5 space-y-5">
          <Skeleton className="h-5 w-28 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// WIFI SKELETON
// =====================================================

function WifiSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      {/* Network diagram — large card */}
      <div className="rounded-xl border border-border/30 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-md" />
          </div>
        </div>

        {/* Network node diagram area */}
        <div className="relative h-52 w-full rounded-lg bg-muted/30 flex items-center justify-center">
          {/* Central node */}
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-muted/80" />
          </div>
          {/* Surrounding nodes */}
          <div className="absolute top-4 left-1/4 w-10 h-10 rounded-full bg-muted/50" />
          <div className="absolute top-4 right-1/4 w-10 h-10 rounded-full bg-muted/50" />
          <div className="absolute bottom-4 left-1/3 w-10 h-10 rounded-full bg-muted/50" />
          <div className="absolute bottom-4 right-1/3 w-10 h-10 rounded-full bg-muted/50" />
          <div className="absolute top-1/2 left-4 w-10 h-10 rounded-full bg-muted/50" />
          <div className="absolute top-1/2 right-4 w-10 h-10 rounded-full bg-muted/50" />
          {/* Connection lines (simulated with skeleton bars) */}
          <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-48 rounded-full opacity-30" />
          <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-[1px] rounded-full opacity-30" />
        </div>
      </div>

      {/* Two smaller info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-5 space-y-3">
            <Skeleton className="h-5 w-28 rounded-lg" />
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <ShimmerBlock className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 space-y-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// CALENDAR SKELETON
// =====================================================

function CalendarSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      <div className="rounded-xl border border-border/30 overflow-hidden p-5">
        {/* Calendar navigation bar */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Day-of-week header cells */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="flex items-center justify-center">
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Calendar grid — 5 rows × 7 cols */}
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-16 rounded-md bg-muted/30',
                [2, 7, 11, 15, 18, 23, 27, 30].includes(i) && 'bg-muted/50'
              )}
            >
              {[2, 7, 11, 15, 18, 23, 27, 30].includes(i) && (
                <div className="p-1 space-y-1">
                  <Skeleton className="h-2 w-full rounded-sm" />
                  {i % 3 === 0 && <Skeleton className="h-2 w-3/4 rounded-sm" />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// KANBAN SKELETON
// =====================================================

function KanbanSkeleton() {
  const columnCardCounts = [3, 2, 3];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnCardCounts.map((cardCount, colIdx) => (
          <div key={colIdx} className="space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton
                  className={cn(
                    'h-5 rounded-lg',
                    colIdx === 0 ? 'w-16' : colIdx === 1 ? 'w-20' : 'w-14'
                  )}
                />
              </div>
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>

            {/* Column body */}
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3 space-y-3 min-h-[16rem]">
              {[...Array(cardCount)].map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="rounded-lg bg-background border border-border/40 p-3 space-y-2"
                >
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-sm" />
                  <Skeleton className="h-3 w-2/3 rounded-sm" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS SKELETON
// =====================================================

function SettingsSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <SectionHeaderSkeleton />

      <div className="max-w-3xl space-y-6">
        {/* Settings section 1 */}
        <div className="rounded-xl border border-border/30 p-5 space-y-5">
          {/* Section title */}
          <Skeleton className="h-7 w-64 rounded-lg" />

          {/* Field group */}
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-start">
                <div className="space-y-1 pt-2">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-36 rounded-sm" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Settings section 2 */}
        <div className="rounded-xl border border-border/30 p-5 space-y-5">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-start">
                <div className="space-y-1 pt-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-32 rounded-sm" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            {/* Toggle row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-center">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Save button area */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-48 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SectionLoadingSkeleton;

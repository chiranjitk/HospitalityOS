'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * SectionLoadingSkeleton
 *
 * A full-page loading skeleton that appears when switching sections.
 * Mimics the layout of a typical section page (header + content area)
 * with an animated shimmer effect.
 */
export function SectionLoadingSkeleton() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6 w-full max-w-7xl mx-auto">
      {/* ── Header area ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Title + subtitle */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* ── Filter / tab bar ── */}
      <div className="flex items-center gap-3">
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

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3 p-4 rounded-2xl border border-border/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      {/* ── Content area: two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card 1 */}
          <div className="space-y-3 p-5 rounded-2xl border border-border/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            {/* Table-like rows */}
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Card 2 */}
          <div className="space-y-3 p-5 rounded-2xl border border-border/30">
            <Skeleton className="h-5 w-28 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4">
          {/* Sidebar card */}
          <div className="space-y-3 p-5 rounded-2xl border border-border/30">
            <Skeleton className="h-5 w-24 rounded-lg" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Sidebar card 2 */}
          <div className="space-y-3 p-5 rounded-2xl border border-border/30">
            <Skeleton className="h-5 w-28 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SectionLoadingSkeleton;

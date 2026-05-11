'use client';

import React from 'react';
import { SectionBreadcrumb, getSectionBreadcrumb } from './section-breadcrumb';
import { cn } from '@/lib/utils';

// =====================================================
// Section Header Props
// =====================================================

interface SectionHeaderProps {
  sectionId: string;
  /** Optional subtitle / description below the title */
  subtitle?: string;
  /** Optional right-side action buttons */
  actions?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

// =====================================================
// Section Header Component
// =====================================================

/**
 * A consistent section header that provides navigation context
 * and a clear title for every page section.
 *
 * Layout:
 *   [Breadcrumb]
 *   [Title]  ..............  [Actions?]
 *   [Subtitle?]
 */
export function SectionHeader({ sectionId, subtitle, actions, className }: SectionHeaderProps) {
  const entries = getSectionBreadcrumb(sectionId);
  const currentEntry = entries[entries.length - 1];

  return (
    <div
      className={cn(
        'border-b border-border/50 pb-4 mb-2',
        className
      )}
    >
      {/* Breadcrumb navigation */}
      <SectionBreadcrumb sectionId={sectionId} className="mb-3" />

      {/* Title row with optional actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {currentEntry?.title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

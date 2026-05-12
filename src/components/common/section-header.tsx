'use client';

import React from 'react';
import { SectionBreadcrumb } from './section-breadcrumb';
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
 * A lightweight section header that renders ONLY the breadcrumb navigation.
 *
 * Individual page components handle their own title, subtitle, and action
 * buttons — this avoids duplicate headers.
 *
 * Layout:
 *   [Breadcrumb]
 */
export function SectionHeader({ sectionId, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-1', className)}>
      <SectionBreadcrumb sectionId={sectionId} />
    </div>
  );
}

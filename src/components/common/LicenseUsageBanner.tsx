'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { useLicenseCheck } from '@/hooks/use-license-check';

// ─── Types ───────────────────────────────────────────────────────────
interface LicenseUsageBannerProps {
  /** The module key to check (e.g. 'wifi', 'pos', 'crm') */
  moduleKey: string;
  /** Human-readable module name (fallback if API returns none) */
  moduleName: string;
  /** Optional: CSS class for the outer wrapper */
  className?: string;
  /** Optional: seconds between polls (default 30) */
  pollInterval?: number;
}

// ─── Component ───────────────────────────────────────────────────────
export function LicenseUsageBanner({
  moduleKey,
  moduleName: fallbackName,
  className = '',
  pollInterval = 30,
}: LicenseUsageBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { isLoading, usage, limit, percent, isWarning, isExceeded, isUnlimited, moduleName, refresh } =
    useLicenseCheck(moduleKey, pollInterval * 1000);

  // Don't render if dismissed, loading, unlimited, or no warning/exceeded state
  if (dismissed || isLoading || isUnlimited || (!isWarning && !isExceeded)) {
    return null;
  }

  const displayName = moduleName || fallbackName;
  const isRed = isExceeded;
  const isAmber = isWarning && !isExceeded;

  return (
    <div
      className={`relative flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
        isRed
          ? 'border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent'
          : 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'
      } ${className}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className={`shrink-0 rounded-lg p-1.5 ${
          isRed ? 'bg-red-500/15' : 'bg-amber-500/15'
        }`}
      >
        <AlertTriangle
          className={`h-4 w-4 ${
            isRed
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        />
      </div>

      {/* Text + Progress */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className={`text-sm font-medium ${isRed ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {isExceeded
            ? `${displayName}: Limit exceeded — ${usage} / ${limit} used`
            : `${displayName}: ${usage} / ${limit} used (${Math.round(percent)}%)`}
        </p>
        <Progress
          value={Math.min(percent, 100)}
          className={`h-1.5 ${
            isRed
              ? '[&>[data-slot=progress-indicator]]:bg-red-500'
              : '[&>[data-slot=progress-indicator]]:bg-amber-500'
          }`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="h-7 px-2 text-xs"
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDismissed(true);
          }}
          className="h-7 w-7 p-0"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

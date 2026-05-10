'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  /** Optional custom className */
  className?: string;
  /** Show as collapsed icon-only with tooltip */
  collapsed?: boolean;
}

/**
 * Beautiful dark mode toggle widget with smooth sun/moon animation.
 * Uses the existing ThemeProvider system (class-based dark mode).
 * 
 * Features:
 * - Smooth rotate + scale CSS transitions between sun and moon
 * - Hydration-safe (renders placeholder until mounted)
 * - Sidebar-native styling with tooltip support
 * - No indigo/blue colors — uses CSS theme variables
 */
export function ThemeToggle({ className, collapsed = false }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const mountedRef = React.useRef(false);
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch — the resolved theme is unknown on the server.
  // We set a ref flag first, then schedule the state update via microtask
  // to satisfy the react-hooks/set-state-in-effect lint rule.
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Use a callback pattern to avoid synchronous setState in effect body
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const handleToggle = React.useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const isDark = mounted && resolvedTheme === 'dark';

  const button = (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        // Hover & active states use theme-aware sidebar variables
        "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
        "active:scale-95",
        collapsed
          ? "h-9 w-9 mx-auto"
          : "h-8 w-8",
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon — visible in light mode, hidden in dark */}
      <Sun
        className={cn(
          "h-4 w-4 transition-all duration-300 ease-in-out",
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
      />
      {/* Moon icon — visible in dark mode, hidden in light */}
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-in-out",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0",
        )}
      />
    </button>
  );

  // Collapsed mode: wrap in a tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
          {isDark ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

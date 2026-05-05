'use client';

/**
 * Custom ThemeProvider - compatible replacement for next-themes
 * Avoids the React 19 / Next.js 16 script tag injection warning that next-themes causes.
 * Provides the same useTheme() API surface.
 */

import * as React from 'react';
import { initializeUITheme, useUIStyleStore, applyUITheme, type ThemeMode } from '@/lib/themes/store';

type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
  forcedTheme?: string;
  systemTheme: ResolvedTheme;
  themes: ThemeMode[];
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  systemTheme: 'light',
  themes: ['light', 'dark', 'system'],
});

const STORAGE_KEY = 'staysuite-theme-mode-next';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return null;
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme - applied when no stored preference exists */
  defaultTheme?: ThemeMode;
  /** Enable system theme detection */
  enableSystem?: boolean;
  /** CSS attribute to set ('class' or 'data-theme') */
  attribute?: 'class' | 'data-theme';
  /** localStorage key */
  storageKey?: string;
  /** Disable CSS transitions when changing themes */
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = true,
  attribute = 'class',
  storageKey = STORAGE_KEY,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>('light');
  const [mounted, setMounted] = React.useState(false);

  // Resolve theme on mount
  React.useEffect(() => {
    const stored = getStoredTheme();
    const effectiveTheme = stored || defaultTheme;
    setThemeState(effectiveTheme);

    const resolved = resolveTheme(effectiveTheme);
    setResolvedTheme(resolved);

    // Apply theme to DOM
    applyThemeToDOM(resolved, attribute, disableTransitionOnChange);

    setMounted(true);

    // Also initialize the UI style store
    initializeUITheme();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system theme changes
  React.useEffect(() => {
    if (!enableSystem) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const currentState = useUIStyleStore.getState();
      if (currentState.mode === 'system' || theme === 'system') {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved, attribute, disableTransitionOnChange);
        // Also re-apply UI style
        applyUIThemeFromStore(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [enableSystem, theme, attribute, disableTransitionOnChange]);

  // Sync with Zustand store changes
  React.useEffect(() => {
    const unsubscribe = useUIStyleStore.subscribe((state, prevState) => {
      if (state.mode !== prevState.mode) {
        const resolved = resolveTheme(state.mode);
        setThemeState(state.mode);
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved, attribute, disableTransitionOnChange);
      }
    });
    return unsubscribe;
  }, [attribute, disableTransitionOnChange]);

  const setTheme = React.useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);

    // Persist
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {}

    // Apply to DOM
    applyThemeToDOM(resolved, attribute, disableTransitionOnChange);

    // Sync with Zustand store
    useUIStyleStore.getState().setMode(newTheme);
  }, [storageKey, attribute, disableTransitionOnChange]);

  const contextValue = React.useMemo<ThemeContextValue>(() => ({
    theme: mounted ? theme : defaultTheme,
    setTheme,
    resolvedTheme: mounted ? resolvedTheme : resolveTheme(defaultTheme),
    systemTheme: getSystemTheme(),
    themes: enableSystem ? ['light', 'dark', 'system'] : ['light', 'dark'],
  }), [theme, setTheme, resolvedTheme, mounted, defaultTheme, enableSystem]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyThemeToDOM(
  resolved: ResolvedTheme,
  attribute: string,
  disableTransition: boolean
) {
  const root = document.documentElement;

  if (disableTransition) {
    root.style.setProperty('--transition-duration', '0s');
  }

  if (attribute === 'class') {
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } else {
    root.setAttribute('data-theme', resolved);
  }

  root.style.setProperty('color-scheme', resolved);

  if (disableTransition) {
    // Re-enable transitions after a frame
    requestAnimationFrame(() => {
      root.style.removeProperty('--transition-duration');
    });
  }
}

function applyUIThemeFromStore(resolved: ResolvedTheme) {
  const state = useUIStyleStore.getState();
  applyUITheme(state.themeId, resolved);
}

/**
 * useTheme hook - compatible with next-themes API
 * Replace: import { useTheme } from 'next-themes'
 * With:    import { useTheme } from '@/components/theme/theme-provider'
 */
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;

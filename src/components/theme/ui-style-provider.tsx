'use client';

import * as React from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { initializeUITheme, useUIStyleStore } from '@/lib/themes/store';

interface UIStyleProviderProps {
  children: React.ReactNode;
}

export function UIStyleProvider({ children }: UIStyleProviderProps) {
  // Initialize theme on mount — clean up stale theme IDs from localStorage
  React.useEffect(() => {
    // Clean up stale theme IDs from localStorage (from removed themes)
    try {
      const rawTheme = localStorage.getItem('staysuite-ui-style');
      if (rawTheme) {
        const validIds = ['hospitality-sunrise', 'gradient-modern', 'neumorphism', 'slate-enterprise', 'terra-corporate', 'arctic-steel', 'noir-executive'];
        if (!validIds.includes(rawTheme)) {
          localStorage.setItem('staysuite-ui-style', 'hospitality-sunrise');
        }
      }
      // Also clean the Zustand persisted store
      const zustandStore = localStorage.getItem('staysuite-ui-style-store');
      if (zustandStore) {
        try {
          const parsed = JSON.parse(zustandStore);
          const validIds = ['hospitality-sunrise', 'gradient-modern', 'neumorphism', 'slate-enterprise', 'terra-corporate', 'arctic-steel', 'noir-executive'];
          if (parsed?.state?.themeId && !validIds.includes(parsed.state.themeId)) {
            parsed.state.themeId = 'hospitality-sunrise';
            localStorage.setItem('staysuite-ui-style-store', JSON.stringify(parsed));
          }
        } catch { /* ignore parse errors */ }
      }
    } catch { /* ignore localStorage errors */ }
    initializeUITheme();
  }, []);

  // Listen for store changes and apply data-theme attribute
  React.useEffect(() => {
    const unsubscribe = useUIStyleStore.subscribe((state, prevState) => {
      if (state.themeId !== prevState.themeId) {
        const root = document.documentElement;
        root.setAttribute('data-theme', state.themeId);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="staysuite-theme-mode-next"
    >
      {children}
    </ThemeProvider>
  );
}

/**
 * Hook to access UI style state and actions
 */
export function useUIStyle() {
  const store = useUIStyleStore();

  return {
    // State
    themeId: store.themeId,
    mode: store.mode,
    effectiveMode: store.getEffectiveMode(),
    isDark: store.getEffectiveMode() === 'dark',
    isLight: store.getEffectiveMode() === 'light',
    isSystem: store.mode === 'system',

    // Actions
    setTheme: store.setTheme,
    setMode: store.setMode,
    toggleMode: store.toggleMode,
  };
}

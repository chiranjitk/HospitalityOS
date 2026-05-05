'use client';

import * as React from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { initializeUITheme, useUIStyleStore } from '@/lib/themes/store';

interface UIStyleProviderProps {
  children: React.ReactNode;
}

export function UIStyleProvider({ children }: UIStyleProviderProps) {
  // Initialize theme on mount (handled by ThemeProvider now, but keep for store sync)
  React.useEffect(() => {
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

'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * FOUC (Flash of Unstyled Content) Guard.
 *
 * Applies the correct theme class (dark/light) to <html> and sets
 * `color-scheme` as early as possible — before the browser paints —
 * by using `useLayoutEffect` (synchronous, pre-paint).
 *
 * In React 19 / Next.js 16, raw `<script>` or `<Script>` tags inside
 * React component trees trigger a console warning because React will
 * not re-execute them during client-side rendering.  Moving the logic
 * into a client-side `useLayoutEffect` avoids the warning entirely and
 * still executes before the first paint.
 */
export function FoucGuard() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('staysuite-theme-mode-next');
      const isDark =
        stored === 'dark' ||
        ((!stored || stored === 'system') &&
          matchMedia('(prefers-color-scheme:dark)').matches);

      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      root.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
    } catch {
      // localStorage unavailable – ignore
    }
  }, []);

  // Also listen for system preference changes
  useEffect(() => {
    const mql = matchMedia('(prefers-color-scheme:dark)');
    const handler = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('staysuite-theme-mode-next');
        if (!stored || stored === 'system') {
          const root = document.documentElement;
          if (e.matches) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
          root.style.setProperty('color-scheme', e.matches ? 'dark' : 'light');
        }
      } catch {
        // ignore
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return null; // renders nothing
}

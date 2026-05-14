'use client';

import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────
interface LicenseCheckState {
  isAllowed: boolean;
  isLoading: boolean;
  usage: number;
  limit: number;
  percent: number;
  isWarning: boolean;
  isExceeded: boolean;
  isUnlimited: boolean;
  moduleName: string;
  moduleKey: string;
}

interface UseLicenseCheckReturn extends LicenseCheckState {
  refresh: () => Promise<void>;
}

// ─── Module-level cache to deduplicate concurrent checks ─────────────
const checkCache = new Map<string, Promise<unknown>>();
const checkResultCache = new Map<string, LicenseCheckState>();

// ─── Hook ────────────────────────────────────────────────────────────
/**
 * Polls the license check endpoint periodically to monitor module usage.
 * Used by components to show usage warnings and enforce limits.
 *
 * @param moduleKey - The module key to check (e.g. 'wifi', 'pos', 'crm')
 * @param pollIntervalMs - How often to poll in ms (default 30 000 = 30s)
 */
export function useLicenseCheck(
  moduleKey: string,
  pollIntervalMs: number = 30000
): UseLicenseCheckReturn {
  const mountedRef = useRef(true);
  const versionRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use a ref-based state approach to avoid the set-state-in-effect lint
  const initialState: LicenseCheckState = {
    isAllowed: true,
    isLoading: true,
    usage: 0,
    limit: 0,
    percent: 0,
    isWarning: false,
    isExceeded: false,
    isUnlimited: true,
    moduleName: moduleKey,
    moduleKey,
  };

  const stateRef = useRef<LicenseCheckState>(checkResultCache.get(moduleKey) ?? initialState);
  const subscribersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    subscribersRef.current.add(listener);
    return () => {
      subscribersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return stateRef.current;
  }, []);

  const getServerSnapshot = useCallback(() => {
    return initialState;
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const notify = useCallback(() => {
    for (const sub of subscribersRef.current) {
      sub();
    }
  }, []);

  const checkLicense = useCallback(async () => {
    if (!moduleKey) return;

    // Deduplicate concurrent checks for the same module
    const cacheKey = moduleKey;
    if (checkCache.has(cacheKey)) {
      await checkCache.get(cacheKey);
      return;
    }

    const promise = (async () => {
      try {
        const res = await fetch('/api/license/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleKey }),
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.success && data.data) {
          const d = data.data;
          const newState: LicenseCheckState = {
            isAllowed: d.allowed ?? true,
            isLoading: false,
            usage: d.current ?? 0,
            limit: d.limit ?? 0,
            percent: d.percent ?? 0,
            isWarning: d.isWarning ?? false,
            isExceeded: d.isExceeded ?? false,
            isUnlimited: d.isUnlimited ?? false,
            moduleName: d.moduleName ?? moduleKey,
            moduleKey,
          };

          if (mountedRef.current) {
            checkResultCache.set(moduleKey, newState);
            stateRef.current = newState;
            notify();
          }
        }
      } catch {
        // Silently fail — don't break the UI
      }
    })();

    checkCache.set(cacheKey, promise);
    try {
      await promise;
    } finally {
      checkCache.delete(cacheKey);
    }
  }, [moduleKey, notify]);

  // Initial fetch + polling combined into one effect
  useEffect(() => {
    mountedRef.current = true;
    versionRef.current += 1;
    const version = versionRef.current;

    if (!moduleKey) return;

    // Initial check
    checkLicense();

    // Polling
    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(() => {
        if (versionRef.current === version) {
          checkLicense();
        }
      }, pollIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkLicense, moduleKey, pollIntervalMs]);

  return {
    ...state,
    refresh: checkLicense,
  };
}

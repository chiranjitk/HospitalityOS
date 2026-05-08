'use client';

import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

function subscribeStandaloneMode(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(display-mode: standalone)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissedAt(): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(DISMISS_KEY);
  return val ? parseInt(val, 10) : null;
}

function isRecentlyDismissed(): boolean {
  const dismissedAt = getDismissedAt();
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedFlag, setInstalledFlag] = useState(false);
  const [recentlyDismissed, setRecentlyDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read localStorage only after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (isRecentlyDismissed()) {
      setRecentlyDismissed(true);
    }
  }, []);

  const isStandalone = useSyncExternalStore(
    subscribeStandaloneMode,
    getStandaloneMode,
    () => false
  );

  const isInstalled = isStandalone || installedFlag;

  // Installable only when we have a deferred prompt, not installed, and not recently dismissed
  const isInstallable = useMemo(
    () => !!deferredPrompt && !isInstalled && !recentlyDismissed,
    [deferredPrompt, isInstalled, recentlyDismissed]
  );

  useEffect(() => {
    if (isInstalled || isRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      // Don't store the prompt if user recently dismissed
      if (isRecentlyDismissed()) {
        setRecentlyDismissed(true);
        return;
      }
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setInstalledFlag(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isInstalled]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstalledFlag(true);
    }

    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setRecentlyDismissed(true);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isStandalone,
    isRecentlyDismissed: recentlyDismissed,
    install,
    dismiss,
  };
}

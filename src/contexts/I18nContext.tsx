'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type Locale, isValidLocale } from '@/i18n/config';
import { toast } from 'sonner';

// Translation structure matching the namespace shape
interface Translations {
  common: Record<string, string>;
  navigation: Record<string, string>;
  status: Record<string, string>;
  dashboard: Record<string, string>;
  forms: Record<string, string>;
  messages: Record<string, string>;
  language: Record<string, string>;
  settings: Record<string, string>;
  auth: Record<string, string>;
}

// Context type - backward compatible with all existing consumers
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  isLoading: boolean;
  tCommon: (key: string) => string;
  tNav: (key: string) => string;
  tStatus: (key: string) => string;
  tDashboard: (key: string) => string;
  tForms: (key: string) => string;
  tMessages: (key: string) => string;
  tSettings: (key: string) => string;
  tAuth: (key: string) => string;
}

/**
 * Creates a Proxy that intercepts property access and delegates
 * to the next-intl translation function. This provides dictionary-like
 * access (t.navigation['key']) while using next-intl under the hood.
 */
function createNsProxy(t: (key: string, values?: Record<string, string | number>) => string): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_target, prop: string) {
      try {
        return t(prop);
      } catch {
        return prop; // Fallback: return the key name itself
      }
    },
    // Support 'key in proxy' checks
    has(_target, prop: string) {
      return true; // Always return true so lookups don't fail
    },
    // Support Object.keys() - returns empty since keys are dynamic
    ownKeys() {
      return [];
    },
    getOwnPropertyDescriptor() {
      return { configurable: true, enumerable: true };
    },
  });
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale() as Locale;

  // Get namespace translators from next-intl (powered by server-side loaded messages)
  const tCommonFn = useTranslations('common');
  const tNavFn = useTranslations('navigation');
  const tStatusFn = useTranslations('status');
  const tDashboardFn = useTranslations('dashboard');
  const tFormsFn = useTranslations('forms');
  const tMessagesFn = useTranslations('messages');
  const tLanguageFn = useTranslations('language');
  const tSettingsFn = useTranslations('settings');
  const tAuthFn = useTranslations('auth');

  // Build Proxy-based translation dictionaries from next-intl
  // These re-create when locale changes (next-intl triggers re-render)
  const translations: Translations = useMemo(() => ({
    common: createNsProxy(tCommonFn),
    navigation: createNsProxy(tNavFn),
    status: createNsProxy(tStatusFn),
    dashboard: createNsProxy(tDashboardFn),
    forms: createNsProxy(tFormsFn),
    messages: createNsProxy(tMessagesFn),
    language: createNsProxy(tLanguageFn),
    settings: createNsProxy(tSettingsFn),
    auth: createNsProxy(tAuthFn),
  }), [locale]);  

  // Set locale: save to cookie + full page reload
  const setLocale = useCallback(async (newLocale: Locale) => {
    try {
      const res = await fetch('/api/settings/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
      if (res.ok) {
        // Full reload ensures server re-reads the locale cookie
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  }, []);

  // Helper functions - delegate directly to next-intl translators
  const tCommon = useCallback((key: string) => tCommonFn(key), [tCommonFn]);
  const tNav = useCallback((key: string) => tNavFn(key), [tNavFn]);
  const tStatus = useCallback((key: string) => tStatusFn(key), [tStatusFn]);
  const tDashboard = useCallback((key: string) => tDashboardFn(key), [tDashboardFn]);
  const tForms = useCallback((key: string) => tFormsFn(key), [tFormsFn]);
  const tMessages = useCallback((key: string) => tMessagesFn(key), [tMessagesFn]);
  const tSettings = useCallback((key: string) => tSettingsFn(key), [tSettingsFn]);
  const tAuth = useCallback((key: string) => tAuthFn(key), [tAuthFn]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: translations,
    isLoading: false, // next-intl loads synchronously from server props
    tCommon,
    tNav,
    tStatus,
    tDashboard,
    tForms,
    tMessages,
    tSettings,
    tAuth,
  }), [locale, setLocale, translations, tCommon, tNav, tStatus, tDashboard, tForms, tMessages, tSettings, tAuth]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export { I18nContext };

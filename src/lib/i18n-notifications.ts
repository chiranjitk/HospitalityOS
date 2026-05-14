/**
 * i18n Notification Helper
 * Provides localized notification messages with parameter interpolation.
 */

import { isValidLocale, type Locale, defaultLocale } from '@/i18n/config';

// In-memory cache for loaded translations
const translationCache = new Map<string, Record<string, string>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  translations: Record<string, string>;
  loadedAt: number;
}

/**
 * Load translations for a specific locale from the messages files.
 * Falls back to English if locale not found.
 */
async function loadTranslations(locale: string): Promise<Record<string, string>> {
  const effectiveLocale = isValidLocale(locale) ? locale : defaultLocale;

  // Check cache
  const cached = translationCache.get(effectiveLocale);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.translations;
  }

  try {
    // Dynamic import of locale messages
    const messages = await import(`@/messages/${effectiveLocale}.json`);
    const translations = flattenObject(messages.default || messages);

    // Cache the result
    translationCache.set(effectiveLocale, {
      translations,
      loadedAt: Date.now(),
    });

    return translations;
  } catch {
    // Fallback to English
    if (effectiveLocale !== defaultLocale) {
      return loadTranslations(defaultLocale);
    }

    // Return empty if even English fails
    return {};
  }
}

/**
 * Flatten a nested object to dot-notation keys.
 * e.g. { "common": { "save": "Save" } } → { "common.save": "Save" }
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      Object.assign(result, nested);
    }
  }

  return result;
}

/**
 * Get a localized message with parameter interpolation.
 *
 * @param key - Dot-notation key (e.g., "notifications.bookingConfirmed.subject")
 * @param locale - Target locale (e.g., "en", "es", "hi")
 * @param params - Optional parameters to interpolate (e.g., { name: "John" })
 * @returns Localized string, or the key itself if not found
 *
 * @example
 * getLocalizedMessage("notifications.welcome.body", "es", { guestName: "Maria", hotelName: "Grand Hotel" })
 * // → "Bienvenido a Grand Hotel, Maria"
 */
export async function getLocalizedMessage(
  key: string,
  locale: string,
  params?: Record<string, string>
): Promise<string> {
  const translations = await loadTranslations(locale);
  let message = translations[key];

  // Try without the first segment if not found (fallback)
  if (!message) {
    const fallbackKey = key.split('.').slice(-2).join('.');
    message = translations[fallbackKey];
  }

  // If still not found, return the key itself
  if (!message) {
    return key;
  }

  // Interpolate parameters
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
    }
  }

  return message;
}

/**
 * Synchronous version of getLocalizedMessage using cached translations.
 * Returns the key if translations are not cached yet.
 */
export function getLocalizedMessageSync(
  key: string,
  locale: string,
  params?: Record<string, string>
): string {
  const effectiveLocale = isValidLocale(locale) ? locale : defaultLocale;
  const cached = translationCache.get(effectiveLocale);

  if (!cached) {
    return key; // Not loaded yet, trigger async load in the background
  }

  let message = cached.translations[key] || cached.translations[key.split('.').slice(-2).join('.')];
  if (!message) return key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
    }
  }

  return message;
}

/**
 * Preload translations for one or more locales.
 * Useful for warming the cache before rendering.
 */
export async function preloadTranslations(locales: string[]): Promise<void> {
  await Promise.all(locales.map((locale) => loadTranslations(locale)));
}

/**
 * Get all notification-related translation keys for a locale.
 */
export async function getNotificationMessages(
  locale: string
): Promise<Record<string, string>> {
  const translations = await loadTranslations(locale);
  const notificationMessages: Record<string, string> = {};

  // Extract all keys starting with "notifications." or related
  for (const [key, value] of Object.entries(translations)) {
    if (
      key.startsWith('notifications.') ||
      key.startsWith('alerts.') ||
      key.startsWith('email.') ||
      key.startsWith('sms.')
    ) {
      notificationMessages[key] = value;
    }
  }

  return notificationMessages;
}

/**
 * Clear the translation cache.
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

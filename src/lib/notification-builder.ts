/**
 * Notification Builder
 * Builds localized notification content for email, SMS, and push notifications.
 */

import { getLocalizedMessage, getLocalizedMessageSync } from './i18n-notifications';

// Notification template registry
// Maps template keys to i18n message key prefixes
const TEMPLATES: Record<string, { subjectKey: string; bodyKey: string }> = {
  // Booking notifications
  booking_confirmed: {
    subjectKey: 'notifications.booking.confirmed.subject',
    bodyKey: 'notifications.booking.confirmed.body',
  },
  booking_cancelled: {
    subjectKey: 'notifications.booking.cancelled.subject',
    bodyKey: 'notifications.booking.cancelled.body',
  },
  booking_checkin_reminder: {
    subjectKey: 'notifications.booking.checkinReminder.subject',
    bodyKey: 'notifications.booking.checkinReminder.body',
  },
  booking_checkout_reminder: {
    subjectKey: 'notifications.booking.checkoutReminder.subject',
    bodyKey: 'notifications.booking.checkoutReminder.body',
  },

  // Guest notifications
  welcome: {
    subjectKey: 'notifications.guest.welcome.subject',
    bodyKey: 'notifications.guest.welcome.body',
  },
  pre_arrival: {
    subjectKey: 'notifications.guest.preArrival.subject',
    bodyKey: 'notifications.guest.preArrival.body',
  },
  post_stay: {
    subjectKey: 'notifications.guest.postStay.subject',
    bodyKey: 'notifications.guest.postStay.body',
  },

  // Payment notifications
  payment_received: {
    subjectKey: 'notifications.payment.received.subject',
    bodyKey: 'notifications.payment.received.body',
  },
  payment_failed: {
    subjectKey: 'notifications.payment.failed.subject',
    bodyKey: 'notifications.payment.failed.body',
  },
  refund_processed: {
    subjectKey: 'notifications.payment.refund.subject',
    bodyKey: 'notifications.payment.refund.body',
  },

  // Service notifications
  service_request_created: {
    subjectKey: 'notifications.service.created.subject',
    bodyKey: 'notifications.service.created.body',
  },
  service_request_completed: {
    subjectKey: 'notifications.service.completed.subject',
    bodyKey: 'notifications.service.completed.body',
  },

  // WiFi notifications
  wifi_connected: {
    subjectKey: 'notifications.wifi.connected.subject',
    bodyKey: 'notifications.wifi.connected.body',
  },
  wifi_expiry_warning: {
    subjectKey: 'notifications.wifi.expiryWarning.subject',
    bodyKey: 'notifications.wifi.expiryWarning.body',
  },

  // Housekeeping notifications
  housekeeping_cleaning: {
    subjectKey: 'notifications.housekeeping.cleaning.subject',
    bodyKey: 'notifications.housekeeping.cleaning.body',
  },
  maintenance_alert: {
    subjectKey: 'notifications.maintenance.alert.subject',
    bodyKey: 'notifications.maintenance.alert.body',
  },

  // Inventory notifications
  low_stock_alert: {
    subjectKey: 'notifications.inventory.lowStock.subject',
    bodyKey: 'notifications.inventory.lowStock.body',
  },
  reorder_created: {
    subjectKey: 'notifications.inventory.reorder.subject',
    bodyKey: 'notifications.inventory.reorder.body',
  },

  // Security notifications
  security_alert: {
    subjectKey: 'notifications.security.alert.subject',
    bodyKey: 'notifications.security.alert.body',
  },
};

// Common data parameters used across templates
interface NotificationData {
  guestName?: string;
  hotelName?: string;
  roomNumber?: string;
  bookingCode?: string;
  checkInDate?: string;
  checkOutDate?: string;
  amount?: string;
  currency?: string;
  serviceName?: string;
  itemName?: string;
  currentStock?: string;
  reorderLevel?: string;
  [key: string]: string | undefined;
}

interface NotificationContent {
  subject: string;
  body: string;
  templateKey: string;
  locale: string;
}

/**
 * Build a localized notification from a template.
 *
 * @param templateKey - Template identifier (e.g., "booking_confirmed", "welcome")
 * @param locale - Target locale
 * @param data - Data parameters for interpolation
 * @returns Notification content with subject and body
 *
 * @example
 * const notification = await buildNotification('booking_confirmed', 'es', {
 *   guestName: 'María',
 *   hotelName: 'Grand Hotel',
 *   roomNumber: '305',
 *   bookingCode: 'BK-2024-001',
 *   checkInDate: '2024-03-15',
 *   checkOutDate: '2024-03-18',
 * });
 * // => { subject: "Reserva Confirmada", body: "Hola María...", templateKey: "booking_confirmed", locale: "es" }
 */
export async function buildNotification(
  templateKey: string,
  locale: string,
  data: NotificationData
): Promise<NotificationContent> {
  const template = TEMPLATES[templateKey];

  if (!template) {
    // Fallback: use template key as message key
    return {
      subject: await getLocalizedMessage(templateKey + '.subject', locale, data),
      body: await getLocalizedMessage(templateKey + '.body', locale, data),
      templateKey,
      locale,
    };
  }

  const [subject, body] = await Promise.all([
    getLocalizedMessage(template.subjectKey, locale, data),
    getLocalizedMessage(template.bodyKey, locale, data),
  ]);

  return { subject, body, templateKey, locale };
}

/**
 * Synchronous version of buildNotification for use in server contexts where translations are preloaded.
 */
export function buildNotificationSync(
  templateKey: string,
  locale: string,
  data: NotificationData
): NotificationContent {
  const template = TEMPLATES[templateKey];

  if (!template) {
    return {
      subject: getLocalizedMessageSync(templateKey + '.subject', locale, data),
      body: getLocalizedMessageSync(templateKey + '.body', locale, data),
      templateKey,
      locale,
    };
  }

  return {
    subject: getLocalizedMessageSync(template.subjectKey, locale, data),
    body: getLocalizedMessageSync(template.bodyKey, locale, data),
    templateKey,
    locale,
  };
}

/**
 * Build an SMS notification (truncated body, no subject).
 */
export async function buildSmsNotification(
  templateKey: string,
  locale: string,
  data: NotificationData
): Promise<string> {
  const notification = await buildNotification(templateKey, locale, data);
  // SMS typically has a 160 char limit per segment
  return notification.body.substring(0, 160);
}

/**
 * Build a push notification (short title and body).
 */
export async function buildPushNotification(
  templateKey: string,
  locale: string,
  data: NotificationData
): Promise<{ title: string; body: string }> {
  const notification = await buildNotification(templateKey, locale, data);
  return {
    title: notification.subject,
    body: notification.body.substring(0, 200), // Push body limit
  };
}

/**
 * Get list of all available template keys.
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Check if a template key is valid.
 */
export function isValidTemplate(templateKey: string): boolean {
  return templateKey in TEMPLATES;
}

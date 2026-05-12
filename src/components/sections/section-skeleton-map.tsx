'use client';

// =====================================================
// SKELETON LAYOUT TYPES
// =====================================================

export type SkeletonLayout =
  | 'dashboard'
  | 'table'
  | 'cards'
  | 'form'
  | 'wifi'
  | 'calendar'
  | 'kanban'
  | 'settings';

// =====================================================
// SECTION → SKELETON LAYOUT MAPPING
// =====================================================

export const sectionSkeletonMap: Record<string, SkeletonLayout> = {
  // Dashboard sections
  'dashboard-overview': 'dashboard',
  'dashboard-command-center': 'dashboard',
  'dashboard-alerts': 'dashboard',
  'dashboard-kpi': 'dashboard',

  // PMS sections
  'pms-rooms': 'table',
  'pms-properties': 'cards',
  'pms-rate-plans-pricing': 'cards',
  'pms-room-types': 'cards',
  'pms-inventory-calendar': 'calendar',
  'pms-availability': 'table',
  'pms-locking': 'table',
  'pms-overbooking': 'settings',
  'pms-floor-plans': 'cards',
  'room-rate-calendar': 'calendar',
  'room-out-of-order': 'table',
  'pms-package-plans': 'cards',
  'pms-room-type-change': 'table',

  // Bookings
  'bookings-calendar': 'calendar',
  'bookings-groups': 'cards',
  'bookings-waitlist': 'table',
  'bookings-conflicts': 'table',
  'bookings-no-show': 'settings',
  'bookings-audit': 'table',

  // Front Desk
  'frontdesk-checkin': 'cards',
  'frontdesk-checkout': 'cards',
  'frontdesk-walkin': 'form',
  'frontdesk-room-grid': 'kanban',
  'frontdesk-assignment': 'table',
  'registration-card': 'form',
  'express-kiosk': 'cards',
  'kiosk-settings': 'settings',
  'room-move': 'table',

  // Guests
  'guests-list': 'table',
  'guests-kyc': 'table',
  'guests-preferences': 'cards',
  'guests-history': 'table',
  'guests-loyalty': 'cards',
  'guests-profile': 'form',
  'guests-journey': 'dashboard',
  'guests-vip-alerts': 'table',

  // Housekeeping
  'housekeeping-tasks': 'kanban',
  'housekeeping-kanban': 'kanban',
  'housekeeping-status': 'table',
  'housekeeping-maintenance': 'table',
  'housekeeping-preventive': 'calendar',
  'housekeeping-assets': 'table',
  'housekeeping-inspections': 'table',
  'housekeeping-automation': 'settings',
  'housekeeping-lost-found': 'table',
  'housekeeping-minibar': 'table',
  'housekeeping-laundry': 'table',

  // Billing
  'billing-folios': 'table',
  'billing-invoices': 'table',
  'billing-payments': 'table',
  'billing-refunds': 'table',
  'billing-discounts': 'settings',
  'billing-cancellation-policies': 'settings',
  'folio-transfer': 'form',
  'payment-plans': 'cards',
  'credit-notes': 'table',
  'multi-currency': 'settings',
  'billing-night-audit': 'dashboard',
  'billing-city-ledger': 'table',
  'billing-commissions': 'table',
  'billing-posting-rules': 'settings',
  'billing-scheduled-charges': 'table',
  'billing-tax-settings': 'settings',
  'billing-gst-invoicing': 'table',
  'billing-gst-returns': 'table',
  'billing-tcs-tds': 'table',
  'billing-ap-workflow': 'settings',
  'billing-profit-loss': 'dashboard',
  'billing-cash-flow': 'dashboard',
  'billing-budget': 'dashboard',
  'billing-deposits': 'table',
  'billing-financing': 'settings',

  // WiFi
  'wifi-access': 'wifi',
  'wifi-gateway-radius': 'wifi',
  'wifi-network': 'wifi',
  'wifi-dhcp': 'wifi',
  'wifi-dns': 'wifi',
  'wifi-portal': 'wifi',
  'wifi-firewall': 'settings',
  'wifi-content-filter': 'settings',
  'wifi-diagnostics': 'dashboard',
  'wifi-reports': 'table',

  // Settings
  'settings-general': 'settings',
  'settings-tax': 'settings',
  'settings-localization': 'settings',
  'settings-features': 'settings',
  'settings-license-keys': 'settings',
  'settings-gdpr': 'settings',
  'settings-security': 'settings',
  'settings-integrations': 'settings',

  // Revenue
  'revenue-pricing': 'table',
  'revenue-forecasting': 'dashboard',
  'revenue-competitor': 'table',
  'revenue-ai': 'dashboard',
  'revenue-rate-shopping': 'table',
  'revenue-dynamic-pricing': 'table',

  // Staff
  'staff-shifts': 'table',
  'staff-attendance': 'table',
  'staff-leave': 'table',
  'staff-tasks': 'kanban',
  'staff-communication': 'table',
  'staff-performance': 'dashboard',
  'staff-skills': 'table',
  'staff-payroll': 'table',

  // CRM
  'crm-segments': 'cards',
  'crm-campaigns': 'table',
  'crm-loyalty': 'cards',
  'crm-feedback': 'table',
  'crm-retention': 'dashboard',

  // Channels
  'channel-analytics': 'dashboard',
  'channel-ota': 'table',
  'channel-inventory': 'table',
  'channel-rate': 'table',
  'channel-booking': 'table',
  'channel-booking-modifications': 'table',
  'channel-restrictions': 'settings',
  'channel-stop-sell': 'dashboard',
  'channel-allocations': 'dashboard',
  'channel-mapping': 'table',
  'channel-parity': 'dashboard',
  'channel-logs': 'table',
  'channel-health': 'dashboard',
  'channel-crs': 'table',
  'channel-gds': 'table',
  'channel-currency': 'table',
  'channel-virtual-inventory': 'dashboard',
  'channel-booking-pace': 'dashboard',
  'channel-promo-codes': 'table',
  'channel-allotment-release': 'dashboard',

  // Experience
  'experience-requests': 'table',
  'experience-inbox': 'table',
  'experience-chat': 'table',
  'experience-portal': 'cards',
  'experience-keys': 'table',
  'experience-app-controls': 'settings',
  'experiences': 'cards',
  'experience-bookings': 'table',
  'experience-pricing': 'table',
  'experience-vendors': 'table',
  'experience-revenue': 'dashboard',
  'experience-calendar': 'calendar',
  'experience-feedback': 'table',
  'experience-spa': 'table',
  'experience-golf': 'table',

  // POS
  'pos-orders': 'table',
  'pos-tables': 'kanban',
  'pos-kitchen': 'kanban',
  'pos-menu': 'table',
  'pos-billing': 'table',
  'pos-room-service': 'table',
  'pos-restaurant-reports': 'dashboard',
  'pos-recipes': 'table',
  'pos-staff-assignment': 'table',
  'pos-receipt-templates': 'form',
  'pos-inventory': 'table',
  'pos-modifiers': 'table',
  'pos-variants': 'table',
  'pos-table-layout': 'cards',
  'pos-reservations': 'calendar',
  'pos-offline': 'dashboard',
  'pos-menu-boards': 'cards',

  // Inventory
  'inventory-stock': 'table',
  'inventory-consumption': 'table',
  'inventory-alerts': 'table',
  'inventory-vendors': 'table',
  'inventory-po': 'table',
  'inventory-purchase-requisition': 'table',
  'inventory-invoice-matching': 'table',

  // Parking
  'parking-slots': 'table',
  'parking-tracking': 'table',
  'parking-billing': 'table',

  // Surveillance
  'security-cameras': 'cards',
  'security-live': 'cards',
  'security-playback': 'table',
  'security-alerts': 'table',
  'security-incidents': 'table',
  'surveillance-settings': 'settings',

  // IoT
  'iot-devices': 'table',
  'iot-controls': 'settings',
  'iot-energy': 'dashboard',

  // Events
  'events-spaces': 'cards',
  'events-calendar': 'calendar',
  'events-booking': 'table',
  'events-resources': 'table',
  'events-beo': 'table',

  // Admin
  'admin-tenants': 'table',
  'admin-lifecycle': 'table',
  'admin-roles': 'table',
  'admin-users': 'table',
  'admin-usage': 'dashboard',
  'admin-revenue': 'dashboard',
  'admin-health': 'dashboard',

  // Security Center
  'security-overview': 'dashboard',
  'security-audit-logs': 'table',
  'security-2fa': 'settings',
  'security-sessions': 'table',
  'security-sso': 'settings',

  // Integrations
  'integrations-payments': 'table',
  'integrations-sms': 'table',
  'integrations-pos': 'table',
  'integrations-apis': 'table',
  'integrations-smart-locks': 'table',
  'integrations-terminals': 'table',
  'integrations-mobile-app': 'settings',
  'integrations-hardware-adapters': 'table',

  // Automation
  'automation-workflows': 'kanban',
  'automation-rules': 'table',
  'automation-templates': 'cards',
  'automation-logs': 'table',

  // AI Assistant
  'ai-copilot': 'form',
  'ai-insights': 'dashboard',
  'ai-conversational-analytics': 'dashboard',
  'ai-settings': 'settings',

  // Marketing
  'marketing-reputation': 'dashboard',
  'marketing-sources': 'table',
  'marketing-booking-engine': 'settings',
  'marketing-promotions': 'table',
  'marketing-upsell': 'table',
  'marketing-journey-campaigns': 'kanban',
  'marketing-abandoned-bookings': 'table',

  // Digital Ads
  'ads-campaigns': 'table',
  'ads-google': 'dashboard',
  'ads-performance': 'dashboard',
  'ads-roi': 'dashboard',

  // Reports
  'reports-revenue': 'dashboard',
  'reports-occupancy': 'dashboard',
  'reports-adr': 'dashboard',
  'reports-guests': 'table',
  'reports-staff': 'table',
  'reports-scheduled': 'table',

  // Notifications
  'notifications-templates': 'table',
  'notifications-logs': 'table',
  'notifications-settings': 'settings',

  // Webhooks
  'webhooks-events': 'table',
  'webhooks-delivery': 'table',
  'webhooks-retry': 'table',

  // Resort
  'resort-timeshare': 'table',
  'resort-casino': 'dashboard',

  // Chain Management
  'chain-brands': 'table',
  'chain-dashboard': 'dashboard',
  'chain-analytics': 'dashboard',

  // SaaS Billing
  'saas-plans': 'table',
  'saas-subscriptions': 'table',
  'saas-usage': 'dashboard',

  // Help & Support
  'help-center': 'cards',
  'help-articles': 'table',
  'help-tutorials': 'cards',
};

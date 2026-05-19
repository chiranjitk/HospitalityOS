// Feature Flags Configuration for StaySuite HospitalityOS
// This file defines all features, their menu mappings, and plan defaults
//
// CATEGORIES:
// - base: Core functionality (always enabled, required for hotel operations)
// - addons: Optional features (can be toggled on/off via Feature Flags settings)

export interface FeatureConfig {
  id: string;
  name: string;
  description: string;
  category: 'base' | 'addons';
  subcategory?: string; // For grouping addons
  icon?: string;
  menuItems: string[]; // Navigation items this feature controls
  apiRoutes: string[]; // API routes this feature protects
  dependencies?: string[]; // Other features required for this to work
  alwaysEnabled?: boolean; // For base modules that cannot be disabled
}

// =====================================================
// FEATURE DEFINITIONS
// =====================================================

export const FEATURES: Record<string, FeatureConfig> = {
  // =====================================================
  // BASE MODULES (Always Enabled - Core Operations)
  // =====================================================
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main dashboard with KPIs, command center, and alerts overview',
    category: 'base',
    alwaysEnabled: true,
    menuItems: ['dashboard-overview', 'dashboard-command-center', 'dashboard-alerts', 'dashboard-kpi'],
    apiRoutes: ['/api/dashboard'],
  },
  pms: {
    id: 'pms',
    name: 'Property Management',
    description: 'Properties, rooms, room types, inventory calendar, rate plans, pricing, floor plans, and package management',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'pms-properties', 'pms-room-types', 'pms-rooms', 'pms-inventory-calendar',
      'pms-availability', 'pms-locking', 'pms-rate-plans-pricing', 'pms-overbooking', 'pms-floor-plans',
      'room-rate-calendar', 'room-out-of-order', 'pms-package-plans', 'pms-room-type-change',
    ],
    apiRoutes: ['/api/properties', '/api/rooms', '/api/room-types', '/api/inventory-locks', '/api/rate-plans', '/api/price-overrides'],
  },
  bookings: {
    id: 'bookings',
    name: 'Bookings Management',
    description: 'Booking calendar, list, groups, waitlist, conflicts, no-show automation, and audit logs',
    category: 'base',
    alwaysEnabled: true,
    menuItems: ['bookings-calendar', 'bookings-groups', 'bookings-waitlist', 'bookings-conflicts', 'bookings-no-show', 'bookings-audit'],
    apiRoutes: ['/api/bookings', '/api/group-bookings', '/api/waitlist'],
  },
  frontdesk: {
    id: 'frontdesk',
    name: 'Front Desk Operations',
    description: 'Check-in, check-out, walk-ins, room grid, room assignment, registration card, express kiosk, and room move',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'frontdesk-checkin', 'frontdesk-checkout', 'frontdesk-walkin', 'frontdesk-room-grid', 'frontdesk-assignment',
      'registration-card', 'express-kiosk', 'kiosk-settings', 'room-move',
    ],
    apiRoutes: ['/api/check-in', '/api/check-out', '/api/walk-in'],
  },
  guests: {
    id: 'guests',
    name: 'Guest Management',
    description: 'Guest profiles, KYC documents, preferences, stay history, loyalty points, journey map, and VIP recognition',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'guests-list', 'guests-kyc', 'guests-preferences', 'guests-history', 'guests-loyalty',
      'guests-profile', 'guests-journey', 'guests-vip-alerts',
    ],
    apiRoutes: ['/api/guests', '/api/guest-preferences', '/api/kyc'],
  },
  housekeeping: {
    id: 'housekeeping',
    name: 'Housekeeping',
    description: 'Tasks, kanban board, room status, maintenance requests, asset management, inspections, automation, lost & found, minibar, and laundry',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'housekeeping-tasks', 'housekeeping-kanban', 'housekeeping-status', 'housekeeping-maintenance',
      'housekeeping-preventive', 'housekeeping-assets', 'housekeeping-inspections', 'housekeeping-automation',
      'housekeeping-lost-found', 'housekeeping-minibar', 'housekeeping-laundry',
    ],
    apiRoutes: ['/api/tasks', '/api/assets', '/api/preventive-maintenance'],
  },
  billing: {
    id: 'billing',
    name: 'Billing & Invoicing',
    description: 'Folios, invoices, payments, refunds, discounts, night audit, city ledger, GST, cash flow, budget, and more',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'billing-folios', 'billing-invoices', 'billing-payments', 'billing-refunds', 'billing-discounts',
      'billing-cancellation-policies', 'folio-transfer', 'payment-plans', 'credit-notes', 'multi-currency',
      'billing-night-audit', 'billing-city-ledger', 'billing-commissions', 'billing-posting-rules',
      'billing-scheduled-charges', 'billing-tax-settings', 'billing-gst-invoicing', 'billing-gst-returns',
      'billing-tcs-tds', 'billing-ap-workflow', 'billing-profit-loss', 'billing-cash-flow',
      'billing-budget', 'billing-deposits', 'billing-financing', 'billing-cash-book',
    ],
    apiRoutes: ['/api/folios', '/api/payments', '/api/invoices', '/api/refunds', '/api/discounts'],
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    description: 'General settings, tax & currency, localization, feature flags, GDPR, security, license keys, and system integrations',
    category: 'base',
    alwaysEnabled: true,
    menuItems: [
      'settings-general', 'settings-tax', 'settings-localization', 'settings-features', 'settings-gdpr',
      'settings-license', 'settings-license-keys', 'settings-security', 'settings-integrations',
    ],
    apiRoutes: ['/api/settings'],
  },
  help: {
    id: 'help',
    name: 'Help & Support',
    description: 'Help center, articles, and tutorial progress',
    category: 'base',
    alwaysEnabled: true,
    menuItems: ['help-center', 'help-articles', 'help-tutorials'],
    apiRoutes: ['/api/help'],
  },

  // =====================================================
  // ADDON MODULES - Guest Experience
  // =====================================================
  guest_experience: {
    id: 'guest_experience',
    name: 'Guest Experience',
    description: 'Service requests, unified inbox, guest chat, in-room portal, digital keys, experience catalog, spa, golf, and more',
    category: 'addons',
    subcategory: 'Guest Experience',
    menuItems: [
      'experience-requests', 'experience-inbox', 'experience-chat', 'experience-portal',
      'experience-keys', 'experience-app-controls', 'experiences', 'experience-bookings',
      'experience-pricing', 'experience-vendors', 'experience-revenue', 'experience-calendar',
      'experience-feedback', 'experience-spa', 'experience-golf',
    ],
    apiRoutes: ['/api/service-requests', '/api/chat-conversations', '/api/digital-keys', '/api/inbox'],
  },
  pos: {
    id: 'pos',
    name: 'Restaurant & POS',
    description: 'Orders, tables, kitchen display system (KDS), menu management, room service, recipes, table layout, reservations, and POS billing',
    category: 'addons',
    subcategory: 'Guest Experience',
    menuItems: [
      'pos-orders', 'pos-tables', 'pos-kitchen', 'pos-menu', 'pos-billing',
      'pos-room-service', 'pos-restaurant-reports', 'pos-recipes', 'pos-staff-assignment',
      'pos-receipt-templates', 'pos-inventory', 'pos-modifiers', 'pos-variants',
      'pos-table-layout', 'pos-reservations', 'pos-offline', 'pos-menu-boards',
    ],
    apiRoutes: ['/api/orders', '/api/tables', '/api/menu-items', '/api/menu-categories', '/api/kds'],
  },

  // =====================================================
  // ADDON MODULES - Facility Management
  // =====================================================
  inventory: {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Stock items, consumption logs, low stock alerts, vendors, purchase orders, requisitions, and invoice matching',
    category: 'addons',
    subcategory: 'Facility Management',
    menuItems: [
      'inventory-stock', 'inventory-consumption', 'inventory-alerts', 'inventory-vendors',
      'inventory-po', 'inventory-purchase-requisition', 'inventory-invoice-matching',
    ],
    apiRoutes: ['/api/inventory', '/api/inventory/stock', '/api/inventory/consumption', '/api/inventory/vendors', '/api/inventory/purchase-orders'],
  },
  parking: {
    id: 'parking',
    name: 'Parking Management',
    description: 'Parking slots, vehicle tracking, guest mapping, and parking billing',
    category: 'addons',
    subcategory: 'Facility Management',
    menuItems: ['parking-slots', 'parking-tracking', 'parking-billing'],
    apiRoutes: ['/api/parking', '/api/vehicles'],
  },
  surveillance: {
    id: 'surveillance',
    name: 'Surveillance',
    description: 'Camera management, live camera view, playback, event alerts, incident logs, and surveillance settings',
    category: 'addons',
    subcategory: 'Facility Management',
    menuItems: ['security-cameras', 'security-live', 'security-playback', 'security-alerts', 'security-incidents', 'surveillance-settings'],
    apiRoutes: ['/api/security/cameras', '/api/security/incidents'],
  },
  iot: {
    id: 'iot',
    name: 'Smart Hotel / IoT',
    description: 'Device management, room controls, and energy dashboard',
    category: 'addons',
    subcategory: 'Facility Management',
    menuItems: ['iot-devices', 'iot-controls', 'iot-energy'],
    apiRoutes: ['/api/iot/devices', '/api/iot/controls', '/api/iot/energy'],
  },

  // =====================================================
  // ADDON MODULES - Connectivity
  // =====================================================
  wifi: {
    id: 'wifi',
    name: 'WiFi & Network',
    description: 'WiFi access, RADIUS & gateway, network management, DHCP, DNS, captive portal, firewall, content filter, diagnostics, health alerts, pre-arrival, device management, identity verification, GDPR consent, bandwidth upsell, revenue analytics, surveys, and SLA monitoring',
    category: 'addons',
    subcategory: 'Connectivity',
    menuItems: [
      'wifi-access', 'wifi-gateway-radius', 'wifi-network', 'wifi-dhcp', 'wifi-dns',
      'wifi-portal', 'wifi-firewall', 'wifi-content-filter', 'wifi-diagnostics', 'wifi-reports',
      'wifi-health-alerts', 'wifi-pre-arrival', 'wifi-device-management', 'wifi-identity-verification',
      'wifi-consent-management', 'wifi-bandwidth-upsell', 'wifi-revenue-dashboard',
      'wifi-satisfaction-surveys', 'wifi-sla-monitoring',
    ],
    apiRoutes: ['/api/wifi', '/api/wifi/sessions', '/api/wifi/vouchers'],
  },
  room_vlan_isolation: {
    id: 'room_vlan_isolation',
    name: 'Room-per-VLAN Isolation',
    description: 'Dedicated VLAN per hotel room for Layer 2 isolation, per-room bandwidth, auto firewall rules, and PMS-driven provisioning',
    category: 'addons',
    subcategory: 'Connectivity',
    menuItems: [],
    apiRoutes: ['/api/wifi/network/room-vlans'],
    dependencies: ['wifi'],
  },
  ztna: {
    id: 'ztna',
    name: 'Zero Trust Network Access',
    description: 'Per-device trust tiers, automatic firewall policy enforcement, device groups, guest zone isolation, and ZTNA audit logging',
    category: 'addons',
    subcategory: 'Connectivity',
    menuItems: [],
    apiRoutes: ['/api/wifi/firewall/device-policies', '/api/wifi/firewall/device-groups'],
    dependencies: ['wifi'],
  },

  // =====================================================
  // ADDON MODULES - Revenue & Channels
  // =====================================================
  revenue_management: {
    id: 'revenue_management',
    name: 'Revenue Management',
    description: 'Dynamic pricing rules, demand forecasting, competitor pricing, rate shopping, and AI suggestions',
    category: 'addons',
    subcategory: 'Revenue & Channels',
    menuItems: [
      'revenue-pricing', 'revenue-forecasting', 'revenue-competitor', 'revenue-ai', 'revenue-rate-shopping',
      'revenue-hourly-pricing', 'revenue-linear-pricing', 'revenue-auto-overbooking', 'revenue-last-minute', 'revenue-automation',
    ],
    apiRoutes: ['/api/revenue', '/api/revenue/pricing', '/api/revenue/forecasting'],
  },
  channel_manager: {
    id: 'channel_manager',
    name: 'Channel Manager',
    description: 'OTA connections, inventory sync, rate sync, booking sync, restrictions, mapping, logs, CRS, GDS, rate derivation, parity, and more',
    category: 'addons',
    subcategory: 'Revenue & Channels',
    menuItems: [
      'channel-analytics', 'channel-ota', 'channel-inventory', 'channel-rate', 'channel-booking',
      'channel-booking-modifications', 'channel-restrictions', 'channel-stop-sell', 'channel-allocations',
      'channel-mapping', 'channel-parity', 'channel-logs', 'channel-health', 'channel-crs', 'channel-gds',
      'channel-rate-derivation', 'channel-rate-overrides', 'channel-content-sync', 'channel-tax-mapping',
      'channel-meal-plan', 'channel-virtual-inventory', 'channel-currency',
      // channel-cancellation-policy removed — duplicate of billing-cancellation-policies (same DB model)
      'channel-settlement', 'channel-allotment-release', 'channel-promo-codes', 'channel-booking-pace',
      'channel-priority', 'channel-inventory-pool', 'channel-derived-rates', 'channel-commission-config',
      'channel-guest-rates', 'channel-booking-limits', 'channel-messages',
    ],
    apiRoutes: ['/api/channels', '/api/channels/sync', '/api/crs'],
  },

  // =====================================================
  // ADDON MODULES - Marketing & CRM
  // =====================================================
  crm: {
    id: 'crm',
    name: 'CRM & Marketing',
    description: 'Guest segments, campaigns, loyalty programs, feedback & reviews, and retention analytics',
    category: 'addons',
    subcategory: 'Marketing & CRM',
    menuItems: ['crm-segments', 'crm-campaigns', 'crm-loyalty', 'crm-feedback', 'crm-retention', 'crm-lead-pipeline'],
    apiRoutes: ['/api/campaigns', '/api/segments', '/api/crm', '/api/loyalty'],
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    description: 'Reputation dashboard, review sources, direct booking engine, promotions, upsell engine, journey campaigns, and abandoned bookings recovery',
    category: 'addons',
    subcategory: 'Marketing & CRM',
    menuItems: [
      'marketing-reputation', 'marketing-sources', 'marketing-booking-engine', 'marketing-promotions',
      'marketing-upsell', 'marketing-journey-campaigns', 'marketing-abandoned-bookings', 'marketing-website-builder',
    ],
    apiRoutes: ['/api/marketing', '/api/reputation', '/api/booking-engine'],
  },

  // =====================================================
  // ADDON MODULES - Digital Advertising
  // =====================================================
  ads: {
    id: 'ads',
    name: 'Digital Advertising',
    description: 'Ad campaigns, Google Hotel Ads, performance tracking, and ROI analytics',
    category: 'addons',
    subcategory: 'Marketing & CRM',
    menuItems: ['ads-campaigns', 'ads-google', 'ads-performance', 'ads-roi'],
    apiRoutes: ['/api/ads'],
  },

  // =====================================================
  // ADDON MODULES - Analytics
  // =====================================================
  reports: {
    id: 'reports',
    name: 'Reports & BI',
    description: 'Revenue reports, occupancy reports, ADR/RevPAR, guest analytics, staff performance, and scheduled reports',
    category: 'addons',
    subcategory: 'Analytics',
    menuItems: ['reports-revenue', 'reports-occupancy', 'reports-adr', 'reports-guests', 'reports-guest-stay', 'reports-staff', 'reports-scheduled'],
    apiRoutes: ['/api/reports', '/api/analytics'],
  },

  // =====================================================
  // ADDON MODULES - Events
  // =====================================================
  events: {
    id: 'events',
    name: 'Events / MICE',
    description: 'Event spaces, event calendar, event bookings, event resources, and BEO management',
    category: 'addons',
    subcategory: 'Events',
    menuItems: ['events-spaces', 'events-calendar', 'events-booking', 'events-resources', 'events-beo'],
    apiRoutes: ['/api/events', '/api/event-spaces'],
  },

  // =====================================================
  // ADDON MODULES - Resort & Leisure
  // =====================================================
  resort: {
    id: 'resort',
    name: 'Resort & Leisure',
    description: 'Timeshare & ownership management, and casino & gaming operations',
    category: 'addons',
    subcategory: 'Resort & Leisure',
    menuItems: ['resort-timeshare', 'resort-casino'],
    apiRoutes: ['/api/resort'],
  },

  // =====================================================
  // ADDON MODULES - Staff Management
  // =====================================================
  staff_management: {
    id: 'staff_management',
    name: 'Staff Management',
    description: 'Shift scheduling, attendance tracking, leave management, task assignment, internal communication, performance metrics, skills, and payroll',
    category: 'addons',
    subcategory: 'Staff Management',
    menuItems: [
      'staff-shifts', 'staff-attendance', 'staff-leave', 'staff-tasks',
      'staff-communication', 'staff-performance', 'staff-skills', 'staff-payroll',
    ],
    apiRoutes: ['/api/staff', '/api/shifts', '/api/attendance'],
  },

  // =====================================================
  // ADDON MODULES - Security
  // =====================================================
  security_center: {
    id: 'security_center',
    name: 'Security Center',
    description: 'Security overview, two-factor auth, device sessions, and SSO configuration',
    category: 'addons',
    subcategory: 'Security',
    menuItems: ['security-overview', 'security-audit-logs', 'security-2fa', 'security-sessions', 'security-sso'],
    apiRoutes: ['/api/security', '/api/2fa', '/api/sso'],
  },

  // =====================================================
  // ADDON MODULES - Integrations & Automation
  // =====================================================
  integrations: {
    id: 'integrations',
    name: 'Third-party Integrations',
    description: 'Payment gateways, SMS gateways, POS systems, smart locks, payment terminals, mobile app, hardware adapters, and third-party APIs',
    category: 'addons',
    subcategory: 'Integrations & Automation',
    menuItems: [
      'integrations-payments', 'integrations-sms', 'integrations-pos', 'integrations-apis',
      'integrations-smart-locks', 'integrations-terminals', 'integrations-mobile-app', 'integrations-hardware-adapters',
    ],
    apiRoutes: ['/api/integrations'],
  },
  automation: {
    id: 'automation',
    name: 'Automation & Workflows',
    description: 'Workflow builder, rules engine, templates, and execution logs',
    category: 'addons',
    subcategory: 'Integrations & Automation',
    menuItems: ['automation-workflows', 'automation-rules', 'automation-templates', 'automation-logs'],
    apiRoutes: ['/api/automation', '/api/workflows'],
  },
  ai_features: {
    id: 'ai_features',
    name: 'AI Assistant',
    description: 'AI Copilot, AI insights, conversational analytics, and provider settings',
    category: 'addons',
    subcategory: 'Integrations & Automation',
    menuItems: ['ai-copilot', 'ai-insights', 'ai-conversational-analytics', 'ai-settings'],
    apiRoutes: ['/api/ai'],
  },

  // =====================================================
  // ADDON MODULES - Enterprise
  // =====================================================
  admin: {
    id: 'admin',
    name: 'Admin Panel',
    description: 'Tenant management, tenant lifecycle, user management, usage tracking, revenue analytics, and system health',
    category: 'addons',
    subcategory: 'Enterprise',
    menuItems: ['admin-tenants', 'admin-lifecycle', 'admin-roles', 'admin-users', 'admin-usage', 'admin-revenue', 'admin-health'],
    apiRoutes: ['/api/admin'],
  },
  chain_management: {
    id: 'chain_management',
    name: 'Chain Management',
    description: 'Brand management, chain dashboard, and cross-property analytics',
    category: 'addons',
    subcategory: 'Enterprise',
    menuItems: ['chain-brands', 'chain-dashboard', 'chain-analytics'],
    apiRoutes: ['/api/chain', '/api/brands'],
  },
  saas_billing: {
    id: 'saas_billing',
    name: 'SaaS Billing',
    description: 'Subscription plans, subscriptions, and usage billing',
    category: 'addons',
    subcategory: 'Enterprise',
    menuItems: ['saas-plans', 'saas-subscriptions', 'saas-usage'],
    apiRoutes: ['/api/saas/billing', '/api/subscriptions'],
  },

  // =====================================================
  // ADDON MODULES - System
  // =====================================================
  notifications: {
    id: 'notifications',
    name: 'Notifications',
    description: 'Templates, delivery logs, and channel settings',
    category: 'addons',
    subcategory: 'System',
    menuItems: ['notifications-templates', 'notifications-logs', 'notifications-settings'],
    apiRoutes: ['/api/notifications'],
  },
  webhooks: {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Event logs, delivery logs, and retry queue',
    category: 'addons',
    subcategory: 'System',
    menuItems: ['webhooks-events', 'webhooks-delivery', 'webhooks-retry'],
    apiRoutes: ['/api/webhooks'],
  },
};

// =====================================================
// PLAN DEFAULTS - Features enabled by default for each plan
// =====================================================

export const PLAN_FEATURES: Record<string, string[]> = {
  trial: [
    // Base modules only (always enabled)
    'dashboard', 'pms', 'bookings', 'guests', 'frontdesk', 'billing', 'housekeeping', 'settings', 'help',
  ],
  starter: [
    // Base + Basic addons
    'dashboard', 'pms', 'bookings', 'guests', 'frontdesk', 'billing', 'housekeeping', 'settings', 'help',
    'inventory', 'reports', 'notifications',
  ],
  professional: [
    // Base + Most addons
    'dashboard', 'pms', 'bookings', 'guests', 'frontdesk', 'billing', 'housekeeping', 'settings', 'help',
    'inventory', 'reports', 'notifications',
    'guest_experience', 'pos', 'parking', 'wifi',
    'channel_manager', 'crm', 'marketing',
    'staff_management', 'integrations', 'webhooks',
  ],
  enterprise: [
    // Everything enabled
    'dashboard', 'pms', 'bookings', 'guests', 'frontdesk', 'billing', 'housekeeping', 'settings', 'help',
    'inventory', 'reports', 'notifications',
    'guest_experience', 'pos', 'parking', 'surveillance', 'iot', 'wifi',
    'revenue_management', 'channel_manager', 'crm', 'marketing', 'ads',
    'events', 'resort', 'staff_management', 'security_center',
    'integrations', 'automation', 'ai_features',
    'admin', 'chain_management', 'saas_billing', 'webhooks',
  ],
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Get all menu items controlled by a feature
export function getMenuItemsForFeature(featureId: string): string[] {
  return FEATURES[featureId]?.menuItems || [];
}

// Get all API routes for a feature
export function getApiRoutesForFeature(featureId: string): string[] {
  return FEATURES[featureId]?.apiRoutes || [];
}

// Find which feature controls a menu item
export function getFeatureForMenuItem(menuItem: string): string | null {
  for (const [featureId, config] of Object.entries(FEATURES)) {
    if (config.menuItems.includes(menuItem)) {
      return featureId;
    }
  }
  return null;
}

// Get all menu items that should be hidden based on disabled features
export function getDisabledMenuItems(enabledFeatures: string[]): string[] {
  const disabledItems: string[] = [];
  
  for (const [featureId, config] of Object.entries(FEATURES)) {
    if (!enabledFeatures.includes(featureId)) {
      disabledItems.push(...config.menuItems);
    }
  }
  
  return disabledItems;
}

// Check if a feature is enabled
export function isFeatureEnabled(featureId: string, enabledFeatures: string[]): boolean {
  return enabledFeatures.includes(featureId);
}

// Check if a menu item should be visible
export function isMenuItemVisible(menuItem: string, enabledFeatures: string[]): boolean {
  const featureId = getFeatureForMenuItem(menuItem);
  if (!featureId) return true; // If no feature controls it, show by default
  return enabledFeatures.includes(featureId);
}

// Get default features for a plan
export function getDefaultFeaturesForPlan(plan: string): string[] {
  return PLAN_FEATURES[plan] || PLAN_FEATURES.trial;
}

// Get all base features (always enabled)
export function getBaseFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([, config]) => config.alwaysEnabled)
    .map(([id]) => id);
}

// Get all addon features (toggleable)
export function getAddonFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([, config]) => !config.alwaysEnabled)
    .map(([id]) => id);
}

// Get features grouped by category
export function getFeaturesByCategory(): Record<string, FeatureConfig[]> {
  const grouped: Record<string, FeatureConfig[]> = {
    base: [],
    addons: [],
  };
  
  for (const config of Object.values(FEATURES)) {
    grouped[config.category].push(config);
  }
  
  return grouped;
}

// Get features grouped by subcategory (for addons)
export function getAddonsBySubcategory(): Record<string, FeatureConfig[]> {
  const grouped: Record<string, FeatureConfig[]> = {};
  
  for (const config of Object.values(FEATURES)) {
    if (config.category === 'addons') {
      const subcategory = config.subcategory || 'Other';
      if (!grouped[subcategory]) {
        grouped[subcategory] = [];
      }
      grouped[subcategory].push(config);
    }
  }
  
  return grouped;
}

// Feature categories with display info
export const FEATURE_CATEGORIES = {
  base: { 
    name: 'Base Modules', 
    description: 'Core functionality - always enabled, required for hotel operations', 
    color: 'emerald',
    locked: true, // Cannot be disabled
  },
  addons: { 
    name: 'Addon Modules', 
    description: 'Optional features that can be enabled or disabled based on your plan', 
    color: 'violet',
    locked: false,
  },
};

// Addon subcategories with display info
export const ADDON_SUBCATEGORIES = {
  'Guest Experience': { name: 'Guest Experience', description: 'Enhance guest interactions', icon: 'sparkles' },
  'Facility Management': { name: 'Facility Management', description: 'Manage physical assets and facilities', icon: 'building' },
  'Connectivity': { name: 'Connectivity', description: 'Network and connectivity services', icon: 'wifi' },
  'Revenue & Channels': { name: 'Revenue & Channels', description: 'Revenue optimization and channel management', icon: 'trending-up' },
  'Marketing & CRM': { name: 'Marketing & CRM', description: 'Customer relationship, marketing, and advertising', icon: 'megaphone' },
  'Analytics': { name: 'Analytics', description: 'Reporting and business intelligence', icon: 'bar-chart' },
  'Events': { name: 'Events', description: 'Event and MICE management', icon: 'calendar' },
  'Resort & Leisure': { name: 'Resort & Leisure', description: 'Resort and leisure operations', icon: 'building' },
  'Staff Management': { name: 'Staff Management', description: 'Employee and shift management', icon: 'users' },
  'Security': { name: 'Security', description: 'Security and access control', icon: 'shield' },
  'Integrations & Automation': { name: 'Integrations & Automation', description: 'Third-party integrations and automation', icon: 'plug' },
  'Enterprise': { name: 'Enterprise', description: 'Enterprise-level features', icon: 'crown' },
  'System': { name: 'System', description: 'System configuration and webhooks', icon: 'settings' },
};

/**
 * Check if a feature is a base (always-enabled) feature.
 * Used for server-side protection to prevent disabling base features.
 */
export function isBaseFeature(featureId: string): boolean {
  return FEATURES[featureId]?.alwaysEnabled === true;
}

/**
 * Get the feature IDs that depend on a given feature.
 * Used for cascading dependency checks.
 */
export function getDependentFeatures(featureId: string): string[] {
  const dependents: string[] = [];
  for (const [id, config] of Object.entries(FEATURES)) {
    if (config.dependencies?.includes(featureId)) {
      dependents.push(id);
    }
  }
  return dependents;
}

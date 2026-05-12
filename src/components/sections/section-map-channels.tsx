const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'channel-ota': () => import('@/components/channels/ota-connections'),
  'channel-inventory': () => import('@/components/channels/inventory-sync'),
  'channel-rate': () => import('@/components/channels/rate-sync'),
  'channel-booking': () => import('@/components/channels/booking-sync'),
  'channel-restrictions': () => import('@/components/channels/restrictions'),
  'channel-mapping': () => import('@/components/channels/mapping'),
  'channel-logs': () => import('@/components/channels/sync-logs'),
  'channel-crs': () => import('@/components/channels/crs'),
  'channel-gds': () => import('@/components/channels/gds-connectivity'),
  'channel-rate-derivation': () => import('@/components/channels/rate-derivation'),
  'channel-content-sync': () => import('@/components/channels/content-sync'),
  'channel-tax-mapping': () => import('@/components/channels/tax-mapping'),
  'channel-meal-plan': () => import('@/components/channels/meal-plan-mapping'),
  'channel-virtual-inventory': () => import('@/components/channels/virtual-inventory'),
  'channel-cancellation-policy': () => import('@/components/channels/cancellation-policy'),
  'channel-promo-codes': () => import('@/components/channels/promo-codes'),
  'channel-currency': () => import('@/components/channels/currency-config'),
  'channel-inventory-pool': () => import('@/components/channels/inventory-pool'),
  'channel-priority': () => import('@/components/channels/channel-priority'),
  'channel-settlement': () => import('@/components/channels/settlement'),
};

export const channelsMap = sectionMap;

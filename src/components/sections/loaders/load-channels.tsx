// Category loader: Channels
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'channel':
    case 'channel-analytics':
      return import('@/components/channels/channel-analytics');
    case 'channel-ota':
    case 'channel-connections':
      return import('@/components/channels/ota-connections');
    case 'channel-inventory':
      return import('@/components/channels/inventory-sync');
    case 'channel-rate':
      return import('@/components/channels/rate-sync');
    case 'channel-booking':
      return import('@/components/channels/booking-sync');
    case 'channel-booking-modifications':
      return import('@/components/channels/booking-modifications');
    case 'channel-restrictions':
      return import('@/components/channels/restrictions');
    case 'channel-stop-sell':
      return import('@/components/channels/stop-sell');
    case 'channel-allocations':
      return import('@/components/channels/allocations');
    case 'channel-mapping':
      return import('@/components/channels/mapping');
    case 'channel-parity':
      return import('@/components/channels/rate-parity');
    case 'channel-logs':
      return import('@/components/channels/sync-logs');
    case 'channel-health':
      return import('@/components/channels/channel-health');
    case 'channel-crs':
      return import('@/components/channels/crs');
    case 'channel-gds':
      return import('@/components/channels/gds-connectivity');
    case 'channel-rate-derivation':
      return import('@/components/channels/rate-derivation');
    case 'channel-content-sync':
      return import('@/components/channels/content-sync');
    case 'channel-meal-plan':
      return import('@/components/channels/meal-plan-mapping');
    case 'channel-tax-mapping':
      return import('@/components/channels/tax-mapping');
    case 'channel-currency':
      return import('@/components/channels/currency-config');
    case 'channel-virtual-inventory':
      return import('@/components/channels/virtual-inventory');
    case 'channel-promo-codes':
      return import('@/components/channels/promo-codes');
    case 'channel-booking-pace':
      return import('@/components/channels/booking-pace');
    case 'channel-inventory-pool':
      return import('@/components/channels/inventory-pool');
    case 'channel-derived-rates':
      return import('@/components/channels/derived-rate-plans');
    case 'channel-priority':
      return import('@/components/channels/channel-priority');
    case 'channel-settlement':
      return import('@/components/channels/settlement');
    case 'channel-commission-config':
      return import('@/components/channels/commission-config');
    case 'channel-booking-limits':
      return import('@/components/channels/booking-limits');
    case 'channel-guest-rates':
      return import('@/components/channels/guest-rates');
    case 'channel-allotment-release':
      return import('@/components/channels/allotment-release');
    case 'channel-rate-overrides':
      return import('@/components/channels/rate-overrides');
    case 'channel-messages':
      return import('@/components/channels/ota-messages');
    case 'channel-directory':
      return import('@/components/channels/channel-directory');
    default:
      throw new Error(`Unknown channel section: ${section}`);
  }
}

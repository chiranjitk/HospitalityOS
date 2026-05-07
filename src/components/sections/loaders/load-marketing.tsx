// Category loader: Marketing
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'marketing-reputation':
      return import('@/components/marketing/reputation-dashboard');
    case 'marketing-reviews':
    case 'marketing-sources':
      return import('@/components/marketing/review-sources');
    case 'marketing-promotions':
      return import('@/components/marketing/promotions');
    case 'marketing-campaigns':
      return import('@/components/crm/campaigns');
    case 'marketing-booking-engine':
      return import('@/components/marketing/direct-booking-engine');
    case 'marketing-upsell':
      return import('@/components/marketing/upsell-engine');
    case 'marketing-conversion':
    case 'marketing-conversion-engine':
      return import('@/components/marketing/conversion-engine');
    default:
      throw new Error(`Unknown marketing section: ${section}`);
  }
}

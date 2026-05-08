const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'marketing-reputation': () => import('@/components/marketing/reputation-dashboard'),
  'marketing-reviews': () => import('@/components/marketing/review-sources'),
  'marketing-sources': () => import('@/components/marketing/review-sources'),
  'marketing-promotions': () => import('@/components/marketing/promotions'),
  'marketing-booking-engine': () => import('@/components/marketing/direct-booking-engine'),
  'marketing-upsell': () => import('@/components/marketing/upsell-engine'),
  'marketing-conversion': () => import('@/components/marketing/conversion-engine'),
  'marketing-conversion-engine': () => import('@/components/marketing/conversion-engine'),
  'marketing-journey-campaigns': () => import('@/components/marketing/journey-campaigns'),
  'marketing-abandoned-bookings': () => import('@/components/marketing/abandoned-bookings'),
};

export const marketingMap = sectionMap;

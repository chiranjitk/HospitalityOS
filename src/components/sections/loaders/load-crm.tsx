// Category loader: CRM
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'crm':
    case 'crm-segments':
      return import('@/components/crm/guest-segments');
    case 'crm-campaigns':
      return import('@/components/crm/campaigns');
    case 'crm-loyalty':
      return import('@/components/crm/loyalty-programs');
    case 'crm-feedback':
      return import('@/components/crm/feedback-reviews');
    case 'crm-retention':
      return import('@/components/crm/retention-analytics');
    case 'crm-journey':
    case 'crm-journey-automation':
      return import('@/components/crm/journey-automation');
    default:
      throw new Error(`Unknown crm section: ${section}`);
  }
}

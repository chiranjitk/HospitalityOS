// Category loader: Guests
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'guests-list':
      return import('@/components/guests/guests-list');
    case 'guests-kyc':
      return import('@/components/guests/kyc-management');
    case 'guests-preferences':
      return import('@/components/guests/preferences-management');
    case 'guests-stay-history':
    case 'guests-history':
      return import('@/components/guests/stay-history-management');
    case 'guests-loyalty':
      return import('@/components/guests/loyalty-management');
    case 'guests-profile':
      return import('@/components/guests/guest-profile').then(m => ({ default: m.GuestProfile }));
    case 'guests-merge':
    case 'guest-merge':
      return import('@/components/guests/guest-merge');
    case 'guests-vip':
    case 'guests-vip-recognition':
    case 'guests-vip-alerts':
      return import('@/components/guests/vip-recognition');
    default:
      throw new Error(`Unknown guests section: ${section}`);
  }
}

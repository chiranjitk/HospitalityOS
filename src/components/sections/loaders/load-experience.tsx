// Category loader: Experience
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'experience':
    case 'experience-requests':
      return import('@/components/experience/service-requests');
    case 'experience-inbox':
      return import('@/components/communication/unified-inbox');
    case 'experience-chat':
      return import('@/components/experience/guest-chat');
    case 'experience-keys':
      return import('@/components/experience/digital-keys');
    case 'experience-portal':
      return import('@/components/experience/in-room-portal');
    case 'experience-app':
    case 'experience-app-controls':
      return import('@/components/experience/guest-app-controls');
    case 'experiences':
      return import('@/components/experience/experience-catalog');
    case 'experience-bookings':
      return import('@/components/experience/experience-bookings');
    case 'experience-pricing':
      return import('@/components/experience/experience-pricing');
    case 'experience-vendors':
      return import('@/components/experience/experience-vendors');
    case 'experience-spa':
      return import('@/components/experience/spa-wellness');
    case 'experience-golf':
      return import('@/components/experience/golf-course');
    case 'experience-revenue':
      return import('@/components/experience/experience-revenue');
    case 'experience-calendar':
      return import('@/components/experience/experience-calendar');
    case 'experience-feedback':
      return import('@/components/experience/experience-feedback');
    case 'experience-hub':
    case 'experience-guest-hub':
      return import('@/components/experience/guest-hub');
    default:
      throw new Error(`Unknown experience section: ${section}`);
  }
}

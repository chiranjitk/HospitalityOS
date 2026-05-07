// Category loader: Events
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'events-spaces':
      return import('@/components/events/event-spaces');
    case 'events-calendar':
      return import('@/components/events/event-calendar');
    case 'events-booking':
      return import('@/components/events/event-booking');
    case 'events-resources':
      return import('@/components/events/event-resources');
    case 'events-beo':
    case 'events-beo-management':
      return import('@/components/events/beo-management');
    default:
      throw new Error(`Unknown events section: ${section}`);
  }
}

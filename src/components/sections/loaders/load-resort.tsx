// Category loader: Resort (Timeshare & Casino)
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'resort-timeshare':
    case 'timeshare':
      return import('@/components/resort/timeshare');
    case 'resort-casino':
    case 'casino':
      return import('@/components/resort/casino');
    default:
      throw new Error(`Unknown resort section: ${section}`);
  }
}

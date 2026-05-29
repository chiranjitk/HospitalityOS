// Category loader: Parking
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'parking':
    case 'parking-slots':
      return import('@/components/parking/slots');
    case 'parking-tracking':
    case 'parking-mapping':
      return import('@/components/parking/vehicle-tracking');
    case 'parking-billing':
      return import('@/components/parking/billing');
    default:
      throw new Error(`Unknown parking section: ${section}`);
  }
}

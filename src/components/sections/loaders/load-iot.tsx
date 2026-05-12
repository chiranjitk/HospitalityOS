// Category loader: IoT
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'iot':
    case 'iot-devices':
      return import('@/components/iot/device-management');
    case 'iot-controls':
      return import('@/components/iot/room-controls');
    case 'iot-energy':
      return import('@/components/iot/energy-dashboard');
    case 'iot-smart-locks':
    case 'iot-smart-lock-management':
      return import('@/components/iot/smart-lock-management');
    default:
      throw new Error(`Unknown iot section: ${section}`);
  }
}

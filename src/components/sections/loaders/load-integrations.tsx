// Category loader: Integrations
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'integrations':
    case 'integrations-payment':
    case 'integrations-payments':
      return import('@/components/integrations/payment-gateways-page');
    case 'integrations-sms':
    case 'integrations-sms-gateway':
      return import('@/components/integrations/sms-gateways');
    case 'integrations-wifi':
      return import('@/components/integrations/wifi-gateways');
    case 'integrations-pos':
      return import('@/components/integrations/pos-systems');
    case 'integrations-apis':
      return import('@/components/integrations/third-party-apis');
    case 'integrations-smart-locks':
      return import('@/components/integrations/smart-locks');
    case 'integrations-terminals':
      return import('@/components/integrations/payment-terminals');
    case 'integrations-mobile-app':
      return import('@/components/integrations/mobile-app');
    case 'integrations-hub':
    case 'integrations-integration-hub':
      return import('@/components/integrations/integration-hub');
    case 'integrations-hardware-adapters':
      return import('@/components/integrations/hardware-adapters');
    default:
      throw new Error(`Unknown integrations section: ${section}`);
  }
}

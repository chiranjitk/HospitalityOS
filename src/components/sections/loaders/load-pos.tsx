// Category loader: POS
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'pos':
    case 'pos-orders':
      return import('@/components/pos/orders');
    case 'pos-tables':
      return import('@/components/pos/tables');
    case 'pos-kitchen':
      return import('@/components/pos/kitchen-display');
    case 'pos-menu':
      return import('@/components/pos/menu-management');
    case 'pos-billing':
      return import('@/components/pos/billing');
    case 'pos-offline':
      return import('@/components/pos/offline-mode');
    case 'pos-menu-boards':
    case 'pos-digital-menu-boards':
      return import('@/components/pos/menu-boards');
    case 'pos-room-service':
      return import('@/components/pos/room-service');
    case 'pos-restaurant-reports':
      return import('@/components/pos/restaurant-reports');
    case 'pos-recipes':
      return import('@/components/pos/recipes');
    case 'pos-staff-assignment':
      return import('@/components/pos/staff-assignment');
    case 'pos-receipt-templates':
      return import('@/components/pos/receipt-templates');
    case 'pos-inventory':
      return import('@/components/pos/inventory');
    case 'pos-modifiers':
      return import('@/components/pos/menu-modifiers');
    case 'pos-variants':
      return import('@/components/pos/menu-variants');
    case 'pos-table-layout':
      return import('@/components/pos/table-layout');
    case 'pos-reservations':
      return import('@/components/pos/reservations');
    default:
      throw new Error(`Unknown pos section: ${section}`);
  }
}

// Category loader: Inventory
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'inventory':
    case 'inventory-stock':
      return import('@/components/inventory/stock-items');
    case 'inventory-consumption':
      return import('@/components/inventory/consumption-logs');
    case 'inventory-alerts':
      return import('@/components/inventory/low-stock-alerts');
    case 'inventory-vendors':
      return import('@/components/inventory/vendors');
    case 'inventory-purchase-orders':
    case 'inventory-po':
      return import('@/components/inventory/purchase-orders');
    case 'inventory-requisition':
    case 'inventory-purchase-requisition':
      return import('@/components/inventory/purchase-requisition');
    case 'inventory-invoice-matching':
      return import('@/components/inventory/invoice-matching');
    default:
      throw new Error(`Unknown inventory section: ${section}`);
  }
}

const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'pos-orders': () => import('@/components/pos/orders'),
  'pos-tables': () => import('@/components/pos/tables'),
  'pos-kitchen': () => import('@/components/pos/kitchen-display'),
  'pos-menu': () => import('@/components/pos/menu-management'),
  'pos-billing': () => import('@/components/pos/billing'),
  'pos-modifiers': () => import('@/components/pos/menu-modifiers'),
  'pos-variants': () => import('@/components/pos/menu-variants'),
  'pos-table-layout': () => import('@/components/pos/table-layout'),
  'pos-reservations': () => import('@/components/pos/reservations'),
  'pos-inventory': () => import('@/components/pos/inventory'),
};

export const posMap = sectionMap;

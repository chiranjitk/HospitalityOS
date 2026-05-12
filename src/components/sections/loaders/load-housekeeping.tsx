// Category loader: Housekeeping
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'housekeeping':
    case 'housekeeping-tasks':
      return import('@/components/housekeeping/tasks-list');
    case 'housekeeping-kanban':
      return import('@/components/housekeeping/kanban-board');
    case 'housekeeping-status':
      return import('@/components/housekeeping/room-status');
    case 'housekeeping-maintenance':
    case 'housekeeping-preventive':
      return import('@/components/housekeeping/maintenance');
    case 'housekeeping-assets':
      return import('@/components/housekeeping/assets');
    case 'housekeeping-automation':
      return import('@/components/housekeeping/housekeeping-automation');
    case 'housekeeping-inspections':
      return import('@/components/housekeeping/inspection-checklists');
    case 'housekeeping-lost-found':
      return import('@/components/housekeeping/lost-found');
    case 'housekeeping-minibar':
      return import('@/components/housekeeping/minibar');
    case 'housekeeping-laundry':
      return import('@/components/housekeeping/laundry');
    default:
      throw new Error(`Unknown housekeeping section: ${section}`);
  }
}

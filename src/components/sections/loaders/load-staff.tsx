// Category loader: Staff
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'staff':
    case 'staff-shifts':
    case 'staff-management':
      return import('@/components/staff/shift-scheduling');
    case 'staff-attendance':
      return import('@/components/staff/attendance-tracking');
    case 'staff-tasks':
      return import('@/components/staff/task-assignment');
    case 'staff-communication':
      return import('@/components/staff/internal-communication');
    case 'staff-performance':
      return import('@/components/staff/performance/performance-dashboard');
    case 'staff-skills':
      return import('@/components/staff/skills-management');
    case 'staff-leave':
      return import('@/components/staff/leave-management');
    case 'staff-payroll':
    case 'staff-payroll-management':
      return import('@/components/staff/payroll-management');
    // User & role management — routed here from master-loader's staff prefix
    case 'staff-users':
      return import('@/components/admin/user-management');
    case 'staff-roles':
      return import('@/components/admin/role-permissions');
    default:
      throw new Error(`Unknown staff section: ${section}`);
  }
}

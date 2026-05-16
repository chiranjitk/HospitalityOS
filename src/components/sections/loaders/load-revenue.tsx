// Category loader: Revenue
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'revenue':
    case 'revenue-pricing':
    case 'revenue-rules':
    case 'revenue-rates':
      return import('@/components/pms/rate-plans-pricing-rules');
    case 'revenue-forecast':
    case 'revenue-demand':
    case 'revenue-forecasting':
      return import('@/components/revenue/demand-forecasting-page');
    case 'revenue-competitor':
    case 'revenue-compset':
      return import('@/components/revenue/competitor-pricing');
    case 'revenue-ai':
    case 'revenue-suggestions':
      return import('@/components/revenue/ai-suggestions');
    case 'revenue-rate-shopping':
    case 'revenue-rate-shop':
      return import('@/components/revenue/rate-shopping');
    case 'revenue-management':
    case 'revenue-advanced':
    case 'revenue-analytics':
      return import('@/components/revenue/revenue-management');
    case 'revenue-automation':
    case 'revenue-overbooking':
    case 'revenue-last-minute':
    case 'revenue-triggers':
      return import('@/components/revenue/revenue-automation');
    default:
      throw new Error(`Unknown revenue section: ${section}`);
  }
}

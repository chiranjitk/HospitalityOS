// Category loader: Reports
// Phase 3.1 RAM Optimization: Heavy report components are lazy-loaded via
// next/dynamic with ssr:false to avoid SSR bundle bloat and loading
// placeholders for better perceived performance.

import dynamic from 'next/dynamic';
import type React from 'react';

// ─── Loading placeholder ─────────────────────────────────────────────
function ReportLoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}

// ─── Heavy report components (~1.5K–3K lines each) ───────────────────
const GuestStayReport = dynamic(
  () => import('@/components/reports/guest-stay-report'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const FinancialStatements = dynamic(
  () => import('@/components/reports/financial-statements'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const CashFlowForecast = dynamic(
  () => import('@/components/reports/cash-flow-forecast'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const BudgetVariance = dynamic(
  () => import('@/components/reports/budget-variance'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const GuestAnalyticsReports = dynamic(
  () => import('@/components/reports/guest-analytics-reports'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const OccupancyReports = dynamic(
  () => import('@/components/reports/occupancy-reports'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const ADRRevPAR = dynamic(
  () => import('@/components/reports/adr-revpar'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const RevenueReports = dynamic(
  () => import('@/components/reports/revenue-reports'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

const StaffPerformance = dynamic(
  () => import('@/components/reports/staff-performance'),
  { ssr: false, loading: () => <ReportLoadingSkeleton /> }
);

// ─── Section loader ──────────────────────────────────────────────────
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'reports':
    case 'reports-revenue':
      return { default: RevenueReports };
    case 'reports-occupancy':
      return { default: OccupancyReports };
    case 'reports-adr':
    case 'reports-revpar':
      return { default: ADRRevPAR };
    case 'reports-guest':
    case 'reports-guests':
      return { default: GuestAnalyticsReports };
    case 'reports-guest-stay':
    case 'reports-guest-stays':
      return { default: GuestStayReport };
    case 'reports-staff':
      return { default: StaffPerformance };
    case 'reports-scheduled':
      return import('@/components/reports/scheduled-reports');
    case 'reports-financial':
    case 'reports-pl':
      return { default: FinancialStatements };
    case 'reports-cashflow':
      return { default: CashFlowForecast };
    case 'reports-budget':
    case 'reports-budget-variance':
      return { default: BudgetVariance };
    default:
      throw new Error(`Unknown reports section: ${section}`);
  }
}

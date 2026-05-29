// Category loader: Billing
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'billing':
    case 'saas':
    case 'billing-folios':
      return import('@/components/billing/folios');
    case 'billing-invoices':
      return import('@/components/billing/invoices');
    case 'billing-payments':
      return import('@/components/billing/payments');
    case 'billing-refunds':
      return import('@/components/billing/refunds');
    case 'billing-discounts':
      return import('@/components/billing/discounts');
    case 'billing-cancellation-policies':
      return import('@/components/billing/cancellation-policies');
    case 'billing-saas-plans':
    case 'saas-plans':
      return import('@/components/billing/saas-plans');
    case 'billing-saas-subs':
    case 'saas-subscriptions':
      return import('@/components/billing/subscriptions');
    case 'billing-saas-usage':
    case 'saas-usage':
      return import('@/components/billing/usage-billing');
    case 'folio-transfer':
      return import('@/components/billing/folio-transfer');
    case 'payment-plans':
      return import('@/components/billing/payment-plans');
    case 'credit-notes':
      return import('@/components/billing/credit-notes');
    case 'multi-currency':
      return import('@/components/billing/multi-currency');
    case 'billing-night-audit':
      return import('@/components/billing/night-audit');
    case 'billing-city-ledger':
      return import('@/components/billing/city-ledger');
    case 'billing-commissions':
      return import('@/components/billing/commissions');
    case 'billing-posting-rules':
      return import('@/components/billing/posting-rules');
    case 'billing-scheduled-charges':
      return import('@/components/billing/scheduled-charges');
    case 'billing-tax-settings':
      return import('@/components/billing/tax-settings');
    case 'billing-gst-invoicing':
      return import('@/components/billing/gst-invoicing');
    case 'billing-gst-returns':
      return import('@/components/billing/gst-returns');
    case 'billing-tcs-tds':
      return import('@/components/billing/tcs-tds');
    case 'billing-ap-workflow':
      return import('@/components/billing/ap-workflow');
    case 'billing-deposits':
    case 'billing-deposit-schedules':
      return import('@/components/billing/deposit-schedules');
    case 'billing-profit-loss':
      return import('@/components/billing/profit-loss');
    case 'billing-cash-flow':
      return import('@/components/billing/cash-flow');
    case 'billing-budget':
      return import('@/components/billing/budget');
    case 'billing-financing':
      return import('@/components/billing/financing');
    case 'billing-cash-book':
      return import('@/components/billing/cash-book');
    case 'billing-group-folio':
    case 'group-folio':
      return import('@/components/billing/group-folio');
    default:
      throw new Error(`Unknown billing section: ${section}`);
  }
}

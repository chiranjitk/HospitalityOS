'use client';

import React from 'react';

// =====================================================
// SKELETON LAYOUT TYPES & SECTION MAPPING
// =====================================================

type SkeletonLayout =
  | 'dashboard'
  | 'table'
  | 'cards'
  | 'form'
  | 'wifi'
  | 'calendar'
  | 'kanban'
  | 'settings';

const sectionSkeletonMap: Record<string, SkeletonLayout> = {
  // Dashboard
  'dashboard-overview': 'dashboard',
  'dashboard-command-center': 'dashboard',
  'dashboard-alerts': 'dashboard',
  'dashboard-kpi': 'dashboard',
  // PMS
  'pms-rooms': 'table',
  'pms-properties': 'cards',
  'pms-rate-plans-pricing': 'cards',
  'pms-room-types': 'cards',
  'pms-inventory-calendar': 'calendar',
  'pms-availability': 'table',
  'pms-locking': 'table',
  'pms-overbooking': 'settings',
  'pms-floor-plans': 'cards',
  'room-rate-calendar': 'calendar',
  'room-out-of-order': 'table',
  'pms-package-plans': 'cards',
  'pms-room-type-change': 'table',
  // Bookings
  'bookings-calendar': 'calendar',
  'bookings-groups': 'cards',
  'bookings-waitlist': 'table',
  'bookings-conflicts': 'table',
  'bookings-no-show': 'settings',
  'bookings-audit': 'table',
  // Front Desk
  'frontdesk-check-in': 'form',
  'frontdesk-check-out': 'form',
  'frontdesk-walk-in': 'form',
  'frontdesk-room-grid': 'cards',
  'frontdesk-kiosk': 'settings',
  'frontdesk-scanning': 'table',
  'frontdesk-key-handout': 'table',
  'frontdesk-room-move': 'form',
  'frontdesk-early-checkout': 'form',
  'frontdesk-groups': 'cards',
  // Guests
  'guests-list': 'table',
  'guests-kyc': 'cards',
  'guests-preferences': 'form',
  'guests-history': 'table',
  'guests-loyalty': 'cards',
  'guests-vip': 'cards',
  'guests-journey': 'cards',
  // Housekeeping
  'housekeeping-tasks': 'kanban',
  'housekeeping-kanban': 'kanban',
  'housekeeping-maintenance': 'kanban',
  'housekeeping-assets': 'table',
  'housekeeping-minibar': 'table',
  'housekeeping-laundry': 'table',
  'housekeeping-lost-found': 'table',
  'housekeeping-inspection': 'kanban',
  'housekeeping-room-inspection': 'kanban',
  'housekeeping-schedule': 'calendar',
  'housekeeping-amenities': 'cards',
  'housekeeping-predictive': 'dashboard',
  // Billing
  'billing-folios': 'table',
  'billing-invoices': 'table',
  'billing-payments': 'table',
  'billing-post-charges': 'form',
  'billing-routing': 'settings',
  'billing-city-ledger': 'table',
  'billing-commissions': 'table',
  'billing-receipts': 'table',
  'billing-tax': 'settings',
  'billing-reports': 'table',
  'billing-packages': 'cards',
  'billing-deposits': 'table',
  'billing-cancellation-penalty': 'settings',
  'billing-billing-groups': 'cards',
  'billing-payment-methods': 'cards',
  'billing-advance-deposits': 'table',
  'billing-refunds': 'table',
  'billing-pnl': 'dashboard',
  'billing-cash-flow': 'dashboard',
  'billing-budget': 'dashboard',
  'billing-petty-cash': 'table',
  'billing-direct-billing': 'settings',
  'billing-gst-invoicing': 'table',
  'billing-tcs-tds': 'settings',
  // Settings
  'settings-general': 'settings',
  'settings-tax': 'settings',
  'settings-localization': 'settings',
  'settings-gdpr': 'settings',
  'settings-security': 'settings',
  'settings-integrations': 'settings',
  'settings-features': 'settings',
  'settings-license': 'settings',
  'settings-license-keys': 'settings',
  // WiFi / Network
  'wifi-access': 'wifi',
  'wifi-gateway-radius': 'wifi',
  'wifi-network': 'wifi',
  'wifi-dhcp': 'wifi',
  'wifi-dns': 'wifi',
  'wifi-portal': 'wifi',
  'wifi-firewall': 'wifi',
  'wifi-content-filter': 'wifi',
  'wifi-diagnostics': 'wifi',
  'wifi-reports': 'wifi',
  'wifi-health-alerts': 'wifi',
  'wifi-pre-arrival': 'wifi',
  'wifi-device-management': 'wifi',
  'wifi-identity-verification': 'wifi',
  'wifi-consent-management': 'wifi',
  'wifi-bandwidth-upsell': 'wifi',
  'wifi-revenue-dashboard': 'wifi',
  'wifi-satisfaction-surveys': 'wifi',
  'wifi-sla-monitoring': 'wifi',
  // Revenue
  'revenue-rate-shopping': 'dashboard',
  'revenue-competitor': 'table',
  'revenue-occupancy-forecast': 'dashboard',
  'revenue-demand-forecast': 'dashboard',
  'revenue-yield': 'dashboard',
  // Channels
  'channels-connections': 'cards',
  'channels-mappings': 'table',
  'channels-restrictions': 'settings',
  'channels-inventory-pool': 'table',
  'channels-calendar': 'calendar',
  'channels-bookings': 'table',
  'channels-analytics': 'dashboard',
  'channels-modifications': 'table',
  'channels-bulk-stop-sell': 'table',
  'channels-rate-parity': 'table',
  'channels-health': 'dashboard',
  'channels-rate-derivation': 'table',
  'channels-rate-overrides': 'table',
  'channels-content-sync': 'table',
  'channels-settlement': 'table',
  'channels-guest-rates': 'table',
  'channels-tax-mapping': 'table',
  'channels-booking-limits': 'settings',
  'channels-dead-letter': 'table',
  'channels-sync-logs': 'table',
  'channels-audit': 'table',
  // CRM & Marketing
  'crm-segments': 'cards',
  'crm-campaigns': 'table',
  'crm-templates': 'cards',
  'crm-reviews': 'table',
  'crm-guest-communications': 'table',
  'crm-loyalty-programs': 'cards',
  'crm-loyalty-tiers': 'table',
  'crm-rewards': 'cards',
  'crm-redemptions': 'table',
  'crm-referrals': 'table',
  'crm-guest-satisfaction': 'dashboard',
  'crm-competitor-intelligence': 'dashboard',
  // Ads
  'ads-google-hotel-ads': 'dashboard',
  'ads-metasearch': 'dashboard',
  'ads-campaigns': 'table',
  'ads-performance': 'dashboard',
  // Reports
  'reports-occupancy': 'dashboard',
  'reports-revenue': 'dashboard',
  'reports-adr-revpar': 'dashboard',
  'reports-guest-analytics': 'dashboard',
  'reports-housekeeping': 'dashboard',
  'reports-financial': 'dashboard',
  // Staff
  'staff-directory': 'table',
  'staff-shifts': 'calendar',
  'staff-attendance': 'table',
  'staff-performance': 'dashboard',
  'staff-training': 'table',
  'staff-payroll': 'table',
  'staff-departments': 'cards',
  'staff-roles': 'cards',
  // Security & IoT
  'security-overview': 'dashboard',
  'security-cameras': 'cards',
  'security-live': 'wifi',
  'security-playback': 'wifi',
  'security-alerts': 'table',
  'security-incidents': 'table',
  'security-audit-logs': 'table',
  'security-2fa': 'settings',
  'security-sessions': 'table',
  'security-sso': 'settings',
  'iot-devices': 'table',
  'iot-controls': 'settings',
  'iot-energy': 'dashboard',
  'surveillance-settings': 'settings',
  // Integrations
  'integrations-payments': 'settings',
  'integrations-sms': 'settings',
  'integrations-pos': 'settings',
  'integrations-apis': 'settings',
  'integrations-smart-locks': 'settings',
  'integrations-terminals': 'settings',
  'integrations-mobile-app': 'settings',
  'integrations-hardware-adapters': 'settings',
  'webhooks-events': 'table',
  'webhooks-delivery': 'table',
  'webhooks-retry': 'table',
  // Automation & AI
  'automation-workflows': 'kanban',
  'automation-rules': 'table',
  'automation-templates': 'cards',
  'automation-logs': 'table',
  'ai-copilot': 'cards',
  'ai-insights': 'dashboard',
  'ai-analytics': 'dashboard',
  'ai-conversations': 'table',
  // Notifications
  'notifications-center': 'table',
  'notifications-new': 'table',
  'notifications-housekeeping': 'table',
  // Platform Admin
  'platform-tenants': 'table',
  'platform-users': 'table',
  'platform-audit': 'table',
  'platform-licenses': 'table',
  'platform-subscriptions': 'table',
  'platform-billing': 'table',
  'platform-features': 'settings',
  'platform-api': 'settings',
  'platform-maintenance': 'settings',
  'platform-about': 'settings',
  'platform-changelog': 'table',
  'platform-security': 'settings',
  'platform-database': 'dashboard',
  'platform-backup': 'settings',
  'platform-webhooks': 'table',
  'platform-email': 'settings',
  'platform-sms': 'settings',
  'admin-dashboard': 'dashboard',
  'admin-tenant-management': 'table',
  'admin-licenses': 'table',
  'admin-license-keys': 'table',
  'admin-audit-log': 'table',
  'admin-users': 'table',
  'admin-system-logs': 'table',
  'admin-backup': 'settings',
  'admin-maintenance-mode': 'settings',
  'admin-system-info': 'settings',
  'admin-api-keys': 'table',
  'admin-email-settings': 'settings',
  'admin-sms-settings': 'settings',
  // Help
  'help-center': 'cards',
  'help-articles': 'table',
  'help-tutorials': 'cards',
  // Experience
  'experience-services': 'cards',
  'experience-vendors': 'table',
  'experience-reservations': 'table',
  'experience-feedback': 'table',
  'experience-chat': 'cards',
  'experience-menu': 'cards',
  'experience-concierge': 'cards',
  'experience-spa': 'table',
  'experience-excursions': 'table',
  'experience-loyalty': 'cards',
  'experience-reviews': 'table',
  'experience-social-wall': 'cards',
  'experience-weather': 'dashboard',
  'experience-ads': 'dashboard',
  'experience-locks': 'settings',
  // POS / Restaurant
  'pos-outlets': 'cards',
  'pos-menu': 'table',
  'pos-orders': 'table',
  'pos-kitchen': 'kanban',
  'pos-billing': 'table',
  'pos-inventory': 'table',
  'pos-reports': 'dashboard',
  'pos-tables': 'cards',
  'pos-table-merge': 'settings',
  'pos-table-split': 'settings',
  'pos-table-batch': 'settings',
  'pos-reservations': 'calendar',
  'pos-online-ordering': 'table',
  'pos-recipe-management': 'table',
  'pos-waste-tracking': 'table',
  'pos-staff-performance': 'dashboard',
  'pos-menu-approval': 'kanban',
  'pos-floor-plan': 'cards',
  'pos-payment-settlement': 'table',
  // Inventory
  'inventory-stock': 'table',
  'inventory-consumption': 'table',
  'inventory-purchase-orders': 'table',
  'inventory-requisitions': 'table',
  'inventory-suppliers': 'table',
  'inventory-reports': 'dashboard',
  'inventory-alerts': 'table',
  // Facilities
  'facilities-parking': 'table',
  'facilities-swimming-pool': 'dashboard',
  'facilities-gym': 'dashboard',
  'facilities-spa': 'table',
  'facilities-meeting-rooms': 'calendar',
  'facilities-events': 'calendar',
  'facilities-equipment': 'table',
  'facilities-maintenance': 'kanban',
  'facilities-beach': 'dashboard',
  // Parking
  'parking-zones': 'cards',
  'parking-spaces': 'table',
  'parking-mapping': 'cards',
  'parking-reports': 'dashboard',
  // Events / BEO
  'events-list': 'table',
  'events-calendar': 'calendar',
  'events-booking': 'form',
  'events-beo': 'form',
  // Chain
  'chain-properties': 'cards',
  'chain-transfer': 'form',
  'chain-reports': 'dashboard',
  'chain-branding': 'settings',
  // Marketing
  'marketing-campaigns': 'table',
  'marketing-segments': 'cards',
  'marketing-templates': 'cards',
  'marketing-analytics': 'dashboard',
  // Discounts
  'discounts-codes': 'table',
  'discounts-rules': 'table',
  'discounts-packages': 'cards',
  // Menu
  'menu-categories': 'table',
  'menu-modifiers': 'table',
  // Exchange
  'exchange-rates': 'table',
  // Rate Plans
  'rate-plans-list': 'table',
  'rate-plans-seasons': 'calendar',
  'rate-plans-restrictions': 'settings',
  // Travel Agents
  'travel-agents-list': 'table',
  'travel-agents-commissions': 'table',
  // Scheduled Charges
  'scheduled-charges-list': 'table',
  // Room Service
  'room-service-orders': 'table',
  'room-service-menu': 'table',
  'room-service-kitchen': 'kanban',
  // Service Requests
  'service-requests-list': 'kanban',
  'service-requests-category': 'table',
  // GDPR
  'gdpr-consent': 'table',
  'gdpr-data-export': 'settings',
  'gdpr-right-to-forgot': 'settings',
  'gdpr-cookie-preferences': 'settings',
  // Tables (POS)
  'tables-list': 'cards',
  'tables-merge': 'settings',
  'tables-split': 'settings',
  'tables-batch': 'settings',
  // City Ledger
  'city-ledger-accounts': 'table',
  'city-ledger-transactions': 'table',
  'city-ledger-statements': 'table',
  // Commissions
  'commissions-list': 'table',
  'commissions-payments': 'table',
  // Chat
  'chat-conversations': 'table',
  'chat-attachments': 'table',
  // Loyalty
  'loyalty-programs': 'cards',
  'loyalty-tiers': 'table',
  'loyalty-rewards': 'cards',
  'loyalty-redemptions': 'table',
  'loyalty-points': 'table',
  'loyalty-earn': 'table',
  // Room Types
  'room-types-list': 'table',
  // Networking
  'networking-interfaces': 'table',
  'networking-bandwidth': 'dashboard',
  'networking-dns': 'wifi',
  'networking-dhcp': 'wifi',
  'networking-firewall': 'wifi',
  'networking-vlan': 'table',
  'networking-syslog': 'table',
  'networking-snmp': 'settings',
  'networking-multiwan': 'wifi',
  'networking-rules': 'table',
  'networking-nat': 'settings',
  'networking-aliases': 'table',
  'networking-ports': 'settings',
  'networking-services': 'table',
  'networking-dmz': 'settings',
};

/**
 * SectionLoadingSkeleton
 *
 * A context-aware loading skeleton that adapts its layout to the
 * section being loaded. Uses the sectionSkeletonMap to determine
 * the appropriate skeleton layout (dashboard, table, cards, form,
 * wifi, calendar, kanban, settings).
 *
 * Falls back to a generic cards layout when no section is provided
 * or the section is not mapped.
 */
export function SectionLoadingSkeleton({ section }: { section?: string }) {
  const layout: SkeletonLayout = section
    ? (sectionSkeletonMap[section] || 'cards')
    : 'cards';

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <SkeletonLayoutRenderer layout={layout} />
      {/* Loading indicator */}
      <div className="flex items-center justify-center pt-6 pb-2">
        <span className="text-[11px] font-medium text-muted-foreground/60 skeleton-text-pulse tracking-wide">
          Loading...
        </span>
      </div>
    </div>
  );
}

/**
 * Internal component that renders the correct skeleton based on layout type.
 * This is a single stable component declared at module level, avoiding
 * the "components created during render" ESLint issue.
 */
function SkeletonLayoutRenderer({ layout }: { layout: SkeletonLayout }) {
  switch (layout) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'table':
      return <TableSkeleton />;
    case 'form':
      return <FormSkeleton />;
    case 'wifi':
      return <WifiSkeleton />;
    case 'calendar':
      return <CalendarSkeleton />;
    case 'kanban':
      return <KanbanSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    case 'cards':
    default:
      return <CardsSkeleton />;
  }
}

// =====================================================
// SKELETON LAYOUT COMPONENTS (rendered by SkeletonLayoutRenderer)
// =====================================================

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A skeleton bar with a shimmer sweep overlay */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-muted/40 dark:bg-muted/20', className)}
    >
      <div className="absolute inset-0 skeleton-shimmer-sweep" />
    </div>
  );
}

/** Section header skeleton (title + subtitle + actions) */
function SectionHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

// =====================================================
// DASHBOARD SKELETON
// =====================================================

function DashboardSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      {/* Metric cards row — 4 cols */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 dark:border-border/15 p-4 space-y-3 bg-card/50 dark:bg-card/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      {/* Wide content cards — 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-3 bg-card/50 dark:bg-card/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <ShimmerBlock className="h-40 w-full" />
          </div>
        ))}
      </div>

      {/* Bottom row — 1 full-width card */}
      <div className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-3 bg-card/50 dark:bg-card/30">
        <Skeleton className="h-5 w-28 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <ShimmerBlock key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// TABLE SKELETON
// =====================================================

function TableSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-9 rounded-full',
              i === 0 ? 'w-28' : i === 1 ? 'w-24' : i === 2 ? 'w-32' : 'w-20'
            )}
          />
        ))}
      </div>

      {/* Table container */}
      <div className="rounded-xl border border-border/30 dark:border-border/15 overflow-hidden bg-card/50 dark:bg-card/30">
        {/* Table header */}
        <div className="bg-muted/40 dark:bg-muted/20 px-4 py-2.5 grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-4 rounded-md" />
          ))}
        </div>

        {/* Table rows — 5 rows with alternating opacity */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'px-4 py-3 grid grid-cols-4 gap-4 border-t border-border/30 dark:border-border/15',
              i % 2 === 1 ? 'bg-muted/20 dark:bg-muted/10' : ''
            )}
          >
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-4 rounded-md" />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CARDS SKELETON
// =====================================================

function CardsSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      {/* Filter / tab bar */}
      <div className="flex flex-wrap items-center gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-8 rounded-full',
              i === 0 ? 'w-24' : i === 1 ? 'w-20' : i === 2 ? 'w-28' : 'w-16'
            )}
          />
        ))}
      </div>

      {/* Card grid — 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 dark:border-border/15 p-4 space-y-3 bg-card/50 dark:bg-card/30">
            {/* Card header bar */}
            <Skeleton className="h-5 w-32 rounded-lg" />
            {/* Text line 1 */}
            <Skeleton className="h-3 w-full rounded-md" />
            {/* Text line 2 */}
            <Skeleton className="h-3 w-4/5 rounded-md" />
            {/* Text line 3 */}
            <Skeleton className="h-3 w-3/5 rounded-md" />
            {/* Card action */}
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// FORM SKELETON
// =====================================================

function FormSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      <div className="max-w-2xl space-y-6">
        {/* Form title */}
        <Skeleton className="h-8 w-48 rounded-lg" />

        {/* Field group 1 */}
        <div className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-5 bg-card/50 dark:bg-card/30">
          <Skeleton className="h-5 w-24 rounded-lg" />

          {/* Field row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Field row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Textarea field */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>

        {/* Field group 2 */}
        <div className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-5 bg-card/50 dark:bg-card/30">
          <Skeleton className="h-5 w-28 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// WIFI SKELETON
// =====================================================

function WifiSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      {/* Network diagram — large card */}
      <div className="rounded-xl border border-border/30 dark:border-border/15 p-6 space-y-4 bg-card/50 dark:bg-card/30">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-md" />
          </div>
        </div>

        {/* Network node diagram area */}
        <div className="relative h-52 w-full rounded-xl bg-muted/30 dark:bg-muted/15 flex items-center justify-center">
          {/* Central node */}
          <div className="w-14 h-14 rounded-full bg-muted/60 dark:bg-muted/40 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-muted/80 dark:bg-muted/60" />
          </div>
          {/* Surrounding nodes */}
          <div className="absolute top-4 left-1/4 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          <div className="absolute top-4 right-1/4 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          <div className="absolute bottom-4 left-1/3 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          <div className="absolute bottom-4 right-1/3 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          <div className="absolute top-1/2 left-4 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          <div className="absolute top-1/2 right-4 w-10 h-10 rounded-full bg-muted/50 dark:bg-muted/30" />
          {/* Connection lines (simulated with skeleton bars) */}
          <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-48 rounded-full opacity-30" />
          <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-[1px] rounded-full opacity-30" />
        </div>
      </div>

      {/* Two smaller info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-3 bg-card/50 dark:bg-card/30">
            <Skeleton className="h-5 w-28 rounded-lg" />
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <ShimmerBlock className="h-16 w-full" />
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 dark:border-border/15 p-4 space-y-2 bg-card/50 dark:bg-card/30">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// CALENDAR SKELETON
// =====================================================

function CalendarSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      <div className="rounded-xl border border-border/30 dark:border-border/15 overflow-hidden p-5 bg-card/50 dark:bg-card/30">
        {/* Calendar navigation bar */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Day-of-week header cells */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="flex items-center justify-center">
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Calendar grid — 5 rows × 7 cols */}
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-16 rounded-md bg-muted/30 dark:bg-muted/15',
                [2, 7, 11, 15, 18, 23, 27, 30].includes(i) && 'bg-muted/50 dark:bg-muted/25'
              )}
            >
              {[2, 7, 11, 15, 18, 23, 27, 30].includes(i) && (
                <div className="p-1 space-y-1">
                  <Skeleton className="h-2 w-full rounded-sm" />
                  {i % 3 === 0 && <Skeleton className="h-2 w-3/4 rounded-sm" />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// KANBAN SKELETON
// =====================================================

function KanbanSkeleton() {
  const columnCardCounts = [3, 2, 3];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnCardCounts.map((cardCount, colIdx) => (
          <div key={colIdx} className="space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton
                  className={cn(
                    'h-5 rounded-lg',
                    colIdx === 0 ? 'w-16' : colIdx === 1 ? 'w-20' : 'w-14'
                  )}
                />
              </div>
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>

            {/* Column body */}
            <div className="rounded-xl border border-border/30 dark:border-border/15 bg-muted/20 dark:bg-muted/10 p-3 space-y-3 min-h-[16rem]">
              {[...Array(cardCount)].map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="rounded-lg bg-background border border-border/40 dark:border-border/20 p-3 space-y-2"
                >
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-sm" />
                  <Skeleton className="h-3 w-2/3 rounded-sm" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS SKELETON
// =====================================================

function SettingsSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 skeleton-glow rounded-2xl p-5">
      <SectionHeaderSkeleton />

      <div className="max-w-3xl space-y-6">
        {/* Settings section 1 */}
        <div className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-5 bg-card/50 dark:bg-card/30">
          {/* Section title */}
          <Skeleton className="h-7 w-64 rounded-lg" />

          {/* Field group */}
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-start">
                <div className="space-y-1 pt-2">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-36 rounded-sm" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Settings section 2 */}
        <div className="rounded-xl border border-border/30 dark:border-border/15 p-5 space-y-5 bg-card/50 dark:bg-card/30">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-start">
                <div className="space-y-1 pt-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-32 rounded-sm" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            {/* Toggle row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-center">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Save button area */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-48 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SectionLoadingSkeleton;

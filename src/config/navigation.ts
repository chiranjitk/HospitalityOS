import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  ConciergeBell,
  Sparkles,
  Wifi,
  Receipt,
  UtensilsCrossed,
  Brush,
  Package,
  Car,
  Video,
  Brain,
  Bot,
  BarChart3,
  TrendingUp,
  Globe,
  Plug,
  Bell,
  Webhook,
  Settings,
  Shield,
  GraduationCap,
  MessageSquare,
  Star,
  Megaphone,
  Clock,
  Lock,
  CreditCard,
  Kanban,
  Wrench,
  AlertTriangle,
  Layers,
  ListChecks,
  LucideIcon,
  Key,
  FileText,
  History,
  Users2,
  Wallet,
  Radio,
  Server,
  DollarSign,
  Target,
  PartyPopper,
  UserCheck,
  Zap,
  LogIn,
  LogOut,
  Inbox,
  CalendarClock,
  UserCog,
  Building,
  RefreshCw,
  Crown,
  Gift,
  Heart,
  Bookmark,
  ClipboardList,
  BadgePercent,
  BookOpen,
  PlayCircle,
  Smartphone,
  Palette,
  Volume2,
  Network,
  Stethoscope,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  Activity,
  XCircle,
  UserPlus,
  Monitor,
  ArrowRightLeft,
  Compass,
  CalendarCheck,
  Handshake,
  LayoutGrid,
  ChefHat,
  Moon,
  Percent,
  GitBranch,
  Search,
  Wine,
  Shirt,
  FileCheck2,
  RotateCcw,
  Gamepad2,
  Trophy,
  Route,
  HeartPulse,
  ShieldOff,
  BarChart3 as BarChart3Icon,
  PieChart,
  Image as ImageIcon,
  ArrowUpDown,
  Landmark,
  Tag,
  Database,
  Gauge,
  Timer,
  Calculator,
  Send,
  MapPin,
} from 'lucide-react';

export interface NavItem {
  id: string; // Stable ID for translations and React keys
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'success' | 'warning';
}

export interface NavSection {
  id: string; // Stable ID for translations and React keys
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  category?: 'base' | 'addons'; // For feature flag grouping
}

// =====================================================
// STAYSUITE MENU CONFIGURATION — v2 REORGANIZED
// =====================================================
//
// MODULE CATEGORIES:
// - BASE MODULES: Core functionality required for hotel operations
//   (Always enabled, cannot be disabled)
// - ADDON MODULES: Optional features that can be enabled/disabled
//   via Feature Flags in Settings
//
// REORGANIZATION NOTES (v2):
// - Merged CRM + Marketing → single "CRM & Marketing" section
// - Merged Surveillance + IoT + Security Center → "Security & IoT"
// - Merged Parking + Events + Resort → "Facilities"
// - Merged Notifications + Webhooks → "Notifications & Webhooks"
// - Merged Automation + AI Assistant → "Automation & AI"
// - Merged Admin + SaaS Billing + Chain → "Platform Admin"
// - Removed channel-cancellation-policy (duplicate of billing-cancellation-policies,
//   both share same CancellationPolicy DB model, billing has full CRUD API)
//
// DISABLED MODULES: Menu items automatically hidden when feature disabled
// =====================================================

export const navigationConfig: NavSection[] = [
  // =====================================================
  // BASE MODULES - Core Operations (Always Enabled)
  // =====================================================
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    category: 'base',
    items: [
      { id: 'dashboard-overview', title: 'Overview', href: '#dashboard-overview', icon: LayoutDashboard },
      { id: 'dashboard-command-center', title: 'Command Center', href: '#dashboard-command-center', icon: Radio },
      { id: 'dashboard-alerts', title: 'Alerts & Notifications', href: '#dashboard-alerts', icon: Bell },
      { id: 'dashboard-kpi', title: 'KPI Cards', href: '#dashboard-kpi', icon: BarChart3 },
    ],
  },
  {
    id: 'pms',
    title: 'PMS',
    icon: Building2,
    category: 'base',
    items: [
      { id: 'pms-properties', title: 'Properties', href: '#pms-properties', icon: Building2 },
      { id: 'pms-room-types', title: 'Room Types', href: '#pms-room-types', icon: Layers },
      { id: 'pms-rooms', title: 'Rooms', href: '#pms-rooms', icon: Key },
      { id: 'pms-inventory-calendar', title: 'Inventory Calendar', href: '#pms-inventory-calendar', icon: CalendarDays },
      { id: 'pms-availability', title: 'Availability Control', href: '#pms-availability', icon: Clock },
      { id: 'pms-locking', title: 'Inventory Locking', href: '#pms-locking', icon: Lock },
      { id: 'pms-rate-plans-pricing', title: 'Rate Plans & Pricing', href: '#pms-rate-plans-pricing', icon: DollarSign },
      { id: 'pms-overbooking', title: 'Overbooking Settings', href: '#pms-overbooking', icon: AlertTriangle },
      { id: 'pms-floor-plans', title: 'Floor Plans', href: '#pms-floor-plans', icon: Building },
      { id: 'room-rate-calendar', title: 'Room Rate Calendar', href: '#room-rate-calendar', icon: CalendarDays },
      { id: 'room-out-of-order', title: 'Room Out-of-Order', href: '#room-out-of-order', icon: XCircle },
      { id: 'pms-package-plans', title: 'Package Plans', href: '#pms-package-plans', icon: Gift },
      { id: 'pms-room-type-change', title: 'Room Type Change', href: '#pms-room-type-change', icon: ArrowRightLeft },
    ],
  },
  {
    id: 'bookings',
    title: 'Bookings',
    icon: CalendarDays,
    category: 'base',
    items: [
      { id: 'bookings-calendar', title: 'Calendar View', href: '#bookings-calendar', icon: CalendarDays },
      { id: 'bookings-groups', title: 'Group Bookings', href: '#bookings-groups', icon: Users2 },
      { id: 'bookings-waitlist', title: 'Waitlist', href: '#bookings-waitlist', icon: Clock },
      { id: 'bookings-conflicts', title: 'Conflicts', href: '#bookings-conflicts', icon: AlertTriangle },
      { id: 'bookings-no-show', title: 'No-Show Automation', href: '#bookings-no-show', icon: Clock },
      { id: 'bookings-audit', title: 'Audit Logs', href: '#bookings-audit', icon: History },
    ],
  },
  {
    id: 'frontDesk',
    title: 'Front Desk',
    icon: ConciergeBell,
    category: 'base',
    items: [
      { id: 'frontdesk-checkin', title: 'Check-in', href: '#frontdesk-checkin', icon: LogIn },
      { id: 'frontdesk-checkout', title: 'Check-out', href: '#frontdesk-checkout', icon: LogOut },
      { id: 'frontdesk-walkin', title: 'Walk-in Booking', href: '#frontdesk-walkin', icon: Users },
      { id: 'frontdesk-room-grid', title: 'Room Grid', href: '#frontdesk-room-grid', icon: Kanban },
      { id: 'frontdesk-assignment', title: 'Room Assignment', href: '#frontdesk-assignment', icon: Key },
      { id: 'registration-card', title: 'Registration Card', href: '#registration-card', icon: UserPlus },
      { id: 'express-kiosk', title: 'Express Kiosk', href: '#express-kiosk', icon: Monitor },
      { id: 'kiosk-settings', title: 'Kiosk Settings', href: '#kiosk-settings', icon: Settings },
      { id: 'room-move', title: 'Room Move', href: '#room-move', icon: ArrowRightLeft },
    ],
  },
  {
    id: 'guests',
    title: 'Guests',
    icon: Users,
    category: 'base',
    items: [
      { id: 'guests-list', title: 'Guest List', href: '#guests-list', icon: Users },
      { id: 'guests-kyc', title: 'KYC / Documents', href: '#guests-kyc', icon: FileText },
      { id: 'guests-preferences', title: 'Preferences', href: '#guests-preferences', icon: Sparkles },
      { id: 'guests-history', title: 'Stay History', href: '#guests-history', icon: History },
      { id: 'guests-loyalty', title: 'Loyalty & Points', href: '#guests-loyalty', icon: Star },
      { id: 'guests-profile', title: 'Guest Profile', href: '#guests-profile', icon: UserCheck },
      { id: 'guests-journey', title: 'Journey Map', href: '#guests-journey', icon: Route },
      { id: 'guests-vip-alerts', title: 'VIP Recognition', href: '#guests-vip-alerts', icon: Crown },
    ],
  },
  {
    id: 'housekeeping',
    title: 'Housekeeping',
    icon: Brush,
    category: 'base',
    items: [
      { id: 'housekeeping-tasks', title: 'Tasks', href: '#housekeeping-tasks', icon: Brush },
      { id: 'housekeeping-kanban', title: 'Kanban Board', href: '#housekeeping-kanban', icon: Kanban },
      { id: 'housekeeping-status', title: 'Room Status', href: '#housekeeping-status', icon: Key },
      { id: 'housekeeping-maintenance', title: 'Maintenance Requests', href: '#housekeeping-maintenance', icon: Wrench },
      { id: 'housekeeping-preventive', title: 'Preventive Maintenance', href: '#housekeeping-preventive', icon: CalendarClock },
      { id: 'housekeeping-assets', title: 'Asset Management', href: '#housekeeping-assets', icon: Package },
      { id: 'housekeeping-inspections', title: 'Inspection Checklists', href: '#housekeeping-inspections', icon: ClipboardList },
      { id: 'housekeeping-automation', title: 'Automation Rules', href: '#housekeeping-automation', icon: Bot },
      { id: 'housekeeping-lost-found', title: 'Lost & Found', href: '#housekeeping-lost-found', icon: Search },
      { id: 'housekeeping-minibar', title: 'Minibar', href: '#housekeeping-minibar', icon: Wine },
      { id: 'housekeeping-laundry', title: 'Laundry', href: '#housekeeping-laundry', icon: Shirt },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: Receipt,
    category: 'base',
    items: [
      { id: 'billing-folios', title: 'Folios', href: '#billing-folios', icon: FileText },
      { id: 'billing-invoices', title: 'Invoices', href: '#billing-invoices', icon: Receipt },
      { id: 'billing-payments', title: 'Payments', href: '#billing-payments', icon: CreditCard },
      { id: 'billing-refunds', title: 'Refunds', href: '#billing-refunds', icon: Wallet },
      { id: 'billing-discounts', title: 'Discounts', href: '#billing-discounts', icon: BadgePercent },
      { id: 'billing-cancellation-policies', title: 'Cancellation Policies', href: '#billing-cancellation-policies', icon: FileText },
      { id: 'folio-transfer', title: 'Folio Transfer', href: '#folio-transfer', icon: RefreshCw },
      { id: 'payment-plans', title: 'Payment Plans', href: '#payment-plans', icon: CalendarClock },
      { id: 'credit-notes', title: 'Credit Notes', href: '#credit-notes', icon: Receipt },
      { id: 'multi-currency', title: 'Multi-Currency', href: '#multi-currency', icon: Globe },
      { id: 'billing-night-audit', title: 'Night Audit', href: '#billing-night-audit', icon: Moon },
      { id: 'billing-city-ledger', title: 'City Ledger', href: '#billing-city-ledger', icon: Building2 },
      { id: 'billing-commissions', title: 'Commissions', href: '#billing-commissions', icon: Percent },
      { id: 'billing-posting-rules', title: 'Posting Rules', href: '#billing-posting-rules', icon: GitBranch },
      { id: 'billing-scheduled-charges', title: 'Scheduled Charges', href: '#billing-scheduled-charges', icon: Clock },
      { id: 'billing-tax-settings', title: 'Tax Settings', href: '#billing-tax-settings', icon: FileText },
      { id: 'billing-gst-invoicing', title: 'GST e-Invoicing', href: '#billing-gst-invoicing', icon: Receipt },
      { id: 'billing-gst-returns', title: 'GST Returns', href: '#billing-gst-returns', icon: BarChart3 },
      { id: 'billing-tcs-tds', title: 'TCS/TDS', href: '#billing-tcs-tds', icon: Percent },
      { id: 'billing-ap-workflow', title: 'AP Workflow', href: '#billing-ap-workflow', icon: ClipboardList },
      { id: 'billing-profit-loss', title: 'P&L Statement', href: '#billing-profit-loss', icon: BarChart3 },
      { id: 'billing-cash-flow', title: 'Cash Flow Forecast', href: '#billing-cash-flow', icon: DollarSign },
      { id: 'billing-budget', title: 'Budget Management', href: '#billing-budget', icon: TrendingUp },
      { id: 'billing-deposits', title: 'Deposit Schedules', href: '#billing-deposits', icon: Wallet },
      { id: 'billing-financing', title: 'BNPL / Financing', href: '#billing-financing', icon: CreditCard },
      { id: 'billing-cash-book', title: 'Cash Book', href: '#billing-cash-book', icon: BookOpen },
    ],
  },

  // =====================================================
  // ADDON MODULES - Optional Features (Can be toggled)
  // =====================================================

  // --- Guest Experience Addons ---
  {
    id: 'experience',
    title: 'Guest Experience',
    icon: Sparkles,
    category: 'addons',
    items: [
      { id: 'experience-requests', title: 'Service Requests', href: '#experience-requests', icon: Sparkles },
      { id: 'experience-inbox', title: 'Unified Inbox', href: '#experience-inbox', icon: Inbox },
      { id: 'experience-chat', title: 'Guest Chat', href: '#experience-chat', icon: MessageSquare },
      { id: 'experience-portal', title: 'In-Room Portal', href: '#experience-portal', icon: Zap },
      { id: 'experience-keys', title: 'Digital Keys', href: '#experience-keys', icon: Key },
      { id: 'experience-app-controls', title: 'Guest App Controls', href: '#experience-app-controls', icon: Smartphone },
      { id: 'experiences', title: 'Experience Catalog', href: '#experiences', icon: Compass },
      { id: 'experience-bookings', title: 'Experience Bookings', href: '#experience-bookings', icon: CalendarCheck },
      { id: 'experience-pricing', title: 'Pricing & Availability', href: '#experience-pricing', icon: DollarSign },
      { id: 'experience-vendors', title: 'Vendor Management', href: '#experience-vendors', icon: Handshake },
      { id: 'experience-revenue', title: 'Revenue Analytics', href: '#experience-revenue', icon: TrendingUp },
      { id: 'experience-calendar', title: 'Calendar', href: '#experience-calendar', icon: CalendarDays },
      { id: 'experience-feedback', title: 'Guest Feedback', href: '#experience-feedback', icon: Star },
      { id: 'experience-spa', title: 'Spa & Wellness', href: '#experience-spa', icon: Heart },
      { id: 'experience-golf', title: 'Golf Course', href: '#experience-golf', icon: Trophy },
    ],
  },
  {
    id: 'pos',
    title: 'Restaurant & POS',
    icon: UtensilsCrossed,
    category: 'addons',
    items: [
      { id: 'pos-orders', title: 'Orders', href: '#pos-orders', icon: UtensilsCrossed },
      { id: 'pos-tables', title: 'Tables', href: '#pos-tables', icon: Kanban },
      { id: 'pos-kitchen', title: 'Kitchen (KDS)', href: '#pos-kitchen', icon: UtensilsCrossed },
      { id: 'pos-menu', title: 'Menu Management', href: '#pos-menu', icon: FileText },
      { id: 'pos-billing', title: 'Restaurant Billing', href: '#pos-billing', icon: Receipt },
      { id: 'pos-room-service', title: 'Room Service', href: '#pos-room-service', icon: ConciergeBell },
      { id: 'pos-restaurant-reports', title: 'Restaurant Reports', href: '#pos-restaurant-reports', icon: BarChart3 },
      { id: 'pos-recipes', title: 'Recipes', href: '#pos-recipes', icon: ChefHat },
      { id: 'pos-staff-assignment', title: 'Staff Assignment', href: '#pos-staff-assignment', icon: Users },
      { id: 'pos-receipt-templates', title: 'Receipt Templates', href: '#pos-receipt-templates', icon: Receipt },
      { id: 'pos-inventory', title: 'Inventory', href: '#pos-inventory', icon: Package },
      { id: 'pos-modifiers', title: 'Menu Modifiers', href: '#pos-modifiers', icon: ListChecks },
      { id: 'pos-variants', title: 'Menu Variants', href: '#pos-variants', icon: Layers },
      { id: 'pos-table-layout', title: 'Table Layout', href: '#pos-table-layout', icon: LayoutGrid },
      { id: 'pos-reservations', title: 'Reservations', href: '#pos-reservations', icon: CalendarDays },
      { id: 'pos-offline', title: 'Offline Mode', href: '#pos-offline', icon: HardDrive },
      { id: 'pos-menu-boards', title: 'Digital Menu Boards', href: '#pos-menu-boards', icon: Monitor },
    ],
  },

  // --- Facility Management Addons ---
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    category: 'addons',
    items: [
      { id: 'inventory-stock', title: 'Stock Items', href: '#inventory-stock', icon: Package },
      { id: 'inventory-consumption', title: 'Consumption Logs', href: '#inventory-consumption', icon: BarChart3 },
      { id: 'inventory-alerts', title: 'Low Stock Alerts', href: '#inventory-alerts', icon: AlertTriangle },
      { id: 'inventory-vendors', title: 'Vendors', href: '#inventory-vendors', icon: Users },
      { id: 'inventory-po', title: 'Purchase Orders', href: '#inventory-po', icon: FileText },
      { id: 'inventory-purchase-requisition', title: 'Purchase Requisitions', href: '#inventory-purchase-requisition', icon: ClipboardList },
      { id: 'inventory-invoice-matching', title: 'Invoice Matching', href: '#inventory-invoice-matching', icon: FileCheck2 },
    ],
  },
  // MERGED: Parking + Events + Resort → Facilities (was 3 sections, now 1)
  {
    id: 'facilities',
    title: 'Facilities',
    icon: PartyPopper,
    category: 'addons',
    items: [
      // Parking
      { id: 'parking-slots', title: 'Parking Slots', href: '#parking-slots', icon: Car },
      { id: 'parking-tracking', title: 'Vehicle Tracking', href: '#parking-tracking', icon: Radio },
      { id: 'parking-billing', title: 'Parking Billing', href: '#parking-billing', icon: Receipt },
      // Events / MICE
      { id: 'events-spaces', title: 'Event Spaces', href: '#events-spaces', icon: Building2 },
      { id: 'events-calendar', title: 'Event Calendar', href: '#events-calendar', icon: CalendarDays },
      { id: 'events-booking', title: 'Event Bookings', href: '#events-booking', icon: FileText },
      { id: 'events-resources', title: 'Event Resources', href: '#events-resources', icon: Package },
      { id: 'events-beo', title: 'BEO Management', href: '#events-beo', icon: ClipboardList },
      // Resort
      { id: 'resort-timeshare', title: 'Timeshare & Ownership', href: '#resort-timeshare', icon: CalendarDays },
      { id: 'resort-casino', title: 'Casino & Gaming', href: '#resort-casino', icon: Gamepad2 },
    ],
  },

  // --- Connectivity Addons ---
  {
    id: 'wifi',
    title: 'WiFi',
    icon: Wifi,
    category: 'addons',
    items: [
      { id: 'wifi-access', title: 'WiFi Access', href: '#wifi-access', icon: Wifi },
      { id: 'wifi-gateway-radius', title: 'RADIUS & Gateway', href: '#wifi-gateway-radius', icon: Shield },
      { id: 'wifi-network', title: 'Network', href: '#wifi-network', icon: Network },
      { id: 'wifi-dhcp', title: 'DHCP Server', href: '#wifi-dhcp', icon: Server },
      { id: 'wifi-dns', title: 'DNS Server', href: '#wifi-dns', icon: Globe },
      { id: 'wifi-portal', title: 'Captive Portal', href: '#wifi-portal', icon: Globe },
      { id: 'wifi-firewall', title: 'Firewall & Bandwidth', href: '#wifi-firewall', icon: ShieldCheck },
      { id: 'wifi-content-filter', title: 'Content Filter', href: '#wifi-content-filter', icon: ShieldAlert },
      { id: 'wifi-diagnostics', title: 'Gateway Diagnostics', href: '#wifi-diagnostics', icon: Stethoscope },
      { id: 'wifi-reports', title: 'Reports', href: '#wifi-reports', icon: Activity },
      { id: 'wifi-health-alerts', title: 'Health Alerts', href: '#wifi-health-alerts', icon: Bell },
      { id: 'wifi-pre-arrival', title: 'Pre-Arrival Delivery', href: '#wifi-pre-arrival', icon: Send },
      { id: 'wifi-device-management', title: 'Multi-Device Registration', href: '#wifi-device-management', icon: Smartphone },
      { id: 'wifi-identity-verification', title: 'Identity Verification', href: '#wifi-identity-verification', icon: ShieldCheck },
      { id: 'wifi-consent-management', title: 'GDPR Consent', href: '#wifi-consent-management', icon: FileCheck2 },
      { id: 'wifi-billing', title: 'WiFi Billing', href: '#wifi-billing', icon: DollarSign },
      { id: 'wifi-bandwidth-upsell', title: 'Bandwidth Upsell', href: '#wifi-bandwidth-upsell', icon: TrendingUp },
      { id: 'wifi-ad-campaigns', title: 'Ad Campaigns', href: '#wifi-ad-campaigns', icon: Megaphone },
      { id: 'wifi-partners', title: 'Partner WiFi', href: '#wifi-partners', icon: Handshake },
      { id: 'wifi-revenue-dashboard', title: 'Revenue Analytics', href: '#wifi-revenue-dashboard', icon: DollarSign },
      { id: 'wifi-satisfaction-surveys', title: 'Guest Surveys', href: '#wifi-satisfaction-surveys', icon: Star },
      { id: 'wifi-sla-monitoring', title: 'SLA Monitoring', href: '#wifi-sla-monitoring', icon: Gauge },
      { id: 'wifi-heatmap', title: 'WiFi Heatmap', href: '#wifi-heatmap', icon: MapPin },
    ],
  },

  // --- Revenue & Channels Addons ---
  {
    id: 'revenue',
    title: 'Revenue Management',
    icon: TrendingUp,
    category: 'addons',
    items: [
      { id: 'revenue-pricing', title: 'Dynamic Pricing', href: '#revenue-pricing', icon: DollarSign },
      { id: 'revenue-forecasting', title: 'Demand Forecasting', href: '#revenue-forecasting', icon: TrendingUp },
      { id: 'revenue-competitor', title: 'Competitor Pricing', href: '#revenue-competitor', icon: Target },
      { id: 'revenue-compset', title: 'Compset Benchmarking', href: '#revenue-compset', icon: Trophy },
      // FIX (L-2): Renamed from "AI Suggestions" to "Smart Pricing Rules" to accurately
      // reflect the heuristic-based pricing logic instead of implying ML/AI.
      { id: 'revenue-ai', title: 'Smart Pricing Rules', href: '#revenue-ai', icon: Brain },
      { id: 'revenue-rate-shopping', title: 'Rate Shopping', href: '#revenue-rate-shopping', icon: Search },
      { id: 'revenue-hourly-pricing', title: 'Hourly Pricing', href: '#revenue-hourly-pricing', icon: Timer },
      { id: 'revenue-linear-pricing', title: 'Per-Room Pricing', href: '#revenue-linear-pricing', icon: ArrowUpDown },
      { id: 'revenue-auto-overbooking', title: 'Auto-Overbooking', href: '#revenue-auto-overbooking', icon: AlertTriangle },
      { id: 'revenue-last-minute', title: 'Last-Minute Triggers', href: '#revenue-last-minute', icon: Zap },
      { id: 'revenue-automation', title: 'Revenue Automation', href: '#revenue-automation', icon: Bot },
    ],
  },
  {
    id: 'channels',
    title: 'Channel Manager',
    icon: Globe,
    category: 'addons',
    items: [
      { id: 'channel-analytics', title: 'Channel Analytics', href: '#channel-analytics', icon: BarChart3Icon },
      { id: 'channel-ota', title: 'OTA Connections', href: '#channel-ota', icon: Globe },
      { id: 'channel-inventory', title: 'Inventory Sync', href: '#channel-inventory', icon: Zap },
      { id: 'channel-rate', title: 'Rate Sync', href: '#channel-rate', icon: DollarSign },
      { id: 'channel-booking', title: 'Booking Sync', href: '#channel-booking', icon: CalendarDays },
      { id: 'channel-booking-modifications', title: 'Booking Modifications', href: '#channel-booking-modifications', icon: RefreshCw },
      { id: 'channel-restrictions', title: 'Restrictions', href: '#channel-restrictions', icon: Lock },
      { id: 'channel-stop-sell', title: 'Bulk Stop-Sell', href: '#channel-stop-sell', icon: ShieldOff },
      { id: 'channel-allocations', title: 'Allocations', href: '#channel-allocations', icon: PieChart },
      { id: 'channel-mapping', title: 'Channel Mapping', href: '#channel-mapping', icon: Layers },
      { id: 'channel-parity', title: 'Rate Parity', href: '#channel-parity', icon: ShieldCheck },
      { id: 'channel-logs', title: 'Sync Logs', href: '#channel-logs', icon: History },
      { id: 'channel-health', title: 'Channel Health', href: '#channel-health', icon: HeartPulse },
      { id: 'channel-crs', title: 'CRS', href: '#channel-crs', icon: Building },
      { id: 'channel-gds', title: 'GDS Connectivity', href: '#channel-gds', icon: Radio },
      { id: 'channel-rate-derivation', title: 'Rate Derivation', href: '#channel-rate-derivation', icon: Percent },
      { id: 'channel-rate-overrides', title: 'Rate Overrides', href: '#channel-rate-overrides', icon: Calculator },
      { id: 'channel-content-sync', title: 'Content Sync', href: '#channel-content-sync', icon: ImageIcon },
      { id: 'channel-messages', title: 'OTA Messages', href: '#channel-messages', icon: MessageSquare },
      { id: 'channel-tax-mapping', title: 'Tax Mapping', href: '#channel-tax-mapping', icon: Receipt },
      { id: 'channel-meal-plan', title: 'Meal Plan Mapping', href: '#channel-meal-plan', icon: UtensilsCrossed },
      { id: 'channel-virtual-inventory', title: 'Virtual Inventory', href: '#channel-virtual-inventory', icon: Layers },
      { id: 'channel-currency', title: 'Currency Config', href: '#channel-currency', icon: Globe },
      // NOTE: channel-cancellation-policy REMOVED — duplicate of billing-cancellation-policies
      // Both use the same CancellationPolicy DB model; billing has full CRUD API
      { id: 'channel-settlement', title: 'Settlements', href: '#channel-settlement', icon: Landmark },
      { id: 'channel-allotment-release', title: 'Allotment Release', href: '#channel-allotment-release', icon: Timer },
      { id: 'channel-promo-codes', title: 'Promo Codes', href: '#channel-promo-codes', icon: Tag },
      { id: 'channel-booking-pace', title: 'Booking Pace', href: '#channel-booking-pace', icon: TrendingUp },
      { id: 'channel-priority', title: 'Channel Priority', href: '#channel-priority', icon: ArrowUpDown },
      { id: 'channel-inventory-pool', title: 'Inventory Pooling', href: '#channel-inventory-pool', icon: Database },
      { id: 'channel-derived-rates', title: 'Derived Rate Plans', href: '#channel-derived-rates', icon: GitBranch },
      { id: 'channel-commission-config', title: 'Commission Config', href: '#channel-commission-config', icon: Percent },
      { id: 'channel-guest-rates', title: 'Guest Rates', href: '#channel-guest-rates', icon: Users },
      { id: 'channel-booking-limits', title: 'Booking Limits', href: '#channel-booking-limits', icon: Gauge },
    ],
  },

  // MERGED: CRM + Marketing → single section (was 2, now 1)
  {
    id: 'crmMarketing',
    title: 'CRM & Marketing',
    icon: Megaphone,
    category: 'addons',
    items: [
      // CRM
      { id: 'crm-segments', title: 'Guest Segments', href: '#crm-segments', icon: Users },
      { id: 'crm-campaigns', title: 'Campaigns', href: '#crm-campaigns', icon: Megaphone },
      { id: 'crm-loyalty', title: 'Loyalty Programs', href: '#crm-loyalty', icon: Gift },
      { id: 'crm-feedback', title: 'Feedback & Reviews', href: '#crm-feedback', icon: MessageSquare },
      { id: 'crm-retention', title: 'Retention Analytics', href: '#crm-retention', icon: Heart },
      // Marketing
      { id: 'marketing-reputation', title: 'Reputation Dashboard', href: '#marketing-reputation', icon: Star },
      { id: 'marketing-sources', title: 'Review Sources', href: '#marketing-sources', icon: Bookmark },
      { id: 'marketing-booking-engine', title: 'Direct Booking Engine', href: '#marketing-booking-engine', icon: Globe },
      { id: 'marketing-promotions', title: 'Promotions & Offers', href: '#marketing-promotions', icon: BadgePercent },
      { id: 'marketing-upsell', title: 'Upsell Engine', href: '#marketing-upsell', icon: TrendingUp },
      { id: 'marketing-journey-campaigns', title: 'Journey Campaigns', href: '#marketing-journey-campaigns', icon: Zap },
      { id: 'marketing-abandoned-bookings', title: 'Abandoned Bookings', href: '#marketing-abandoned-bookings', icon: RotateCcw },
      { id: 'marketing-website-builder', title: 'Website Builder', href: '#marketing-website-builder', icon: Globe },
      { id: 'crm-lead-pipeline', title: 'Lead Pipeline', href: '#crm-lead-pipeline', icon: Kanban },
    ],
  },

  // --- Digital Advertising Addons ---
  {
    id: 'ads',
    title: 'Digital Advertising',
    icon: Volume2,
    category: 'addons',
    items: [
      { id: 'ads-campaigns', title: 'Ad Campaigns', href: '#ads-campaigns', icon: Target },
      { id: 'ads-google', title: 'Google Hotel Ads', href: '#ads-google', icon: Globe },
      { id: 'ads-performance', title: 'Performance Tracking', href: '#ads-performance', icon: BarChart3 },
      { id: 'ads-roi', title: 'ROI Analytics', href: '#ads-roi', icon: TrendingUp },
    ],
  },

  // --- Analytics Addons ---
  {
    id: 'reports',
    title: 'Reports & BI',
    icon: BarChart3,
    category: 'addons',
    items: [
      { id: 'reports-revenue', title: 'Revenue Reports', href: '#reports-revenue', icon: DollarSign },
      { id: 'reports-occupancy', title: 'Occupancy Reports', href: '#reports-occupancy', icon: BarChart3 },
      { id: 'reports-adr', title: 'ADR / RevPAR', href: '#reports-adr', icon: TrendingUp },
      { id: 'reports-guests', title: 'Guest Analytics', href: '#reports-guests', icon: Users },
      { id: 'reports-guest-stay', title: 'Guest Stay Report', href: '#reports-guest-stay', icon: FileText },
      { id: 'reports-staff', title: 'Staff Performance', href: '#reports-staff', icon: UserCheck },
      { id: 'reports-scheduled', title: 'Scheduled Reports', href: '#reports-scheduled', icon: CalendarClock },
    ],
  },

  // --- Staff Management Addons ---
  {
    id: 'staffManagement',
    title: 'Staff Management',
    icon: UserCog,
    category: 'addons',
    items: [
      { id: 'staff-shifts', title: 'Shift Scheduling', href: '#staff-shifts', icon: CalendarDays },
      { id: 'staff-attendance', title: 'Attendance Tracking', href: '#staff-attendance', icon: UserCheck },
      { id: 'staff-leave', title: 'Leave Management', href: '#staff-leave', icon: CalendarClock },
      { id: 'staff-tasks', title: 'Task Assignment', href: '#staff-tasks', icon: ClipboardList },
      { id: 'staff-communication', title: 'Internal Communication', href: '#staff-communication', icon: MessageSquare },
      { id: 'staff-performance', title: 'Performance Metrics', href: '#staff-performance', icon: BarChart3 },
      { id: 'staff-skills', title: 'Skills & Certifications', href: '#staff-skills', icon: GraduationCap },
      { id: 'staff-payroll', title: 'Payroll', href: '#staff-payroll', icon: DollarSign },
    ],
  },

  // Surveillance & CCTV — Physical security: cameras, playback, incidents
  {
    id: 'surveillanceCctv',
    title: 'Surveillance & CCTV',
    icon: Video,
    category: 'addons',
    items: [
      { id: 'security-cameras', title: 'Camera Management', href: '#security-cameras', icon: Settings },
      { id: 'security-live', title: 'Live Camera View', href: '#security-live', icon: Video },
      { id: 'security-playback', title: 'Camera Playback', href: '#security-playback', icon: History },
      { id: 'security-alerts', title: 'Event Alerts', href: '#security-alerts', icon: Bell },
      { id: 'security-incidents', title: 'Incident Logs', href: '#security-incidents', icon: FileText },
      { id: 'surveillance-settings', title: 'Surveillance Settings', href: '#surveillance-settings', icon: Settings },
    ],
  },
  // IoT & Smart Building — Building automation: devices, room controls, energy
  {
    id: 'iotSmartBuilding',
    title: 'IoT & Smart Building',
    icon: Server,
    category: 'addons',
    items: [
      { id: 'iot-devices', title: 'Device Management', href: '#iot-devices', icon: Server },
      { id: 'iot-controls', title: 'Room Controls', href: '#iot-controls', icon: Settings },
      { id: 'iot-energy', title: 'Energy Dashboard', href: '#iot-energy', icon: TrendingUp },
    ],
  },

  // MERGED: Integrations + Webhooks → Integrations (was 2, now 1)
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    category: 'addons',
    items: [
      // Integrations
      { id: 'integrations-payments', title: 'Payment Gateways', href: '#integrations-payments', icon: CreditCard },
      { id: 'integrations-sms', title: 'SMS Gateways', href: '#integrations-sms', icon: MessageSquare },
      { id: 'integrations-pos', title: 'POS Systems', href: '#integrations-pos', icon: UtensilsCrossed },
      { id: 'integrations-apis', title: 'Third-party APIs', href: '#integrations-apis', icon: Plug },
      { id: 'integrations-smart-locks', title: 'Smart Locks', href: '#integrations-smart-locks', icon: Lock },
      { id: 'integrations-terminals', title: 'Payment Terminals', href: '#integrations-terminals', icon: CreditCard },
      { id: 'integrations-mobile-app', title: 'Mobile App', href: '#integrations-mobile-app', icon: Smartphone },
      { id: 'integrations-hardware-adapters', title: 'Hardware Adapters', href: '#integrations-hardware-adapters', icon: Lock },
      // Webhooks (merged from separate section)
      { id: 'webhooks-events', title: 'Webhook Events', href: '#webhooks-events', icon: FileText },
      { id: 'webhooks-delivery', title: 'Webhook Delivery Logs', href: '#webhooks-delivery', icon: History },
      { id: 'webhooks-retry', title: 'Webhook Retry Queue', href: '#webhooks-retry', icon: Zap },
    ],
  },

  // MERGED: Automation + AI Assistant → Automation & AI (was 2, now 1)
  {
    id: 'automationAi',
    title: 'Automation & AI',
    icon: Bot,
    category: 'addons',
    items: [
      // Automation
      { id: 'automation-workflows', title: 'Workflow Builder', href: '#automation-workflows', icon: Bot },
      { id: 'automation-rules', title: 'Rules Engine', href: '#automation-rules', icon: Zap },
      { id: 'automation-templates', title: 'Templates', href: '#automation-templates', icon: FileText },
      { id: 'automation-logs', title: 'Execution Logs', href: '#automation-logs', icon: History },
      // AI Assistant
      { id: 'ai-copilot', title: 'AI Copilot', href: '#ai-copilot', icon: Bot },
      { id: 'ai-insights', title: 'AI Insights', href: '#ai-insights', icon: Brain },
      { id: 'ai-conversational-analytics', title: 'Conversational Analytics', href: '#ai-conversational-analytics', icon: BarChart3 },
      { id: 'ai-settings', title: 'Provider Settings', href: '#ai-settings', icon: Settings },
    ],
  },

  // MERGED: Notifications (was standalone, now here)
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    category: 'addons',
    items: [
      { id: 'notifications-templates', title: 'Templates', href: '#notifications-templates', icon: FileText },
      { id: 'notifications-logs', title: 'Delivery Logs', href: '#notifications-logs', icon: History },
      { id: 'notifications-settings', title: 'Channel Settings', href: '#notifications-settings', icon: Settings },
    ],
  },

  // MERGED: Admin + SaaS Billing + Chain → Platform Admin (was 3, now 1)
  {
    id: 'platformAdmin',
    title: 'Platform Admin',
    icon: Crown,
    category: 'addons',
    items: [
      // Admin
      { id: 'admin-tenants', title: 'Tenant Management', href: '#admin-tenants', icon: Building2 },
      { id: 'admin-lifecycle', title: 'Tenant Lifecycle', href: '#admin-lifecycle', icon: RefreshCw },
      { id: 'admin-roles', title: 'Roles & Permissions', href: '#admin-roles', icon: Shield },
      { id: 'admin-users', title: 'User Management', href: '#admin-users', icon: Users },
      { id: 'admin-usage', title: 'Usage Tracking', href: '#admin-usage', icon: BarChart3 },
      { id: 'admin-revenue', title: 'Revenue Analytics', href: '#admin-revenue', icon: DollarSign },
      { id: 'admin-health', title: 'System Health', href: '#admin-health', icon: Zap },
      // SaaS Billing
      { id: 'saas-plans', title: 'SaaS Plans', href: '#saas-plans', icon: Crown },
      { id: 'saas-subscriptions', title: 'SaaS Subscriptions', href: '#saas-subscriptions', icon: RefreshCw },
      { id: 'saas-usage', title: 'SaaS Usage Billing', href: '#saas-usage', icon: BarChart3 },
      // Chain Management
      { id: 'chain-brands', title: 'Brand Management', href: '#chain-brands', icon: Building2 },
      { id: 'chain-dashboard', title: 'Chain Dashboard', href: '#chain-dashboard', icon: LayoutDashboard },
      { id: 'chain-analytics', title: 'Cross-Property Analytics', href: '#chain-analytics', icon: BarChart3 },
      // Platform-Exclusive Settings
      { id: 'settings-features', title: 'Feature Flags', href: '#settings-features', icon: Zap },
      { id: 'settings-license', title: 'License Management', href: '#settings-license', icon: Shield },
      { id: 'settings-license-keys', title: 'License Keys', href: '#settings-license-keys', icon: Key },
    ],
  },

  // =====================================================
  // USER & ROLE MANAGEMENT - Tenant Admin Accessible
  // =====================================================
  // This section is visible to tenant admins (role: admin) for managing
  // staff users and roles within their own tenant. Platform admins also
  // see the full "Platform Admin" section below with cross-tenant controls.
  {
    id: 'userRoleManagement',
    title: 'User & Role Management',
    icon: UserCog,
    category: 'base',
    items: [
      { id: 'staff-users', title: 'Users', href: '#staff-users', icon: Users },
      { id: 'staff-roles', title: 'Roles & Permissions', href: '#staff-roles', icon: Shield },
    ],
  },

  // =====================================================
  // SYSTEM - Always visible
  // =====================================================
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    category: 'base',
    items: [
      { id: 'settings-general', title: 'General Settings', href: '#settings-general', icon: Settings },
      { id: 'settings-tax', title: 'Tax & Currency', href: '#settings-tax', icon: DollarSign },
      { id: 'settings-localization', title: 'Localization', href: '#settings-localization', icon: Globe },
      { id: 'settings-gdpr', title: 'GDPR Compliance', href: '#settings-gdpr', icon: Shield },
      { id: 'settings-security', title: 'Security Settings', href: '#settings-security', icon: Settings },
      { id: 'settings-integrations', title: 'System Integrations', href: '#settings-integrations', icon: Plug },
      // Security
      { id: 'security-overview', title: 'Security Overview', href: '#security-overview', icon: Shield },
      { id: 'security-sso', title: 'SSO Configuration', href: '#security-sso', icon: Key },
      { id: 'security-sessions', title: 'Device Sessions', href: '#security-sessions', icon: Smartphone },
      { id: 'security-audit-logs', title: 'Audit Logs', href: '#security-audit-logs', icon: History },
    ],
  },
  {
    id: 'helpSupport',
    title: 'Help & Support',
    icon: GraduationCap,
    category: 'base',
    items: [
      { id: 'help-center', title: 'Help Center', href: '#help-center', icon: BookOpen },
      { id: 'help-articles', title: 'Articles', href: '#help-articles', icon: FileText },
      { id: 'help-tutorials', title: 'Tutorial Progress', href: '#help-tutorials', icon: PlayCircle },
    ],
  },
];

// =====================================================
// MENU STATISTICS
// =====================================================
// Total Sections: 27 (Security & IoT split into Surveillance & CCTV + IoT & Smart Building,
//                       Account Security items merged into Settings)
// Base Modules: 8 (Dashboard, PMS, Bookings, Front Desk, Guests,
//                        Housekeeping, Billing, Settings, Help)
// Addon Modules: 19 (Experience, Restaurant, Inventory, Facilities, WiFi,
//                       Revenue, Channels, CRM & Marketing, Ads, Reports,
//                       Staff, Surveillance & CCTV, IoT & Smart Building,
//                       Integrations, Automation & AI, Notifications, Platform Admin)
// Total Menu Items: ~172
//
// Latest changes:
// - Merged Account Security into Settings (no separate section needed)
// - Split Security & IoT → Surveillance & CCTV + IoT & Smart Building
// - CRM + Marketing → CRM & Marketing (2→1)
// - Parking + Events + Resort → Facilities (3→1)
// - Admin + SaaS Billing + Chain + Feature Flags + License → Platform Admin (3→1)
// - Integrations + Webhooks → Integrations (2→1)
// - Removed channel-cancellation-policy (duplicate of billing-cancellation-policies)
// =====================================================

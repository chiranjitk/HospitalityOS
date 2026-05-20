/**
 * Server-side SaaS Plan Configuration
 * 
 * Single source of truth for plan definitions, pricing, and limits.
 * Optimized for Indian hospitality market 2026.
 * Currency: INR · Deployment: Cloud + On-Premise
 * 
 * Key differentiators:
 * - Only PMS with integrated WiFi Gateway (on-prem)
 * - 31+ modules vs competitors' 8-15
 * - Cloud = RADIUS only; On-Prem = Full Gateway
 */

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

export interface AddonModule {
  name: string;
  price: number;
  cloud: boolean;
  onPrem: boolean;
  category: 'network' | 'operations' | 'revenue' | 'experience' | 'intelligence';
}

export interface GatewayHardware {
  id: string;
  name: string;
  tier: string;
  price: number;
  maxRooms: number;
  features: string[];
}

export interface SaaSPlanConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  deploymentType: 'cloud' | 'onprem';
  setupFee: number;
  maxProperties: number;
  maxUsers: number;
  maxRooms: number;
  storageLimitMb: number;
  features: PlanFeature[];
  addonModules: AddonModule[];
  isPopular?: boolean;
  isCustom?: boolean;
}

// ──────────────────── CLOUD PLANS (RADIUS only, no gateway) ────────────────────

const cloudPlans: SaaSPlanConfig[] = [
  {
    id: 'cloud-starter',
    name: 'cloud-starter',
    displayName: 'Starter Cloud',
    description: 'Essential PMS for small hotels & guesthouses — up to 30 rooms',
    price: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    billingPeriod: 'monthly',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 30,
    storageLimitMb: 2000,
    features: [
      { name: 'Dashboard & Analytics', included: true },
      { name: 'PMS Core', included: true },
      { name: 'Bookings Management', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guest Management', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing & Invoicing', included: true },
      { name: 'Reports', included: true },
      { name: 'Notifications', included: true },
      { name: 'Settings & Config', included: true },
      { name: 'Help & Support', included: true },
      { name: 'WiFi RADIUS', included: false },
      { name: 'POS & Restaurant', included: false },
      { name: 'Channel Manager', included: false },
      { name: 'CRM & Marketing', included: false },
    ],
    addonModules: [],
  },
  {
    id: 'cloud-professional',
    name: 'cloud-professional',
    displayName: 'Professional Cloud',
    description: 'Full-featured PMS with WiFi RADIUS — up to 80 rooms',
    price: 9999,
    yearlyPrice: 99990,
    currency: 'INR',
    billingPeriod: 'monthly',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 2,
    maxUsers: 15,
    maxRooms: 80,
    storageLimitMb: 10000,
    isPopular: true,
    features: [
      { name: 'Everything in Starter', included: true },
      { name: 'Multi-Property Support', included: true },
      { name: 'Guest Experience Module', included: true },
      { name: 'POS & Restaurant', included: true },
      { name: 'CRM & Marketing', included: true },
      { name: 'Channel Manager', included: true },
      { name: 'WiFi RADIUS Authentication', included: true },
      { name: 'Revenue Management', included: false },
      { name: 'Digital Advertising', included: false },
      { name: 'AI Assistant', included: false },
      { name: 'Surveillance', included: false },
      { name: 'IoT Smart Hotel', included: false },
    ],
    addonModules: [],
  },
  {
    id: 'cloud-enterprise',
    name: 'cloud-enterprise',
    displayName: 'Enterprise Cloud',
    description: 'Unlimited cloud PMS with all cloud-compatible modules — up to 200 rooms',
    price: 17999,
    yearlyPrice: 179990,
    currency: 'INR',
    billingPeriod: 'monthly',
    deploymentType: 'cloud',
    setupFee: 0,
    maxProperties: 5,
    maxUsers: 30,
    maxRooms: 200,
    storageLimitMb: 50000,
    isCustom: true,
    features: [
      { name: 'All Cloud-Compatible Modules', included: true },
      { name: 'Revenue Management', included: true },
      { name: 'Digital Advertising', included: true },
      { name: 'Events / MICE', included: true },
      { name: 'Staff Management', included: true },
      { name: 'AI Assistant', included: true },
      { name: 'Automation & Workflows', included: true },
      { name: 'Chain Management', included: true },
      { name: 'Priority Support', included: true },
      { name: 'WiFi RADIUS Authentication', included: true },
      { name: 'WiFi Gateway (requires on-prem)', included: false },
      { name: 'Room VLAN Isolation (requires on-prem)', included: false },
      { name: 'ZTNA Security (requires on-prem)', included: false },
    ],
    addonModules: [],
  },
];

// ──────────────────── ON-PREMISE PLANS (Full Gateway) ────────────────────

const onPremPlans: SaaSPlanConfig[] = [
  {
    id: 'onprem-professional',
    name: 'onprem-professional',
    displayName: 'Professional On-Prem',
    description: 'Full WiFi Gateway + all professional modules — data sovereignty',
    price: 14999,
    yearlyPrice: 149990,
    currency: 'INR',
    billingPeriod: 'monthly',
    deploymentType: 'onprem',
    setupFee: 75000,
    maxProperties: 2,
    maxUsers: 15,
    maxRooms: 80,
    storageLimitMb: 100000,
    isPopular: true,
    features: [
      { name: 'All Professional Cloud Features', included: true },
      { name: 'Full WiFi Gateway', included: true },
      { name: 'Captive Portal', included: true },
      { name: 'Bandwidth Management', included: true },
      { name: 'Room VLAN Isolation', included: true },
      { name: 'ZTNA Security', included: true },
      { name: 'On-Premise Data Sovereignty', included: true },
      { name: 'Surveillance Integration', included: true },
      { name: 'IoT Smart Hotel', included: false },
      { name: 'AI Assistant', included: false },
      { name: 'Automation & Workflows', included: false },
      { name: 'Chain Management', included: false },
      { name: 'Multi-Property Management', included: false },
      { name: 'Custom Development', included: false },
    ],
    addonModules: [],
  },
  {
    id: 'onprem-enterprise',
    name: 'onprem-enterprise',
    displayName: 'Enterprise On-Prem',
    description: 'Complete StaySuite with every module — unlimited scale',
    price: 24999,
    yearlyPrice: 249990,
    currency: 'INR',
    billingPeriod: 'monthly',
    deploymentType: 'onprem',
    setupFee: 150000,
    maxProperties: 10,
    maxUsers: 999,
    maxRooms: 9999,
    storageLimitMb: 500000,
    isCustom: true,
    features: [
      { name: 'Everything in Professional On-Prem', included: true },
      { name: 'Multi-Property Management', included: true },
      { name: 'Chain Management Module', included: true },
      { name: 'AI Assistant', included: true },
      { name: 'Automation & Workflows', included: true },
      { name: 'IoT Smart Hotel', included: true },
      { name: 'Priority Support & SLA', included: true },
      { name: 'Custom Development', included: true },
      { name: 'Dedicated Account Manager', included: true },
      { name: '24/7 Phone Support', included: true },
    ],
    addonModules: [],
  },
];

// ──────────────────── ADD-ON MODULES ────────────────────

export const ADDON_MODULES: AddonModule[] = [
  // Network & Security
  { name: 'WiFi RADIUS (Cloud)', price: 1499, cloud: true, onPrem: true, category: 'network' },
  { name: 'WiFi Gateway (On-Prem only)', price: 3999, cloud: false, onPrem: true, category: 'network' },
  { name: 'Room VLAN Isolation', price: 999, cloud: false, onPrem: true, category: 'network' },
  { name: 'ZTNA Security', price: 999, cloud: false, onPrem: true, category: 'network' },
  // Operations
  { name: 'POS & Restaurant', price: 1999, cloud: true, onPrem: true, category: 'operations' },
  { name: 'Staff Management', price: 999, cloud: true, onPrem: true, category: 'operations' },
  { name: 'Surveillance', price: 1999, cloud: true, onPrem: true, category: 'operations' },
  { name: 'Chain Management', price: 2499, cloud: true, onPrem: true, category: 'operations' },
  // Revenue & Growth
  { name: 'Revenue Management', price: 1499, cloud: true, onPrem: true, category: 'revenue' },
  { name: 'Channel Manager', price: 1499, cloud: true, onPrem: true, category: 'revenue' },
  { name: 'CRM & Marketing', price: 999, cloud: true, onPrem: true, category: 'revenue' },
  { name: 'Digital Advertising', price: 999, cloud: true, onPrem: true, category: 'revenue' },
  // Guest Experience
  { name: 'Guest Experience Module', price: 999, cloud: true, onPrem: true, category: 'experience' },
  { name: 'Events / MICE', price: 999, cloud: true, onPrem: true, category: 'experience' },
  // Intelligence & AI
  { name: 'IoT Smart Hotel', price: 1499, cloud: true, onPrem: true, category: 'intelligence' },
  { name: 'AI Assistant', price: 1999, cloud: true, onPrem: true, category: 'intelligence' },
  { name: 'Automation & Workflows', price: 999, cloud: true, onPrem: true, category: 'intelligence' },
];

// ──────────────────── GATEWAY HARDWARE OPTIONS ────────────────────

export const GATEWAY_HARDWARE: GatewayHardware[] = [
  {
    id: 'mikrotik-base',
    name: 'MikroTik Base',
    tier: 'Entry',
    price: 45000,
    maxRooms: 30,
    features: [
      'MikroTik hAP ac³',
      'RADIUS Server',
      'Captive Portal',
      'Basic Bandwidth Management',
    ],
  },
  {
    id: 'intel-nuc-standard',
    name: 'Intel NUC Standard',
    tier: 'Recommended',
    price: 75000,
    maxRooms: 80,
    features: [
      'Intel NUC i5 + 16GB RAM',
      'Full RADIUS + Captive Portal',
      'Advanced Bandwidth Management',
      'Room VLAN Isolation',
      'ZTNA Security',
    ],
  },
  {
    id: 'intel-nuc-premium',
    name: 'Intel NUC Premium',
    tier: 'Enterprise',
    price: 120000,
    maxRooms: 200,
    features: [
      'Intel NUC i7 + 32GB RAM',
      'Full Gateway Suite',
      'Advanced VLAN + ZTNA',
      'IoT Bridge Support',
      'Redundant Configuration',
      'Priority Hardware Support',
    ],
  },
];

// ──────────────────── MARKET INTELLIGENCE DATA ────────────────────

export const MARKET_DATA = {
  indiaHospitality: { value2025: 24.36, value2026: 27.96, unit: 'Billion USD' },
  globalPMS: { value2026: 5.74, cagr: 8.8, unit: 'Billion USD' },
  cloudPMSRevenue: 2.4,
  cloudPMSPercent: 65,
  indiaRooms: '3.5M+',
  aiAdoption: 60,
  techBudgetExpansion: 76,
  gstHotel: '5% (≤₹7,500/day)',
  gstSaaS: '18%',
};

export const COMPETITORS = [
  { name: 'Hotelogix', pricing: '₹330–₹500/room/mo', modules: 10, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'eZee Absolute', pricing: '₹4,500–₹15,000/mo', modules: 12, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'Cloudbeds', pricing: '$50–80/mo (<20 rooms)', modules: 11, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'DJUBO', pricing: '₹2,639–₹8,000/mo', modules: 8, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'Oracle OPERA', pricing: '$22,855+ setup', modules: 15, wifi: false, gateway: false, onPrem: true, deployment: 'On-Prem/Cloud' },
];

export const WIFI_COMPETITORS = [
  { name: 'Spotipo', pricing: '$59–$79/location/mo', type: 'Cloud captive portal' },
  { name: 'StayFi', pricing: '$15–$19/month', type: 'Cloud WiFi marketing' },
  { name: 'YesSpot', pricing: '$0.15–0.25/user', type: 'Cloud hotspot (MikroTik)' },
  { name: 'Nomadix EG1000', pricing: '$999+ hardware', type: 'On-premise gateway' },
  { name: 'Adentro', pricing: '$150–$250/location/mo', type: 'Cloud captive portal' },
  { name: 'MikroTik Router', pricing: '₹6,000 one-time', type: 'Hardware only' },
];

// Combine all plans
const defaultPlans: SaaSPlanConfig[] = [...cloudPlans, ...onPremPlans];

// In-memory plan registry — can be extended with DB persistence
let planRegistry: SaaSPlanConfig[] = [...defaultPlans];

/**
 * Get all plan configurations
 */
export function getPlans(): SaaSPlanConfig[] {
  return [...planRegistry];
}

/**
 * Get cloud plans only
 */
export function getCloudPlans(): SaaSPlanConfig[] {
  return planRegistry.filter(p => p.deploymentType === 'cloud');
}

/**
 * Get on-prem plans only
 */
export function getOnPremPlans(): SaaSPlanConfig[] {
  return planRegistry.filter(p => p.deploymentType === 'onprem');
}

/**
 * Get a single plan by ID (or plan name)
 */
export function getPlan(planId: string): SaaSPlanConfig | undefined {
  return planRegistry.find(p => p.id === planId || p.name === planId);
}

/**
 * Get plan price by plan name — used for revenue calculations
 */
export function getPlanPrice(planName: string): number {
  const plan = getPlan(planName);
  return plan?.price ?? 0;
}

/**
 * Create a new plan configuration
 */
export function createPlan(config: SaaSPlanConfig): SaaSPlanConfig {
  if (planRegistry.some(p => p.id === config.id || p.name === config.name)) {
    throw new Error(`Plan with id "${config.id}" or name "${config.name}" already exists`);
  }
  planRegistry.push(config);
  return config;
}

/**
 * Update an existing plan configuration
 */
export function updatePlan(planId: string, updates: Partial<Omit<SaaSPlanConfig, 'id' | 'name'>>): SaaSPlanConfig | undefined {
  const index = planRegistry.findIndex(p => p.id === planId);
  if (index === -1) return undefined;
  planRegistry[index] = { ...planRegistry[index], ...updates };
  return planRegistry[index];
}

/**
 * Soft-delete a plan by marking it inactive (remove from registry)
 * Returns the removed plan or undefined
 */
export function deletePlan(planId: string): SaaSPlanConfig | undefined {
  const index = planRegistry.findIndex(p => p.id === planId);
  if (index === -1) return undefined;
  const [removed] = planRegistry.splice(index, 1);
  return removed;
}

/**
 * Validate plan update payload server-side
 */
export function validatePlanPayload(payload: Record<string, unknown>): { valid: boolean; error?: string } {
  if (typeof payload.displayName !== 'string' || payload.displayName.trim().length === 0) {
    return { valid: false, error: 'displayName is required' };
  }
  if (payload.price !== undefined && (typeof payload.price !== 'number' || payload.price < 0)) {
    return { valid: false, error: 'price must be a non-negative number' };
  }
  if (payload.maxProperties !== undefined && (typeof payload.maxProperties !== 'number' || payload.maxProperties < 1)) {
    return { valid: false, error: 'maxProperties must be a positive integer' };
  }
  if (payload.maxUsers !== undefined && (typeof payload.maxUsers !== 'number' || payload.maxUsers < 1)) {
    return { valid: false, error: 'maxUsers must be a positive integer' };
  }
  if (payload.maxRooms !== undefined && (typeof payload.maxRooms !== 'number' || payload.maxRooms < 1)) {
    return { valid: false, error: 'maxRooms must be a positive integer' };
  }
  if (payload.storageLimitMb !== undefined && (typeof payload.storageLimitMb !== 'number' || payload.storageLimitMb < 100)) {
    return { valid: false, error: 'storageLimitMb must be at least 100' };
  }
  return { valid: true };
}

/**
 * Get usage-based billing rates per plan
 */
export interface OverageRates {
  apiCallOveragePerUnit: number;
  storageOveragePerMb: number;
  messageOveragePerUnit: number;
}

export function getOverageRates(planName: string): OverageRates {
  // Enterprise plans have lower overage rates
  if (planName.includes('enterprise')) {
    return { apiCallOveragePerUnit: 0.0005, storageOveragePerMb: 0.05, messageOveragePerUnit: 0.005 };
  }
  if (planName.includes('professional')) {
    return { apiCallOveragePerUnit: 0.001, storageOveragePerMb: 0.10, messageOveragePerUnit: 0.01 };
  }
  return { apiCallOveragePerUnit: 0.002, storageOveragePerMb: 0.15, messageOveragePerUnit: 0.02 };
}

/**
 * Calculate API call limit for a given plan
 */
export function getApiCallLimit(planName: string): number {
  if (planName.includes('enterprise')) return 500000;
  if (planName.includes('professional')) return 100000;
  if (planName.includes('starter')) return 25000;
  return 5000;
}

/**
 * Calculate message limit for a given plan
 */
export function getMessageLimit(planName: string): number {
  if (planName.includes('enterprise')) return 100000;
  if (planName.includes('professional')) return 50000;
  if (planName.includes('starter')) return 10000;
  return 5000;
}

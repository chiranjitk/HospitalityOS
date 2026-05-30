import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// Portal Design Utilities — Shared CSS/Style helpers for portal rendering
//
// Used by both:
//   - Design Preview (admin panel designer tab)
//   - Live Captive Portal (/connect page)
//
// KEY PRINCIPLE: Card text/icon/input colors depend on the CARD background,
// NOT the page background. Non-glass/non-minimal form styles (rounded, square, pill)
// always render a white/light card background even on dark pages. So text inside
// those cards must always be dark for readability.
//
// Only glass and minimal form styles have transparent/dark card backgrounds,
// so they can use white text on dark pages.
// ═══════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// Design Settings Interface
// ────────────────────────────────────────────────────────────

export interface DesignSettings {
  layoutType: 'centered' | 'split_left' | 'split_right' | 'card' | 'full_bleed';
  backgroundType: 'solid' | 'gradient' | 'image';
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  backgroundOverlay: number;
  fontFamily: string;
  headingFontFamily: string;
  formStyle: 'rounded' | 'square' | 'glass' | 'pill' | 'minimal';
  inputStyle: 'rounded' | 'square' | 'pill' | 'underline';
  buttonStyle: 'filled' | 'outlined' | 'gradient' | 'pill' | 'rounded';
  buttonSize: 'small' | 'medium' | 'large';
  cardShadow: 'none' | 'small' | 'medium' | 'large';
  animationType: 'none' | 'fade' | 'slide_up' | 'zoom';
  welcomeMessage: string;
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelWebsite: string;
  showHotelInfo: boolean;
  amenities: string[];
  showAmenities: boolean;
  showSocialMedia: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  showClock: boolean;
  showWeather: boolean;
  promotionTitle: string;
  promotionDesc: string;
  showPromotion: boolean;

  // ── Feature 1: Multi-Language Portal ──
  languages: string[];
  defaultLanguage: string;
  /** Per-language translations for admin-defined content.
   *  Shape: { "es": { "title": "Bienvenido", "subtitle": "Conectarse al WiFi", ... }, ... }
   *  Supported keys: title, subtitle, welcomeMessage, termsText, promotionTitle,
   *  promotionDesc, hotelName, hotelAddress, marketingConsentText,
   *  surveyQuestion, surveyThankYou, hotelPhoneLabel, hotelWebsiteLabel */
  translations: Record<string, Record<string, string>>;

  // ── Feature 2: Guest Marketing Opt-In ──
  marketingOptIn: {
    enabled: boolean;
    emailConsent: boolean;
    phoneConsent: boolean;
    consentText: string;
  };

  // ── Feature 3: Multi-Slide Promotion Carousel ──
  promotions: Array<{
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    linkUrl: string;
    backgroundColor: string;
  }>;
  showPromotions: boolean;

  // ── Feature 4: Post-Connect Guest Survey ──
  surveyConfig: {
    enabled: boolean;
    question: string;
    options: string[];
    thankYouMessage: string;
  };

  // ── Feature 5: Weather Widget ──
  weatherLocation: string;

  // ── Feature 6: Terms & Conditions Editor ──
  termsText: string;
  termsUrl: string;

  // ── Feature 7: Custom Amenities ──
  customAmenities: Array<{
    name: string;
    icon: string;
  }>;

  // ── Feature 9: Content Block Reordering ──
  contentBlockOrder: string[];

  // ── Feature 14: Portal Scheduling ──
  scheduleConfig: {
    enabled: boolean;
    schedules: Array<{
      id: string;
      name: string;
      days: number[];
      startTime: string;
      endTime: string;
      designOverrides: Record<string, unknown>;
    }>;
  };
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  layoutType: 'centered',
  backgroundType: 'solid',
  gradientFrom: '#0f766e',
  gradientTo: '#134e4a',
  gradientAngle: 135,
  backgroundOverlay: 40,
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  formStyle: 'rounded',
  inputStyle: 'rounded',
  buttonStyle: 'filled',
  buttonSize: 'medium',
  cardShadow: 'medium',
  animationType: 'fade',
  welcomeMessage: 'Enjoy your stay with us',
  hotelName: '',
  hotelAddress: '',
  hotelPhone: '',
  hotelWebsite: '',
  showHotelInfo: false,
  amenities: [],
  showAmenities: false,
  showSocialMedia: false,
  socialLinks: [],
  showClock: false,
  showWeather: false,
  promotionTitle: '',
  promotionDesc: '',
  showPromotion: false,

  // Multi-Language
  languages: [],
  defaultLanguage: 'en',

  // Marketing Opt-In
  marketingOptIn: {
    enabled: false,
    emailConsent: false,
    phoneConsent: false,
    consentText: '',
  },

  // Multi-Slide Carousel
  promotions: [],
  showPromotions: false,

  // Post-Connect Survey
  surveyConfig: {
    enabled: false,
    question: '',
    options: [],
    thankYouMessage: '',
  },

  // Weather Widget
  weatherLocation: '',

  // Terms & Conditions
  termsText: '',
  termsUrl: '',

  // Custom Amenities
  customAmenities: [],

  // Content Block Order
  contentBlockOrder: [],

  // Portal Scheduling
  scheduleConfig: {
    enabled: false,
    schedules: [],
  },
};

// ────────────────────────────────────────────────────────────
// Full Design Config (what resolve-zone API returns inside `design`)
// ────────────────────────────────────────────────────────────

export interface PortalDesignConfig {
  layoutType: string;
  backgroundType: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  backgroundImage: string;
  backgroundOverlay: number;
  fontFamily: string;
  headingFontFamily: string;
  formStyle: string;
  inputStyle: string;
  buttonStyle: string;
  buttonSize: string;
  cardShadow: string;
  animationType: string;
  logoSize: string;
  welcomeMessage: string;
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelWebsite: string;
  logoUrl: string;
  showHotelInfo: boolean;
  amenities: string[];
  showAmenities: boolean;
  showSocialMedia: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  showClock: boolean;
  showWeather: boolean;
  promotionTitle: string;
  promotionDesc: string;
  showPromotion: boolean;
  termsText: string;
  termsUrl: string;
  showBranding: boolean;
  title: string;
  subtitle: string;
  gradientAngle?: number;

  // ── Feature 1: Multi-Language Portal ──
  languages: string[];
  defaultLanguage: string;
  /** Per-language translations for admin-defined content.
   *  Shape: { "es": { "title": "Bienvenido", "subtitle": "Conectarse al WiFi", ... }, ... }
   *  Supported keys: title, subtitle, welcomeMessage, termsText, promotionTitle,
   *  promotionDesc, hotelName, hotelAddress, marketingConsentText,
   *  surveyQuestion, surveyThankYou */
  translations: Record<string, Record<string, string>>;

  // ── Feature 2: Guest Marketing Opt-In ──
  marketingOptIn: {
    enabled: boolean;
    emailConsent: boolean;
    phoneConsent: boolean;
    consentText: string;
  };

  // ── Feature 3: Multi-Slide Promotion Carousel ──
  promotions: Array<{
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    linkUrl: string;
    backgroundColor: string;
  }>;
  showPromotions: boolean;

  // ── Feature 4: Post-Connect Guest Survey ──
  surveyConfig: {
    enabled: boolean;
    question: string;
    options: string[];
    thankYouMessage: string;
  };

  // ── Feature 5: Weather Widget ──
  weatherLocation: string;

  // ── Feature 7: Custom Amenities ──
  customAmenities: Array<{
    name: string;
    icon: string;
  }>;

  // ── Feature 9: Content Block Reordering ──
  contentBlockOrder: string[];

  // ── Feature 14: Portal Scheduling ──
  scheduleConfig: {
    enabled: boolean;
    schedules: Array<{
      id: string;
      name: string;
      days: number[];
      startTime: string;
      endTime: string;
      designOverrides: Record<string, unknown>;
    }>;
  };
}

export const DEFAULT_PORTAL_DESIGN: PortalDesignConfig = {
  layoutType: 'centered',
  backgroundType: 'gradient',
  gradientFrom: '#0ea5e9',
  gradientTo: '#065f46',
  backgroundColor: '#0f766e',
  textColor: '#fafafa',
  accentColor: '#14b8a6',
  backgroundImage: '',
  backgroundOverlay: 40,
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  formStyle: 'rounded',
  inputStyle: 'rounded',
  buttonStyle: 'filled',
  buttonSize: 'medium',
  cardShadow: 'medium',
  animationType: 'fade',
  logoSize: 'large',
  welcomeMessage: 'Enjoy your stay',
  hotelName: '',
  hotelAddress: '',
  hotelPhone: '',
  hotelWebsite: '',
  logoUrl: '',
  showHotelInfo: false,
  amenities: [],
  showAmenities: false,
  showSocialMedia: false,
  socialLinks: [],
  showClock: false,
  showWeather: false,
  promotionTitle: '',
  promotionDesc: '',
  showPromotion: false,
  termsText: '',
  termsUrl: '',
  showBranding: false,
  title: 'Welcome',
  subtitle: 'Connect to WiFi',
  gradientAngle: 135,

  // Multi-Language
  languages: [],
  defaultLanguage: 'en',
  translations: {},

  // Marketing Opt-In
  marketingOptIn: {
    enabled: false,
    emailConsent: false,
    phoneConsent: false,
    consentText: '',
  },

  // Multi-Slide Carousel
  promotions: [],
  showPromotions: false,
  useCarouselMode: false,

  // Post-Connect Survey
  surveyConfig: {
    enabled: false,
    question: '',
    options: [],
    thankYouMessage: '',
  },

  // Weather Widget
  weatherLocation: '',

  // Custom Amenities
  customAmenities: [],

  // Content Block Order
  contentBlockOrder: [],

  // Portal Scheduling
  scheduleConfig: {
    enabled: false,
    schedules: [],
  },
};

// ────────────────────────────────────────────────────────────
// Background & Card Detection Helpers
// ────────────────────────────────────────────────────────────

/** Is the PAGE background dark? (gradient, image, or dark solid) */
export function isDarkBackground(design: PortalDesignConfig): boolean {
  if (design.backgroundType === 'gradient') return true;
  if (design.backgroundType === 'image') return true;
  const bg = design.backgroundColor || '#0f766e';
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Is the FORM CARD background transparent/dark?
 * Only glass and minimal styles have transparent card backgrounds.
 * All other styles (rounded, square, pill) render white/light card backgrounds
 * even when the page background is dark.
 */
export function isCardTransparent(design: PortalDesignConfig): boolean {
  return design.formStyle === 'glass' || design.formStyle === 'minimal';
}

// ────────────────────────────────────────────────────────────
// Background CSS Generation
// ────────────────────────────────────────────────────────────

export function getBackgroundStyle(design: PortalDesignConfig): React.CSSProperties {
  if (design.backgroundType === 'gradient') {
    const angle = design.gradientAngle || 135;
    return {
      background: `linear-gradient(${angle}deg, ${design.gradientFrom}, ${design.gradientTo})`,
    };
  }
  if (design.backgroundType === 'image' && design.backgroundImage) {
    return {
      backgroundImage: `url(${design.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {
    backgroundColor: design.backgroundColor || design.gradientFrom || '#0f766e',
  };
}

export function getBackgroundCSSValue(design: PortalDesignConfig): string {
  if (design.backgroundType === 'gradient') {
    const angle = design.gradientAngle || 135;
    return `linear-gradient(${angle}deg, ${design.gradientFrom}, ${design.gradientTo})`;
  }
  if (design.backgroundType === 'image' && design.backgroundImage) {
    return `url(${design.backgroundImage}) center/cover`;
  }
  return design.backgroundColor || design.gradientFrom || '#0f766e';
}

// ────────────────────────────────────────────────────────────
// Overlay Style (for image backgrounds)
// ────────────────────────────────────────────────────────────

export function getOverlayStyle(design: PortalDesignConfig): React.CSSProperties {
  if (design.backgroundType === 'image' && design.backgroundOverlay > 0) {
    return { backgroundColor: `rgba(0,0,0,${design.backgroundOverlay / 100})` };
  }
  return {};
}

// ────────────────────────────────────────────────────────────
// Form Container Classes (based on formStyle)
// ────────────────────────────────────────────────────────────

export function getFormContainerClasses(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  let cls = 'p-6 sm:p-8 space-y-5';

  // Premium glassmorphism styling — matches /portal/captive quality
  if (design.formStyle === 'glass') {
    cls += dark
      ? ' bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]'
      : ' bg-white/95 backdrop-blur-2xl border border-gray-200';
  } else if (design.formStyle === 'minimal') {
    cls += ' bg-transparent';
  } else {
    // rounded, square, pill — premium glass on dark, solid on light
    cls += dark
      ? ' bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]'
      : ' bg-white';
    if (design.formStyle === 'pill') {
      cls += ' border border-white/[0.08]';
    } else if (dark) {
      cls += ' border border-white/[0.08]';
    }
  }

  // Border radius
  if (design.formStyle === 'pill') {
    cls += ' rounded-3xl';
  } else if (design.formStyle === 'square') {
    cls += ' rounded-none';
  } else {
    cls += ' rounded-2xl';
  }

  return cls;
}

// ────────────────────────────────────────────────────────────
// Card Shadow CSS
// ────────────────────────────────────────────────────────────

export function getCardShadowCSS(design: PortalDesignConfig): React.CSSProperties {
  const dark = isDarkBackground(design);
  const accent = design.accentColor || '#14b8a6';
  switch (design.cardShadow) {
    case 'large':
      return dark
        ? { boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px -10px ${accent}15` }
        : { boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
    case 'medium':
      return dark
        ? { boxShadow: `0 20px 40px -12px rgba(0,0,0,0.4), 0 0 40px -8px ${accent}10` }
        : { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' };
    case 'small':
      return dark
        ? { boxShadow: `0 8px 16px -4px rgba(0,0,0,0.3), 0 0 20px -6px ${accent}08` }
        : { boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' };
    case 'none':
      return { boxShadow: 'none' };
    default:
      return dark
        ? { boxShadow: `0 20px 40px -12px rgba(0,0,0,0.4), 0 0 40px -8px ${accent}10` }
        : { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' };
  }
}

// ────────────────────────────────────────────────────────────
// Text Color — depends on CARD background, NOT page background
// ────────────────────────────────────────────────────────────

/**
 * Card text color for labels, headings inside the form card.
 * - Dark page background → white text (all form styles are semi-transparent on dark)
 * - Light page background + glass/minimal → dark text
 * - Light page background + others → dark text (card has white background)
 */
export function getCardTextColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (dark) return '#ffffff';
  // Light page backgrounds — all cards are white-ish → dark text
  return '#1f2937';
}

/** Subtitle color — this is OUTSIDE the card, on the page background */
export function getSubtitleColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (dark) return 'rgba(255,255,255,0.8)';
  return 'rgba(0,0,0,0.6)';
}

/**
 * Muted text color inside the form card.
 * - Dark page background → light muted (all form styles are semi-transparent)
 * - Light page background → dark muted (card is white)
 */
export function getMutedTextColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (dark) return 'rgba(255,255,255,0.7)';
  return 'rgba(0,0,0,0.5)';
}

// ────────────────────────────────────────────────────────────
// Input Field Classes (based on inputStyle + formStyle)
// ────────────────────────────────────────────────────────────

/**
 * Input classes. Text and border colors depend on PAGE background.
 * - Dark page → white text, white/20 borders (all form styles are semi-transparent)
 * - Light page → dark text, gray borders (card is white)
 */
export function getInputClasses(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  const accent = design.accentColor || '#14b8a6';
  // On dark backgrounds, ALL form styles are semi-transparent → use light colors
  const useLight = dark;

  let cls = 'w-full h-12 text-base focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  // Border styling — premium glass inputs on dark backgrounds
  if (design.inputStyle === 'underline') {
    if (useLight) {
      cls += ' border-0 border-b-2 px-1 py-3 bg-transparent border-white/30';
    } else {
      cls += ' border-0 border-b-2 px-1 py-3 bg-transparent border-gray-300';
    }
  } else if (design.inputStyle === 'pill') {
    if (useLight) {
      cls += ' bg-white/[0.04] border border-white/[0.1] rounded-full px-4 py-3 focus-visible:border-white/20';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-full px-4 py-3';
    }
  } else if (design.inputStyle === 'square') {
    if (useLight) {
      cls += ' bg-white/[0.04] border border-white/[0.1] rounded-none px-3 py-3 focus-visible:border-white/20';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-none px-3 py-3';
    }
  } else {
    // rounded (default) — premium glass matching /portal/captive
    if (useLight) {
      cls += ' bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 focus-visible:border-white/20';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-xl px-4 py-3';
    }
  }

  // Text color
  if (useLight) {
    cls += ' text-white placeholder:text-white/25';
  } else {
    cls += ' text-gray-800 placeholder:text-gray-400';
  }

  // Focus ring — accent color glow on dark
  if (useLight) {
    cls += ` focus-visible:ring-[${accent}20] focus-visible:ring-2 focus-visible:ring-offset-0`;
  }

  return cls;
}

/** Input classes with left icon padding */
export function getInputWithIconClasses(design: PortalDesignConfig): string {
  const base = getInputClasses(design);

  if (design.inputStyle === 'underline') {
    return base; // underline already has px-1
  }

  if (design.inputStyle === 'pill') {
    return base.replace('px-4', 'pl-10 pr-4');
  } else if (design.inputStyle === 'square') {
    return base.replace('px-3', 'pl-10 pr-3');
  } else {
    return base.replace('px-4', 'pl-10 pr-4');
  }
}

// ────────────────────────────────────────────────────────────
// Button Classes (based on buttonStyle + buttonSize)
// ────────────────────────────────────────────────────────────

export interface ButtonStyleResult {
  className: string;
  style: React.CSSProperties;
}

export function getButtonClasses(
  design: PortalDesignConfig,
  accentColor?: string
): ButtonStyleResult {
  const color = accentColor || design.accentColor || '#14b8a6';
  const glass = isCardTransparent(design);
  const dark = isDarkBackground(design);

  let className = 'w-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]';
  let style: React.CSSProperties = {};

  // Size
  switch (design.buttonSize) {
    case 'large':
      className += ' px-6 py-4 text-base';
      break;
    case 'small':
      className += ' px-4 py-2.5 text-sm';
      break;
    default:
      className += ' px-5 py-3 text-sm';
      break;
  }

  // Style type — premium styling with gradient, shadow, and hover scale
  switch (design.buttonStyle) {
    case 'gradient': {
      className += ' text-white hover:opacity-90 hover:scale-[1.02]';
      style = {
        background: `linear-gradient(135deg, ${design.gradientFrom || color}, ${design.gradientTo || color})`,
        boxShadow: dark ? `0 4px 14px ${color}40` : `0 4px 14px rgba(0,0,0,0.15)`,
      };
      break;
    }
    case 'outlined': {
      // Outlined button: always use accent color, text adapts to card bg
      if (glass && dark) {
        className += ' border-2 border-white/40 text-white hover:bg-white/10 bg-transparent';
        style = {};
      } else {
        className += ' border-2 bg-transparent hover:opacity-90';
        style = { borderColor: color, color };
      }
      break;
    }
    case 'pill': {
      className += ' text-white hover:opacity-90 hover:scale-[1.02]';
      style = { backgroundColor: color, borderRadius: '9999px', boxShadow: dark ? `0 4px 14px ${color}40` : '0 4px 14px rgba(0,0,0,0.15)' };
      break;
    }
    case 'rounded': {
      className += ' text-white hover:opacity-90 hover:scale-[1.02]';
      style = { backgroundColor: color, borderRadius: '0.5rem', boxShadow: dark ? `0 4px 14px ${color}40` : '0 4px 14px rgba(0,0,0,0.15)' };
      break;
    }
    default: {
      // filled — premium with accent glow and hover scale
      className += ' text-white hover:opacity-90 hover:scale-[1.02]';
      style = { backgroundColor: color, boxShadow: dark ? `0 4px 14px ${color}40` : '0 4px 14px rgba(0,0,0,0.15)' };
      break;
    }
  }

  // Border radius from form style (except pill/rounded which are already set)
  if (design.buttonStyle !== 'pill' && design.buttonStyle !== 'rounded') {
    if (design.formStyle === 'pill') {
      style.borderRadius = '9999px';
    } else if (design.formStyle === 'square') {
      style.borderRadius = '0';
    } else if (glass) {
      // Keep default from buttonStyle
    } else {
      style.borderRadius = '0.75rem';
    }
  }

  return { className, style };
}

// ────────────────────────────────────────────────────────────
// Icon color inside inputs
// ────────────────────────────────────────────────────────────

/**
 * Icon color for input icons.
 * - Dark page background → white/low-opacity icons (all styles semi-transparent)
 * - Light page background → gray icons (card is white)
 */
export function getIconColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (dark) return 'rgba(255,255,255,0.35)'; // subtler — matches /portal/captive muted feel
  return '#9ca3af'; // gray-400
}

// ────────────────────────────────────────────────────────────
// Input focus border color
// ────────────────────────────────────────────────────────────

export function getInputFocusStyle(design: PortalDesignConfig): React.CSSProperties {
  return { borderColor: design.accentColor || '#14b8a6' };
}

// ────────────────────────────────────────────────────────────
// Animation classes (based on animationType)
// ────────────────────────────────────────────────────────────

export function getAnimationClasses(design: PortalDesignConfig): string {
  switch (design.animationType) {
    case 'fade':
      return 'animate-in fade-in duration-500';
    case 'slide_up':
      return 'animate-in slide-in-from-bottom-4 duration-500';
    case 'zoom':
      return 'animate-in zoom-in-95 duration-500';
    case 'none':
    default:
      return '';
  }
}

// ─�───────────────────────────────────────────────────────────
// Social media icon helper
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Premium Visual Enhancement Helpers
// ────────────────────────────────────────────────────────────

/** CSS for a floating card animation */
export function getFloatingCardAnimation(): React.CSSProperties {
  return {
    animation: 'portalFloat 6s ease-in-out infinite',
  };
}

/** Generate the floating keyframes */
export function getFloatingKeyframes(): string {
  return `
    @keyframes portalFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
  `;
}

/** Generate animated WiFi signal wave keyframes for loading state */
export function getWifiWaveKeyframes(): string {
  return `
    @keyframes wifiWave1 { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
    @keyframes wifiWave2 { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
    @keyframes wifiWave3 { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
    @keyframes successPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes sparkleFloat {
      0% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      100% { opacity: 0; transform: translateY(-60px) scale(0) rotate(180deg); }
    }
    @keyframes checkDraw {
      0% { stroke-dashoffset: 48; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes circleScale {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes connectedBadge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes fadeInUp {
      0% { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes shakeIn {
      0% { transform: translateX(-8px); opacity: 0; }
      25% { transform: translateX(6px); opacity: 1; }
      50% { transform: translateX(-4px); }
      75% { transform: translateX(2px); }
      100% { transform: translateX(0); }
    }
    @keyframes shimmerSweep {
      0% { transform: translateX(-100%) rotate(25deg); }
      100% { transform: translateX(200%) rotate(25deg); }
    }
  `;
}

/** Get the glowing border style for form card on dark backgrounds */
export function getCardGlowStyle(design: PortalDesignConfig): React.CSSProperties {
  const dark = isDarkBackground(design);
  const accent = design.accentColor || '#14b8a6';
  if (!dark) return {};
  return {
    boxShadow: `0 0 0 1px ${accent}15, 0 0 30px -5px ${accent}20, 0 8px 32px -8px rgba(0,0,0,0.4)`,
  };
}

/** Get error display styles that adapt to card background */
export function getErrorDisplayStyle(design: PortalDesignConfig): { bg: string; text: string; border: string } {
  const dark = isDarkBackground(design);
  if (dark) {
    return {
      bg: 'rgba(239, 68, 68, 0.08)',
      text: '#fca5a5',
      border: 'rgba(239, 68, 68, 0.15)',
    };
  }
  return {
    bg: 'rgba(254, 226, 226, 0.9)',
    text: '#dc2626',
    border: 'rgba(239, 68, 68, 0.2)',
  };
}

/** Get accent glow input focus ring */
export function getInputFocusGlow(design: PortalDesignConfig): React.CSSProperties {
  const accent = design.accentColor || '#14b8a6';
  return {
    boxShadow: `0 0 0 3px ${accent}20, 0 0 12px -2px ${accent}30`,
    borderColor: accent,
  };
}

/** Generate portal CSS keyframes bundle */
export function getPortalCSSKeyframes(design: PortalDesignConfig): string {
  return `
    ${getFloatingKeyframes()}
    ${getWifiWaveKeyframes()}
  `;
}

// ────────────────────────────────────────────────────────────
// Social media icon helper
// ────────────────────────────────────────────────────────────

export function getSocialIconLabel(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'facebook': return 'f';
    case 'instagram': return 'IG';
    case 'twitter': return 'X';
    case 'linkedin': return 'in';
    case 'youtube': return '\u25B6';
    case 'tripadvisor': return 'TA';
    default: return platform.charAt(0).toUpperCase();
  }
}

// ────────────────────────────────────────────────────────────
// Merge design config with defaults
// ────────────────────────────────────────────────────────────

export function mergeDesignConfig(partial: Partial<PortalDesignConfig>): PortalDesignConfig {
  return { ...DEFAULT_PORTAL_DESIGN, ...partial };
}

// ────────────────────────────────────────────────────────────
// Logo size helper (Feature 10: Card Shadow Control)
// ────────────────────────────────────────────────────────────

/** Convert logo size label to pixel value */
export function getLogoSizePx(logoSize: string): number {
  switch (logoSize) {
    case 'small': return 40;
    case 'medium': return 56;
    case 'large': return 72;
    case 'xlarge': return 96;
    default: return 72;
  }
}

// ────────────────────────────────────────────────────────────
// Language label helper (Feature 1: Multi-Language)
// ────────────────────────────────────────────────────────────

/** Get a human-readable label for a language code */
export function getLanguageLabel(code: string): string {
  const labels: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    ar: 'العربية',
    hi: 'हिन्दी',
    pt: 'Português',
    ru: 'Русский',
    it: 'Italiano',
    nl: 'Nederlands',
    th: 'ไทย',
    vi: 'Tiếng Việt',
    tr: 'Türkçe',
  };
  return labels[code] || code.toUpperCase();
}

// ────────────────────────────────────────────────────────────
// Social platform brand color (Feature 8: More Social Platforms)
// ────────────────────────────────────────────────────────────

/** Get the official brand color for a social media platform */
export function getSocialPlatformColor(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'instagram': return '#E4405F';
    case 'facebook': return '#1877F2';
    case 'twitter': return '#1DA1F2';
    case 'linkedin': return '#0A66C2';
    case 'youtube': return '#FF0000';
    case 'tripadvisor': return '#34E0A1';
    case 'whatsapp': return '#25D366';
    case 'tiktok': return '#000000';
    default: return '#6B7280';
  }
}

// ────────────────────────────────────────────────────────────
// Multi-Language Translation Helpers (Feature 1)
// ────────────────────────────────────────────────────────────

/**
 * Built-in translations for portal UI chrome strings (buttons, labels, etc.)
 * These cover the fixed strings that aren't admin-editable.
 * Admin-editable content (title, subtitle, etc.) uses `getLocalizedText()` with
 * the `translations` map stored in the design config.
 */
export const PORTAL_UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    connect: 'Connect',
    connectNow: 'Connect Now',
    connectToWiFi: 'Connect to WiFi',
    signIn: 'Sign In',
    signInWithRoom: 'Sign In with Room',
    voucherCode: 'Voucher Code',
    roomNumber: 'Room Number',
    lastName: 'Last Name',
    firstName: 'First Name',
    username: 'Username',
    password: 'Password',
    phoneNumber: 'Phone Number',
    emailAddress: 'Email Address',
    passport: 'Passport / ID',
    bookingId: 'Booking ID',
    verificationCode: 'Verification Code',
    verifyAndConnect: 'Verify & Connect',
    sendVerificationCode: 'Send Verification Code',
    changeNumber: 'Change number',
    resendCode: 'Resend code',
    resendIn: 'Resend in {0}s',
    termsAndConditions: 'Terms & Conditions',
    iAgreeToThe: 'I agree to the',
    emailMarketing: 'I agree to receive email marketing',
    smsMarketing: 'I agree to receive SMS marketing',
    loadingPortal: 'Loading portal...',
    connected: 'Connected!',
    sessionDetails: 'Session Details',
    duration: 'Duration',
    download: 'Download',
    upload: 'Upload',
    method: 'Method',
    connectAnotherDevice: 'Connect another device',
    disconnectLogout: 'Disconnect & Logout',
    enterRoom: 'Enter Room',
    enterVoucher: 'Enter Voucher',
    otpLogin: 'OTP Login',
    freeAccess: 'Free Access',
    freeWiFi: 'Free WiFi',
    swimmingPool: 'Swimming Pool',
    spaWellness: 'Spa & Wellness',
    restaurant: 'Restaurant',
    fitnessCenter: 'Fitness Center',
    roomService: 'Room Service',
    parking: 'Parking',
    concierge: 'Concierge',
    qrCodeScanned: 'QR Code scanned',
    qrCodePrefilled: 'your voucher code has been pre-filled',
    clickToConnect: 'Click below to connect to the WiFi network',
    weWillSendCode: "We'll send a verification code to your phone",
    enterCodeSentTo: 'Enter the 6-digit code sent to',
    pleaseEnter: 'Please enter',
    sessionTimeout: 'session timeout',
    openAccessDesc: 'Click below to connect to the WiFi network',
    specialOffer: 'Special Offer',
    weatherSetLocation: 'Weather — set location in designer',
    poweredBy: 'Powered by StaySuite Hospitality OS',
    thankYouForFeedback: 'Thank you for your feedback!',
  },
  es: {
    connect: 'Conectar', connectNow: 'Conectar Ahora', connectToWiFi: 'Conectar al WiFi',
    signIn: 'Iniciar Sesión', signInWithRoom: 'Iniciar con Habitación',
    voucherCode: 'Código de Voucher', roomNumber: 'Número de Habitación', lastName: 'Apellido',
    firstName: 'Nombre', username: 'Usuario', password: 'Contraseña', phoneNumber: 'Teléfono',
    emailAddress: 'Correo Electrónico', passport: 'Pasaporte / ID', bookingId: 'ID de Reserva',
    verificationCode: 'Código de Verificación', verifyAndConnect: 'Verificar y Conectar',
    sendVerificationCode: 'Enviar Código de Verificación', changeNumber: 'Cambiar número',
    resendCode: 'Reenviar código', resendIn: 'Reenviar en {0}s',
    termsAndConditions: 'Términos y Condiciones', iAgreeToThe: 'Acepto los',
    emailMarketing: 'Acepto recibir marketing por correo electrónico',
    smsMarketing: 'Acepto recibir marketing por SMS',
    loadingPortal: 'Cargando portal...', connected: '¡Conectado!', sessionDetails: 'Detalles de Sesión',
    duration: 'Duración', download: 'Descarga', upload: 'Subida', method: 'Método',
    connectAnotherDevice: 'Conectar otro dispositivo',
    disconnectLogout: 'Desconectar y Cerrar Sesión',
    enterRoom: 'Habitación', enterVoucher: 'Voucher', otpLogin: 'OTP', freeAccess: 'Acceso Libre',
    freeWiFi: 'WiFi Gratis', swimmingPool: 'Piscina', spaWellness: 'Spa y Bienestar',
    restaurant: 'Restaurante', fitnessCenter: 'Gimnasio', roomService: 'Servicio a Habitación',
    parking: 'Estacionamiento', concierge: 'Conserjería',
    qrCodeScanned: 'Código QR escaneado', qrCodePrefilled: 'tu código de voucher se ha rellenado',
    clickToConnect: 'Haz clic abajo para conectarte a la red WiFi',
    weWillSendCode: 'Enviaremos un código de verificación a tu teléfono',
    enterCodeSentTo: 'Ingresa el código de 6 dígitos enviado a',
    pleaseEnter: 'Por favor ingresa', sessionTimeout: 'tiempo de sesión',
    openAccessDesc: 'Haz clic abajo para conectarte a la red WiFi',
    specialOffer: 'Oferta Especial', weatherSetLocation: 'Clima — configure ubicación en el diseñador',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: '¡Gracias por tu opinión!',
  },
  fr: {
    connect: 'Connexion', connectNow: 'Se Connecter Maintenant', connectToWiFi: 'Se Connecter au WiFi',
    signIn: 'Se Connecter', signInWithRoom: "Se Connecter avec la Chambre",
    voucherCode: "Code d'Accès", roomNumber: 'Numéro de Chambre', lastName: 'Nom',
    firstName: 'Prénom', username: 'Identifiant', password: 'Mot de Passe', phoneNumber: 'Téléphone',
    emailAddress: 'E-mail', passport: 'Passeport / ID', bookingId: 'ID de Réservation',
    verificationCode: 'Code de Vérification', verifyAndConnect: 'Vérifier et Se Connecter',
    sendVerificationCode: 'Envoyer le Code', changeNumber: 'Changer de numéro',
    resendCode: 'Renvoyer le code', resendIn: 'Renvoyer dans {0}s',
    termsAndConditions: "Conditions Générales", iAgreeToThe: "J'accepte les",
    emailMarketing: "J'accepte de recevoir des e-mails marketing",
    smsMarketing: "J'accepte de recevoir des SMS marketing",
    loadingPortal: 'Chargement du portail...', connected: 'Connecté !', sessionDetails: 'Détails de la Session',
    duration: 'Durée', download: 'Téléchargement', upload: 'Envoi', method: 'Méthode',
    connectAnotherDevice: 'Connecter un autre appareil',
    disconnectLogout: 'Déconnexion',
    enterRoom: 'Chambre', enterVoucher: "Code d'Accès", otpLogin: 'OTP', freeAccess: 'Accès Libre',
    freeWiFi: 'WiFi Gratuit', swimmingPool: 'Piscine', spaWellness: 'Spa & Bien-être',
    restaurant: 'Restaurant', fitnessCenter: 'Salle de Sport', roomService: 'Service en Chambre',
    parking: 'Parking', concierge: 'Conciergerie',
    qrCodeScanned: 'Code QR scanné', qrCodePrefilled: "votre code d'accès a été pré-rempli",
    clickToConnect: 'Cliquez ci-dessous pour vous connecter au WiFi',
    weWillSendCode: 'Nous enverrons un code de vérification à votre téléphone',
    enterCodeSentTo: 'Entrez le code à 6 chiffres envoyé à',
    pleaseEnter: 'Veuillez entrer', sessionTimeout: 'durée de session',
    openAccessDesc: 'Cliquez ci-dessous pour vous connecter au WiFi',
    specialOffer: 'Offre Spéciale', weatherSetLocation: 'Météo — configurez la localisation',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'Merci pour votre avis !',
  },
  de: {
    connect: 'Verbinden', connectNow: 'Jetzt Verbinden', connectToWiFi: 'Mit WiFi Verbinden',
    signIn: 'Anmelden', signInWithRoom: 'Mit Zimmer Anmelden',
    voucherCode: 'Gutscheincode', roomNumber: 'Zimmernummer', lastName: 'Nachname',
    firstName: 'Vorname', username: 'Benutzername', password: 'Passwort', phoneNumber: 'Telefonnummer',
    emailAddress: 'E-Mail-Adresse', passport: 'Reisepass / ID', bookingId: 'Buchungs-ID',
    verificationCode: 'Verifizierungscode', verifyAndConnect: 'Verifizieren & Verbinden',
    sendVerificationCode: 'Code Senden', changeNumber: 'Nummer ändern',
    resendCode: 'Code erneut senden', resendIn: 'Erneut senden in {0}s',
    termsAndConditions: 'AGB', iAgreeToThe: 'Ich akzeptiere die',
    emailMarketing: 'Ich stimme E-Mail-Marketing zu',
    smsMarketing: 'Ich stimme SMS-Marketing zu',
    loadingPortal: 'Portal wird geladen...', connected: 'Verbunden!', sessionDetails: 'Sitzungsdetails',
    duration: 'Dauer', download: 'Download', upload: 'Upload', method: 'Methode',
    connectAnotherDevice: 'Anderes Gerät verbinden',
    disconnectLogout: 'Trennen & Abmelden',
    enterRoom: 'Zimmer', enterVoucher: 'Gutschein', otpLogin: 'OTP', freeAccess: 'Freier Zugang',
    freeWiFi: 'Kostenloses WiFi', swimmingPool: 'Swimmingpool', spaWellness: 'Spa & Wellness',
    restaurant: 'Restaurant', fitnessCenter: 'Fitnesscenter', roomService: 'Zimmerservice',
    parking: 'Parkplatz', concierge: 'Concierge',
    qrCodeScanned: 'QR-Code gescannt', qrCodePrefilled: 'Ihr Gutscheincode wurde ausgefüllt',
    clickToConnect: 'Klicken Sie unten, um sich mit dem WiFi zu verbinden',
    weWillSendCode: 'Wir senden einen Verifizierungscode an Ihr Telefon',
    enterCodeSentTo: 'Geben Sie den 6-stelligen Code ein, gesendet an',
    pleaseEnter: 'Bitte geben Sie', sessionTimeout: 'Sitzungsdauer',
    openAccessDesc: 'Klicken Sie unten, um sich mit dem WiFi zu verbinden',
    specialOffer: 'Sonderangebot', weatherSetLocation: 'Wetter — Standort im Designer einstellen',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'Vielen Dank für Ihr Feedback!',
  },
  hi: {
    connect: 'कनेक्ट करें', connectNow: 'अभी कनेक्ट करें', connectToWiFi: 'WiFi से कनेक्ट करें',
    signIn: 'साइन इन', signInWithRoom: 'कमरे से साइन इन',
    voucherCode: 'वाउचर कोड', roomNumber: 'कमरा नंबर', lastName: 'अंतिम नाम',
    firstName: 'पहला नाम', username: 'उपयोगकर्ता नाम', password: 'पासवर्ड', phoneNumber: 'फ़ोन नंबर',
    emailAddress: 'ईमेल पता', passport: 'पासपोर्ट / ID', bookingId: 'बुकिंग ID',
    verificationCode: 'सत्यापन कोड', verifyAndConnect: 'सत्यापित करें और कनेक्ट करें',
    sendVerificationCode: 'सत्यापन कोड भेजें', changeNumber: 'नंबर बदलें',
    resendCode: 'कोड दोबारा भेजें', resendIn: '{0}s में दोबारा भेजें',
    termsAndConditions: 'नियम और शर्तें', iAgreeToThe: 'मैं स्वीकार करता हूं',
    emailMarketing: 'मैं ईमेल मार्केटिंग प्राप्त करने के लिए सहमत हूं',
    smsMarketing: 'मैं SMS मार्केटिंग प्राप्त करने के लिए सहमत हूं',
    loadingPortal: 'पोर्टल लोड हो रहा है...', connected: 'कनेक्ट हो गया!', sessionDetails: 'सत्र विवरण',
    duration: 'अवधि', download: 'डाउनलोड', upload: 'अपलोड', method: 'विधि',
    connectAnotherDevice: 'अन्य डिवाइस कनेक्ट करें',
    disconnectLogout: 'डिस्कनेक्ट और लॉगआउट',
    enterRoom: 'कमरा दर्ज करें', enterVoucher: 'वाउचर', otpLogin: 'OTP', freeAccess: 'मुफ्त एक्सेस',
    freeWiFi: 'मुफ्त WiFi', swimmingPool: 'स्विमिंग पूल', spaWellness: 'स्पा और वेलनेस',
    restaurant: 'रेस्टोरेंट', fitnessCenter: 'फिटनेस सेंटर', roomService: 'रूम सर्विस',
    parking: 'पार्किंग', concierge: 'कॉन्सियर्ज',
    qrCodeScanned: 'QR कोड स्कैन किया गया', qrCodePrefilled: 'आपका वाउचर कोड भर दिया गया है',
    clickToConnect: 'WiFi से कनेक्ट करने के लिए नीचे क्लिक करें',
    weWillSendCode: 'हम आपके फ़ोन पर एक सत्यापन कोड भेजेंगे',
    enterCodeSentTo: 'भेजा गया 6 अंकों का कोड दर्ज करें',
    pleaseEnter: 'कृपया दर्ज करें', sessionTimeout: 'सत्र अवधि',
    openAccessDesc: 'WiFi से कनेक्ट करने के लिए नीचे क्लिक करें',
    specialOffer: 'विशेष ऑफर', weatherSetLocation: 'मौसम — डिज़ाइनर में स्थान सेट करें',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'आपके फ़ीडबैक के लिए धन्यवाद!',
  },
  zh: {
    connect: '连接', connectNow: '立即连接', connectToWiFi: '连接WiFi',
    signIn: '登录', signInWithRoom: '房间登录',
    voucherCode: '凭证码', roomNumber: '房间号', lastName: '姓',
    firstName: '名', username: '用户名', password: '密码', phoneNumber: '电话号码',
    emailAddress: '电子邮箱', passport: '护照/身份证', bookingId: '预订号',
    verificationCode: '验证码', verifyAndConnect: '验证并连接',
    sendVerificationCode: '发送验证码', changeNumber: '更换号码',
    resendCode: '重新发送', resendIn: '{0}秒后重发',
    termsAndConditions: '条款与条件', iAgreeToThe: '我同意',
    emailMarketing: '我同意接收邮件营销',
    smsMarketing: '我同意接收短信营销',
    loadingPortal: '正在加载门户...', connected: '已连接！', sessionDetails: '会话详情',
    duration: '时长', download: '下载', upload: '上传', method: '方式',
    connectAnotherDevice: '连接其他设备',
    disconnectLogout: '断开并退出',
    enterRoom: '房间', enterVoucher: '凭证', otpLogin: 'OTP', freeAccess: '免费接入',
    freeWiFi: '免费WiFi', swimmingPool: '游泳池', spaWellness: '水疗中心',
    restaurant: '餐厅', fitnessCenter: '健身中心', roomService: '客房服务',
    parking: '停车场', concierge: '礼宾部',
    qrCodeScanned: '二维码已扫描', qrCodePrefilled: '您的凭证码已自动填入',
    clickToConnect: '点击下方连接WiFi',
    weWillSendCode: '我们将向您手机发送验证码',
    enterCodeSentTo: '输入发送至以下号码的6位验证码',
    pleaseEnter: '请输入', sessionTimeout: '会话时长',
    openAccessDesc: '点击下方连接WiFi',
    specialOffer: '特别优惠', weatherSetLocation: '天气 — 在设计器中设置位置',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: '感谢您的反馈！',
  },
  ja: {
    connect: '接続', connectNow: '今すぐ接続', connectToWiFi: 'WiFiに接続',
    signIn: 'サインイン', signInWithRoom: '部屋番号でサインイン',
    voucherCode: 'バウチャーコード', roomNumber: '部屋番号', lastName: '姓',
    firstName: '名', username: 'ユーザー名', password: 'パスワード', phoneNumber: '電話番号',
    emailAddress: 'メールアドレス', passport: 'パスポート/ID', bookingId: '予約ID',
    verificationCode: '認証コード', verifyAndConnect: '認証して接続',
    sendVerificationCode: '認証コードを送信', changeNumber: '番号を変更',
    resendCode: '再送信', resendIn: '{0}秒後に再送信',
    termsAndConditions: '利用規約', iAgreeToThe: '同意します',
    emailMarketing: 'メールマーケティングを受け取ることに同意します',
    smsMarketing: 'SMSマーケティングを受け取ることに同意します',
    loadingPortal: 'ポータルを読み込み中...', connected: '接続完了！', sessionDetails: 'セッション詳細',
    duration: '時間', download: 'ダウンロード', upload: 'アップロード', method: '方法',
    connectAnotherDevice: '別のデバイスを接続',
    disconnectLogout: '切断＆ログアウト',
    enterRoom: '部屋番号', enterVoucher: 'バウチャー', otpLogin: 'OTP', freeAccess: '無料アクセス',
    freeWiFi: '無料WiFi', swimmingPool: 'プール', spaWellness: 'スパ',
    restaurant: 'レストラン', fitnessCenter: 'フィットネス', roomService: 'ルームサービス',
    parking: '駐車場', concierge: 'コンシェルジュ',
    qrCodeScanned: 'QRコード読取完了', qrCodePrefilled: 'バウチャーコードが入力されました',
    clickToConnect: 'WiFiに接続するには下のボタンをクリック',
    weWillSendCode: '認証コードをお電話番号に送信します',
    enterCodeSentTo: '送信された6桁のコードを入力してください',
    pleaseEnter: '入力してください', sessionTimeout: 'セッション時間',
    openAccessDesc: 'WiFiに接続するには下のボタンをクリック',
    specialOffer: '特別オファー', weatherSetLocation: '天気 — デザイナーで位置を設定',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'フィードバックありがとうございます！',
  },
  ar: {
    connect: 'اتصال', connectNow: 'اتصل الآن', connectToWiFi: 'اتصل بالواي فاي',
    signIn: 'تسجيل الدخول', signInWithRoom: 'تسجيل الدخول بالغرفة',
    voucherCode: 'كود القسيمة', roomNumber: 'رقم الغرفة', lastName: 'اسم العائلة',
    firstName: 'الاسم الأول', username: 'اسم المستخدم', password: 'كلمة المرور', phoneNumber: 'رقم الهاتف',
    emailAddress: 'البريد الإلكتروني', passport: 'جواز السفر / الهوية', bookingId: 'رقم الحجز',
    verificationCode: 'رمز التحقق', verifyAndConnect: 'تحقق واتصل',
    sendVerificationCode: 'إرسال رمز التحقق', changeNumber: 'تغيير الرقم',
    resendCode: 'إعادة الإرسال', resendIn: 'إعادة الإرسال خلال {0} ثانية',
    termsAndConditions: 'الشروط والأحكام', iAgreeToThe: 'أوافق على',
    emailMarketing: 'أوافق على تلقي التسويق عبر البريد الإلكتروني',
    smsMarketing: 'أوافق على تلقي التسويق عبر الرسائل القصيرة',
    loadingPortal: 'جاري تحميل البوابة...', connected: 'متصل!', sessionDetails: 'تفاصيل الجلسة',
    duration: 'المدة', download: 'التنزيل', upload: 'الرفع', method: 'الطريقة',
    connectAnotherDevice: 'الاتصال بجهاز آخر',
    disconnectLogout: 'قطع الاتصال وتسجيل الخروج',
    enterRoom: 'الغرفة', enterVoucher: 'القسيمة', otpLogin: 'OTP', freeAccess: 'وصول مجاني',
    freeWiFi: 'واي فاي مجاني', swimmingPool: 'حمام السباحة', spaWellness: 'السبا',
    restaurant: 'المطعم', fitnessCenter: 'صالة الألعاب الرياضية', roomService: 'خدمة الغرف',
    parking: 'موقف السيارات', concierge: 'الكونسيرج',
    qrCodeScanned: 'تم مسح رمز QR', qrCodePrefilled: 'تم ملء كود القسيمة',
    clickToConnect: 'انقر أدناه للاتصال بشبكة الواي فاي',
    weWillSendCode: 'سنرسل رمز التحقق إلى هاتفك',
    enterCodeSentTo: 'أدخل الرمز المكون من 6 أرقام المرسل إلى',
    pleaseEnter: 'الرجاء إدخال', sessionTimeout: 'مدة الجلسة',
    openAccessDesc: 'انقر أدناه للاتصال بشبكة الواي فاي',
    specialOffer: 'عرض خاص', weatherSetLocation: 'الطقس — ضبط الموقع في المصمم',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'شكرا لملاحظاتك!',
  },
  pt: {
    connect: 'Conectar', connectNow: 'Conectar Agora', connectToWiFi: 'Conectar ao WiFi',
    signIn: 'Entrar', signInWithRoom: 'Entrar com Quarto',
    voucherCode: 'Código do Voucher', roomNumber: 'Número do Quarto', lastName: 'Sobrenome',
    firstName: 'Nome', username: 'Usuário', password: 'Senha', phoneNumber: 'Telefone',
    emailAddress: 'E-mail', passport: 'Passaporte / ID', bookingId: 'ID da Reserva',
    verificationCode: 'Código de Verificação', verifyAndConnect: 'Verificar e Conectar',
    sendVerificationCode: 'Enviar Código', changeNumber: 'Alterar número',
    resendCode: 'Reenviar código', resendIn: 'Reenviar em {0}s',
    termsAndConditions: 'Termos e Condições', iAgreeToThe: 'Eu concordo com os',
    emailMarketing: 'Concordo em receber marketing por e-mail',
    smsMarketing: 'Concordo em receber marketing por SMS',
    loadingPortal: 'Carregando portal...', connected: 'Conectado!', sessionDetails: 'Detalhes da Sessão',
    duration: 'Duração', download: 'Download', upload: 'Upload', method: 'Método',
    connectAnotherDevice: 'Conectar outro dispositivo',
    disconnectLogout: 'Desconectar e Sair',
    enterRoom: 'Quarto', enterVoucher: 'Voucher', otpLogin: 'OTP', freeAccess: 'Acesso Livre',
    freeWiFi: 'WiFi Grátis', swimmingPool: 'Piscina', spaWellness: 'Spa & Bem-estar',
    restaurant: 'Restaurante', fitnessCenter: 'Academia', roomService: 'Serviço de Quarto',
    parking: 'Estacionamento', concierge: 'Concierge',
    qrCodeScanned: 'Código QR escaneado', qrCodePrefilled: 'seu código de voucher foi preenchido',
    clickToConnect: 'Clique abaixo para conectar à rede WiFi',
    weWillSendCode: 'Enviaremos um código de verificação para seu telefone',
    enterCodeSentTo: 'Digite o código de 6 dígitos enviado para',
    pleaseEnter: 'Por favor insira', sessionTimeout: 'duração da sessão',
    openAccessDesc: 'Clique abaixo para conectar à rede WiFi',
    specialOffer: 'Oferta Especial', weatherSetLocation: 'Clima — configure localização no designer',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: 'Obrigado pelo seu feedback!',
  },
  ko: {
    connect: '연결', connectNow: '지금 연결', connectToWiFi: 'WiFi 연결',
    signIn: '로그인', signInWithRoom: '객실로 로그인',
    voucherCode: '바우처 코드', roomNumber: '객실 번호', lastName: '성',
    firstName: '이름', username: '사용자 이름', password: '비밀번호', phoneNumber: '전화번호',
    emailAddress: '이메일 주소', passport: '여권/신분증', bookingId: '예약 번호',
    verificationCode: '인증 코드', verifyAndConnect: '인증 및 연결',
    sendVerificationCode: '인증 코드 보내기', changeNumber: '번호 변경',
    resendCode: '재전송', resendIn: '{0}초 후 재전송',
    termsAndConditions: '이용약관', iAgreeToThe: '동의합니다',
    emailMarketing: '이메일 마케팅 수신에 동의합니다',
    smsMarketing: 'SMS 마케팅 수신에 동의합니다',
    loadingPortal: '포털 로딩 중...', connected: '연결 완료!', sessionDetails: '세션 상세',
    duration: '시간', download: '다운로드', upload: '업로드', method: '방식',
    connectAnotherDevice: '다른 기기 연결',
    disconnectLogout: '연결 해제 및 로그아웃',
    enterRoom: '객실', enterVoucher: '바우처', otpLogin: 'OTP', freeAccess: '무료 접속',
    freeWiFi: '무료 WiFi', swimmingPool: '수영장', spaWellness: '스파',
    restaurant: '레스토랑', fitnessCenter: '피트니스 센터', roomService: '룸서비스',
    parking: '주차장', concierge: '콘시어지',
    qrCodeScanned: 'QR 코드 스캔 완료', qrCodePrefilled: '바우처 코드가 입력되었습니다',
    clickToConnect: 'WiFi에 연결하려면 아래를 클릭하세요',
    weWillSendCode: '휴대전화로 인증 코드를 보내드립니다',
    enterCodeSentTo: '전송된 6자리 코드를 입력하세요',
    pleaseEnter: '입력해 주세요', sessionTimeout: '세션 시간',
    openAccessDesc: 'WiFi에 연결하려면 아래를 클릭하세요',
    specialOffer: '특별 오퍼', weatherSetLocation: '날씨 — 디자이너에서 위치 설정',
    poweredBy: 'Powered by StaySuite Hospitality OS', thankYouForFeedback: '피드백 감사합니다!',
  },
};

/**
 * Get a localized UI string (for portal chrome/buttons/labels).
 * Falls back to English if the language or key is missing.
 */
export function getUIString(lang: string, key: string, fallback = ''): string {
  const langStrings = PORTAL_UI_STRINGS[lang] || PORTAL_UI_STRINGS.en;
  return langStrings[key] || fallback || PORTAL_UI_STRINGS.en[key] || key;
}

/**
 * Get localized admin-defined content (title, subtitle, etc.)
 * Checks design.translations[lang][fieldKey] first, then falls back to design[fieldKey].
 */
export function getLocalizedText(
  design: { translations?: Record<string, Record<string, string>>; [key: string]: unknown },
  fieldKey: string,
  language: string,
): string {
  // Map of PortalDesignConfig field names to translation keys
  const fieldToTranslationKey: Record<string, string> = {
    title: 'title',
    subtitle: 'subtitle',
    welcomeMessage: 'welcomeMessage',
    termsText: 'termsText',
    promotionTitle: 'promotionTitle',
    promotionDesc: 'promotionDesc',
    hotelName: 'hotelName',
    hotelAddress: 'hotelAddress',
  };

  const tKey = fieldToTranslationKey[fieldKey] || fieldKey;
  const langTranslations = design.translations?.[language];
  if (langTranslations && langTranslations[tKey]) {
    return langTranslations[tKey];
  }
  // Fallback to the default language translations
  const defaultLang = (design.defaultLanguage as string) || 'en';
  if (defaultLang !== language) {
    const defaultTranslations = design.translations?.[defaultLang];
    if (defaultTranslations && defaultTranslations[tKey]) {
      return defaultTranslations[tKey];
    }
  }
  // Final fallback to the raw design field
  return (design[fieldKey] as string) || '';
}

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
  showBranding: true,
  title: 'Welcome',
  subtitle: 'Connect to WiFi',
  gradientAngle: 135,
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
  const glass = isCardTransparent(design);
  const dark = isDarkBackground(design);
  let cls = 'p-6 space-y-5';

  // Background — glass/minimal are transparent; others are white/light
  if (design.formStyle === 'glass') {
    cls += ' bg-white/10 backdrop-blur-xl border border-white/20';
  } else if (design.formStyle === 'minimal') {
    cls += ' bg-transparent';
  } else if (design.formStyle === 'pill') {
    cls += dark
      ? ' bg-white/95 backdrop-blur-xl'
      : ' bg-white';
    cls += ' border border-gray-200';
  } else if (design.formStyle === 'square') {
    cls += dark
      ? ' bg-white/95 backdrop-blur-xl'
      : ' bg-white';
  } else {
    // rounded (default)
    cls += dark
      ? ' bg-white/95 backdrop-blur-xl'
      : ' bg-white';
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
  switch (design.cardShadow) {
    case 'large':
      return { boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
    case 'medium':
      return { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' };
    case 'small':
      return { boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' };
    case 'none':
      return { boxShadow: 'none' };
    default:
      return { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' };
  }
}

// ────────────────────────────────────────────────────────────
// Text Color — depends on CARD background, NOT page background
// ────────────────────────────────────────────────────────────

/**
 * Card text color for labels, headings inside the form card.
 * - Glass/minimal on dark page → white text
 * - All other card styles → dark text (card has white/light background)
 */
export function getCardTextColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (isCardTransparent(design) && dark) return '#ffffff';
  // Non-transparent cards always have white/light backgrounds → dark text
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
 * - Glass/minimal on dark page → light muted
 * - All other cards → dark muted (card is white)
 */
export function getMutedTextColor(design: PortalDesignConfig): string {
  const dark = isDarkBackground(design);
  if (isCardTransparent(design) && dark) return 'rgba(255,255,255,0.7)';
  // Non-transparent cards always have white/light backgrounds
  return 'rgba(0,0,0,0.5)';
}

// ────────────────────────────────────────────────────────────
// Input Field Classes (based on inputStyle + formStyle)
// ────────────────────────────────────────────────────────────

/**
 * Input classes. Text and border colors depend on CARD background.
 * - Glass/minimal on dark page → white text, white/20 borders
 * - All other cards → dark text, gray borders (card is white)
 */
export function getInputClasses(design: PortalDesignConfig): string {
  const glass = isCardTransparent(design);
  const dark = isDarkBackground(design);
  // "use light colors" = glass/minimal on dark page background
  const useLight = glass && dark;

  let cls = 'w-full focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  // Border styling
  if (design.inputStyle === 'underline') {
    if (useLight) {
      cls += ' border-0 border-b-2 px-1 py-3 bg-transparent border-white/30';
    } else {
      cls += ' border-0 border-b-2 px-1 py-3 bg-transparent border-gray-300';
    }
  } else if (design.inputStyle === 'pill') {
    if (useLight) {
      cls += ' bg-white/10 border border-white/20 rounded-full px-4 py-3';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-full px-4 py-3';
    }
  } else if (design.inputStyle === 'square') {
    if (useLight) {
      cls += ' bg-white/10 border border-white/20 rounded-none px-3 py-3';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-none px-3 py-3';
    }
  } else {
    // rounded (default)
    if (useLight) {
      cls += ' bg-white/10 border border-white/20 rounded-xl px-4 py-3';
    } else {
      cls += ' bg-white/90 border-2 border-gray-200 rounded-xl px-4 py-3';
    }
  }

  // Text color
  if (useLight) {
    cls += ' text-white placeholder:text-white/40';
  } else {
    cls += ' text-gray-800 placeholder:text-gray-400';
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

  // Style type
  switch (design.buttonStyle) {
    case 'gradient': {
      className += ' text-white hover:opacity-90';
      style = {
        background: `linear-gradient(135deg, ${design.gradientFrom || color}, ${design.gradientTo || color})`,
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
      className += ' text-white hover:opacity-90';
      style = { backgroundColor: color, borderRadius: '9999px' };
      break;
    }
    case 'rounded': {
      className += ' text-white hover:opacity-90';
      style = { backgroundColor: color, borderRadius: '0.5rem' };
      break;
    }
    default: {
      // filled
      className += ' text-white hover:opacity-90';
      style = { backgroundColor: color };
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
 * - Glass/minimal on dark page → white/low-opacity icons
 * - All other cards → gray icons (card is white)
 */
export function getIconColor(design: PortalDesignConfig): string {
  const glass = isCardTransparent(design);
  const dark = isDarkBackground(design);
  if (glass && dark) return 'rgba(255,255,255,0.4)';
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

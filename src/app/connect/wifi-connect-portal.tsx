'use client';

import { generateFingerprint, getStorageToken, saveStorageToken, clearStorageToken, getDeviceInfo } from '@/lib/wifi/device-fingerprint';

/**
 * Public WiFi Captive Portal — Designer-Driven Single Form + Multi-Method Fallback
 *
 * URL: /connect  (or /connect?code=<voucher> for QR scan)
 *
 * Portal resolution flow:
 *   1. User connects to WiFi → gets IP from DHCP → redirected to /connect
 *   2. /connect calls resolve-zone API → server checks client IP against
 *      PortalMapping subnets → returns the correct portal config
 *   3. If no IP match, falls back to default portal
 *
 * TWO RENDERING MODES:
 *
 *   A) UNIFIED FORM (when formFields is configured):
 *      - Renders a SINGLE form with only the fields the admin toggled ON
 *      - No tabs — matches the designer preview exactly
 *      - Uses portalConfig.authMethod to determine submit handler
 *      - Supports ALL field types: roomNumber, username, password, phone, email,
 *        firstName, lastName, passport, bookingId, voucherCode, terms
 *
 *   B) FALLBACK TAB MODE (when formFields is null/empty):
 *      - Shows all auth methods as tabs with their respective hardcoded forms
 *      - Keeps backward compatibility
 *
 * ALL visual styling is driven by the portal's design config.
 * NO hardcoded colors, borders, shadows, or border-radii.
 *
 * States: loading → auth_form → authenticating → success → error
 */

import { useState, useEffect, Suspense, useCallback, Fragment, createContext, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Wifi,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
  Zap,
  QrCode,
  Key,
  DoorOpen,
  User,
  Smartphone,
  Globe,
  Phone,
  ExternalLink,
  Hotel,
  MapPin,
  PhoneCall,
  RefreshCw,
  Gift,
  Mail,
  Star,
  Waves,
  Sparkles,
  UtensilsCrossed,
  Dumbbell,
  Coffee,
  Car,
  Building,
  Lock,
  ScanLine,
  Calendar,
  Tv, Wine, Baby, Plane, Bath, Shirt, Music, Camera, Umbrella,
  Languages,
  Check,
  X,
  LogOut,
  Bug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SurveyWidget from '@/components/wifi/survey-widget';
import {
  PortalDesignConfig,
  DEFAULT_PORTAL_DESIGN,
  getBackgroundStyle,
  getBackgroundCSSValue,
  isDarkBackground,
  getOverlayStyle,
  getFormContainerClasses,
  getCardShadowCSS,
  getCardTextColor,
  getSubtitleColor,
  getMutedTextColor,
  getInputClasses,
  getInputWithIconClasses,
  getButtonClasses,
  getIconColor,
  getAnimationClasses,
  getSocialIconLabel,
  mergeDesignConfig,
  getLanguageLabel,
  getSocialPlatformColor,
  getUIString,
  getLocalizedText,
} from '@/lib/wifi/portal-design-utils';

// ────────────────────────────────────────────────────────────
// Portal Language Context (Feature 1: Multi-Language)
// ────────────────────────────────────────────────────────────

const PortalLanguageContext = createContext('en');
function usePortalLang() { return useContext(PortalLanguageContext); }

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface AuthMethodOption {
  method: string;
  label: string;
  description: string;
}

interface FormFieldConfig {
  visible?: boolean;
  required?: boolean;
  label?: string;
}

type FormFieldsConfig = Record<string, boolean | FormFieldConfig>;

interface PortalConfig {
  name: string;
  slug: string;
 tenantId?: string;
  propertyId?: string;
  authMethod: string;
  sessionTimeout: number;
  autoAuthEnabled?: boolean;
  maxBandwidthDown: number;
  maxBandwidthUp: number;
  design: PortalDesignConfig;
  ssids: string[];
  termsRequired: boolean;
  authMethods: AuthMethodOption[];
  formFields: FormFieldsConfig | null;
}

interface AuthResult {
  authenticated: boolean;
  method: string;
  sessionTimeout: number;
  remainingMinutes?: number;
  bandwidthDown: number;
  bandwidthUp: number;
  message: string;
  sessionId?: string;
  guestId?: string;
  // External gateway fields (MikroTik, etc.)
  needGatewayLogin?: boolean;
  gatewayCallbackUrl?: string;
  gatewayType?: string;
  radiusUsername?: string;
  radiusPassword?: string;
}

// ────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────

const DEFAULT_AUTH_METHODS: AuthMethodOption[] = [
  { method: 'voucher', label: 'Voucher Code', description: 'Enter a WiFi voucher' },
];

const METHOD_ICONS: Record<string, React.ReactNode> = {
  voucher: <QrCode className="w-4 h-4" />,
  room_number: <DoorOpen className="w-4 h-4" />,
  pms_credentials: <Key className="w-4 h-4" />,
  sms_otp: <Smartphone className="w-4 h-4" />,
  open_access: <Globe className="w-4 h-4" />,
};

// ────────────────────────────────────────────────────────────
// Unified form field definitions — matches the designer's FIELD_DEFINITIONS
// ────────────────────────────────────────────────────────────

const UNIFIED_FIELD_DEFS: Array<{
  key: string;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  type: string;
  inputMode?: 'text' | 'tel' | 'numeric';
  maxLength?: number;
  className?: string;
}> = [
  { key: 'firstName', label: 'First Name', placeholder: 'John', icon: <User className="w-4 h-4" />, type: 'text' },
  { key: 'lastName', label: 'Last Name', placeholder: 'Smith', icon: <User className="w-4 h-4" />, type: 'text' },
  { key: 'roomNumber', label: 'Room Number', placeholder: 'e.g. 101', icon: <Building className="w-4 h-4" />, type: 'text' },
  { key: 'phone', label: 'Phone Number', placeholder: '+1 555 123 4567', icon: <Phone className="w-4 h-4" />, type: 'tel', inputMode: 'tel' },
  { key: 'email', label: 'Email Address', placeholder: 'guest@example.com', icon: <Mail className="w-4 h-4" />, type: 'email' },
  { key: 'passport', label: 'Passport / ID', placeholder: 'Passport or ID number', icon: <ScanLine className="w-4 h-4" />, type: 'text' },
  { key: 'bookingId', label: 'Booking ID', placeholder: 'Booking reference', icon: <Calendar className="w-4 h-4" />, type: 'text' },
  { key: 'username', label: 'Username', placeholder: 'Enter username', icon: <User className="w-4 h-4" />, type: 'text' },
  { key: 'password', label: 'Password', placeholder: 'Enter password', icon: <Lock className="w-4 h-4" />, type: 'password' },
  { key: 'voucherCode', label: 'Voucher Code', placeholder: 'XXXXX-XXXXX', icon: <QrCode className="w-4 h-4" />, type: 'text', className: 'text-center text-lg font-mono font-bold tracking-wider uppercase' },
];

// ────────────────────────────────────────────────────────────
// Amenity icons mapping
// ────────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi,
  'Swimming Pool': Waves,
  'Spa & Wellness': Sparkles,
  'Restaurant': UtensilsCrossed,
  'Fitness Center': Dumbbell,
  'Room Service': Coffee,
  'Parking': Car,
  'Concierge': Star,
};

// ── Custom amenity icons mapping (Feature 7) ──
const CUSTOM_AMENITY_ICONS: Record<string, typeof Wifi> = {
  tv: Tv,
  wine: Wine,
  baby: Baby,
  plane: Plane,
  bath: Bath,
  shirt: Shirt,
  music: Music,
  camera: Camera,
  umbrella: Umbrella,
};

// ────────────────────────────────────────────────────────────
// Live Clock Component
// ────────────────────────────────────────────────────────────

function LiveClock({ design }: { design: PortalDesignConfig }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const color = getMutedTextColor(design);

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <Clock className="w-4 h-4" style={{ color }} />
      <span style={{ color }}>{time}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Weather Widget (Feature 5)
// ────────────────────────────────────────────────────────────

const weatherCache = new Map<string, { temp: string; condition: string }>();

function WeatherWidget({ design }: { design: PortalDesignConfig }) {
  const lang = usePortalLang();
  const location = design.weatherLocation;
  const [weather, setWeather] = useState<{ temp: string; condition: string } | null>(
    () => (location ? weatherCache.get(location) ?? null : null)
  );
  const [loading, setLoading] = useState(!weather && !!location);
  const color = getMutedTextColor(design);

  useEffect(() => {
    if (!location) return;
    if (weatherCache.has(location)) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`https://wttr.in/${encodeURIComponent(location)}?format=%t+%C`, {
      signal: controller.signal,
    })
      .then((res) => res.text())
      .then((text) => {
        const trimmed = text.trim();
        const parts = trimmed.split(/\s+/);
        const data = { temp: parts[0] || '', condition: parts.slice(1).join(' ') || 'Clear' };
        weatherCache.set(location, data);
        setWeather(data);
      })
      .catch(() => {
        const fallback = { temp: '--°', condition: location };
        weatherCache.set(location, fallback);
        setWeather(fallback);
      })
      .finally(() => setLoading(false));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [location]);

  if (!location) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color }}>
        <span aria-hidden="true">🌤️</span>
        <span style={{ color, fontStyle: 'italic' }}>{getUIString(lang, 'weatherSetLocation')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5 text-sm">
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
      ) : weather ? (
        <>
          <span aria-hidden="true">🌤️</span>
          <span style={{ color }}>{weather.temp} {weather.condition}</span>
        </>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Multi-Slide Promotion Carousel (Feature 3)
// ────────────────────────────────────────────────────────────

function PromotionCarousel({ design }: { design: PortalDesignConfig }) {
  const [current, setCurrent] = useState(0);
  const promotions = (design.promotions || []).filter((p) => p.title || p.description);
  const dark = isDarkBackground(design);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % promotions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  if (promotions.length === 0) return null;

  const promo = promotions[current];

  return (
    <div className="w-full relative">
      <div
        className="flex items-start gap-3 rounded-xl p-3 transition-all duration-500 ease-in-out"
        key={current}
        style={{
          backgroundColor: promo.backgroundColor || (dark ? 'rgba(255,255,255,0.12)' : design.accentColor + '10'),
          backdropFilter: dark ? 'blur(8px)' : undefined,
          border: dark ? '1px solid rgba(255,255,255,0.15)' : 'none',
          borderRadius: design.formStyle === 'pill' ? '1.5rem' : design.formStyle === 'square' ? '0' : '0.75rem',
        }}
      >
        <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: design.accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: dark ? '#ffffff' : getCardTextColor(design) }}>
            {promo.title}
          </p>
          {promo.description && (
            <p className="text-xs mt-1" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>
              {promo.description}
            </p>
          )}
        </div>
      </div>

      {/* Dot indicators */}
      {promotions.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {promotions.map((p, i) => (
            <button
              key={p.id || `dot-${i}`}
              onClick={() => setCurrent(i)}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === current ? design.accentColor : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                transform: i === current ? 'scale(1.4)' : 'scale(1)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Language Switcher (Feature 1)
// ────────────────────────────────────────────────────────────

function LanguageSwitcher({ design, selectedLanguage, setSelectedLanguage }: {
  design: PortalDesignConfig;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
}) {
  const languages = (design.languages || []).filter(Boolean);
  const mutedColor = getMutedTextColor(design);

  // Don't render if fewer than 2 languages
  if (languages.length <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 mb-2">
      <Languages className="w-3.5 h-3.5" style={{ color: mutedColor }} />
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        className="text-xs bg-transparent border border-current/20 rounded-md px-2 py-1 outline-none cursor-pointer appearance-auto"
        style={{ color: mutedColor }}
        aria-label="Select language"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {getLanguageLabel(lang)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Marketing Consent Checkboxes (Feature 2)
// ────────────────────────────────────────────────────────────

function MarketingConsent({ design, emailConsent, setEmailConsent, phoneConsent, setPhoneConsent }: {
  design: PortalDesignConfig;
  emailConsent: boolean;
  setEmailConsent: (v: boolean) => void;
  phoneConsent: boolean;
  setPhoneConsent: (v: boolean) => void;
}) {
  const lang = usePortalLang();
  const optIn = design.marketingOptIn;
  if (!optIn?.enabled) return null;

  const mutedColor = getMutedTextColor(design);

  return (
    <div className="space-y-2">
      {optIn.consentText && (
        <p className="text-xs" style={{ color: mutedColor }}>
          {optIn.consentText}
        </p>
      )}
      <div className="space-y-1.5">
        {optIn.emailConsent && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={emailConsent}
              onChange={(e) => setEmailConsent(e.target.checked)}
              className="rounded"
              style={{ accentColor: design.accentColor }}
            />
            <span style={{ color: mutedColor }}>{getUIString(lang, 'emailMarketing')}</span>
          </label>
        )}
        {optIn.phoneConsent && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={phoneConsent}
              onChange={(e) => setPhoneConsent(e.target.checked)}
              className="rounded"
              style={{ accentColor: design.accentColor }}
            />
            <span style={{ color: mutedColor }}>{getUIString(lang, 'smsMarketing')}</span>
          </label>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Marketing Consent Placeholder (for block-based layouts)
// ────────────────────────────────────────────────────────────

function MarketingConsentPlaceholder({ design }: { design: PortalDesignConfig }) {
  const lang = usePortalLang();
  const optIn = design.marketingOptIn;
  if (!optIn?.enabled) return null;

  const mutedColor = getMutedTextColor(design);
  const accent = design.accentColor;

  return (
    <div className="space-y-2 rounded-xl p-3" style={{ backgroundColor: accent + '08', border: `1px solid ${accent}15` }}>
      {optIn.consentText && (
        <p className="text-xs" style={{ color: mutedColor }}>
          {optIn.consentText}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {optIn.emailConsent && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" className="rounded" style={{ accentColor: accent }} defaultChecked={false} />
            <span style={{ color: mutedColor }}>{getUIString(lang, 'emailMarketing')}</span>
          </label>
        )}
        {optIn.phoneConsent && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" className="rounded" style={{ accentColor: accent }} defaultChecked={false} />
            <span style={{ color: mutedColor }}>{getUIString(lang, 'smsMarketing')}</span>
          </label>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Post-Connect Guest Survey (Feature 4)
// ────────────────────────────────────────────────────────────

// ── Rating mapping helper ──
function optionToRating(option: string, options: string[]): number {
  // Try known label mapping first
  const knownMap: Record<string, number> = {
    'excellent': 5, 'great': 5, 'amazing': 5, 'love it': 5,
    'good': 4, 'like it': 4, 'satisfied': 4,
    'average': 3, 'okay': 3, 'neutral': 3, 'so-so': 3,
    'poor': 2, 'dislike': 2, 'unsatisfied': 2,
    'terrible': 1, 'hate it': 1, 'very bad': 1,
  };
  const lower = option.toLowerCase().trim();
  if (knownMap[lower]) return knownMap[lower];

  // Fallback: map by position (first option = best = 5, last = 1)
  const idx = options.indexOf(option);
  if (idx >= 0 && options.length > 0) {
    return Math.max(1, options.length - idx);
  }
  return 3; // neutral default
}

// ── Device type detection ──
function detectDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'phone';
  return 'desktop';
}

function GuestSurvey({
  design,
  tenantId,
  propertyId,
  sessionId,
  guestId,
}: {
  design: PortalDesignConfig;
  tenantId?: string;
  propertyId?: string;
  sessionId?: string;
  guestId?: string;
}) {
  const lang = usePortalLang();
  const surveyConfig = design.surveyConfig;
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!surveyConfig?.enabled || !surveyConfig.question || !surveyConfig.options?.length) return null;

  const mutedColor = getMutedTextColor(design);
  const textColor = getCardTextColor(design);
  const accent = design.accentColor;

  // ── Handle option selection ──
  const handleSelect = async (option: string) => {
    setSelected(option);

    // Only persist to DB if we have tenantId and propertyId
    if (!tenantId || !propertyId) return;

    setSubmitting(true);
    try {
      const rating = optionToRating(option, surveyConfig.options);
      await fetch('/api/wifi/satisfaction/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          propertyId,
          sessionId: sessionId || undefined,
          guestId: guestId || undefined,
          rating,
          comment: option, // Store the selected option text as comment
          deviceType: detectDeviceType(),
        }),
      });
    } catch {
      // Silent failure — the thank-you message is already showing
    } finally {
      setSubmitting(false);
    }
  };

  if (selected) {
    return (
      <div className="text-center space-y-2 mt-4">
        {submitting ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: accent }} />
        ) : (
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full"
            style={{ backgroundColor: accent + '15' }}
          >
            <Check className="w-6 h-6" style={{ color: accent }} />
          </div>
        )}
        <p className="text-sm font-medium" style={{ color: textColor }}>
          {surveyConfig.thankYouMessage || getUIString(lang, 'thankYouForFeedback')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4 pt-4" style={{ borderTop: `1px solid ${accent}15` }}>
      <p className="text-sm font-medium text-center" style={{ color: textColor }}>
        {surveyConfig.question}
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {surveyConfig.options.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className="px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: accent + '15',
              color: accent,
              border: `1px solid ${accent}30`,
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Terms & Conditions Modal (Feature 6)
// ────────────────────────────────────────────────────────────

function TermsModal({ design, open, onClose }: { design: PortalDesignConfig; open: boolean; onClose: () => void }) {
  const lang = usePortalLang();
  if (!open) return null;

  const textColor = getCardTextColor(design);
  const mutedColor = getMutedTextColor(design);
  const dark = isDarkBackground(design);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative max-w-md w-full max-h-[80vh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
        style={{
          backgroundColor: dark ? 'rgba(30,30,30,0.95)' : '#ffffff',
          color: textColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: textColor }}>{getUIString(lang, 'termsAndConditions')}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:opacity-80"
            style={{ backgroundColor: mutedColor + '20' }}
            aria-label="Close terms"
          >
            <X className="w-4 h-4" style={{ color: mutedColor }} />
          </button>
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: mutedColor }}>
          {getLocalizedText(design, 'termsText', lang) || 'Terms and conditions content will appear here.'}
        </div>
        {design.termsUrl && (
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${mutedColor}15` }}>
            <a
              href={design.termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium inline-flex items-center gap-1"
              style={{ color: design.accentColor }}
            >
              View full terms <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Dynamic Input Component
// ────────────────────────────────────────────────────────────

function DynamicInput({
  design,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  onKeyDown,
  icon,
  inputMode,
  maxLength,
  className = '',
}: {
  design: PortalDesignConfig;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  icon?: React.ReactNode;
  inputMode?: 'text' | 'tel' | 'numeric';
  maxLength?: number;
  className?: string;
}) {
  const inputCls = icon
    ? getInputWithIconClasses(design)
    : getInputClasses(design);

  const labelColor = getCardTextColor(design);
  const iconColor = getIconColor(design);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: labelColor }}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          inputMode={inputMode}
          maxLength={maxLength}
          className={cn(inputCls, className)}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Dynamic Button Component
// ────────────────────────────────────────────────────────────

function DynamicButton({
  design,
  onClick,
  disabled,
  loading,
  children,
}: {
  design: PortalDesignConfig;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const btn = getButtonClasses(design);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={btn.className}
      style={btn.style}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Error Display
// ────────────────────────────────────────────────────────────

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Voucher Form (fallback mode)
// ────────────────────────────────────────────────────────────

function VoucherForm({
  design,
  initialCode,
  onSubmit,
  loading,
  hasQrPrefill,
}: {
  design: PortalDesignConfig;
  initialCode: string;
  onSubmit: (code: string) => void;
  loading: boolean;
  hasQrPrefill: boolean;
}) {
  const lang = usePortalLang();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!code.trim()) {
      setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'voucherCode').toLowerCase());
      return;
    }
    setError('');
    onSubmit(code.trim());
  };

  return (
    <div className="space-y-4">
      {hasQrPrefill && (
        <div
          className="flex items-center gap-2 rounded-lg p-3"
          style={{ backgroundColor: design.accentColor + '15' }}
        >
          <QrCode className="w-4 h-4 flex-shrink-0" style={{ color: design.accentColor }} />
          <p className="text-sm" style={{ color: design.accentColor }}>
            <span className="font-medium">{getUIString(lang, 'qrCodeScanned')}</span> — {getUIString(lang, 'qrCodePrefilled')}
          </p>
        </div>
      )}

      <DynamicInput
        design={design}
        label={getUIString(lang, 'voucherCode')}
        type="text"
        value={code}
        onChange={(v) => setCode(v.toUpperCase())}
        placeholder="XXXXX-XXXXX"
        disabled={loading}
        autoFocus={!hasQrPrefill}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        inputMode="text"
        className="text-center text-lg font-mono font-bold tracking-wider uppercase"
      />

      {error && <ErrorDisplay message={error} />}

      <DynamicButton design={design} onClick={handleSubmit} disabled={!code.trim()} loading={loading}>
        <>
          <Wifi className="w-5 h-5" />
          {getUIString(lang, 'connectToWiFi')}
        </>
      </DynamicButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Room Number Form (fallback mode)
// ────────────────────────────────────────────────────────────

function RoomNumberForm({
  design,
  onSubmit,
  loading,
}: {
  design: PortalDesignConfig;
  onSubmit: (roomNumber: string, lastName: string) => void;
  loading: boolean;
}) {
  const lang = usePortalLang();
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!room.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'roomNumber').toLowerCase()); return; }
    if (!name.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'lastName').toLowerCase()); return; }
    setError('');
    onSubmit(room.trim(), name.trim());
  };

  return (
    <div className="space-y-4">
      <DynamicInput
        design={design}
        label={getUIString(lang, 'roomNumber')}
        value={room}
        onChange={setRoom}
        placeholder="e.g. 101"
        disabled={loading}
        autoFocus
        icon={<DoorOpen className="w-4 h-4" />}
      />
      <DynamicInput
        design={design}
        label={getUIString(lang, 'lastName')}
        value={name}
        onChange={setName}
        placeholder="e.g. Smith"
        disabled={loading}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        icon={<User className="w-4 h-4" />}
      />
      {error && <ErrorDisplay message={error} />}
      <DynamicButton design={design} onClick={handleSubmit} disabled={!room.trim() || !name.trim()} loading={loading}>
        <>
          <Key className="w-5 h-5" />
          {getUIString(lang, 'signInWithRoom')}
        </>
      </DynamicButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PMS Credentials Form (fallback mode)
// ────────────────────────────────────────────────────────────

function PmsCredentialsForm({
  design,
  onSubmit,
  loading,
}: {
  design: PortalDesignConfig;
  onSubmit: (username: string, password: string) => void;
  loading: boolean;
}) {
  const lang = usePortalLang();
  const [uname, setUname] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!uname.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'username').toLowerCase()); return; }
    if (!pass.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'password').toLowerCase()); return; }
    setError('');
    onSubmit(uname.trim(), pass.trim());
  };

  return (
    <div className="space-y-4">
      <DynamicInput
        design={design}
        label={getUIString(lang, 'username')}
        value={uname}
        onChange={setUname}
        placeholder="Enter username"
        disabled={loading}
        autoFocus
        icon={<User className="w-4 h-4" />}
      />
      <DynamicInput
        design={design}
        label={getUIString(lang, 'password')}
        type="password"
        value={pass}
        onChange={setPass}
        placeholder="Enter password"
        disabled={loading}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        icon={<Key className="w-4 h-4" />}
      />
      {error && <ErrorDisplay message={error} />}
      <DynamicButton design={design} onClick={handleSubmit} disabled={!uname.trim() || !pass.trim()} loading={loading}>
        <>
          <Key className="w-5 h-5" />
          {getUIString(lang, 'signIn')}
        </>
      </DynamicButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SMS OTP Form (2-step, fallback mode)
// ────────────────────────────────────────────────────────────

function SmsOtpForm({
  design,
  onAuthenticate,
  loading,
  debugOtp,
  onClearDebugOtp,
}: {
  design: PortalDesignConfig;
  onAuthenticate: (method: string, payload: Record<string, string>) => void;
  loading: boolean;
  debugOtp?: string | null;
  onClearDebugOtp?: () => void;
}) {
  const lang = usePortalLang();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!phone.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'phoneNumber').toLowerCase()); return; }
    setError('');
    onClearDebugOtp?.();
    onAuthenticate('sms_otp', { phoneNumber: phone.trim() });
    setStep('otp');
    setCountdown(60);
  };

  const handleVerifyOtp = () => {
    if (!otp.trim()) { setError(getUIString(lang, 'pleaseEnter') + ' OTP code'); return; }
    setError('');
    onAuthenticate('sms_otp', {
      phoneNumber: phone.trim(),
      otpCode: otp.trim(),
    });
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setOtp('');
    setError('');
    onClearDebugOtp?.();
    onAuthenticate('sms_otp', { phoneNumber: phone.trim() });
    setCountdown(60);
  };

  const mutedColor = getMutedTextColor(design);
  const labelColor = getCardTextColor(design);

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: mutedColor }}>
          {getUIString(lang, 'weWillSendCode')}
        </p>
        <DynamicInput
          design={design}
          label={getUIString(lang, 'phoneNumber')}
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+1 555 123 4567"
          disabled={loading}
          autoFocus
          icon={<Phone className="w-4 h-4" />}
          inputMode="tel"
        />
        {error && <ErrorDisplay message={error} />}
        <DynamicButton design={design} onClick={handleSendOtp} disabled={!phone.trim()} loading={loading}>
          <>
            <Smartphone className="w-5 h-5" />
            {getUIString(lang, 'sendVerificationCode')}
          </>
        </DynamicButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center" style={{ color: mutedColor }}>
        {getUIString(lang, 'enterCodeSentTo')}{' '}
        <span className="font-medium" style={{ color: labelColor }}>{phone}</span>
      </p>
      <DynamicInput
        design={design}
        label={getUIString(lang, 'verificationCode')}
        value={otp}
        onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        disabled={loading}
        autoFocus
        maxLength={6}
        inputMode="numeric"
        className="text-center text-2xl font-mono font-bold tracking-[0.5em]"
      />
      {/* Debug OTP display — visible when no active SMS gateway */}
      {debugOtp && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 text-center">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center justify-center gap-1">
            <Bug className="w-3 h-3" />
            DEBUG — OTP (no SMS gateway)
          </p>
          <p className="text-3xl font-mono font-black tracking-[0.3em] text-amber-800 dark:text-amber-200">
            {debugOtp}
          </p>
          <button
            onClick={() => navigator.clipboard?.writeText(debugOtp)}
            className="mt-1.5 text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 underline"
          >
            Copy to clipboard
          </button>
        </div>
      )}
      {error && <ErrorDisplay message={error} />}
      <DynamicButton design={design} onClick={handleVerifyOtp} disabled={otp.length < 6} loading={loading}>
        <>
          <CheckCircle className="w-5 h-5" />
          {getUIString(lang, 'verifyAndConnect')}
        </>
      </DynamicButton>
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => { setStep('phone'); setOtp(''); setError(''); onClearDebugOtp?.(); }}
          className="hover:underline flex items-center gap-1"
          style={{ color: mutedColor }}
        >
          <span>&larr;</span> {getUIString(lang, 'changeNumber')}
        </button>
        <button
          onClick={handleResend}
          disabled={countdown > 0}
          className="flex items-center gap-1 disabled:opacity-40"
          style={{ color: design.accentColor }}
        >
          <RefreshCw className="w-3 h-3" />
          {countdown > 0 ? getUIString(lang, 'resendIn').replace('{0}', String(countdown)) : getUIString(lang, 'resendCode')}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Open Access Form (fallback mode)
// ────────────────────────────────────────────────────────────

function OpenAccessForm({
  design,
  onConnect,
  loading,
}: {
  design: PortalDesignConfig;
  onConnect: () => void;
  loading: boolean;
}) {
  const lang = usePortalLang();
  const mutedColor = getMutedTextColor(design);

  return (
    <div className="space-y-4">
      <p className="text-sm text-center" style={{ color: mutedColor }}>
        {getUIString(lang, 'openAccessDesc')}
      </p>
      <DynamicButton design={design} onClick={onConnect} loading={loading}>
        <>
          <Globe className="w-5 h-5" />
          {getUIString(lang, 'connectNow')}
        </>
      </DynamicButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Unified Designer-Driven Form (NEW — matches PortalPreviewContent)
// ────────────────────────────────────────────────────────────

/**
 * Renders a SINGLE form with only the fields configured in formFields.
 * This matches exactly what the admin sees in the Portal Designer preview.
 * No tabs — just a clean form with the toggled-on fields.
 */
function UnifiedDesignerForm({
  design,
  formFields,
  authMethod,
  codeParam,
  authenticate,
  loading,
  termsRequired,
  termsAccepted,
  setTermsAccepted,
}: {
  design: PortalDesignConfig;
  formFields: FormFieldsConfig;
  authMethod: string;
  codeParam: string;
  authenticate: (method: string, payload: Record<string, string>) => void;
  loading: boolean;
  termsRequired: boolean;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
}) {
  const lang = usePortalLang();

  // Initialize formData with pre-filled voucher code from QR scan
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (codeParam && formFields['voucherCode']) {
      return { voucherCode: codeParam };
    }
    return {};
  });
  const [error, setError] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [phoneConsent, setPhoneConsent] = useState(false);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Field helpers
  const isFieldEnabled = (key: string): boolean => {
    const val = formFields[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).visible ?? false;
    return false;
  };

  const getFieldLabel = (key: string, fallback: string): string => {
    const val = formFields[key];
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).label || fallback;
    return fallback;
  };

  // Map field keys to UI string keys for translated fallback labels
  const fieldKeyToUiKey: Record<string, string> = {
    firstName: 'firstName',
    lastName: 'lastName',
    roomNumber: 'roomNumber',
    phone: 'phoneNumber',
    email: 'emailAddress',
    passport: 'passport',
    bookingId: 'bookingId',
    username: 'username',
    password: 'password',
    voucherCode: 'voucherCode',
  };

  const getTranslatedFieldLabel = (key: string, fallback: string): string => {
    const adminLabel = getFieldLabel(key, '');
    if (adminLabel) return adminLabel;
    const uiKey = fieldKeyToUiKey[key];
    if (uiKey) return getUIString(lang, uiKey);
    return fallback;
  };

  const isFieldRequired = (key: string): boolean => {
    const val = formFields[key];
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).required ?? false;
    return val === true;
  };

  const showTerms = isFieldEnabled('terms') || isFieldEnabled('termsCheckbox');

  // Get only the enabled input fields (not terms/voucherCode which are special)
  const enabledFields = UNIFIED_FIELD_DEFS.filter((f) => isFieldEnabled(f.key));
  const hasInputFields = enabledFields.length > 0;
  const isSmsOtp = authMethod === 'sms_otp';
  const isOpenAccess = authMethod === 'open_access';

  // QR prefill notice for voucher
  const hasQrPrefill = !!(codeParam && isFieldEnabled('voucherCode'));

  // Build auth payload and submit
  const handleSubmit = useCallback(() => {
    setError('');

    // Validate required fields
    for (const fieldDef of enabledFields) {
      const key = fieldDef.key;
      if (isFieldRequired(key) && !formData[key]?.trim()) {
        const label = getTranslatedFieldLabel(key, fieldDef.label);
        setError(getUIString(lang, 'pleaseEnter') + ' ' + label.toLowerCase());
        return;
      }
    }


    // Terms validation
    if (showTerms && termsRequired && !termsAccepted) {
      setError(getUIString(lang, 'pleaseEnter').replace(/Please enter/i, 'Please accept') + ' ' + getUIString(lang, 'termsAndConditions').toLowerCase());
      return;
    }

    // Build payload based on authMethod
    const payload: Record<string, string> = {};

    switch (authMethod) {
      case 'pms_credentials':
        if (formData.username?.trim()) payload.username = formData.username.trim();
        if (formData.password?.trim()) payload.password = formData.password.trim();
        break;
      case 'room_number':
        if (formData.roomNumber?.trim()) payload.roomNumber = formData.roomNumber.trim();
        // lastName can come from form or guest info
        if (formData.lastName?.trim()) payload.lastName = formData.lastName.trim();
        break;
      case 'voucher':
        if (formData.voucherCode?.trim()) payload.voucherCode = formData.voucherCode.trim();
        break;
      case 'sms_otp': {
        if (!formData.phone?.trim()) {
          setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'phoneNumber').toLowerCase());
          return;
        }
        if (otpStep) {
          if (!otpCode.trim()) {
            setError(getUIString(lang, 'pleaseEnter') + ' ' + getUIString(lang, 'verificationCode').toLowerCase());
            return;
          }
          payload.phoneNumber = formData.phone.trim();
          payload.otpCode = otpCode.trim();
          authenticate('sms_otp', payload);
          return;
        }
        // First step: send OTP
        payload.phoneNumber = formData.phone.trim();
        authenticate('sms_otp', payload);
        setOtpStep(true);
        setOtpCountdown(60);
        return;
      }
      case 'open_access':
        // No payload needed
        break;
      default:
        // Generic: include all form data
        Object.entries(formData).forEach(([k, v]) => {
          if (v?.trim()) payload[k] = v.trim();
        });
    }

    // Include marketing consent data in payload
    if (design.marketingOptIn?.enabled) {
      if (emailConsent) payload.marketingEmailConsent = 'true';
      if (phoneConsent) payload.marketingSmsConsent = 'true';
    }

    // Build guestInfo from form fields (firstName, lastName, email, phone, passport, bookingId)
    const guestInfoFields: Record<string, string> = {};
    if (formData.firstName?.trim()) guestInfoFields.firstName = formData.firstName.trim();
    if (formData.lastName?.trim()) guestInfoFields.lastName = formData.lastName.trim();
    if (formData.email?.trim()) guestInfoFields.email = formData.email.trim();
    if (formData.phone?.trim()) guestInfoFields.phone = formData.phone.trim();
    if (formData.passport?.trim()) guestInfoFields.passport = formData.passport.trim();
    if (formData.bookingId?.trim()) guestInfoFields.bookingId = formData.bookingId.trim();
    if (Object.keys(guestInfoFields).length > 0) {
      payload.guestInfo = JSON.stringify(guestInfoFields);
    }

    authenticate(authMethod, payload);
  }, [formData, authMethod, enabledFields, termsAccepted, termsRequired, showTerms, otpStep, otpCode, authenticate, design.marketingOptIn, emailConsent, phoneConsent, lang, getTranslatedFieldLabel]);

  const handleResendOtp = () => {
    if (otpCountdown > 0) return;
    setOtpCode('');
    setError('');
    setDebugOtp(null);
    authenticate('sms_otp', { phoneNumber: formData.phone?.trim() || '' });
    setOtpCountdown(60);
  };

  // Open access: just a connect button
  if (isOpenAccess && !hasInputFields) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: getMutedTextColor(design) }}>
          {getUIString(lang, 'openAccessDesc')}
        </p>
        {showTerms && termsRequired && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: design.accentColor }}
            />
            <span style={{ color: getMutedTextColor(design) }}>
              {getUIString(lang, 'iAgreeToThe')}{' '}
              <span style={{ color: design.accentColor }} className="font-medium underline cursor-pointer">
                {getUIString(lang, 'termsAndConditions')}
              </span>
            </span>
          </label>
        )}
        {error && <ErrorDisplay message={error} />}
        <DynamicButton design={design} onClick={handleSubmit} disabled={termsRequired && !termsAccepted} loading={loading}>
          <>
            <Globe className="w-5 h-5" />
            {getUIString(lang, 'connectNow')}
          </>
        </DynamicButton>
      </div>
    );
  }

  const mutedColor = getMutedTextColor(design);
  const labelColor = getCardTextColor(design);

  // SMS OTP step 2: show OTP input
  if (isSmsOtp && otpStep) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: mutedColor }}>
          {getUIString(lang, 'enterCodeSentTo')}{' '}
          <span className="font-medium" style={{ color: labelColor }}>{formData.phone}</span>
        </p>
        <DynamicInput
          design={design}
          label={getUIString(lang, 'verificationCode')}
          value={otpCode}
          onChange={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          disabled={loading}
          autoFocus
          maxLength={6}
          inputMode="numeric"
          className="text-center text-2xl font-mono font-bold tracking-[0.5em]"
        />
        {/* Debug OTP display — visible when no active SMS gateway */}
        {debugOtp && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 text-center">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center justify-center gap-1">
              <Bug className="w-3 h-3" />
              DEBUG — OTP (no SMS gateway)
            </p>
            <p className="text-3xl font-mono font-black tracking-[0.3em] text-amber-800 dark:text-amber-200">
              {debugOtp}
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(debugOtp)}
              className="mt-1.5 text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 underline"
            >
              Copy to clipboard
            </button>
          </div>
        )}
        {error && <ErrorDisplay message={error} />}
        <DynamicButton design={design} onClick={handleSubmit} disabled={otpCode.length < 6} loading={loading}>
          <>
            <CheckCircle className="w-5 h-5" />
            {getUIString(lang, 'verifyAndConnect')}
          </>
        </DynamicButton>
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => { setOtpStep(false); setOtpCode(''); setError(''); setDebugOtp(null); }}
            className="hover:underline flex items-center gap-1"
            style={{ color: mutedColor }}
          >
            <span>&larr;</span> {getUIString(lang, 'changeNumber')}
          </button>
          <button
            onClick={handleResendOtp}
            disabled={otpCountdown > 0}
            className="flex items-center gap-1 disabled:opacity-40"
            style={{ color: design.accentColor }}
          >
            <RefreshCw className="w-3 h-3" />
            {otpCountdown > 0 ? getUIString(lang, 'resendIn').replace('{0}', String(otpCountdown)) : getUIString(lang, 'resendCode')}
          </button>
        </div>
      </div>
    );
  }

  // Auth flow indicator
  const flowLabel = authMethod === 'room_number' ? getUIString(lang, 'enterRoom')
    : authMethod === 'voucher' ? getUIString(lang, 'enterVoucher')
    : authMethod === 'sms_otp' ? getUIString(lang, 'otpLogin')
    : authMethod === 'open_access' ? getUIString(lang, 'freeAccess')
    : getUIString(lang, 'signIn');

  return (
    <div className="space-y-4">
      {/* Auth Flow Indicator */}
      <div className="flex items-center gap-1.5">
        <Wifi className="w-3.5 h-3.5" style={{ color: mutedColor }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: mutedColor }}>
          {flowLabel}
        </span>
      </div>

      {/* QR prefill notice */}
      {hasQrPrefill && (
        <div
          className="flex items-center gap-2 rounded-lg p-3"
          style={{ backgroundColor: design.accentColor + '15' }}
        >
          <QrCode className="w-4 h-4 flex-shrink-0" style={{ color: design.accentColor }} />
          <p className="text-sm" style={{ color: design.accentColor }}>
            <span className="font-medium">{getUIString(lang, 'qrCodeScanned')}</span> — {getUIString(lang, 'qrCodePrefilled')}
          </p>
        </div>
      )}

      {/* SMS OTP hint */}
      {isSmsOtp && (
        <p className="text-sm text-center" style={{ color: mutedColor }}>
          {getUIString(lang, 'weWillSendCode')}
        </p>
      )}

      {/* Dynamic fields from designer config */}
      {enabledFields.map((fieldDef, index) => {
        const label = getTranslatedFieldLabel(fieldDef.key, fieldDef.label);
        const reqSuffix = isFieldRequired(fieldDef.key) ? ' *' : '';

        return (
          <DynamicInput
            key={fieldDef.key}
            design={design}
            label={label + reqSuffix}
            type={fieldDef.type}
            value={formData[fieldDef.key] || ''}
            onChange={(v) => {
              if (fieldDef.key === 'voucherCode') {
                setFormData((prev) => ({ ...prev, [fieldDef.key]: v.toUpperCase() }));
              } else {
                setFormData((prev) => ({ ...prev, [fieldDef.key]: v }));
              }
            }}
            placeholder={fieldDef.placeholder}
            disabled={loading}
            autoFocus={index === 0}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            icon={fieldDef.icon}
            inputMode={fieldDef.inputMode}
            maxLength={fieldDef.maxLength}
            className={fieldDef.className || ''}
          />
        );
      })}

      {/* Error display */}
      {error && <ErrorDisplay message={error} />}

      {/* Marketing Consent (Feature 2) */}
      <MarketingConsent
        design={design}
        emailConsent={emailConsent}
        setEmailConsent={setEmailConsent}
        phoneConsent={phoneConsent}
        setPhoneConsent={setPhoneConsent}
      />

      {/* Terms checkbox (Feature 6 — enhanced with modal link) */}
      {showTerms && termsRequired && (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: design.accentColor }}
          />
          <span style={{ color: getMutedTextColor(design) }}>
            {getUIString(lang, 'iAgreeToThe')}{' '}
            {design.termsUrl ? (
              <a
                href={design.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
                style={{ color: design.accentColor }}
              >
                {getUIString(lang, 'termsAndConditions')}
              </a>
            ) : design.termsText ? (
              <span
                style={{ color: design.accentColor }}
                className="font-medium underline cursor-pointer"
                onClick={() => setTermsModalOpen(true)}
              >
                {getUIString(lang, 'termsAndConditions')}
              </span>
            ) : (
              <span style={{ color: design.accentColor }} className="font-medium">
                {getUIString(lang, 'termsAndConditions')}
              </span>
            )}
          </span>
        </label>
      )}

      {/* Submit button */}
      <DynamicButton
        design={design}
        onClick={handleSubmit}
        disabled={termsRequired && !termsAccepted}
        loading={loading}
      >
        <>
          <Wifi className="w-5 h-5" />
          {isSmsOtp ? getUIString(lang, 'sendVerificationCode') : isOpenAccess ? getUIString(lang, 'connectNow') : getUIString(lang, 'connect')}
        </>
      </DynamicButton>

      {/* Terms Modal */}
      <TermsModal design={design} open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Success Screen
// ────────────────────────────────────────────────────────────

function SuccessScreen({
  authResult,
  design,
  onDisconnect,
  tenantId,
  propertyId,
}: {
  authResult: AuthResult;
  design: PortalDesignConfig;
  onDisconnect: () => void;
  tenantId?: string;
  propertyId?: string;
}) {
  const lang = usePortalLang();
  const [countdown, setCountdown] = useState(10);
  const textColor = getCardTextColor(design);
  const mutedColor = getMutedTextColor(design);
  const accent = design.accentColor;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── External Gateway Redirect ──
  // When the property uses an external MikroTik gateway (externalPortalMode=true),
  // the auth API returns needGatewayLogin=true with the MikroTik login URL and
  // RADIUS credentials. The portal must redirect the guest to that URL so MikroTik
  // can open its own firewall via RADIUS auth.
  useEffect(() => {
    if (authResult.needGatewayLogin && authResult.gatewayCallbackUrl && authResult.radiusUsername && authResult.radiusPassword) {
      const redirectUrl = new URL(authResult.gatewayCallbackUrl);
      redirectUrl.searchParams.set('username', authResult.radiusUsername);
      redirectUrl.searchParams.set('password', authResult.radiusPassword);

      const timer = setTimeout(() => {
        console.log(`[Portal] Redirecting to external gateway: ${authResult.gatewayCallbackUrl}`);
        window.location.href = redirectUrl.toString();
      }, 2000); // 2 second delay to show "Connected" message

      return () => clearTimeout(timer);
    }
  }, [authResult.needGatewayLogin, authResult.gatewayCallbackUrl, authResult.radiusUsername, authResult.radiusPassword]);

  return (
    <div className="text-center space-y-5 py-4">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-full"
        style={{ backgroundColor: accent + '15' }}
      >
        <CheckCircle className="w-10 h-10" style={{ color: accent }} />
      </div>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: textColor }}>
          {getUIString(lang, 'connected')}
        </h2>
        <p className="text-sm mt-1" style={{ color: mutedColor }}>
          {authResult.message || 'You are now connected to hotel WiFi.'}
        </p>
        {design.welcomeMessage && (
          <p className="text-sm mt-2 italic" style={{ color: accent }}>
            {getLocalizedText(design, 'welcomeMessage', lang)}
          </p>
        )}
        {/* External gateway redirect notice */}
        {authResult.needGatewayLogin && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />
            <p className="text-sm" style={{ color: mutedColor }}>
              Redirecting to gateway...
            </p>
          </div>
        )}
      </div>

      {/* Session Info Card */}
      <div
        className="rounded-xl p-4 text-sm space-y-3"
        style={{
          backgroundColor: accent + '08',
          border: `1px solid ${accent}20`,
          borderRadius: design.formStyle === 'pill' ? '1.5rem' : design.formStyle === 'square' ? '0' : '0.75rem',
        }}
      >
        <h3 className="font-semibold text-left" style={{ color: textColor }}>
          {getUIString(lang, 'sessionDetails')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>{getUIString(lang, 'duration')}</p>
              <p className="font-medium" style={{ color: textColor }}>
                {(() => {
                  const mins = authResult.remainingMinutes ?? authResult.sessionTimeout;
                  if (mins >= 60) {
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return m > 0 ? `${h}h ${m}m` : `${h}h`;
                  }
                  return `${mins} min`;
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>{getUIString(lang, 'download')}</p>
              <p className="font-medium" style={{ color: textColor }}>{authResult.bandwidthDown} Mbps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>{getUIString(lang, 'upload')}</p>
              <p className="font-medium" style={{ color: textColor }}>{authResult.bandwidthUp} Mbps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>{getUIString(lang, 'method')}</p>
              <p className="font-medium capitalize" style={{ color: textColor }}>
                {authResult.method.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="text-sm flex items-center gap-1 justify-center mx-auto hover:underline"
        style={{ color: accent }}
      >
        <RefreshCw className="w-3 h-3" />
        {getUIString(lang, 'connectAnotherDevice')}
      </button>

      {/* Disconnect / Logout Button */}
      <button
        onClick={onDisconnect}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: design.formStyle === 'pill' ? '1.5rem' : design.formStyle === 'square' ? '0' : '0.5rem',
        }}
      >
        <LogOut className="w-4 h-4" />
        Disconnect & Logout
      </button>

      {/* Post-Connect Guest Survey (Feature 4) */}
      <GuestSurvey design={design} tenantId={tenantId} propertyId={propertyId} sessionId={authResult?.sessionId} guestId={authResult?.guestId} />

      {/* F12: Detailed Survey Widget — rendered below GuestSurvey when tenantId/propertyId available */}
      {tenantId && propertyId && (
        <div className="mt-4">
          <SurveyWidget
            tenantId={tenantId}
            propertyId={propertyId}
            sessionId={authResult?.sessionId}
            guestId={authResult?.guestId}
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Hotel Info Block
// ────────────────────────────────────────────────────────────

function HotelInfoBlock({ design, dark }: { design: PortalDesignConfig; dark: boolean }) {
  const lang = usePortalLang();
  const hasContent = design.hotelName || design.hotelAddress || design.hotelPhone || design.hotelWebsite;
  if (!design.showHotelInfo) return null;
  const textColor = dark ? '#ffffff' : design.textColor;
  const mutedColor = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  const hotelName = getLocalizedText(design, 'hotelName', lang);
  const hotelAddress = getLocalizedText(design, 'hotelAddress', lang);

  return (
    <div className="w-full text-center space-y-1">
      {hotelName && <p className="text-sm font-semibold" style={{ color: textColor }}>{hotelName}</p>}
      <div className="flex items-center justify-center gap-1 text-xs" style={{ color: mutedColor }}>
        {hotelAddress && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{hotelAddress}</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 text-xs" style={{ color: mutedColor }}>
        {design.hotelPhone && (
          <span className="flex items-center gap-1"><PhoneCall className="w-3 h-3" />{design.hotelPhone}</span>
        )}
        {design.hotelWebsite && (
          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{design.hotelWebsite}</span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Amenities Block
// ────────────────────────────────────────────────────────────

function AmenitiesBlock({ design, dark }: { design: PortalDesignConfig; dark: boolean }) {
  const presetAmenities = (design.amenities || []).filter(Boolean);
  const customAmenities = (design.customAmenities || []).filter((a) => a.name);
  const allAmenities = [
    ...presetAmenities.map((name) => ({ name, icon: '' })),
    ...customAmenities,
  ];

  if (!design.showAmenities) return null;
  const iconColor = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {allAmenities.map((a, i) => {
        const AmIcon = AMENITY_ICONS[a.name]
          || (a.icon ? CUSTOM_AMENITY_ICONS[a.icon.toLowerCase()] : null)
          || Star;
        return (
          <span
            key={`${a.name}-${i}`}
            className="px-2.5 py-1 text-xs rounded-full font-medium backdrop-blur-sm"
            style={{
              backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
              color: dark ? 'rgba(255,255,255,0.9)' : undefined,
            }}
          >
            <AmIcon className="w-3 h-3 inline mr-1" style={{ color: iconColor }} />
            {a.name}
          </span>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Promotion Block
// ────────────────────────────────────────────────────────────

function PromotionBlock({ design }: { design: PortalDesignConfig }) {
  const lang = usePortalLang();
  if (!design.showPromotion) return null;
  const dark = isDarkBackground(design);

  const promoTitle = getLocalizedText(design, 'promotionTitle', lang);
  const promoDesc = getLocalizedText(design, 'promotionDesc', lang);

  return (
    <div
      className="w-full flex items-start gap-3 rounded-xl p-3"
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.12)' : design.accentColor + '10',
        backdropFilter: dark ? 'blur(8px)' : undefined,
        border: dark ? '1px solid rgba(255,255,255,0.15)' : 'none',
      }}
    >
      <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: design.accentColor }} />
      <div>
        {promoTitle && (
          <p className="font-semibold text-sm" style={{ color: dark ? '#ffffff' : getCardTextColor(design) }}>
            {promoTitle}
          </p>
        )}
        {promoDesc && (
          <p className="text-xs mt-1" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>
            {promoDesc}
          </p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Social Links Block
// ────────────────────────────────────────────────────────────

function SocialLinksBlock({ design }: { design: PortalDesignConfig }) {
  const activeLinks = (design.socialLinks || []).filter((l) => l.url);

  if (!design.showSocialMedia) return null;
  const dark = isDarkBackground(design);

  return (
    <div className="flex items-center justify-center gap-3">
      {activeLinks.map((l) => {
        const brandColor = getSocialPlatformColor(l.platform);
        return (
          <a
            key={l.platform}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
            style={{
              backgroundColor: brandColor,
              color: '#ffffff',
              boxShadow: `0 2px 8px ${brandColor}40`,
            }}
            aria-label={l.platform}
          >
            <span className="text-xs font-bold">{getSocialIconLabel(l.platform)}</span>
          </a>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Logo Component
// ────────────────────────────────────────────────────────────

function PortalLogo({ design, size }: { design: PortalDesignConfig; size?: 'large' | 'medium' | 'small' }) {
  const dark = isDarkBackground(design);
  const sz = size || (design.logoSize as 'large' | 'medium' | 'small') || 'large';
  const sizeClasses = sz === 'large' ? 'h-[72px] w-auto mb-4' : sz === 'medium' ? 'h-[56px] w-auto' : 'h-[40px] w-auto';
  const containerClasses = sz === 'large' ? 'w-[72px] h-[72px] rounded-2xl mb-4' : sz === 'medium' ? 'w-[56px] h-[56px] rounded-xl' : 'w-[40px] h-[40px] rounded-xl';
  const iconSize = sz === 'large' ? 'w-8 h-8' : sz === 'medium' ? 'w-6 h-6' : 'w-5 h-5';

  if (design.logoUrl) {
    return (
      <img
        src={design.logoUrl}
        alt="Hotel Logo"
        className={cn('mx-auto object-contain drop-shadow-lg transition-transform duration-300 hover:scale-105', sizeClasses)}
      />
    );
  }

  return (
    <Image
      src="/images/cryptsk-logo.png"
      alt="Cryptsk"
      width={40}
      height={40}
      loading="eager"
      className={cn('object-contain mx-auto drop-shadow-lg transition-transform duration-300 hover:scale-105', sizeClasses)}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Main Portal Content
// ────────────────────────────────────────────────────────────

type PortalState =
  | 'loading'
  | 'auth_form'
  | 'authenticating'
  | 'success'
  | 'error';

function PortalContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';
  // MAC address from NAS/AP — typically passed as ?mac=AA:BB:CC:DD:EE:FF in captive portal redirect URL
  const clientMac = searchParams.get('mac') || searchParams.get('client_mac') || searchParams.get('id') || '';

  const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(null);
  const [design, setDesign] = useState<PortalDesignConfig>(DEFAULT_PORTAL_DESIGN);
  const [state, setState] = useState<PortalState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [guestInfo, setGuestInfo] = useState({ firstName: '', lastName: '', email: '', phone: '', passport: '', bookingId: '' });
  const [selectedLanguage, setSelectedLanguage] = useState('');

  // Auto-auth state
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);
  const [maxDeviceMessage, setMaxDeviceMessage] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Pre-generated fingerprint — computed once on mount and reused for
  // both auto-auth attempts and manual auth DeviceProfile creation.
  // This avoids generating the fingerprint twice and ensures consistency.
  const [preGeneratedFingerprint, setPreGeneratedFingerprint] = useState<string | null>(null);

  // Pre-generate fingerprint as soon as the component mounts (runs in background)
  useEffect(() => {
    generateFingerprint().then((fp) => {
      setPreGeneratedFingerprint(fp.hash);
      console.log('[Portal] Fingerprint pre-generated:', fp.hash.substring(0, 12) + '...', '(' + fp.signals.signalCount + ' signals, ' + fp.collectionTimeMs + 'ms)');
    }).catch(() => {
      console.warn('[Portal] Fingerprint pre-generation failed — will retry on auth');
    });
  }, []);

  // ── Apply portal config to state ──
  const applyPortalConfig = useCallback((data: PortalConfig) => {
    console.log('[Portal] Applying config:', {
      name: data.name,
      authMethod: data.authMethod,
      formFields: data.formFields ? Object.keys(data.formFields).length + ' fields' : 'null',
      bgType: data.design?.backgroundType,
      bgColor: data.design?.backgroundColor,
      formStyle: data.design?.formStyle,
      title: data.design?.title,
    });
    setPortalConfig(data);
    setDesign(mergeDesignConfig(data.design));
    const methods = data.authMethods?.length
      ? data.authMethods
      : [{ method: data.authMethod || 'voucher', label: data.authMethod || 'voucher', description: '' }];
    setSelectedMethod(methods[0].method);
    setState('auth_form');
  }, []);

  // ── Attempt silent auto-auth for returning devices ──
  // Called after portal config is loaded. Checks if this device has a
  // saved fingerprint/storageToken that matches a known DeviceProfile.
  // Falls back to MAC-based matching when browser fingerprint is unavailable (HTTP/no-crypto.subtle).
  const attemptAutoAuth = useCallback(
    async (slug: string) => {
      try {
        // Use pre-generated fingerprint, or generate fresh if not ready yet
        let fpHash: string | null = preGeneratedFingerprint || null;
        if (!fpHash) {
          try {
            const fp = await generateFingerprint();
            fpHash = fp.hash;
            setPreGeneratedFingerprint(fp.hash); // Cache for future use
          } catch {
            console.warn('[Portal] Fingerprint generation failed — will try MAC-based auto-auth');
          }
        }

        // Ensure storageToken exists (create if needed)
        let storageToken = getStorageToken();
        if (!storageToken) {
          storageToken = saveStorageToken();
        }

        console.log('[Portal] Auto-auth attempt:', {
          fingerprintPrefix: fpHash ? fpHash.substring(0, 12) + '...' : 'none',
          hasStorageToken: !!storageToken,
          macAddress: clientMac || 'none',
        });

        const res = await fetch('/api/v1/wifi/auto-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprintHash: fpHash || undefined,
            storageToken: storageToken || undefined,
            portalSlug: slug,
            macAddress: clientMac || undefined,
          }),
        });

        const result = await res.json();

        if (result.success && result.data?.authenticated) {
          console.log('[Portal] ✅ Auto-auth SUCCESS — silent re-authentication');
          setAuthResult(result.data);
          setState('success');
          return true;
        }

        // Handle specific error codes with user-facing messages
        const errorCode = result.error?.code;
        if (errorCode === 'MAX_DEVICES') {
          console.warn('[Portal] Auto-auth blocked: max device limit reached');
          setMaxDeviceMessage(result.error?.message || 'Maximum device limit reached. Disconnect another device to log in.');
          setState('auth_form');
          return false;
        }

        console.log('[Portal] Auto-auth no match:', errorCode || 'unknown');
        return false;
      } catch (err) {
        console.warn('[Portal] Auto-auth failed:', err);
        return false;
      }
    },
    [preGeneratedFingerprint, clientMac]
  );

  // ── Fetch portal config on mount — IP-based auto-resolution ──
  useEffect(() => {
    let cancelled = false;
    const fetchPortal = async () => {
      try {
        const resolveRes = await fetch('/api/wifi/portal/resolve-zone');
        if (cancelled) return;
        if (!resolveRes.ok) {
          console.error('[Portal] resolve-zone HTTP error:', resolveRes.status, resolveRes.statusText);
          setState('auth_form');
          return;
        }
        const resolveResult = await resolveRes.json();

        if (resolveResult.success && resolveResult.data?.config) {
          console.log(
            '[Portal] Resolved zone:',
            resolveResult.data.zone,
            resolveResult.data.isDefault ? '(default fallback)' : `subnet: ${resolveResult.data.matchedSubnet}`
          );
          applyPortalConfig(resolveResult.data.config as PortalConfig);
        } else {
          console.warn('[Portal] No portal config available, using voucher fallback');
          setState('auth_form');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[Portal] Failed to fetch config:', err);
        setState('auth_form');
      }
    };
    fetchPortal();
    return () => { cancelled = true; };
  }, [applyPortalConfig]);

  // ── After portal config loads, attempt auto-auth ──
  useEffect(() => {
    // Skip auto-auth if portal has it disabled (admin toggle)
    if (portalConfig?.autoAuthEnabled === false) {
      console.log('[Portal] Auto-auth disabled for this portal, showing login form');
      return;
    }
    if (portalConfig?.slug && !autoAuthAttempted && state === 'auth_form') {
       
      setAutoAuthAttempted(true);
      attemptAutoAuth(portalConfig.slug);
    }
  }, [portalConfig?.slug, portalConfig?.autoAuthEnabled, autoAuthAttempted, state, attemptAutoAuth]);

  // ── Authentication handler ──
  const portalSlug = portalConfig?.slug || 'default';
  const authenticate = useCallback(
    async (method: string, payload: Record<string, string>) => {

      setState('authenticating');
      setErrorMessage('');

      try {
        // Include real fingerprint + storageToken in the auth request body
        // so the server can create the DeviceProfile with the correct fingerprint
        // (needed for auto-reauth on future visits)
        const storageToken = saveStorageToken(); // Create/reuse localStorage token
        const fpHash = preGeneratedFingerprint || (await generateFingerprint().then(fp => fp.hash).catch(() => null));

        const body: Record<string, unknown> = { method, portalSlug, ...payload };
        if (clientMac) body.macAddress = clientMac;
        if (fpHash) body.fingerprintHash = fpHash;
        if (storageToken) body.storageToken = storageToken;

        const res = await fetch('/api/v1/wifi/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();

        // SMS OTP first step: just sending phone, don't transition state
        if (method === 'sms_otp' && !payload.otpCode && result.success) {
          // Capture debug OTP for testing without SMS gateway
          if (result.data?._debugOtp) {
            setDebugOtp(result.data._debugOtp);
          }
          return;
        }

        if (result.success && result.data?.authenticated) {
          // DeviceProfile is now created server-side with the real fingerprint
          // (included in the auth request body). No need for separate fire-and-forget.
          // The auto-auth _createProfile fire-and-forget is kept as a fallback
          // in case the auth route didn't receive the fingerprint (rare edge case).
          if (!fpHash) {
            try {
              const fallbackFp = await generateFingerprint();
              const fallbackToken = saveStorageToken();
              fetch('/api/v1/wifi/auto-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fingerprintHash: fallbackFp.hash,
                  storageToken: fallbackToken,
                  portalSlug,
                  macAddress: clientMac || undefined,
                  _createProfile: true,
                  _wifiUsername: result.data.username,
                }),
              }).catch(() => {}); // Best-effort fallback
            } catch { /* silent */ }
          }

          setAuthResult(result.data);
          setState('success');
        } else {
          setState('error');
          setErrorMessage(result.error?.message || 'Authentication failed');
        }
      } catch {
        setState('error');
        setErrorMessage('Network error. Please ensure you are connected to the hotel WiFi and try again.');
      }
    },
    [portalSlug, preGeneratedFingerprint]
  );

  // ── Disconnect handler: ends session, resets portal ──
  // IMPORTANT: We do NOT delete the DeviceProfile and do NOT clear the storageToken.
  // This enables auto-reauth on the next visit — when the user opens the portal again,
  // the pre-generated fingerprint will match the existing DeviceProfile, and the
  // storageToken will match via Strategy 1 (most reliable).
  // To truly sign out from all devices, the user can use a separate "forget device" action.
  const handleDisconnect = useCallback(async () => {
    try {
      // 1. Close any active radacct sessions for this user (sets acctstoptime)
      if (authResult?.username) {
        await fetch('/api/v1/wifi/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authResult.username,
            source: 'portal', // Keep DeviceProfile active for future auto-auth
          }),
        }).catch(() => {});
      }

      // 2. Keep storageToken — do NOT clear it!
      //    Auto-reauth will use it on the next visit to match by Strategy 1.
    } catch {
      // Best effort — proceed with reset regardless
    }

    // Reset portal state to show login form
    setAuthResult(null);
    setAutoAuthAttempted(false);
    setState('auth_form');
    setErrorMessage('');
  }, [authResult]);

  // ── Derived values ──
  const authMethods = portalConfig?.authMethods?.length
    ? portalConfig.authMethods
    : DEFAULT_AUTH_METHODS;
  const activeMethod = selectedMethod || authMethods[0]?.method || 'voucher';
  const formFields = portalConfig?.formFields || null;
  const dark = isDarkBackground(design);
  const animCls = getAnimationClasses(design);

  const effectiveLanguage = selectedLanguage || design.defaultLanguage || 'en';

  // ════════════════════════════════════════════════════════════
  // KEY LOGIC: Determine which rendering mode to use
  // ════════════════════════════════════════════════════════════

  /**
   * hasConfiguredFormFields: Checks if formFields has ANY auth-related
   * field set to true. This determines whether we render the unified
   * designer-driven form or fall back to the tab-based approach.
   *
   * The keys we check include ALL designer field keys plus backward-compat
   * keys (termsCheckbox, voucherCode).
   */
  const hasConfiguredFormFields = (): boolean => {
    if (!formFields || typeof formFields !== 'object') return false;
    const designerKeys = [
      'firstName', 'lastName', 'roomNumber', 'phone', 'email',
      'passport', 'bookingId', 'username', 'password',
      'terms', 'termsCheckbox', 'voucherCode',
    ];
    return designerKeys.some((key) => {
      const val = formFields[key];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).visible ?? false;
      return false;
    });
  };

  const useUnifiedForm = hasConfiguredFormFields();
  const effectiveAuthMethod = useUnifiedForm
    ? (portalConfig?.authMethod || 'voucher')
    : activeMethod;

  // ── Form field helpers (for fallback mode) ──
  const isFieldVisible = (key: string): boolean => {
    if (!formFields) return false;
    const val = formFields[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).visible ?? false;
    return false;
  };

  const isFieldRequired = (key: string): boolean => {
    if (!formFields) return false;
    const val = formFields[key];
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).required ?? false;
    return false;
  };

  const getFieldLabel = (key: string, fallback: string): string => {
    if (!formFields) return fallback;
    const val = formFields[key];
    if (typeof val === 'object' && val !== null) return (val as FormFieldConfig).label || fallback;
    return fallback;
  };

  const hasVisibleGuestFields = (): boolean => {
    return ['firstName', 'lastName', 'email', 'phone', 'passport', 'bookingId'].some(isFieldVisible);
  };

  // ── Background ──
  const bgStyle = getBackgroundStyle(design);
  const overlayStyle = getOverlayStyle(design);
  const bodyBg = getBackgroundCSSValue(design);

  // ── Sync body background ──
  useEffect(() => {
    if (bodyBg) {
      document.body.style.background = bodyBg;
      document.body.style.margin = '0';
      document.body.style.fontFamily = design.fontFamily;
    }
    return () => {
      document.body.style.background = '';
      document.body.style.margin = '';
      document.body.style.fontFamily = '';
    };
  }, [bodyBg, design.fontFamily]);

  // ── Loading state ──
  if (state === 'loading') {
    return (
      <PortalLanguageContext.Provider value={effectiveLanguage}>
        <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: dark ? '#ffffff' : design.textColor }} />
            <p className="text-sm" style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }}>
              {getUIString(effectiveLanguage, 'loadingPortal')}
            </p>
          </div>
        </div>
      </PortalLanguageContext.Provider>
    );
  }

  const isVoucherPrefill = codeParam && effectiveAuthMethod === 'voucher';
  const canSubmit = !portalConfig?.termsRequired || termsAccepted;

  // ── Guest info payload (fallback mode only) ──
  const buildGuestInfoPayload = (): Record<string, unknown> | undefined => {
    if (!hasVisibleGuestFields()) return undefined;
    const info: Record<string, string> = {};
    if (isFieldVisible('firstName') && guestInfo.firstName.trim()) info.firstName = guestInfo.firstName.trim();
    if (isFieldVisible('lastName') && guestInfo.lastName.trim()) info.lastName = guestInfo.lastName.trim();
    if (isFieldVisible('email') && guestInfo.email.trim()) info.email = guestInfo.email.trim();
    if (isFieldVisible('phone') && guestInfo.phone.trim()) info.phone = guestInfo.phone.trim();
    if (isFieldVisible('passport') && guestInfo.passport?.trim()) info.passport = guestInfo.passport.trim();
    if (isFieldVisible('bookingId') && guestInfo.bookingId?.trim()) info.bookingId = guestInfo.bookingId.trim();
    return Object.keys(info).length > 0 ? info : undefined;
  };

  // ── Render auth form by method (FALLBACK MODE) ──
  const renderFallbackAuthForm = () => {
    switch (effectiveAuthMethod) {
      case 'voucher':
        return (
          <VoucherForm
            design={design}
            initialCode={isVoucherPrefill ? codeParam : ''}
            onSubmit={(code) =>
              authenticate('voucher', { voucherCode: code, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
            hasQrPrefill={isVoucherPrefill}
          />
        );
      case 'room_number':
        return (
          <RoomNumberForm
            design={design}
            onSubmit={(room, name) =>
              authenticate('room_number', { roomNumber: room, lastName: name, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
          />
        );
      case 'pms_credentials':
        return (
          <PmsCredentialsForm
            design={design}
            onSubmit={(username, password) =>
              authenticate('pms_credentials', { username, password, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
          />
        );
      case 'sms_otp':
        return (
          <SmsOtpForm
            design={design}
            onAuthenticate={(method, payload) => {
              const gi = buildGuestInfoPayload();
              authenticate(method, gi ? { ...payload, guestInfo: gi } : payload);
            }}
            loading={state === 'authenticating'}
            debugOtp={debugOtp}
            onClearDebugOtp={() => setDebugOtp(null)}
          />
        );
      case 'open_access':
        return (
          <OpenAccessForm
            design={design}
            onConnect={() => authenticate('open_access', { ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })}
            loading={state === 'authenticating'}
          />
        );
      default:
        return (
          <VoucherForm
            design={design}
            initialCode={isVoucherPrefill ? codeParam : ''}
            onSubmit={(code) =>
              authenticate('voucher', { voucherCode: code, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
            hasQrPrefill={isVoucherPrefill}
          />
        );
    }
  };

  // ── Method selector tabs (DISABLED) ──
  // Tabs have been removed. When formFields is configured we use the unified
  // designer form. When formFields is null we use a simple single-method
  // fallback — no tabs, no method switching.
  const renderMethodTabs = () => null;

  // ── Guest info fields section (FALLBACK MODE only) ──
  const renderGuestInfoFields = () => {
    if (useUnifiedForm) return null; // Guest fields are part of the unified form
    if (!hasVisibleGuestFields()) return null;

    const lang = effectiveLanguage;

    return (
      <div className="space-y-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}` }}>
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: getMutedTextColor(design) }}>
          Guest Information
        </p>
        {isFieldVisible('firstName') && (
          <DynamicInput
            design={design}
            label={getFieldLabel('firstName', getUIString(lang, 'firstName')) + (isFieldRequired('firstName') ? ' *' : '')}
            value={guestInfo.firstName}
            onChange={(v) => setGuestInfo((prev) => ({ ...prev, firstName: v }))}
            placeholder="John"
            disabled={state === 'authenticating'}
            icon={<User className="w-4 h-4" />}
          />
        )}
        {isFieldVisible('lastName') && (
          <DynamicInput
            design={design}
            label={getFieldLabel('lastName', getUIString(lang, 'lastName')) + (isFieldRequired('lastName') ? ' *' : '')}
            value={guestInfo.lastName}
            onChange={(v) => setGuestInfo((prev) => ({ ...prev, lastName: v }))}
            placeholder="Smith"
            disabled={state === 'authenticating'}
            icon={<User className="w-4 h-4" />}
          />
        )}
        {isFieldVisible('email') && (
          <DynamicInput
            design={design}
            label={getFieldLabel('email', getUIString(lang, 'emailAddress')) + (isFieldRequired('email') ? ' *' : '')}
            type="email"
            value={guestInfo.email}
            onChange={(v) => setGuestInfo((prev) => ({ ...prev, email: v }))}
            placeholder="john@example.com"
            disabled={state === 'authenticating'}
            icon={<Mail className="w-4 h-4" />}
          />
        )}
        {isFieldVisible('phone') && (
          <DynamicInput
            design={design}
            label={getFieldLabel('phone', getUIString(lang, 'phoneNumber')) + (isFieldRequired('phone') ? ' *' : '')}
            type="tel"
            value={guestInfo.phone}
            onChange={(v) => setGuestInfo((prev) => ({ ...prev, phone: v }))}
            placeholder="+1 555 123 4567"
            disabled={state === 'authenticating'}
            icon={<Phone className="w-4 h-4" />}
            inputMode="tel"
          />
        )}
      </div>
    );
  };

  // ── Layout type ──
  const isSplit = design.layoutType === 'split_left' || design.layoutType === 'split_right';
  const isHeroBanner = design.layoutType === 'hero_banner';
  const isSidePanel = design.layoutType === 'side_panel';
  const isBottomSheet = design.layoutType === 'bottom_sheet';
  const formCls = getFormContainerClasses(design);
  const cardShadowStyle = getCardShadowCSS(design);

  // ── Content Block Ordering (Feature 9) ──
  const DEFAULT_BLOCK_ORDER = ['promotion', 'logo', 'language', 'title', 'hotelInfo', 'amenities', 'form', 'social', 'clock', 'weather', 'survey'];
  const savedOrder = design.contentBlockOrder?.length ? design.contentBlockOrder : [];
  // Merge: saved order first (preserving admin's arrangement), then append any missing default blocks
  const blockOrder = savedOrder.length > 0
    ? [...savedOrder, ...DEFAULT_BLOCK_ORDER.filter(b => !savedOrder.includes(b))]
    : DEFAULT_BLOCK_ORDER;

  // ── Render the card content (shared across layouts) ──
  const renderCardContent = () => {
    if (state === 'success' && authResult) {
      return <SuccessScreen authResult={authResult} design={design} onDisconnect={handleDisconnect} tenantId={portalConfig?.tenantId} propertyId={portalConfig?.propertyId} />;
    }

    if (useUnifiedForm && formFields) {
      // ══════════════════════════════════════════════════════════
      // UNIFIED DESIGNER FORM — matches PortalPreviewContent
      // ══════════════════════════════════════════════════════════
      return (
        <>
          {state === 'error' && errorMessage && <ErrorDisplay message={errorMessage} />}
          {maxDeviceMessage && <ErrorDisplay message={maxDeviceMessage} />}
          <UnifiedDesignerForm
            design={design}
            formFields={formFields}
            authMethod={effectiveAuthMethod}
            codeParam={codeParam}
            authenticate={authenticate}
            loading={state === 'authenticating'}
            termsRequired={portalConfig?.termsRequired ?? false}
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
          />
        </>
      );
    }

    // ══════════════════════════════════════════════════════════
    // FALLBACK MODE — simple single-method form (NO tabs)
    // ══════════════════════════════════════════════════════════
    return (
      <>
        {state === 'error' && errorMessage && <ErrorDisplay message={errorMessage} />}
        {maxDeviceMessage && <ErrorDisplay message={maxDeviceMessage} />}

        {/* Auth Form — no tabs, just the default method's form */}
        <div
          className="transition-opacity duration-200"
          style={{ opacity: canSubmit ? 1 : 0.5, pointerEvents: canSubmit ? 'auto' : 'none' }}
        >
          {renderGuestInfoFields()}
          {renderFallbackAuthForm()}
        </div>

        {/* Terms checkbox (fallback mode, when terms not in formFields) */}
        {portalConfig?.termsRequired && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: design.accentColor }}
            />
            <span style={{ color: getMutedTextColor(design) }}>
              {getUIString(effectiveLanguage, 'iAgreeToThe')}{' '}
              {portalConfig.design.termsUrl ? (
                <a
                  href={portalConfig.design.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: design.accentColor }}
                >
                  {getUIString(effectiveLanguage, 'termsAndConditions')}
                </a>
              ) : (
                <span style={{ color: design.accentColor }} className="font-medium">
                  {getUIString(effectiveLanguage, 'termsAndConditions')}
                </span>
              )}
            </span>
          </label>
        )}

        {/* Marketing Consent (Feature 2) — fallback mode, inside the card */}
        {state !== 'success' && design.marketingOptIn?.enabled && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <MarketingConsentPlaceholder design={design} />
          </div>
        )}

        {/* Post-Connect Survey (Feature 4) — fallback mode */}
        {state === 'success' && design.surveyConfig?.enabled && (
          <GuestSurvey design={design} tenantId={tenantId} propertyId={propertyId} sessionId={authResult?.sessionId} guestId={authResult?.guestId} />
        )}
      </>
    );
  };

  // ── Block renderer — returns JSX for each named block ──
  const renderBlock = (block: string): React.ReactNode => {
    switch (block) {
      case 'promotion': {
        if (state === 'success') return null;
        const hasPromoContent = design.promotions?.some(p => p.title || p.description);
        // Carousel mode: show only when promotion toggle ON + carousel mode selected + has slides
        if (hasPromoContent && design.showPromotions) {
          const validSlides = design.promotions.filter(p => p.title || p.description);
          if (validSlides.length > 0) return <PromotionCarousel design={design} />;
        }
        // Single promotion mode: show ONLY when the toggle is explicitly ON
        if (design.showPromotion) {
          return <PromotionBlock design={design} />;
        }
        return null;
      }
      case 'clock':
        if (!design.showClock) return null;
        return <div className="mb-3 flex justify-center"><LiveClock design={design} /></div>;
      case 'weather':
        if (!design.showWeather) return null;
        return <div className="mb-3 flex justify-center"><WeatherWidget design={design} /></div>;
      case 'logo':
        return <PortalLogo design={design} size="large" />;
      case 'language':
        // Only render language switcher when multi-language is enabled AND has languages
        if (!design.enableMultiLanguage || !(design.languages?.length > 1)) return null;
        return <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />;
      case 'title':
        return (
          <div className="text-center mb-2">
            <h1
              className="text-2xl md:text-3xl font-bold drop-shadow-sm"
              style={{ fontFamily: design.headingFontFamily, color: dark ? '#ffffff' : design.textColor }}
            >
              {getLocalizedText(design, 'title', effectiveLanguage)}
            </h1>
            <p className="text-sm md:text-base mt-1" style={{ color: getSubtitleColor(design) }}>
              {getLocalizedText(design, 'subtitle', effectiveLanguage)}
            </p>
            {getLocalizedText(design, 'welcomeMessage', effectiveLanguage) && (
              <p className="text-xs mt-2 italic" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>
                {getLocalizedText(design, 'welcomeMessage', effectiveLanguage)}
              </p>
            )}
          </div>
        );
      case 'hotelInfo':
        if (!design.showHotelInfo) return null;
        return <div className="mb-4"><HotelInfoBlock design={design} dark={dark} /></div>;
      case 'amenities':
        if (!design.showAmenities) return null;
        return <div className="mb-5"><AmenitiesBlock design={design} dark={dark} /></div>;
      case 'form':
        return (
          <div
            className={cn('w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 transition-all', formCls)}
            style={{
              ...cardShadowStyle,
              ...(design.formStyle === 'glass' && dark ? { boxShadow: `0 0 30px -5px ${design.accentColor}40, 0 0 60px -10px ${design.accentColor}20` } : {}),
            }}
          >
            {renderCardContent()}
          </div>
        );
      case 'social':
        if (!design.showSocialMedia) return null;
        return <div className="mt-4"><SocialLinksBlock design={design} /></div>;
      case 'survey':
        // Render survey after success or always if enabled (GuestSurvey handles its own state)
        if (!design.surveyConfig?.enabled) return null;
        return <div className="mt-2"><GuestSurvey design={design} tenantId={tenantId} propertyId={propertyId} sessionId={authResult?.sessionId} guestId={authResult?.guestId} /></div>;
      default:
        return null;
    }
  };

  // ── renderFormContent — used by side-panel and bottom-sheet layouts ──
  const renderFormContent = () => renderCardContent();

  // ── Localized strings for portal-level content ──
  const localizedTitle = getLocalizedText(design, 'title', effectiveLanguage);
  const localizedSubtitle = getLocalizedText(design, 'subtitle', effectiveLanguage);
  const localizedWelcome = getLocalizedText(design, 'welcomeMessage', effectiveLanguage);
  const localizedPoweredBy = getUIString(effectiveLanguage, 'poweredBy');

  // ── Main Layout ──
  return (
    <PortalLanguageContext.Provider value={effectiveLanguage}>
      <div
        className={cn('fixed inset-0 flex flex-col overflow-y-auto', animCls)}
        style={{
          ...bgStyle,
          fontFamily: design.fontFamily,
        }}
        dir={effectiveLanguage === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Background overlay */}
        <div className="fixed inset-0 pointer-events-none" style={overlayStyle} />

        {/* Main content */}
        <main className={cn('flex-1 flex items-center justify-center p-4 relative z-10', isBottomSheet && 'items-end')}>
          {isSplit ? (
            // ══════════════════════════════════════════════════════════
            // SPLIT LAYOUT — Left info panel + Right form panel
            // ══════════════════════════════════════════════════════════
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-6">
              {/* ── Left Panel: Hotel Info + Features ── */}
              <div className="flex-1 flex flex-col justify-center p-6 md:p-10 space-y-5" style={{ color: dark ? '#ffffff' : design.textColor }}>
                {/* Language Switcher (Feature 1) — only when enabled AND 2+ languages */}
                {(design.enableMultiLanguage && (design.languages?.length ?? 0) > 1) && (
                  <div className="flex justify-end">
                    <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />
                  </div>
                )}

                <PortalLogo design={design} size="large" />
                <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: design.headingFontFamily }}>
                  {localizedTitle}
                </h1>
                <p style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }} className="text-lg">
                  {localizedSubtitle}
                </p>
                {localizedWelcome && (
                  <p className="italic" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>
                    {localizedWelcome}
                  </p>
                )}

                {/* Clock + Weather Row */}
                <div className="flex items-center justify-center gap-4">
                  {design.showClock && <LiveClock design={design} />}
                  {design.showWeather && (
                    <>
                      <span style={{ color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}>|</span>
                      <WeatherWidget design={design} />
                    </>
                  )}
                </div>

                {design.showHotelInfo && <HotelInfoBlock design={design} dark={dark} />}
                {design.showAmenities && <AmenitiesBlock design={design} dark={dark} />}

                {/* Social Links (Feature 8: More Social Platforms) */}
                {design.showSocialMedia && (
                  <SocialLinksBlock design={design} />
                )}

                {/* Branding */}
                {design.showBranding && (
                  <div className="text-center pt-2" style={{ color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>
                    <p className="text-[10px]">{localizedPoweredBy}</p>
                  </div>
                )}
              </div>

              {/* ── Right Panel: Form + Features ── */}
              <div className="w-full md:w-[420px] animate-in fade-in-0 slide-in-from-bottom-4 duration-500 transition-all flex flex-col gap-4">
                {/* Promotion Carousel (Feature 3) — above the form card */}
                {state !== 'success' && (() => {
                  const hasPromoContent = design.promotions?.some(p => p.title || p.description);
                  // Carousel: show only when promotion toggle ON + carousel mode selected + has slides
                  if (hasPromoContent && design.showPromotions) {
                    return <PromotionCarousel design={design} />;
                  }
                  // Single promotion: show ONLY when toggle is ON
                  if (design.showPromotion) {
                    return <PromotionBlock design={design} />;
                  }
                  return null;
                })()}

                {/* Form Card */}
                <div
                  className={formCls}
                  style={{
                    ...cardShadowStyle,
                    ...(design.formStyle === 'glass' && dark ? { boxShadow: `0 0 30px -5px ${design.accentColor}40, 0 0 60px -10px ${design.accentColor}20` } : {}),
                  }}
                >
                  {/* Mobile-only header */}
                  <div className="md:hidden text-center space-y-2 mb-4">
                    <PortalLogo design={design} size="small" />
                    <h2 className="text-xl font-bold" style={{ color: getCardTextColor(design), fontFamily: design.headingFontFamily }}>
                      {localizedTitle}
                    </h2>
                    <p className="text-sm" style={{ color: getMutedTextColor(design) }}>{localizedSubtitle}</p>
                    {/* Mobile clock + weather */}
                    {(design.showClock || design.showWeather) && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      {design.showClock && <LiveClock design={design} />}
                      {design.showWeather && <WeatherWidget design={design} />}
                    </div>
                    )}
                  </div>

                  {renderCardContent()}

                  {/* Marketing Consent (Feature 2) — inside the form card, after form content */}
                  {state !== 'success' && design.marketingOptIn?.enabled && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                      <MarketingConsentPlaceholder design={design} />
                    </div>
                  )}

                  {/* Post-Connect Survey (Feature 4) — inside the form card, after success */}
                  {state === 'success' && design.surveyConfig?.enabled && (
                    <GuestSurvey design={design} tenantId={tenantId} propertyId={propertyId} sessionId={authResult?.sessionId} guestId={authResult?.guestId} />
                  )}
                </div>
              </div>
            </div>
          ) : isHeroBanner ? (
            // ══════════════════════════════════════════════════════════
            // HERO BANNER LAYOUT — Full-width hero, form below
            // ══════════════════════════════════════════════════════════
            <div className="w-full max-w-lg mx-auto">
              {/* Hero section */}
              <div className="text-center mb-6 space-y-3">
                <PortalLogo design={design} size="large" />
                {(design.enableMultiLanguage && (design.languages?.length ?? 0) > 1) && (
                  <div className="flex justify-center">
                    <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />
                  </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold drop-shadow-sm" style={{ fontFamily: design.headingFontFamily, color: dark ? '#ffffff' : design.textColor }}>
                  {localizedTitle}
                </h1>
                <p className="text-base" style={{ color: getSubtitleColor(design) }}>{localizedSubtitle}</p>
                {localizedWelcome && (
                  <p className="text-sm" style={{ color: getMutedTextColor(design) }}>{localizedWelcome}</p>
                )}
                {/* Clock + Weather row */}
                {(design.showClock || design.showWeather) && (
                  <div className="flex items-center justify-center gap-4 pt-1">
                    {design.showClock && <LiveClock design={design} />}
                    {design.showWeather && <WeatherWidget design={design} />}
                  </div>
                )}
              </div>

              {/* Hotel info + amenities above form */}
              {design.showHotelInfo && <HotelInfoBlock design={design} dark={dark} />}
              {design.showAmenities && <AmenitiesBlock design={design} dark={dark} />}

              {/* Promotion */}
              {state !== 'success' && (() => {
                const hasPromoContent = design.promotions?.some(p => p.title || p.description);
                if (hasPromoContent && design.showPromotions) return <PromotionCarousel design={design} />;
                if (design.showPromotion) return <PromotionBlock design={design} />;
                return null;
              })()}

              {/* Form Card */}
              <div className={cn(formCls, 'mt-2')} style={cardShadowStyle}>
                {renderFormContent()}
              </div>

              {/* Social Links */}
              {design.showSocialMedia && <div className="mt-4"><SocialLinksBlock design={design} /></div>}

              {/* Branding */}
              {design.showBranding && (
                <div className="text-center mt-4" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                  <p className="text-[10px]">{localizedPoweredBy}</p>
                </div>
              )}
            </div>
          ) : isSidePanel ? (
            // ══════════════════════════════════════════════════════════
            // SIDE PANEL LAYOUT — Slim left panel form, right content
            // ══════════════════════════════════════════════════════════
            <div className="w-full max-w-4xl flex flex-col md:flex-row min-h-[60vh]">
              {/* Left Panel: Form */}
              <div className="w-full md:w-[380px] flex flex-col p-6 md:p-8 space-y-4"
                style={{ backgroundColor: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)' }}>
                <PortalLogo design={design} size="small" />
                {(design.enableMultiLanguage && (design.languages?.length ?? 0) > 1) && (
                  <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />
                )}
                <h2 className="text-xl font-bold" style={{ color: getCardTextColor(design), fontFamily: design.headingFontFamily }}>
                  {localizedTitle}
                </h2>
                <p className="text-sm" style={{ color: getMutedTextColor(design) }}>{localizedSubtitle}</p>

                {/* Promotion */}
                {state !== 'success' && (() => {
                  const hasPromoContent = design.promotions?.some(p => p.title || p.description);
                  if (hasPromoContent && design.showPromotions) return <PromotionCarousel design={design} />;
                  if (design.showPromotion) return <PromotionBlock design={design} />;
                  return null;
                })()}

                <div className="flex-1">
                  {renderFormContent()}
                </div>

                {/* Social Links */}
                {design.showSocialMedia && <SocialLinksBlock design={design} />}
              </div>

              {/* Right Panel: Hotel Info */}
              <div className="flex-1 flex flex-col justify-center p-8 md:p-12 space-y-6" style={{ color: dark ? '#ffffff' : design.textColor }}>
                {localizedWelcome && (
                  <p className="text-lg italic" style={{ color: getMutedTextColor(design) }}>"{localizedWelcome}"</p>
                )}
                {design.showHotelInfo && <HotelInfoBlock design={design} dark={dark} />}
                {design.showAmenities && <AmenitiesBlock design={design} dark={dark} />}
                {(design.showClock || design.showWeather) && (
                  <div className="flex items-center gap-4 pt-4">
                    {design.showClock && <LiveClock design={design} />}
                    {design.showWeather && <WeatherWidget design={design} />}
                  </div>
                )}
                {design.showBranding && (
                  <div className="mt-auto pt-4" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                    <p className="text-[10px]">{localizedPoweredBy}</p>
                  </div>
                )}
              </div>
            </div>
          ) : isBottomSheet ? (
            // ══════════════════════════════════════════════════════════
            // BOTTOM SHEET LAYOUT — Mobile-first, form slides up
            // ══════════════════════════════════════════════════════════
            <div className="w-full max-w-md">
              {/* Spacer for background visibility */}
              <div className="h-16" />
              {/* Sheet card */}
              <div className="rounded-t-3xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: dark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                </div>
                <div className="p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <PortalLogo design={design} size="small" />
                    {(design.enableMultiLanguage && (design.languages?.length ?? 0) > 1) && (
                      <div className="flex justify-center">
                        <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />
                      </div>
                    )}
                    <h1 className="text-2xl font-bold" style={{ color: getCardTextColor(design), fontFamily: design.headingFontFamily }}>
                      {localizedTitle}
                    </h1>
                    <p className="text-sm" style={{ color: getMutedTextColor(design) }}>{localizedSubtitle}</p>
                  </div>

                  {/* Promotion */}
                  {state !== 'success' && (() => {
                    const hasPromoContent = design.promotions?.some(p => p.title || p.description);
                    if (hasPromoContent && design.showPromotions) return <PromotionCarousel design={design} />;
                    if (design.showPromotion) return <PromotionBlock design={design} />;
                    return null;
                  })()}

                  {renderFormContent()}

                  {/* Clock + Weather */}
                  {(design.showClock || design.showWeather) && (
                    <div className="flex items-center justify-center gap-4">
                      {design.showClock && <LiveClock design={design} />}
                      {design.showWeather && <WeatherWidget design={design} />}
                    </div>
                  )}

                  {/* Social + Branding */}
                  <div className="flex items-center justify-between">
                    {design.showSocialMedia && <SocialLinksBlock design={design} />}
                    {design.showBranding && (
                      <p className="text-[10px]" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                        {localizedPoweredBy}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // ══════════════════════════════════════════════════════════
            // CENTERED / CARD / FULL-BLEED LAYOUT — with Content Block Ordering (Feature 9)
            // ══════════════════════════════════════════════════════════
            <div className="w-full max-w-md flex flex-col items-center">
              {blockOrder.map((block, i) => (
                <Fragment key={`${block}-${i}`}>
                  {renderBlock(block)}
                </Fragment>
              ))}

              {/* Branding footer */}
              {design.showBranding && (
                <div className="text-center mt-4 animate-in fade-in-0 duration-700 delay-500" style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                  <p className="text-[10px]">{localizedPoweredBy}</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </PortalLanguageContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────
// Page Export (with Suspense boundary for useSearchParams)
// ────────────────────────────────────────────────────────────

export function WifiConnectPortal() {
  return (
    <Suspense
      fallback={
        <PortalLanguageContext.Provider value="en">
          <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0ea5e9, #065f46)' }}>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-white/80 text-sm">{getUIString('en', 'loadingPortal')}</p>
            </div>
          </div>
        </PortalLanguageContext.Provider>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

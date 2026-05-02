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

import { useState, useEffect, Suspense, useCallback, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
} from '@/lib/wifi/portal-design-utils';

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
  authMethod: string;
  sessionTimeout: number;
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
  bandwidthDown: number;
  bandwidthUp: number;
  message: string;
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

  if (!location) return null;

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
          {promotions.map((_, i) => (
            <button
              key={promo.id || i}
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
  if (languages.length <= 1) return null;

  const mutedColor = getMutedTextColor(design);

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Languages className="w-3.5 h-3.5" style={{ color: mutedColor }} />
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        className="text-xs bg-transparent border-none outline-none cursor-pointer appearance-auto"
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
            <span style={{ color: mutedColor }}>I agree to receive email marketing</span>
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
            <span style={{ color: mutedColor }}>I agree to receive SMS marketing</span>
          </label>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Post-Connect Guest Survey (Feature 4)
// ────────────────────────────────────────────────────────────

function GuestSurvey({ design }: { design: PortalDesignConfig }) {
  const surveyConfig = design.surveyConfig;
  const [selected, setSelected] = useState<string | null>(null);

  if (!surveyConfig?.enabled || !surveyConfig.question || !surveyConfig.options?.length) return null;

  const mutedColor = getMutedTextColor(design);
  const textColor = getCardTextColor(design);
  const accent = design.accentColor;

  if (selected) {
    return (
      <div className="text-center space-y-2 mt-4">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full"
          style={{ backgroundColor: accent + '15' }}
        >
          <Check className="w-6 h-6" style={{ color: accent }} />
        </div>
        <p className="text-sm font-medium" style={{ color: textColor }}>
          {surveyConfig.thankYouMessage || 'Thank you for your feedback!'}
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
            onClick={() => setSelected(option)}
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
          <h3 className="text-lg font-bold" style={{ color: textColor }}>Terms &amp; Conditions</h3>
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
          {design.termsText || 'Terms and conditions content will appear here.'}
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
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!code.trim()) {
      setError('Please enter a voucher code');
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
            <span className="font-medium">QR Code scanned</span> — your
            voucher code has been pre-filled
          </p>
        </div>
      )}

      <DynamicInput
        design={design}
        label="Voucher Code"
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
          Connect to WiFi
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
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!room.trim()) { setError('Please enter your room number'); return; }
    if (!name.trim()) { setError('Please enter your last name'); return; }
    setError('');
    onSubmit(room.trim(), name.trim());
  };

  return (
    <div className="space-y-4">
      <DynamicInput
        design={design}
        label="Room Number"
        value={room}
        onChange={setRoom}
        placeholder="e.g. 101"
        disabled={loading}
        autoFocus
        icon={<DoorOpen className="w-4 h-4" />}
      />
      <DynamicInput
        design={design}
        label="Last Name"
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
          Sign In with Room
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
  const [uname, setUname] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!uname.trim()) { setError('Please enter your username'); return; }
    if (!pass.trim()) { setError('Please enter your password'); return; }
    setError('');
    onSubmit(uname.trim(), pass.trim());
  };

  return (
    <div className="space-y-4">
      <DynamicInput
        design={design}
        label="Username"
        value={uname}
        onChange={setUname}
        placeholder="Enter username"
        disabled={loading}
        autoFocus
        icon={<User className="w-4 h-4" />}
      />
      <DynamicInput
        design={design}
        label="Password"
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
          Sign In
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
}: {
  design: PortalDesignConfig;
  onAuthenticate: (method: string, payload: Record<string, string>) => void;
  loading: boolean;
}) {
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
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setError('');
    onAuthenticate('sms_otp', { phoneNumber: phone.trim() });
    setStep('otp');
    setCountdown(60);
  };

  const handleVerifyOtp = () => {
    if (!otp.trim()) { setError('Please enter the OTP code'); return; }
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
    onAuthenticate('sms_otp', { phoneNumber: phone.trim() });
    setCountdown(60);
  };

  const mutedColor = getMutedTextColor(design);
  const labelColor = getCardTextColor(design);

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: mutedColor }}>
          We&apos;ll send a verification code to your phone
        </p>
        <DynamicInput
          design={design}
          label="Phone Number"
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
            Send Verification Code
          </>
        </DynamicButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center" style={{ color: mutedColor }}>
        Enter the 6-digit code sent to{' '}
        <span className="font-medium" style={{ color: labelColor }}>{phone}</span>
      </p>
      <DynamicInput
        design={design}
        label="Verification Code"
        value={otp}
        onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        disabled={loading}
        autoFocus
        maxLength={6}
        inputMode="numeric"
        className="text-center text-2xl font-mono font-bold tracking-[0.5em]"
      />
      {error && <ErrorDisplay message={error} />}
      <DynamicButton design={design} onClick={handleVerifyOtp} disabled={otp.length < 6} loading={loading}>
        <>
          <CheckCircle className="w-5 h-5" />
          Verify & Connect
        </>
      </DynamicButton>
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
          className="hover:underline flex items-center gap-1"
          style={{ color: mutedColor }}
        >
          <span>&larr;</span> Change number
        </button>
        <button
          onClick={handleResend}
          disabled={countdown > 0}
          className="flex items-center gap-1 disabled:opacity-40"
          style={{ color: design.accentColor }}
        >
          <RefreshCw className="w-3 h-3" />
          {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
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
  const mutedColor = getMutedTextColor(design);

  return (
    <div className="space-y-4">
      <p className="text-sm text-center" style={{ color: mutedColor }}>
        Click below to connect to the WiFi network
      </p>
      <DynamicButton design={design} onClick={onConnect} loading={loading}>
        <>
          <Globe className="w-5 h-5" />
          Connect Now
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
        setError(`Please enter ${getFieldLabel(key, fieldDef.label).toLowerCase()}`);
        return;
      }
    }

    // Terms validation
    if (showTerms && termsRequired && !termsAccepted) {
      setError('Please accept the terms and conditions');
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
          setError('Please enter your phone number');
          return;
        }
        if (otpStep) {
          if (!otpCode.trim()) {
            setError('Please enter the verification code');
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

    authenticate(authMethod, payload);
  }, [formData, authMethod, enabledFields, termsAccepted, termsRequired, showTerms, otpStep, otpCode, authenticate, design.marketingOptIn, emailConsent, phoneConsent]);

  const handleResendOtp = () => {
    if (otpCountdown > 0) return;
    setOtpCode('');
    setError('');
    authenticate('sms_otp', { phoneNumber: formData.phone?.trim() || '' });
    setOtpCountdown(60);
  };

  // Open access: just a connect button
  if (isOpenAccess && !hasInputFields) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: getMutedTextColor(design) }}>
          Click below to connect to the WiFi network
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
              I agree to the{' '}
              <span style={{ color: design.accentColor }} className="font-medium underline cursor-pointer">
                terms and conditions
              </span>
            </span>
          </label>
        )}
        {error && <ErrorDisplay message={error} />}
        <DynamicButton design={design} onClick={handleSubmit} disabled={termsRequired && !termsAccepted} loading={loading}>
          <>
            <Globe className="w-5 h-5" />
            Connect Now
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
          Enter the 6-digit code sent to{' '}
          <span className="font-medium" style={{ color: labelColor }}>{formData.phone}</span>
        </p>
        <DynamicInput
          design={design}
          label="Verification Code"
          value={otpCode}
          onChange={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          disabled={loading}
          autoFocus
          maxLength={6}
          inputMode="numeric"
          className="text-center text-2xl font-mono font-bold tracking-[0.5em]"
        />
        {error && <ErrorDisplay message={error} />}
        <DynamicButton design={design} onClick={handleSubmit} disabled={otpCode.length < 6} loading={loading}>
          <>
            <CheckCircle className="w-5 h-5" />
            Verify & Connect
          </>
        </DynamicButton>
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => { setOtpStep(false); setOtpCode(''); setError(''); }}
            className="hover:underline flex items-center gap-1"
            style={{ color: mutedColor }}
          >
            <span>&larr;</span> Change number
          </button>
          <button
            onClick={handleResendOtp}
            disabled={otpCountdown > 0}
            className="flex items-center gap-1 disabled:opacity-40"
            style={{ color: design.accentColor }}
          >
            <RefreshCw className="w-3 h-3" />
            {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  // Auth flow indicator
  const flowLabel = authMethod === 'room_number' ? 'Enter Room'
    : authMethod === 'voucher' ? 'Enter Voucher'
    : authMethod === 'sms_otp' ? 'OTP Login'
    : authMethod === 'open_access' ? 'Free Access'
    : 'Sign In';

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
            <span className="font-medium">QR Code scanned</span> — your
            voucher code has been pre-filled
          </p>
        </div>
      )}

      {/* SMS OTP hint */}
      {isSmsOtp && (
        <p className="text-sm text-center" style={{ color: mutedColor }}>
          We&apos;ll send a verification code to your phone
        </p>
      )}

      {/* Dynamic fields from designer config */}
      {enabledFields.map((fieldDef, index) => {
        const label = getFieldLabel(fieldDef.key, fieldDef.label);
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
            I agree to the{' '}
            {design.termsUrl ? (
              <a
                href={design.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
                style={{ color: design.accentColor }}
              >
                Terms &amp; Conditions
              </a>
            ) : design.termsText ? (
              <span
                style={{ color: design.accentColor }}
                className="font-medium underline cursor-pointer"
                onClick={() => setTermsModalOpen(true)}
              >
                Terms &amp; Conditions
              </span>
            ) : (
              <span style={{ color: design.accentColor }} className="font-medium">
                Terms &amp; Conditions
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
          {isSmsOtp ? 'Send Verification Code' : isOpenAccess ? 'Connect Now' : 'Connect'}
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
}: {
  authResult: AuthResult;
  design: PortalDesignConfig;
  onDisconnect: () => void;
}) {
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
          Connected!
        </h2>
        <p className="text-sm mt-1" style={{ color: mutedColor }}>
          {authResult.message || 'You are now connected to hotel WiFi.'}
        </p>
        {design.welcomeMessage && (
          <p className="text-sm mt-2 italic" style={{ color: accent }}>
            {design.welcomeMessage}
          </p>
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
          Session Details
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>Duration</p>
              <p className="font-medium" style={{ color: textColor }}>
                {authResult.sessionTimeout >= 60
                  ? `${Math.floor(authResult.sessionTimeout / 60)}h ${authResult.sessionTimeout % 60 > 0 ? `${authResult.sessionTimeout % 60}m` : ''}`
                  : `${authResult.sessionTimeout} min`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>Download</p>
              <p className="font-medium" style={{ color: textColor }}>{authResult.bandwidthDown} Mbps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>Upload</p>
              <p className="font-medium" style={{ color: textColor }}>{authResult.bandwidthUp} Mbps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: accent }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: mutedColor }}>Method</p>
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
        Connect another device
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
      <GuestSurvey design={design} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Hotel Info Block
// ────────────────────────────────────────────────────────────

function HotelInfoBlock({ design, dark }: { design: PortalDesignConfig; dark: boolean }) {
  if (!design.showHotelInfo || !design.hotelName) return null;
  const textColor = dark ? '#ffffff' : design.textColor;
  const mutedColor = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  return (
    <div className="w-full text-center space-y-1">
      <p className="text-sm font-semibold" style={{ color: textColor }}>{design.hotelName}</p>
      <div className="flex items-center justify-center gap-1 text-xs" style={{ color: mutedColor }}>
        {design.hotelAddress && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{design.hotelAddress}</span>
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

  if (!design.showAmenities || allAmenities.length === 0) return null;
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
  if (!design.showPromotion || !design.promotionTitle) return null;
  const dark = isDarkBackground(design);

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
        <p className="font-semibold text-sm" style={{ color: dark ? '#ffffff' : getCardTextColor(design) }}>
          {design.promotionTitle}
        </p>
        {design.promotionDesc && (
          <p className="text-xs mt-1" style={{ color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>
            {design.promotionDesc}
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
  if (!design.showSocialMedia || !design.socialLinks?.length) return null;
  const activeLinks = design.socialLinks.filter((l) => l.url);

  if (activeLinks.length === 0) return null;
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
  const sizeClasses = sz === 'large' ? 'h-[72px] mb-4' : sz === 'medium' ? 'h-[56px]' : 'h-[40px]';
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
    <div
      className={cn(
        'inline-flex items-center justify-center mx-auto drop-shadow-md transition-transform duration-300 hover:scale-105',
        containerClasses,
        dark ? 'bg-white/15 backdrop-blur-sm' : 'bg-black/5',
      )}
      style={dark ? { border: '1px solid rgba(255,255,255,0.2)' } : {}}
    >
      <Wifi className={iconSize} style={{ color: dark ? '#ffffff' : design.accentColor }} />
    </div>
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

  const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(null);
  const [design, setDesign] = useState<PortalDesignConfig>(DEFAULT_PORTAL_DESIGN);
  const [state, setState] = useState<PortalState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [guestInfo, setGuestInfo] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [selectedLanguage, setSelectedLanguage] = useState('');

  // Auto-auth state
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);

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
  const attemptAutoAuth = useCallback(
    async (slug: string) => {
      try {
        // Collect fingerprint (async SHA-256)
        const fp = await generateFingerprint();
        const storageToken = getStorageToken();

        console.log('[Portal] Auto-auth attempt:', {
          fingerprintPrefix: fp.hash.substring(0, 12) + '...',
          hasStorageToken: !!storageToken,
          signalsCollected: fp.signals.signalCount,
          collectionTime: fp.collectionTimeMs + 'ms',
        });

        const res = await fetch('/api/v1/wifi/auto-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprintHash: fp.hash,
            storageToken: storageToken || undefined,
            portalSlug: slug,
          }),
        });

        const result = await res.json();

        if (result.success && result.data?.authenticated) {
          console.log('[Portal] ✅ Auto-auth SUCCESS — silent re-authentication');
          setAuthResult(result.data);
          setState('success');
          return true;
        }

        console.log('[Portal] Auto-auth no match:', result.error?.code || 'unknown');
        return false;
      } catch (err) {
        console.warn('[Portal] Auto-auth failed:', err);
        return false;
      }
    },
    []
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
    if (portalConfig?.slug && !autoAuthAttempted && state === 'auth_form') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoAuthAttempted(true);
      attemptAutoAuth(portalConfig.slug);
    }
  }, [portalConfig?.slug, autoAuthAttempted, state, attemptAutoAuth]);

  // ── Authentication handler ──
  const portalSlug = portalConfig?.slug || 'default';
  const authenticate = useCallback(
    async (method: string, payload: Record<string, string>) => {
      setState('authenticating');
      setErrorMessage('');

      try {
        const body: Record<string, unknown> = { method, portalSlug, ...payload };
        const res = await fetch('/api/v1/wifi/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();

        // SMS OTP first step: just sending phone, don't transition state
        if (method === 'sms_otp' && !payload.otpCode && result.success) return;

        if (result.success && result.data?.authenticated) {
          // ── Save device profile for future auto-auth ──
          try {
            const fp = await generateFingerprint();
            const token = saveStorageToken(); // Create/reuse localStorage token
            // POST to auto-auth to create/update DeviceProfile (fire-and-forget)
            fetch('/api/v1/wifi/auto-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fingerprintHash: fp.hash,
                storageToken: token,
                portalSlug,
                // Extra context for initial profile creation
                _createProfile: true,
                _wifiUsername: result.data.username,
              }),
            }).catch(() => {}); // Best effort
          } catch {
            // Fingerprint collection failed — silent fail, auth still succeeded
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
    [portalSlug]
  );

  // ── Disconnect handler: ends session, resets portal ──
  // IMPORTANT: We do NOT delete the DeviceProfile — it must persist so that
  // auto-auth can match this device by fingerprintHash on the next visit.
  // We only clear the localStorage token so auto-auth creates a fresh one,
  // and close the radacct session so the user disappears from Active Users.
  const handleDisconnect = useCallback(async () => {
    try {
      const token = getStorageToken();

      // 1. Close any active radacct sessions for this user (sets acctstoptime)
      if (authResult?.username) {
        await fetch('/api/v1/wifi/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authResult.username,
          }),
        }).catch(() => {});
      }

      // 2. Clear localStorage token — on next visit, auto-auth will
      //    generate a new token and match by fingerprintHash (Strategy 2),
      //    then save the new token to the existing DeviceProfile.
      clearStorageToken();
    } catch {
      // Best effort — proceed with reset regardless
    }

    // Reset portal state to show login form
    setAuthResult(null);
    setAutoAuthAttempted(false);
    setState('auth_form');
    setErrorMessage('');
  }, [authResult?.username]);

  // ── Derived values ──
  const authMethods = portalConfig?.authMethods?.length
    ? portalConfig.authMethods
    : DEFAULT_AUTH_METHODS;
  const activeMethod = selectedMethod || authMethods[0]?.method || 'voucher';
  const formFields = portalConfig?.formFields || null;
  const dark = isDarkBackground(design);
  const animCls = getAnimationClasses(design);

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
    return ['firstName', 'lastName', 'email', 'phone'].some(isFieldVisible);
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
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: dark ? '#ffffff' : design.textColor }} />
          <p className="text-sm" style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }}>
            Loading portal...
          </p>
        </div>
      </div>
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

    return (
      <div className="space-y-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}` }}>
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: getMutedTextColor(design) }}>
          Guest Information
        </p>
        {isFieldVisible('firstName') && (
          <DynamicInput
            design={design}
            label={getFieldLabel('firstName', 'First Name') + (isFieldRequired('firstName') ? ' *' : '')}
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
            label={getFieldLabel('lastName', 'Last Name') + (isFieldRequired('lastName') ? ' *' : '')}
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
            label={getFieldLabel('email', 'Email') + (isFieldRequired('email') ? ' *' : '')}
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
            label={getFieldLabel('phone', 'Phone') + (isFieldRequired('phone') ? ' *' : '')}
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
  const formCls = getFormContainerClasses(design);
  const cardShadowStyle = getCardShadowCSS(design);

  // ── Content Block Ordering (Feature 9) ──
  const DEFAULT_BLOCK_ORDER = ['promotion', 'logo', 'language', 'title', 'hotelInfo', 'amenities', 'form', 'social', 'clock', 'weather'];
  const blockOrder = (design.contentBlockOrder?.length || 0) > 0 ? design.contentBlockOrder : DEFAULT_BLOCK_ORDER;

  const effectiveLanguage = selectedLanguage || design.defaultLanguage || 'en';

  // ── Render the card content (shared across layouts) ──
  const renderCardContent = () => {
    if (state === 'success' && authResult) {
      return <SuccessScreen authResult={authResult} design={design} onDisconnect={handleDisconnect} />;
    }

    if (useUnifiedForm && formFields) {
      // ══════════════════════════════════════════════════════════
      // UNIFIED DESIGNER FORM — matches PortalPreviewContent
      // ══════════════════════════════════════════════════════════
      return (
        <>
          {state === 'error' && errorMessage && <ErrorDisplay message={errorMessage} />}
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
              I agree to the{' '}
              {portalConfig.design.termsUrl ? (
                <a
                  href={portalConfig.design.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: design.accentColor }}
                >
                  terms and conditions
                </a>
              ) : (
                <span style={{ color: design.accentColor }} className="font-medium">
                  terms and conditions
                </span>
              )}
            </span>
          </label>
        )}
      </>
    );
  };

  // ── Block renderer — returns JSX for each named block ──
  const renderBlock = (block: string): React.ReactNode => {
    switch (block) {
      case 'promotion':
        if (state === 'success') return null;
        if (design.showPromotions && design.promotions?.length > 0) return <PromotionCarousel design={design} />;
        if (design.showPromotion && design.promotionTitle) return <PromotionBlock design={design} />;
        return null;
      case 'clock':
        if (!design.showClock) return null;
        return <div className="mb-3 flex justify-center"><LiveClock design={design} /></div>;
      case 'weather':
        if (!design.showWeather || !design.weatherLocation) return null;
        return <div className="mb-3 flex justify-center"><WeatherWidget design={design} /></div>;
      case 'logo':
        return <PortalLogo design={design} size="large" />;
      case 'language':
        return <LanguageSwitcher design={design} selectedLanguage={effectiveLanguage} setSelectedLanguage={setSelectedLanguage} />;
      case 'title':
        return (
          <div className="text-center mb-2">
            <h1
              className="text-2xl md:text-3xl font-bold drop-shadow-sm"
              style={{ fontFamily: design.headingFontFamily, color: dark ? '#ffffff' : design.textColor }}
            >
              {design.title}
            </h1>
            <p className="text-sm md:text-base mt-1" style={{ color: getSubtitleColor(design) }}>
              {design.subtitle}
            </p>
            {design.welcomeMessage && (
              <p className="text-xs mt-2 italic" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>
                {design.welcomeMessage}
              </p>
            )}
          </div>
        );
      case 'hotelInfo':
        return <div className="mb-4"><HotelInfoBlock design={design} dark={dark} /></div>;
      case 'amenities':
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
        return <div className="mt-4"><SocialLinksBlock design={design} /></div>;
      default:
        return null;
    }
  };

  // ── Main Layout ──
  return (
    <div
      className={cn('fixed inset-0 flex flex-col overflow-y-auto', animCls)}
      style={{
        ...bgStyle,
        fontFamily: design.fontFamily,
      }}
    >
      {/* Background overlay */}
      <div className="fixed inset-0 pointer-events-none" style={overlayStyle} />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        {isSplit ? (
          // ══════════════════════════════════════════════════════════
          // SPLIT LAYOUT
          // ══════════════════════════════════════════════════════════
          <div className="w-full max-w-5xl flex flex-col md:flex-row gap-6">
            {/* Info Panel */}
            <div className="flex-1 flex flex-col justify-center p-6 md:p-10 space-y-6" style={{ color: dark ? '#ffffff' : design.textColor }}>
              <PortalLogo design={design} size="large" />
              <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: design.headingFontFamily }}>
                {design.title}
              </h1>
              <p style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }} className="text-lg">
                {design.subtitle}
              </p>
              {design.welcomeMessage && (
                <p className="italic" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>
                  {design.welcomeMessage}
                </p>
              )}
              <HotelInfoBlock design={design} dark={dark} />
              <AmenitiesBlock design={design} dark={dark} />
            </div>

            {/* Form Panel */}
            <div className="w-full md:w-[420px] animate-in fade-in-0 slide-in-from-bottom-4 duration-500 transition-all">
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
                    {design.title}
                  </h2>
                  <p className="text-sm" style={{ color: getMutedTextColor(design) }}>{design.subtitle}</p>
                </div>

                {renderCardContent()}
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
                <p className="text-[10px]">Powered by StaySuite Hospitality OS</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Page Export (with Suspense boundary for useSearchParams)
// ────────────────────────────────────────────────────────────

export function WifiConnectPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0ea5e9, #065f46)' }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <p className="text-white/80 text-sm">Loading portal...</p>
          </div>
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
